#!/usr/bin/env python3
"""Render the animated KickassTransfems social preview.

Requires Python with Pillow, NumPy, and OpenCV, plus ffmpeg on PATH.
The front of the K uses the approved team mark; its side walls are projected
from an extruded polygon so the icon has real, shaded 3D geometry.
"""
from __future__ import annotations

import argparse
import math
import os
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

cv2.setNumThreads(2)


ROOT = Path(__file__).resolve().parents[1]
SITE_PAGE = ROOT / "KickassTransfems" / "index.html"
ASSETS = ROOT / "kt" / "assets"
VIDEO = ASSETS / "trans-flag-pingpong-wide-soft-seam.mp4"
K_FACE = ASSETS / "kick-trans-k-face.png"
AVATAR_DIR = ASSETS / "embed-team"
OUTPUT = ASSETS / "kick-trans-k-team-1200x630.gif"
WIDTH, HEIGHT = 1200, 630
BLUE = (87, 204, 247)
PINK = (244, 169, 184)
WHITE = (252, 252, 252)
INK = (8, 13, 23)
NAVY = (8, 17, 32)
ROSE_WHITE = (255, 241, 246)


class RosterParser(HTMLParser):
    """Read the real member names and avatar URLs from the team page."""

    def __init__(self) -> None:
        super().__init__()
        self.members: list[dict[str, str]] = []
        self.current: dict[str, str] | None = None
        self.capture_name = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        classes = attributes.get("class", "").split()
        if tag == "a" and "kt-member" in classes:
            self.current = {"href": attributes.get("href", "") or ""}
        elif self.current and tag == "img" and "kt-member-avatar" in classes:
            self.current["src"] = attributes.get("src", "") or ""
        elif self.current and tag == "span" and "kt-member-name" in classes:
            self.capture_name = True

    def handle_data(self, data: str) -> None:
        if self.current and self.capture_name:
            self.current["name"] = data.strip()
            self.capture_name = False

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.current is not None:
            if self.current.get("src") and self.current.get("name"):
                self.members.append(self.current)
            self.current = None


def read_roster(refresh: bool = False) -> list[tuple[str, Image.Image]]:
    parser = RosterParser()
    parser.feed(SITE_PAGE.read_text(encoding="utf-8"))
    members: list[tuple[str, Image.Image]] = []
    for entry in parser.members:
        slug = urlparse(entry["href"]).path.strip("/").split("/")[-1]
        path = AVATAR_DIR / f"{slug}.webp"
        if refresh or not path.exists():
            request = Request(
                entry["src"],
                headers={"User-Agent": "Mozilla/5.0 (compatible; KTEmbedPreview/1.0)"},
            )
            with urlopen(request, timeout=25) as response:
                image = Image.open(response).convert("RGB")
            AVATAR_DIR.mkdir(parents=True, exist_ok=True)
            image.save(path, "WEBP", quality=92, method=6)
        with Image.open(path) as image:
            members.append((entry["name"], image.convert("RGBA").copy()))
    if len(members) != 18:
        raise RuntimeError(f"Expected 18 team members, found {len(members)}.")
    return members


def load_font(size: int, heavy: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        [r"C:\Windows\Fonts\ariblk.ttf", r"C:\Windows\Fonts\arialbd.ttf"]
        if heavy
        else [r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\segoeui.ttf"]
    )
    candidates += ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if heavy
                   else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def center_text(
    draw: ImageDraw.ImageDraw,
    center_x: float,
    y: float,
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int, int],
    stroke: int = 0,
    stroke_fill: tuple[int, int, int, int] = (*INK, 255),
    spacing: float = 0.0,
) -> None:
    if spacing <= 0:
        box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke)
        x = center_x - (box[2] - box[0]) / 2
        draw.text((round(x), round(y)), text, font=font, fill=fill,
                  stroke_width=stroke, stroke_fill=stroke_fill)
        return
    widths = [draw.textlength(char, font=font) for char in text]
    total = sum(widths) + spacing * max(0, len(text) - 1)
    x = center_x - total / 2
    for char, width in zip(text, widths):
        draw.text((round(x), round(y)), char, font=font, fill=fill,
                  stroke_width=stroke, stroke_fill=stroke_fill)
        x += width + spacing


