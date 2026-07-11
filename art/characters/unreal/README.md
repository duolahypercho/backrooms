# MonsterQA — Unreal Engine 5.7 skeletal-character validation

This content-only project imports the final Pale Entity as one Unreal
`SkeletalMesh`, imports four deformation-test `AnimSequence` assets against the
same `Skeleton`, creates a neutral three-point-lit QA map, and creates exactly
seven camera-cut Level Sequences:

- `LS_QA_Front`
- `LS_QA_Side`
- `LS_QA_ThreeQuarter`
- `LS_QA_Walk`
- `LS_QA_Run`
- `LS_QA_Crouch`
- `LS_QA_ArmBend`

The first three sequences are one-frame bind-pose inspection renders. The other
four cover their complete imported animation and therefore produce PNG frame
sequences suitable for deformation review.

## Required FBX exports

Place these files in `art/characters/exports/`:

```text
pale-entity-skeletal.fbx
pale-entity-walk.fbx
pale-entity-run.fbx
pale-entity-crouch.fbx
pale-entity-arm-bend.fbx
```

The importer also accepts the aliases listed near the top of
`Automation/build_monster_qa.py`. Each animation FBX must contain exactly one
take and use the same bone names and hierarchy as the base skeletal FBX.

To verify the installed Unreal Python API without importing or modifying any
content, run:

```bash
"/Users/Shared/Epic Games/UE_5.7/Engine/Binaries/Mac/UnrealEditor-Cmd" \
  "$(pwd)/art/characters/unreal/MonsterQA/MonsterQA.uproject" \
  -ExecutePythonScript="$(pwd)/art/characters/unreal/Automation/preflight_unreal_api.py" \
  -NullRHI -unattended -NoSplash -NoSound -stdout -FullStdOutLogOutput
```

## Build/import command

From the repository root on the current Mac:

```bash
bash art/characters/unreal/Automation/build_qa.sh
```

The script targets this installed executable by default:

```text
/Users/Shared/Epic Games/UE_5.7/Engine/Binaries/Mac/UnrealEditor-Cmd
```

Set `UE57_CMD` to use another Unreal 5.7 installation. Set
`MONSTER_QA_EXPORT_DIR` to use a different absolute FBX directory.

The build is destructive only under `/Game/MonsterQA`. It imports the assets,
asserts that there is one skeletal mesh and skeleton, asserts a minimum 15-bone
humanoid rig, verifies every animation targets that skeleton, checks duration and
animated-bone-track counts, then saves the map and sequences. A successful run
writes `art/characters/unreal/qa-validation.json`, including SHA-256 hashes of all
five FBX inputs.

## Offscreen PNG render command

After a successful build:

```bash
bash art/characters/unreal/Automation/render_all.sh
```

The renderer uses Unreal's Movie Render Queue through a project-local Python
executor and writes to `art/characters/unreal/renders/`. Defaults are 1024×1024,
eight spatial samples, no motion blur, and PNG output. Override the destination
or resolution when needed:

```bash
MONSTER_QA_OUTPUT_DIR=/absolute/output/path \
MONSTER_QA_RESOLUTION=2048x2048 \
bash art/characters/unreal/Automation/render_all.sh
```

After all seven renders finish, `Automation/validate_renders.py` verifies every
PNG signature and pixel dimension, requires at least one frame for each static
inspection and at least two for each deformation sequence, then writes
`renders/render-validation.json`.

The exact single-sequence command used by the wrapper is:

```bash
"/Users/Shared/Epic Games/UE_5.7/Engine/Binaries/Mac/UnrealEditor-Cmd" \
  "art/characters/unreal/MonsterQA/MonsterQA.uproject" \
  /Game/MonsterQA/Maps/L_MonsterQA \
  -game \
  -RenderOffscreen \
  -MoviePipelineLocalExecutorClass=/Script/MovieRenderPipelineCore.MoviePipelinePythonHostExecutor \
  -ExecutorPythonClass=/Engine/PythonTypes.MonsterQARenderExecutor \
  -LevelSequence=/Game/MonsterQA/Sequences/LS_QA_Front.LS_QA_Front \
  -MonsterQAOutput="$(pwd)/art/characters/unreal/renders" \
  -MonsterQAResolution=1024x1024 \
  -unattended -NoSplash -NoSound -NoScreenMessages \
  -stdout -FullStdOutLogOutput
```

Do not treat a successful import alone as visual approval. Review the front,
side, and three-quarter stills at full resolution, then scrub every Walk, Run,
Crouch, and ArmBend PNG sequence for shoulder collapse, elbow candy-wrapping,
hip volume loss, knee inversion, foot sliding, and interpenetration.
