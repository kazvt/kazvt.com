#!/usr/bin/env python3
"""Build the site's compact, animated 88x31 button stash.

Each button uses a cropped top-square from a source GIF, a tiled site pattern,
and a two-frame, per-glyph rotation loop. Two source-image poses are sampled so
the imported GIF remains visibly animated without making these tiny buttons heavy.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_NAME = "A63ZVV3WMHLC44RPEWZ6QZ3COKQ3ZI4C.gif"
BUTTONS = [
    ("BOOBS", "boobs.gif", "purple.gif"),
    ("TITTIES", "titties.gif", "chrome.gif"),
    ("BREASTS", "breasts.gif", "pink.gif"),
    ("OPPAI", "oppai.gif", "blue.gif"),
    ("TITS", "tits.gif", "green.gif"),
    ("BOOBIES", "boobies.gif", "orange.gif"),
    ("HONKERS", "honkers.gif", "sand.gif"),
]
WINDOWS_BOLD_FONTS = [
    "arialbd.ttf",
    "ARLRDBD.TTF",
    "comicbd.ttf",
    "courbd.ttf",
    "D-DIN-Bold.otf",
    "D-DINCondensed-Bold.otf",
    "DUBAI-BOLD.TTF",
    "ERASBD.TTF",
    "GARABD.TTF",
    "Lato-Bold.ttf",
    "Roboto-Bold.ttf",
    "tahomabd.ttf",
    "trebucbd.ttf",
]
INK = (16, 9, 24, 255)
GLYPH_COLORS = [
    (255, 248, 220, 255),
    (255, 232, 100, 255),
    (255, 177, 222, 255),
    (153, 255, 242, 255),
    (255, 255, 255, 255),
    (255, 153, 104, 255),
]
SCALE = 4
WIDTH = 88
HEIGHT = 31


def load_font_paths(font_dir: Path | None) -> list[Path]:
    if font_dir is None:
        windows_fonts = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
        if windows_fonts.is_dir():
            preferred = [windows_fonts / name for name in WINDOWS_BOLD_FONTS]
            candidates = [path for path in preferred if path.is_file()]
            if candidates:
                return candidates
        font_dir = ROOT / "zzz_assets" / "fonts"

    preferred = [font_dir / name for name in WINDOWS_BOLD_FONTS]
    bold_candidates = [path for path in preferred if path.is_file()]
    if bold_candidates:
        return bold_candidates

    candidates = sorted(
        [*font_dir.glob("*.ttf"), *font_dir.glob("*.otf"), *font_dir.glob("*.TTF"), *font_dir.glob("*.OTF")],
        key=lambda path: path.name.casefold(),
    )
    if not candidates:
        raise FileNotFoundError(f"No TTF/OTF fonts found in {font_dir}")
    return candidates


def source_crops(path: Path) -> list[Image.Image]:
    frames: list[Image.Image] = []
    with Image.open(path) as source:
        for index in range(getattr(source, "n_frames", 1)):
            source.seek(index)
            frame = source.convert("RGBA")
            width, height = frame.size
            top_height = max(1, round(height * 0.70))
            # Keep the full top 70% and center it in a square without stretching
            # or trimming the lower edge of that crop.
            top_crop = frame.crop((0, 0, width, top_height))
            side = max(width, top_height)
            square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            square.alpha_composite(top_crop, ((side - width) // 2, 0))
            frames.append(square.resize((24 * SCALE, 24 * SCALE), Image.Resampling.LANCZOS))
    if not frames:
        raise ValueError(f"Source image contains no frames: {path}")
    return frames


def load_pattern(path: Path) -> Image.Image:
    with Image.open(path) as source:
        source.seek(0)
        tile = source.convert("RGB").resize((32 * SCALE, 32 * SCALE), Image.Resampling.LANCZOS)
    return tile.convert("RGBA")


def glyph_sprite(character: str, font_path: Path, size: int, color: tuple[int, int, int, int]) -> Image.Image:
    font = ImageFont.truetype(str(font_path), size * SCALE)
    stroke = max(2, SCALE)
    bounds = font.getbbox(character, stroke_width=stroke)
    pad = 2 * SCALE
    sprite = Image.new(
        "RGBA",
        (max(1, bounds[2] - bounds[0] + 2 * pad), max(1, bounds[3] - bounds[1] + 2 * pad)),
        (0, 0, 0, 0),
    )
    draw = ImageDraw.Draw(sprite)
    draw.text(
        (pad - bounds[0], pad - bounds[1]),
        character,
        font=font,
        fill=color,
        stroke_width=stroke,
        stroke_fill=INK,
    )
    ink_bounds = sprite.getchannel("A").getbbox()
    return sprite.crop(ink_bounds) if ink_bounds else sprite


def seeded_random(label: str) -> random.Random:
    seed = int.from_bytes(hashlib.sha256(label.encode("ascii")).digest()[:8], "big")
    return random.Random(seed)


def prepare_glyphs(label: str, fonts: list[Path]) -> list[tuple[tuple[Image.Image, Image.Image], int, int]]:
    rng = seeded_random(label)
    prepared = []
    for character in label:
        font_path = rng.choice(fonts)
        size = rng.choice((10, 11, 12))
        sprite = glyph_sprite(character, font_path, size, rng.choice(GLYPH_COLORS))
        angles = rng.choice(((45, -30), (30, -45)))
        poses = tuple(sprite.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True) for angle in angles)
        prepared.append((poses, max(pose.width for pose in poses), max(pose.height for pose in poses)))
    return prepared


def background(pattern: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH * SCALE, HEIGHT * SCALE), (0, 0, 0, 255))
    for y in range(0, canvas.height, pattern.height):
        for x in range(0, canvas.width, pattern.width):
            canvas.alpha_composite(pattern, (x, y))
    return canvas


def render_frame(pattern: Image.Image, icon: Image.Image, glyphs, pose_index: int) -> Image.Image:
    canvas = background(pattern)
    draw = ImageDraw.Draw(canvas)
    # Tiny double-line bevel, echoing the site's old-web panels.
    draw.rectangle((0, 0, WIDTH * SCALE - 1, HEIGHT * SCALE - 1), outline=INK, width=SCALE)
    draw.rectangle((SCALE, SCALE, (WIDTH - 2) * SCALE, (HEIGHT - 2) * SCALE), outline=(255, 245, 216, 235), width=SCALE)
    draw.rectangle((SCALE, 2 * SCALE, 26 * SCALE, 28 * SCALE), outline=INK, width=SCALE)
    draw.rectangle((2 * SCALE, 3 * SCALE, 25 * SCALE, 27 * SCALE), outline=(255, 245, 216, 245), width=max(2, SCALE // 2))
    canvas.alpha_composite(icon, (2 * SCALE, 3 * SCALE))
    draw.line((28 * SCALE, 4 * SCALE, 28 * SCALE, 27 * SCALE), fill=INK, width=SCALE)

    left = 30 * SCALE
    right = 86 * SCALE
    gap = SCALE // 3
    widths = [item[1] for item in glyphs]
    natural_width = sum(widths) + gap * (len(glyphs) - 1)
    fit = min(1.0, (right - left) / max(1, natural_width))
    advance = natural_width * fit
    cursor = left + ((right - left) - advance) / 2
    center_y = HEIGHT * SCALE / 2

    for poses, _, _ in glyphs:
        sprite = poses[pose_index]
        width = max(1, round(sprite.width * fit))
        height = max(1, round(sprite.height * fit))
        if sprite.size != (width, height):
            sprite = sprite.resize((width, height), Image.Resampling.LANCZOS)
        x = round(cursor + (max(poses[0].width, poses[1].width) * fit - width) / 2)
        y = round(center_y - height / 2)
        canvas.alpha_composite(sprite, (x, y))
        cursor += max(poses[0].width, poses[1].width) * fit + gap * fit

    return canvas.convert("RGB")


def save_gif(frames: list[Image.Image], durations: list[int], output: Path) -> None:
    sheet = Image.new("RGB", (WIDTH, HEIGHT * len(frames)), (0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (0, index * HEIGHT))
    # A compact shared palette plus frame-delta optimization keeps these tiny
    # buttons from carrying repeated full-frame image data.
    palette = sheet.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    encoded = [
        frame.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG)
        for frame in frames
    ]
    output.parent.mkdir(parents=True, exist_ok=True)
    encoded[0].save(
        output,
        save_all=True,
        append_images=encoded[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "zzz_assets" / "buttons" / "_originals" / SOURCE_NAME)
    parser.add_argument("--patterns", type=Path, default=ROOT / "reward" / "patterns")
    parser.add_argument("--fonts", type=Path, default=None, help="bold font directory; defaults to available Windows bold fonts")
    parser.add_argument("--output", type=Path, default=ROOT / "zzz_assets" / "buttons" / "_generated")
    args = parser.parse_args()

    if not args.source.is_file():
        parser.error(f"source GIF not found: {args.source}")
    fonts = load_font_paths(args.fonts)
    icon_frames = source_crops(args.source)
    total = 0

    for label, filename, pattern_name in BUTTONS:
        pattern_path = args.patterns / pattern_name
        if not pattern_path.is_file():
            parser.error(f"pattern GIF not found: {pattern_path}")
        pattern = load_pattern(pattern_path)
        glyphs = prepare_glyphs(label, fonts)
        second_icon_index = 0 if len(icon_frames) == 1 else len(icon_frames) // 2
        icon_indices = [0, second_icon_index]
        frames = [
            render_frame(pattern, icon_frames[icon_index], glyphs, pose_index)
            for pose_index, icon_index in enumerate(icon_indices)
        ]
        durations = [250] * len(frames)
        output = args.output / filename
        save_gif(frames, durations, output)
        total += 1
        print(f"{output} | {label} | {pattern_name} | {len(frames)} frames | {sum(durations)} ms/loop")

    print(f"Built {total} buttons at {args.output}")


if __name__ == "__main__":
    main()
