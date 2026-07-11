#!/usr/bin/env python3
"""Build a topology-safe, reusable skinned adult humanoid foundation.

Run with Blender 5.1 or newer::

    blender --background --factory-startup \
      --python scripts/blender/hd_humanoid_foundation.py -- --root .

The exact CC0 MakeHuman ``male_muscle_13290`` OBJ is vendored beside the
generated proof.  Its authored connected topology and UV loops are retained.
The source proxy already has an arms-out A pose (despite often being treated as
a T-pose by downstream scripts), so the conversion deliberately uses a smooth
linear-blend skinning pass to bring both arms to a relaxed down pose.  No
coordinate band, per-vertex translation, remesh, or primitive replacement is
used.

The result is a clean one-mesh/one-rig Blender file, a plain uncompressed GLB,
bright 1024px clay views, walk/crouch deformation proofs, and machine-readable
topology/weight/scale/export metrics under
``art/characters/candidates/foundation``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import struct
import sys
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import bpy
from mathutils import Matrix, Vector


OUT_RELATIVE = Path("art/characters/candidates/foundation")
SOURCE_FILENAME = "male_muscle_13290.obj"
SOURCE_SHA256 = "4f384d7ec5b0a5f370e24117c8f98dfa7ee2a3b357d9275872ae4393135f2b0e"
LICENSE_SHA256 = "a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499"
UPSTREAM_COMMIT = "8cf9645b975a98eea056b140df11a1d278da0d10"
TARGET_HEIGHT = 1.82
ARM_RELAX_DEGREES = 27.0
FPS = 24

SOURCE_CANDIDATES = (
    Path("/tmp/makehuman-assets/base/proxymeshes/male_muscle_13290/male_muscle_13290.obj"),
    Path("art/characters/candidates/hazmat-hd/source/male_muscle_13290.obj"),
    Path("art/characters/candidates/pale-hd/source/male_muscle_13290_cc0.obj"),
)
LICENSE_CANDIDATES = (
    Path("/tmp/makehuman-assets/LICENSE.txt"),
)


@dataclass(frozen=True)
class BoneSpec:
    name: str
    head: Vector
    tail: Vector
    parent: str | None
    radius: float
    deform: bool = True


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--skip-render", action="store_true")
    return parser.parse_args(argv)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_candidate(path: Path, root: Path) -> Path:
    return path if path.is_absolute() else root / path


def ensure_vendored_source(root: Path, out_dir: Path) -> tuple[Path, Path]:
    """Reference-copy the exact verified CC0 source and legal text once."""
    source_dir = out_dir / "source"
    source_dir.mkdir(parents=True, exist_ok=True)
    destination = source_dir / SOURCE_FILENAME
    if not destination.exists():
        upstream = next(
            (
                resolve_candidate(candidate, root)
                for candidate in SOURCE_CANDIDATES
                if resolve_candidate(candidate, root).is_file()
                and sha256(resolve_candidate(candidate, root)) == SOURCE_SHA256
            ),
            None,
        )
        if upstream is None:
            raise FileNotFoundError(
                "The verified CC0 MakeHuman male_muscle_13290 source is missing. "
                f"Expected SHA-256 {SOURCE_SHA256}."
            )
        shutil.copy2(upstream, destination)
    if sha256(destination) != SOURCE_SHA256:
        raise RuntimeError(f"Vendored source hash mismatch: {destination}")
    header = destination.read_text(encoding="utf-8", errors="ignore")[:1024]
    if "explicitly released as CC0" not in header:
        raise RuntimeError("The MakeHuman source lost its explicit CC0 header")

    license_path = source_dir / "CC0-1.0.txt"
    if not license_path.exists():
        upstream_license = next(
            (
                resolve_candidate(candidate, root)
                for candidate in LICENSE_CANDIDATES
                if resolve_candidate(candidate, root).is_file()
                and sha256(resolve_candidate(candidate, root)) == LICENSE_SHA256
            ),
            None,
        )
        if upstream_license is None:
            raise FileNotFoundError(
                "The exact MakeHuman CC0 legal text is missing; refusing to create an "
                "unlicensed vendor copy."
            )
        shutil.copy2(upstream_license, license_path)
    if sha256(license_path) != LICENSE_SHA256:
        raise RuntimeError(f"Vendored CC0 license hash mismatch: {license_path}")

    provenance = source_dir / "PROVENANCE.md"
    provenance.write_text(
        "# MakeHuman anatomical foundation provenance\n\n"
        f"- Asset: `{SOURCE_FILENAME}` (`hm08` male muscle proxy)\n"
        "- Upstream: `makehumancommunity/makehuman-assets`\n"
        f"- Upstream commit: `{UPSTREAM_COMMIT}`\n"
        f"- Source SHA-256: `{SOURCE_SHA256}`\n"
        "- License: Creative Commons CC0 1.0 Universal\n"
        "- Copyright holders named by the source: Data Collection AB, Joel "
        "Palmius, and Jonas Hauquier\n\n"
        "The OBJ is an exact byte-for-byte reference copy. Its own header records "
        "the September 2020 CC0 release. The adjacent `CC0-1.0.txt` is the exact "
        "legal text from the same upstream checkout. The selected proxy is already "
        "one connected, UV-authored arms-out mesh; this proof retains those faces, "
        "edges, vertex indices, and UV loops while applying only topology-safe "
        "skeletal deformation.\n",
        encoding="utf-8",
    )
    return destination, license_path


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.fps = FPS
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.25
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    bpy.context.preferences.filepaths.save_version = 0
    if scene.world is None:
        scene.world = bpy.data.worlds.new("FoundationWorld")


def import_source(path: Path) -> bpy.types.Object:
    bpy.ops.wm.obj_import(
        filepath=str(path),
        use_split_objects=False,
        use_split_groups=False,
        forward_axis="NEGATIVE_Z",
        up_axis="Y",
    )
    meshes = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected exactly one MakeHuman mesh, imported {len(meshes)}")
    body = meshes[0]
    body.name = "HumanoidFoundation_Mesh"
    body.data.name = "HumanoidFoundation_ConnectedTopology"
    body.matrix_world = Matrix.Identity(4)
    if len(body.data.vertices) != 13290 or len(body.data.polygons) != 13288:
        raise RuntimeError(
            "Unexpected source topology: "
            f"{len(body.data.vertices)} vertices / {len(body.data.polygons)} faces"
        )
    if len(body.data.uv_layers) != 1:
        raise RuntimeError("The authored MakeHuman UV map did not survive OBJ import")
    body.data.uv_layers[0].name = "UVMap"
    return body


def normalize_source_coordinates(body: bpy.types.Object) -> float:
    """Convert MakeHuman X/vertical-Y/front-Z into Blender metres/-Y forward."""
    raw_min_y = min(vertex.co.y for vertex in body.data.vertices)
    raw_max_y = max(vertex.co.y for vertex in body.data.vertices)
    scale = TARGET_HEIGHT / (raw_max_y - raw_min_y)
    converted = []
    for vertex in body.data.vertices:
        raw = vertex.co.copy()
        converted.append(Vector((raw.x * scale, -raw.z * scale, (raw.y - raw_min_y) * scale)))

    # Center depth using the torso rather than nose/toe extrema.  This changes
    # only global placement and keeps every source edge/face/UV untouched.
    torso_depths = [point.y for point in converted if 1.05 <= point.z <= 1.48 and abs(point.x) < 0.22]
    depth_center = sum(torso_depths) / len(torso_depths)
    for vertex, point in zip(body.data.vertices, converted, strict=True):
        vertex.co = (point.x, point.y - depth_center, point.z)
    body.data.update(calc_edges=True)
    return scale


def source_bone_specs() -> list[BoneSpec]:
    """An anatomical skeleton fitted to the selected proxy's authored A pose."""
    specs = [
        BoneSpec("ROOT", Vector((0, 0, 0.02)), Vector((0, 0, 0.18)), None, 0.25, False),
        BoneSpec("hips", Vector((0, 0.012, 0.89)), Vector((0, 0.008, 1.05)), "ROOT", 0.235),
        BoneSpec("spine_01", Vector((0, 0.008, 1.05)), Vector((0, 0.002, 1.20)), "hips", 0.215),
        BoneSpec("spine_02", Vector((0, 0.002, 1.20)), Vector((0, -0.005, 1.35)), "spine_01", 0.215),
        BoneSpec("chest", Vector((0, -0.005, 1.35)), Vector((0, -0.012, 1.49)), "spine_02", 0.235),
        BoneSpec("neck", Vector((0, -0.012, 1.49)), Vector((0, -0.052, 1.61)), "chest", 0.120),
        BoneSpec("head", Vector((0, -0.052, 1.61)), Vector((0, -0.085, 1.79)), "neck", 0.175),
    ]
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        specs.extend(
            [
                BoneSpec(
                    f"clavicle.{suffix}",
                    Vector((side * 0.020, -0.010, 1.455)),
                    Vector((side * 0.205, -0.006, 1.465)),
                    "chest",
                    0.145,
                ),
                BoneSpec(
                    f"upper_arm.{suffix}",
                    Vector((side * 0.205, -0.006, 1.465)),
                    Vector((side * 0.365, -0.004, 1.315)),
                    f"clavicle.{suffix}",
                    0.115,
                ),
                BoneSpec(
                    f"forearm.{suffix}",
                    Vector((side * 0.365, -0.004, 1.315)),
                    Vector((side * 0.515, -0.010, 1.085)),
                    f"upper_arm.{suffix}",
                    0.100,
                ),
                BoneSpec(
                    f"hand.{suffix}",
                    Vector((side * 0.515, -0.010, 1.085)),
                    Vector((side * 0.585, -0.055, 1.005)),
                    f"forearm.{suffix}",
                    0.105,
                ),
                BoneSpec(
                    f"thigh.{suffix}",
                    Vector((side * 0.100, 0.006, 1.005)),
                    Vector((side * 0.108, 0.006, 0.555)),
                    "hips",
                    0.145,
                ),
                BoneSpec(
                    f"shin.{suffix}",
                    Vector((side * 0.108, 0.006, 0.555)),
                    Vector((side * 0.120, 0.000, 0.120)),
                    f"thigh.{suffix}",
                    0.125,
                ),
                BoneSpec(
                    f"foot.{suffix}",
                    Vector((side * 0.120, 0.000, 0.120)),
                    Vector((side * 0.120, -0.145, 0.065)),
                    f"shin.{suffix}",
                    0.135,
                ),
                BoneSpec(
                    f"toe.{suffix}",
                    Vector((side * 0.120, -0.145, 0.065)),
                    Vector((side * 0.120, -0.245, 0.040)),
                    f"foot.{suffix}",
                    0.130,
                ),
            ]
        )
    return specs


