#!/usr/bin/env python3
"""Rebuild the public reward artwork catalog from the source image files.

This is shared by the local reward editor and can also be run directly after
changing the files in ``zzz_assets/rewards``.  Image bytes are never rewritten;
the catalog stores their SHA-256 identity, dimensions, and hash-derived tier.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
import warnings
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError


ROOT = Path(__file__).resolve().parents[1]
REWARDS_DIR = Path("zzz_assets/rewards")
CATALOG_NAME = "manifest.json"
TIER_IDS = ("common", "uncommon", "rare", "epic", "legendary", "mythic", "divine", "splus")
FILENAME_RE = re.compile(r"^[^/\\\x00-\x1f\x7f]{1,255}\.(?:png|gif)$", re.IGNORECASE)
MAX_IMAGE_PIXELS = 64_000_000


class CatalogError(ValueError):
    """A safe, actionable catalog build error."""


def normalize_tier_weights(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or len(value) != len(TIER_IDS):
        raise CatalogError("The reward tier list must contain the eight existing tiers in order.")
    result: list[dict[str, Any]] = []
    for expected_id, entry in zip(TIER_IDS, value):
        if not isinstance(entry, dict) or entry.get("id") != expected_id:
            raise CatalogError("Reward tier IDs and order must remain common through splus.")
        label = entry.get("label")
        weight = entry.get("basisPoints")
        if (not isinstance(label, str) or not label.strip() or len(label.strip()) > 60 or
                any(ord(character) < 32 or 0x7f <= ord(character) <= 0x9f for character in label) or
                isinstance(weight, bool) or not isinstance(weight, int) or not 0 <= weight <= 10_000):
            raise CatalogError(f"The {expected_id} tier needs a short label and a whole-number weight from 0 to 10,000.")
        result.append({"id": expected_id, "label": label.strip(), "basisPoints": weight})
    if sum(entry["basisPoints"] for entry in result) != 10_000:
        raise CatalogError("Reward tier weights must add up to 10,000.")
    return result


def tier_for_asset_id(asset_id: str, tier_weights: list[dict[str, Any]]) -> str:
    bucket = (int(asset_id[:8], 16) * 10_000) // 0x1_0000_0000
    upper_bound = 0
    for tier in tier_weights:
        upper_bound += tier["basisPoints"]
        if bucket < upper_bound:
            return tier["id"]
    raise CatalogError("Tier weights did not cover the full hash range.")


def _image_metadata(path: Path) -> tuple[str, int, int]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as image:
                image_format = (image.format or "").upper()
                width, height = image.size
                if width < 1 or height < 1 or width * height > MAX_IMAGE_PIXELS:
                    raise CatalogError(f"{path.name}: image dimensions are invalid or too large.")
                expected_format = path.suffix[1:].upper()
                if image_format != expected_format:
                    raise CatalogError(f"{path.name}: file extension does not match its {image_format or 'unknown'} image data.")
                image.verify()
            # Pillow's verify() checks the encoded file without altering it.
            with Image.open(path) as image:
                return image_format, int(image.width), int(image.height)
    except CatalogError:
        raise
    except (OSError, ValueError, UnidentifiedImageError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as exc:
        raise CatalogError(f"{path.name}: could not decode this PNG/GIF.") from exc


def build_catalog(
    rewards_dir: Path,
    previous: dict[str, Any] | None = None,
    tier_weights: Any = None,
) -> dict[str, Any]:
    previous = previous or {}
    weights = normalize_tier_weights(
        tier_weights if tier_weights is not None else previous.get("tierWeights")
    )
    historical_names = previous.get("filenameHistory", {})
    if not isinstance(historical_names, dict):
        raise CatalogError("The previous reward filename history is invalid.")
    history = {
        name: (asset_id.lower() if isinstance(asset_id, str) else None)
        for name, asset_id in historical_names.items()
        if isinstance(name, str) and FILENAME_RE.fullmatch(name) and
        (asset_id is None or re.fullmatch(r"[a-f0-9]{64}", asset_id, re.IGNORECASE))
    }

    files: list[str] = []
    assets: dict[str, dict[str, Any]] = {}
    assets_by_id: dict[str, dict[str, Any]] = {}
    try:
        candidates = sorted(rewards_dir.iterdir(), key=lambda item: (item.name.casefold(), item.name))
    except OSError as exc:
        raise CatalogError("The reward artwork folder could not be read.") from exc

    for path in candidates:
        if path.is_symlink() or not path.is_file() or path.suffix.lower() not in {".png", ".gif"}:
            continue
        filename = path.name
        if not FILENAME_RE.fullmatch(filename):
            raise CatalogError(f"{filename!r} is not a safe PNG/GIF filename (maximum 255 characters).")
        try:
            data = path.read_bytes()
        except OSError as exc:
            raise CatalogError(f"{filename}: could not read the artwork file.") from exc
        image_format, width, height = _image_metadata(path)
        if not data:
            raise CatalogError(f"{filename}: artwork files cannot be empty.")
        asset_id = hashlib.sha256(data).hexdigest()
        if asset_id in assets_by_id:
            other = assets_by_id[asset_id]["filename"]
            raise CatalogError(f"{filename} and {other} contain identical bytes; each reward needs a unique artwork file.")
        tier = tier_for_asset_id(asset_id, weights)
        metadata = {
            "assetId": asset_id,
            "sha256": asset_id,
            "width": width,
            "height": height,
            "tier": tier,
        }
        files.append(filename)
        assets[filename] = metadata
        assets_by_id[asset_id] = {
            "filename": filename,
            "width": width,
            "height": height,
            "tier": tier,
        }
        history[filename] = asset_id

    return {
        "version": 4,
        "assetIdAlgorithm": "sha256-image-bytes-v1",
        "tierAlgorithm": "sha256-leading-32-bit-weighted-v2",
        "tierWeights": weights,
        "files": files,
        "assets": assets,
        "assetsById": assets_by_id,
        "filenameHistory": dict(sorted(history.items(), key=lambda item: (item[0].casefold(), item[0]))),
    }


def write_json_atomic(path: Path, value: Any) -> None:
    data = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", prefix=f"{path.name}.", suffix=".tmp",
                                         dir=path.parent, delete=False) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(data)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="website checkout root")
    parser.add_argument("--check", action="store_true", help="validate without writing")
    args = parser.parse_args()
    root = args.root.resolve()
    reward_dir = root / REWARDS_DIR
    catalog_path = reward_dir / CATALOG_NAME
    try:
        previous = json.loads(catalog_path.read_text(encoding="utf-8-sig"))
        if not isinstance(previous, dict):
            raise CatalogError("The existing reward catalog must be a JSON object.")
        catalog = build_catalog(reward_dir, previous)
        if not args.check:
            write_json_atomic(catalog_path, catalog)
        print(f"Validated {len(catalog['files'])} reward images; tiers and dimensions are current.")
        return 0
    except (OSError, json.JSONDecodeError, UnicodeError, CatalogError) as exc:
        print(f"Reward catalog was not changed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
