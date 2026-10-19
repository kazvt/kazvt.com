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


def smooth_grid(
    values: list[float], columns: int, rows: int, passes: int = 1
) -> list[float]:
    """Smooth control points into broad, continuous displacement fields."""
    softened = values
    for _ in range(passes):
        next_values = []
        for y in range(rows):
            for x in range(columns):
                total = softened[y * columns + x] * 4
                weight = 4
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < columns and 0 <= ny < rows:
                        total += softened[ny * columns + nx]
                        weight += 1
                next_values.append(total / weight)
        softened = next_values

    scale = max((abs(value) for value in softened), default=1) or 1
    return [value / scale for value in softened]


def scatter_displace(
    frame: Image.Image,
    frame_index: int,
    amplitude: float,
    cell: int,
) -> Image.Image:
    """Redraw each frame from a separate, deterministic random contour field.

    There is deliberately no time-based interpolation or periodic wave here:
    every frame gets a far-separated seed, so the outline jumps to a fresh,
    broad hand-drawn variation instead of rippling around the fox.
    """
    width, height = frame.size
    xs = list(range(0, width, cell)) + [width]
    ys = list(range(0, height, cell)) + [height]
    columns, rows = len(xs), len(ys)
    seed_base = 0xA17 + width * 17 + height * 31 + cell * 131
    # Large odd strides keep successive frames in distant deterministic PRNG
    # streams; axis-specific strides keep horizontal and vertical fields apart.
    frame_seed = seed_base + (frame_index + 1) * 0x9E3779B1

    fields: list[list[float]] = []
    for axis in range(2):
        rng = random.Random(frame_seed + axis * 0x85EBCA77)
        points = [rng.uniform(-1, 1) for _ in range(columns * rows)]
        fields.append(smooth_grid(points, columns, rows, passes=1))

    def offset(axis: int, node: int) -> float:
        x = xs[node % columns]
        y = ys[node // columns]
        edge_fade = min(1.0, x / cell, (width - x) / cell, y / cell, (height - y) / cell)
        return amplitude * max(0.0, edge_fade) * fields[axis][node]

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
    source_harmonics = ((1, 0.40), (2, 0.29), (3, 0.19), (5, 0.12))
    max_harmonic = max(1, (frame_count - 1) // 2)
    if frame_count <= 6:
        # A single low-frequency cycle avoids temporal aliasing at tiny frame counts.
        active_harmonics = ((1, 1.0),)
    else:
        active_harmonics = tuple(
            (harmonic, weight)
            for harmonic, weight in source_harmonics
            if harmonic <= max_harmonic
        )
    weight_total = sum(weight for _, weight in active_harmonics)
    harmonics = tuple(harmonic for harmonic, _ in active_harmonics)
    weights = tuple(weight / weight_total for _, weight in active_harmonics)
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


def broad_displace(
    frame: Image.Image,
    frame_index: int,
    frame_count: int,
    amplitude: float,
    cell: int,
) -> Image.Image:
    """Make large, smooth, cyclic redraws with no fine-grained surface jitter.

    Wide mesh spacing and repeated field smoothing move whole contour regions
    together. Two low temporal harmonics keep the loop lively and frame-snappy
    while preserving the underlying silhouette and feature placement.
    """
    width, height = frame.size
    xs = list(range(0, width, cell)) + [width]
    ys = list(range(0, height, cell)) + [height]
    columns, rows = len(xs), len(ys)
    harmonics = (1, 2)
    weights = (0.74, 0.26)
    seed = 0xB04D + width * 19 + height * 37 + cell * 149

    fields: list[list[list[float]]] = []
    phases: list[list[float]] = []
    seam_midpoint = 2 * math.pi * (frame_count - 0.5) / frame_count
    seam_target = math.acos(0.74)
    for axis in range(2):
        axis_fields = []
        axis_phases = []
        for harmonic in harmonics:
            rng = random.Random(seed + axis * 1013 + harmonic * 7927)
            points = [rng.uniform(-1, 1) for _ in range(columns * rows)]
            axis_fields.append(smooth_grid(points, columns, rows, passes=3))
            # Put the loop seam on a typical redraw step, not at a motion peak.
            base_phase = seam_target - harmonic * seam_midpoint
            axis_phase_offset = -0.10 if axis == 0 else 0.10
            axis_phases.append((base_phase + axis_phase_offset) % (2 * math.pi))
        fields.append(axis_fields)
        phases.append(axis_phases)

    loop_phase = 2 * math.pi * frame_index / frame_count

    def offset(axis: int, node: int) -> float:
        x = xs[node % columns]
        y = ys[node // columns]
        edge_fade = min(1.0, x / cell, (width - x) / cell, y / cell, (height - y) / cell)
        return amplitude * max(0.0, edge_fade) * sum(
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
    parser.add_argument("--padding", type=int, default=None, help="transparent edge safety in pixels")
    parser.add_argument("--amplitude", type=float, default=None, help="maximum contour displacement")
    parser.add_argument(
        "--style",
        choices=("soft", "choppy", "broad", "scatter"),
        default="soft",
        help="soft warp, periodic choppy/broad line boil, or independently seeded scatter redraws",
    )
    parser.add_argument("--cell-size", type=int, default=None, help="control-point spacing for choppy/broad styles")
    parser.add_argument("--palette-colors", type=int, default=None, help="maximum opaque palette colors (2-255)")
    parser.add_argument(
        "--dither",
        choices=("floyd-steinberg", "none"),
        default=None,
        help="palette edge treatment; none keeps flat-color logo edges crisp",
    )
    args = parser.parse_args()

    broad_style = args.style in ("broad", "scatter")
    padding = args.padding if args.padding is not None else (7 if args.style == "scatter" else 6 if args.style == "broad" else 3)
    amplitude = args.amplitude if args.amplitude is not None else (9.0 if args.style == "scatter" else 10.0 if args.style == "broad" else 2.0)
    cell_size = args.cell_size if args.cell_size is not None else (24 if args.style == "scatter" else 28 if args.style == "broad" else 5)
    palette_colors = args.palette_colors if args.palette_colors is not None else (128 if args.style == "scatter" else 55 if args.style == "broad" else 255)
    dither_name = args.dither if args.dither is not None else ("none" if broad_style else "floyd-steinberg")

    if (
        args.frames < 2
        or args.duration < 20
        or padding < 0
        or amplitude < 0
        or cell_size < 2
        or not 2 <= palette_colors <= 255
    ):
        parser.error("frames >= 2, duration >= 20, padding/amplitude >= 0, cell-size >= 2, and palette-colors 2-255 required")

    source_frames = load_frames(args.source)
    if not source_frames:
        parser.error("source image contains no frames")

    bases = [padded(frame, padding) for frame in source_frames]
    frames = []
    for index in range(args.frames):
        source_index = min(len(bases) - 1, index * len(bases) // args.frames)
        if args.style == "choppy":
            frames.append(choppy_displace(bases[source_index], index, args.frames, amplitude, cell_size))
        elif args.style == "broad":
            frames.append(broad_displace(bases[source_index], index, args.frames, amplitude, cell_size))
        elif args.style == "scatter":
            frames.append(scatter_displace(bases[source_index], index, amplitude, cell_size))
        else:
            phase = 2 * math.pi * index / args.frames
            frames.append(displace(bases[source_index], phase, amplitude))

    dither = Image.Dither.NONE if dither_name == "none" else Image.Dither.FLOYDSTEINBERG
    encode_gif(frames, args.output, args.duration, palette_colors, dither)
    print(f"wrote {args.output} ({args.frames} frames, {args.duration} ms/frame)")


if __name__ == "__main__":
    main()