def point_segment_distance(point: Vector, head: Vector, tail: Vector) -> float:
    segment = tail - head
    length_squared = segment.length_squared
    if length_squared <= 1e-12:
        return (point - head).length
    parameter = max(0.0, min(1.0, (point - head).dot(segment) / length_squared))
    return (point - (head + parameter * segment)).length


def side_compatible(point: Vector, bone_name: str) -> bool:
    if bone_name.endswith(".L") and point.x > 0.025:
        return False
    if bone_name.endswith(".R") and point.x < -0.025:
        return False
    return True


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge0 == edge1:
        return float(value >= edge1)
    amount = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return amount * amount * (3.0 - 2.0 * amount)


def arm_membership(point: Vector) -> tuple[float, float, str]:
    """Return a depth-independent arm mask and chain coordinate.

    MakeHuman's fingers and palm span far more depth than the center of a
    simple arm bone. Pure 3D nearest-bone weights therefore misclassify some
    neighboring hand vertices as torso, producing the characteristic torn
    ribbons seen in naive conversions. The arms are cleanly separated in the
    source X/Z plane, so this anatomical 2D gate keeps every palm/finger layer
    on one coherent chain while retaining a broad deltoid blend.
    """
    suffix = "L" if point.x < 0.0 else "R"
    query = Vector((abs(point.x), point.z))
    shoulder = Vector((0.205, 1.465))
    hand_tip = Vector((0.585, 1.005))
    segment = hand_tip - shoulder
    coordinate = (query - shoulder).dot(segment) / segment.length_squared
    closest = shoulder + max(0.0, min(1.0, coordinate)) * segment
    radial_distance = (query - closest).length
    radial_gate = 1.0 - smoothstep(0.105, 0.205, radial_distance)
    shoulder_gate = smoothstep(-0.10, 0.18, coordinate)
    return radial_gate * shoulder_gate, coordinate, suffix


