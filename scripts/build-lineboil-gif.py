#!/usr/bin/env python3
"""Create a transparent, gently line-boiled GIF from a logo image."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image


def load_frames(source: Path) -> list[Image.Image]:
    image = Image.open(source)
    frames = []
    for frame_index in range(getattr(image, "n_frames", 1)):
        image.seek(frame_index)
        frames.append(image.convert("RGBA").copy())
    return frames


def padded(frame: Image.Image, amount: int) -> Image.Image:
    if amount <= 0:
        return frame
    width, height = frame.size
    content = frame.resize(
        (max(1, width - amount * 2), max(1, height - amount * 2)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    canvas.alpha_composite(content, (amount, amount))
    return canvas


def displace(frame: Image.Image, phase: float, amplitude: float) -> Image.Image:
    width, height = frame.size
    cell = 8

    def source_point(x: float, y: float) -> tuple[float, float]:
        dx = amplitude * (
            0.68 * math.sin(y * 0.105 + phase) * math.cos(x * 0.043 - phase * 0.35)
            + 0.32 * math.sin((x + y) * 0.072 - phase * 0.7)
        )
        dy = amplitude * (
            0.68 * math.sin(x * 0.098 - phase * 0.82) * math.cos(y * 0.047 + phase * 0.3)
            + 0.32 * math.sin((x - y) * 0.069 + phase * 0.6)
        )
        return x + dx, y + dy

    mesh = []
    for top in range(0, height, cell):
        for left in range(0, width, cell):
            right = min(width, left + cell)
            bottom = min(height, top + cell)
            quad = (
                *source_point(left, top),
                *source_point(right, top),
                *source_point(right, bottom),
                *source_point(left, bottom),
            )
            mesh.append(((left, top, right, bottom), quad))

    return frame.transform(
        frame.size,
        Image.Transform.MESH,
        mesh,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )


def make_palette(frames: list[Image.Image]) -> Image.Image:
    width, height = frames[0].size
    contact_sheet = Image.new("RGB", (width, height * len(frames)), (0, 0, 0))
    for index, frame in enumerate(frames):
        contact_sheet.paste(frame.convert("RGB"), (0, index * height))
    return contact_sheet.quantize(colors=255, method=Image.Quantize.MEDIANCUT)


def encode_gif(frames: list[Image.Image], output: Path, duration: int) -> None:
    palette = make_palette(frames)
    palette_frames = []
    for frame in frames:
        indexed = frame.convert("RGB").quantize(
            palette=palette,
            dither=Image.Dither.FLOYDSTEINBERG,
        )
        transparent = frame.getchannel("A").point(lambda alpha: 255 if alpha < 128 else 0)
        indexed.paste(255, mask=transparent)
        indexed.info["transparency"] = 255
        palette_frames.append(indexed)

    output.parent.mkdir(parents=True, exist_ok=True)
    palette_frames[0].save(
        output,
        save_all=True,
        append_images=palette_frames[1:],
        duration=duration,
        loop=0,
        disposal=2,
        transparency=255,
        optimize=False,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="transparent logo or GIF source")
    parser.add_argument("output", type=Path, help="destination animated GIF")
    parser.add_argument("--frames", type=int, default=12)
    parser.add_argument("--duration", type=int, default=140, help="milliseconds per frame")
    parser.add_argument("--padding", type=int, default=3, help="transparent edge safety in pixels")
    parser.add_argument("--amplitude", type=float, default=2.0, help="maximum contour displacement")
    args = parser.parse_args()

    if args.frames < 2 or args.duration < 20 or args.padding < 0 or args.amplitude < 0:
        parser.error("frames must be >= 2, duration >= 20, and padding/amplitude >= 0")

    source_frames = load_frames(args.source)
    if not source_frames:
        parser.error("source image contains no frames")

    bases = [padded(frame, args.padding) for frame in source_frames]
    frames = []
    for index in range(args.frames):
        source_index = min(len(bases) - 1, index * len(bases) // args.frames)
        phase = 2 * math.pi * index / args.frames
        frames.append(displace(bases[source_index], phase, args.amplitude))

    encode_gif(frames, args.output, args.duration)
    print(f"wrote {args.output} ({args.frames} frames, {args.duration} ms/frame)")


if __name__ == "__main__":
    main()
