"""Import the Pale Entity FBX deliverables and build deterministic UE 5.7 QA assets.

Run this script with UnrealEditor-Cmd, not the system Python interpreter. It is
intentionally idempotent: every run deletes only ``/Game/MonsterQA`` and rebuilds
that generated content from FBX files in ``art/characters/exports``.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import traceback

import unreal


CONTENT_ROOT = "/Game/MonsterQA"
CHARACTER_PATH = CONTENT_ROOT + "/Character"
ANIMATION_PATH = CONTENT_ROOT + "/Animations"
MAP_PATH = CONTENT_ROOT + "/Maps/L_MonsterQA"
SEQUENCE_PATH = CONTENT_ROOT + "/Sequences"
FRAME_RATE = 30
MINIMUM_BONE_COUNT = 15

INPUT_CANDIDATES = {
    "mesh": (
        "pale-entity-skeletal.fbx",
        "pale-entity-mesh.fbx",
        "pale-entity.fbx",
        "SK_PaleEntity.fbx",
    ),
    "Walk": (
        "pale-entity-walk.fbx",
        "pale-entity-Walk.fbx",
        "AN_PaleEntity_Walk.fbx",
        "Walk.fbx",
    ),
    "Run": (
        "pale-entity-run.fbx",
        "pale-entity-Run.fbx",
        "AN_PaleEntity_Run.fbx",
        "Run.fbx",
    ),
    "Crouch": (
        "pale-entity-crouch.fbx",
        "pale-entity-Crouch.fbx",
        "AN_PaleEntity_Crouch.fbx",
        "Crouch.fbx",
    ),
    "ArmBend": (
        "pale-entity-arm-bend.fbx",
        "pale-entity-armbend.fbx",
        "pale-entity-ArmBend.fbx",
        "AN_PaleEntity_ArmBend.fbx",
        "ArmBend.fbx",
    ),
}

MINIMUM_ANIMATED_TRACKS = {
    "Walk": 8,
    "Run": 8,
    "Crouch": 6,
    "ArmBend": 4,
}

SHOT_SPECS = (
    ("Front", unreal.Vector(0.0, 550.0, 135.0), unreal.Vector(0.0, 0.0, 125.0), None),
    ("Side", unreal.Vector(550.0, 0.0, 135.0), unreal.Vector(0.0, 0.0, 125.0), None),
    (
        "ThreeQuarter",
        unreal.Vector(420.0, 420.0, 150.0),
        unreal.Vector(0.0, 0.0, 125.0),
        None,
    ),
    (
        "Walk",
        unreal.Vector(440.0, 440.0, 145.0),
        unreal.Vector(0.0, 0.0, 120.0),
        "Walk",
    ),
    (
        "Run",
        unreal.Vector(460.0, 460.0, 145.0),
        unreal.Vector(0.0, 0.0, 115.0),
        "Run",
    ),
    (
        "Crouch",
        unreal.Vector(430.0, 430.0, 105.0),
        unreal.Vector(0.0, 0.0, 85.0),
        "Crouch",
    ),
    (
        "ArmBend",
        unreal.Vector(500.0, 250.0, 155.0),
        unreal.Vector(0.0, 0.0, 135.0),
        "ArmBend",
    ),
)


class QAError(RuntimeError):
    """Raised when an imported deliverable is not suitable for deformation QA."""


def require(condition, message):
    if not condition:
        raise QAError(message)


def project_directory():
    return Path(
        unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
    ).resolve()


def exports_directory():
    requested = os.environ.get("MONSTER_QA_EXPORT_DIR")
    if requested:
        return Path(requested).expanduser().resolve()
    # .../art/characters/unreal/MonsterQA -> .../art/characters/exports
    return (project_directory().parents[1] / "exports").resolve()


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_input(export_root, label):
    require(export_root.is_dir(), "FBX export directory does not exist: {}".format(export_root))
    files = {path.name.casefold(): path for path in export_root.glob("*.fbx")}

    for candidate in INPUT_CANDIDATES[label]:
        match = files.get(candidate.casefold())
        if match:
            require(match.stat().st_size > 1024, "FBX is unexpectedly small: {}".format(match))
            return match

    if label == "mesh":
        tokens = ("skeletal", "mesh")
        matches = [
            path
            for path in files.values()
            if any(token in path.stem.casefold() for token in tokens)
            and not any(
                token in path.stem.casefold()
                for token in ("walk", "run", "crouch", "arm", "bend")
            )
        ]
    else:
        token = label.casefold().replace("bend", "")
        matches = [path for path in files.values() if token in path.stem.casefold()]
        if label == "ArmBend":
            matches = [
                path
                for path in files.values()
                if "arm" in path.stem.casefold() and "bend" in path.stem.casefold()
            ]

    require(
        len(matches) == 1,
        "Could not resolve exactly one {} FBX in {}. Accepted names: {}".format(
            label, export_root, ", ".join(INPUT_CANDIDATES[label])
        ),
    )
    require(matches[0].stat().st_size > 1024, "FBX is unexpectedly small: {}".format(matches[0]))
    return matches[0]


def set_optional_property(obj, name, value):
    try:
        obj.set_editor_property(name, value)
        return True
    except Exception as exc:
        try:
            object_type = obj.get_class().get_name()
        except Exception:
            object_type = type(obj).__name__
        unreal.log_warning(
            "MonsterQA: optional {}.{} was not applied: {}".format(
                object_type, name, exc
            )
        )
        return False


def reset_generated_content():
    # Make deletion safe even when a previous QA map was open in the editor.
    unreal.EditorLoadingAndSavingUtils.new_blank_map(False)
    if unreal.EditorAssetLibrary.does_directory_exist(CONTENT_ROOT):
        require(
            unreal.EditorAssetLibrary.delete_directory(CONTENT_ROOT),
            "Could not delete generated content directory {}".format(CONTENT_ROOT),
        )


def imported_objects(task):
    objects = list(task.get_objects())
    known_paths = {obj.get_path_name() for obj in objects if obj is not None}
    for object_path in task.imported_object_paths:
        loaded = unreal.load_asset(object_path)
        if loaded is not None and loaded.get_path_name() not in known_paths:
            objects.append(loaded)
            known_paths.add(loaded.get_path_name())
    return objects


def rename_asset(asset, destination):
    if asset.get_path_name() == destination + "." + destination.rsplit("/", 1)[-1]:
        return asset
    require(
        unreal.EditorAssetLibrary.rename_asset(asset.get_path_name(), destination),
        "Could not rename {} to {}".format(asset.get_path_name(), destination),
    )
    renamed = unreal.load_asset(destination)
    require(renamed is not None, "Renamed asset did not reload: {}".format(destination))
    return renamed


def base_import_options():
    options = unreal.FbxImportUI()
    options.reset_to_default()
    options.automated_import_should_detect_type = False
    options.mesh_type_to_import = unreal.FBXImportType.FBXIT_SKELETAL_MESH
    options.import_as_skeletal = True
    options.import_mesh = True
    options.import_animations = False
    options.import_materials = True
    options.import_textures = True
    options.create_physics_asset = True
    options.override_full_name = True

    skeletal_data = options.skeletal_mesh_import_data
    set_optional_property(skeletal_data, "import_morph_targets", True)
    set_optional_property(skeletal_data, "preserve_smoothing_groups", True)
    set_optional_property(skeletal_data, "use_t0_as_ref_pose", False)
    set_optional_property(skeletal_data, "convert_scene", True)
    set_optional_property(skeletal_data, "convert_scene_unit", True)
    return options


def import_base_mesh(filename):
    task = unreal.AssetImportTask()
    task.filename = str(filename)
    task.destination_path = CHARACTER_PATH
    task.destination_name = "SK_PaleEntity"
    task.automated = True
    task.replace_existing = True
    task.replace_existing_settings = True
    task.save = True
    task.options = base_import_options()

    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    meshes = [obj for obj in imported_objects(task) if isinstance(obj, unreal.SkeletalMesh)]
    require(
        len(meshes) == 1,
        "Base FBX must create exactly one SkeletalMesh; imported: {}".format(
            [obj.get_path_name() for obj in imported_objects(task)]
        ),
    )
    mesh = rename_asset(meshes[0], CHARACTER_PATH + "/SK_PaleEntity")
    # UE 5.7 exposes the Skeleton as an editor property; the older convenience
    # ``get_skeleton()`` method is not present on macOS Python bindings.
    skeleton = mesh.get_editor_property("skeleton")
    require(skeleton is not None, "Imported SkeletalMesh has no Skeleton")
    skeleton = rename_asset(skeleton, CHARACTER_PATH + "/SKEL_PaleEntity")
    mesh = unreal.load_asset(CHARACTER_PATH + "/SK_PaleEntity", unreal.SkeletalMesh)
    require(mesh is not None, "SkeletalMesh failed to reload after Skeleton rename")
    require(
        mesh.get_editor_property("skeleton") == skeleton,
        "SkeletalMesh lost its Skeleton after rename",
    )
    return mesh, skeleton


def animation_import_options(skeleton, action_name):
    options = unreal.FbxImportUI()
    options.reset_to_default()
    options.automated_import_should_detect_type = False
    options.mesh_type_to_import = unreal.FBXImportType.FBXIT_ANIMATION
    options.import_as_skeletal = True
    options.import_mesh = False
    options.import_animations = True
    options.import_materials = False
    options.import_textures = False
    options.skeleton = skeleton
    options.override_animation_name = "AN_PaleEntity_{}".format(action_name)

    animation_data = options.anim_sequence_import_data
    set_optional_property(animation_data, "import_bone_tracks", True)
    set_optional_property(animation_data, "import_custom_attribute", True)
    set_optional_property(animation_data, "remove_redundant_keys", False)
    set_optional_property(animation_data, "convert_scene", True)
    set_optional_property(animation_data, "convert_scene_unit", True)
    return options


def import_animation(filename, skeleton, action_name):
    before = set(unreal.EditorAssetLibrary.list_assets(ANIMATION_PATH, True, False))
    task = unreal.AssetImportTask()
    task.filename = str(filename)
    task.destination_path = ANIMATION_PATH
    task.destination_name = "AN_PaleEntity_{}".format(action_name)
    task.automated = True
    task.replace_existing = True
    task.replace_existing_settings = True
    task.save = True
    task.options = animation_import_options(skeleton, action_name)

    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    objects = imported_objects(task)
    after = set(unreal.EditorAssetLibrary.list_assets(ANIMATION_PATH, True, False))
    for object_path in sorted(after - before):
        loaded = unreal.load_asset(object_path)
        if loaded is not None and loaded not in objects:
            objects.append(loaded)

    animations = [obj for obj in objects if isinstance(obj, unreal.AnimSequence)]
    require(
        len(animations) == 1,
        "{} FBX must create exactly one AnimSequence; imported: {}".format(
            action_name, [obj.get_path_name() for obj in objects]
        ),
    )
    animation = rename_asset(
        animations[0], ANIMATION_PATH + "/AN_PaleEntity_{}".format(action_name)
    )

    animation_skeleton = animation.get_editor_property("skeleton")
    require(
        animation_skeleton == skeleton,
        "{} animation is not assigned to the imported Skeleton".format(action_name),
    )
    duration = float(unreal.AnimationLibrary.get_sequence_length(animation))
    track_names = list(unreal.AnimationLibrary.get_animation_track_names(animation))
    require(duration > 0.05, "{} animation has no usable duration".format(action_name))
    require(
        len(track_names) >= MINIMUM_ANIMATED_TRACKS[action_name],
        "{} animation has only {} bone tracks; expected at least {}".format(
            action_name, len(track_names), MINIMUM_ANIMATED_TRACKS[action_name]
        ),
    )
    return animation, duration, track_names


def actor_component(actor, component_class):
    component = actor.get_component_by_class(component_class)
    component_name = getattr(component_class, "__name__", str(component_class))
    require(
        component is not None,
        "{} did not provide {}".format(actor.get_name(), component_name),
    )
    return component


def spawn(actor_subsystem, actor_class, label, location, rotation=None):
    actor = actor_subsystem.spawn_actor_from_class(
        actor_class,
        location,
        rotation or unreal.Rotator(),
        False,
    )
    actor_class_name = getattr(actor_class, "__name__", str(actor_class))
    require(actor is not None, "Could not spawn {}".format(actor_class_name))
    actor.set_actor_label(label)
    return actor


def configure_rect_light(actor_subsystem, label, location, target, intensity, width, height):
    rotation = unreal.MathLibrary.find_look_at_rotation(location, target)
    light = spawn(actor_subsystem, unreal.RectLight, label, location, rotation)
    component = actor_component(light, unreal.RectLightComponent)
    component.set_mobility(unreal.ComponentMobility.MOVABLE)
    component.set_intensity(intensity)
    component.set_source_width(width)
    component.set_source_height(height)
    component.set_cast_shadows(True)
    return light


def create_camera(actor_subsystem, label, location, target):
    rotation = unreal.MathLibrary.find_look_at_rotation(location, target)
    camera = spawn(actor_subsystem, unreal.CineCameraActor, label, location, rotation)
    component = camera.get_cine_camera_component()
    filmback = component.get_editor_property("filmback")
    filmback.sensor_width = 36.0
    filmback.sensor_height = 36.0
    component.set_editor_property("filmback", filmback)
    component.set_editor_property("current_focal_length", 50.0)
    component.set_editor_property("current_aperture", 8.0)
    focus = component.get_editor_property("focus_settings")
    focus.focus_method = unreal.CameraFocusMethod.DISABLE
    component.set_editor_property("focus_settings", focus)
    post_process = component.get_editor_property("post_process_settings")
    post_process.override_auto_exposure_bias = True
    post_process.auto_exposure_bias = -3.0
    component.set_editor_property("post_process_settings", post_process)
    component.set_editor_property("post_process_blend_weight", 1.0)
    return camera


def create_level(mesh):
    level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    require(level_subsystem.new_level(MAP_PATH, False), "Could not create {}".format(MAP_PATH))
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

    cube = unreal.load_asset("/Engine/BasicShapes/Cube.Cube", unreal.StaticMesh)
    require(cube is not None, "Engine QA floor mesh is unavailable")
    floor = spawn(
        actor_subsystem,
        unreal.StaticMeshActor,
        "QA_Floor",
        unreal.Vector(0.0, 0.0, -10.0),
    )
    floor_component = actor_component(floor, unreal.StaticMeshComponent)
    floor_component.set_static_mesh(cube)
    floor_component.set_mobility(unreal.ComponentMobility.STATIC)
    floor.set_actor_scale3d(unreal.Vector(14.0, 14.0, 0.2))

    monster = spawn(
        actor_subsystem,
        unreal.SkeletalMeshActor,
        "QA_PaleEntity",
        unreal.Vector(),
    )
    skeletal_component = actor_component(monster, unreal.SkeletalMeshComponent)
    skeletal_component.set_skeletal_mesh_asset(mesh)
    skeletal_component.set_animation_mode(unreal.AnimationMode.ANIMATION_SINGLE_NODE)
    set_optional_property(skeletal_component, "update_animation_in_editor", True)
    set_optional_property(skeletal_component, "cast_shadow", True)
    bone_count = int(skeletal_component.get_num_bones())
    require(
        bone_count >= MINIMUM_BONE_COUNT,
        "Imported character has {} bones; expected at least {}".format(
            bone_count, MINIMUM_BONE_COUNT
        ),
    )

    # A game-mode DefaultPawn renders a gray sphere at the origin when no
    # PlayerStart exists, contaminating the character's feet in MRQ captures.
    # Give it an off-stage start so only the imported skeletal mesh is visible.
    spawn(
        actor_subsystem,
        unreal.PlayerStart,
        "QA_OffstagePlayerStart",
        unreal.Vector(5000.0, 5000.0, 500.0),
    )

    atmosphere = spawn(
        actor_subsystem,
        unreal.SkyAtmosphere,
        "QA_SkyAtmosphere",
        unreal.Vector(),
    )
    require(atmosphere is not None, "Could not create the QA atmosphere")

    sun = spawn(
        actor_subsystem,
        unreal.DirectionalLight,
        "QA_Sun",
        unreal.Vector(0.0, 0.0, 500.0),
        unreal.Rotator(-38.0, -28.0, 0.0),
    )
    sun_component = actor_component(sun, unreal.DirectionalLightComponent)
    sun_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    sun_component.set_intensity(0.20)
    set_optional_property(sun_component, "atmosphere_sun_light", True)
    sun_component.set_cast_shadows(True)

    sky = spawn(actor_subsystem, unreal.SkyLight, "QA_SkyLight", unreal.Vector())
    sky_component = actor_component(sky, unreal.SkyLightComponent)
    sky_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    sky_component.set_intensity(0.05)
    set_optional_property(sky_component, "real_time_capture", True)

    target = unreal.Vector(0.0, 0.0, 125.0)
    configure_rect_light(
        actor_subsystem,
        "QA_Key",
        unreal.Vector(350.0, -320.0, 360.0),
        target,
        120.0,
        220.0,
        320.0,
    )
    configure_rect_light(
        actor_subsystem,
        "QA_Fill",
        unreal.Vector(170.0, 360.0, 270.0),
        target,
        35.0,
        280.0,
        360.0,
    )
    configure_rect_light(
        actor_subsystem,
        "QA_Rim",
        unreal.Vector(-330.0, -120.0, 330.0),
        target,
        70.0,
        180.0,
        280.0,
    )

    cameras = {}
    for shot_name, location, look_at, _ in SHOT_SPECS:
        cameras[shot_name] = create_camera(
            actor_subsystem,
            "CAM_QA_{}".format(shot_name),
            location,
            look_at,
        )

    require(level_subsystem.save_current_level(), "Could not save the QA level")
    return level_subsystem, monster, skeletal_component, bone_count, cameras


def add_camera_cut(sequence, camera, end_frame):
    camera_binding = sequence.add_possessable(camera)
    camera_track = sequence.add_track(unreal.MovieSceneCameraCutTrack)
    camera_section = camera_track.add_section()
    camera_section.set_start_frame(-1)
    camera_section.set_end_frame(end_frame)
    binding_id = unreal.MovieSceneObjectBindingID()
    binding_id.set_editor_property("Guid", camera_binding.get_id())
    camera_section.set_editor_property("CameraBindingID", binding_id)


def add_animation(sequence, monster, skeletal_component, animation, end_frame):
    monster_binding = sequence.add_possessable(monster)
    component_binding = sequence.add_possessable(skeletal_component)
    component_binding.set_parent(monster_binding)
    animation_track = component_binding.add_track(unreal.MovieSceneSkeletalAnimationTrack)
    animation_section = animation_track.add_section()
    parameters = animation_section.get_editor_property("params")
    parameters.set_editor_property("animation", animation)
    set_optional_property(parameters, "force_custom_mode", True)
    animation_section.set_editor_property("params", parameters)
    animation_section.set_range(0, end_frame)


def create_sequences(monster, skeletal_component, cameras, animations):
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    sequence_records = {}
    created_sequences = []

    for shot_name, _, _, animation_name in SHOT_SPECS:
        animation = animations.get(animation_name) if animation_name else None
        if animation is None:
            end_frame = 1
        else:
            duration = float(unreal.AnimationLibrary.get_sequence_length(animation))
            end_frame = max(2, int(math.ceil(duration * FRAME_RATE)))

        sequence = asset_tools.create_asset(
            "LS_QA_{}".format(shot_name),
            SEQUENCE_PATH,
            unreal.LevelSequence,
            unreal.LevelSequenceFactoryNew(),
        )
        require(sequence is not None, "Could not create sequence for {}".format(shot_name))
        sequence.set_display_rate(unreal.FrameRate(FRAME_RATE, 1))
        sequence.set_playback_start(0)
        sequence.set_playback_end(end_frame)
        add_camera_cut(sequence, cameras[shot_name], end_frame)
        if animation is not None:
            add_animation(sequence, monster, skeletal_component, animation, end_frame)
        require(
            unreal.EditorAssetLibrary.save_loaded_asset(sequence, False),
            "Could not save {}".format(sequence.get_path_name()),
        )
        created_sequences.append(sequence)
        sequence_records[shot_name] = {
            "asset": sequence.get_path_name(),
            "camera": cameras[shot_name].get_actor_label(),
            "animation": animation.get_path_name() if animation else None,
            "frames": end_frame,
        }

    require(len(created_sequences) == 7, "Expected exactly seven QA sequences")
    return sequence_records


def build():
    export_root = exports_directory()
    inputs = {label: resolve_input(export_root, label) for label in INPUT_CANDIDATES}
    unreal.log("MonsterQA: resolved FBX inputs from {}".format(export_root))
    for label, path in inputs.items():
        unreal.log("MonsterQA: {} -> {}".format(label, path.name))

    reset_generated_content()
    mesh, skeleton = import_base_mesh(inputs["mesh"])

    animations = {}
    animation_report = {}
    for action_name in ("Walk", "Run", "Crouch", "ArmBend"):
        animation, duration, track_names = import_animation(
            inputs[action_name], skeleton, action_name
        )
        animations[action_name] = animation
        animation_report[action_name] = {
            "asset": animation.get_path_name(),
            "duration_seconds": round(duration, 6),
            "bone_track_count": len(track_names),
            "bone_tracks": [str(name) for name in track_names],
        }

    level_subsystem, monster, skeletal_component, bone_count, cameras = create_level(mesh)
    sequences = create_sequences(
        monster,
        skeletal_component,
        cameras,
        animations,
    )
    require(level_subsystem.save_current_level(), "Could not save the final QA level state")
    require(
        unreal.EditorAssetLibrary.save_directory(CONTENT_ROOT, False, True),
        "Could not save generated QA assets",
    )

    report = {
        "schema_version": 1,
        "status": "passed",
        "engine_version": unreal.SystemLibrary.get_engine_version(),
        "source_directory": str(export_root),
        "inputs": {
            label: {
                "filename": path.name,
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
            for label, path in inputs.items()
        },
        "skeletal_mesh": mesh.get_path_name(),
        "skeleton": skeleton.get_path_name(),
        "bone_count": bone_count,
        "animations": animation_report,
        "map": MAP_PATH + ".L_MonsterQA",
        "cameras": [camera.get_actor_label() for camera in cameras.values()],
        "sequences": sequences,
    }
    report_path = project_directory().parent / "qa-validation.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    unreal.log("MonsterQA: validation passed; report written to {}".format(report_path))
    return report


try:
    build()
except Exception as error:
    unreal.log_error("MonsterQA build failed: {}".format(error))
    unreal.log_error(traceback.format_exc())
    raise
