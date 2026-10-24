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
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

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
    rgb = rgb * 0.70 + tint * 0.30
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


def draw_atmospheric_lights(frame: Image.Image, t: float, duration: float) -> None:
    """Add broad colored area-light spill to the waving flag environment."""
    w, h = 300, 158
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    phase = math.tau * t / duration
    lights = np.zeros((h, w, 3), dtype=np.float32)
    for x, y, rx, ry, color, strength, drift in (
        (48, 70, 74, 105, BLUE, 0.105, 0.16),
        (246, 59, 82, 110, PINK, 0.105, -0.13),
        (151, 138, 116, 48, (199, 218, 243), 0.052, 0.08),
    ):
        cx = x + 9 * math.sin(phase + drift)
        cy = y + 5 * math.cos(phase * 0.7 + drift)
        field = np.exp(-0.5 * (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2))
        lights += field[..., None] * np.asarray(color, dtype=np.float32) * strength
    base = np.asarray(frame.resize((w, h), Image.Resampling.BILINEAR), dtype=np.float32)
    lit = np.uint8(np.clip(base + lights, 0, 255))
    frame.paste(Image.fromarray(lit, "RGB").resize((WIDTH, HEIGHT), Image.Resampling.BICUBIC))


def scene_rotation(yaw: float, pitch: float, roll: float) -> np.ndarray:
    cy, sy = math.cos(yaw), math.sin(yaw)
    cp, sp = math.cos(pitch), math.sin(pitch)
    cr, sr = math.cos(roll), math.sin(roll)
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], dtype=np.float64)
    rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]], dtype=np.float64)
    rz = np.array([[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]], dtype=np.float64)
    return ry @ rx @ rz


def draw_mesh_object(
    target: Image.Image,
    vertices: np.ndarray,
    faces: list[tuple[int, ...]],
    center: tuple[float, float, float],
    rotation: np.ndarray,
    materials: list[tuple[tuple[int, int, int], int]],
    focal: float = 1820.0,
    edge_color: tuple[int, int, int, int] | None = None,
) -> None:
    """Project and shade an actual faceted mesh, compositing only its local bounds."""
    local = np.asarray(vertices, dtype=np.float64)
    rotated = local @ rotation.T
    world = rotated + np.array((center[0] - WIDTH / 2, HEIGHT / 2 - center[1], center[2]))
    z = focal - world[:, 2]
    factor = focal / np.maximum(z, 1.0)
    screen = np.column_stack((WIDTH / 2 + world[:, 0] * factor,
                              HEIGHT / 2 - world[:, 1] * factor))
    x0 = max(0, int(math.floor(screen[:, 0].min() - 3)))
    y0 = max(0, int(math.floor(screen[:, 1].min() - 3)))
    x1 = min(WIDTH, int(math.ceil(screen[:, 0].max() + 4)))
    y1 = min(HEIGHT, int(math.ceil(screen[:, 1].max() + 4)))
    if x1 <= x0 or y1 <= y0:
        return
    patch = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    draw = ImageDraw.Draw(patch)
    light = np.array((-0.46, 0.68, 0.57), dtype=np.float64)
    light /= np.linalg.norm(light)
    view = np.array((0.0, 0.0, 1.0), dtype=np.float64)
    half_vector = light + view
    half_vector /= np.linalg.norm(half_vector)
    order: list[tuple[float, int, np.ndarray]] = []
    for face_index, face in enumerate(faces):
        indices = np.asarray(face, dtype=np.int32)
        points = local[indices]
        normal = np.cross(points[1] - points[0], points[2] - points[0])
        norm = np.linalg.norm(normal)
        if norm < 1e-7:
            continue
        normal /= norm
        normal = rotation @ normal
        polygon = screen[indices]
        order.append((float(world[indices, 2].mean()), face_index, normal))
    for _depth, face_index, normal in sorted(order, key=lambda item: item[0]):
        face = faces[face_index]
        color, alpha = materials[face_index % len(materials)]
        diffuse = 0.56 + 0.38 * max(0.0, float(normal @ light))
        specular = max(0.0, float(normal @ half_vector)) ** 20 * 0.22
        rim = (1.0 - abs(float(normal[2]))) * 0.045
        shaded = np.clip(np.asarray(color, dtype=np.float64) * (diffuse + rim)
                         + 255.0 * specular, 0, 255).astype(np.uint8)
        coords = [(int(round(screen[i, 0] - x0)), int(round(screen[i, 1] - y0)))
                  for i in face]
        draw.polygon(coords, fill=(*map(int, shaded), int(alpha)))
        if edge_color is not None:
            draw.line(coords + [coords[0]], fill=edge_color, width=1, joint="curve")
    target.alpha_composite(patch, (x0, y0))


