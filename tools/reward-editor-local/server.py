#!/usr/bin/env python3
"""Loopback-only reward editor for this working copy of kazvt.com.

The public pages are served directly from the checkout. Mutations are limited
to reward-owned files, require a per-process token and same-origin headers, and
never run Git, commit, push, or deploy.
"""

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import secrets
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import parse_qs, quote, unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]
EDITOR_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "reward" / "api"))
sys.path.insert(0, str(ROOT / "scripts"))

import local_issuer  # noqa: E402
from build_reward_catalog import CatalogError, build_catalog, normalize_tier_weights  # noqa: E402


ASSIGNMENTS_REL = "zzz_assets/rewards/assignments.json"
CATALOG_REL = "zzz_assets/rewards/manifest.json"
POOL_REL = "zzz_assets/rewards/pool.json"
RESERVATIONS_REL = "reward/api/reservations.local.txt"
MAX_JSON_BYTES = 8 * 1024 * 1024
MAX_UPLOAD_BYTES = 40 * 1024 * 1024
MAX_TEXT_BYTES = 4 * 1024 * 1024
IMAGE_EXTENSIONS = {".png", ".gif", ".webp", ".jpg", ".jpeg", ".svg"}
FONT_EXTENSIONS = {".woff", ".woff2", ".ttf", ".otf"}
MEDIA_DIRS = (
    "reward/patterns",
    "reward/retro",
    "reward/list/gifcities",
    "zzz_assets/fonts",
)
SPECIAL_TEXT_FILES = {
    ASSIGNMENTS_REL,
    CATALOG_REL,
    POOL_REL,
    "reward/index.html",
    "reward/demo/index.html",
}
GENERATED_FILES = {CATALOG_REL, POOL_REL, "reward/index.html", "reward/demo/index.html"}
SOURCE_ROOTS = ("reward", "_includes/reward", "scripts")
SOURCE_SINGLE_FILES = {"i18n.js", "zzz_shared/square-corners.css"}
SOURCE_EXTENSIONS = {".css", ".html", ".js", ".mjs", ".json", ".md", ".py", ".svg", ".txt"}
LOCAL_ONLY_NAMES = {
    "reservations.local.txt",
    "reservations-manifest.local.json",
    "msi-manifest.local.json",
}
FILE_LOCK = threading.RLock()
CSRF_TOKEN = secrets.token_urlsafe(32)


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _read_json(relative: str) -> dict[str, Any]:
    path = ROOT / relative
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError, UnicodeError) as exc:
        raise ApiError(500, f"Could not read {relative}.") from exc
    if not isinstance(data, dict):
        raise ApiError(500, f"{relative} is not a JSON object.")
    return data


def _file_hash(path: Path) -> str:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except FileNotFoundError:
        return ""


def _reservation_source() -> str:
    path = ROOT / RESERVATIONS_REL
    try:
        return path.read_text(encoding="utf-8-sig")
    except FileNotFoundError:
        return ""
    except (OSError, UnicodeError) as exc:
        raise ApiError(500, "Could not read the private reservation file.") from exc


def _validate_registry_for_catalog(registry: dict[str, Any], catalog: dict[str, Any]) -> None:
    local_issuer._validate_registry(registry)
    active_ids: set[str] = set()
    for assignment in registry["assignments"]:
        asset_id = str(assignment.get("assetId", assignment.get("assetSha256", ""))).lower()
        indexed = catalog.get("assetsById", {}).get(asset_id)
        if not indexed or assignment.get("filename") != indexed.get("filename"):
            raise ApiError(400, f"Active reward {assignment.get('linkId') or '(without link ID)'} points to artwork missing from the current catalog.")
        if asset_id in active_ids:
            raise ApiError(400, "The active assignment list cannot use the same artwork twice.")
        active_ids.add(asset_id)


def _load_core() -> tuple[dict[str, Any], dict[str, Any], str, dict[str, Any]]:
    catalog = _read_json(CATALOG_REL)
    registry = _read_json(ASSIGNMENTS_REL)
    local_issuer._validate_catalog(catalog)
    _validate_registry_for_catalog(registry, catalog)
    reservation_text = _reservation_source()
    reservations = local_issuer._load_reservations(ROOT, catalog, source_override=reservation_text)
    return catalog, registry, reservation_text, reservations


def _pool(catalog: dict[str, Any], registry: dict[str, Any], reservations: dict[str, Any]) -> dict[str, int]:
    return local_issuer._anonymous_pool_summary(catalog, registry, reservations)


def _backup_path(path: Path) -> Path:
    relative = path.relative_to(ROOT)
    stamp = f"{time.time_ns()}-{secrets.token_hex(3)}"
    return ROOT / ".git" / "reward-editor-backups" / stamp / relative


def _write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
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


def _transaction(updates: dict[Path, bytes], deletes: set[Path] | None = None) -> None:
    deletes = deletes or set()
    all_paths = set(updates) | deletes
    if not all_paths:
        return
    original: dict[Path, bytes | None] = {}
    temporary: dict[Path, Path] = {}
    changed: list[Path] = []
    for path in all_paths:
        if not path.resolve().is_relative_to(ROOT.resolve()) or path == ROOT:
            raise ApiError(400, "A file operation escaped the website folder.")
        if path.exists() and not path.is_file():
            raise ApiError(400, "A file operation can only target regular files.")
        original[path] = path.read_bytes() if path.exists() else None

    try:
        for path, prior in original.items():
            if prior is not None:
                backup = _backup_path(path)
                backup.parent.mkdir(parents=True, exist_ok=True)
                backup.write_bytes(prior)
        for path, data in updates.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(mode="wb", prefix=f"{path.name}.", suffix=".tmp",
                                             dir=path.parent, delete=False) as handle:
                temporary[path] = Path(handle.name)
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
        for path in updates:
            os.replace(temporary.pop(path), path)
            changed.append(path)
        for path in deletes:
            path.unlink(missing_ok=True)
            changed.append(path)
    except Exception as exc:
        rollback_error = None
        for path in reversed(changed):
            prior = original[path]
            try:
                if prior is None:
                    path.unlink(missing_ok=True)
                else:
                    _write_atomic(path, prior)
            except OSError as rollback_exc:
                rollback_error = rollback_exc
        if rollback_error:
            raise ApiError(500, "A file update failed and automatic rollback also failed. Use the local editor backups in .git/reward-editor-backups.") from rollback_error
        if isinstance(exc, ApiError):
            raise
        raise ApiError(500, "The files could not be saved; the previous contents were restored.") from exc
    finally:
        for temporary_path in temporary.values():
            temporary_path.unlink(missing_ok=True)


