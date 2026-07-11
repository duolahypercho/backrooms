"""Headless Movie Render Queue executor for the generated MonsterQA sequences.

This module is imported by ``init_unreal.py``. Unreal registers the Python UClass
as ``/Engine/PythonTypes.MonsterQARenderExecutor`` for the lifetime of the process.
"""

import os
import re

import unreal


MAP_OBJECT_PATH = "/Game/MonsterQA/Maps/L_MonsterQA.L_MonsterQA"
DEFAULT_RESOLUTION = (1024, 1024)
DEFAULT_FRAME_RATE = 30


def _command_line_parameters():
    _, _, parameters = unreal.SystemLibrary.parse_command_line(
        unreal.SystemLibrary.get_command_line()
    )
    return parameters


def _required_parameter(parameters, name):
    value = parameters.get(name)
    if not value:
        raise RuntimeError("Missing required -{}=<value> argument".format(name))
    return value


def _output_directory(parameters):
    requested = parameters.get("MonsterQAOutput")
    if requested:
        output_directory = os.path.abspath(os.path.expanduser(requested))
    else:
        project_directory = unreal.Paths.convert_relative_path_to_full(
            unreal.Paths.project_dir()
        )
        output_directory = os.path.abspath(
            os.path.join(project_directory, os.pardir, "renders")
        )
    os.makedirs(output_directory, exist_ok=True)
    return output_directory


def _resolution(parameters):
    value = parameters.get("MonsterQAResolution", "{}x{}".format(*DEFAULT_RESOLUTION))
    match = re.fullmatch(r"(\d+)[xX](\d+)", value.strip())
    if not match:
        raise RuntimeError(
            "-MonsterQAResolution must look like 1024x1024; got {!r}".format(value)
        )
    width, height = (int(match.group(1)), int(match.group(2)))
    if not (256 <= width <= 8192 and 256 <= height <= 8192):
        raise RuntimeError("Render resolution must be between 256 and 8192 per axis")
    return width, height


@unreal.uclass()
class MonsterQARenderExecutor(unreal.MoviePipelinePythonHostExecutor):
    """Render one QA Level Sequence to a deterministic PNG sequence."""

    active_pipeline = unreal.uproperty(unreal.MoviePipeline)
    qa_pipeline_queue = unreal.uproperty(unreal.MoviePipelineQueue)

    def _post_init(self):
        self.active_pipeline = None
        self.qa_pipeline_queue = None

    @unreal.ufunction(override=True)
    def execute_delayed(self, in_pipeline_queue):
        try:
            parameters = _command_line_parameters()
            sequence_path = _required_parameter(parameters, "LevelSequence")
            output_directory = _output_directory(parameters)
            width, height = _resolution(parameters)

            sequence = unreal.load_asset(sequence_path, unreal.LevelSequence)
            if sequence is None:
                raise RuntimeError("Level Sequence does not exist: {}".format(sequence_path))
            if unreal.load_asset(MAP_OBJECT_PATH, unreal.World) is None:
                raise RuntimeError("QA map does not exist: {}".format(MAP_OBJECT_PATH))

            self.qa_pipeline_queue = unreal.new_object(
                unreal.MoviePipelineQueue,
                outer=self,
            )
            job = self.qa_pipeline_queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
            job.job_name = sequence.get_name()
            job.author = "MonsterQA automation"
            job.sequence = unreal.SoftObjectPath(sequence.get_path_name())
            job.map = unreal.SoftObjectPath(MAP_OBJECT_PATH)

            config = job.get_configuration()
            output = config.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
            output.output_directory = unreal.DirectoryPath(path=output_directory)
            output.file_name_format = "{sequence_name}/{sequence_name}_{frame_number_rel}"
            output.output_resolution = unreal.IntPoint(width, height)
            output.use_custom_frame_rate = True
            output.output_frame_rate = unreal.FrameRate(DEFAULT_FRAME_RATE, 1)
            output.override_existing_output = True
            output.zero_pad_frame_numbers = 4
            output.flush_disk_writes_per_shot = True

            deferred_pass = config.find_or_add_setting_by_class(
                unreal.MoviePipelineDeferredPassBase
            )
            deferred_pass.disable_multisample_effects = True
            config.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)

            anti_aliasing = config.find_or_add_setting_by_class(
                unreal.MoviePipelineAntiAliasingSetting
            )
            anti_aliasing.spatial_sample_count = 8
            anti_aliasing.temporal_sample_count = 1
            anti_aliasing.override_anti_aliasing = True
            anti_aliasing.anti_aliasing_method = unreal.AntiAliasingMethod.AAM_NONE
            anti_aliasing.render_warm_up_count = 8
            anti_aliasing.engine_warm_up_count = 8
            anti_aliasing.render_warm_up_frames = False

            config.initialize_transient_settings()

            unreal.log(
                "MonsterQA: rendering {} at {}x{} to {}".format(
                    sequence.get_path_name(), width, height, output_directory
                )
            )
            self.active_pipeline = unreal.new_object(
                self.target_pipeline_class,
                outer=self.get_last_loaded_world(),
                base_type=unreal.MoviePipeline,
            )
            self.active_pipeline.on_movie_pipeline_work_finished_delegate.add_function_unique(
                self, "on_movie_pipeline_finished"
            )
            self.active_pipeline.initialize(job)
        except Exception as exc:
            unreal.log_error("MonsterQA render setup failed: {}".format(exc))
            self.on_executor_errored()

    @unreal.ufunction(override=True)
    def is_rendering(self):
        return self.active_pipeline is not None

    @unreal.ufunction(ret=None, params=[unreal.MoviePipelineOutputData])
    def on_movie_pipeline_finished(self, results):
        succeeded = bool(results.success)
        if succeeded:
            unreal.log("MonsterQA: render completed successfully")
        else:
            unreal.log_error("MonsterQA: render failed")
        self.active_pipeline = None
        self.qa_pipeline_queue = None
        if succeeded:
            self.on_executor_finished_impl()
        else:
            self.on_executor_errored()
