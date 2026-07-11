#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNREAL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT="$UNREAL_DIR/MonsterQA/MonsterQA.uproject"
OUTPUT_DIR="${MONSTER_QA_OUTPUT_DIR:-$UNREAL_DIR/renders}"
RESOLUTION="${MONSTER_QA_RESOLUTION:-1024x1024}"
UE_CMD="${UE57_CMD:-/Users/Shared/Epic Games/UE_5.7/Engine/Binaries/Mac/UnrealEditor-Cmd}"

if [[ ! -x "$UE_CMD" ]]; then
  echo "UnrealEditor-Cmd was not found at: $UE_CMD" >&2
  echo "Set UE57_CMD to the Unreal Engine 5.7 command-line editor." >&2
  exit 2
fi

mkdir -p "$OUTPUT_DIR"

shots=(Front Side ThreeQuarter Walk Run Crouch ArmBend)
for shot in "${shots[@]}"; do
  sequence="/Game/MonsterQA/Sequences/LS_QA_${shot}.LS_QA_${shot}"
  echo "Rendering $shot -> $OUTPUT_DIR"
  "$UE_CMD" "$PROJECT" /Game/MonsterQA/Maps/L_MonsterQA \
    -game \
    -RenderOffscreen \
    -MoviePipelineLocalExecutorClass=/Script/MovieRenderPipelineCore.MoviePipelinePythonHostExecutor \
    -ExecutorPythonClass=/Engine/PythonTypes.MonsterQARenderExecutor \
    -LevelSequence="$sequence" \
    -MonsterQAOutput="$OUTPUT_DIR" \
    -MonsterQAResolution="$RESOLUTION" \
    -unattended \
    -NoSplash \
    -NoSound \
    -NoScreenMessages \
    -stdout \
    -FullStdOutLogOutput
done

python3 "$SCRIPT_DIR/validate_renders.py" "$OUTPUT_DIR" "$RESOLUTION"
echo "MonsterQA PNG output: $OUTPUT_DIR"
