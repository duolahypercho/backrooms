#!/usr/bin/env python3
"""Deterministic, offline PBR texture tools for THRESHOLD characters.

The generator deliberately derives color, normal, roughness and occlusion from
shared material features.  Scratches therefore change the micro-surface, pores
sit below the skin, and cavity dirt is dark *and* occluded instead of being
decorative flat noise. UV-specific panel seams remain authored in geometry and
bakes so a global texture never draws synthetic lines across unrelated islands.

The only Python dependency is NumPy, which ships with Blender.  PNG encoding is
implemented with the standard library so this works in Blender's Python without
Pillow::

    blender --background --factory-startup \
      --python scripts/blender/hd_pbr_tools.py -- --root .

Other Blender build scripts may import :func:`generate_texture_set`,
:func:`write_texture_set`, or :func:`create_blender_material`.

glTF channel contract
---------------------
``basecolor.png`` is sRGB.  Every other map is linear/non-color data.
``normal.png`` is tangent-space OpenGL (+Y / green-up), as glTF expects.
``orm.png`` packs AO in red, roughness in green, and metallic in blue.  The
standalone roughness/AO maps are supplied for baking and authoring workflows.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np


DEFAULT_RESOLUTION = 2048
MATERIALS = ("hazmat", "pale-skin")
DEFAULT_SEEDS = {"hazmat": 0x485A4D54, "pale-skin": 0x50414C45}
FOLDER_NAMES = {"hazmat": "hazmat", "pale-skin": "pale-entity"}
FILE_PREFIXES = {"hazmat": "hazmat", "pale-skin": "pale-skin"}


@dataclass(frozen=True)
class PBRTextureSet:
    """A complete glTF-ready material texture set in 8-bit storage space."""

    material: str
    resolution: int
    seed: int
    albedo: np.ndarray
    normal: np.ndarray
    roughness: np.ndarray
    ao: np.ndarray
    orm: np.ndarray


def _fade(value: np.ndarray) -> np.ndarray:
    """Quintic interpolation without the grid artifacts of linear noise."""

    return value * value * value * (value * (value * 6.0 - 15.0) + 10.0)


def _value_noise(resolution: int, cells: int, rng: np.random.Generator) -> np.ndarray:
    """Generate seamless 2D value noise at a requested feature frequency."""

    lattice = rng.random((cells, cells), dtype=np.float32)
    coordinate = np.arange(resolution, dtype=np.float32) * (cells / resolution)
    base = np.floor(coordinate).astype(np.int32)
    fraction = _fade(coordinate - base)
    following = (base + 1) % cells
    base %= cells

    top = lattice[base[:, None], base[None, :]]
    right = lattice[base[:, None], following[None, :]]
    bottom = lattice[following[:, None], base[None, :]]
    diagonal = lattice[following[:, None], following[None, :]]
    horizontal_top = top + (right - top) * fraction[None, :]
    horizontal_bottom = bottom + (diagonal - bottom) * fraction[None, :]
    return (horizontal_top + (horizontal_bottom - horizontal_top) * fraction[:, None]).astype(
        np.float32
    )


def _fbm(
    resolution: int,
    cells: int,
    octaves: int,
    rng: np.random.Generator,
    persistence: float = 0.52,
) -> np.ndarray:
    """Tileable fractional Brownian motion normalized to the [0, 1] interval."""

    result = np.zeros((resolution, resolution), dtype=np.float32)
    amplitude = 1.0
    total = 0.0
    for octave in range(octaves):
        result += _value_noise(resolution, cells * (2**octave), rng) * amplitude
        total += amplitude
        amplitude *= persistence
    return np.clip(result / total, 0.0, 1.0)


def _smooth(field: np.ndarray, iterations: int = 1) -> np.ndarray:
    """Small periodic Gaussian-like blur used for cavities and skin structures."""

    current = field.astype(np.float32, copy=False)
    for _ in range(iterations):
        north = np.roll(current, 1, axis=0)
        south = np.roll(current, -1, axis=0)
        west = np.roll(current, 1, axis=1)
        east = np.roll(current, -1, axis=1)
        current = (
            4.0 * current
            + 2.0 * (north + south + west + east)
            + np.roll(north, 1, axis=1)
            + np.roll(north, -1, axis=1)
            + np.roll(south, 1, axis=1)
            + np.roll(south, -1, axis=1)
        ) / 16.0
    return current.astype(np.float32)


def _normal_from_height(height: np.ndarray, strength: float) -> np.ndarray:
    """Encode a scalar height field as an OpenGL tangent-space normal map."""

    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
    nx = -dx
    # Image rows increase downward; invert that derivative for tangent +Y.
    ny = dy
    nz = np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    encoded = np.stack((nx / length, ny / length, nz / length), axis=2)
    return _to_u8(encoded * 0.5 + 0.5)


def _to_u8(value: np.ndarray) -> np.ndarray:
    return np.rint(np.clip(value, 0.0, 1.0) * 255.0).astype(np.uint8)


def _scratch_field(resolution: int, rng: np.random.Generator, count: int) -> np.ndarray:
    """Rasterize sparse directional abrasions without a drawing dependency."""

    mask = np.zeros((resolution, resolution), dtype=np.float32)
    for _ in range(count):
        cx = float(rng.uniform(0, resolution))
        cy = float(rng.uniform(0, resolution))
        length = float(rng.uniform(resolution * 0.018, resolution * 0.075))
        width = float(rng.uniform(0.55, 1.8))
        angle = float(rng.normal(-0.22, 0.42))
        cosine, sine = math.cos(angle), math.sin(angle)
        start = (cx - cosine * length, cy - sine * length)
        end = (cx + cosine * length, cy + sine * length)
        _capsule(mask, start, end, width)
    return mask


def _capsule(
    target: np.ndarray,
    start: tuple[float, float],
    end: tuple[float, float],
    radius: float,
    opacity: float = 1.0,
) -> None:
    """Draw one soft line segment into ``target`` in pixel coordinates."""

    height, width = target.shape
    x0, y0 = start
    x1, y1 = end
    margin = radius * 3.0
    left = max(0, int(math.floor(min(x0, x1) - margin)))
    right = min(width, int(math.ceil(max(x0, x1) + margin + 1)))
    top = max(0, int(math.floor(min(y0, y1) - margin)))
    bottom = min(height, int(math.ceil(max(y0, y1) + margin + 1)))
    if left >= right or top >= bottom:
        return
    yy, xx = np.mgrid[top:bottom, left:right]
    vx, vy = x1 - x0, y1 - y0
    denominator = max(vx * vx + vy * vy, 1e-6)
    along = np.clip(((xx - x0) * vx + (yy - y0) * vy) / denominator, 0.0, 1.0)
    nearest_x = x0 + along * vx
    nearest_y = y0 + along * vy
    distance_squared = (xx - nearest_x) ** 2 + (yy - nearest_y) ** 2
    stroke = np.exp(-distance_squared / max(radius * radius, 0.25)) * opacity
    target[top:bottom, left:right] = np.maximum(
        target[top:bottom, left:right], stroke.astype(np.float32)
    )


def _organic_lines(
    resolution: int,
    rng: np.random.Generator,
    roots: int,
    segments: tuple[int, int],
    radius: tuple[float, float],
    branching: bool,
) -> np.ndarray:
    """Generate tapered, wandering vessel/scar networks with optional branches."""

    mask = np.zeros((resolution, resolution), dtype=np.float32)
    for _ in range(roots):
        point = np.array(rng.uniform(0.04, 0.96, size=2) * resolution, dtype=np.float32)
        angle = float(rng.uniform(-math.pi, math.pi))
        total_segments = int(rng.integers(segments[0], segments[1] + 1))
        base_radius = float(rng.uniform(radius[0], radius[1])) * resolution / DEFAULT_RESOLUTION
        history = [point.copy()]
        for index in range(total_segments):
            angle += float(rng.normal(0.0, 0.23))
            distance = float(rng.uniform(0.018, 0.052) * resolution)
            direction = np.array((math.cos(angle), math.sin(angle)), dtype=np.float32)
            following = point + direction * np.float32(distance)
            following = np.clip(following, 0.0, resolution - 1.0)
            taper = max(0.35, 1.0 - index / (total_segments + 2))
            _capsule(mask, tuple(point), tuple(following), base_radius * taper)
            point = following
            history.append(point.copy())

        if branching and len(history) > 4:
            origin = history[int(rng.integers(1, len(history) - 2))]
            branch_angle = angle + float(rng.choice((-1.0, 1.0))) * float(rng.uniform(0.45, 1.05))
            branch = origin.copy()
            for index in range(int(rng.integers(2, 5))):
                branch_angle += float(rng.normal(0.0, 0.18))
                distance = float(rng.uniform(0.012, 0.03) * resolution)
                direction = np.array(
                    (math.cos(branch_angle), math.sin(branch_angle)), dtype=np.float32
                )
                following = branch + direction * np.float32(distance)
                following = np.clip(following, 0.0, resolution - 1.0)
                _capsule(mask, tuple(branch), tuple(following), base_radius * (0.45 - index * 0.06))
                branch = following
    return np.clip(mask, 0.0, 1.0)


def _generate_hazmat(resolution: int, seed: int) -> PBRTextureSet:
    rng = np.random.default_rng(seed)
    macro = _fbm(resolution, 3, 6, rng)
    folds = _fbm(resolution, 7, 5, rng)
    grime = np.clip((_fbm(resolution, 5, 5, rng) - 0.47) * 2.4, 0.0, 1.0)
    wear = np.clip((_fbm(resolution, 15, 4, rng) - 0.58) * 3.2, 0.0, 1.0)
    weave_warp = _fbm(resolution, 12, 3, rng)
    scratches = _scratch_field(resolution, rng, max(12, resolution // 40))

    uv = np.arange(resolution, dtype=np.float32) / resolution
    x = uv[None, :]
    y = uv[:, None]
    phase = (weave_warp - 0.5) * 0.9
    warp_threads = np.sin(math.tau * (x * 238.0 + phase))
    weft_threads = np.sin(math.tau * (y * 216.0 - phase * 0.73))
    weave = warp_threads * 0.52 + weft_threads * 0.48
    coating_pebbles = (_fbm(resolution, 64, 3, rng) - 0.5) * 2.0

    base = np.array([0.42, 0.39, 0.145], dtype=np.float32)
    color = base[None, None, :] * (0.78 + macro[:, :, None] * 0.35)
    color *= 1.0 - grime[:, :, None] * np.array([0.31, 0.28, 0.18], np.float32)
    color += wear[:, :, None] * np.array([0.105, 0.09, 0.025], np.float32)
    # UV-unaware seam lines would cross unrelated islands.  Construction seams
    # belong in geometry/bakes; this reusable surface only carries local wear.
    color += scratches[:, :, None] * np.array([0.052, 0.045, 0.016], np.float32)
    color *= 0.985 + weave[:, :, None] * 0.015

    height = (
        (folds - 0.5) * 0.12
        + weave * 0.031
        + coating_pebbles * 0.012
        - scratches * 0.019
    ).astype(np.float32)
    normal = _normal_from_height(height, strength=8.6)

    roughness = 0.74 + (macro - 0.5) * 0.12 + grime * 0.14 + coating_pebbles * 0.035
    roughness -= wear * 0.08 + scratches * 0.035
    roughness = np.clip(roughness, 0.43, 0.96)

    broad_height = _smooth(height, 7)
    cavity = np.clip((broad_height - height) * 4.8, 0.0, 1.0)
    ao = np.clip(1.0 - cavity * 0.29 - grime * 0.08, 0.62, 1.0)

    roughness_u8 = _to_u8(roughness)
    ao_u8 = _to_u8(ao)
    orm = np.stack((ao_u8, roughness_u8, np.zeros_like(ao_u8)), axis=2)
    return PBRTextureSet(
        material="hazmat",
        resolution=resolution,
        seed=seed,
        albedo=_to_u8(color),
        normal=normal,
        roughness=roughness_u8,
        ao=ao_u8,
        orm=orm,
    )


def _generate_pale_skin(resolution: int, seed: int) -> PBRTextureSet:
    rng = np.random.default_rng(seed)
    macro = _fbm(resolution, 3, 6, rng)
    mottling = _fbm(resolution, 8, 5, rng)
    blood_pooling = np.clip((_fbm(resolution, 4, 5, rng) - 0.50) * 2.4, 0.0, 1.0)
    desiccation = np.clip((_fbm(resolution, 19, 4, rng) - 0.54) * 2.7, 0.0, 1.0)
    micro = (_fbm(resolution, 58, 3, rng) - 0.5) * 2.0
    veins = _smooth(
        _organic_lines(
            resolution,
            rng,
            roots=max(8, resolution // 180),
            segments=(3, 7),
            radius=(0.8, 2.2),
            branching=True,
        ),
        2,
    )
    scars = _organic_lines(
        resolution,
        rng,
        roots=max(3, resolution // 640),
        segments=(2, 4),
        radius=(3.5, 7.0),
        branching=False,
    )
    scar_core = np.clip(scars * 1.5 - _smooth(scars, 4) * 0.52, 0.0, 1.0)
    scar_rim = np.clip(_smooth(scars, 7) - scars * 0.34, 0.0, 1.0)
    lesion_noise = _fbm(resolution, 12, 4, rng)
    lesions = np.clip((lesion_noise - 0.655) * 5.0, 0.0, 1.0)

    pore_seed = rng.random((resolution, resolution), dtype=np.float32)
    pores = np.clip((pore_seed - 0.9962) / 0.0038, 0.0, 1.0)
    pores = np.maximum(pores, np.roll(pores, 1, axis=0) * 0.25)
    pores = np.maximum(pores, np.roll(pores, 1, axis=1) * 0.22)
    cavities = np.clip(
        pores * 0.55 + scar_core * 0.48 + veins * 0.05 + lesions * 0.20, 0.0, 1.0
    )

    base = np.array([0.515, 0.485, 0.445], dtype=np.float32)
    color = base[None, None, :] * (0.86 + macro[:, :, None] * 0.27)
    violet = np.array([0.315, 0.265, 0.275], dtype=np.float32)
    color = color * (1.0 - blood_pooling[:, :, None] * 0.15) + violet * blood_pooling[:, :, None] * 0.15
    mottle_red = np.clip((mottling - 0.53) * 2.7, 0.0, 1.0)
    color += mottle_red[:, :, None] * np.array([0.055, -0.025, -0.018], np.float32)
    vein_tint = np.array([0.29, 0.305, 0.335], dtype=np.float32)
    color = color * (1.0 - veins[:, :, None] * 0.16) + vein_tint * veins[:, :, None] * 0.16
    color += desiccation[:, :, None] * np.array([0.055, 0.048, 0.034], np.float32)
    color += scar_rim[:, :, None] * np.array([0.075, 0.036, 0.030], np.float32)
    color -= scar_core[:, :, None] * np.array([0.070, 0.055, 0.045], np.float32)
    color -= pores[:, :, None] * np.array([0.032, 0.029, 0.025], np.float32)
    lesion_color = np.array([0.31, 0.245, 0.215], dtype=np.float32)
    color = color * (1.0 - lesions[:, :, None] * 0.19) + lesion_color * lesions[:, :, None] * 0.19

    # Pores and scar centers are true depressions; scar tissue and dry plaques rise.
    height = (
        (macro - 0.5) * 0.075
        + micro * 0.015
        - pores * 0.045
        - veins * 0.008
        - scar_core * 0.065
        + scar_rim * 0.085
        - lesions * 0.018
        + desiccation * 0.032
    ).astype(np.float32)
    normal = _normal_from_height(height, strength=8.7)

    roughness = 0.69 + micro * 0.045 + desiccation * 0.20 + scar_rim * 0.10
    roughness -= blood_pooling * 0.08 + scar_core * 0.04
    roughness += pores * 0.045 + lesions * 0.12
    roughness = np.clip(roughness, 0.42, 0.97)

    broad_height = _smooth(height, 7)
    concavity = np.clip((broad_height - height) * 4.2, 0.0, 1.0)
    ao = np.clip(1.0 - concavity * 0.36 - cavities * 0.12 - blood_pooling * 0.035, 0.55, 1.0)

    roughness_u8 = _to_u8(roughness)
    ao_u8 = _to_u8(ao)
    orm = np.stack((ao_u8, roughness_u8, np.zeros_like(ao_u8)), axis=2)
    return PBRTextureSet(
        material="pale-skin",
        resolution=resolution,
        seed=seed,
        albedo=_to_u8(color),
        normal=normal,
        roughness=roughness_u8,
        ao=ao_u8,
        orm=orm,
    )


def generate_texture_set(
    material: str,
    resolution: int = DEFAULT_RESOLUTION,
    seed: int | None = None,
) -> PBRTextureSet:
    """Generate one deterministic material set entirely in memory.

    ``material`` is ``"hazmat"`` or ``"pale-skin"``.  Power-of-two dimensions
    from 64 through 4096 are accepted so fast unit tests and 4K authoring are
    possible while checked-in delivery remains 2048.
    """

    if material not in MATERIALS:
        raise ValueError(f"Unknown material {material!r}; expected one of {MATERIALS}")
    if resolution < 64 or resolution > 4096 or resolution & (resolution - 1):
        raise ValueError("resolution must be a power of two between 64 and 4096")
    chosen_seed = DEFAULT_SEEDS[material] if seed is None else int(seed) & 0xFFFFFFFF
    if material == "hazmat":
        return _generate_hazmat(resolution, chosen_seed)
    return _generate_pale_skin(resolution, chosen_seed)


def validate_texture_set(texture_set: PBRTextureSet) -> dict[str, Any]:
    """Validate format, tangent normals, packing, and meaningful surface range."""

    resolution = texture_set.resolution
    expected_rgb = (resolution, resolution, 3)
    expected_gray = (resolution, resolution)
    checks = {
        "albedo": (texture_set.albedo, expected_rgb),
        "normal": (texture_set.normal, expected_rgb),
        "roughness": (texture_set.roughness, expected_gray),
        "ao": (texture_set.ao, expected_gray),
        "orm": (texture_set.orm, expected_rgb),
    }
    for label, (image, expected_shape) in checks.items():
        if image.shape != expected_shape:
            raise ValueError(f"{label} has shape {image.shape}, expected {expected_shape}")
        if image.dtype != np.uint8:
            raise ValueError(f"{label} must be uint8, got {image.dtype}")
    if not np.array_equal(texture_set.orm[:, :, 0], texture_set.ao):
        raise ValueError("ORM red channel must exactly match AO")
    if not np.array_equal(texture_set.orm[:, :, 1], texture_set.roughness):
        raise ValueError("ORM green channel must exactly match roughness")
    if np.any(texture_set.orm[:, :, 2]):
        raise ValueError("These organic materials must have zero metallic blue")

    decoded = texture_set.normal.astype(np.float32) / 127.5 - 1.0
    normal_lengths = np.linalg.norm(decoded, axis=2)
    if float(np.mean(normal_lengths)) < 0.985 or float(np.mean(normal_lengths)) > 1.015:
        raise ValueError("Normal vectors are not unit length after 8-bit encoding")
    if int(texture_set.normal[:, :, 2].min()) < 128:
        raise ValueError("Tangent normal Z must face away from the surface")

    dynamic_ranges = {
        label: int(image.max()) - int(image.min())
        for label, image in (
            ("albedo", texture_set.albedo),
            ("normal", texture_set.normal),
            ("roughness", texture_set.roughness),
            ("ao", texture_set.ao),
        )
    }
    minimum_ranges = {"albedo": 28, "normal": 18, "roughness": 24, "ao": 8}
    for label, minimum in minimum_ranges.items():
        if dynamic_ranges[label] < minimum:
            raise ValueError(f"{label} surface response is too flat ({dynamic_ranges[label]} < {minimum})")

    return {
        "material": texture_set.material,
        "resolution": resolution,
        "seed": texture_set.seed,
        "dynamicRanges": dynamic_ranges,
        "normalMeanLength": round(float(np.mean(normal_lengths)), 6),
        "normalMinZ": round(float(decoded[:, :, 2].min()), 6),
        "roughnessMean": round(float(texture_set.roughness.mean() / 255.0), 6),
        "aoMean": round(float(texture_set.ao.mean() / 255.0), 6),
    }


def _png_chunk(kind: bytes, data: bytes) -> bytes:
    checksum = zlib.crc32(kind)
    checksum = zlib.crc32(data, checksum) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


def write_png(path: Path, image: np.ndarray, compression: int = 9) -> None:
    """Write a deterministic 8-bit gray/RGB PNG using only the standard library."""

    if image.dtype != np.uint8 or image.ndim not in (2, 3):
        raise ValueError("PNG input must be a uint8 grayscale or RGB array")
    if image.ndim == 3 and image.shape[2] != 3:
        raise ValueError("RGB PNG input must have exactly three channels")
    height, width = image.shape[:2]
    color_type = 0 if image.ndim == 2 else 2
    bytes_per_pixel = 1 if image.ndim == 2 else 3
    compressor = zlib.compressobj(compression)
    compressed: list[bytes] = []
    previous = np.zeros(width * bytes_per_pixel, dtype=np.int16)
    for row in image:
        raw = np.ascontiguousarray(row).reshape(-1).astype(np.int16)
        left = np.zeros_like(raw)
        left[bytes_per_pixel:] = raw[:-bytes_per_pixel]
        upper_left = np.zeros_like(raw)
        upper_left[bytes_per_pixel:] = previous[:-bytes_per_pixel]

        # PNG's five reversible filters.  Select per row using libpng's
        # signed-residual heuristic; this dramatically reduces embedded GLB
        # size for smooth tangent normals without discarding any detail.
        predictor = left + previous - upper_left
        distance_left = np.abs(predictor - left)
        distance_up = np.abs(predictor - previous)
        distance_corner = np.abs(predictor - upper_left)
        paeth = np.where(
            (distance_left <= distance_up) & (distance_left <= distance_corner),
            left,
            np.where(distance_up <= distance_corner, previous, upper_left),
        )
        candidates = (
            (0, raw),
            (1, raw - left),
            (2, raw - previous),
            (3, raw - ((left + previous) // 2)),
            (4, raw - paeth),
        )
        chosen_filter, chosen = min(
            candidates,
            key=lambda item: int(np.minimum(item[1] & 0xFF, 256 - (item[1] & 0xFF)).sum()),
        )
        filtered = (chosen & 0xFF).astype(np.uint8).tobytes()
        block = compressor.compress(bytes((chosen_filter,)) + filtered)
        if block:
            compressed.append(block)
        previous = raw
    compressed.append(compressor.flush())
    path.parent.mkdir(parents=True, exist_ok=True)
    header = struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", header)
        + _png_chunk(b"IDAT", b"".join(compressed))
        + _png_chunk(b"IEND", b"")
    )


def _contact_sheet(texture_set: PBRTextureSet, tile_size: int = 512) -> np.ndarray:
    """Create a labeled-by-layout 2x2 proof sheet: color, normal, roughness, ORM."""

    step = max(1, texture_set.resolution // tile_size)

    def preview(image: np.ndarray) -> np.ndarray:
        sampled = image[::step, ::step][:tile_size, :tile_size]
        if sampled.ndim == 2:
            sampled = np.repeat(sampled[:, :, None], 3, axis=2)
        return sampled.copy()

    panels = [
        preview(texture_set.albedo),
        preview(texture_set.normal),
        preview(texture_set.roughness),
        preview(texture_set.orm),
    ]
    borders = ((245, 232, 186), (115, 139, 255), (205, 205, 205), (240, 176, 72))
    for panel, color in zip(panels, borders):
        panel[:6, :, :] = color
        panel[-6:, :, :] = color
        panel[:, :6, :] = color
        panel[:, -6:, :] = color
    return np.concatenate((np.concatenate(panels[:2], axis=1), np.concatenate(panels[2:], axis=1)), axis=0)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def texture_paths(directory: Path, material: str) -> dict[str, Path]:
    """Return canonical map paths for a material directory."""

    prefix = FILE_PREFIXES[material]
    return {
        "baseColor": directory / f"{prefix}-basecolor.png",
        "normal": directory / f"{prefix}-normal.png",
        "roughness": directory / f"{prefix}-roughness.png",
        "occlusion": directory / f"{prefix}-ao.png",
        "orm": directory / f"{prefix}-orm.png",
    }


def write_texture_set(
    texture_set: PBRTextureSet,
    directory: Path,
    *,
    write_contact_sheet: bool = True,
) -> dict[str, Any]:
    """Validate and persist maps, manifest, and a visual proof contact sheet."""

    validation = validate_texture_set(texture_set)
    paths = texture_paths(directory, texture_set.material)
    arrays = {
        "baseColor": texture_set.albedo,
        "normal": texture_set.normal,
        "roughness": texture_set.roughness,
        "occlusion": texture_set.ao,
        "orm": texture_set.orm,
    }
    for role, path in paths.items():
        write_png(path, arrays[role])

    contact_path = directory / f"{FILE_PREFIXES[texture_set.material]}-contact-sheet.png"
    if write_contact_sheet:
        write_png(contact_path, _contact_sheet(texture_set))

    files = {
        role: {"file": path.name, "sha256": _sha256(path)} for role, path in paths.items()
    }
    if write_contact_sheet:
        files["contactSheet"] = {"file": contact_path.name, "sha256": _sha256(contact_path)}
    manifest = {
        "schemaVersion": 1,
        "generator": "scripts/blender/hd_pbr_tools.py",
        "material": texture_set.material,
        "resolution": [texture_set.resolution, texture_set.resolution],
        "seed": texture_set.seed,
        "colorSpace": {
            "baseColor": "sRGB",
            "normal": "Non-Color / linear",
            "roughness": "Non-Color / linear",
            "occlusion": "Non-Color / linear",
            "orm": "Non-Color / linear",
        },
        "normalConvention": "OpenGL tangent space (+Y / green-up)",
        "ormChannels": {"R": "occlusion", "G": "roughness", "B": "metallic (zero)"},
        "glTFWiring": {
            "baseColorTexture": "baseColor",
            "normalTexture": "normal",
            "occlusionTexture": "orm.R",
            "metallicRoughnessTexture": "orm (roughness G, metallic B)",
        },
        "files": files,
        "validation": validation,
    }
    manifest_path = directory / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def _gltf_occlusion_group(node_tree: Any) -> Any:
    """Create Blender's exporter-recognized glTF occlusion socket group."""

    import bpy  # Imported lazily so texture generation also works outside Blender.

    group_name = "glTF Material Output"
    group = bpy.data.node_groups.get(group_name)
    if group is None:
        group = bpy.data.node_groups.new(group_name, "ShaderNodeTree")
        if hasattr(group, "interface"):
            group.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
        else:  # Blender 3.x compatibility.
            group.inputs.new("NodeSocketFloat", "Occlusion")
    group_node = node_tree.nodes.new("ShaderNodeGroup")
    group_node.node_tree = group
    group_node.name = group_name
    group_node.label = "glTF packed AO (ORM red)"
    return group_node


