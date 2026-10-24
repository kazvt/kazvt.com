#!/usr/bin/env python3
"""Render still Kick panel PNGs from the existing animated KT wordmark.

The supplied logo GIF remains the source for the exact letter faces. SVG draws
the trans-color extrusion, layered outlines, framing, and flag backdrop; Chromium
renders the SVGs at 4x before they are downsampled to Kick's 320 x 123 panel size.

Requires Pillow, Playwright with Chromium installed, and ffmpeg on PATH.
"""

from __future__ import annotations

import base64
import io
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "kt" / "assets"
FACE_GIF = ASSETS / "KT-LOGO-panel-320.gif"
FLAG_VIDEO = ASSETS / "trans-flag-pingpong-wide-soft-seam.mp4"
PNG_TRANSPARENT = ASSETS / "KT-LOGO-panel-static-320.png"
PNG_FLAG = ASSETS / "KT-LOGO-trans-flag-panel-static-320.png"
SVG_DIR = ASSETS / "panel-stills"
WIDTH, HEIGHT = 320, 123
SCALE = 0.79
INK = "#2b2028"
BLUE = "#5bcefa"
PINK = "#f5a9b8"
WHITE = "#ffffff"
OUTLINE_LAYERS = [
    ("ink", 12), ("blue", 9), ("pink", 7),
    ("white", 5), ("blue", 3), ("ink", 1.2),
]


def data_uri(image: Image.Image, image_format: str) -> str:
    stream = io.BytesIO()
    image.save(stream, format=image_format, optimize=True)
    encoded = base64.b64encode(stream.getvalue()).decode("ascii")
    mime = "image/png" if image_format == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{encoded}"


def extract_face() -> tuple[str, int, int]:
    with Image.open(FACE_GIF) as source:
        source.seek(0)
        face = source.convert("RGBA")
    bounds = face.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError(f"No visible logo pixels in {FACE_GIF}")
    face = face.crop(bounds)
    return data_uri(face, "PNG"), face.width, face.height


