#!/usr/bin/env python3
"""
Render a full song video by warping a short looping animation so chosen source-video
frames land on MIDI beat times.

Inputs expected in the working directory by default:
- video.mp4
- song1.mp3
- data.mid or data.midi

Example:
    python beat_sync_render.py --markers 0,30,60,90 --mode pendulum --output final.mp4

How it works:
- MIDI note-on events define the on-beats.
- You provide source-video marker frames that should land on those beats.
- Between consecutive beats, the source video time is interpolated between the
  corresponding marker frames using linear or eased motion.
- loop mode traverses markers as 1,2,3,4,1,2,3,4...
- pendulum mode traverses markers as 1,2,3,4,3,2,1,2,3,4...
- The source video is fully decoded once into RAM for fast random access.
- A new video is rendered for the full song duration and then muxed with the song.
"""

from __future__ import annotations

import argparse
import bisect
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import List, Sequence

import cv2
import numpy as np


# -----------------------------
# MIDI parsing
# -----------------------------

@dataclass
class TempoEvent:
    tick: int
    us_per_quarter: int


@dataclass
class NoteOnEvent:
    tick: int
    note: int
    velocity: int
    track: int
    time_sec: float


@dataclass
class MidiData:
    fmt: int
    ppq: int
    tempos: List[TempoEvent]
    notes: List[NoteOnEvent]


class MidiParseError(Exception):
    pass


class ByteReader:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.pos = 0

    def read(self, n: int) -> bytes:
        if self.pos + n > len(self.data):
            raise MidiParseError("Unexpected end of MIDI file")
        out = self.data[self.pos:self.pos + n]
        self.pos += n
        return out

    def read_u16(self) -> int:
        return int.from_bytes(self.read(2), "big")

    def read_u32(self) -> int:
        return int.from_bytes(self.read(4), "big")

    def read_var(self) -> int:
        result = 0
        while True:
            b = self.read(1)[0]
            result = (result << 7) | (b & 0x7F)
            if (b & 0x80) == 0:
                return result


def parse_midi_file(path: Path) -> MidiData:
    data = path.read_bytes()
    r = ByteReader(data)

    if r.read(4) != b"MThd":
        raise MidiParseError("Missing MThd header")

    header_len = r.read_u32()
    fmt = r.read_u16()
    n_tracks = r.read_u16()
    division = r.read_u16()

    if division & 0x8000:
        raise MidiParseError("SMPTE MIDI timing is not supported by this script")

    # Skip any remaining header bytes beyond the standard 6.
    if header_len > 6:
        r.read(header_len - 6)

    ppq = division
    tempos: List[TempoEvent] = [TempoEvent(tick=0, us_per_quarter=500_000)]
    note_rows: List[tuple[int, int, int, int]] = []

    for track_index in range(n_tracks):
        if r.read(4) != b"MTrk":
            raise MidiParseError("Missing MTrk chunk")
        track_len = r.read_u32()
        track_end = r.pos + track_len
        tick = 0
        running_status = 0

        while r.pos < track_end:
            delta = r.read_var()
            tick += delta

            status = r.read(1)[0]
            if status < 0x80:
                if running_status == 0:
                    raise MidiParseError("Running status encountered before any status byte")
                r.pos -= 1
                status = running_status
            else:
                running_status = status

            if status == 0xFF:
                meta_type = r.read(1)[0]
                length = r.read_var()
                payload = r.read(length)
                if meta_type == 0x51 and length == 3:
                    us_per_quarter = int.from_bytes(payload, "big")
                    tempos.append(TempoEvent(tick=tick, us_per_quarter=us_per_quarter))
            elif status in (0xF0, 0xF7):
                length = r.read_var()
                r.read(length)
            else:
                hi = status & 0xF0
                if hi in (0x80, 0x90, 0xA0, 0xB0, 0xE0):
                    d1 = r.read(1)[0]
                    d2 = r.read(1)[0]
                    if hi == 0x90 and d2 > 0:
                        note_rows.append((tick, d1, d2, track_index))
                elif hi in (0xC0, 0xD0):
                    r.read(1)
                else:
                    raise MidiParseError(f"Unknown MIDI status byte: 0x{status:02X}")

        r.pos = track_end

    tempos.sort(key=lambda x: x.tick)
    note_rows.sort(key=lambda x: x[0])

    def tick_to_seconds(target_tick: int) -> float:
        seconds = 0.0
        prev_tick = 0
        current_tempo = tempos[0].us_per_quarter
        for t in tempos[1:]:
            if t.tick >= target_tick:
                break
            dt = t.tick - prev_tick
            seconds += (dt / ppq) * (current_tempo / 1_000_000.0)
            prev_tick = t.tick
            current_tempo = t.us_per_quarter
        remaining = target_tick - prev_tick
        seconds += (remaining / ppq) * (current_tempo / 1_000_000.0)
        return seconds

    notes = [
        NoteOnEvent(
            tick=tick,
            note=note,
            velocity=vel,
            track=track,
            time_sec=tick_to_seconds(tick),
        )
        for tick, note, vel, track in note_rows
    ]

    return MidiData(fmt=fmt, ppq=ppq, tempos=tempos, notes=notes)


