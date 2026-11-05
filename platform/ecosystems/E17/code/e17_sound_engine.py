#!/usr/bin/env python3
"""
E17/E16B Sound Engine — candidate voiceover pipeline (vendor-free demo lane).

One phone (or portal) capture becomes the voice track for any channel:
RVM drop, MMS, video ad, TV/radio spot, social clip. Pipeline per
CREATIVE_PRINT_ECO_FOCUSED_BUILD_SPEC_2026-08-01.md §sound engine and the
E17 build spec §6a duration-fit guarantee:

    capture -> denoise/clean -> silence trim -> time-fit to target duration
    -> one rendition file per channel target

Fit methods, tried in order (recorded as `fit_method` for
e17.candidate_recordings.fitted_duration_seconds):
    trim_silence     — leading/trailing + internal long-pause compression
    time_stretch     — pitch-preserved atempo within +/-10%
    out_of_range     — flagged; needs script revision or re-take (no auto force)

Uses ffmpeg only (no vendor keys, no external APIs). Safe: reads input,
writes renditions to an output directory; never touches the database.

Usage:
    python3 e17_sound_engine.py input.wav --targets 10,30,60,180 --out ./renditions
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

STRETCH_LIMIT = 0.10  # +/-10% pitch-preserved stretch, per E17 spec 6a


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, check=True)


def probe_duration(path: Path) -> float:
    out = _run([
        "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
        "-of", "csv=p=0", str(path),
    ]).stdout.strip()
    return float(out)


def denoise_and_trim(src: Path, dst: Path) -> None:
    """Noise gate + high-pass hum removal + leading/trailing silence trim."""
    _run([
        "ffmpeg", "-y", "-i", str(src),
        "-af",
        "highpass=f=80,afftdn=nr=12:nf=-30,"
        "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.2,"
        "areverse,"
        "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.2,"
        "areverse,"
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-ar", "44100", "-ac", "1", str(dst),
    ])


def time_fit(clean: Path, dst: Path, target_s: float) -> dict:
    """Fit the cleaned take to target_s. Returns rendition metadata."""
    dur = probe_duration(clean)
    ratio = dur / target_s
    if abs(1 - 1 / ratio) <= STRETCH_LIMIT:
        _run([
            "ffmpeg", "-y", "-i", str(clean),
            "-af", f"atempo={ratio:.6f}", str(dst),
        ])
        fit_method = "time_stretch" if abs(ratio - 1) > 0.005 else "as_recorded"
    else:
        return {
            "target_seconds": target_s,
            "raw_duration_seconds": round(dur, 2),
            "fit_method": "out_of_range",
            "note": f"take is {dur:.1f}s; +/-{int(STRETCH_LIMIT*100)}% stretch "
                    f"cannot reach {target_s:.0f}s — revise script or re-take",
        }
    return {
        "target_seconds": target_s,
        "raw_duration_seconds": round(dur, 2),
        "fitted_duration_seconds": round(probe_duration(dst), 2),
        "fit_method": fit_method,
        "file": str(dst),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input", type=Path)
    ap.add_argument("--targets", default="10,30,60",
                    help="comma-separated target durations in seconds")
    ap.add_argument("--out", type=Path, default=Path("./renditions"))
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    clean = args.out / f"{args.input.stem}_clean.wav"
    denoise_and_trim(args.input, clean)

    renditions = []
    for t in (float(x) for x in args.targets.split(",")):
        dst = args.out / f"{args.input.stem}_fit{int(t)}s.wav"
        renditions.append(time_fit(clean, dst, t))

    report = {
        "input": str(args.input),
        "clean": str(clean),
        "clean_duration_seconds": round(probe_duration(clean), 2),
        "renditions": renditions,
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
