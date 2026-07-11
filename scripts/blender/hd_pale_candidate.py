#!/usr/bin/env python3
"""Build the production Pale Entity in Blender 5.1+.

The anatomical foundation is MakeHuman's CC0 ``male_muscle_13290`` proxy. It
is deformed into THRESHOLD's 2.45 m entity, posed with the arms hanging below
the hips, subdivided, textured, and bound to a 24-bone humanoid skeleton. The
finished visible anatomy is the one continuous authored source surface: there
are no sphere, capsule, cylinder, cone, or overlapping body-part meshes in the
delivered character.

Run with::

    blender --background --factory-startup \
      --python scripts/blender/hd_pale_candidate.py -- --root .

Blender coordinates are Z-up and -Y-forward. The production source, web GLB,
Unreal FBXs, validation report, and Blender inspection renders are all emitted
from this one deterministic build.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import shutil
import sys
import time
from pathlib import Path
from typing import Iterable

import bpy
import bmesh
from mathutils import Matrix, Vector


CLIPS = (
    "Idle",
    "Walk",
    "Run",
    "Crouch",
    "ArmBend",
    "Glimpse",
    "Stalk",
    "Search",
    "Chase",
    "Attack",
)
TARGET_HEIGHT = 2.45
SOURCE_SHA256 = "4f384d7ec5b0a5f370e24117c8f98dfa7ee2a3b357d9275872ae4393135f2b0e"
LICENSE_SHA256 = "a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499"
UPSTREAM_COMMIT = "8cf9645b975a98eea056b140df11a1d278da0d10"
SOURCE_CANDIDATES = (
    Path("art/characters/candidates/foundation/source/male_muscle_13290.obj"),
    Path("/tmp/makehuman-assets/base/proxymeshes/male_muscle_13290/male_muscle_13290.obj"),
)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--skip-textures", action="store_true")
    parser.add_argument("--skip-render", action="store_true")
    parser.add_argument("--clay-only", action="store_true", help="Render the continuous unrigged foundation and stop")
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.fps = 24
    bpy.context.preferences.filepaths.save_version = 0


def load_pbr_tools(root: Path):
    path = root / "scripts" / "blender" / "hd_pbr_tools.py"
    spec = importlib.util.spec_from_file_location("hd_pbr_tools", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load shared PBR tools from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_foundation_tools(root: Path):
    path = root / "scripts" / "blender" / "hd_humanoid_foundation.py"
    spec = importlib.util.spec_from_file_location("hd_humanoid_foundation", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load tested humanoid foundation from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_source(root: Path, character_dir: Path) -> Path:
    source_dir = character_dir / "source"
    source_path = source_dir / "male_muscle_13290_cc0.obj"
    source_dir.mkdir(parents=True, exist_ok=True)
    if not source_path.is_file():
        resolved = [path if path.is_absolute() else root / path for path in SOURCE_CANDIDATES]
        original = next(
            (path for path in resolved if path.is_file() and file_sha256(path) == SOURCE_SHA256),
            None,
        )
        if original is None:
            raise FileNotFoundError(
                "Missing verified MakeHuman CC0 anatomical base with SHA-256 "
                f"{SOURCE_SHA256}. Expected one of: " + ", ".join(str(path) for path in resolved)
            )
        shutil.copy2(original, source_path)
    if file_sha256(source_path) != SOURCE_SHA256:
        raise RuntimeError(f"CC0 source hash mismatch: {source_path}")

    license_source = root / "art" / "characters" / "candidates" / "foundation" / "source" / "CC0-1.0.txt"
    license_path = source_dir / "CC0-1.0.txt"
    if not license_path.is_file():
        if not license_source.is_file() or file_sha256(license_source) != LICENSE_SHA256:
            raise FileNotFoundError("Verified MakeHuman CC0-1.0 legal text is missing")
        shutil.copy2(license_source, license_path)
    if file_sha256(license_path) != LICENSE_SHA256:
        raise RuntimeError(f"CC0 legal text hash mismatch: {license_path}")

    (source_dir / "PROVENANCE.md").write_text(
        "# Pale Entity anatomical source provenance\n\n"
        "- Base: MakeHuman hm08 `male_muscle_13290` proxy\n"
        "- Upstream: `makehumancommunity/makehuman-assets`\n"
        f"- Upstream commit: `{UPSTREAM_COMMIT}`\n"
        "- Upstream path: `base/proxymeshes/male_muscle_13290/male_muscle_13290.obj`\n"
        f"- Source SHA-256: `{SOURCE_SHA256}`\n"
        "- License: Creative Commons CC0 1.0 Universal\n"
        f"- License SHA-256: `{LICENSE_SHA256}`\n\n"
        "The exact source is a legally cleared continuous topology/UV foundation. "
        "THRESHOLD authors the creature proportions, neutral pelvis, eyeless face, "
        "surface treatment, rig, weights, animation, and presentation.\n",
        encoding="utf-8",
    )
    return source_path


def import_anatomical_base(path: Path) -> bpy.types.Object:
    bpy.ops.wm.obj_import(filepath=str(path), use_split_objects=False, use_split_groups=False)
    meshes = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one continuous source mesh, imported {len(meshes)}")
    body = meshes[0]
    # Blender's OBJ importer applies a +90 degree object-space X rotation to
    # convert OBJ Y-up. ``deform_to_entity`` performs its own local-axis map,
    # so retaining that wrapper transform would lay the body on the floor while
    # later Z-authored details remain upright.
    body.rotation_mode = "XYZ"
    body.matrix_world = Matrix.Identity(4)
    body.name = "PaleEntity_Mesh"
    body.data.name = "PaleEntity_ConnectedAnatomy"
    body.data.materials.clear()
    return body


def connected_component_count(obj: bpy.types.Object) -> int:
    adjacency: list[list[int]] = [[] for _ in obj.data.vertices]
    for edge in obj.data.edges:
        a, b = edge.vertices
        adjacency[a].append(b)
        adjacency[b].append(a)
    unseen = set(range(len(adjacency)))
    components = 0
    while unseen:
        components += 1
        stack = [unseen.pop()]
        while stack:
            current = stack.pop()
            for neighbor in adjacency[current]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    stack.append(neighbor)
    return components


def welded_component_count(obj: bpy.types.Object, tolerance: float = 1e-5) -> int:
    """Count surface components after welding exporter seam duplicates.

    glTF duplicates vertices at material/normal/UV boundaries. The positions
    remain coincident and reconstruct the same authored surface, so raw index
    connectivity alone over-counts the exported anatomical components.
    """

    representatives: dict[tuple[int, int, int], int] = {}
    vertex_representatives: list[int] = []
    for vertex in obj.data.vertices:
        key = tuple(int(round(value / tolerance)) for value in vertex.co)
        vertex_representatives.append(representatives.setdefault(key, len(representatives)))
    adjacency: list[set[int]] = [set() for _ in representatives]
    for edge in obj.data.edges:
        first = vertex_representatives[edge.vertices[0]]
        second = vertex_representatives[edge.vertices[1]]
        if first != second:
            adjacency[first].add(second)
            adjacency[second].add(first)
    unseen = set(range(len(adjacency)))
    components = 0
    while unseen:
        components += 1
        stack = [unseen.pop()]
        while stack:
            current = stack.pop()
            for neighbor in adjacency[current]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    stack.append(neighbor)
    return components


def keep_largest_component(obj: bpy.types.Object) -> int:
    """Remove any tiny boolean chip while preserving the continuous anatomy."""
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    unseen = set(mesh.verts)
    components: list[set[bmesh.types.BMVert]] = []
    while unseen:
        component: set[bmesh.types.BMVert] = set()
        stack = [unseen.pop()]
        while stack:
            vertex = stack.pop()
            component.add(vertex)
            for edge in vertex.link_edges:
                neighbor = edge.other_vert(vertex)
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    stack.append(neighbor)
        components.append(component)
    if len(components) > 1:
        largest = max(components, key=len)
        rejected = [vertex for component in components if component is not largest for vertex in component]
        bmesh.ops.delete(mesh, geom=rejected, context="VERTS")
        mesh.to_mesh(obj.data)
        obj.data.update()
    count = len(components)
    mesh.free()
    return count


def assert_body_integrity(body: bpy.types.Object, stage: str) -> dict[str, float | int]:
    if body.type != "MESH" or not body.data.vertices:
        raise RuntimeError(f"{stage}: body mesh is empty")
    components = connected_component_count(body)
    if components != 1:
        raise RuntimeError(f"{stage}: anatomical body has {components} disconnected components")
    points = [body.matrix_world @ vertex.co for vertex in body.data.vertices]
    minimum_z = min(point.z for point in points)
    maximum_z = max(point.z for point in points)
    height = maximum_z - minimum_z
    if abs(minimum_z) > 0.03:
        raise RuntimeError(f"{stage}: feet are not planted (minimum Z {minimum_z:.4f})")
    if abs(height - TARGET_HEIGHT) > 0.08:
        raise RuntimeError(f"{stage}: body height {height:.4f}m misses {TARGET_HEIGHT}m")
    if max(abs(body.rotation_euler.x), abs(body.rotation_euler.y), abs(body.rotation_euler.z)) > 1e-5:
        raise RuntimeError(f"{stage}: unexpected object rotation {tuple(body.rotation_euler)}")
    return {"components": components, "minimumZ": minimum_z, "maximumZ": maximum_z, "height": height}


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge0 == edge1:
        return float(value >= edge1)
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def deform_to_entity_legacy_rejected(body: bpy.types.Object) -> None:
    """Turn the MakeHuman T-pose into a long-limbed, emaciated hanging pose."""

    vertices = body.data.vertices
    raw_min_y = min(vertex.co.y for vertex in vertices)
    raw_max_y = max(vertex.co.y for vertex in vertices)
    raw_height = raw_max_y - raw_min_y
    base_scale = TARGET_HEIGHT / raw_height

    # Raw MakeHuman coordinates: X width, Y up, +Z front.  Convert to Blender
    # X width, Z up, -Y front before applying the creature proportions.
    for vertex in vertices:
        raw = vertex.co.copy()
        x = raw.x * base_scale
        z = (raw.y - raw_min_y) * base_scale
        y = -(raw.z - 0.66) * base_scale

        # Rotate T-pose arms down with a broad shoulder blend.  Vertices in the
        # deltoid transition receive partial rotation, retaining a continuous
        # shoulder/armpit rather than a glued-on limb seam.
        side = -1.0 if x < 0.0 else 1.0
        shoulder_x = side * 0.235
        shoulder_z = 1.865 + (-0.012 if side > 0 else 0.012)
        # Hands in this MakeHuman bind mesh sit slightly below the shoulder
        # line even in T-pose. A 1.18 m gate left their distal vertices behind,
        # stretching fingers across the abdomen; 0.95..1.10 includes every arm
        # vertex while still excluding feet and legs.
        arm_weight = smoothstep(0.205, 0.315, abs(x)) * smoothstep(0.95, 1.10, z)
        if arm_weight > 0.0:
            dx = x - shoulder_x
            dz = z - shoulder_z
            # The MakeHuman proxy is an A-pose, not a horizontal T-pose: the
            # hand already sits roughly 0.7 m below the shoulder. About thirty
            # degrees aligns that diagonal limb vertically. Seventy-six degrees
            # over-rotated it through the pelvis and crossed the fingers.
            angle = math.radians(-side * (30.0 + (1.5 if side > 0 else 0.0)))
            cosine = math.cos(angle)
            sine = math.sin(angle)
            # Extra radial length gives the inhuman below-hip reach.
            radial = 1.16
            rotated_x = shoulder_x + radial * (cosine * dx - sine * dz)
            rotated_z = shoulder_z + radial * (sine * dx + cosine * dz)
            x = x * (1.0 - arm_weight) + rotated_x * arm_weight
            z = z * (1.0 - arm_weight) + rotated_z * arm_weight
            # Supinate the hanging hand slightly and keep arms off the torso.
            y += side * 0.006 * arm_weight

        # Starved proportions.  Scale around regional centerlines rather than
        # the origin so limbs become sinewy without collapsing together.
        if z < 1.18:  # legs and feet
            leg_side = -1.0 if x < 0.0 else 1.0
            center_x = leg_side * (0.105 + 0.018 * (1.0 - z / 1.18))
            x = center_x + (x - center_x) * (0.77 if z > 0.18 else 1.05)
            y *= 0.82 if z > 0.16 else 1.08
        elif abs(x) < 0.27:  # pelvis, waist, ribcage
            if z < 1.34:
                x *= 0.72
                y *= 0.76
            elif z < 1.58:
                x *= 0.61
                y *= 0.67
            elif z < 1.90:
                # Keep the bony ribcage broad but shallow.
                x *= 0.86
                y *= 0.70
        elif z < 1.86:  # hanging limbs
            y *= 0.72
            side = -1.0 if x < 0 else 1.0
            arm_center = side * (0.235 + 0.115 * smoothstep(1.86, 0.62, z))
            arm_thin = 0.82 if z < 0.88 else 0.70
            x = arm_center + (x - arm_center) * arm_thin

        # Elongated cranium and tighter lower face.  Existing facial topology
        # remains intact for believable brow, nasal, lip, and jaw planes.
        if z > 2.055:
            head_t = smoothstep(2.055, 2.20, z)
            z = 2.055 + (z - 2.055) * (1.18 + 0.08 * head_t)
            x *= 0.88 + 0.06 * head_t
            y *= 0.94

        # Pull front-facing tissue into deep sightless sockets and a narrow
        # vertical facial cleft.  Boolean cutters later open the darkest core.
        if y < -0.055 and z > 2.04:
            for socket_x, asymmetry in ((-0.060, 1.0), (0.060, 0.92)):
                dx = (x - socket_x) / (0.060 * asymmetry)
                dz = (z - 2.275) / 0.052
                depression = math.exp(-(dx * dx + dz * dz) * 1.7)
                y += 0.038 * depression
            mouth_dx = x / 0.034
            mouth_dz = (z - 2.135) / 0.105
            tear = math.exp(-(mouth_dx * mouth_dx + mouth_dz * mouth_dz) * 1.45)
            y += 0.020 * tear

        # Suppress breast volume while preserving the connected pectoral/rib
        # topology. The female muscle proxy avoids the male helper bulge; unlike
        # the discarded pass, no crotch vertices are collapsed into a flat fan.
        if 1.54 < z < 1.87 and abs(x) < 0.205 and y < -0.055:
            y = -0.055 + (y + 0.055) * 0.22

        # The CC0 anatomical proxy includes an explicit genital study. This
        # character is an androgynous entity, so fold that continuous topology
        # back into a neutral pelvis instead of covering it with a floating
        # plate or deleting faces. The broad smooth mask preserves edge flow
        # and keeps the body a single connected, UV-authored surface.
        groin_side = smoothstep(0.135, 0.045, abs(x))
        groin_low = smoothstep(0.72, 0.90, z)
        groin_high = smoothstep(1.13, 1.01, z)
        groin_mask = groin_side * groin_low * groin_high
        if groin_mask > 0.0 and y > 0.025:
            y = y * (1.0 - groin_mask) + 0.018 * groin_mask
            if z < 0.91:
                z += (0.91 - z) * groin_mask * 0.92

        # Make the face read as an eyeless organism rather than a mannequin.
        # These are local surface deformations on the connected facial loops;
        # the final eyes and mouth are not separate spheres or inset props.
        if y < -0.035 and z > 2.02:
            brow = math.exp(-(((abs(x) - 0.058) / 0.058) ** 2 + ((z - 2.305) / 0.055) ** 2))
            y -= 0.010 * brow
            cheek = math.exp(-(((abs(x) - 0.078) / 0.048) ** 2 + ((z - 2.205) / 0.080) ** 2))
            y += 0.008 * cheek
            mouth_seam = math.exp(-((x / 0.042) ** 2 + ((z - 2.125) / 0.080) ** 2))
            y += 0.009 * mouth_seam

        # Continuous anatomical landmarks under taut skin. These displacements
        # work on the connected source surface; they are not attached tubes.
        if y < -0.018 and 1.49 < z < 1.88 and abs(x) < 0.245:
            chest_mask = smoothstep(0.245, 0.16, abs(x))
            rib_phase = (z - 1.50) / 0.061
            rib = max(0.0, math.cos(rib_phase * math.tau)) ** 5
            y -= 0.0115 * rib * (0.48 + 0.52 * abs(x) / 0.245) * chest_mask
            sternum = math.exp(-((x / 0.020) ** 2))
            y -= 0.0060 * sternum
            clavicle_z = 1.875 - 0.20 * abs(x)
            clavicle = math.exp(-(((z - clavicle_z) / 0.018) ** 2))
            y -= 0.0085 * clavicle * smoothstep(0.255, 0.03, abs(x))
        if y > 0.018 and 1.30 < z < 1.91:
            spine = math.exp(-((x / 0.024) ** 2))
            vertebrae = 0.45 + 0.55 * max(0.0, math.cos((z - 1.31) / 0.052 * math.tau)) ** 4
            y += 0.0068 * spine * vertebrae
            scapula_l = math.exp(-(((x + 0.125) / 0.060) ** 2 + ((z - 1.72) / 0.17) ** 2))
            scapula_r = math.exp(-(((x - 0.120) / 0.055) ** 2 + ((z - 1.75) / 0.16) ** 2))
            y += 0.0055 * scapula_l + 0.0062 * scapula_r
        if y < -0.015 and z < 0.78:
            leg_center = (-0.108 if x < 0 else 0.114)
            tibia = math.exp(-(((x - leg_center) / 0.025) ** 2)) * smoothstep(0.12, 0.28, z) * smoothstep(0.72, 0.55, z)
            patella = math.exp(-(((x - leg_center) / 0.050) ** 2 + ((z - 0.665) / 0.045) ** 2))
            y -= 0.0052 * tibia + 0.0065 * patella
        if y < -0.015 and 1.86 < z < 2.08 and abs(x) < 0.09:
            neck_tendon = math.exp(-(((abs(x) - 0.040) / 0.018) ** 2))
            y -= 0.0048 * neck_tendon

        # Controlled asymmetry avoids a mirrored digital mannequin read.
        x += 0.0045 * math.sin(z * 7.1) * smoothstep(0.55, 1.9, z)
        if x > 0.22 and z < 1.5:
            z -= 0.008 * smoothstep(0.22, 0.45, x)
        vertex.co = (x, y, z)

    # Normalize feet/top after skull elongation while preserving metric scale.
    minimum = min(vertex.co.z for vertex in vertices)
    maximum = max(vertex.co.z for vertex in vertices)
    scale = TARGET_HEIGHT / (maximum - minimum)
    for vertex in vertices:
        vertex.co.x *= scale
        vertex.co.y *= scale
        vertex.co.z = (vertex.co.z - minimum) * scale

    body.data.update()
    for polygon in body.data.polygons:
        polygon.use_smooth = True


def deform_to_entity(body: bpy.types.Object, foundation) -> list[list[tuple[str, float]]]:
    """Pose through the tested no-tear LBS foundation, then sculpt proportions.

    The discarded first pass rotated coordinate bands directly and exposed the
    MakeHuman crotch/hand helper fans. This path uses the shared anatomical arm
    domain and top-four weights, exactly as the independent foundation proof.
    Subsequent operations are continuous, low-amplitude regional scaling.
    """

    foundation.normalize_source_coordinates(body)
    source_specs = foundation.source_bone_specs()
    source_weights = foundation.calculate_weights(body, source_specs)
    transforms = {spec.name: Matrix.Identity(4) for spec in source_specs}
    # The shared proof uses 27 degrees for a normal adult. Thirty-two degrees
    # and a small radial extension create the entity's lower hand reach without
    # crossing either limb through the pelvis.
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        shoulder = next(spec.head for spec in source_specs if spec.name == f"upper_arm.{suffix}")
        transform = foundation.rotation_about(shoulder, math.radians(side * 32.0))
        for stem in ("upper_arm", "forearm", "hand"):
            transforms[f"{stem}.{suffix}"] = transform
    foundation.deform_to_relaxed_pose(body, source_weights, transforms)
    posed_specs = foundation.target_bone_specs(source_specs, transforms)
    spec_by_name = {spec.name: spec for spec in posed_specs}
    scale = TARGET_HEIGHT / foundation.TARGET_HEIGHT

    def closest(point: Vector, head: Vector, tail: Vector) -> Vector:
        segment = tail - head
        if segment.length_squared < 1e-12:
            return head.copy()
        amount = max(0.0, min(1.0, (point - head).dot(segment) / segment.length_squared))
        return head + segment * amount

    for vertex, influences in zip(body.data.vertices, source_weights, strict=True):
        point = vertex.co * scale
        arm_influences = [(name, weight) for name, weight in influences if name.startswith(("upper_arm.", "forearm.", "hand."))]
        arm_mask = sum(weight for _name, weight in arm_influences)
        leg_influences = [(name, weight) for name, weight in influences if name.startswith(("thigh.", "shin.", "foot.", "toe."))]
        leg_mask = sum(weight for _name, weight in leg_influences)
        torso_mask = sum(weight for name, weight in influences if name in {"hips", "spine_01", "spine_02", "chest"})
        head_mask = sum(weight for name, weight in influences if name in {"neck", "head"})

        if arm_mask > 1e-5:
            total = sum(weight for _name, weight in arm_influences)
            center = Vector((0.0, 0.0, 0.0))
            for name, weight in arm_influences:
                spec = spec_by_name[name]
                center += closest(point / scale, spec.head, spec.tail) * scale * (weight / total)
            thin = 0.72 if point.z > 0.86 else 0.82
            shaped = point.copy()
            shaped.x = center.x + (point.x - center.x) * thin
            shaped.y = center.y + (point.y - center.y) * 0.69
            suffix = "L" if point.x < 0 else "R"
            shoulder = spec_by_name[f"upper_arm.{suffix}"].head * scale
            distal = sum(
                weight for name, weight in arm_influences
                if name.startswith(("forearm.", "hand."))
            ) / total
            shaped = shoulder + (shaped - shoulder) * (1.13 + 0.11 * distal)
            point = point.lerp(shaped, arm_mask)

        if leg_mask > 1e-5:
            total = sum(weight for _name, weight in leg_influences)
            center = Vector((0.0, 0.0, 0.0))
            for name, weight in leg_influences:
                spec = spec_by_name[name]
                center += closest(point / scale, spec.head, spec.tail) * scale * (weight / total)
            shaped = point.copy()
            shaped.x = center.x + (point.x - center.x) * (0.76 if point.z > 0.20 else 0.94)
            shaped.y = center.y + (point.y - center.y) * (0.73 if point.z > 0.18 else 0.95)
            point = point.lerp(shaped, leg_mask)

        if torso_mask > 1e-5:
            if point.z < 1.30:
                width = 0.72
                depth = 0.70
            elif point.z < 1.58:
                width = 0.60
                depth = 0.61
            else:
                width = 0.80
                depth = 0.67
            shaped = Vector((point.x * width, point.y * depth, point.z))
            point = point.lerp(shaped, torso_mask)

        if head_mask > 1e-5 and point.z > 1.96:
            shaped = point.copy()
            shaped.x *= 0.88
            shaped.y *= 0.92
            shaped.z = 1.96 + (point.z - 1.96) * 1.20
            point = point.lerp(shaped, head_mask)

        vertex.co = point

    # Restore exact 2.45 m planted bounds after skull elongation.
    minimum = min(vertex.co.z for vertex in body.data.vertices)
    maximum = max(vertex.co.z for vertex in body.data.vertices)
    normalization = TARGET_HEIGHT / (maximum - minimum)
    for vertex in body.data.vertices:
        point = vertex.co
        point.x *= normalization
        point.y *= normalization
        point.z = (point.z - minimum) * normalization

        x, y, z = point
        # Deep, asymmetric socket planes and vertical maw depression authored
        # directly on the connected facial loops. Dark material regions later
        # emphasize them without inset spheres, boolean debris, or prop teeth.
        if y < -0.02 and z > 2.00:
            for socket_x, width in ((-0.058, 0.056), (0.060, 0.052)):
                socket = math.exp(-(((x - socket_x) / width) ** 2 + ((z - 2.275) / 0.052) ** 2) * 1.7)
                y += 0.030 * socket
            tear = math.exp(-((x / 0.032) ** 2 + ((z - 2.135) / 0.105) ** 2) * 1.4)
            y += 0.017 * tear
            brow = math.exp(-(((abs(x) - 0.058) / 0.058) ** 2 + ((z - 2.305) / 0.055) ** 2))
            y -= 0.010 * brow
            cheek = math.exp(-(((abs(x) - 0.078) / 0.048) ** 2 + ((z - 2.205) / 0.080) ** 2))
            y += 0.008 * cheek

        # Re-sculpt the CC0 anatomical study into an androgynous, continuous
        # pelvis. This operates on the existing groin loops; it is not a cover
        # mesh and it does not delete or duplicate topology.
        groin_mask = (
            smoothstep(0.135, 0.045, abs(x))
            * smoothstep(0.72, 0.90, z)
            * smoothstep(1.13, 1.01, z)
        )
        if groin_mask > 0.0 and y > 0.025:
            y = y * (1.0 - groin_mask) + 0.018 * groin_mask
            if z < 0.91:
                z += (0.91 - z) * groin_mask * 0.92

        # Taut rib bands, clavicles, sternum, scapulae, vertebrae and leg
        # landmarks are continuous surface displacements, never helper tubes.
        if y < -0.012 and 1.47 < z < 1.88 and abs(x) < 0.245:
            rib_phase = (z - 1.49) / 0.061
            rib = max(0.0, math.cos(rib_phase * math.tau)) ** 5
            side_emphasis = 0.45 + 0.55 * min(1.0, abs(x) / 0.22)
            y -= 0.0170 * rib * side_emphasis
            y += 0.0030 * (1.0 - rib) * side_emphasis
            y -= 0.0080 * math.exp(-((x / 0.020) ** 2))
            clavicle_z = 1.875 - 0.20 * abs(x)
            y -= 0.0125 * math.exp(-(((z - clavicle_z) / 0.018) ** 2))
        if y > 0.010 and 1.28 < z < 1.91:
            vertebra = math.exp(-((x / 0.023) ** 2))
            nodes = 0.40 + 0.60 * max(0.0, math.cos((z - 1.30) / 0.052 * math.tau)) ** 4
            y += 0.0090 * vertebra * nodes
            y += 0.0085 * math.exp(-(((x + 0.12) / 0.058) ** 2 + ((z - 1.72) / 0.17) ** 2))
            y += 0.0093 * math.exp(-(((x - 0.115) / 0.054) ** 2 + ((z - 1.75) / 0.16) ** 2))
        if y < -0.010 and z < 0.77:
            center_x = -0.106 if x < 0 else 0.112
            patella = math.exp(-(((x - center_x) / 0.050) ** 2 + ((z - 0.65) / 0.045) ** 2))
            tibia = math.exp(-(((x - center_x) / 0.025) ** 2)) * smoothstep(0.12, 0.28, z) * smoothstep(0.72, 0.54, z)
            y -= 0.0063 * patella + 0.0048 * tibia
        if y < -0.012 and 1.86 < z < 2.07 and abs(x) < 0.09:
            y -= 0.0048 * math.exp(-(((abs(x) - 0.040) / 0.018) ** 2))
        if y < -0.008 and 1.16 < z < 1.36 and abs(x) < 0.18:
            crest = math.exp(-(((abs(x) - 0.115) / 0.032) ** 2 + ((z - 1.245) / 0.055) ** 2))
            y -= 0.0090 * crest
        if y < -0.006 and 0.50 < z < 1.35 and abs(x) > 0.26:
            side = -1.0 if x < 0 else 1.0
            tendon_x = side * (0.345 + 0.055 * smoothstep(1.35, 0.55, z))
            tendon = math.exp(-(((x - tendon_x) / 0.016) ** 2))
            y -= 0.0042 * tendon

        # One-sided millimetric drift breaks perfect bilateral CG symmetry.
        x += 0.0035 * math.sin(z * 7.3) * smoothstep(0.45, 1.92, z)
        vertex.co = (x, y, z)

    body.data.update(calc_edges=True)
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    return source_weights


def apply_modifier(obj: bpy.types.Object, modifier: bpy.types.Modifier) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def add_surface_density(body: bpy.types.Object) -> None:
    subdivision = body.modifiers.new("Anatomical_Subdivision", "SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 1
    subdivision.render_levels = 1
    apply_modifier(body, subdivision)

    # Fine non-repeating tissue breakup affects silhouette only subtly; pores
    # and lesions live primarily in the tangent normal/roughness maps.
    texture = bpy.data.textures.new("PaleEntity_DermalMacro", type="CLOUDS")
    texture.noise_scale = 0.035
    texture.noise_depth = 2
    displacement = body.modifiers.new("Dermal_Macro_Displacement", "DISPLACE")
    displacement.texture = texture
    displacement.texture_coords = "GLOBAL"
    displacement.strength = 0.0018
    displacement.mid_level = 0.5
    apply_modifier(body, displacement)


def simple_material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    material.diffuse_color = color
    return material


def apply_all_transforms(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def ellipsoid(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    subdivisions: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    apply_all_transforms(obj)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 2
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    apply_all_transforms(obj)
    return obj


def join_objects(objects: list[bpy.types.Object], name: str) -> bpy.types.Object:
    if not objects:
        raise ValueError(f"No objects to join for {name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    return joined


def add_cavities_and_damage(
    body: bpy.types.Object,
    cavity_material: bpy.types.Material,
    _nail_material: bpy.types.Material,
    _scar_material: bpy.types.Material,
) -> list[bpy.types.Object]:
    """Author facial/shallow-damage regions on the connected body itself.

    The earlier candidate used boolean icospheres and cone teeth. Even when
    hidden inside the face those violated the final-asset contract and caused
    floating fragments after export. The production pass keeps the original
    eyelid, lip, and scar loops and assigns material regions directly to those
    polygons. No visible geometry is created here.
    """

    # Sculpt the sightless sockets and maw directly into the subdivided body.
    # Positive Y moves the -Y-facing facial plane inward; a narrow negative-Y
    # ring creates torn, raised margins without adding any separate object.
    for vertex in body.data.vertices:
        x, y, z = vertex.co
        if y >= 0.015 or z < 2.02:
            continue
        left_r2 = ((x + 0.060) / 0.052) ** 2 + ((z - 2.280) / 0.048) ** 2
        right_r2 = ((x - 0.060) / 0.049) ** 2 + ((z - 2.276) / 0.045) ** 2
        socket_core = max(math.exp(-left_r2 * 2.0), math.exp(-right_r2 * 2.0))
        socket_rim = max(
            math.exp(-((math.sqrt(left_r2) - 1.0) / 0.22) ** 2),
            math.exp(-((math.sqrt(right_r2) - 1.0) / 0.22) ** 2),
        )
        mouth_r2 = (x / 0.029) ** 2 + ((z - 2.132) / 0.096) ** 2
        mouth_core = math.exp(-mouth_r2 * 2.1)
        mouth_rim = math.exp(-((math.sqrt(mouth_r2) - 1.0) / 0.20) ** 2)
        y += 0.066 * socket_core + 0.072 * mouth_core
        y -= 0.0055 * socket_rim + 0.0065 * mouth_rim
        # Preserve a sharp nasal plane between the voids.
        nose = math.exp(-((x / 0.014) ** 2)) * smoothstep(2.17, 2.31, z) * smoothstep(2.34, 2.29, z)
        y -= 0.0065 * nose
        vertex.co.y = y
    body.data.update(calc_edges=True)

    body.data.materials.append(cavity_material)
    cavity_index = len(body.data.materials) - 1
    for polygon in body.data.polygons:
        center = polygon.center
        front = center.y < -0.070
        left_socket = ((center.x + 0.060) / 0.040) ** 2 + ((center.z - 2.280) / 0.029) ** 2 < 1.0
        right_socket = ((center.x - 0.060) / 0.038) ** 2 + ((center.z - 2.276) / 0.027) ** 2 < 1.0
        mouth = (center.x / 0.014) ** 2 + ((center.z - 2.132) / 0.050) ** 2 < 1.0
        if front and (left_socket or right_socket or mouth):
            polygon.material_index = cavity_index
            continue

        # Healed lesions remain in the shared albedo/normal/roughness maps;
        # separate polygon colors produced visible decal boundaries.

    body["visible_geometry_contract"] = "one continuous anatomical mesh; no primitive body parts"
    body["separate_visible_body_meshes"] = 0
    return []


def create_armature() -> bpy.types.Object:
    data = bpy.data.armatures.new("PaleEntity_Rig")
    armature = bpy.data.objects.new("PaleEntity_Armature", data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    specs = [
        ("ROOT", (0, 0, 0.02), (0, 0, 0.20), None, False),
        ("hips", (0, 0.005, 1.07), (0, 0.002, 1.29), "ROOT", True),
        ("spine_01", (0, 0.002, 1.29), (0, -0.002, 1.48), "hips", True),
        ("spine_02", (0, -0.002, 1.48), (0, -0.006, 1.67), "spine_01", True),
        ("chest", (0, -0.006, 1.67), (0, -0.014, 1.88), "spine_02", True),
        ("neck", (0, -0.014, 1.88), (0, -0.035, 2.08), "chest", True),
        ("head", (0, -0.035, 2.08), (0, -0.070, 2.39), "neck", True),
        ("jaw", (0, -0.065, 2.08), (0, -0.105, 2.18), "head", True),
        ("clavicle.L", (-0.025, -0.010, 1.84), (-0.245, 0, 1.88), "chest", True),
        ("upper_arm.L", (-0.245, 0, 1.88), (-0.335, 0, 1.60), "clavicle.L", True),
        ("forearm.L", (-0.335, 0, 1.60), (-0.375, -0.01, 1.28), "upper_arm.L"),
        ("hand.L", (-0.375, -0.01, 1.28), (-0.405, -0.03, 1.00), "forearm.L"),
        ("clavicle.R", (0.025, -0.010, 1.84), (0.245, 0, 1.87), "chest", True),
        ("upper_arm.R", (0.245, 0, 1.87), (0.340, 0.01, 1.58), "clavicle.R", True),
        ("forearm.R", (0.340, 0.01, 1.58), (0.385, -0.01, 1.25), "upper_arm.R"),
        ("hand.R", (0.385, -0.01, 1.25), (0.415, -0.03, 0.97), "forearm.R"),
        ("thigh.L", (-0.105, 0, 1.14), (-0.112, 0, 0.67), "hips"),
        ("shin.L", (-0.112, 0, 0.67), (-0.115, 0, 0.13), "thigh.L"),
        ("foot.L", (-0.115, 0, 0.13), (-0.115, -0.26, 0.06), "shin.L"),
        ("toe.L", (-0.115, -0.26, 0.06), (-0.115, -0.38, 0.035), "foot.L", True),
        ("thigh.R", (0.105, 0, 1.14), (0.118, 0, 0.65), "hips"),
        ("shin.R", (0.118, 0, 0.65), (0.120, 0, 0.13), "thigh.R"),
        ("foot.R", (0.120, 0, 0.13), (0.120, -0.26, 0.06), "shin.R"),
        ("toe.R", (0.120, -0.26, 0.06), (0.120, -0.38, 0.035), "foot.R", True),
    ]
    bones: dict[str, bpy.types.EditBone] = {}
    for spec in specs:
        name, head, tail, parent = spec[:4]
        deform = bool(spec[4]) if len(spec) == 5 else True
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.use_deform = deform
        if parent:
            bone.parent = bones[parent]
        bones[name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    data.display_type = "OCTAHEDRAL"
    armature.show_in_front = True
    armature["forward_axis"] = "Blender -Y / Three.js +Z"
    armature["asset_height_m"] = TARGET_HEIGHT
    armature["source_license"] = "CC0-1.0"
    armature["rig_contract"] = "24-bone humanoid; normalized top-four weights; root motion ready"
    return armature


def weight_candidates(coordinate: Vector) -> list[tuple[str, float]]:
    x, y, z = coordinate
    absolute_x = abs(x)
    side = "L" if x < 0 else "R"
    if z > 2.05:
        head_weight = smoothstep(2.05, 2.18, z)
        return [("head", 0.58 + 0.36 * head_weight), ("neck", 0.42 - 0.36 * head_weight)]
    if z > 1.87 and absolute_x < 0.22:
        neck_weight = smoothstep(1.87, 2.05, z)
        return [("neck", 0.55 + 0.30 * neck_weight), ("chest", 0.45 - 0.30 * neck_weight)]
    if absolute_x > 0.205 and z > 1.62:
        shoulder = smoothstep(0.205, 0.31, absolute_x)
        return [
            (f"upper_arm.{side}", 0.24 + 0.56 * shoulder),
            (f"clavicle.{side}", 0.54 - 0.30 * shoulder),
            ("chest", 0.22 - 0.08 * shoulder),
        ]
    if absolute_x > 0.245 and z > 1.27:
        upper = smoothstep(1.27, 1.56, z)
        return [
            (f"upper_arm.{side}", 0.66 + 0.24 * upper),
            (f"clavicle.{side}", 0.22 - 0.12 * upper),
            ("chest", 0.12 - 0.12 * upper),
        ]
    if absolute_x > 0.285 and 0.72 < z <= 1.38:
        fore = smoothstep(0.72, 1.12, z)
        return [(f"forearm.{side}", 0.64 + 0.20 * fore), (f"upper_arm.{side}", 0.36 - 0.20 * fore)]
    if absolute_x > 0.285 and z <= 0.84:
        hand = smoothstep(0.84, 0.50, z)
        return [(f"hand.{side}", 0.72 + 0.20 * hand), (f"forearm.{side}", 0.28 - 0.20 * hand)]
    if z < 0.105 and y < -0.14 and absolute_x > 0.025:
        toe = smoothstep(-0.14, -0.27, y)
        return [(f"toe.{side}", 0.60 + 0.34 * toe), (f"foot.{side}", 0.40 - 0.34 * toe)]
    if z < 0.18 and absolute_x > 0.025:
        return [(f"foot.{side}", 0.86), (f"shin.{side}", 0.14)]
    if z < 0.72 and absolute_x > 0.035:
        shin = smoothstep(0.18, 0.64, z)
        return [(f"shin.{side}", 0.68 + 0.18 * shin), (f"thigh.{side}", 0.32 - 0.18 * shin)]
    if z < 1.22 and absolute_x > 0.035:
        thigh = smoothstep(0.72, 1.18, z)
        return [(f"thigh.{side}", 0.68 + 0.20 * thigh), ("hips", 0.32 - 0.20 * thigh)]
    if z < 1.34:
        return [("hips", 0.76), ("spine_01", 0.24)]
    if z < 1.52:
        spine = smoothstep(1.34, 1.52, z)
        return [("spine_01", 0.70 + 0.14 * spine), ("hips", 0.30 - 0.14 * spine)]
    if z < 1.70:
        spine = smoothstep(1.52, 1.70, z)
        return [("spine_02", 0.62 + 0.22 * spine), ("spine_01", 0.38 - 0.22 * spine)]
    chest = smoothstep(1.70, 1.88, z)
    return [("chest", 0.67 + 0.22 * chest), ("spine_02", 0.33 - 0.22 * chest)]


def bind_mesh(
    obj: bpy.types.Object,
    armature: bpy.types.Object,
    explicit_weights: list[list[tuple[str, float]]] | None = None,
    *,
    attach_modifier: bool = True,
) -> None:
    groups = {
        bone.name: obj.vertex_groups.new(name=bone.name)
        for bone in armature.data.bones
        if bone.use_deform
    }
    if explicit_weights is not None and len(explicit_weights) != len(obj.data.vertices):
        raise RuntimeError(
            f"Explicit weight count {len(explicit_weights)} does not match "
            f"{len(obj.data.vertices)} vertices"
        )
    for vertex in obj.data.vertices:
        candidates = explicit_weights[vertex.index] if explicit_weights is not None else weight_candidates(vertex.co)
        total = sum(max(0.0, weight) for _, weight in candidates)
        for bone_name, weight in candidates:
            if weight > 0.0:
                if bone_name not in groups:
                    raise RuntimeError(f"Weight references missing deform bone {bone_name}")
                groups[bone_name].add([vertex.index], weight / total, "REPLACE")
    if attach_modifier:
        attach_skin_modifier(obj, armature)
    obj["skin_weight_contract"] = "normalized; no unweighted vertices; maximum four influences"


def attach_skin_modifier(obj: bpy.types.Object, armature: bpy.types.Object) -> None:
    modifier = obj.modifiers.get("PaleEntity_Skin") or obj.modifiers.new("PaleEntity_Skin", "ARMATURE")
    modifier.object = armature
    modifier.use_deform_preserve_volume = True
    obj.parent = armature
    obj.matrix_parent_inverse = armature.matrix_world.inverted()


def limit_and_normalize_weights(obj: bpy.types.Object, limit: int = 4) -> None:
    """Prune subdivided interpolation spill while preserving normalized skin."""

    groups = obj.vertex_groups
    for vertex in obj.data.vertices:
        snapshot = sorted(
            ((assignment.group, assignment.weight) for assignment in vertex.groups if assignment.weight > 1e-10),
            key=lambda item: item[1],
            reverse=True,
        )
        kept = snapshot[:limit]
        rejected = snapshot[limit:]
        for group_index, _weight in rejected:
            groups[group_index].remove([vertex.index])
        total = sum(weight for _group_index, weight in kept)
        if total <= 1e-12:
            raise RuntimeError(f"Vertex {vertex.index} became unweighted while limiting influences")
        for group_index, weight in kept:
            groups[group_index].add([vertex.index], weight / total, "REPLACE")


def key_action(
    armature: bpy.types.Object,
    name: str,
    keys: list[
        tuple[
            int,
            dict[str, tuple[float, float, float]],
            dict[str, tuple[float, float, float]],
        ]
    ],
    *,
    loop: bool = False,
) -> bpy.types.Action:
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    for frame, rotations, locations in keys:
        bpy.context.scene.frame_set(frame)
        for bone in armature.pose.bones:
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = (0, 0, 0)
            bone.location = (0, 0, 0)
            bone.scale = (1, 1, 1)
        for bone_name, degrees in rotations.items():
            bone = armature.pose.bones.get(bone_name)
            if bone:
                bone.rotation_euler = tuple(math.radians(value) for value in degrees)
        for bone_name, location in locations.items():
            bone = armature.pose.bones.get(bone_name)
            if bone:
                bone.location = location
        for bone in armature.pose.bones:
            bone.keyframe_insert("rotation_euler", frame=frame, group=bone.name)
            bone.keyframe_insert("location", frame=frame, group=bone.name)
    # Start/end keys match for looped actions. Blender 5's layered Action API
    # no longer exposes legacy ``action.fcurves`` directly; exporters and both
    # runtimes loop the sampled sequence without needing a Cycles modifier.
    action["loop"] = loop
    armature.animation_data.action = None
    return action


def build_actions(armature: bpy.types.Object) -> None:
    hunch = {
        "spine_01": (5, 0, 0),
        "spine_02": (7, 0, 0),
        "chest": (8, 0, 0),
        "neck": (-9, 0, 0),
    }
    empty: dict[str, tuple[float, float, float]] = {}
    walk_a = {
        **hunch,
        "thigh.L": (25, 0, 0),
        "shin.L": (-20, 0, 0),
        "foot.L": (8, 0, 0),
        "thigh.R": (-23, 0, 0),
        "shin.R": (8, 0, 0),
        "upper_arm.L": (-11, 0, 0),
        "upper_arm.R": (11, 0, 0),
    }
    walk_b = {
        **hunch,
        "thigh.L": (-23, 0, 0),
        "shin.L": (8, 0, 0),
        "thigh.R": (25, 0, 0),
        "shin.R": (-20, 0, 0),
        "foot.R": (8, 0, 0),
        "upper_arm.L": (11, 0, 0),
        "upper_arm.R": (-11, 0, 0),
    }
    run_hunch = {**hunch, "spine_01": (13, 0, 0), "spine_02": (15, 0, 0), "chest": (12, 0, 0)}
    run_a = {
        **run_hunch,
        "thigh.L": (42, 0, 0),
        "shin.L": (-42, 0, 0),
        "thigh.R": (-34, 0, 0),
        "shin.R": (14, 0, 0),
        "upper_arm.L": (-29, 0, 0),
        "upper_arm.R": (29, 0, 0),
    }
    run_b = {
        **run_hunch,
        "thigh.L": (-34, 0, 0),
        "shin.L": (14, 0, 0),
        "thigh.R": (42, 0, 0),
        "shin.R": (-42, 0, 0),
        "upper_arm.L": (29, 0, 0),
        "upper_arm.R": (-29, 0, 0),
    }
    crouched = {
        "hips": (6, 0, 0),
        "spine_01": (15, 0, 0),
        "spine_02": (13, 0, 0),
        "chest": (8, 0, 0),
        "neck": (-10, 0, 0),
        "thigh.L": (47, 0, 0),
        "thigh.R": (47, 0, 0),
        "shin.L": (-73, 0, 0),
        "shin.R": (-73, 0, 0),
        "foot.L": (28, 0, 0),
        "foot.R": (28, 0, 0),
    }
    arm_flex = {
        **hunch,
        "clavicle.L": (0, -7, -8),
        "clavicle.R": (0, 7, 8),
        "upper_arm.L": (-28, -5, -18),
        "upper_arm.R": (-28, 5, 18),
        "forearm.L": (-104, 0, -5),
        "forearm.R": (-104, 0, 5),
    }

    key_action(armature, "Idle", [(1, hunch, empty), (25, {**hunch, "chest": (10, 0, 1.5), "head": (-2, 3, -2)}, empty), (49, hunch, empty)], loop=True)
    key_action(armature, "Walk", [(1, walk_a, empty), (13, walk_b, {"hips": (0, 0, 0.012)}), (25, walk_a, empty)], loop=True)
    key_action(armature, "Run", [(1, run_a, {"ROOT": (0, -0.10, 0)}), (7, run_b, {"ROOT": (0, -0.065, 0)}), (13, run_a, {"ROOT": (0, -0.10, 0)})], loop=True)
    key_action(armature, "Crouch", [(1, hunch, empty), (18, crouched, {"ROOT": (0, -0.20, 0)}), (36, hunch, empty)])
    key_action(armature, "ArmBend", [(1, hunch, empty), (16, arm_flex, empty), (32, hunch, empty)])
    key_action(armature, "Glimpse", [(1, hunch, empty), (8, {**hunch, "head": (-4, -18, 12), "jaw": (8, 0, 0)}, empty), (18, hunch, empty)])
    key_action(armature, "Stalk", [(1, walk_a, empty), (17, walk_b, {"hips": (0, 0, 0.008)}), (33, walk_a, empty)], loop=True)
    key_action(armature, "Search", [(1, hunch, empty), (18, {**hunch, "head": (-5, 24, -7)}, empty), (36, {**hunch, "head": (-3, -24, 8)}, empty), (54, hunch, empty)])
    key_action(armature, "Chase", [(1, run_a, empty), (9, run_b, {"hips": (0, 0, 0.028)}), (17, run_a, empty)], loop=True)
    key_action(armature, "Attack", [(1, hunch, empty), (7, {**run_hunch, "upper_arm.L": (-50, 0, -18), "upper_arm.R": (-50, 0, 18), "forearm.L": (-35, 0, 0), "forearm.R": (-35, 0, 0), "jaw": (20, 0, 0)}, empty), (15, {**run_hunch, "spine_01": (22, 0, 0), "upper_arm.L": (-78, 0, -10), "upper_arm.R": (-78, 0, 10), "forearm.L": (-72, 0, 0), "forearm.R": (-72, 0, 0), "jaw": (30, 0, 0)}, empty), (24, hunch, empty)])
    armature.animation_data.action = bpy.data.actions.get("Idle")
    bpy.context.scene.frame_set(1)


def triangle_count(obj: bpy.types.Object) -> int:
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def setup_uv(body: bpy.types.Object) -> None:
    # MakeHuman's authored UV survives the axis/proportion deformation and
    # subdivision.  Ensure it remains the active export map.
    if not body.data.uv_layers:
        bpy.context.view_layer.objects.active = body
        body.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.008)
        bpy.ops.object.mode_set(mode="OBJECT")
    body.data.uv_layers.active_index = 0
    body.data.uv_layers[0].name = "UVMap"


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area(name: str, location, target, color, energy: float, size: float) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    look_at(obj, target)
    return obj


def setup_preview_scene() -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.55
    scene.render.image_settings.color_depth = "8"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("HD_Preview_World")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.035, 0.040, 0.045, 1.0)
    background.inputs["Strength"].default_value = 0.18

    ground_mat = simple_material("HD_Preview_Ground", (0.095, 0.105, 0.11, 1.0), 0.84)
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.003))
    ground = bpy.context.object
    ground.name = "PREVIEW_Ground"
    ground.data.materials.append(ground_mat)
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 1.45, 2.0), rotation=(math.pi / 2, 0, 0))
    wall = bpy.context.object
    wall.name = "PREVIEW_Wall"
    wall.data.materials.append(ground_mat)

    camera_data = bpy.data.cameras.new("PREVIEW_Camera")
    camera_data.lens = 68
    camera_data.sensor_width = 36
    camera = bpy.data.objects.new("PREVIEW_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    add_area("PREVIEW_Key", (-2.8, -3.8, 3.7), (0, 0, 1.35), (1.0, 0.82, 0.68), 680, 3.0)
    add_area("PREVIEW_Fill", (3.2, -2.4, 2.4), (0, 0, 1.25), (0.52, 0.70, 1.0), 340, 2.7)
    add_area("PREVIEW_Rim", (-0.7, 2.2, 3.1), (0, 0, 1.45), (0.64, 0.80, 1.0), 620, 2.2)
    add_area("PREVIEW_Face", (0.3, -2.0, 2.55), (0, -0.02, 2.24), (1.0, 0.62, 0.46), 180, 1.1)
    return camera


def render_previews(candidate_dir: Path, armature: bpy.types.Object) -> None:
    preview_dir = candidate_dir / "previews"
    preview_dir.mkdir(parents=True, exist_ok=True)
    camera = setup_preview_scene()
    armature.animation_data.action = None
    armature.data.pose_position = "REST"
    bpy.context.scene.frame_set(1)
    views = (
        ("pale-entity-front.png", (0.0, -4.85, 1.34), (0, -0.005, 1.24)),
        ("pale-entity-side.png", (4.85, 0.0, 1.34), (0, 0.0, 1.24)),
        ("pale-entity-three-quarter.png", (3.42, -3.72, 1.45), (0, -0.005, 1.25)),
        ("pale-entity-rear.png", (0.0, 4.85, 1.34), (0, 0.01, 1.24)),
    )
    wall = bpy.data.objects.get("PREVIEW_Wall")
    for filename, location, target in views:
        if wall:
            wall.hide_render = not filename.endswith("front.png") and not filename.endswith("quarter.png")
        camera.location = location
        look_at(camera, target)
        bpy.context.scene.render.filepath = str(preview_dir / filename)
        bpy.ops.render.render(write_still=True)

    # Blender preflight poses catch topology/weight regressions before FBX
    # import. Matching Unreal captures are generated as acceptance evidence.
    armature.data.pose_position = "POSE"
    if wall:
        wall.hide_render = False
    pose_views = (
        ("Walk", 1, "pale-entity-walk-preflight.png", (3.42, -3.72, 1.42), (0, 0, 1.20)),
        ("Run", 1, "pale-entity-run-preflight.png", (3.42, -3.72, 1.40), (0, 0, 1.15)),
        ("Crouch", 18, "pale-entity-crouch-preflight.png", (3.20, -3.45, 1.07), (0, 0, 0.86)),
        ("ArmBend", 16, "pale-entity-arm-bend-preflight.png", (3.42, -3.72, 1.42), (0, 0, 1.20)),
    )
    for action_name, frame, filename, location, target in pose_views:
        armature.animation_data.action = bpy.data.actions.get(action_name)
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        camera.location = location
        look_at(camera, target)
        bpy.context.scene.render.filepath = str(preview_dir / filename)
        bpy.ops.render.render(write_still=True)
    armature.data.pose_position = "REST"
    armature.animation_data.action = bpy.data.actions.get("Idle")
    bpy.context.scene.frame_set(1)


def render_clay_previews(candidate_dir: Path, body: bpy.types.Object) -> None:
    body.data.materials.clear()
    body.data.materials.append(simple_material("PaleEntity_Foundation_Clay", (0.32, 0.30, 0.285, 1.0), 0.68))
    camera = setup_preview_scene()
    wall = bpy.data.objects.get("PREVIEW_Wall")
    views = (
        ("pale-hd-clay-front.png", (2.7, -5.15, 1.48), (0, 0, 1.27)),
        ("pale-hd-clay-rear.png", (-2.55, 5.0, 1.45), (0, 0, 1.28)),
    )
    for filename, location, target in views:
        if wall:
            wall.hide_render = filename.endswith("rear.png")
        camera.location = location
        look_at(camera, target)
        bpy.context.scene.render.filepath = str(candidate_dir / "previews" / filename)
        (candidate_dir / "previews").mkdir(parents=True, exist_ok=True)
        bpy.ops.render.render(write_still=True)


def export_glb(path: Path, armature: bpy.types.Object, meshes: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armature
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_range=False,
        export_skins=True,
        export_all_influences=False,
        export_influence_nb=4,
        export_def_bones=False,
        export_leaf_bone=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_image_format="AUTO",
        export_normals=True,
        export_tangents=True,
        export_texcoords=True,
        export_vertex_color="NONE",
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=True,
    )


def select_asset(armature: bpy.types.Object, meshes: list[bpy.types.Object], *, include_meshes: bool) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    if include_meshes:
        for mesh in meshes:
            mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature


def export_fbx_bundle(
    export_dir: Path,
    armature: bpy.types.Object,
    meshes: list[bpy.types.Object],
) -> dict[str, str]:
    """Export a rest skeletal mesh and explicit per-action Unreal FBXs."""

    export_dir.mkdir(parents=True, exist_ok=True)
    armature.data.pose_position = "REST"
    armature.animation_data_create()
    armature.animation_data.action = None
    bpy.context.scene.frame_set(1)
    select_asset(armature, meshes, include_meshes=True)
    base_path = export_dir / "pale-entity-skeletal.fbx"
    bpy.ops.export_scene.fbx(
        filepath=str(base_path),
        use_selection=True,
        object_types={"ARMATURE", "MESH"},
        global_scale=1.0,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_UNITS",
        use_space_transform=True,
        bake_space_transform=False,
        axis_forward="-Y",
        axis_up="Z",
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        use_subsurf=False,
        use_mesh_edges=False,
        use_tspace=True,
        add_leaf_bones=False,
        primary_bone_axis="Y",
        secondary_bone_axis="X",
        use_armature_deform_only=False,
        armature_nodetype="NULL",
        bake_anim=False,
        path_mode="COPY",
        embed_textures=True,
    )

    animation_paths: dict[str, str] = {}
    armature.data.pose_position = "POSE"
    select_asset(armature, meshes, include_meshes=False)
    for action_name in ("Walk", "Run", "Crouch", "ArmBend"):
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError(f"Missing Unreal deformation-test action {action_name}")
        armature.animation_data.action = action
        start, end = (int(round(value)) for value in action.frame_range)
        bpy.context.scene.frame_start = start
        bpy.context.scene.frame_end = end
        animation_slug = "arm-bend" if action_name == "ArmBend" else action_name.lower()
        animation_path = export_dir / f"pale-entity-{animation_slug}.fbx"
        bpy.ops.export_scene.fbx(
            filepath=str(animation_path),
            use_selection=True,
            object_types={"ARMATURE"},
            global_scale=1.0,
            apply_unit_scale=True,
            apply_scale_options="FBX_SCALE_UNITS",
            use_space_transform=True,
            bake_space_transform=False,
            axis_forward="-Y",
            axis_up="Z",
            add_leaf_bones=False,
            primary_bone_axis="Y",
            secondary_bone_axis="X",
            use_armature_deform_only=False,
            armature_nodetype="NULL",
            bake_anim=True,
            bake_anim_use_all_bones=True,
            bake_anim_use_nla_strips=False,
            bake_anim_use_all_actions=False,
            bake_anim_force_startend_keying=True,
            bake_anim_step=1.0,
            bake_anim_simplify_factor=0.0,
            path_mode="AUTO",
        )
        animation_paths[action_name] = str(animation_path)

    armature.animation_data.action = bpy.data.actions.get("Idle")
    armature.data.pose_position = "REST"
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 49
    bpy.context.scene.frame_set(1)
    return {"skeletalMesh": str(base_path), **animation_paths}


def validate_reimport(glb_path: Path, report_path: Path, texture_manifest: dict) -> dict:
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    # Blender's glTF importer creates a private icosphere in its
    # ``glTF_not_exported`` collection as an armature display helper. It is not
    # present in the GLB scene and must not contaminate delivery metrics.
    meshes = [
        obj for obj in bpy.context.scene.objects
        if obj.type == "MESH" and not any(collection.name == "glTF_not_exported" for collection in obj.users_collection)
    ]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Reimport expected one armature, found {len(armatures)}")
    # The importer activates an arbitrary alphabetically sorted clip. Bounds
    # and planted-feet checks must inspect the authored bind shape instead.
    if armatures[0].animation_data:
        armatures[0].animation_data.action = None
    armatures[0].data.pose_position = "REST"
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    body = next((obj for obj in meshes if obj.name == "PaleEntity_Mesh"), None)
    if body is None:
        raise RuntimeError("Reimport lost PaleEntity_Mesh")
    all_points = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    minimum = Vector((min(point.x for point in all_points), min(point.y for point in all_points), min(point.z for point in all_points)))
    maximum = Vector((max(point.x for point in all_points), max(point.y for point in all_points), max(point.z for point in all_points)))
    actions = sorted(action.name for action in bpy.data.actions)
    missing = sorted(set(CLIPS) - set(actions))
    if missing:
        raise RuntimeError(f"Reimport lost clips: {missing}; imported {actions}")
    body_tris = triangle_count(body)
    total_tris = sum(triangle_count(obj) for obj in meshes)
    if not 70_000 <= total_tris <= 160_000:
        raise RuntimeError(f"Triangle count {total_tris} outside candidate target 70k..160k")
    if len(meshes) > 12:
        raise RuntimeError(f"Mesh node count {len(meshes)} exceeds 12")
    if len(body.data.uv_layers) < 1:
        raise RuntimeError("Reimport lost body UVs")
    if len(armatures[0].data.bones) < 24:
        raise RuntimeError("Reimport rig has fewer than 24 bones")
    raw_components = connected_component_count(body)
    components = welded_component_count(body)
    if components != 1:
        raise RuntimeError(
            f"Reimported visible body has {components} welded components "
            f"({raw_components} before exporter seam welding)"
        )
    maximum_influences = 0
    unweighted_vertices = 0
    blended_vertices = 0
    largest_weight_error = 0.0
    for vertex in body.data.vertices:
        influences = [group.weight for group in vertex.groups if group.weight > 1e-8]
        maximum_influences = max(maximum_influences, len(influences))
        if not influences:
            unweighted_vertices += 1
            continue
        if len(influences) > 1:
            blended_vertices += 1
        largest_weight_error = max(largest_weight_error, abs(sum(influences) - 1.0))
    if unweighted_vertices:
        raise RuntimeError(f"Reimported skin has {unweighted_vertices} unweighted vertices")
    if maximum_influences > 4:
        raise RuntimeError(f"Reimported skin exceeds four influences: {maximum_influences}")
    blended_ratio = blended_vertices / max(1, len(body.data.vertices))
    if blended_ratio < 0.80:
        raise RuntimeError(f"Blended-weight ratio {blended_ratio:.3f} is below 0.80")
    report = {
        "asset": str(glb_path),
        "blender": bpy.app.version_string,
        "source": "MakeHuman hm08 male_muscle_13290 proxy, CC0 (September 2020)",
        "geometry": {
            "bodyTriangles": body_tris,
            "totalTriangles": total_tris,
            "meshNodes": len(meshes),
            "heightMeters": round(maximum.z - minimum.z, 4),
            "connectedComponents": components,
            "rawExportComponentsBeforeSeamWeld": raw_components,
            "visibleBodyMeshNodes": 1,
            "minimum": [round(value, 4) for value in minimum],
            "maximum": [round(value, 4) for value in maximum],
        },
        "rig": {
            "bones": len(armatures[0].data.bones),
            "clips": actions,
            "maxInfluences": maximum_influences,
            "unweightedVertices": unweighted_vertices,
            "blendedVertices": blended_vertices,
            "blendedRatio": round(blended_ratio, 6),
            "largestWeightNormalizationError": largest_weight_error,
        },
        "materials": sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}),
        "textures": texture_manifest,
        "delivery": {
            "glbBytes": glb_path.stat().st_size,
            "glbMiB": round(glb_path.stat().st_size / (1024 * 1024), 3),
            "compressedGeometryExtensions": [],
            "externalTextureUrls": False,
            "cameras": len([obj for obj in bpy.context.scene.objects if obj.type == "CAMERA"]),
            "lights": len([obj for obj in bpy.context.scene.objects if obj.type == "LIGHT"]),
        },
    }
    if abs(minimum.z) > 0.025 or abs((maximum.z - minimum.z) - TARGET_HEIGHT) > 0.1:
        raise RuntimeError(f"Bad reimport bounds: {minimum} .. {maximum}")
    if report["delivery"]["glbBytes"] > 12 * 1024 * 1024:
        raise RuntimeError(f"GLB exceeds 12 MiB: {report['delivery']['glbMiB']} MiB")
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    arguments = parse_args()
    root = arguments.root.resolve()
    character_dir = root / "art" / "characters" / "pale-entity"
    export_dir = root / "art" / "characters" / "exports"
    runtime_glb = root / "public" / "models" / "monsters" / "pale-entity.glb"
    character_dir.mkdir(parents=True, exist_ok=True)
    runtime_glb.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    pbr = load_pbr_tools(root)
    foundation = load_foundation_tools(root)
    texture_dir = character_dir / "textures"
    if arguments.skip_textures:
        manifest_path = texture_dir / "manifest.json"
        if not manifest_path.is_file():
            raise FileNotFoundError(f"--skip-textures requested but {manifest_path} is missing")
        texture_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        texture_set = pbr.generate_texture_set("pale-skin", resolution=2048)
        texture_manifest = pbr.write_texture_set(texture_set, texture_dir, write_contact_sheet=True)

    reset_scene()
    source = ensure_source(root, character_dir)
    skin_material = pbr.create_blender_material(
        "PaleEntity_Skin", texture_dir, "pale-skin", skin_subsurface=0.115
    )
    cavity_material = simple_material("PaleEntity_HD_Cavities", (0.006, 0.0025, 0.002, 1.0), 0.82)
    nail_material = simple_material("PaleEntity_HD_Nails", (0.048, 0.035, 0.026, 1.0), 0.61)
    scar_material = simple_material("PaleEntity_HD_Scars", (0.19, 0.055, 0.035, 1.0), 0.74)

    body = import_anatomical_base(source)
    topology_weights = deform_to_entity(body, foundation)
    integrity = {"deformed": assert_body_integrity(body, "deformed bind mesh")}
    setup_uv(body)
    body.data.materials.append(skin_material)
    if arguments.clay_only:
        add_surface_density(body)
        integrity["subdivided"] = assert_body_integrity(body, "subdivided bind mesh")
        render_clay_previews(character_dir, body)
        bpy.ops.wm.save_as_mainfile(filepath=str(character_dir / "pale-entity-foundation.blend"), compress=True)
        print(json.dumps({"clayOnly": True, "integrity": integrity, "triangles": triangle_count(body)}, indent=2))
        return 0

    # Bind the tested source-topology weights before subdivision. Catmull-Clark
    # then interpolates them across the production surface, preserving fingers,
    # palms, toes, and joint loops that coordinate-band weighting tears apart.
    armature = create_armature()
    bind_mesh(body, armature, topology_weights, attach_modifier=False)
    add_surface_density(body)
    limit_and_normalize_weights(body, 4)
    integrity["subdivided"] = assert_body_integrity(body, "subdivided bind mesh")
    detail_meshes = add_cavities_and_damage(body, cavity_material, nail_material, scar_material)
    integrity["facialCavities"] = assert_body_integrity(body, "facial cavity bind mesh")
    meshes = [body, *detail_meshes]
    attach_skin_modifier(body, armature)
    for mesh in detail_meshes:
        bind_mesh(mesh, armature)
    integrity["weightedRest"] = assert_body_integrity(body, "weighted rest mesh")
    build_actions(armature)

    total_tris = sum(triangle_count(mesh) for mesh in meshes)
    if not 70_000 <= total_tris <= 160_000:
        raise RuntimeError(f"Authored triangle count {total_tris} outside 70k..160k")

    export_glb(runtime_glb, armature, meshes)
    fbx_bundle = export_fbx_bundle(export_dir, armature, meshes)
    if not arguments.skip_render:
        render_previews(character_dir, armature)
    blend_path = character_dir / "pale-entity.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True)

    report_path = character_dir / "validation.json"
    report = validate_reimport(runtime_glb, report_path, texture_manifest)
    report["asset"] = str(runtime_glb.relative_to(root))
    report["sourceProvenance"] = {
        "path": str(source.relative_to(root)),
        "sha256": SOURCE_SHA256,
        "upstreamCommit": UPSTREAM_COMMIT,
        "license": "CC0-1.0",
        "licenseSha256": LICENSE_SHA256,
    }
    report["fbxBundle"] = {
        key: str(Path(path).relative_to(root))
        for key, path in fbx_bundle.items()
    }
    report["inspectionRenders"] = sorted(
        str(path.relative_to(root))
        for path in (character_dir / "previews").glob("pale-entity-*.png")
    )
    report["integrityStages"] = integrity
    report["buildSeconds"] = round(time.monotonic() - started, 2)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