def adjacent_chain_weights(coordinate: float, suffix: str) -> list[tuple[str, float]]:
    centers = (
        (0.16, f"upper_arm.{suffix}"),
        (0.61, f"forearm.{suffix}"),
        (0.95, f"hand.{suffix}"),
    )
    if coordinate <= centers[0][0]:
        return [(centers[0][1], 1.0)]
    if coordinate >= centers[-1][0]:
        return [(centers[-1][1], 1.0)]
    for (left_position, left_name), (right_position, right_name) in zip(centers, centers[1:]):
        if left_position <= coordinate <= right_position:
            blend = smoothstep(left_position, right_position, coordinate)
            return [(left_name, 1.0 - blend), (right_name, blend)]
    raise AssertionError("unreachable arm-chain coordinate")


def calculate_weights(body: bpy.types.Object, specs: list[BoneSpec]) -> list[list[tuple[str, float]]]:
    """Fit smooth normalized top-four weights with coherent limb domains."""
    arm_names = {
        f"{stem}.{suffix}"
        for stem in ("upper_arm", "forearm", "hand")
        for suffix in ("L", "R")
    }
    base_specs = [spec for spec in specs if spec.deform and spec.name not in arm_names]
    all_weights: list[list[tuple[str, float]]] = []
    for vertex in body.data.vertices:
        point = vertex.co
        arm_mask, arm_coordinate, suffix = arm_membership(point)
        base_scored: list[tuple[str, float]] = []
        for spec in base_specs:
            if not side_compatible(point, spec.name):
                continue
            distance = point_segment_distance(point, spec.head, spec.tail)
            normalized = distance / spec.radius
            score = math.exp(-2.35 * normalized * normalized)

            # Keep central torso vertices on the axial chain while allowing a
            # broad four-bone shoulder/hip blend at the actual joints.
            if "." in spec.name and abs(point.x) < 0.035:
                score *= 0.04
            if spec.name.startswith(("foot.", "toe.")) and point.z > 0.24:
                score *= 0.01
            base_scored.append((spec.name, score))
        base_scored.sort(key=lambda item: item[1], reverse=True)
        base_selected = [(name, score) for name, score in base_scored[:2] if score > 1e-14]
        if not base_selected:
            base_selected = [("hips", 1.0)]
        base_total = sum(score for _name, score in base_selected)
        selected = [
            (name, score / base_total * (1.0 - arm_mask)) for name, score in base_selected
        ]
        selected.extend(
            (name, weight * arm_mask)
            for name, weight in adjacent_chain_weights(arm_coordinate, suffix)
        )
        selected = [(name, weight) for name, weight in selected if weight > 1e-10]
        total = sum(weight for _name, weight in selected)
        normalized_weights = [(name, weight / total) for name, weight in selected]
        # Force the final term to close binary floating-point normalization.
        if len(normalized_weights) > 1:
            prior = sum(weight for _name, weight in normalized_weights[:-1])
            normalized_weights[-1] = (normalized_weights[-1][0], max(0.0, 1.0 - prior))
        all_weights.append(normalized_weights)
    return all_weights