# -----------------------------
# Video / audio utils
# -----------------------------

@dataclass
class VideoData:
    frames: List[np.ndarray]
    fps: float
    width: int
    height: int
    duration: float


@dataclass
class MediaInfo:
    duration: float


@dataclass
class Interval:
    beat_a: float
    beat_b: float
    marker_a: float
    marker_b: float
    source_delta: float



def ffprobe_duration(path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        str(path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])



def load_video_frames(path: Path) -> VideoData:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 0:
        fps = 30.0

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    frames: List[np.ndarray] = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(frame)
    cap.release()

    if not frames:
        raise RuntimeError("No frames could be decoded from the source video")

    duration = len(frames) / fps
    return VideoData(frames=frames, fps=fps, width=width, height=height, duration=duration)


# -----------------------------
# Mapping helpers
# -----------------------------


def parse_markers(value: str) -> List[int]:
    markers = []
    for chunk in value.replace(" ", ",").split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        markers.append(int(chunk))
    if len(markers) < 2:
        raise ValueError("Provide at least two marker frames, e.g. --markers 0,30,60,90")
    return markers



def ease_value(name: str, t: float) -> float:
    x = max(0.0, min(1.0, t))
    if name == "linear":
        return x
    if name == "ease_in_out_sine":
        return -(math.cos(math.pi * x) - 1.0) / 2.0
    if name == "ease_in_out_cubic":
        if x < 0.5:
            return 4.0 * x * x * x
        return 1.0 - ((-2.0 * x + 2.0) ** 3) / 2.0
    raise ValueError(f"Unknown ease mode: {name}")



def marker_index_at(step: int, marker_count: int, mode: str) -> int:
    if marker_count <= 1:
        return 0

    if mode == "loop":
        return step % marker_count

    if mode == "pendulum":
        cycle = list(range(marker_count)) + list(range(marker_count - 2, 0, -1))
        return cycle[step % len(cycle)]

    raise ValueError(f"Unsupported mode: {mode}")



def median_spacing(values: Sequence[float]) -> float:
    if len(values) < 2:
        return 0.5
    diffs = [b - a for a, b in zip(values[:-1], values[1:]) if b > a]
    if not diffs:
        return 0.5
    diffs.sort()
    mid = len(diffs) // 2
    if len(diffs) % 2:
        return diffs[mid]
    return 0.5 * (diffs[mid - 1] + diffs[mid])



def extend_beats_to_duration(beats: List[float], total_duration: float) -> tuple[List[float], int]:
    """
    Returns (extended_beats, offset), where offset is the index in the extended beat list
    that corresponds to the original first beat.
    """
    if len(beats) < 2:
        raise ValueError("Need at least two MIDI note-on beats")

    base = sorted(float(x) for x in beats)
    step = median_spacing(base)
    if step <= 1e-9:
        step = 0.5

    extended = list(base)
    offset = 0

    while extended[0] > 0.0:
        extended.insert(0, extended[0] - step)
        offset += 1

    while extended[-1] < total_duration:
        extended.append(extended[-1] + step)

    if extended[0] < 0.0:
        # Keep one beat before zero if present; interval lookup handles it.
        pass
    else:
        extended.insert(0, extended[0] - step)
        offset += 1

    if extended[-1] <= total_duration:
        extended.append(extended[-1] + step)

    return extended, offset