def _save_registry(registry: dict[str, Any], catalog: dict[str, Any], reservation_text: str) -> dict[str, int]:
    _validate_registry_for_catalog(registry, catalog)
    reservations = local_issuer._load_reservations(ROOT, catalog, source_override=reservation_text)
    pool = _pool(catalog, registry, reservations)
    _transaction({
        ROOT / ASSIGNMENTS_REL: _json_bytes(registry),
        ROOT / POOL_REL: _json_bytes(pool),
    })
    return pool


def _safe_relative(raw: str) -> str:
    if not isinstance(raw, str) or not raw or "\\" in raw or "\x00" in raw:
        raise ApiError(400, "The file path is invalid.")
    decoded = unquote(raw)
    pure = PurePosixPath(decoded)
    if pure.is_absolute() or any(part in {"", ".", ".."} or part.startswith(".") for part in pure.parts):
        raise ApiError(400, "The file path is invalid.")
    relative = pure.as_posix()
    if any(part in LOCAL_ONLY_NAMES or part.endswith(".tmp") for part in pure.parts):
        raise ApiError(404, "That local/private file is not available through the editor.")
    return relative


def _source_path(relative: str) -> Path:
    relative = _safe_relative(relative)
    allowed = relative in SOURCE_SINGLE_FILES or any(relative == root or relative.startswith(root + "/") for root in SOURCE_ROOTS)
    if not allowed:
        raise ApiError(404, "That file is outside the reward source editor.")
    if relative.startswith("reward/api/"):
        if Path(relative).name in LOCAL_ONLY_NAMES or "__pycache__" in PurePosixPath(relative).parts:
            raise ApiError(404, "That local/private file is not available through the editor.")
    if relative.startswith("zzz_assets/rewards/"):
        if relative not in {ASSIGNMENTS_REL, CATALOG_REL, POOL_REL}:
            raise ApiError(404, "Reward artwork belongs in the artwork editor.")
        if relative == CATALOG_REL or relative == POOL_REL:
            raise ApiError(409, "This file is generated from artwork and tier settings; edit those inputs instead.")
    path = (ROOT / Path(*PurePosixPath(relative).parts)).resolve()
    if not path.is_relative_to(ROOT.resolve()):
        raise ApiError(400, "The file path is outside this website checkout.")
    if path.suffix.lower() not in SOURCE_EXTENSIONS:
        raise ApiError(415, "This source editor only opens text-based reward files.")
    return path


def _list_source_files() -> list[dict[str, Any]]:
    results = []
    candidates: set[str] = set(SOURCE_SINGLE_FILES)
    for root_name in SOURCE_ROOTS:
        root = ROOT / root_name
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or path.is_symlink() or path.suffix.lower() not in SOURCE_EXTENSIONS:
                continue
            relative = path.relative_to(ROOT).as_posix()
            parts = PurePosixPath(relative).parts
            if any(part.startswith(".") or part == "__pycache__" for part in parts):
                continue
            if path.name in LOCAL_ONLY_NAMES or path.name.endswith(".tmp"):
                continue
            if relative.startswith("zzz_assets/rewards/") and relative not in {ASSIGNMENTS_REL, CATALOG_REL, POOL_REL}:
                continue
            candidates.add(relative)
    for relative in sorted(candidates, key=str.casefold):
        try:
            path = _source_path(relative)
            is_generated = relative in GENERATED_FILES
            results.append({
                "path": relative,
                "digest": _file_hash(path),
                "generated": is_generated,
                "readOnly": is_generated or relative in {CATALOG_REL, POOL_REL},
            })
        except ApiError:
            continue
    return results


def _list_media_assets() -> list[dict[str, Any]]:
    results = []
    for folder in MEDIA_DIRS:
        base = ROOT / folder
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.is_symlink() or path.name.startswith("."):
                continue
            ext = path.suffix.lower()
            if ext not in IMAGE_EXTENSIONS | FONT_EXTENSIONS:
                continue
            relative = path.relative_to(ROOT).as_posix()
            results.append({
                "path": relative,
                "digest": _file_hash(path),
                "kind": "font" if ext in FONT_EXTENSIONS else "image",
                "url": "/" + relative,
            })
    return sorted(results, key=lambda entry: entry["path"].casefold())


def _list_artwork(catalog: dict[str, Any], registry: dict[str, Any], reservations: dict[str, Any]) -> list[dict[str, Any]]:
    assigned = {
        str(item.get("assetId", item.get("assetSha256", ""))).lower(): item
        for item in registry.get("assignments", [])
    }
    reserved = {str(asset_id).lower() for asset_id in reservations["assetIds"]}
    results = []
    for filename in catalog["files"]:
        metadata = catalog["assets"][filename]
        assignment = assigned.get(metadata["assetId"])
        results.append({
            "filename": filename,
            "assetId": metadata["assetId"],
            "width": metadata["width"],
            "height": metadata["height"],
            "tier": metadata["tier"],
            "digest": _file_hash(ROOT / "zzz_assets" / "rewards" / filename),
            "assigned": bool(assignment),
            "reserved": metadata["assetId"] in reserved,
            "assignedTo": assignment.get("username", "") if assignment else "",
            "url": "/zzz_assets/rewards/" + quote(filename, safe=""),
        })
    return results


