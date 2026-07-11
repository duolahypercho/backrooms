"""Read-only Unreal 5.7 Python API preflight for the MonsterQA automation."""

import unreal


REQUIRED_TYPES = (
    unreal.AnimationLibrary,
    unreal.AnimSequence,
    unreal.AssetImportTask,
    unreal.CineCameraActor,
    unreal.EditorActorSubsystem,
    unreal.EditorAssetLibrary,
    unreal.FbxImportUI,
    unreal.LevelEditorSubsystem,
    unreal.LevelSequence,
    unreal.MoviePipeline,
    unreal.MoviePipelineAntiAliasingSetting,
    unreal.MoviePipelineDeferredPassBase,
    unreal.MoviePipelineImageSequenceOutput_PNG,
    unreal.MoviePipelineOutputSetting,
    unreal.MoviePipelinePythonHostExecutor,
    unreal.MoviePipelineQueue,
    unreal.MovieSceneCameraCutTrack,
    unreal.MovieSceneObjectBindingID,
    unreal.MovieSceneSkeletalAnimationTrack,
    unreal.SkeletalMesh,
    unreal.SkeletalMeshActor,
)


def preflight():
    assert all(required_type is not None for required_type in REQUIRED_TYPES)
    assert unreal.FBXImportType.FBXIT_SKELETAL_MESH is not None
    assert unreal.FBXImportType.FBXIT_ANIMATION is not None
    assert unreal.AnimationMode.ANIMATION_SINGLE_NODE is not None
    assert unreal.ComponentMobility.MOVABLE is not None
    assert unreal.CameraFocusMethod.DISABLE is not None
    assert unreal.AntiAliasingMethod.AAM_NONE is not None

    import_options = unreal.FbxImportUI()
    import_options.reset_to_default()
    import_options.automated_import_should_detect_type = False
    import_options.import_as_skeletal = True
    import_options.import_mesh = True
    import_options.import_animations = False
    import_options.create_physics_asset = True
    assert import_options.skeletal_mesh_import_data is not None
    assert import_options.anim_sequence_import_data is not None

    import_task = unreal.AssetImportTask()
    import_task.automated = True
    import_task.replace_existing = True
    import_task.replace_existing_settings = True
    import_task.save = True

    binding_id = unreal.MovieSceneObjectBindingID()
    assert binding_id is not None
    animation_parameters = unreal.MovieSceneSkeletalAnimationParams()
    animation_parameters.set_editor_property("force_custom_mode", True)
    assert animation_parameters.get_editor_property("force_custom_mode") is True

    output_directory = unreal.DirectoryPath(path="/tmp/monster-qa-preflight")
    assert output_directory.path == "/tmp/monster-qa-preflight"

    import monster_qa_executor

    assert monster_qa_executor.MonsterQARenderExecutor is not None
    unreal.log(
        "MonsterQA API preflight passed on {}".format(
            unreal.SystemLibrary.get_engine_version()
        )
    )


preflight()