def rotation_about(pivot: Vector, radians: float) -> Matrix:
    return Matrix.Translation(pivot) @ Matrix.Rotation(radians, 4, "Y") @ Matrix.Translation(-pivot)


def pose_transforms(specs: list[BoneSpec]) -> dict[str, Matrix]:
    transforms = {spec.name: Matrix.Identity(4) for spec in specs}
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        shoulder = next(spec.head for spec in specs if spec.name == f"upper_arm.{suffix}")
        transform = rotation_about(shoulder, math.radians(side * ARM_RELAX_DEGREES))
        for stem in ("upper_arm", "forearm", "hand"):
            transforms[f"{stem}.{suffix}"] = transform
    return transforms


def deform_to_relaxed_pose(
    body: bpy.types.Object,
    weights: list[list[tuple[str, float]]],
    transforms: dict[str, Matrix],
) -> None:
    """Apply one continuous LBS pose; topology and UV loop data are untouched."""
    source_positions = [vertex.co.copy() for vertex in body.data.vertices]
    for vertex, source, influences in zip(body.data.vertices, source_positions, weights, strict=True):
        homogeneous = source.to_4d()
        deformed = Vector((0.0, 0.0, 0.0))
        for bone_name, weight in influences:
            deformed += (transforms[bone_name] @ homogeneous).to_3d() * weight
        vertex.co = deformed
    body.data.update(calc_edges=True)


def target_bone_specs(specs: list[BoneSpec], transforms: dict[str, Matrix]) -> list[BoneSpec]:
    transformed: list[BoneSpec] = []
    for spec in specs:
        matrix = transforms[spec.name]
        transformed.append(
            BoneSpec(
                spec.name,
                matrix @ spec.head,
                matrix @ spec.tail,
                spec.parent,
                spec.radius,
                spec.deform,
            )
        )
    return transformed


def make_clay_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Foundation_Clay")
    material.use_nodes = True
    material.diffuse_color = (0.34, 0.285, 0.235, 1.0)
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (0.34, 0.285, 0.235, 1.0)
    principled.inputs["Roughness"].default_value = 0.56
    principled.inputs["Specular IOR Level"].default_value = 0.30
    if "Subsurface Weight" in principled.inputs:
        principled.inputs["Subsurface Weight"].default_value = 0.045
        principled.inputs["Subsurface Radius"].default_value = (1.0, 0.46, 0.23)
    return material