def make_background(cap: cv2.VideoCapture, source_time: float) -> Image.Image:
    cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, source_time) * 1000)
    ok, frame = cap.read()
    if not ok:
        cap.set(cv2.CAP_PROP_POS_MSEC, 0)
        ok, frame = cap.read()
    if not ok:
        raise RuntimeError(f"Could not decode {VIDEO}")
    source_h, source_w = frame.shape[:2]
    scale = max(WIDTH / source_w, HEIGHT / source_h)
    scaled = cv2.resize(
        frame,
        (round(source_w * scale), round(source_h * scale)),
        interpolation=cv2.INTER_LANCZOS4,
    )
    crop_x = (scaled.shape[1] - WIDTH) // 2
    crop_y = (scaled.shape[0] - HEIGHT) // 2
    rgb = cv2.cvtColor(
        scaled[crop_y:crop_y + HEIGHT, crop_x:crop_x + WIDTH],
        cv2.COLOR_BGR2RGB,
    )
    rgb = cv2.GaussianBlur(rgb, (5, 5), 1.4).astype(np.float32)
    tint = np.array((9, 17, 31), dtype=np.float32)
    rgb = rgb * 0.76 + tint * 0.24
    yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH]
    dx = (xx - WIDTH * 0.5) / (WIDTH * 0.72)
    dy = (yy - HEIGHT * 0.5) / (HEIGHT * 0.78)
    radius = np.sqrt(dx * dx + dy * dy)
    vignette = np.clip(1.0 - np.maximum(0, radius - 0.25) * 0.26, 0.62, 1.0)
    rgb *= vignette[..., None]
    # A soft, dim trans-colored bounce keeps the fabric identifiable at thumbnail size.
    bloom = np.exp(-(((xx - 600) / 390) ** 2 + ((yy - 320) / 260) ** 2) * 1.7)
    rgb[..., 0] += bloom * 6
    rgb[..., 2] += bloom * 8
    return Image.fromarray(np.uint8(np.clip(rgb, 0, 255)), "RGB")


def draw_particles(layer: Image.Image, t: float, duration: float, seed: int = 20261024) -> None:
    draw = ImageDraw.Draw(layer)
    rng = np.random.default_rng(seed)
    loop = t / duration
    for index in range(56):
        x = int(rng.integers(22, WIDTH - 22))
        y = int(rng.integers(86, HEIGHT - 58))
        radius = float(rng.choice([1.1, 1.5, 1.8, 2.2, 2.8, 3.4]))
        phase = float(rng.random() * math.tau)
        cycles = int(rng.choice([1, 2, 3, 4]))
        alpha = int(45 + (0.5 + 0.5 * math.sin(math.tau * loop * cycles + phase)) * 100)
        color = (BLUE, PINK, ROSE_WHITE)[index % 3]
        cx = x + math.sin(math.tau * loop * 2 + phase) * 4
        cy = y + math.cos(math.tau * loop * cycles + phase) * 4
        r = radius * (0.82 + 0.18 * math.sin(math.tau * loop * cycles + phase))
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*color, alpha))
        if index % 7 == 0:
            long_r = r * 2.7
            draw.polygon(
                [(cx, cy - long_r), (cx + r * 0.52, cy),
                 (cx, cy + long_r), (cx - r * 0.52, cy)],
                fill=(*color, int(alpha * 0.64)),
            )


def draw_rings(layer: Image.Image, t: float, duration: float) -> None:
    draw = ImageDraw.Draw(layer)
    rings = [
        ((345, 92, 855, 548), BLUE, 2, 52, 18, 102),
        ((365, 112, 835, 525), PINK, 2, 50, 198, 294),
        ((386, 130, 814, 509), WHITE, 1, 32, 322, 48),
    ]
    rotation = 360 * t / duration
    for box, color, width, alpha, start, end in rings:
        start_angle = (start + rotation) % 360
        end_angle = (end + rotation) % 360
        if end_angle < start_angle:
            draw.arc(box, start=start_angle, end=359, fill=(*color, alpha), width=width)
            draw.arc(box, start=0, end=end_angle, fill=(*color, alpha), width=width)
        else:
            draw.arc(box, start=start_angle, end=end_angle, fill=(*color, alpha), width=width)
    # Three orbit markers move continuously around the emblem without flashing.
    for i, (rx, ry, color) in enumerate(((245, 216, BLUE), (232, 200, PINK), (218, 188, WHITE))):
        angle = t * math.tau / duration + i * math.tau / 3
        x = 600 + math.cos(angle) * rx
        y = 320 + math.sin(angle) * ry
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=(*color, 145))
        draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(255, 255, 255, 235))