def create_blender_material(
    name: str,
    texture_directory: Path,
    material: str,
    *,
    skin_subsurface: float = 0.075,
) -> Any:
    """Build a Blender Principled material wired for correct glTF export.

    The ORM texture is deliberately shared by occlusion, roughness and metallic;
    glTF exporters can therefore preserve the required channel packing.  The
    standalone roughness and AO files remain available for offline baking tools.
    """

    if material not in MATERIALS:
        raise ValueError(f"Unknown material {material!r}; expected one of {MATERIALS}")
    import bpy  # Blender-only operation, kept out of module import path.

    paths = texture_paths(Path(texture_directory), material)
    for role in ("baseColor", "normal", "orm"):
        if not paths[role].is_file():
            raise FileNotFoundError(f"Missing {role} texture: {paths[role]}")

    blender_material = bpy.data.materials.new(name)
    blender_material.use_nodes = True
    blender_material["hd_pbr_material"] = material
    nodes = blender_material.node_tree.nodes
    links = blender_material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (780, 80)
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.location = (470, 80)
    principled.inputs["Metallic"].default_value = 0.0
    if material == "pale-skin" and "Subsurface Weight" in principled.inputs:
        principled.inputs["Subsurface Weight"].default_value = skin_subsurface
        if "Subsurface Radius" in principled.inputs:
            principled.inputs["Subsurface Radius"].default_value = (1.0, 0.42, 0.22)
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])

    base_node = nodes.new("ShaderNodeTexImage")
    base_node.name = "HD_BaseColor_sRGB"
    base_node.label = "sRGB base color"
    base_node.location = (-640, 260)
    base_node.image = bpy.data.images.load(str(paths["baseColor"].resolve()), check_existing=True)
    base_node.image.colorspace_settings.name = "sRGB"
    links.new(base_node.outputs["Color"], principled.inputs["Base Color"])

    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = "HD_Normal_OpenGL"
    normal_node.label = "Non-Color OpenGL tangent normal"
    normal_node.location = (-640, -40)
    normal_node.image = bpy.data.images.load(str(paths["normal"].resolve()), check_existing=True)
    normal_node.image.colorspace_settings.name = "Non-Color"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.location = (120, -110)
    normal_map.space = "TANGENT"
    normal_map.inputs["Strength"].default_value = 1.0
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])

    orm_node = nodes.new("ShaderNodeTexImage")
    orm_node.name = "HD_ORM_NonColor"
    orm_node.label = "R=AO G=Roughness B=Metallic"
    orm_node.location = (-640, -350)
    orm_node.image = bpy.data.images.load(str(paths["orm"].resolve()), check_existing=True)
    orm_node.image.colorspace_settings.name = "Non-Color"
    separate = nodes.new("ShaderNodeSeparateColor")
    separate.location = (-60, -330)
    links.new(orm_node.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], principled.inputs["Roughness"])
    links.new(separate.outputs["Blue"], principled.inputs["Metallic"])
    gltf_output = _gltf_occlusion_group(blender_material.node_tree)
    gltf_output.location = (220, -430)
    links.new(separate.outputs["Red"], gltf_output.inputs["Occlusion"])
    return blender_material


