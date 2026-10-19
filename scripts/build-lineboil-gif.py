#!/usr/bin/env python3
"""Create a transparent, line-boiled GIF from a logo image."""

from __future__ import annotations

import argparse
import math
import random
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
                *source_point(left, bottom),
                *source_point(right, bottom),
                *source_point(right, top),
            )
            mesh.append(((left, top, right, bottom), quad))

    return frame.transform(
        frame.size,
        Image.Transform.MESH,
        mesh,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )


def smooth_grid(values: list[float], columns: int, rows: int) -> list[float]:
    """Soften random control points just enough to make irregular drawn contours."""
    softened = []
    for y in range(rows):
        for x in range(columns):
            total = values[y * columns + x] * 4
            weight = 4
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < columns and 0 <= ny < rows:
                    total += values[ny * columns + nx]
                    weight += 1
            softened.append(total / weight)

    scale = max((abs(value) for value in softened), default=1) or 1
    return [value / scale for value in softened]


def choppy_displace(
    frame: Image.Image,
    frame_index: int,
    frame_count: int,
    amplitude: float,
    cell: int,
) -> Image.Image:
    """Periodic, coarse-grained contour wobble for the site's hand-boiled logos.

    Integer temporal harmonics make the deformation genuinely cyclic: the final
    frame-to-first-frame step is the same kind of step as any other in the loop.
    Higher harmonics add the quick, frame-by-frame redraw quality of the platform
    marks without turning the logo into a smooth rubbery warp.
    """
    width, height = frame.size
    xs = list(range(0, width, cell)) + [width]
    ys = list(range(0, height, cell)) + [height]
    columns, rows = len(xs), len(ys)
    harmonics = (1, 2, 3, 5)
    weights = (0.40, 0.29, 0.19, 0.12)
    seed = 0xA17 + width * 17 + height * 31 + cell * 131

    fields: list[list[list[float]]] = []
    phases: list[list[float]] = []
    for axis in range(2):
        axis_fields = []
        axis_phases = []
        for harmonic in harmonics:
            rng = random.Random(seed + axis * 1009 + harmonic * 7919)
            points = [rng.uniform(-1, 1) for _ in range(columns * rows)]
            axis_fields.append(smooth_grid(points, columns, rows))
            axis_phases.append(rng.uniform(0, 2 * math.pi))
        fields.append(axis_fields)
        phases.append(axis_phases)

    loop_phase = 2 * math.pi * frame_index / frame_count

    def offset(axis: int, node: int) -> float:
        return amplitude * sum(
            weight
            * fields[axis][component][node]
            * math.sin(harmonic * loop_phase + phases[axis][component])
            for component, (harmonic, weight) in enumerate(zip(harmonics, weights))
        )

    mesh = []
    for y_index, top in enumerate(ys[:-1]):
        for x_index, left in enumerate(xs[:-1]):
            right, bottom = xs[x_index + 1], ys[y_index + 1]
            top_left = y_index * columns + x_index
            bottom_left = (y_index + 1) * columns + x_index
            bottom_right = bottom_left + 1
            top_right = top_left + 1
            quad = (
                left + offset(0, top_left),
                top + offset(1, top_left),
                left + offset(0, bottom_left),
                bottom + offset(1, bottom_left),
                right + offset(0, bottom_right),
                bottom + offset(1, bottom_right),
                right + offset(0, top_right),
                top + offset(1, top_right),
            )
            mesh.append(((left, top, right, bottom), quad))

    return frame.transform(
        frame.size,
        Image.Transform.MESH,
        mesh,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )


def make_palette(frames: list[Image.Image], colors: int) -> Image.Image:
    width, height = frames[0].size
    contact_sheet = Image.new("RGB", (width, height * len(frames)), (0, 0, 0))
    for index, frame in enumerate(frames):
        contact_sheet.paste(frame.convert("RGB"), (0, index * height))
    return contact_sheet.quantize(colors=colors, method=Image.Quantize.MEDIANCUT)


def encode_gif(
    frames: list[Image.Image],
    output: Path,
    duration: int,
    colors: int = 255,
    dither: Image.Dither = Image.Dither.FLOYDSTEINBERG,
) -> None:
    palette = make_palette(frames, colors)
    palette_frames = []
    for frame in frames:
        indexed = frame.convert("RGB").quantize(
            palette=palette,
            dither=dither,
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
    parser.add_argument(
        "--style",
        choices=("soft", "choppy"),
        default="soft",
        help="soft sine warp (legacy) or periodic hand-boiled contour motion",
    )
    parser.add_argument("--cell-size", type=int, default=5, help="control-point spacing for choppy style")
    parser.add_argument("--palette-colors", type=int, default=255, help="maximum opaque palette colors (2-255)")
    parser.add_argument(
        "--dither",
        choices=("floyd-steinberg", "none"),
        default="floyd-steinberg",
        help="palette edge treatment; none keeps flat-color logo edges crisp",
    )
    args = parser.parse_args()

    if (
        args.frames < 2
        or args.duration < 20
        or args.padding < 0
        or args.amplitude < 0
        or args.cell_size < 2
        or not 2 <= args.palette_colors <= 255
    ):
        parser.error("frames >= 2, duration >= 20, padding/amplitude >= 0, cell-size >= 2, and palette-colors 2-255 required")

    source_frames = load_frames(args.source)
    if not source_frames:
        parser.error("source image contains no frames")

    bases = [padded(frame, args.padding) for frame in source_frames]
    frames = []
    for index in range(args.frames):
        source_index = min(len(bases) - 1, index * len(bases) // args.frames)
        if args.style == "choppy":
            frames.append(choppy_displace(bases[source_index], index, args.frames, args.amplitude, args.cell_size))
        else:
            phase = 2 * math.pi * index / args.frames
            frames.append(displace(bases[source_index], phase, args.amplitude))

    dither = Image.Dither.NONE if args.dither == "none" else Image.Dither.FLOYDSTEINBERG
    encode_gif(frames, args.output, args.duration, args.palette_colors, dither)
    print(f"wrote {args.output} ({args.frames} frames, {args.duration} ms/frame)")


if __name__ == "__main__":
    main()