def draw_panels(layer: Image.Image) -> None:
    draw = ImageDraw.Draw(layer)
    panel_boxes = ((22, 122, 320, 520), (880, 122, 1178, 520))
    for index, box in enumerate(panel_boxes):
        accent = BLUE if index == 0 else PINK
        draw.rounded_rectangle(
            box, radius=22, fill=(5, 12, 25, 166),
            outline=(223, 242, 255, 120), width=2,
        )
        x0, y0, x1, _ = box
        draw.rounded_rectangle(
            (x0 + 10, y0 + 10, x0 + 15, y0 + 62),
            radius=3, fill=(*accent, 215),
        )
        draw.line((x0 + 26, y0 + 70, x1 - 18, y0 + 70),
                  fill=(*accent, 104), width=1)
    font = load_font(14, heavy=True)
    center_text(draw, 171, 133, "THE CREW", font, (250, 252, 255, 240), 1)
    center_text(draw, 1029, 133, "18 MEMBERS", font, (250, 252, 255, 240), 1)
    small = load_font(10, heavy=True)
    center_text(draw, 171, 153, "01–09", small, (*BLUE, 235), 1)
    center_text(draw, 1029, 153, "10–18", small, (*PINK, 235), 1)


def avatar_badge(avatar: Image.Image, accent: tuple[int, int, int], phase: float) -> Image.Image:
    size, outer = 54, 72
    tile = Image.new("RGBA", (outer, outer), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    pulse = int(175 + 45 * (0.5 + 0.5 * math.sin(phase)))
    d.ellipse((4, 7, outer - 3, outer - 1), fill=(0, 0, 0, 170))
    d.ellipse((3, 2, outer - 4, outer - 9), fill=(*INK, 255),
              outline=(*accent, pulse), width=4)
    d.ellipse((7, 6, outer - 8, outer - 13), fill=(249, 252, 255, 255),
              outline=(255, 255, 255, 235), width=2)
    image = ImageOps.fit(avatar, (size, size), method=Image.Resampling.LANCZOS, centering=(0.5, 0.48))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    image.putalpha(mask)
    tile.alpha_composite(image, (9, 8))
    # A fine top crescent gives the portrait capsule a glass rim.
    d = ImageDraw.Draw(tile)
    d.arc((8, 6, outer - 9, outer - 13), start=202, end=333,
          fill=(255, 255, 255, 150), width=2)
    return tile


def draw_roster(
    frame: Image.Image,
    roster: list[tuple[str, Image.Image]],
    t: float,
    duration: float,
) -> None:
    left_x = (72, 171, 270)
    right_x = (930, 1029, 1128)
    rows_y = (203, 321, 439)
    for index, (name, avatar) in enumerate(roster):
        if index < 9:
            column, row = index % 3, index // 3
            cx, cy = left_x[column], rows_y[row]
        else:
            local_index = index - 9
            column, row = local_index % 3, local_index // 3
            cx, cy = right_x[column], rows_y[row]
        cycles = 1 + index % 2
        phase = index * 2.399 + math.tau * t / duration * cycles
        badge = avatar_badge(avatar, (BLUE, PINK, WHITE)[index % 3], phase)
        dx = round(2 * math.sin(phase * 0.72))
        dy = round(3 * math.sin(phase))
        frame.alpha_composite(badge, (round(cx - badge.width / 2 + dx),
                                      round(cy - badge.height / 2 + dy)))


def rotation_matrix(yaw: float, pitch: float) -> np.ndarray:
    cy, sy = math.cos(yaw), math.sin(yaw)
    cp, sp = math.cos(pitch), math.sin(pitch)
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], dtype=np.float64)
    rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]], dtype=np.float64)
    return rx @ ry