def _state() -> dict[str, Any]:
    catalog, registry, reservation_text, reservations = _load_core()
    pool = _pool(catalog, registry, reservations)
    return {
        "catalog": catalog,
        "assignments": registry.get("assignments", []),
        "editorArchivedAssignments": registry.get("editorArchivedAssignments", []),
        "revokedAssignments": registry.get("revokedAssignments", []),
        "reservationText": reservation_text,
        "artwork": _list_artwork(catalog, registry, reservations),
        "mediaAssets": _list_media_assets(),
        "sourceFiles": _list_source_files(),
        "pool": pool,
        "digests": {
            "catalog": _file_hash(ROOT / CATALOG_REL),
            "assignments": _file_hash(ROOT / ASSIGNMENTS_REL),
            "pool": _file_hash(ROOT / POOL_REL),
            "reservations": _file_hash(ROOT / RESERVATIONS_REL),
        },
    }


def _check_digest(path: Path, expected: Any) -> None:
    if not isinstance(expected, str) or expected != _file_hash(path):
        raise ApiError(409, "This file changed since the editor loaded it. Reload the section and review the latest version before saving.")


def _normalize_username(value: Any) -> str:
    username = unicodedata.normalize("NFKC", value).strip().lstrip("@").strip() if isinstance(value, str) else ""
    if not username or len(username) > 100 or any(unicodedata.category(char) == "Cc" for char in username):
        raise ApiError(400, "Enter a username from 1 to 100 characters without control characters.")
    return username


def _check_reserved_for_user(asset_id: str, username: str, user_id: str, reservations: dict[str, Any]) -> None:
    if asset_id in reservations["assetIds"]:
        allowed = local_issuer._reserved_assets_for_identity(reservations, username, user_id)
        if asset_id not in allowed:
            raise ApiError(409, "That artwork is privately reserved for a different username.")


def _rebuild_current_catalog(
    catalog: dict[str, Any], registry: dict[str, Any], reservation_text: str,
    *, overrides: dict[str, bytes] | None = None, removed_names: set[str] | None = None,
    tier_weights: Any = None,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, int]]:
    next_catalog = build_catalog(
        ROOT / "zzz_assets" / "rewards", catalog, tier_weights,
        overrides=overrides, removed_names=removed_names,
    )
    next_registry = json.loads(json.dumps(registry, ensure_ascii=False))
    override_names = set((overrides or {}).keys())
    removed_folded = {name.casefold() for name in (removed_names or set())}
    for record in next_registry.get("assignments", []):
        old_id = str(record.get("assetId", record.get("assetSha256", ""))).lower()
        old_filename = str(record.get("filename", ""))
        replacement_name = next((name for name in override_names if name.casefold() == old_filename.casefold()), "")
        if not replacement_name and old_filename.casefold() in removed_folded:
            # A rename replaces the old filename with exactly one new filename.
            replacement_name = next(iter(override_names), "")
        current = next_catalog["assets"].get(replacement_name or old_filename)
        if current and (old_id not in next_catalog["assetsById"] or replacement_name):
            record["assetId"] = current["assetId"]
            if "assetSha256" in record:
                record["assetSha256"] = current["assetId"]
            record["filename"] = replacement_name or old_filename

    reservations = local_issuer._load_reservations(ROOT, next_catalog, source_override=reservation_text)
    _validate_registry_for_catalog(next_registry, next_catalog)
    pool = _pool(next_catalog, next_registry, reservations)
    return next_catalog, next_registry, reservations, pool


def _rewrite_reservation_targets(source: str, old_filename: str, new_filename: str) -> str:
    rewritten = []
    for line in source.splitlines(keepends=True):
        body = line.rstrip("\r\n")
        ending = line[len(body):]
        stripped = body.strip()
        if not stripped or stripped.startswith("#"):
            rewritten.append(line)
            continue
        separator = local_issuer.RESERVATION_SEPARATOR_RE.search(body)
        if not separator:
            rewritten.append(line)
            continue
        target = body[separator.end():].strip()
        basename = re.split(r"[\\/]", target.strip("\"'<>") )[-1].strip()
        if basename.casefold() != old_filename.casefold():
            rewritten.append(line)
            continue
        prefix = target[:max(target.rfind("/"), target.rfind("\\")) + 1]
        quote = target[0] if len(target) > 1 and target[0] == target[-1] and target[0] in "\"'<>“”" else ""
        if quote:
            inner = target[1:-1]
            prefix = inner[:max(inner.rfind("/"), inner.rfind("\\")) + 1]
            value = f"{quote}{prefix}{new_filename}{quote}"
        else:
            value = prefix + new_filename
        rewritten.append(body[:separator.end()] + value + ending)
    return "".join(rewritten)


def _validate_media_bytes(relative: str, data: bytes) -> None:
    ext = Path(relative).suffix.lower()
    if not data:
        raise ApiError(400, "Uploaded files cannot be empty.")
    if ext in {".png", ".gif", ".webp", ".jpg", ".jpeg"}:
        # The catalog builder is authoritative for PNG/GIF. Pillow validates
        # other raster media without transcoding the original bytes.
        try:
            from PIL import Image, UnidentifiedImageError
            import io
            with Image.open(io.BytesIO(data)) as image:
                expected = {".jpg": "JPEG", ".jpeg": "JPEG"}.get(ext, ext[1:].upper())
                if image.format != expected or image.width * image.height > 64_000_000:
                    raise ApiError(400, "The uploaded image is invalid or its extension does not match its contents.")
                image.verify()
        except ApiError:
            raise
        except Exception as exc:
            raise ApiError(400, "The uploaded image could not be decoded.") from exc
    elif ext == ".svg":
        text = data.decode("utf-8", errors="strict")
        if "<svg" not in text[:4096].lower() or re.search(r"<script\b|\bon\w+\s*=|javascript:", text, re.IGNORECASE):
            raise ApiError(400, "Only a plain SVG image without scripts or event handlers is accepted.")
    elif ext in FONT_EXTENSIONS:
        signatures = {
            ".woff": (b"wOFF", b"wOF2"),
            ".woff2": (b"wOF2",),
            ".ttf": (b"\x00\x01\x00\x00", b"true"),
            ".otf": (b"OTTO",),
        }
        if not data.startswith(signatures[ext]):
            raise ApiError(400, "The uploaded font file does not match its extension.")
    else:
        raise ApiError(415, "That file type is not editable as a reward media asset.")