def crystal_mesh(width: float, length: float, depth: float) -> tuple[np.ndarray, list[tuple[int, ...]]]:
    """An elongated, closed, eight-facet bicone for the floating scene props."""
    vertices = [(0.0, length * 0.5, 0.0)]
    for index in range(8):
        angle = math.tau * index / 8
        vertices.append((math.cos(angle) * width * 0.5, 0.0,
                         math.sin(angle) * depth * 0.5))
    bottom = len(vertices)
    vertices.append((0.0, -length * 0.5, 0.0))
    faces: list[tuple[int, ...]] = []
    for index in range(8):
        next_index = (index + 1) % 8
        faces.append((0, 1 + index, 1 + next_index))
        faces.append((bottom, 1 + next_index, 1 + index))
    return np.asarray(vertices, dtype=np.float64), faces


def draw_3d_props(
    frame: Image.Image,
    t: float,
    duration: float,
    foreground: bool = False,
) -> None:
    """Build an atmospheric field of real shaded trans-colored crystal meshes."""
    all_bases = [
        (70, 228, 136, 244, 78, -0.44, 0.25, 0.12),
        (195, 109, 74, 150, 53, 0.52, -0.30, -0.14),
        (339, 536, -84, 171, 58, -0.28, -0.22, 0.28),
        (882, 108, -72, 160, 56, 0.41, 0.24, -0.10),
        (1065, 244, -115, 204, 85, -0.55, 0.18, 0.14),
        (1120, 495, -80, 170, 57, 0.32, -0.30, -0.24),
        (845, 555, 185, 139, 48, -0.39, 0.15, 0.20),
        (31, 488, 210, 174, 69, 0.56, 0.25, -0.15),
        (1184, 354, 185, 160, 58, -0.37, -0.18, 0.27),
    ]
    bases = [row for row in all_bases if (row[2] >= 0) == foreground]
    palette = (BLUE, PINK, (231, 241, 249), (75, 160, 196), (220, 130, 157))
    vertices_by_shape: dict[tuple[int, int, int], tuple[np.ndarray, list[tuple[int, ...]]]] = {}
    phase = math.tau * t / duration
    for index, (x, y, z, length, width, yaw, pitch, roll) in enumerate(bases):
        shape_key = (int(width), int(length), int(width * 0.70))
        if shape_key not in vertices_by_shape:
            vertices_by_shape[shape_key] = crystal_mesh(shape_key[0], shape_key[1], shape_key[2])
        vertices, faces = vertices_by_shape[shape_key]
        drift = index * 1.71
        center = (x + 7 * math.sin(phase + drift),
                  y + 11 * math.sin(phase * 0.72 + drift),
                  z + 18 * math.cos(phase + drift))
        rotation = scene_rotation(yaw + 0.10 * math.sin(phase + drift),
                                  pitch + 0.12 * math.cos(phase * 0.8 + drift),
                                  roll + 0.12 * math.sin(phase + drift))
        alpha = 114 if z < 0 else 128
        materials = []
        for face_index in range(len(faces)):
            color = palette[(index + face_index // 2) % len(palette)]
            materials.append((color, alpha))
        draw_mesh_object(frame, vertices, faces, center, rotation, materials,
                         edge_color=(24, 39, 58, 74))


def make_lens_face(avatar: Image.Image, size: int) -> Image.Image:
    """Shade a circular portrait as a softly convex glass lens."""
    image = ImageOps.fit(avatar.convert("RGBA"), (size, size),
                         method=Image.Resampling.LANCZOS, centering=(0.5, 0.47))
    rgba = np.asarray(image).copy()
    yy, xx = np.mgrid[-1:1:complex(size), -1:1:complex(size)]
    radius2 = xx * xx + yy * yy
    inside = radius2 <= 1.0
    nz = np.sqrt(np.maximum(0.0, 1.0 - radius2))
    normal = np.stack((xx * 0.42, -yy * 0.42, nz), axis=-1)
    normal /= np.maximum(np.linalg.norm(normal, axis=-1, keepdims=True), 1e-5)
    light = np.array((-0.38, 0.50, 0.78), dtype=np.float32)
    light /= np.linalg.norm(light)
    diffuse = 0.72 + 0.28 * np.maximum(0, normal @ light)
    half_vector = light + np.array((0.0, 0.0, 1.0), dtype=np.float32)
    half_vector /= np.linalg.norm(half_vector)
    specular = np.maximum(0, normal @ half_vector) ** 18 * 0.14
    edge_shade = np.clip(1.0 - np.maximum(0.0, radius2 - 0.60) * 0.33, 0.70, 1.0)
    rgb = rgba[..., :3].astype(np.float32)
    rgb = rgb * (diffuse * edge_shade)[..., None] + specular[..., None] * 255
    rgba[..., :3] = np.uint8(np.clip(rgb, 0, 255))
    circle = np.uint8(inside * 255)
    original_alpha = rgba[..., 3].astype(np.float32)
    rgba[..., 3] = np.uint8(original_alpha * circle / 255.0)
    return Image.fromarray(rgba, "RGBA")


def draw_portrait_pod(
    frame: Image.Image,
    avatar: Image.Image,
    x: float,
    y: float,
    z: float,
    radius: float,
    phase: float,
    accent: tuple[int, int, int],
) -> None:
    """Render one free-floating, tilted, extruded portrait lens in 3D."""
    segments = 24
    outer = radius * 1.12
    inner = radius * 1.005
    vertices: list[tuple[float, float, float]] = [(0.0, 0.0, -13.0)]
    back_center = 0
    back_ring = []
    front_ring = []
    front_inner = []
    for index in range(segments):
        angle = math.tau * index / segments
        cosine, sine = math.cos(angle), math.sin(angle)
        back_ring.append(len(vertices))
        vertices.append((outer * cosine, outer * sine, -13.0))
    for index in range(segments):
        angle = math.tau * index / segments
        cosine, sine = math.cos(angle), math.sin(angle)
        front_ring.append(len(vertices))
        vertices.append((outer * cosine, outer * sine, 0.0))
    for index in range(segments):
        angle = math.tau * index / segments
        cosine, sine = math.cos(angle), math.sin(angle)
        front_inner.append(len(vertices))
        vertices.append((inner * cosine, inner * sine, 0.0))
    faces: list[tuple[int, ...]] = []
    materials: list[tuple[tuple[int, int, int], int]] = []
    for index in range(segments):
        next_index = (index + 1) % segments
        faces.append((back_center, back_ring[next_index], back_ring[index]))
        materials.append(((14, 22, 36), 160))
        faces.append((back_ring[index], back_ring[next_index],
                      front_ring[next_index], front_ring[index]))
        side_color = tuple(round(channel * 0.48 + 10) for channel in accent)
        materials.append((side_color, 142))
        faces.append((front_inner[index], front_ring[index],
                      front_ring[next_index], front_inner[next_index]))
        ring_color = tuple(round(channel * 0.74 + 26) for channel in accent)
        materials.append((ring_color, 126))
    faces.append(tuple(front_inner))
    materials.append(((12, 18, 28), 150))
    vertices_array = np.asarray(vertices, dtype=np.float64)
    rotation = scene_rotation(0.25 * math.sin(phase * 0.71),
                              0.23 * math.cos(phase * 0.67),
                              0.13 * math.sin(phase * 0.83))
    draw_mesh_object(frame, vertices_array, faces, (x, y, z), rotation, materials,
                     edge_color=(8, 15, 26, 68))

    size = max(42, int(round(radius * 2)))
    face = make_lens_face(avatar, size)
    face_mask = face.getchannel("A")
    corners = np.float32([[0, 0], [size - 1, 0], [size - 1, size - 1], [0, size - 1]])
    local_corners = np.column_stack(((corners[:, 0] - (size - 1) / 2) / radius * radius,
                                     ((size - 1) / 2 - corners[:, 1]) / radius * radius,
                                     np.full(4, 1.6)))
    rotated_corners = local_corners @ rotation.T
    world_corners = rotated_corners + np.array((x - WIDTH / 2, HEIGHT / 2 - y, z))
    projected_corners = project_points(world_corners, np.eye(3), HEIGHT / 2)
    transform = cv2.getPerspectiveTransform(corners, projected_corners.astype(np.float32))
    rgba = np.asarray(face).copy()
    rgba[..., 3] = np.asarray(face_mask)
    composite_projected_rgba(frame, rgba, transform, corners)


def draw_floating_team(
    frame: Image.Image,
    roster: list[tuple[str, Image.Image]],
    t: float,
    duration: float,
) -> None:
    """Let the member lenses drift independently through the full 3D scene."""
    anchors = [
        (76, 172), (186, 118), (337, 235), (70, 340), (242, 316),
        (169, 438), (340, 511), (102, 530), (72, 438),
        (1120, 137), (1035, 78), (865, 210), (1130, 260), (972, 309),
        (1080, 398), (875, 444), (1004, 518), (1128, 520),
    ]
    for index, ((name, avatar), (base_x, base_y)) in enumerate(zip(roster, anchors)):
        phase = math.tau * t / duration + index * 2.399
        x = base_x + 13 * math.sin(phase * 0.63) + 4 * math.sin(phase * 0.31 + 0.8)
        y = base_y + 17 * math.sin(phase * 0.78 + 0.6)
        z = -40 + 120 * math.sin(phase * 0.57 + index * 0.23)
        radius = 30 + (index % 4) * 2.0
        draw_portrait_pod(frame, avatar, x, y, z, radius, phase,
                          (BLUE, PINK, (205, 216, 231))[index % 3])


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


def composite_projected_rgba(
    frame: Image.Image,
    source: np.ndarray,
    transform: np.ndarray,
    corners: np.ndarray,
) -> None:
    """Perspective warp a small texture only over its projected bounding box."""
    projected = cv2.perspectiveTransform(corners.reshape(1, -1, 2).astype(np.float32), transform)[0]
    x0 = max(0, int(math.floor(projected[:, 0].min() - 2)))
    y0 = max(0, int(math.floor(projected[:, 1].min() - 2)))
    x1 = min(WIDTH, int(math.ceil(projected[:, 0].max() + 3)))
    y1 = min(HEIGHT, int(math.ceil(projected[:, 1].max() + 3)))
    if x1 <= x0 or y1 <= y0:
        return
    translate = np.array([[1.0, 0.0, -x0], [0.0, 1.0, -y0], [0.0, 0.0, 1.0]])
    local_transform = translate @ transform
    warped = cv2.warpPerspective(
        source, local_transform, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0),
    )
    frame.alpha_composite(Image.fromarray(warped, "RGBA"), (x0, y0))


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
    grain = np.random.default_rng(9481).normal(0.0, 1.7, (h, w))
    block_values = np.array(
        [[5, -4, 3, -2], [-3, 5, -4, 4], [3, -3, 5, -4],
         [-4, 4, -2, 5], [5, -3, 4, -4], [-2, 5, -3, 4]],
        dtype=np.float32,
    )
    block_texture = block_values[(yy // 88) % 6, (xx // 193) % 4]
    seams = ((yy % 88) < 2) | ((xx % 193) < 2)
    surface = 2.4 * np.sin(yy / 18.0) + 1.25 * np.cos(yy / 43.0)
    surface += block_texture - seams.astype(np.float32) * 4.5

    # Low-amplitude bump normals, a moving softbox reflection, and a shallow
    # silhouette bevel give the painted face a matte, physically lit finish.
    bump = 0.035 * np.sin(xx / 18.0) + 0.022 * np.cos(yy / 13.0)
    bump_x = np.gradient(bump, axis=1)
    bump_y = np.gradient(bump, axis=0)
    nx, ny, nz = -bump_x * 8.0, -bump_y * 8.0, np.ones((h, w), dtype=np.float32)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / norm, ny / norm, nz / norm
    phase = math.tau * t / duration
    lx = 0.30 + 0.08 * math.sin(phase)
    ly = -0.44 + 0.05 * math.cos(phase)
    lz = math.sqrt(max(0.2, 1.0 - lx * lx - ly * ly))
    ndotl = np.clip(nx * lx + ny * ly + nz * lz, 0.0, 1.0)
    directional = 0.94 + 0.13 * ndotl
    distance = cv2.distanceTransform(np.uint8(alpha > 150), cv2.DIST_L2, 3)
    edge_x = cv2.Sobel(distance, cv2.CV_32F, 1, 0, ksize=3)
    edge_y = cv2.Sobel(distance, cv2.CV_32F, 0, 1, ksize=3)
    edge_norm = np.sqrt(edge_x * edge_x + edge_y * edge_y) + 1e-5
    edge_dot = (edge_x * lx - edge_y * ly) / edge_norm
    bevel = np.clip(1.0 - distance / 18.0, 0.0, 1.0)
    bevel_light = 1.0 + bevel * edge_dot * 0.055
    sweep = (-0.22 + 1.44 * (0.5 + 0.5 * math.sin(phase - 0.8))) * w
    specular = 6.5 * np.exp(-0.5 * ((xx - sweep) / (w * 0.075)) ** 2)
    specular *= np.exp(-0.5 * ((yy - h * 0.33) / (h * 0.56)) ** 2)
    material = np.ones((h, w), dtype=np.float32)
    material[flag_fill] = directional[flag_fill] * bevel_light[flag_fill]
    rgb *= material[..., None]
    texture = grain + surface + specular
    rgb[flag_fill] += texture[flag_fill, None]
    # Restrained edge reflections keep the black keyline dark and continuous.
    edge_band = (alpha > 150) & (distance < 10)
    rgb[edge_band] *= (0.975 + 0.025 * np.clip(edge_dot[edge_band], -1.0, 1.0))[:, None]
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
    light = np.array((-0.42, 0.63, 0.65))
    light /= np.linalg.norm(light)
    half_vector = light + np.array((0.0, 0.0, 1.0))
    half_vector /= np.linalg.norm(half_vector)
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
        shade = 0.50 + 0.39 * light_amount
        specular = max(0.0, float(normal3 @ half_vector)) ** 15 * 0.16
        tint = np.array((8, 12, 22), dtype=np.float32)
        if normal3[0] > 0:
            tint += np.array((5, 1, 7), dtype=np.float32) * min(1.0, normal3[0])
        else:
            tint += np.array((0, 5, 10), dtype=np.float32) * min(1.0, -normal3[0])
        color = color * shade + tint * (1 - shade) + 255 * specular
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

def draw_labels(frame: Image.Image, t: float, duration: float) -> None:
    draw = ImageDraw.Draw(frame)
    phase = math.tau * t / duration
    # Keep the title and destination readable inside the scene without UI chrome.
    title_y = 18 + round(math.sin(phase) * 1.2)
    center_text(draw, 600, title_y, "KICKASS TRANSFEMS",
                load_font(29, heavy=True), (255, 255, 255, 255), 2,
                (6, 13, 25, 240), 1.15)
    center_text(draw, 600, 54, "18 TRANSFEM CREATORS ON KICK",
                load_font(13, heavy=True), (238, 244, 249, 255), 1,
                (7, 14, 26, 235), 0.72)
    center_text(draw, 600, 596, "MEET THE CREW",
                load_font(16, heavy=True), (255, 255, 255, 255), 2,
                (7, 14, 26, 240), 0.8)
    center_text(draw, 600, 616, "KAZVT.COM/KT",
                load_font(9, heavy=True), (222, 231, 240, 255), 1,
                (7, 14, 26, 235), 1.05)


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
    frame = make_background(cap, source_time)
    draw_atmospheric_lights(frame, t, duration)
    frame = frame.convert("RGBA")
    distant_props = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_3d_props(distant_props, t, duration, foreground=False)
    frame.alpha_composite(distant_props.filter(ImageFilter.GaussianBlur(1.15)))
    draw_floating_team(frame, roster, t, duration)
    render_3d_k(frame, face, contour, t, duration)
    draw_3d_props(frame, t, duration, foreground=True)
    draw_labels(frame, t, duration)
    return frame.convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--fps", type=int, default=8)
    parser.add_argument("--seconds", type=float, default=5.6)
    parser.add_argument("--colors", type=int, default=48)
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