def project_points(points: np.ndarray, matrix: np.ndarray, center_y: float) -> np.ndarray:
    rotated = points @ matrix.T
    depth = 1820.0
    factor = depth / (depth - rotated[:, 2])
    return np.column_stack((600 + rotated[:, 0] * factor,
                            center_y - rotated[:, 1] * factor)).astype(np.float32)


def warp_rgba(source: np.ndarray, transform: np.ndarray) -> np.ndarray:
    return cv2.warpPerspective(
        source, transform, (WIDTH, HEIGHT), flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0),
    )


def stripe_color(source_y: float, height: int) -> tuple[int, int, int]:
    y = source_y / height
    if y < 0.22 or y >= 0.76:
        return BLUE
    if y < 0.405 or y >= 0.58:
        return PINK
    return WHITE


def build_lit_face(face: Image.Image, t: float, duration: float) -> np.ndarray:
    rgba = np.asarray(face.convert("RGBA")).copy()
    rgb = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3]
    flag_fill = (alpha > 150) & (rgb[..., 0] > 60) & (rgb[..., 1] > 90) & (rgb[..., 2] > 120)
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    grain = np.random.default_rng(9481).normal(0.0, 1.2, (h, w))
    block_values = np.array(
        [[5, -4, 3, -2], [-3, 5, -4, 4], [3, -3, 5, -4],
         [-4, 4, -2, 5], [5, -3, 4, -4], [-2, 5, -3, 4]],
        dtype=np.float32,
    )
    block_texture = block_values[(yy // 88) % 6, (xx // 193) % 4]
    seams = ((yy % 88) < 2) | ((xx % 193) < 2)
    surface = 3.1 * np.sin(yy / 18.0) + 1.7 * np.cos(yy / 43.0)
    surface += block_texture - seams.astype(np.float32) * 5.0
    sweep = (-0.42 + 1.84 * ((t % duration) / duration)) * w
    specular = 10.0 * np.exp(-0.5 * ((xx - sweep) / (w * 0.055)) ** 2)
    ambient = 1.5 * (1.0 - xx / max(1, w - 1)) + 0.7 * (1.0 - yy / max(1, h - 1))
    adjustment = grain + surface + specular + ambient
    for channel in range(3):
        rgb[..., channel][flag_fill] += adjustment[flag_fill]
    rgba[..., :3] = np.uint8(np.clip(rgb, 0, 255))
    return rgba


def render_3d_k(
    frame: Image.Image,
    face: Image.Image,
    contour: np.ndarray,
    t: float,
    duration: float,
) -> None:
    source = build_lit_face(face, t, duration)
    h, w = source.shape[:2]
    scale = 430.0 / h
    depth = 108.0
    yaw = math.radians(-24 + 5.0 * math.sin(math.tau * t / duration))
    pitch = math.radians(-13 + 2.2 * math.sin(math.tau * t / duration + 0.7))
    matrix = rotation_matrix(yaw, pitch)
    center_y = 321 + 4 * math.sin(math.tau * t / duration - 0.4)

    def local_points(points: np.ndarray, z: float) -> np.ndarray:
        p = np.asarray(points, dtype=np.float64)
        return np.column_stack(((p[:, 0] - w / 2) * scale,
                                (h / 2 - p[:, 1]) * scale,
                                np.full(len(p), z)))

    # Cast a broad, quiet shadow first; the hard keyline does most of the separation.
    silhouette = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(silhouette, [contour], -1, 255, thickness=cv2.FILLED)
    source_corners = np.float32([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]])
    front_corners = local_points(source_corners, 0)
    target_corners = project_points(front_corners, matrix, center_y)
    front_transform = cv2.getPerspectiveTransform(source_corners, target_corners)
    mask_rgba = np.dstack((silhouette, silhouette, silhouette, silhouette))
    warped_mask = warp_rgba(mask_rgba, front_transform)[..., 3]
    shifted = cv2.warpAffine(
        warped_mask, np.float32([[1, 0, 9], [0, 1, 13]]), (WIDTH, HEIGHT),
        borderMode=cv2.BORDER_CONSTANT, borderValue=0,
    )
    shadow_alpha = cv2.GaussianBlur(shifted, (0, 0), 14) * 0.46
    shadow = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
    shadow[..., :3] = (0, 0, 0)
    shadow[..., 3] = np.uint8(np.clip(shadow_alpha, 0, 118))
    frame.alpha_composite(Image.fromarray(shadow, "RGBA"))

    # Give the back plane shaded flag colors, rather than exposing the source's transparent halo.
    binary = (source[..., 3] > 128).astype(np.uint8) * 255
    back = np.zeros_like(source)
    for row in range(h):
        color = np.asarray(stripe_color(row, h), dtype=np.float32)
        if color[0] > 245 and color[1] > 245:
            color = np.asarray(WHITE, dtype=np.float32)
            shade, tint = 1.0, np.array((0, 0, 0), dtype=np.float32)
        elif color[0] > 180:
            shade, tint = 0.60, np.array((35, 13, 22), dtype=np.float32)
        else:
            shade, tint = 0.64, np.array((8, 27, 43), dtype=np.float32)
        back[row, :, :3] = np.uint8(np.clip(color * shade + tint * (1 - shade), 0, 255))
    back[..., 3] = binary
    back_transform = cv2.getPerspectiveTransform(
        source_corners,
        project_points(local_points(source_corners, -depth), matrix, center_y),
    )
    frame.alpha_composite(Image.fromarray(warp_rgba(back, back_transform), "RGBA"))

    # OpenCV contours retain the stepped silhouette; each selected edge becomes a shaded 3D quad.
    points_px = contour.reshape(-1, 2).astype(np.float64)
    local_xy = local_points(points_px, 0)[:, :2]
    area = 0.5 * np.sum(local_xy[:, 0] * np.roll(local_xy[:, 1], -1)
                        - np.roll(local_xy[:, 0], -1) * local_xy[:, 1])
    camera_local = matrix.T @ np.array((0.0, 0.0, 1.0))
    light = np.array((-0.36, 0.54, 0.76))
    light /= np.linalg.norm(light)
    side_faces = []
    for i in range(len(points_px)):
        j = (i + 1) % len(points_px)
        tangent = local_xy[j] - local_xy[i]
        normal = np.array((tangent[1], -tangent[0])) if area > 0 else np.array((-tangent[1], tangent[0]))
        norm_len = np.linalg.norm(normal)
        if norm_len == 0:
            continue
        normal /= norm_len
        if float(normal @ camera_local[:2]) <= 0.015:
            continue
        front_pair = local_points(points_px[[i, j]], 0)
        back_pair = local_points(points_px[[i, j]], -depth)
        vertices = np.vstack((front_pair[0], front_pair[1], back_pair[1], back_pair[0]))
        normal3 = matrix @ np.array((normal[0], normal[1], 0.0))
        midpoint_y = float((points_px[i, 1] + points_px[j, 1]) / 2)
        color = np.asarray(stripe_color(midpoint_y, h), dtype=np.float32)
        light_amount = max(0.0, float(normal3 @ light))
        if color[0] > 245 and color[1] > 245:
            color = np.asarray(WHITE, dtype=np.float32)
            shade = 1.0
        else:
            shade = 0.59 + 0.30 * light_amount
        color = color * shade + np.array((8, 12, 22), dtype=np.float32) * (1 - shade)
        facet = (int(color[0]), int(color[1]), int(color[2]), 255)
        projected = project_points(vertices, matrix, center_y)
        camera_z = float((vertices @ matrix.T)[:, 2].mean())
        side_faces.append((camera_z, projected, facet, normal3))
    side_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    side_draw = ImageDraw.Draw(side_layer)
    for _z, polygon, fill, normal3 in sorted(side_faces, key=lambda row: row[0]):
        pts = [tuple(map(lambda n: int(round(n)), p)) for p in polygon]
        side_draw.polygon(pts, fill=fill)
        edge = (8, 13, 22, 235)
        side_draw.line(pts + [pts[0]], fill=edge, width=2, joint="curve")
        if float(normal3 @ light) > 0.22:
            highlight = (*tuple(min(255, int(c * 1.22 + 16)) for c in fill[:3]), 145)
            side_draw.line(pts[:2], fill=highlight, width=2)
    frame.alpha_composite(side_layer)

    # Add one clean pale-pink-white outer keyline beyond the logo's existing black/white strokes.
    binary = (source[..., 3] > 128).astype(np.uint8) * 255
    dilated = cv2.dilate(binary, np.ones((11, 11), dtype=np.uint8), iterations=1)
    outer_ring = cv2.subtract(dilated, binary)
    ring_rgba = np.zeros((h, w, 4), dtype=np.uint8)
    ring_rgba[..., :3] = ROSE_WHITE
    ring_rgba[..., 3] = outer_ring
    frame.alpha_composite(Image.fromarray(warp_rgba(ring_rgba, front_transform), "RGBA"))

    front = warp_rgba(source, front_transform)
    frame.alpha_composite(Image.fromarray(front, "RGBA"))

def draw_platform(layer: Image.Image, t: float, duration: float) -> None:
    draw = ImageDraw.Draw(layer)
    # Low platform and clipped light marks anchor the icon without a large glow.
    draw.ellipse((408, 504, 792, 570), fill=(5, 12, 25, 185),
                 outline=(220, 235, 255, 104), width=2)
    draw.arc((426, 508, 774, 552), start=4, end=176, fill=(*BLUE, 145), width=3)
    draw.arc((426, 510, 774, 561), start=185, end=349, fill=(*PINK, 122), width=2)
    angle = math.pi + (t / duration) * math.tau
    x = 600 + math.cos(angle) * 172
    y = 533 + math.sin(angle) * 17
    draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(255, 255, 255, 215))