def _media_path(relative: str) -> Path:
    relative = _safe_relative(relative)
    if not any(relative == folder or relative.startswith(folder + "/") for folder in MEDIA_DIRS):
        raise ApiError(404, "That asset folder is outside the reward editor.")
    path = (ROOT / Path(*PurePosixPath(relative).parts)).resolve()
    if not path.is_relative_to(ROOT.resolve()):
        raise ApiError(400, "The asset path is outside this checkout.")
    return path


def _source_digest_map() -> dict[str, str]:
    return {entry["path"]: entry["digest"] for entry in _list_source_files()}


def _save_text_file(relative: str, text: str, expected: str) -> dict[str, Any]:
    path = _source_path(relative)
    if relative in GENERATED_FILES:
        raise ApiError(409, "This file is generated. Edit its source template instead.")
    if len(text.encode("utf-8")) > MAX_TEXT_BYTES:
        raise ApiError(413, "That source file is larger than the editor's 4 MB safety limit.")
    _check_digest(path, expected)
    if relative == ASSIGNMENTS_REL:
        try:
            registry = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ApiError(400, f"Assignments JSON is invalid near line {exc.lineno}, column {exc.colno}.") from exc
        if not isinstance(registry, dict):
            raise ApiError(400, "The assignment registry must be a JSON object.")
        catalog, _, reservation_text, _ = _load_core()
        pool = _save_registry(registry, catalog, reservation_text)
        return {"message": "Assignments and pool count saved to the working tree.", "pool": pool}
    if path.suffix.lower() == ".json":
        try:
            json.loads(text)
        except json.JSONDecodeError as exc:
            raise ApiError(400, f"JSON is invalid near line {exc.lineno}, column {exc.colno}.") from exc
    _transaction({path: text.encode("utf-8")})
    rebuilt = False
    if relative in {"_includes/reward/head-assets.html", "_includes/reward/body.html",
                    "reward/reward.css", "reward/demo/demo.css", "reward/reward.js"}:
        command = subprocess.run(
            ["node", "scripts/build-reward-pages.mjs"], cwd=ROOT, capture_output=True,
            text=True, timeout=30, check=False,
        )
        if command.returncode != 0:
            return {
                "message": "The source file was saved, but the generated detail pages could not rebuild. Fix the source and use Rebuild generated pages.",
                "rebuiltRewardPages": False,
                "sourceSaved": True,
            }
        rebuilt = True
    return {"message": "Source file saved to the working tree.", "rebuiltRewardPages": rebuilt}


def _payload_bytes(handler: BaseHTTPRequestHandler, max_bytes: int) -> bytes:
    raw_length = handler.headers.get("Content-Length", "")
    try:
        length = int(raw_length)
    except ValueError as exc:
        raise ApiError(411, "A valid Content-Length header is required.") from exc
    if length < 1:
        raise ApiError(400, "The request body is empty.")
    if length > max_bytes:
        raise ApiError(413, "That file is larger than the local editor's safety limit.")
    return handler.rfile.read(length)