def extract_flag_backdrop() -> str:
    with tempfile.TemporaryDirectory(prefix="kt-panel-still-") as temp_dir:
        frame_path = Path(temp_dir) / "flag-frame.png"
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-ss", "2.2", "-i", str(FLAG_VIDEO),
                "-frames:v", "1", "-vf", "scale=960:-2", "-y",
                str(frame_path),
            ],
            check=True,
        )
        with Image.open(frame_path) as source:
            frame = ImageOps.fit(
                source.convert("RGB"),
                (640, 246),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
    return data_uri(frame, "JPEG")


def image_node(filter_id: str | None = None, dx: float = 0,
               dy: float = 0) -> str:
    filt = f' filter="url(#{filter_id})"' if filter_id else ""
    transform = f' transform="translate({dx:g} {dy:g})"' if dx or dy else ""
    return f'<use href="#logo-face"{transform}{filt}/>'


def filters() -> str:
    common = 'x="-28%" y="-38%" width="156%" height="176%" color-interpolation-filters="sRGB"'
    colors = {
        "ink": INK,
        "deep-blue": "#214c61",
        "blue": BLUE,
        "deep-pink": "#a95f77",
        "pink": PINK,
        "white": WHITE,
    }
    items = []
    for key, color in colors.items():
        items.append(
            f'<filter id="tint-{key}" {common}>'
            f'<feFlood flood-color="{color}" result="paint"/>'
            '<feComposite in="paint" in2="SourceAlpha" operator="in"/>'
            '</filter>'
        )

    for index, (key, radius) in enumerate(OUTLINE_LAYERS):
        items.append(
            f'<filter id="outline-{index}" {common}>'
            f'<feMorphology in="SourceAlpha" operator="dilate" radius="{radius}" result="spread"/>'
            f'<feFlood flood-color="{colors[key]}" result="paint"/>'
            '<feComposite in="paint" in2="spread" operator="in"/>'
            '</filter>'
        )
    items.append(
        f'<filter id="cast-shadow" {common}>'
        '<feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="spread"/>'
        '<feGaussianBlur in="spread" stdDeviation="2.6" result="blur"/>'
        '<feOffset in="blur" dx="2" dy="6" result="offset"/>'
        '<feFlood flood-color="#160f1b" flood-opacity="0.88" result="shade"/>'
        '<feComposite in="shade" in2="offset" operator="in"/>'
        '</filter>'
    )
    return "\n".join(items)


def logo_stack(face_width: int, face_height: int) -> str:
    x = (WIDTH - face_width * SCALE) / 2
    y = (HEIGHT - face_height * SCALE) / 2
    transform = f"translate({x:.3f} {y:.3f}) scale({SCALE:g})"
    pieces = [f'<g transform="{transform}" aria-label="KICKASS TRANSFEMS">']

    # A soft, compact cast shadow anchors the 3D sidewall without a neon glow.
    pieces.append(image_node("cast-shadow", 2, 3))

    # Each offset silhouette is one visible step of the trans-colored extrusion.
    extrusion = [
        (27, 22, "ink"), (25, 20, "deep-blue"), (23, 18, "blue"),
        (21, 16, "deep-pink"), (19, 14, "pink"), (17, 12, "white"),
        (15, 10, "blue"), (13, 8, "pink"), (11, 6, "white"),
        (9, 4, "blue"), (7, 3, "deep-pink"), (5, 2, "ink"),
        (3, 1, "white"), (1, 0, "ink"),
    ]
    for dx, dy, key in extrusion:
        pieces.append(image_node(f"tint-{key}", dx, dy))

    # Five clean contours: dark separation, blue, white, pink, and an inner ink keyline.
    for index in range(len(OUTLINE_LAYERS)):
        pieces.append(image_node(f"outline-{index}"))
    pieces.append(image_node())
    pieces.append("</g>")
    return "\n".join(pieces)


def corner_marks() -> str:
    # Pixel-stepped corner brackets echo the site's framed, retro UI styling.
    paths = [
        "M5 28V10H22", "M315 28V10H298",
        "M5 95V113H22", "M315 95V113H298",
    ]
    marks = []
    for d in paths:
        marks.append(f'<path d="{d}" transform="translate(2 2)" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter"/>')
        marks.append(f'<path d="{d}" fill="none" stroke="{BLUE}" stroke-width="2.8" stroke-linecap="square" stroke-linejoin="miter"/>')
        marks.append(f'<path d="{d}" transform="translate(-1 -1)" fill="none" stroke="{WHITE}" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"/>')
    return "\n".join(marks)


def side_rails() -> str:
    colors = [BLUE, PINK, WHITE, PINK, BLUE]
    rails = []
    for x in (11, 295):
        rails.extend([
            f'<rect x="{x + 4}" y="36" width="14" height="55" fill="{INK}"/>',
            f'<rect x="{x + 2}" y="34" width="14" height="55" fill="#214c61"/>',
            f'<rect x="{x + 1}" y="33" width="14" height="55" fill="{PINK}"/>',
            f'<rect x="{x}" y="32" width="14" height="55" fill="{INK}"/>',
        ])
        for index, color in enumerate(colors):
            y = 34 + index * 10
            rails.append(
                f'<rect x="{x + 2}" y="{y}" width="10" height="9" '
                f'fill="{color}" stroke="{INK}" stroke-width=".8"/>'
            )
        rails.extend([
            f'<path d="M{x + 2} 33V87" stroke="{WHITE}" stroke-opacity=".9" stroke-width=".8"/>',
            f'<path d="M{x + 12} 33V87" stroke="#17131b" stroke-opacity=".85" stroke-width="1"/>',
            f'<rect x="{x}" y="32" width="14" height="55" fill="none" stroke="{BLUE}" stroke-width="1"/>',
        ])
    return "\n".join(rails)


def transparent_svg(face_uri: str, face_width: int, face_height: int) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">
<title>KickassTransfems static transparent panel</title>
<desc>Two-line pixel wordmark in transgender pride colors, with a deep extruded shadow and stacked black, blue, white, and pink outlines.</desc>
<defs>
  {filters()}
  <image id="logo-face" x="0" y="0" width="{face_width}" height="{face_height}" preserveAspectRatio="none" href="{face_uri}"/>
  <linearGradient id="shelf" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="{BLUE}"/><stop offset=".48" stop-color="{WHITE}"/><stop offset="1" stop-color="{PINK}"/>
  </linearGradient>
</defs>
{corner_marks()}
{side_rails()}
<path d="M58 116H92l7 4h122l7-4h34" fill="none" stroke="{INK}" stroke-width="5" stroke-linejoin="miter"/>
<path d="M58 114H92l7 4h122l7-4h34" fill="none" stroke="url(#shelf)" stroke-width="2.4" stroke-linejoin="miter"/>
{logo_stack(face_width, face_height)}
</svg>'''


def flag_svg(face_uri: str, face_width: int, face_height: int,
             flag_uri: str) -> str:
    panel_path = "M12 2H308L318 12V111L308 121H12L2 111V12Z"
    inner_path = "M13 7H307L313 13V110L307 116H13L7 110V13Z"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">
<title>KickassTransfems static trans flag panel</title>
<desc>Two-line pixel wordmark in transgender pride colors over a shaded waving trans flag, framed with layered blue, pink, white, and ink outlines.</desc>
<defs>
  {filters()}
  <image id="logo-face" x="0" y="0" width="{face_width}" height="{face_height}" preserveAspectRatio="none" href="{face_uri}"/>
  <clipPath id="panel-clip"><path d="{panel_path}"/></clipPath>
  <linearGradient id="side-vignette" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#14151e" stop-opacity=".60"/>
    <stop offset=".18" stop-color="{INK}" stop-opacity=".16"/>
    <stop offset=".5" stop-color="{INK}" stop-opacity=".10"/>
    <stop offset=".82" stop-color="{INK}" stop-opacity=".16"/>
    <stop offset="1" stop-color="#14151e" stop-opacity=".60"/>
  </linearGradient>
  <linearGradient id="top-bottom-shade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#19131c" stop-opacity=".38"/>
    <stop offset=".23" stop-color="#19131c" stop-opacity=".04"/>
    <stop offset=".76" stop-color="#19131c" stop-opacity=".04"/>
    <stop offset="1" stop-color="#19131c" stop-opacity=".42"/>
  </linearGradient>
  <pattern id="micro-grid" width="14" height="14" patternUnits="userSpaceOnUse">
    <path d="M14 0H0V14" fill="none" stroke="{WHITE}" stroke-opacity=".26" stroke-width=".6"/>
    <rect x="1.4" y="1.4" width="1.3" height="1.3" fill="{WHITE}" fill-opacity=".36"/>
  </pattern>
</defs>
<rect width="{WIDTH}" height="{HEIGHT}" fill="#1b1720"/>
<path d="{panel_path}" transform="translate(4 2)" fill="{INK}"/>
<path d="{panel_path}" transform="translate(3 2)" fill="#214c61"/>
<path d="{panel_path}" transform="translate(2 1)" fill="{BLUE}"/>
<path d="{panel_path}" transform="translate(1 .5)" fill="{PINK}"/>
<path d="{panel_path}" fill="{INK}"/>
<g clip-path="url(#panel-clip)">
  <rect width="{WIDTH}" height="{HEIGHT}" fill="#20212d"/>
  <image x="0" y="0" width="{WIDTH}" height="{HEIGHT}" preserveAspectRatio="xMidYMid slice" href="{flag_uri}"/>
  <rect width="{WIDTH}" height="{HEIGHT}" fill="url(#side-vignette)"/>
  <rect width="{WIDTH}" height="{HEIGHT}" fill="url(#top-bottom-shade)"/>
  <rect width="{WIDTH}" height="{HEIGHT}" fill="url(#micro-grid)" opacity=".20"/>
  <path d="M12 12H308L312 16V107L308 111H12L8 107V16Z" fill="none" stroke="{INK}" stroke-opacity=".50" stroke-width="2"/>
</g>
{side_rails()}
{logo_stack(face_width, face_height)}
<path d="{panel_path}" fill="none" stroke="{INK}" stroke-width="4" stroke-linejoin="miter"/>
<path d="{inner_path}" fill="none" stroke="{PINK}" stroke-width="2.2" stroke-linejoin="miter"/>
<path d="M17 11H303L310 18V105L303 112H17L10 105V18Z" fill="none" stroke="{WHITE}" stroke-opacity=".88" stroke-width=".9" stroke-linejoin="miter"/>
<path d="M17 7H78M242 7H303M17 116H78M242 116H303" fill="none" stroke="{BLUE}" stroke-width="1.8" stroke-linecap="square"/>
</svg>'''


def render_png(svg_text: str, svg_path: Path, png_path: Path,
               *, transparent: bool) -> None:
    svg_path.write_text(svg_text, encoding="utf-8")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            device_scale_factor=4,
            color_scheme="dark",
        )
        page = context.new_page()
        page.goto(svg_path.as_uri(), wait_until="load")
        shot = page.screenshot(omit_background=transparent, scale="device")
        browser.close()

    with Image.open(io.BytesIO(shot)) as rendered:
        rendered = rendered.convert("RGBA")
        if rendered.size != (WIDTH * 4, HEIGHT * 4):
            raise RuntimeError(f"Unexpected SVG render dimensions: {rendered.size}")
        final = rendered.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        if not transparent:
            # The flag panel is designed as a full-bleed opaque Kick panel.
            final = Image.alpha_composite(Image.new("RGBA", final.size, (32, 33, 45, 255)), final)
            final.convert("RGB").save(png_path, format="PNG", optimize=True)
        else:
            final.save(png_path, format="PNG", optimize=True)


def main() -> None:
    face_uri, face_width, face_height = extract_face()
    flag_uri = extract_flag_backdrop()
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    render_png(
        transparent_svg(face_uri, face_width, face_height),
        SVG_DIR / "KT-LOGO-panel-static-320.svg",
        PNG_TRANSPARENT,
        transparent=True,
    )
    render_png(
        flag_svg(face_uri, face_width, face_height, flag_uri),
        SVG_DIR / "KT-LOGO-trans-flag-panel-static-320.svg",
        PNG_FLAG,
        transparent=False,
    )
    for path in (PNG_TRANSPARENT, PNG_FLAG):
        with Image.open(path) as image:
            print(f"{path.name}: {image.width}x{image.height}, {path.stat().st_size:,} bytes, {image.mode}")


if __name__ == "__main__":
    main()