def draw_labels(frame: Image.Image, t: float, duration: float) -> None:
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    # Compact title plaque keeps the social card understandable when rendered small.
    draw.rounded_rectangle((389, 18, 811, 82), radius=20,
                           fill=(5, 12, 24, 204), outline=(255, 255, 255, 180), width=2)
    draw.rounded_rectangle((405, 25, 410, 74), radius=2, fill=(*BLUE, 240))
    draw.rounded_rectangle((790, 25, 795, 74), radius=2, fill=(*PINK, 240))
    center_text(draw, 600, 23, "KICKASS TRANSFEMS",
                load_font(25, heavy=True), (255, 255, 255, 255), 2, (*INK, 255), 1.0)
    center_text(draw, 600, 54, "18 TRANSFEM CREATORS  ·  ON KICK",
                load_font(12, heavy=True), (228, 238, 248, 248), 1, (*INK, 255), 0.55)

    # The CTA is deliberately short and legible; the whole preview links to the team page.
    pulse = 0.5 + 0.5 * math.sin(math.tau * t / duration - 0.6)
    border = (int(168 + 36 * pulse), int(220 + 17 * pulse), 248, 232)
    draw.rounded_rectangle((456, 565, 744, 615), radius=18,
                           fill=(5, 12, 25, 226), outline=border, width=3)
    draw.rounded_rectangle((466, 574, 470, 606), radius=2, fill=(*PINK, 230))
    center_text(draw, 586, 577, "MEET THE CREW",
                load_font(18, heavy=True), (255, 255, 255, 255), 1, (*INK, 255), 0.35)
    draw.line((680, 586, 690, 596), fill=(255, 255, 255, 255), width=3)
    draw.line((690, 596, 690, 584), fill=(255, 255, 255, 255), width=3)
    draw.line((690, 596, 678, 596), fill=(255, 255, 255, 255), width=3)
    # Two soft motion slashes point inward toward the badge without competing with the K.
    for side, color in ((-1, BLUE), (1, PINK)):
        xx = 600 + side * (188 - 8 * pulse)
        draw.line((xx, 589, xx + side * 24, 589), fill=(*color, 145), width=3)
        draw.line((xx + side * 5, 597, xx + side * 22, 597),
                  fill=(*color, 92), width=2)
    frame.alpha_composite(layer)