def create_armature(specs: list[BoneSpec]) -> bpy.types.Object:
    data = bpy.data.armatures.new("HumanoidFoundation_Rig")
    armature = bpy.data.objects.new("HumanoidFoundation_Armature", data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    created: dict[str, bpy.types.EditBone] = {}
    for spec in specs:
        bone = data.edit_bones.new(spec.name)
        bone.head = spec.head
        bone.tail = spec.tail
        bone.use_deform = spec.deform
        bone.roll = 0.0
        if spec.parent:
            bone.parent = created[spec.parent]
        created[spec.name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    armature.select_set(False)
    data.display_type = "OCTAHEDRAL"
    armature.show_in_front = True
    armature["source_license"] = "CC0-1.0"
    armature["coordinate_contract"] = "metres; feet at Z=0; forward is Blender -Y"
    armature["rest_pose"] = f"relaxed arms-down; source A-pose relaxed {ARM_RELAX_DEGREES:.1f} degrees"
    return armature


def bind_weights(
    body: bpy.types.Object,
    armature: bpy.types.Object,
    weights: list[list[tuple[str, float]]],
) -> None:
    groups = {bone.name: body.vertex_groups.new(name=bone.name) for bone in armature.data.bones if bone.use_deform}
    for vertex, influences in zip(body.data.vertices, weights, strict=True):
        for bone_name, weight in influences:
            groups[bone_name].add([vertex.index], weight, "REPLACE")
    modifier = body.modifiers.new("HumanoidFoundation_Skin", "ARMATURE")
    modifier.object = armature
    modifier.use_deform_preserve_volume = True
    body.parent = armature
    body.matrix_parent_inverse = armature.matrix_world.inverted()
    body["blended_weights"] = True
    body["max_bone_influences"] = 4
    body["source_topology_retained"] = True


def reset_pose(armature: bpy.types.Object) -> None:
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.location = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)


def create_action(
    armature: bpy.types.Object,
    name: str,
    keys: list[tuple[int, dict[str, tuple[float, float, float]], dict[str, tuple[float, float, float]]]],
) -> bpy.types.Action:
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    for frame, rotations, locations in keys:
        bpy.context.scene.frame_set(frame)
        reset_pose(armature)
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
    armature.animation_data.action = None
    reset_pose(armature)
    return action


def create_actions(armature: bpy.types.Object) -> list[bpy.types.Action]:
    idle = create_action(
        armature,
        "FoundationIdle",
        [
            (1, {}, {}),
            (25, {"chest": (1.2, 0, 0), "head": (-0.6, 0.8, 0)}, {}),
            (49, {}, {}),
        ],
    )
    walk = create_action(
        armature,
        "FoundationWalk",
        [
            (
                1,
                {
                    "thigh.L": (24, 0, 0),
                    "shin.L": (-18, 0, 0),
                    "thigh.R": (-22, 0, 0),
                    "shin.R": (7, 0, 0),
                    "upper_arm.L": (-9, 0, 0),
                    "upper_arm.R": (9, 0, 0),
                },
                {},
            ),
            (
                13,
                {
                    "thigh.L": (-22, 0, 0),
                    "shin.L": (7, 0, 0),
                    "thigh.R": (24, 0, 0),
                    "shin.R": (-18, 0, 0),
                    "upper_arm.L": (9, 0, 0),
                    "upper_arm.R": (-9, 0, 0),
                },
                {},
            ),
            (
                25,
                {
                    "thigh.L": (24, 0, 0),
                    "shin.L": (-18, 0, 0),
                    "thigh.R": (-22, 0, 0),
                    "shin.R": (7, 0, 0),
                    "upper_arm.L": (-9, 0, 0),
                    "upper_arm.R": (9, 0, 0),
                },
                {},
            ),
        ],
    )
    crouch = create_action(
        armature,
        "FoundationCrouch",
        [
            (1, {}, {}),
            (
                18,
                {
                    "hips": (3, 0, 0),
                    "spine_01": (-4, 0, 0),
                    "thigh.L": (15, 0, 0),
                    "thigh.R": (15, 0, 0),
                    "shin.L": (-22, 0, 0),
                    "shin.R": (-22, 0, 0),
                    "foot.L": (7, 0, 0),
                    "foot.R": (7, 0, 0),
                },
                {"hips": (0, 0, -0.055)},
            ),
            (36, {}, {}),
        ],
    )
    armature.animation_data.action = idle
    bpy.context.scene.frame_set(1)
    return [idle, walk, crouch]


def mesh_connected_components(mesh: bpy.types.Mesh) -> int:
    if not mesh.vertices:
        return 0
    adjacency: list[list[int]] = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        first, second = edge.vertices
        adjacency[first].append(second)
        adjacency[second].append(first)
    seen = bytearray(len(mesh.vertices))
    components = 0
    for start in range(len(mesh.vertices)):
        if seen[start]:
            continue
        components += 1
        seen[start] = 1
        queue = deque([start])
        while queue:
            current = queue.popleft()
            for neighbor in adjacency[current]:
                if not seen[neighbor]:
                    seen[neighbor] = 1
                    queue.append(neighbor)
    return components


def welded_position_components(mesh: bpy.types.Mesh, tolerance: float = 1e-5) -> tuple[int, int]:
    """Count components after welding exporter-created UV/normal seam copies."""
    representatives: dict[tuple[int, int, int], int] = {}
    vertex_representatives: list[int] = []
    for vertex in mesh.vertices:
        key = tuple(int(round(value / tolerance)) for value in vertex.co)
        representative = representatives.setdefault(key, len(representatives))
        vertex_representatives.append(representative)
    adjacency: list[set[int]] = [set() for _ in representatives]
    for edge in mesh.edges:
        first = vertex_representatives[edge.vertices[0]]
        second = vertex_representatives[edge.vertices[1]]
        if first != second:
            adjacency[first].add(second)
            adjacency[second].add(first)
    seen = bytearray(len(adjacency))
    components = 0
    for start in range(len(adjacency)):
        if seen[start]:
            continue
        components += 1
        seen[start] = 1
        queue = deque([start])
        while queue:
            current = queue.popleft()
            for neighbor in adjacency[current]:
                if not seen[neighbor]:
                    seen[neighbor] = 1
                    queue.append(neighbor)
    return components, len(representatives)


def max_edge_length(mesh: bpy.types.Mesh) -> float:
    return max(
        ((mesh.vertices[edge.vertices[0]].co - mesh.vertices[edge.vertices[1]].co).length for edge in mesh.edges),
        default=0.0,
    )


def bounds(body: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [body.matrix_world @ vertex.co for vertex in body.data.vertices]
    low = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    high = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return low, high


def weight_metrics(body: bpy.types.Object) -> dict[str, float | int]:
    maximum = 0
    minimum = 999
    largest_error = 0.0
    unweighted = 0
    blended = 0
    for vertex in body.data.vertices:
        influences = [group.weight for group in vertex.groups if group.weight > 1e-8]
        maximum = max(maximum, len(influences))
        minimum = min(minimum, len(influences))
        if not influences:
            unweighted += 1
            continue
        if len(influences) > 1:
            blended += 1
        largest_error = max(largest_error, abs(sum(influences) - 1.0))
    return {
        "max_influences": maximum,
        "min_influences": 0 if minimum == 999 else minimum,
        "unweighted_vertices": unweighted,
        "blended_vertices": blended,
        "largest_normalization_error": largest_error,
    }


def topology_metrics(body: bpy.types.Object) -> dict[str, object]:
    mesh = body.data
    mesh.calc_loop_triangles()
    low, high = bounds(body)
    welded_components, welded_vertices = welded_position_components(mesh)
    return {
        "mesh_objects": 1,
        "vertices": len(mesh.vertices),
        "edges": len(mesh.edges),
        "faces": len(mesh.polygons),
        "triangles": len(mesh.loop_triangles),
        "connected_components": mesh_connected_components(mesh),
        "welded_position_components": welded_components,
        "welded_position_vertices": welded_vertices,
        "max_edge_m": round(max_edge_length(mesh), 8),
        "uv_layers": len(mesh.uv_layers),
        "uv_loops": len(mesh.uv_layers[0].data) if mesh.uv_layers else 0,
        "bounds_min_m": [round(value, 6) for value in low],
        "bounds_max_m": [round(value, 6) for value in high],
        "dimensions_m": [round(high[index] - low[index], 6) for index in range(3)],
    }


def edge_stretch_metrics(
    mesh: bpy.types.Mesh,
    source_positions: list[Vector],
) -> dict[str, object]:
    ratios: list[tuple[float, int, int, float, float]] = []
    for edge in mesh.edges:
        first, second = edge.vertices
        before = (source_positions[first] - source_positions[second]).length
        after = (mesh.vertices[first].co - mesh.vertices[second].co).length
        if before > 1e-9:
            ratios.append((after / before, first, second, before, after))
    ratios.sort(key=lambda item: item[0])
    percentile_index = min(len(ratios) - 1, int(len(ratios) * 0.999))
    return {
        "minimum_ratio": round(ratios[0][0], 6),
        "p99_9_ratio": round(ratios[percentile_index][0], 6),
        "maximum_ratio": round(ratios[-1][0], 6),
        "worst_edges": [
            {
                "vertices": [first, second],
                "ratio": round(ratio, 6),
                "source_length_m": round(before, 8),
                "posed_length_m": round(after, 8),
                "source_midpoint_m": [
                    round(value, 6) for value in (source_positions[first] + source_positions[second]) * 0.5
                ],
            }
            for ratio, first, second, before, after in reversed(ratios[-12:])
        ],
    }


def simple_material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    material.diffuse_color = color
    return material


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_preview_area(
    collection: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.location = location
    look_at(obj, Vector(target))
    return obj


def setup_preview() -> tuple[bpy.types.Collection, bpy.types.Object]:
    scene = bpy.context.scene
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.115, 0.125, 0.14, 1.0)
    background.inputs["Strength"].default_value = 0.52

    collection = bpy.data.collections.new("PREVIEW_ONLY")
    scene.collection.children.link(collection)
    ground_material = simple_material("PREVIEW_Ground_Material", (0.13, 0.145, 0.16, 1.0), 0.83)

    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0, 0, -0.004))
    floor = bpy.context.object
    for owner in list(floor.users_collection):
        owner.objects.unlink(floor)
    collection.objects.link(floor)
    floor.name = "PREVIEW_Floor"
    floor.data.materials.append(ground_material)

    camera_data = bpy.data.cameras.new("PREVIEW_Camera")
    camera_data.lens = 58
    camera_data.sensor_width = 36
    camera = bpy.data.objects.new("PREVIEW_Camera", camera_data)
    collection.objects.link(camera)
    scene.camera = camera

    add_preview_area(collection, "PREVIEW_Key", (-2.3, -3.0, 3.5), (0, 0, 1.05), 1150, 2.6, (1.0, 0.78, 0.62))
    add_preview_area(collection, "PREVIEW_Fill", (2.6, -2.1, 2.2), (0, 0, 1.0), 800, 2.3, (0.58, 0.74, 1.0))
    add_preview_area(collection, "PREVIEW_Rim", (-1.0, 2.3, 3.0), (0, 0, 1.25), 1300, 2.0, (0.68, 0.82, 1.0))
    add_preview_area(collection, "PREVIEW_Face", (0.1, -1.8, 2.35), (0, -0.04, 1.67), 420, 0.9, (1.0, 0.84, 0.72))
    return collection, camera


