"""Validate the MonsterQA Movie Render Queue PNG deliverables."""

from __future__ import annotations

import json
from pathlib import Path
import re
import struct
import sys


EXPECTED_MINIMUM_FRAMES = {
    "LS_QA_Front": 1,
    "LS_QA_Side": 1,
    "LS_QA_ThreeQuarter": 1,
    "LS_QA_Walk": 2,
    "LS_QA_Run": 2,
    "LS_QA_Crouch": 2,
    "LS_QA_ArmBend": 2,
}


def png_dimensions(path):
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError("Not a valid PNG header: {}".format(path))
    if header[12:16] != b"IHDR":
        raise RuntimeError("PNG does not begin with an IHDR chunk: {}".format(path))
    return struct.unpack(">II", header[16:24])


def parse_resolution(value):
    match = re.fullmatch(r"(\d+)[xX](\d+)", value)
    if not match:
        raise RuntimeError("Resolution must look like 1024x1024")
    return int(match.group(1)), int(match.group(2))


def validate(output_root, resolution):
    output_root = output_root.resolve()
    if not output_root.is_dir():
        raise RuntimeError("Render output directory does not exist: {}".format(output_root))

    report = {
        "schema_version": 1,
        "status": "passed",
        "output_directory": str(output_root),
        "resolution": list(resolution),
        "sequences": {},
    }
    for sequence_name, minimum_count in EXPECTED_MINIMUM_FRAMES.items():
        sequence_directory = output_root / sequence_name
        frames = sorted(sequence_directory.glob("*.png"))
        if len(frames) < minimum_count:
            raise RuntimeError(
                "{} contains {} PNG frame(s); expected at least {}".format(
                    sequence_directory, len(frames), minimum_count
                )
            )
        for frame in frames:
            actual_resolution = png_dimensions(frame)
            if actual_resolution != resolution:
                raise RuntimeError(
                    "{} is {}x{}; expected {}x{}".format(
                        frame,
                        actual_resolution[0],
                        actual_resolution[1],
                        resolution[0],
                        resolution[1],
                    )
                )
        report["sequences"][sequence_name] = {
            "frame_count": len(frames),
            "first_frame": frames[0].name,
            "last_frame": frames[-1].name,
        }

    report_path = output_root / "render-validation.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report_path


def main(argv):
    if len(argv) != 3:
        raise SystemExit("usage: validate_renders.py OUTPUT_DIRECTORY WIDTHxHEIGHT")
    report_path = validate(Path(argv[1]), parse_resolution(argv[2]))
    print("MonsterQA render validation passed: {}".format(report_path))


if __name__ == "__main__":
    main(sys.argv)