def _json_payload(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    raw = _payload_bytes(handler, MAX_JSON_BYTES)
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ApiError(400, "The request body must be valid UTF-8 JSON.") from exc
    if not isinstance(value, dict):
        raise ApiError(400, "The request body must be a JSON object.")
    return value


def _assignment_mutation(payload: dict[str, Any]) -> dict[str, Any]:
    catalog, registry, reservation_text, reservations = _load_core()
    _check_digest(ROOT / ASSIGNMENTS_REL, payload.get("expectedAssignments"))
    action = payload.get("action")
    next_registry = json.loads(json.dumps(registry, ensure_ascii=False))
    active = next_registry.setdefault("assignments", [])
    editor_archived = next_registry.setdefault("editorArchivedAssignments", [])

    if action == "create":
        fields = payload.get("assignment")
        if not isinstance(fields, dict):
            raise ApiError(400, "Assignment details are missing.")
        asset_id = str(fields.get("assetId", "")).lower()
        indexed = catalog.get("assetsById", {}).get(asset_id)
        if not indexed:
            raise ApiError(400, "Choose artwork that exists in the current reward catalog.")
        username = _normalize_username(fields.get("username"))
        platform = unicodedata.normalize("NFKC", fields.get("platform", "")).strip().casefold() if isinstance(fields.get("platform", ""), str) else ""
        user_id = unicodedata.normalize("NFKC", fields.get("userId", "")).strip() if isinstance(fields.get("userId", ""), str) else ""
        reason = local_issuer._normalize_assignment_reason(fields.get("reason", ""))
        _check_reserved_for_user(asset_id, username, user_id, reservations)
        if any(str(item.get("assetId", item.get("assetSha256", ""))).lower() == asset_id for item in active):
            raise ApiError(409, "That artwork is already assigned. Edit or archive its current assignment first.")
        link_id = secrets.token_urlsafe(12)
        while any(item.get("linkId") == link_id for item in [*active, *next_registry.get("revokedAssignments", []), *editor_archived]):
            link_id = secrets.token_urlsafe(12)
        issued_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        record = {
            "assetId": asset_id,
            "assetSha256": asset_id,
            "filename": indexed["filename"],
            "username": username,
            "issuedAt": issued_at,
            "platform": platform,
            "linkId": link_id,
            "reason": reason,
        }
        if user_id:
            record["userId"] = user_id
        active.append(record)
        href = f"/reward/?id={link_id}"
    elif action == "update":
        link_id = payload.get("linkId")
        fields = payload.get("assignment")
        if not isinstance(link_id, str) or not isinstance(fields, dict):
            raise ApiError(400, "Select an existing assignment to edit.")
        record = next((item for item in active if item.get("linkId") == link_id), None)
        if record is None:
            raise ApiError(404, "That active reward assignment no longer exists.")
        asset_id = str(fields.get("assetId", record.get("assetId", ""))).lower()
        indexed = catalog.get("assetsById", {}).get(asset_id)
        if not indexed:
            raise ApiError(400, "Choose artwork that exists in the current reward catalog.")
        username = _normalize_username(fields.get("username"))
        platform = unicodedata.normalize("NFKC", fields.get("platform", "")).strip().casefold() if isinstance(fields.get("platform", ""), str) else ""
        user_id = unicodedata.normalize("NFKC", fields.get("userId", "")).strip() if isinstance(fields.get("userId", ""), str) else ""
        reason = local_issuer._normalize_assignment_reason(fields.get("reason", ""))
        new_link_id = fields.get("linkId", link_id)
        if not isinstance(new_link_id, str) or not new_link_id:
            raise ApiError(400, "The reward URL ID cannot be blank.")
        _check_reserved_for_user(asset_id, username, user_id, reservations)
        if any(item is not record and str(item.get("assetId", item.get("assetSha256", ""))).lower() == asset_id for item in active):
            raise ApiError(409, "That artwork is already used by another active reward.")
        record.update({
            "assetId": asset_id,
            "filename": indexed["filename"],
            "username": username,
            "platform": platform,
            "reason": reason,
            "linkId": new_link_id,
        })
        if "assetSha256" in record:
            record["assetSha256"] = asset_id
        if user_id:
            record["userId"] = user_id
        else:
            record.pop("userId", None)
        issued_at = fields.get("issuedAt", record.get("issuedAt"))
        if isinstance(issued_at, str) and issued_at.strip():
            record["issuedAt"] = issued_at.strip()
        href = f"/reward/?id={new_link_id}"
    elif action == "archive":
        link_id = payload.get("linkId")
        record = next((item for item in active if item.get("linkId") == link_id), None)
        if record is None:
            raise ApiError(404, "That active reward assignment no longer exists.")
        if not record.get("linkId"):
            raise ApiError(409, "This older assignment has no stable reward URL ID, so it cannot be safely archived yet.")
        active.remove(record)
        editor_archived.append({
            **record,
            "editorArchivedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "editorArchivedBy": "kazvt",
        })
        href = ""
    elif action == "restore":
        link_id = payload.get("linkId")
        record = next((item for item in editor_archived if item.get("linkId") == link_id), None)
        if record is None:
            raise ApiError(404, "That locally archived reward no longer exists.")
        asset_id = str(record.get("assetId", record.get("assetSha256", ""))).lower()
        if not catalog.get("assetsById", {}).get(asset_id):
            raise ApiError(409, "The original artwork is no longer in the catalog; update the reward artwork first.")
        _check_reserved_for_user(asset_id, record.get("username", ""), record.get("userId", ""), reservations)
        if any(str(item.get("assetId", item.get("assetSha256", ""))).lower() == asset_id for item in active):
            raise ApiError(409, "The original artwork is currently assigned to another reward.")
        editor_archived.remove(record)
        record.pop("editorArchivedAt", None)
        record.pop("editorArchivedBy", None)
        active.append(record)
        href = f"/reward/?id={record['linkId']}"
    else:
        raise ApiError(400, "Unknown assignment action.")

    pool = _save_registry(next_registry, catalog, reservation_text)
    return {"message": "Reward assignment saved to the working tree; nothing was pushed.", "pool": pool, "href": href}


def _artwork_upload(handler: BaseHTTPRequestHandler, query: dict[str, list[str]]) -> dict[str, Any]:
    filename = query.get("filename", [""])[0]
    replace_name = query.get("replace", [""])[0]
    expected_catalog = handler.headers.get("X-Expected-Catalog", "")
    expected_file = handler.headers.get("X-Expected-File", "")
    body = _payload_bytes(handler, MAX_UPLOAD_BYTES)
    if not isinstance(filename, str) or not local_issuer.FILENAME_RE.fullmatch(filename):
        raise ApiError(400, "Reward artwork needs a simple .png or .gif filename (the title becomes the reward name).")
    target = ROOT / "zzz_assets" / "rewards" / filename
    current_catalog, registry, reservation_text, _ = _load_core()
    _check_digest(ROOT / CATALOG_REL, expected_catalog)
    if replace_name:
        if not local_issuer.FILENAME_RE.fullmatch(replace_name):
            raise ApiError(400, "The selected reward filename is invalid.")
        old_path = ROOT / "zzz_assets" / "rewards" / replace_name
        if replace_name not in current_catalog["files"]:
            raise ApiError(404, "The reward selected for replacement is no longer in the catalog.")
        _check_digest(old_path, expected_file)
        if target.exists() and target != old_path:
            raise ApiError(409, "A reward with that filename already exists.")
        old_id = current_catalog["assets"][replace_name]["assetId"]
        next_reservations_text = reservation_text
        if replace_name != filename:
            next_reservations_text = _rewrite_reservation_targets(reservation_text, replace_name, filename)
        next_catalog, next_registry, reservations, pool = _rebuild_current_catalog(
            current_catalog, registry, next_reservations_text,
            overrides={filename: body}, removed_names={replace_name} if replace_name != filename else set(),
        )
        new_id = next_catalog["assets"][filename]["assetId"]
        # If the hash did not change, records still need the new filename after a rename.
        for record in next_registry.get("assignments", []):
            if str(record.get("assetId", record.get("assetSha256", ""))).lower() == old_id or record.get("filename") == replace_name:
                record["assetId"] = new_id
                if "assetSha256" in record:
                    record["assetSha256"] = new_id
                record["filename"] = filename
        _validate_registry_for_catalog(next_registry, next_catalog)
        local_issuer._load_reservations(ROOT, next_catalog, source_override=next_reservations_text)
        pool = _pool(next_catalog, next_registry, reservations)
        updates = {
            target: body,
            ROOT / CATALOG_REL: _json_bytes(next_catalog),
            ROOT / ASSIGNMENTS_REL: _json_bytes(next_registry),
            ROOT / POOL_REL: _json_bytes(pool),
        }
        deletes = {old_path} if replace_name != filename else set()
        if next_reservations_text != reservation_text:
            updates[ROOT / RESERVATIONS_REL] = next_reservations_text.encode("utf-8")
        _transaction(updates, deletes)
        return {"message": "Artwork replaced. Its hash, dimensions, tier, assignment links, and pool count were recalculated.", "pool": pool, "filename": filename}

    if target.exists():
        raise ApiError(409, "A reward with that filename already exists. Select it and choose Replace instead.")
    next_catalog, next_registry, reservations, pool = _rebuild_current_catalog(
        current_catalog, registry, reservation_text, overrides={filename: body},
    )
    _validate_registry_for_catalog(next_registry, next_catalog)
    updates = {
        target: body,
        ROOT / CATALOG_REL: _json_bytes(next_catalog),
        ROOT / POOL_REL: _json_bytes(pool),
    }
    _transaction(updates)
    return {"message": "Artwork added. The catalog computed its hash, dimensions, tier, and pool count.", "pool": pool, "filename": filename}


def _artwork_mutation(payload: dict[str, Any]) -> dict[str, Any]:
    catalog, registry, reservation_text, reservations = _load_core()
    _check_digest(ROOT / CATALOG_REL, payload.get("expectedCatalog"))
    filename = payload.get("filename")
    if not isinstance(filename, str) or filename not in catalog["files"]:
        raise ApiError(404, "That artwork is no longer in the catalog.")
    asset_id = catalog["assets"][filename]["assetId"]
    if payload.get("action") == "delete":
        if any(str(item.get("assetId", item.get("assetSha256", ""))).lower() == asset_id for item in registry["assignments"]):
            raise ApiError(409, "That artwork is assigned. Change or archive its assignment before deleting the file.")
        if asset_id in reservations["assetIds"]:
            raise ApiError(409, "That artwork is reserved. Remove or retarget its private reservation before deleting the file.")
        next_catalog, next_registry, next_reservations, pool = _rebuild_current_catalog(
            catalog, registry, reservation_text, removed_names={filename},
        )
        local_issuer._load_reservations(ROOT, next_catalog, source_override=reservation_text)
        _transaction({
            ROOT / CATALOG_REL: _json_bytes(next_catalog),
            ROOT / POOL_REL: _json_bytes(pool),
        }, {ROOT / "zzz_assets" / "rewards" / filename})
        return {"message": "Unassigned artwork deleted from the working tree and catalog. It was not published.", "pool": pool}
    raise ApiError(400, "Unknown artwork action.")


def _rename_artwork(payload: dict[str, Any]) -> dict[str, Any]:
    catalog, registry, reservation_text, _ = _load_core()
    _check_digest(ROOT / CATALOG_REL, payload.get("expectedCatalog"))
    old_name = payload.get("filename")
    new_name = payload.get("newFilename")
    if not isinstance(old_name, str) or old_name not in catalog["files"]:
        raise ApiError(404, "That artwork is no longer in the catalog.")
    if not isinstance(new_name, str) or not local_issuer.FILENAME_RE.fullmatch(new_name):
        raise ApiError(400, "Reward artwork names need to end in .png or .gif.")
    old_path = ROOT / "zzz_assets" / "rewards" / old_name
    new_path = ROOT / "zzz_assets" / "rewards" / new_name
    _check_digest(old_path, payload.get("expectedFile"))
    if old_name.casefold() == new_name.casefold() or new_path.exists():
        raise ApiError(409, "Choose a different filename; reward names must be unique, including capitalization.")
    data = old_path.read_bytes()
    reservation_text_next = _rewrite_reservation_targets(reservation_text, old_name, new_name)
    next_catalog, next_registry, reservations, pool = _rebuild_current_catalog(
        catalog, registry, reservation_text_next,
        overrides={new_name: data}, removed_names={old_name},
    )
    _validate_registry_for_catalog(next_registry, next_catalog)
    updates = {
        new_path: data,
        ROOT / CATALOG_REL: _json_bytes(next_catalog),
        ROOT / ASSIGNMENTS_REL: _json_bytes(next_registry),
        ROOT / POOL_REL: _json_bytes(pool),
    }
    if reservation_text_next != reservation_text:
        updates[ROOT / RESERVATIONS_REL] = reservation_text_next.encode("utf-8")
    _transaction(updates, {old_path})
    return {"message": "Reward renamed; assignment links, reservation targets, and filename history were kept in sync.", "pool": pool, "filename": new_name}


def _save_reservations(payload: dict[str, Any]) -> dict[str, Any]:
    catalog, registry, old_text, _ = _load_core()
    path = ROOT / RESERVATIONS_REL
    _check_digest(path, payload.get("expectedReservations"))
    text = payload.get("text")
    if not isinstance(text, str) or len(text.encode("utf-8")) > 1_000_000:
        raise ApiError(413, "The private reservation list must be text under 1 MB.")
    reservations = local_issuer._load_reservations(ROOT, catalog, source_override=text)
    pool = _pool(catalog, registry, reservations)
    _transaction({path: text.encode("utf-8"), ROOT / POOL_REL: _json_bytes(pool)})
    return {"message": "Private reservations saved only on this computer; they are not included in public files.", "pool": pool, "count": len(reservations["entries"])}


def _save_tier_weights(payload: dict[str, Any]) -> dict[str, Any]:
    catalog, registry, reservation_text, _ = _load_core()
    _check_digest(ROOT / CATALOG_REL, payload.get("expectedCatalog"))
    weights = normalize_tier_weights(payload.get("tierWeights"))
    next_catalog, next_registry, reservations, pool = _rebuild_current_catalog(
        catalog, registry, reservation_text, tier_weights=weights,
    )
    _transaction({ROOT / CATALOG_REL: _json_bytes(next_catalog), ROOT / POOL_REL: _json_bytes(pool)})
    return {"message": "Tier labels and weights saved; artwork tiers were recalculated from their hashes.", "pool": pool}


def _rebuild_catalog(payload: dict[str, Any]) -> dict[str, Any]:
    catalog, registry, reservation_text, _ = _load_core()
    _check_digest(ROOT / CATALOG_REL, payload.get("expectedCatalog"))
    next_catalog = build_catalog(ROOT / "zzz_assets" / "rewards", catalog)
    next_registry = json.loads(json.dumps(registry, ensure_ascii=False))
    for record in next_registry.get("assignments", []):
        old_id = str(record.get("assetId", record.get("assetSha256", ""))).lower()
        if old_id not in next_catalog["assetsById"]:
            replacement = next_catalog["assets"].get(record.get("filename", ""))
            if replacement:
                record["assetId"] = replacement["assetId"]
                if "assetSha256" in record:
                    record["assetSha256"] = replacement["assetId"]
            else:
                raise ApiError(409, f"{record.get('filename')} changed or disappeared outside the editor. Use Replace/Rename in Artwork to preserve its assignment, or repair that assignment first.")
        record["filename"] = next_catalog["assetsById"][record["assetId"]]["filename"]
    reservations = local_issuer._load_reservations(ROOT, next_catalog, source_override=reservation_text)
    _validate_registry_for_catalog(next_registry, next_catalog)
    pool = _pool(next_catalog, next_registry, reservations)
    _transaction({ROOT / CATALOG_REL: _json_bytes(next_catalog), ROOT / ASSIGNMENTS_REL: _json_bytes(next_registry), ROOT / POOL_REL: _json_bytes(pool)})
    return {"message": "Reward catalog rebuilt from the current PNG/GIF files.", "pool": pool}


def _save_page_asset(handler: BaseHTTPRequestHandler, query: dict[str, list[str]]) -> dict[str, Any]:
    relative = query.get("path", [""])[0]
    directory = query.get("directory", [""])[0]
    filename = query.get("filename", [""])[0]
    raw_path = relative or f"{directory}/{filename}"
    path = _media_path(raw_path)
    if path.suffix.lower() not in IMAGE_EXTENSIONS | FONT_EXTENSIONS:
        raise ApiError(415, "Unsupported reward media file type.")
    _check_digest(path, handler.headers.get("X-Expected-File", ""))
    data = _payload_bytes(handler, MAX_UPLOAD_BYTES)
    _validate_media_bytes(path.as_posix(), data)
    _transaction({path: data})
    return {"message": "Reward media file saved to the working tree. No changes were pushed.", "path": path.relative_to(ROOT).as_posix()}


def _add_page_asset(handler: BaseHTTPRequestHandler, query: dict[str, list[str]]) -> dict[str, Any]:
    directory = query.get("directory", [""])[0]
    filename = query.get("filename", [""])[0]
    if not isinstance(filename, str) or Path(filename).name != filename or filename.startswith("."):
        raise ApiError(400, "Choose a simple media filename without a folder path.")
    path = _media_path(directory.rstrip("/") + "/" + filename)
    if path.exists():
        raise ApiError(409, "A media file with that name already exists.")
    data = _payload_bytes(handler, MAX_UPLOAD_BYTES)
    _validate_media_bytes(path.as_posix(), data)
    _transaction({path: data})
    return {"message": "Reward media file added to the working tree. Reference it in a reward component to use it.", "path": path.relative_to(ROOT).as_posix()}


def _delete_page_asset(payload: dict[str, Any]) -> dict[str, Any]:
    relative = payload.get("path", "")
    path = _media_path(relative)
    if not path.is_file():
        raise ApiError(404, "That media file no longer exists.")
    _check_digest(path, payload.get("expectedFile"))
    _transaction({}, {path})
    return {"message": "Reward media file deleted from the working tree. Review its references in Components before publishing."}


class RewardEditorServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class RewardEditorHandlerMixin:
    server_version = "KazvtRewardEditor/1.0"
    sys_version = ""

    def _expected_host(self) -> str:
        host = str(self.headers.get("Host", "")).strip()
        try:
            parsed = urlsplit("//" + host)
            if (
                (parsed.hostname or "").casefold() in {"127.0.0.1", "localhost", "::1"}
                and parsed.port == self.server.server_port
                and not parsed.username
                and not parsed.password
                and not parsed.path
                and not parsed.query
                and not parsed.fragment
            ):
                return host
        except (TypeError, ValueError):
            pass
        return f"127.0.0.1:{self.server.server_port}"

    def _check_host(self) -> None:
        if self.headers.get("Host", "").casefold() != self._expected_host().casefold():
            raise ApiError(421, "Use the exact local editor address printed by the server.")

    def _send(self, status: int, body: bytes, content_type: str, *, csp: str | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        if csp:
            self.send_header("Content-Security-Policy", csp)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _send_json(self, status: int, value: Any) -> None:
        self._send(status, _json_bytes(value), "application/json; charset=utf-8")

    def _error(self, status: int, message: str) -> None:
        self._send_json(status, {"error": message})

    def _parse_url(self):
        return urlsplit(self.path), parse_qs(urlsplit(self.path).query, keep_blank_values=True)

    def _editor_path(self, pathname: str) -> Path | None:
        prefix = "/reward/editor"
        if pathname in {prefix, prefix + "/"}:
            return EDITOR_DIR / "index.html"
        if pathname.startswith(prefix + "/"):
            file_name = pathname[len(prefix) + 1:]
            if file_name not in {"editor.js", "editor.css"}:
                return None
            return EDITOR_DIR / file_name
        return None

    def _public_path(self, pathname: str) -> Path:
        decoded = unquote(pathname)
        if "\\" in decoded or "\x00" in decoded:
            raise ApiError(404, "Not found.")
        pure = PurePosixPath(decoded.lstrip("/"))
        if any(part in {".", ".."} or part.startswith(".") for part in pure.parts):
            raise ApiError(404, "Not found.")
        relative = pure.as_posix()
        parts = pure.parts
        if not parts:
            relative = "index.html"
        if relative == "reward/api" or relative.startswith("reward/api/"):
            raise ApiError(404, "Not found.")
        if any(part in LOCAL_ONLY_NAMES or part.endswith(".tmp") for part in parts):
            raise ApiError(404, "Not found.")
        if parts and parts[0] == "tools" and len(parts) > 1 and parts[1] == "reward-editor-local":
            raise ApiError(404, "Not found.")
        path = (ROOT / Path(*PurePosixPath(relative).parts)).resolve()
        if not path.is_relative_to(ROOT.resolve()):
            raise ApiError(404, "Not found.")
        if path.is_dir():
            path = path / "index.html"
        if not path.is_file() or path.suffix.lower() in {".py", ".pyc", ".md", ".yml", ".yaml", ".toml", ".log"}:
            raise ApiError(404, "Not found.")
        return path

    def do_GET(self) -> None:
        try:
            self._check_host()
            split, query = self._parse_url()
            if split.path == "/__reward_editor/api/state":
                with FILE_LOCK:
                    self._send_json(200, _state())
                return
            if split.path == "/__reward_editor/api/file":
                relative = query.get("path", [""])[0]
                path = _source_path(relative)
                if not path.is_file():
                    raise ApiError(404, "That source file does not exist.")
                if path.stat().st_size > MAX_TEXT_BYTES:
                    raise ApiError(413, "This source file is larger than the editor's 4 MB safety limit.")
                try:
                    text = path.read_text(encoding="utf-8-sig")
                except UnicodeDecodeError as exc:
                    raise ApiError(415, "This source file is not UTF-8 text.") from exc
                self._send_json(200, {
                    "path": relative,
                    "text": text,
                    "digest": _file_hash(path),
                    "readOnly": relative in GENERATED_FILES,
                    "generated": relative in GENERATED_FILES,
                })
                return
            if split.path == "/__reward_editor/api/open-url":
                self._send_json(200, {"url": f"http://{self._expected_host()}/reward/list/"})
                return

            editor_path = self._editor_path(split.path)
            if editor_path:
                body = editor_path.read_bytes()
                csp = None
                content_type = mimetypes.guess_type(editor_path.name)[0] or "application/octet-stream"
                if editor_path.name == "index.html":
                    body = body.replace(b"__REWARD_EDITOR_TOKEN__", CSRF_TOKEN.encode("ascii"))
                    content_type = "text/html; charset=utf-8"
                    csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"
                self._send(200, body, content_type, csp=csp)
                return

            path = self._public_path(split.path)
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            self._send(200, path.read_bytes(), content_type)
        except ApiError as exc:
            self._error(exc.status, exc.message)
        except (OSError, ValueError) as exc:
            self._error(404, "Not found.")

    def do_HEAD(self) -> None:
        self.do_GET()

    def do_POST(self) -> None:
        try:
            self._check_host()
            expected_origin = f"http://{self._expected_host()}"
            if self.headers.get("Origin") != expected_origin:
                raise ApiError(403, "Write requests are accepted only from this local editor page.")
            fetch_site = self.headers.get("Sec-Fetch-Site")
            if fetch_site and fetch_site != "same-origin":
                raise ApiError(403, "Cross-site write requests are not accepted.")
            token = self.headers.get("X-Reward-Editor-Token", "")
            if not secrets.compare_digest(token, CSRF_TOKEN):
                raise ApiError(403, "The local editor session has expired. Reload the page and try again.")

            split, query = self._parse_url()
            with FILE_LOCK:
                if split.path == "/__reward_editor/api/artwork":
                    result = _artwork_upload(self, query)
                elif split.path == "/__reward_editor/api/page-asset":
                    result = _save_page_asset(self, query)
                elif split.path == "/__reward_editor/api/add-page-asset":
                    result = _add_page_asset(self, query)
                else:
                    payload = _json_payload(self)
                    if split.path == "/__reward_editor/api/assignments":
                        result = _assignment_mutation(payload)
                    elif split.path == "/__reward_editor/api/artwork-action":
                        result = _artwork_mutation(payload)
                    elif split.path == "/__reward_editor/api/rename-artwork":
                        result = _rename_artwork(payload)
                    elif split.path == "/__reward_editor/api/reservations":
                        result = _save_reservations(payload)
                    elif split.path == "/__reward_editor/api/tier-weights":
                        result = _save_tier_weights(payload)
                    elif split.path == "/__reward_editor/api/rebuild-catalog":
                        result = _rebuild_catalog(payload)
                    elif split.path == "/__reward_editor/api/delete-page-asset":
                        result = _delete_page_asset(payload)
                    elif split.path == "/__reward_editor/api/source-file":
                        text = payload.get("text")
                        if not isinstance(text, str):
                            raise ApiError(400, "Source content must be text.")
                        result = _save_text_file(payload.get("path", ""), text, payload.get("expectedDigest", ""))
                    elif split.path == "/__reward_editor/api/rebuild-pages":
                        command = subprocess.run(["node", "scripts/build-reward-pages.mjs"], cwd=ROOT,
                                                 capture_output=True, text=True, timeout=30, check=False)
                        if command.returncode:
                            raise ApiError(500, "Reward detail pages did not rebuild; see the local server output.")
                        result = {"message": "Generated reward detail pages rebuilt from the shared templates."}
                    else:
                        raise ApiError(404, "Unknown local editor action.")
            self._send_json(200, result)
        except ApiError as exc:
            self._error(exc.status, exc.message)
        except (CatalogError, local_issuer.RewardIssueError) as exc:
            self._error(400, str(exc))
        except (OSError, json.JSONDecodeError, UnicodeError) as exc:
            self._error(500, "The local editor could not safely complete that file operation.")
        except Exception as exc:
            print(f"[reward-editor] {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
            self._error(500, "Unexpected local editor error. No public publish was attempted.")

    def log_message(self, format: str, *args: Any) -> None:
        # Keep file content and reservation aliases out of request logs.
        if self.path.startswith("/__reward_editor/api"):
            print(f"[reward-editor] {self.command} {urlsplit(self.path).path}", file=sys.stderr, flush=True)
        else:
            super().log_message(format, *args)


class Handler(RewardEditorHandlerMixin, BaseHTTPRequestHandler):
    """Standalone loopback handler and mixin-backed MSI route implementation."""
    pass


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4174)
    args = parser.parse_args()
    server = RewardEditorServer(("127.0.0.1", args.port), Handler)
    print(f"Reward editor: http://127.0.0.1:{server.server_port}/reward/editor/", flush=True)
    print("Loopback only. Edits stay in this checkout; no Git, push, or deploy actions are available.", flush=True)
    print("Press Ctrl+C in this terminal to stop it.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