def render_view(
    path: Path,
    camera: bpy.types.Object,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
) -> None:
    camera.location = location
    look_at(camera, Vector(target))
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def render_previews(out_dir: Path, armature: bpy.types.Object, actions: list[bpy.types.Action]) -> None:
    _collection, camera = setup_preview()
    armature.data.pose_position = "REST"
    armature.animation_data.action = None
    bpy.context.scene.frame_set(1)
    render_view(out_dir / "foundation-front.png", camera, (0.0, -3.55, 0.96), (0, 0, 0.93))
    render_view(out_dir / "foundation-rear.png", camera, (0.0, 3.55, 0.96), (0, 0, 0.93))

    armature.data.pose_position = "POSE"
    armature.animation_data.action = next(action for action in actions if action.name == "FoundationWalk")
    bpy.context.scene.frame_set(1)
    render_view(out_dir / "foundation-walk-proof.png", camera, (-2.25, -3.0, 1.02), (0, 0, 0.90))

    armature.animation_data.action = next(action for action in actions if action.name == "FoundationCrouch")
    bpy.context.scene.frame_set(18)
    render_view(out_dir / "foundation-crouch-proof.png", camera, (2.50, -3.05, 0.82), (0, -0.02, 0.68))
    armature.data.pose_position = "REST"
    armature.animation_data.action = actions[0]
    bpy.context.scene.frame_set(1)


