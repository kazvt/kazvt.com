"""Loopback reward issuer used by the existing MSI HTTP server.

The website is static. This module runs only on the trusted streaming PC, checks
the local repository and artwork, then commits just assignments.json and pushes
it through the user's already-configured Git credentials.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import struct
import subprocess
import tempfile
import threading
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_SITE_ORIGIN = "https://kazvt.com"
DEFAULT_REMOTE = "https://github.com/kazvt/kazvt.com.git"
ASSIGNMENTS_RELATIVE = "zzz_assets/rewards/assignments.json"
ASSET_ID_RE = re.compile(r"^[a-f0-9]{64}$", re.IGNORECASE)
FILENAME_RE = re.compile(r"^[^/\\\x00-\x1f\x7f]{1,255}\.png$", re.IGNORECASE)
COMPACT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{16,22}$")
UUID4_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.IGNORECASE)
EVENT_COMMIT_RE = re.compile(r"^reward: issue award [a-f0-9]{12}$")
_ISSUE_LOCK = threading.Lock()


class RewardIssueError(ValueError):
    """A safe, user-displayable reward issuance error."""


def _normal_username(value: str) -> str:
    return unicodedata.normalize("NFKC", value).strip().casefold()


def _contains_control(value: str) -> bool:
    return any(unicodedata.category(character) == "Cc" for character in value)


def _clean_request(
    payload: Any,
    *,
    allow_automatic_asset: bool = False,
    require_user_identity: bool = False,
) -> dict[str, str]:
    if not isinstance(payload, dict):
        raise RewardIssueError("A JSON object is required.")

    raw_username = payload.get("username")
    username = unicodedata.normalize("NFKC", raw_username).strip() if isinstance(raw_username, str) else ""
    if username.startswith("@"):
        username = username[1:].strip()
    asset_id = payload.get("assetId", "")
    asset_id = asset_id.lower() if isinstance(asset_id, str) else ""
    raw_event_id = payload.get("eventId")
    event_id = raw_event_id.strip() if isinstance(raw_event_id, str) else ""
    raw_platform = payload.get("platform")
    platform = raw_platform.strip().casefold() if isinstance(raw_platform, str) else ""
    platform = platform or "stream-game"
    raw_user_id = payload.get("userId", "")
    user_id = unicodedata.normalize("NFKC", raw_user_id).strip() if isinstance(raw_user_id, str) else ""

    if not username or len(username) > 100 or _contains_control(username):
        raise RewardIssueError("username must be 1-100 characters and contain no control characters.")
    if not allow_automatic_asset and not ASSET_ID_RE.fullmatch(asset_id):
        raise RewardIssueError("assetId must be a SHA-256 artwork ID.")
    if allow_automatic_asset and asset_id and not ASSET_ID_RE.fullmatch(asset_id):
        raise RewardIssueError("assetId must be a SHA-256 artwork ID when supplied.")
    if not event_id or len(event_id) > 128 or _contains_control(event_id):
        raise RewardIssueError("eventId must be a stable 1-128 character ID without control characters.")
    if not platform or len(platform) > 60 or _contains_control(platform):
        raise RewardIssueError("platform must be 1-60 characters and contain no control characters.")
    if user_id and (len(user_id) > 128 or _contains_control(user_id)):
        raise RewardIssueError("userId must be 1-128 characters and contain no control characters.")
    if require_user_identity and (platform not in {"twitch", "kick", "youtube"} or not user_id):
        raise RewardIssueError("A supported platform and stable platform userId are required.")

    return {
        "username": username,
        "assetId": asset_id,
        "eventId": event_id,
        "platform": platform,
        "userId": user_id,
    }


def _read_json(path: Path, description: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError, UnicodeError) as exc:
        raise RewardIssueError(f"Could not read the {description}.") from exc
    if not isinstance(value, dict):
        raise RewardIssueError(f"The {description} is invalid.")
    return value


def _validate_catalog(catalog: dict[str, Any]) -> None:
    if (catalog.get("version") != 4 or
            catalog.get("assetIdAlgorithm") != "sha256-png-bytes-v1" or
            not isinstance(catalog.get("files"), list) or
            not isinstance(catalog.get("assets"), dict) or
            not isinstance(catalog.get("assetsById"), dict)):
        raise RewardIssueError("The local reward catalog is invalid or out of date.")


def _validate_registry(registry: dict[str, Any]) -> None:
    records = registry.get("assignments")
    if registry.get("version") != 1 or not isinstance(records, list):
        raise RewardIssueError("The reward assignment registry is invalid.")
    seen_assets: set[str] = set()
    seen_links: set[str] = set()
    seen_events: set[str] = set()
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise RewardIssueError(f"Assignment record {index + 1} is invalid.")
        asset_id = record.get("assetId", record.get("assetSha256", ""))
        if not isinstance(asset_id, str) or not ASSET_ID_RE.fullmatch(asset_id):
            raise RewardIssueError(f"Assignment record {index + 1} has an invalid artwork ID.")
        asset_id = asset_id.lower()
        if record.get("assetSha256") is not None and str(record.get("assetSha256")).lower() != asset_id:
            raise RewardIssueError(f"Assignment record {index + 1} has conflicting artwork IDs.")
        if asset_id in seen_assets:
            raise RewardIssueError("The assignment registry repeats artwork; refusing to issue another award.")
        seen_assets.add(asset_id)

        filename = record.get("filename")
        username = record.get("username")
        issued_at = record.get("issuedAt")
        platform = record.get("platform", "")
        user_id = record.get("userId", "")
        if (not isinstance(filename, str) or not FILENAME_RE.fullmatch(filename) or
                not isinstance(username, str) or not username.strip() or len(username) > 100 or _contains_control(username) or
                not isinstance(platform, str) or len(platform) > 60 or _contains_control(platform) or
                not isinstance(user_id, str) or len(user_id) > 128 or _contains_control(user_id) or
                (user_id and not platform) or
                not isinstance(issued_at, str) or len(issued_at) > 40):
            raise RewardIssueError(f"Assignment record {index + 1} is invalid.")
        try:
            datetime.fromisoformat(issued_at.replace("Z", "+00:00"))
        except ValueError as exc:
            raise RewardIssueError(f"Assignment record {index + 1} has an invalid timestamp.") from exc

        link_id = record.get("linkId", "")
        if link_id:
            if not isinstance(link_id, str) or not (COMPACT_ID_RE.fullmatch(link_id) or UUID4_RE.fullmatch(link_id)):
                raise RewardIssueError(f"Assignment record {index + 1} has an invalid reward link ID.")
            normalized_link = link_id.lower() if UUID4_RE.fullmatch(link_id) else link_id
            if normalized_link in seen_links:
                raise RewardIssueError("The assignment registry repeats a reward link ID.")
            seen_links.add(normalized_link)

        event_hash = record.get("eventIdHash")
        if event_hash is not None:
            if not isinstance(event_hash, str) or not ASSET_ID_RE.fullmatch(event_hash):
                raise RewardIssueError(f"Assignment record {index + 1} has an invalid event ID digest.")
            event_hash = event_hash.lower()
        else:
            old_event_id = record.get("eventId")
            event_hash = hashlib.sha256(old_event_id.encode("utf-8")).hexdigest() if isinstance(old_event_id, str) else ""
        if event_hash:
            if event_hash in seen_events:
                raise RewardIssueError("The assignment registry repeats an issuance event.")
            seen_events.add(event_hash)


def _reward_paths(site_root: Path) -> tuple[Path, Path]:
    reward_dir = site_root / "zzz_assets" / "rewards"
    return reward_dir / "manifest.json", reward_dir / "assignments.json"


def _load_records(site_root: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    manifest_path, assignments_path = _reward_paths(site_root)
    catalog = _read_json(manifest_path, "reward catalog")
    registry = _read_json(assignments_path, "reward assignment registry")
    _validate_catalog(catalog)
    _validate_registry(registry)
    return catalog, registry


def _catalog_artworks(catalog: dict[str, Any]) -> list[dict[str, Any]]:
    _validate_catalog(catalog)
    result = []
    files = set(catalog["files"])
    for asset_id, indexed in catalog["assetsById"].items():
        if not isinstance(asset_id, str) or not ASSET_ID_RE.fullmatch(asset_id) or not isinstance(indexed, dict):
            continue
        filename = indexed.get("filename")
        if not isinstance(filename, str) or not FILENAME_RE.fullmatch(filename) or filename not in files:
            continue
        metadata = catalog["assets"].get(filename)
        if (not isinstance(metadata, dict) or metadata.get("assetId") != asset_id or
                metadata.get("sha256") != asset_id or metadata.get("tier") != indexed.get("tier") or
                not isinstance(metadata.get("width"), int) or metadata["width"] < 1 or
                not isinstance(metadata.get("height"), int) or metadata["height"] < 1):
            continue
        result.append({
            "assetId": asset_id.lower(),
            "filename": filename,
            "width": metadata["width"],
            "height": metadata["height"],
            "tier": metadata["tier"],
        })
    result.sort(key=lambda item: item["filename"].casefold())
    return result


def list_available_artwork(site_root: str | os.PathLike[str]) -> list[dict[str, Any]]:
    """Return only cataloged artworks not already assigned in the public ledger."""
    root = Path(site_root).resolve()
    catalog, registry = _load_records(root)
    assigned = {
        str(record.get("assetId", record.get("assetSha256", ""))).lower()
        for record in registry["assignments"]
    }
    return [item for item in _catalog_artworks(catalog) if item["assetId"] not in assigned]


def _verify_artwork(site_root: Path, catalog: dict[str, Any], asset_id: str) -> dict[str, Any]:
    indexed = catalog["assetsById"].get(asset_id)
    if not isinstance(indexed, dict):
        raise RewardIssueError("That artwork is not in the local reward catalog.")
    filename = indexed.get("filename")
    if not isinstance(filename, str) or not FILENAME_RE.fullmatch(filename) or filename not in catalog["files"]:
        raise RewardIssueError("That artwork has invalid catalog metadata.")
    metadata = catalog["assets"].get(filename)
    if (not isinstance(metadata, dict) or metadata.get("assetId") != asset_id or
            metadata.get("sha256") != asset_id or metadata.get("tier") != indexed.get("tier") or
            not isinstance(metadata.get("width"), int) or metadata["width"] < 1 or
            not isinstance(metadata.get("height"), int) or metadata["height"] < 1):
        raise RewardIssueError("That artwork has invalid catalog metadata.")

    image_path = site_root / "zzz_assets" / "rewards" / filename
    digest = hashlib.sha256()
    first_24 = b""
    try:
        with image_path.open("rb") as image:
            while True:
                block = image.read(1024 * 1024)
                if not block:
                    break
                if len(first_24) < 24:
                    first_24 += block[:24 - len(first_24)]
                digest.update(block)
    except OSError as exc:
        raise RewardIssueError("The selected artwork file is missing or unreadable.") from exc
    if len(first_24) < 24 or first_24[:8] != b"\x89PNG\r\n\x1a\n" or first_24[12:16] != b"IHDR":
        raise RewardIssueError("The selected artwork is not a valid PNG file.")
    width, height = struct.unpack(">II", first_24[16:24])
    if digest.hexdigest() != asset_id or width != metadata["width"] or height != metadata["height"]:
        raise RewardIssueError("The selected artwork changed after the reward catalog was generated.")
    return {"filename": filename, "tier": metadata["tier"]}


def _find_event(registry: dict[str, Any], event_hash: str) -> dict[str, Any] | None:
    for record in registry["assignments"]:
        current_hash = record.get("eventIdHash")
        if isinstance(current_hash, str) and current_hash.lower() == event_hash:
            return record
        old_event_id = record.get("eventId")
        if isinstance(old_event_id, str) and hashlib.sha256(old_event_id.encode("utf-8")).hexdigest() == event_hash:
            return record
    return None


def _assignment_matches(record: dict[str, Any], request: dict[str, str]) -> bool:
    if request.get("userId"):
        return (str(record.get("platform", "")).casefold() == request["platform"] and
                str(record.get("userId", "")) == request["userId"] and
                str(record.get("assetId", record.get("assetSha256", ""))).lower() == request["assetId"])
    return (_normal_username(str(record.get("username", ""))) == _normal_username(request["username"]) and
            str(record.get("assetId", record.get("assetSha256", ""))).lower() == request["assetId"])


def _same_chat_identity(record: dict[str, Any], request: dict[str, str]) -> bool:
    return (str(record.get("platform", "")).casefold() == request["platform"] and
            str(record.get("userId", "")) == request["userId"])


def _new_assignment(site_root: Path, catalog: dict[str, Any], registry: dict[str, Any], request: dict[str, str], issued_at: str) -> tuple[dict[str, Any], dict[str, Any]]:
    event_hash = hashlib.sha256(request["eventId"].encode("utf-8")).hexdigest()
    previous = _find_event(registry, event_hash)
    if previous:
        if not _assignment_matches(previous, request):
            raise RewardIssueError("eventId is already assigned to a different winner or artwork.")
        return registry, previous

    if any(str(record.get("assetId", record.get("assetSha256", ""))).lower() == request["assetId"]
           for record in registry["assignments"]):
        raise RewardIssueError("That artwork has already been awarded.")

    artwork = _verify_artwork(site_root, catalog, request["assetId"])
    if request.get("userId"):
        for previous_assignment in registry["assignments"]:
            if _same_chat_identity(previous_assignment, request):
                previous_assignment["username"] = request["username"]
    used_link_ids = {str(record.get("linkId", "")) for record in registry["assignments"]}
    link_id = ""
    for _ in range(8):
        candidate = secrets.token_urlsafe(12)
        if COMPACT_ID_RE.fullmatch(candidate) and candidate not in used_link_ids:
            link_id = candidate
            break
    if not link_id:
        raise RewardIssueError("Could not generate a unique reward link ID.")

    assignment = {
        "assetId": request["assetId"],
        "assetSha256": request["assetId"],
        "filename": artwork["filename"],
        "username": request["username"],
        "issuedAt": issued_at,
        "platform": request["platform"],
        "linkId": link_id,
        "eventIdHash": event_hash,
    }
    if request.get("userId"):
        assignment["userId"] = request["userId"]
    next_registry = {"version": 1, "assignments": [*registry["assignments"], assignment]}
    return next_registry, assignment


def _git(root: Path, *args: str, check: bool = True) -> str:
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GCM_INTERACTIVE"] = "Never"
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=35,
            check=False,
            env=env,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RewardIssueError("Git could not finish safely. Check that MSI can reach GitHub and retry.") from exc
    if check and result.returncode != 0:
        raise RewardIssueError("Git could not verify or publish the reward registry. Check the MSI console and Git login.")
    return result.stdout.strip()


def _canonical_remote(remote: str) -> str:
    value = remote.strip().lower()
    if value in {"git@github.com:kazvt/kazvt.com", "git@github.com:kazvt/kazvt.com.git"}:
        return DEFAULT_REMOTE
    if value in {"ssh://git@github.com/kazvt/kazvt.com", "ssh://git@github.com/kazvt/kazvt.com.git"}:
        return DEFAULT_REMOTE
    return value.rstrip("/")


def _repo_sync_state(root: Path, expected_remote: str = DEFAULT_REMOTE) -> tuple[int, int]:
    git_root = Path(_git(root, "rev-parse", "--show-toplevel")).resolve()
    if git_root != root.resolve():
        raise RewardIssueError("The configured website folder is not the root of its Git checkout.")
    branch = _git(root, "branch", "--show-current")
    if branch != "main":
        raise RewardIssueError("The website checkout must be on main before an award can be published.")
    if _canonical_remote(_git(root, "remote", "get-url", "origin")) != _canonical_remote(expected_remote):
        raise RewardIssueError("The website checkout's origin is not the expected kazvt.com repository.")
    if _git(root, "status", "--porcelain=v1", "--untracked-files=normal"):
        raise RewardIssueError("The website checkout has local changes. Commit or stash them before issuing an award.")

    _git(root, "fetch", "--quiet", "origin", "+refs/heads/main:refs/remotes/origin/main")
    counts = _git(root, "rev-list", "--left-right", "--count", "origin/main...HEAD").split()
    if len(counts) != 2:
        raise RewardIssueError("Git could not compare the website checkout with origin/main.")
    remote_ahead, local_ahead = (int(part) for part in counts)
    if remote_ahead:
        raise RewardIssueError("The website checkout is behind GitHub. Pull the latest main branch before issuing.")

    if local_ahead:
        changed = _git(root, "diff", "--name-only", "origin/main...HEAD").splitlines()
        subjects = _git(root, "log", "--format=%s", "origin/main..HEAD").splitlines()
        if changed != [ASSIGNMENTS_RELATIVE] or not subjects or not all(EVENT_COMMIT_RE.fullmatch(item) for item in subjects):
            raise RewardIssueError("There are unpublished commits besides a pending reward-registry push; publish them manually first.")
        _git(root, "push", "origin", "HEAD:refs/heads/main")
        _git(root, "fetch", "--quiet", "origin", "+refs/heads/main:refs/remotes/origin/main")
        counts = _git(root, "rev-list", "--left-right", "--count", "origin/main...HEAD").split()
        if len(counts) != 2 or counts != ["0", "0"]:
            raise RewardIssueError("The reward registry push has not synchronized with GitHub yet. Retry the same eventId.")
        if _git(root, "status", "--porcelain=v1", "--untracked-files=normal"):
            raise RewardIssueError("The website checkout changed during publication. Review its Git status before retrying.")
    return 0, 0


def _ensure_commit_identity(root: Path) -> None:
    name = _git(root, "config", "--get", "user.name", check=False)
    email = _git(root, "config", "--get", "user.email", check=False)
    if not name or not email:
        raise RewardIssueError("Git commit identity is not configured for this website checkout.")


def _atomic_write_registry(root: Path, registry: dict[str, Any]) -> None:
    _, assignments_path = _reward_paths(root)
    git_dir = Path(_git(root, "rev-parse", "--absolute-git-dir"))
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", prefix="reward-assignments-", suffix=".tmp", dir=git_dir, delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
            data = (json.dumps(registry, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            temporary.write(data)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_path, assignments_path)
    except OSError as exc:
        raise RewardIssueError("Could not safely write the reward assignment registry.") from exc
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass


def _issue_and_publish(
    site_root: str | os.PathLike[str],
    payload: Any,
    *,
    expected_remote: str = DEFAULT_REMOTE,
    automatic_asset: bool = False,
) -> dict[str, Any]:
    request = _clean_request(
        payload,
        allow_automatic_asset=automatic_asset,
        require_user_identity=automatic_asset,
    )
    root = Path(site_root).resolve()
    if not root.is_dir():
        raise RewardIssueError("The configured website folder is unavailable.")

    with _ISSUE_LOCK:
        _repo_sync_state(root, expected_remote)
        _ensure_commit_identity(root)
        catalog, registry = _load_records(root)
        event_hash = hashlib.sha256(request["eventId"].encode("utf-8")).hexdigest()
        previous = _find_event(registry, event_hash)
        if previous:
            matches = (_same_chat_identity(previous, request) if automatic_asset
                       else _assignment_matches(previous, request))
            if not matches:
                raise RewardIssueError("eventId is already assigned to a different winner or artwork.")
            return {
                "assignment": previous,
                "href": f"{DEFAULT_SITE_ORIGIN}/reward/?id={previous['linkId']}",
                "replayed": True,
                "pushed": True,
            }

        if automatic_asset:
            assigned_assets = {
                str(record.get("assetId", record.get("assetSha256", ""))).lower()
                for record in registry["assignments"]
            }
            available = [item for item in _catalog_artworks(catalog)
                         if item["assetId"] not in assigned_assets]
            if not available:
                raise RewardIssueError("No unassigned reward artwork is available.")
            request["assetId"] = available[0]["assetId"]

        now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        next_registry, assignment = _new_assignment(root, catalog, registry, request, now)
        replayed = next_registry is registry
        if replayed:
            return {
                "assignment": assignment,
                "href": f"{DEFAULT_SITE_ORIGIN}/reward/?id={assignment['linkId']}",
                "replayed": True,
                "pushed": True,
            }

        # Recheck immediately before touching the worktree. This catches ordinary
        # user edits made while the local catalog was being read.
        _repo_sync_state(root, expected_remote)
        _atomic_write_registry(root, next_registry)
        try:
            _git(root, "add", "--", ASSIGNMENTS_RELATIVE)
            staged = _git(root, "diff", "--cached", "--name-only").splitlines()
            unstaged = _git(root, "diff", "--name-only").splitlines()
            untracked = _git(root, "ls-files", "--others", "--exclude-standard").splitlines()
            if staged != [ASSIGNMENTS_RELATIVE] or unstaged or untracked:
                raise RewardIssueError("Only assignments.json may be included in an issuance commit; review Git status.")
            event_prefix = assignment["eventIdHash"][:12]
            _git(root, "commit", "-m", f"reward: issue award {event_prefix}")
            _git(root, "push", "origin", "HEAD:refs/heads/main")
            _git(root, "fetch", "--quiet", "origin", "+refs/heads/main:refs/remotes/origin/main")
            counts = _git(root, "rev-list", "--left-right", "--count", "origin/main...HEAD").split()
            if counts != ["0", "0"]:
                raise RewardIssueError("The reward was committed but GitHub has not confirmed the push. Retry the same eventId.")
            if _git(root, "status", "--porcelain=v1", "--untracked-files=normal"):
                raise RewardIssueError("The reward was pushed, but the checkout changed during publication. Review Git status.")
        except RewardIssueError:
            raise
        except Exception as exc:
            raise RewardIssueError("The reward may be saved locally but could not be confirmed on GitHub. Retry the same eventId after checking Git status.") from exc

        return {
            "assignment": assignment,
            "href": f"{DEFAULT_SITE_ORIGIN}/reward/?id={assignment['linkId']}",
            "replayed": False,
            "pushed": True,
        }


def issue_and_publish(
    site_root: str | os.PathLike[str],
    payload: Any,
    *,
    expected_remote: str = DEFAULT_REMOTE,
) -> dict[str, Any]:
    """Assign a specifically selected PNG, then publish only assignments.json."""
    return _issue_and_publish(site_root, payload, expected_remote=expected_remote)


def issue_next_and_publish(
    site_root: str | os.PathLike[str],
    payload: Any,
    *,
    expected_remote: str = DEFAULT_REMOTE,
) -> dict[str, Any]:
    """Assign the next unused catalog PNG to a platform user ID, then publish."""
    return _issue_and_publish(
        site_root, payload, expected_remote=expected_remote, automatic_asset=True
    )