def build_intervals(
    extended_beats: Sequence[float],
    offset: int,
    marker_times: Sequence[float],
    video_duration: float,
    mode: str,
) -> List[Interval]:
    intervals: List[Interval] = []
    for i in range(len(extended_beats) - 1):
        beat_a = extended_beats[i]
        beat_b = extended_beats[i + 1]
        if beat_b <= beat_a:
            continue

        rel_a = i - offset
        rel_b = i + 1 - offset
        idx_a = marker_index_at(rel_a, len(marker_times), mode)
        idx_b = marker_index_at(rel_b, len(marker_times), mode)
        marker_a = marker_times[idx_a]
        marker_b = marker_times[idx_b]

        if mode == "loop":
            source_delta = marker_b - marker_a
            if source_delta <= 0.0:
                source_delta += video_duration
        else:
            source_delta = marker_b - marker_a

        intervals.append(
            Interval(
                beat_a=beat_a,
                beat_b=beat_b,
                marker_a=marker_a,
                marker_b=marker_b,
                source_delta=source_delta,
            )
        )
    return intervals



def wrapped_time(t: float, duration: float) -> float:
    if duration <= 0:
        return 0.0
    return t % duration



def source_time_for_output_time(t: float, intervals: Sequence[Interval], ease_mode: str, video_duration: float) -> float:
    starts = [x.beat_a for x in intervals]
    idx = bisect.bisect_right(starts, t) - 1
    idx = max(0, min(idx, len(intervals) - 1))
    interval = intervals[idx]
    u = (t - interval.beat_a) / (interval.beat_b - interval.beat_a)
    u = max(0.0, min(1.0, u))
    e = ease_value(ease_mode, u)
    src = interval.marker_a + interval.source_delta * e
    return wrapped_time(src, video_duration) if video_duration > 0 else src


# -----------------------------
# Frame sampling / rendering
# -----------------------------


def sample_frame(frames: Sequence[np.ndarray], source_fps: float, source_time: float) -> np.ndarray:
    pos = source_time * source_fps
    i0 = int(math.floor(pos)) % len(frames)
    i1 = (i0 + 1) % len(frames)
    alpha = pos - math.floor(pos)

    if alpha < 1e-6:
        return frames[i0]

    f0 = frames[i0].astype(np.float32)
    f1 = frames[i1].astype(np.float32)
    mixed = cv2.addWeighted(f0, 1.0 - alpha, f1, alpha, 0.0)
    return mixed.astype(np.uint8)



def render_video_only(
    video: VideoData,
    audio_duration: float,
    intervals: Sequence[Interval],
    output_fps: float,
    ease_mode: str,
    temp_video_path: Path,
) -> None:
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(temp_video_path), fourcc, output_fps, (video.width, video.height))
    if not writer.isOpened():
        raise RuntimeError(f"Could not open temporary video for writing: {temp_video_path}")

    frame_count = max(1, int(round(audio_duration * output_fps)))
    print(f"Rendering {frame_count} frames at {output_fps:.3f} fps...")

    for n in range(frame_count):
        t = n / output_fps
        src_t = source_time_for_output_time(t, intervals, ease_mode, video.duration)
        frame = sample_frame(video.frames, video.fps, src_t)
        writer.write(frame)

        if n % max(1, int(output_fps)) == 0:
            pct = 100.0 * n / frame_count
            print(f"  {pct:6.2f}%  t={t:8.3f}s  src={src_t:7.3f}s", end="\r", flush=True)

    writer.release()
    print("\nVideo render complete.")



def mux_audio(temp_video_path: Path, audio_path: Path, output_path: Path, crf: int, preset: str) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(temp_video_path),
        "-i",
        str(audio_path),
        "-c:v",
        "libx264",
        "-preset",
        preset,
        "-crf",
        str(crf),
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        str(output_path),
    ]
    subprocess.run(cmd, check=True)


# -----------------------------
# Main CLI
# -----------------------------