def select_asset(body: bpy.types.Object, armature: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature


def export_glb(path: Path, body: bpy.types.Object, armature: bpy.types.Object) -> None:
    select_asset(body, armature)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
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
        # Blender's parallel MikkTSpace pass can vary the last tangent bits
        # between identical headless runs. This neutral foundation has no
        # tangent-space normal map, so omit tangents and let final materials
        # generate them when needed; the proof GLB is then byte-reproducible.
        export_tangents=False,
        export_texcoords=True,
        export_vertex_color="NONE",
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=True,
    )


def read_glb_json(path: Path) -> dict:
    with path.open("rb") as stream:
        header = stream.read(12)
        magic, version, total_length = struct.unpack("<4sII", header)
        if magic != b"glTF" or version != 2 or total_length != path.stat().st_size:
            raise RuntimeError("Malformed GLB 2.0 header")
        while stream.tell() < total_length:
            chunk_length, chunk_type = struct.unpack("<II", stream.read(8))
            payload = stream.read(chunk_length)
            if chunk_type == 0x4E4F534A:
                return json.loads(payload.rstrip(b" \t\r\n\0"))
    raise RuntimeError("GLB has no JSON chunk")


def glb_metrics(path: Path) -> dict[str, object]:
    document = read_glb_json(path)
    extensions = sorted(document.get("extensionsUsed", []))
    external_uris = [
        item["uri"]
        for key in ("buffers", "images")
        for item in document.get(key, [])
        if isinstance(item.get("uri"), str) and not item["uri"].startswith("data:")
    ]
    return {
        "bytes": path.stat().st_size,
        "asset_generator": document.get("asset", {}).get("generator"),
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "skins": len(document.get("skins", [])),
        "materials": len(document.get("materials", [])),
        "animations": [animation.get("name", "") for animation in document.get("animations", [])],
        "extensions_used": extensions,
        "compression_extensions": [
            extension
            for extension in extensions
            if extension in {"KHR_draco_mesh_compression", "EXT_meshopt_compression"}
        ],
        "external_uris": external_uris,
    }


def validate_reimport(path: Path) -> dict[str, object]:
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH"
        and not any(collection.name == "glTF_not_exported" for collection in obj.users_collection)
    ]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(meshes) != 1 or len(armatures) != 1:
        raise RuntimeError(f"GLB reimport expected 1 mesh / 1 rig, found {len(meshes)} / {len(armatures)}")
    armatures[0].data.pose_position = "REST"
    if armatures[0].animation_data:
        armatures[0].animation_data.action = None
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    metrics = topology_metrics(meshes[0])
    metrics.update(
        {
            "armatures": len(armatures),
            "bones": len(armatures[0].data.bones),
            "object_nodes": len([obj for obj in bpy.context.scene.objects if obj.type != "LIGHT"]),
            "cameras": len([obj for obj in bpy.context.scene.objects if obj.type == "CAMERA"]),
            "lights": len([obj for obj in bpy.context.scene.objects if obj.type == "LIGHT"]),
        }
    )
    return metrics


