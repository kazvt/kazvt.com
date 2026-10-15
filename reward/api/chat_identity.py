"""Small local identity cache for platform chat award commands.

The public assignments ledger stores the stable platform user ID and the
latest display handle. This cache only helps resolve a typed @name to that ID;
it stays beside MSI's private local application files, not in the public site.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import unicodedata
from pathlib import Path
from typing import Any


SUPPORTED_PLATFORMS = {"twitch", "kick", "youtube"}
MAX_CACHED_IDENTITIES = 20_000


class IdentityLookupError(ValueError):
    """A safe, user-displayable identity resolution failure."""


def normalize_name(value: str) -> str:
    return unicodedata.normalize("NFKC", value).strip().lstrip("@").strip().casefold()


def _valid_text(value: Any, maximum: int) -> bool:
    return (isinstance(value, str) and 1 <= len(value.strip()) <= maximum and
            not any(unicodedata.category(character) == "Cc" for character in value))


class RewardIdentityCache:
    def __init__(self, path: str | os.PathLike[str]):
        self.path = Path(path)
        self._lock = threading.RLock()
        self._users: dict[str, dict[str, str]] | None = None

    @staticmethod
    def _key(platform: str, user_id: str) -> str:
        return f"{platform}:{user_id}"

    def _load_locked(self) -> dict[str, dict[str, str]]:
        if self._users is not None:
            return self._users
        try:
            value = json.loads(self.path.read_text(encoding="utf-8-sig"))
        except FileNotFoundError:
            value = {"version": 1, "users": []}
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise IdentityLookupError("The local reward identity cache could not be read safely.") from exc
        if not isinstance(value, dict) or value.get("version") != 1 or not isinstance(value.get("users"), list):
            raise IdentityLookupError("The local reward identity cache has an invalid format.")

        users: dict[str, dict[str, str]] = {}
        for item in value["users"][-MAX_CACHED_IDENTITIES:]:
            if not isinstance(item, dict):
                continue
            platform = str(item.get("platform") or "").casefold()
            user_id = str(item.get("userId") or "").strip()
            username = str(item.get("username") or "").strip().lstrip("@").strip()
            display_name = str(item.get("displayName") or username).strip().lstrip("@").strip()
            if (platform in SUPPORTED_PLATFORMS and _valid_text(user_id, 128) and
                    _valid_text(username, 100) and _valid_text(display_name, 100)):
                record = {
                    "platform": platform,
                    "userId": user_id,
                    "username": username,
                    "displayName": display_name,
                }
                if isinstance(item.get("updatedAt"), str):
                    record["updatedAt"] = item["updatedAt"]
                users[self._key(platform, user_id)] = record
        self._users = users
        return users

    def _save_locked(self, users: dict[str, dict[str, str]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        ordered = sorted(users.values(), key=lambda item: item.get("updatedAt", ""))[-MAX_CACHED_IDENTITIES:]
        payload = {"version": 1, "users": ordered}
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", newline="\n", prefix="reward-identities-",
                suffix=".tmp", dir=self.path.parent, delete=False
            ) as temporary:
                temporary_path = Path(temporary.name)
                json.dump(payload, temporary, ensure_ascii=False, indent=2)
                temporary.write("\n")
                temporary.flush()
                os.fsync(temporary.fileno())
            os.replace(temporary_path, self.path)
        except OSError as exc:
            raise IdentityLookupError("The local reward identity cache could not be saved safely.") from exc
        finally:
            if temporary_path is not None:
                try:
                    temporary_path.unlink(missing_ok=True)
                except OSError:
                    pass

    def upsert(self, platform: str, user_id: str, username: str, display_name: str = "") -> bool:
        platform = str(platform or "").strip().casefold()
        user_id = str(user_id or "").strip()
        username = unicodedata.normalize("NFKC", str(username or "")).strip().lstrip("@").strip()
        display_name = unicodedata.normalize("NFKC", str(display_name or username)).strip().lstrip("@").strip()
        if not display_name:
            display_name = username
        if (platform not in SUPPORTED_PLATFORMS or not _valid_text(user_id, 128) or
                not _valid_text(username, 100) or not _valid_text(display_name, 100)):
            return False

        with self._lock:
            users = self._load_locked()
            key = self._key(platform, user_id)
            previous = users.get(key)
            if previous and previous.get("username") == username and previous.get("displayName") == display_name:
                return False
            from datetime import datetime, timezone
            users[key] = {
                "platform": platform,
                "userId": user_id,
                "username": username,
                "displayName": display_name,
                "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            }
            self._save_locked(users)
            return True

    def resolve(self, platform: str, target: str) -> dict[str, str]:
        platform = str(platform or "").strip().casefold()
        raw_target = unicodedata.normalize("NFKC", str(target or "")).strip().lstrip("@").strip()
        needle = normalize_name(raw_target)
        if platform not in SUPPORTED_PLATFORMS or not needle:
            raise IdentityLookupError("A platform and recipient username are required.")

        with self._lock:
            users = self._load_locked()
            platform_users = [item for item in users.values() if item["platform"] == platform]
            # Exact platform IDs win over name aliases. A numeric target is
            # always an ID, never a numeric-looking username.
            candidates = [item for item in platform_users if item["userId"] == raw_target]
            if not candidates and not raw_target.isdecimal():
                candidates = [item for item in platform_users if
                              normalize_name(item["username"]) == needle or
                              normalize_name(item["displayName"]) == needle]
        unique = {item["userId"]: item for item in candidates}
        if not unique:
            raise IdentityLookupError(
                "That name has not been identified in this platform's chat yet; use the platform user ID or have the user chat first."
            )
        if len(unique) > 1:
            raise IdentityLookupError("That display name matches multiple users; use the platform user ID instead.")
        return dict(next(iter(unique.values())))