def _parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Repository root (defaults to the script's repository).",
    )
    parser.add_argument("--material", choices=("all",) + MATERIALS, default="all")
    parser.add_argument("--resolution", type=int, default=DEFAULT_RESOLUTION)
    parser.add_argument("--seed", type=lambda value: int(value, 0), default=None)
    parser.add_argument("--skip-contact-sheet", action="store_true")
    parser.add_argument("--validate-only", action="store_true")
    return parser.parse_args(list(argv) if argv is not None else None)


def main(argv: Iterable[str] | None = None) -> int:
    if argv is None and "--" in sys.argv:
        argv = sys.argv[sys.argv.index("--") + 1 :]
    arguments = _parse_args(argv)
    materials = MATERIALS if arguments.material == "all" else (arguments.material,)
    root = arguments.root.resolve()
    reports: list[dict[str, Any]] = []
    for material in materials:
        directory = root / "art" / "characters" / "textures" / FOLDER_NAMES[material]
        if arguments.validate_only:
            manifest_path = directory / "manifest.json"
            if not manifest_path.is_file():
                raise FileNotFoundError(f"Missing generated manifest: {manifest_path}")
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            for entry in manifest["files"].values():
                path = directory / entry["file"]
                if not path.is_file() or _sha256(path) != entry["sha256"]:
                    raise ValueError(f"Texture hash mismatch: {path}")
            reports.append(manifest["validation"])
            continue
        texture_set = generate_texture_set(material, arguments.resolution, arguments.seed)
        manifest = write_texture_set(
            texture_set,
            directory,
            write_contact_sheet=not arguments.skip_contact_sheet,
        )
        reports.append(manifest["validation"])
    print(json.dumps(reports, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