def main() -> None:
    args = parse_args()
    root = args.root.resolve()
    out_dir = root / OUT_RELATIVE
    out_dir.mkdir(parents=True, exist_ok=True)
    source_path, license_path = ensure_vendored_source(root, out_dir)
    reset_scene()

    body = import_source(source_path)
    source_scale = normalize_source_coordinates(body)
    source_positions = [vertex.co.copy() for vertex in body.data.vertices]
    source_metrics = topology_metrics(body)
    specs = source_bone_specs()
    weights = calculate_weights(body, specs)
    transforms = pose_transforms(specs)
    deform_to_relaxed_pose(body, weights, transforms)
    posed_metrics = topology_metrics(body)
    stretch_metrics = edge_stretch_metrics(body.data, source_positions)

    body.data.materials.clear()
    body.data.materials.append(make_clay_material())
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    target_specs = target_bone_specs(specs, transforms)
    armature = create_armature(target_specs)
    bind_weights(body, armature, weights)
    actions = create_actions(armature)
    weights_report = weight_metrics(body)
    armature_name = armature.name
    bone_count = len(armature.data.bones)
    deform_bone_count = len([bone for bone in armature.data.bones if bone.use_deform])
    clip_names = [action.name for action in actions]

    body["source_sha256"] = SOURCE_SHA256
    body["source_license"] = "CC0-1.0"
    body["source_upstream_commit"] = UPSTREAM_COMMIT

    glb_path = out_dir / "foundation-humanoid.glb"
    blend_path = out_dir / "foundation-humanoid.blend"
    export_glb(glb_path, body, armature)

    # The saved source contains only the deliverable mesh and rig. Preview
    # cameras, lights, and floor are created afterward and never enter it.
    armature.data.pose_position = "REST"
    armature.animation_data.action = actions[0]
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True)

    if not args.skip_render:
        render_previews(out_dir, armature, actions)

    packed_glb = glb_metrics(glb_path)
    reimport = validate_reimport(glb_path)
    checks = {
        "verified_cc0_source": sha256(source_path) == SOURCE_SHA256 and sha256(license_path) == LICENSE_SHA256,
        "single_connected_source": source_metrics["connected_components"] == 1,
        "single_connected_posed": posed_metrics["connected_components"] == 1,
        "source_topology_retained": all(
            source_metrics[key] == posed_metrics[key] for key in ("vertices", "edges", "faces", "uv_loops")
        ),
        "weights_normalized": weights_report["largest_normalization_error"] <= 1e-6,
        "max_four_influences": weights_report["max_influences"] <= 4,
        "all_vertices_weighted": weights_report["unweighted_vertices"] == 0,
        "bone_count_18_plus": bone_count >= 18,
        "reasonable_edge_stretch": stretch_metrics["maximum_ratio"] < 1.8,
        "metric_height": abs(float(posed_metrics["dimensions_m"][2]) - TARGET_HEIGHT) <= 0.025,
        "feet_at_ground": abs(float(posed_metrics["bounds_min_m"][2])) <= 0.01,
        "plain_uncompressed_glb": not packed_glb["compression_extensions"],
        "self_contained_glb": not packed_glb["external_uris"],
        "glb_reimports_cleanly": (
            reimport["mesh_objects"] == 1
            and reimport["armatures"] == 1
            and reimport["welded_position_components"] == 1
        ),
        "no_exported_preview_helpers": reimport["cameras"] == 0 and reimport["lights"] == 0,
    }
    report = {
        "generator": "scripts/blender/hd_humanoid_foundation.py",
        "blender": bpy.app.version_string,
        "coordinate_contract": "metres; feet at Z=0; forward is Blender -Y",
        "source": {
            "asset": str(source_path.relative_to(root)),
            "sha256": sha256(source_path),
            "license": str(license_path.relative_to(root)),
            "license_sha256": sha256(license_path),
            "upstream_commit": UPSTREAM_COMMIT,
            "import_scale_m_per_source_unit": source_scale,
            "pose_note": (
                "The proxy ships in an arms-out A pose. A normalized top-four LBS pass "
                f"relaxes each full arm chain downward by {ARM_RELAX_DEGREES:.1f} degrees."
            ),
            "topology": source_metrics,
        },
        "foundation": {
            "topology": posed_metrics,
            "edge_stretch_from_source_pose": stretch_metrics,
            "armature": armature_name,
            "bones": bone_count,
            "deform_bones": deform_bone_count,
            "weights": weights_report,
            "clips": clip_names,
        },
        "glb": packed_glb,
        "glb_reimport": reimport,
        "files": {
            "blend": str(blend_path.relative_to(root)),
            "blend_bytes": blend_path.stat().st_size,
            "glb": str(glb_path.relative_to(root)),
            "glb_bytes": glb_path.stat().st_size,
            "front": str((out_dir / "foundation-front.png").relative_to(root)),
            "rear": str((out_dir / "foundation-rear.png").relative_to(root)),
            "walk_proof": str((out_dir / "foundation-walk-proof.png").relative_to(root)),
            "crouch_proof": str((out_dir / "foundation-crouch-proof.png").relative_to(root)),
        },
        "checks": checks,
    }
    report_path = out_dir / "validation-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise SystemExit("Humanoid foundation failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
