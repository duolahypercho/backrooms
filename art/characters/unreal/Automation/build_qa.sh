#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNREAL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT="$UNREAL_DIR/MonsterQA/MonsterQA.uproject"
BUILD_SCRIPT="$SCRIPT_DIR/build_monster_qa.py"
EXPORT_DIR="${MONSTER_QA_EXPORT_DIR:-$UNREAL_DIR/../exports}"
UE_CMD="${UE57_CMD:-/Users/Shared/Epic Games/UE_5.7/Engine/Binaries/Mac/UnrealEditor-Cmd}"

if [[ ! -x "$UE_CMD" ]]; then
  echo "UnrealEditor-Cmd was not found at: $UE_CMD" >&2
  echo "Set UE57_CMD to the Unreal Engine 5.7 command-line editor." >&2
  exit 2
fi

if [[ ! -d "$EXPORT_DIR" ]]; then
  echo "FBX export directory was not found at: $EXPORT_DIR" >&2
  echo "Set MONSTER_QA_EXPORT_DIR or export the character FBXs first." >&2
  exit 2
fi

EXPORT_DIR="$(cd "$EXPORT_DIR" && pwd)"
export MONSTER_QA_EXPORT_DIR="$EXPORT_DIR"

"$UE_CMD" "$PROJECT" \
  -ExecutePythonScript="$BUILD_SCRIPT" \
  -unattended \
  -NoSplash \
  -NoSound \
  -NoScreenMessages \
  -stdout \
  -FullStdOutLogOutput