def render_frame(
    cap: cv2.VideoCapture,
    roster: list[tuple[str, Image.Image]],
    face: Image.Image,
    contour: np.ndarray,
    frame_index: int,
    frame_count: int,
    fps: int,
    duration: float,
) -> Image.Image:
    phase = frame_index / max(1, frame_count - 1)
    # Ping-pong through a clip section so the flag itself loops cleanly in the GIF.
    source_time = 3.15 * (1 - abs(2 * phase - 1))
    t = frame_index / fps
    frame = make_background(cap, source_time).convert("RGBA")
    decor = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_rings(decor, t, duration)
    draw_particles(decor, t, duration)
    frame.alpha_composite(decor)
    panels = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_panels(panels)
    frame.alpha_composite(panels)
    draw_roster(frame, roster, t, duration)
    platform = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_platform(platform, t, duration)
    frame.alpha_composite(platform)
    render_3d_k(frame, face, contour, t, duration)
    draw_labels(frame, t, duration)
    border = ImageDraw.Draw(frame)
    border.rounded_rectangle((9, 9, WIDTH - 10, HEIGHT - 10), radius=23,
                             outline=(245, 248, 255, 145), width=2)
    # Small trans-color corner ticks echo the block geometry of the K.
    for x0, y0, sx, sy, color in ((22, 23, 1, 1, BLUE), (1178, 23, -1, 1, PINK),
                                  (22, 607, 1, -1, PINK), (1178, 607, -1, -1, BLUE)):
        border.line((x0, y0, x0 + sx * 22, y0), fill=(*color, 205), width=3)
        border.line((x0, y0, x0, y0 + sy * 22), fill=(*color, 205), width=3)
    return frame.convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--fps", type=int, default=10)
    parser.add_argument("--seconds", type=float, default=5.6)
    parser.add_argument("--colors", type=int, default=64)
    parser.add_argument("--refresh-avatars", action="store_true")
    parser.add_argument("--preview-frame", type=Path, help="also save the first frame as a PNG")
    args = parser.parse_args()
    if not VIDEO.is_file() or not K_FACE.is_file():
        raise FileNotFoundError("The flag video and K face asset must be present in kt/assets.")

    roster = read_roster(args.refresh_avatars)
    face = Image.open(K_FACE).convert("RGBA")
    face_alpha = np.asarray(face.getchannel("A"))
    silhouette = np.uint8(face_alpha > 128) * 255
    contours, _hierarchy = cv2.findContours(silhouette, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contour = max(contours, key=cv2.contourArea)
    contour = cv2.approxPolyDP(contour, 2.0, True)
    cap = cv2.VideoCapture(str(VIDEO))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open {VIDEO}")

    frame_count = max(2, round(args.fps * args.seconds))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="kt-embed-") as temp_name:
        temp = Path(temp_name)
        first_frame: Image.Image | None = None
        for index in range(frame_count):
            frame = render_frame(cap, roster, face, contour, index, frame_count,
                                 args.fps, args.seconds)
            if index == 0:
                first_frame = frame.copy()
            frame.save(temp / f"frame-{index:04d}.png", compress_level=1)
        cap.release()
        if args.preview_frame and first_frame:
            args.preview_frame.parent.mkdir(parents=True, exist_ok=True)
            first_frame.save(args.preview_frame)

        ffmpeg = os.environ.get("FFMPEG", "ffmpeg")
        palette = temp / "palette.png"
        pattern = str(temp / "frame-%04d.png")
        subprocess.run(
            [ffmpeg, "-y", "-v", "error", "-framerate", str(args.fps), "-i", pattern,
             "-vf", f"palettegen=max_colors={args.colors}:stats_mode=full", str(palette)],
            check=True,
        )
        subprocess.run(
            [ffmpeg, "-y", "-v", "error", "-framerate", str(args.fps), "-i", pattern,
             "-i", str(palette), "-lavfi", "paletteuse=dither=bayer:bayer_scale=3",
             "-loop", "0", "-gifflags", "+offsetting+transdiff", str(args.output)],
            check=True,
        )
    print(f"Rendered {frame_count} frames at {args.fps} fps: {args.output}")
    print(f"Size: {args.output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