def choose_midi(explicit: str | None) -> Path:
    if explicit:
        path = Path(explicit)
        if not path.exists():
            raise FileNotFoundError(path)
        return path
    for name in ("data.mid", "data.midi"):
        path = Path(name)
        if path.exists():
            return path
    raise FileNotFoundError("Could not find data.mid or data.midi")



def build_argument_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Render beat-synced loop/pendulum video from MIDI beat notes.")
    p.add_argument("--video", default="video.mp4", help="Input source video")
    p.add_argument("--audio", default="song1.mp3", help="Input audio file")
    p.add_argument("--midi", default=None, help="Input MIDI file; defaults to data.mid or data.midi")
    p.add_argument("--markers", required=True, help="Comma-separated source-video frame numbers, e.g. 0,30,60,90")
    p.add_argument("--mode", choices=["loop", "pendulum"], default="loop")
    p.add_argument("--ease", choices=["linear", "ease_in_out_sine", "ease_in_out_cubic"], default="ease_in_out_sine")
    p.add_argument("--beat-stride", type=int, default=1, help="Use every Nth MIDI note-on event")
    p.add_argument("--output-fps", type=float, default=None, help="Output fps; defaults to source video fps")
    p.add_argument("--output", default="output_synced.mp4", help="Final rendered mp4 path")
    p.add_argument("--crf", type=int, default=18, help="ffmpeg x264 CRF quality (lower = better)")
    p.add_argument("--preset", default="medium", help="ffmpeg x264 preset")
    p.add_argument("--dump-beats", action="store_true", help="Print parsed beat times and exit")
    return p



def main() -> int:
    args = build_argument_parser().parse_args()

    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        print("ffmpeg and ffprobe are required on PATH.", file=sys.stderr)
        return 2

    video_path = Path(args.video)
    audio_path = Path(args.audio)
    midi_path = choose_midi(args.midi)
    output_path = Path(args.output)

    if not video_path.exists():
        raise FileNotFoundError(video_path)
    if not audio_path.exists():
        raise FileNotFoundError(audio_path)

    markers = parse_markers(args.markers)

    print(f"Loading source video: {video_path}")
    video = load_video_frames(video_path)
    print(f"  {len(video.frames)} frames, {video.fps:.3f} fps, {video.width}x{video.height}, duration {video.duration:.3f}s")

    print(f"Reading MIDI: {midi_path}")
    midi = parse_midi_file(midi_path)
    beat_times = [n.time_sec for n in midi.notes]
    if args.beat_stride > 1:
        beat_times = [t for i, t in enumerate(beat_times) if i % args.beat_stride == 0]

    if len(beat_times) < 2:
        raise RuntimeError("MIDI must contain at least two note-on events after beat-stride filtering")

    if args.dump_beats:
        for i, t in enumerate(beat_times):
            print(f"{i:4d}  {t:10.6f}")
        return 0

    audio_duration = ffprobe_duration(audio_path)
    print(f"Audio duration: {audio_duration:.3f}s")

    marker_times = [m / video.fps for m in markers]
    if max(marker_times) > video.duration + 1e-6:
        raise RuntimeError(
            f"Marker frame {max(markers)} lies outside the source video. "
            f"Video has ~{len(video.frames)} frames at {video.fps:.3f} fps."
        )

    extended_beats, offset = extend_beats_to_duration(beat_times, audio_duration)
    intervals = build_intervals(extended_beats, offset, marker_times, video.duration, args.mode)
    output_fps = args.output_fps or video.fps

    print(f"Beat count from MIDI: {len(beat_times)}")
    print(f"Traversal mode: {args.mode}")
    print(f"Ease: {args.ease}")
    print(f"Marker frames: {markers}")
    print(f"Output fps: {output_fps:.3f}")

    with tempfile.TemporaryDirectory(prefix="beat_sync_render_") as td:
        temp_video_path = Path(td) / "video_only.mp4"
        render_video_only(
            video=video,
            audio_duration=audio_duration,
            intervals=intervals,
            output_fps=output_fps,
            ease_mode=args.ease,
            temp_video_path=temp_video_path,
        )

        print(f"Muxing audio into final file: {output_path}")
        mux_audio(temp_video_path, audio_path, output_path, args.crf, args.preset)

    print(f"Done: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
