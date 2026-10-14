#!/usr/bin/env python3
"""Tiny localhost-only static server for the OBS trivia widget."""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
REWARD_QUEUE = ROOT / ".reward-queue.json"
REWARD_QUEUE_TEMP = ROOT / ".reward-queue.json.tmp"
PUBLIC_ASSIGNMENTS = ROOT.parent.parent / "zzz_assets" / "rewards" / "assignments.json"
PUBLIC_ASSIGNMENTS_TEMP = PUBLIC_ASSIGNMENTS.with_name(PUBLIC_ASSIGNMENTS.name + ".tmp")
REWARD_QUEUE_LIMIT = 250
REWARD_QUEUE_LOCK = threading.Lock()
REWARD_STATE_VERSION = 2
PUBLIC_REWARD_URL = "https://kazvt.com/reward/"
UUID4_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
COMPACT_REWARD_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,22}$")
PREASSIGNED_REWARDS = {
    "3029196882de1c75ad40ad3cc9ebe3612b8bf29c0328b36d6dce5db6f45ede03": {
        "username": "kazvt",
        "platform": "manual",
        "issuedAt": "2026-10-13T00:00:00.000Z",
        "linkId": "e2b8a0b2-7dd8-4d10-802f-d308ec33ffe7",
    }
}

try:
    with (ROOT / "rewards.json").open("r", encoding="utf-8-sig") as catalog_file:
        REWARD_CATALOG = json.load(catalog_file)
    if (REWARD_CATALOG.get("version") != 3 or
            REWARD_CATALOG.get("assetIdAlgorithm") != "sha256-png-bytes-v1"):
        raise ValueError("Unsupported reward catalog identity format.")
    REWARD_FILES = set(REWARD_CATALOG.get("files", []))
    REWARD_SHA256 = {
        filename: metadata["assetId"].lower()
        for filename, metadata in REWARD_CATALOG.get("assets", {}).items()
        if isinstance(filename, str) and isinstance(metadata, dict) and
        isinstance(metadata.get("assetId"), str) and
        metadata.get("assetId") == metadata.get("sha256") and
        re.fullmatch(r"[a-fA-F0-9]{64}", metadata["assetId"])
    }
    REWARD_FILENAME_HISTORY = {
        filename: asset_id.lower()
        for filename, asset_id in REWARD_CATALOG.get("filenameHistory", {}).items()
        if isinstance(filename, str) and isinstance(asset_id, str) and
        re.fullmatch(r"[a-fA-F0-9]{64}", asset_id)
    }
except (OSError, json.JSONDecodeError, AttributeError, TypeError):
    REWARD_FILES = set()
    REWARD_SHA256 = {}
    REWARD_FILENAME_HISTORY = {}
except ValueError:
    REWARD_FILES = set()
    REWARD_SHA256 = {}
    REWARD_FILENAME_HISTORY = {}


def reward_asset_identity(filename: str) -> str:
    digest = REWARD_SHA256.get(filename)
    if digest:
        return digest
    historical_digest = REWARD_FILENAME_HISTORY.get(filename)
    return historical_digest if historical_digest else f"file:{filename}"


def current_reward_filename(asset_id: str) -> str | None:
    return next((filename for filename, digest in REWARD_SHA256.items() if digest == asset_id), None)


def ensure_owner_link_ids(owners: dict[str, dict[str, str]]) -> None:
    """Give every assignment one persisted, compact opaque reward-link ID."""
    used_ids: set[str] = set()
    for owner in owners.values():
        link_id = owner.get("linkId", "")
        if not isinstance(link_id, str):
            raise ValueError("The reward ownership ledger contains an invalid link ID.")
        if link_id:
            if not (UUID4_PATTERN.fullmatch(link_id) or COMPACT_REWARD_ID_PATTERN.fullmatch(link_id)):
                raise ValueError("The reward ownership ledger contains an invalid link ID.")
            if UUID4_PATTERN.fullmatch(link_id):
                link_id = link_id.lower()
            if link_id in used_ids:
                raise ValueError("The reward ownership ledger repeats a link ID.")
            owner["linkId"] = link_id
            used_ids.add(link_id)

    for owner in owners.values():
        if owner.get("linkId"):
            continue
        link_id = secrets.token_urlsafe(12)
        while link_id in used_ids:
            link_id = secrets.token_urlsafe(12)
        owner["linkId"] = link_id
        used_ids.add(link_id)


class NoCacheHandler(SimpleHTTPRequestHandler):
    def local_request_allowed(self) -> bool:
        port = self.server.server_address[1]
        host = self.headers.get("Host", "").lower()
        allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        if host not in allowed_hosts:
            return False
        origin = self.headers.get("Origin")
        if origin is not None and origin != f"http://{host}":
            return False
        fetch_site = self.headers.get("Sec-Fetch-Site")
        return fetch_site in (None, "same-origin", "none")

    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def read_reward_state(self) -> dict[str, object]:
        try:
            with REWARD_QUEUE.open("r", encoding="utf-8") as queue_file:
                data = json.load(queue_file)
        except FileNotFoundError:
            data = {}
        except json.JSONDecodeError as error:
            raise ValueError("The reward ledger is invalid JSON.") from error

        if not isinstance(data, dict):
            raise ValueError("The reward ledger must be an object.")
        items = data.get("items", [])
        owners = data.get("owners", {})
        if not isinstance(items, list) or not isinstance(owners, dict):
            raise ValueError("The reward ledger has an invalid structure.")

        # Migrate the legacy recent-link queue into the durable ownership map.
        normalized_owners: dict[str, dict[str, str]] = {}
        for identity, owner in owners.items():
            if (not isinstance(identity, str) or not isinstance(owner, dict) or
                    not isinstance(owner.get("username"), str) or not owner["username"].strip()):
                raise ValueError("The reward ownership record is invalid.")
            filename = owner.get("filename")
            if not isinstance(filename, str):
                filename = identity.removeprefix("file:") if identity.startswith("file:") else identity
            canonical_identity = identity.lower() if re.fullmatch(r"[a-fA-F0-9]{64}", identity) else reward_asset_identity(filename)
            link_id = owner.get("linkId", "")
            if not isinstance(link_id, str):
                raise ValueError("The reward ownership record has an invalid link ID.")
            normalized_owners.setdefault(canonical_identity, {
                "filename": current_reward_filename(canonical_identity) or filename,
                "username": owner["username"].strip(),
                "platform": str(owner.get("platform", "chat"))[:60],
                "issuedAt": str(owner.get("issuedAt", ""))[:40],
                "linkId": link_id.lower() if UUID4_PATTERN.fullmatch(link_id) else link_id,
            })

        for item in items:
            if not isinstance(item, dict):
                continue
            filename = item.get("filename")
            username = item.get("username")
            identity = reward_asset_identity(filename) if isinstance(filename, str) else ""
            if (identity and isinstance(username, str) and identity not in normalized_owners):
                normalized_owners[identity] = {
                    "filename": current_reward_filename(identity) or filename,
                    "username": username.strip() or "Unknown",
                    "platform": str(item.get("platform", "chat"))[:60],
                    "issuedAt": str(item.get("issuedAt", ""))[:40],
                    "linkId": (
                        str(item.get("linkId", "")).lower()
                        if UUID4_PATTERN.fullmatch(str(item.get("linkId", "")))
                        else str(item.get("linkId", ""))
                    ),
                }

        try:
            with PUBLIC_ASSIGNMENTS.open("r", encoding="utf-8-sig") as registry_file:
                public_registry = json.load(registry_file)
        except FileNotFoundError:
            public_registry = {"version": 1, "assignments": []}
        except json.JSONDecodeError as error:
            raise ValueError("The public assignment registry is invalid JSON.") from error

        if (not isinstance(public_registry, dict) or public_registry.get("version") != 1 or
                not isinstance(public_registry.get("assignments"), list)):
            raise ValueError("The public assignment registry has an invalid structure.")
        seen_public_assets: set[str] = set()
        seen_public_link_ids: set[str] = set()
        for assignment in public_registry["assignments"]:
            if not isinstance(assignment, dict):
                raise ValueError("The public assignment record is invalid.")
            filename = assignment.get("filename")
            username = assignment.get("username")
            digest = assignment.get("assetId", assignment.get("assetSha256"))
            legacy_digest = assignment.get("assetSha256")
            platform = assignment.get("platform", "manual")
            issued_at = assignment.get("issuedAt", "")
            link_id = assignment.get("linkId", "")
            if (not isinstance(filename, str) or not filename.lower().endswith(".png") or
                    "/" in filename or "\\" in filename or len(filename) > 255 or
                    re.search(r"[\x00-\x1f]", filename) or
                    not isinstance(username, str) or not username.strip() or len(username) > 100 or
                    re.search(r"[\x00-\x1f]", username) or
                    not isinstance(digest, str) or not re.fullmatch(r"[a-fA-F0-9]{64}", digest) or
                    (legacy_digest is not None and
                     (not isinstance(legacy_digest, str) or digest.lower() != legacy_digest.lower())) or
                    not isinstance(platform, str) or len(platform) > 60 or
                    re.search(r"[\x00-\x1f]", platform) or
                    not isinstance(issued_at, str) or len(issued_at) > 40 or
                    not isinstance(link_id, str) or
                    (link_id and not (UUID4_PATTERN.fullmatch(link_id) or
                                      COMPACT_REWARD_ID_PATTERN.fullmatch(link_id)))):
                raise ValueError("The public assignment record is invalid.")
            if UUID4_PATTERN.fullmatch(link_id):
                link_id = link_id.lower()
            if link_id and link_id in seen_public_link_ids:
                raise ValueError("The public assignment registry repeats a link ID.")
            if link_id:
                seen_public_link_ids.add(link_id)
            identity = digest.lower()
            if identity in seen_public_assets:
                raise ValueError("The public assignment registry repeats artwork.")
            seen_public_assets.add(identity)
            current_filename = current_reward_filename(identity)
            existing = normalized_owners.get(identity)
            if existing and existing["username"].casefold() != username.strip().casefold():
                raise ValueError("The public registry conflicts with the saved ownership ledger.")
            if existing:
                if existing.get("linkId") and link_id and existing["linkId"] != link_id:
                    raise ValueError("The public registry conflicts with the saved reward link ID.")
                if link_id:
                    existing["linkId"] = link_id
            else:
                normalized_owners[identity] = {
                    "filename": current_filename or filename,
                    "username": username.strip(),
                    "platform": platform,
                    "issuedAt": issued_at,
                    "linkId": link_id,
                }

        for identity, owner in PREASSIGNED_REWARDS.items():
            filename = current_reward_filename(identity)
            if not filename:
                continue
            existing = normalized_owners.get(identity)
            if existing and existing["username"].casefold() != owner["username"].casefold():
                raise ValueError("The preassigned reward conflicts with the saved ownership ledger.")
            if existing:
                if existing.get("linkId") and existing["linkId"] != owner["linkId"]:
                    raise ValueError("The preassigned reward conflicts with the saved reward link ID.")
                existing["linkId"] = owner["linkId"]
            else:
                normalized_owners[identity] = {"filename": filename, **owner}

        return {
            "version": REWARD_STATE_VERSION,
            "owners": normalized_owners,
            "items": items[:REWARD_QUEUE_LIMIT],
        }

    def write_public_assignments(self, owners: dict[str, dict[str, str]]) -> None:
        ensure_owner_link_ids(owners)
        assignments = []
        for identity, owner in owners.items():
            digest = identity.lower() if re.fullmatch(r"[a-fA-F0-9]{64}", identity) else REWARD_SHA256.get(owner["filename"])
            filename = current_reward_filename(digest) if isinstance(digest, str) else None
            filename = filename or owner["filename"]
            if not isinstance(digest, str) or not re.fullmatch(r"[a-fA-F0-9]{64}", digest):
                raise ValueError(f"No SHA-256 checksum is available for {filename}.")
            assignments.append({
                "assetId": digest.lower(),
                "assetSha256": digest.lower(),
                "filename": filename,
                "username": owner["username"],
                "issuedAt": owner.get("issuedAt", ""),
                "platform": owner.get("platform", "manual"),
                "linkId": owner["linkId"],
            })
        assignments.sort(key=lambda item: (item["issuedAt"], item["filename"].casefold(), item["username"].casefold()))
        PUBLIC_ASSIGNMENTS_TEMP.write_text(
            json.dumps({"version": 1, "assignments": assignments}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        PUBLIC_ASSIGNMENTS_TEMP.replace(PUBLIC_ASSIGNMENTS)

    def read_reward_queue(self) -> list[dict[str, str]]:
        return self.read_reward_state()["items"]  # type: ignore[return-value]

    def do_GET(self) -> None:
        if not self.local_request_allowed():
            self.send_error(403, "Local requests only")
            return
        if urlsplit(self.path).path == "/api/rewards":
            with REWARD_QUEUE_LOCK:
                try:
                    items = self.read_reward_queue()
                except (OSError, ValueError):
                    self.send_json(500, {"error": "The reward ledger could not be read."})
                    return
            self.send_json(200, {"items": items})
            return
        if urlsplit(self.path).path == "/api/rewards/available":
            with REWARD_QUEUE_LOCK:
                try:
                    state = self.read_reward_state()
                except (OSError, ValueError):
                    self.send_json(500, {"error": "The reward ledger could not be read."})
                    return
            owners = state["owners"]
            available = []
            seen_assets = set()
            for filename in sorted(REWARD_FILES):
                identity = reward_asset_identity(filename)
                if identity in owners or identity in seen_assets:
                    continue
                seen_assets.add(identity)
                available.append(filename)
            self.send_json(200, {"files": available})
            return
        super().do_GET()

    def do_HEAD(self) -> None:
        if not self.local_request_allowed():
            self.send_error(403, "Local requests only")
            return
        super().do_HEAD()

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/api/rewards":
            self.send_error(404, "Not found")
            return
        if not self.local_request_allowed():
            self.send_json(403, {"error": "Local dashboard requests only."})
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "Content-Type must be application/json."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Invalid content length."})
            return
        if content_length <= 0 or content_length > 16384:
            self.send_json(413, {"error": "Reward record is too large."})
            return

        try:
            record = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"error": "Invalid JSON."})
            return
        if not isinstance(record, dict):
            self.send_json(400, {"error": "Reward record must be an object."})
            return

        username = record.get("username")
        filename = record.get("filename")
        platform = record.get("platform", "chat")
        issued_at = record.get("issuedAt")
        if (not isinstance(username, str) or not username.strip() or len(username) > 100 or
                re.search(r"[\x00-\x1f]", username)):
            self.send_json(400, {"error": "Invalid username."})
            return
        if not isinstance(filename, str) or filename not in REWARD_FILES:
            self.send_json(400, {"error": "Unknown reward filename."})
            return
        if not isinstance(platform, str) or len(platform) > 60:
            self.send_json(400, {"error": "Invalid platform."})
            return
        if not isinstance(issued_at, str) or len(issued_at) > 40:
            self.send_json(400, {"error": "Invalid issue time."})
            return
        saved_record = {
            "id": str(record.get("id", ""))[:80],
            "username": username.strip(),
            "filename": filename,
            "platform": platform,
            "issuedAt": issued_at,
        }
        with REWARD_QUEUE_LOCK:
            try:
                state = self.read_reward_state()
            except (OSError, ValueError):
                self.send_json(500, {"error": "The reward ledger could not be read."})
                return
            owners = state["owners"]
            identity = reward_asset_identity(filename)
            if identity in owners:
                self.send_json(409, {"error": "Reward artwork has already been assigned."})
                return

            try:
                ensure_owner_link_ids(owners)
            except ValueError:
                self.send_json(500, {"error": "The reward ledger contains an invalid link ID."})
                return
            link_id = secrets.token_urlsafe(12)
            while any(owner["linkId"] == link_id for owner in owners.values()):
                link_id = secrets.token_urlsafe(12)
            link = f"{PUBLIC_REWARD_URL}?id={link_id}"
            saved_record["link"] = link
            saved_record["linkId"] = link_id

            owners[identity] = {
                "filename": filename,
                "username": username.strip(),
                "platform": platform,
                "issuedAt": issued_at,
                "linkId": link_id,
            }
            items = state["items"]
            items.insert(0, saved_record)
            items = items[:REWARD_QUEUE_LIMIT]
            try:
                self.write_public_assignments(owners)
            except (OSError, ValueError) as error:
                self.send_json(500, {"error": f"The public reward registry could not be saved: {error}"})
                return

            queue_warning = ""
            try:
                REWARD_QUEUE_TEMP.write_text(
                    json.dumps({
                        "version": REWARD_STATE_VERSION,
                        "owners": owners,
                        "items": items,
                    }, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                REWARD_QUEUE_TEMP.replace(REWARD_QUEUE)
            except OSError as error:
                queue_warning = "The public assignment is saved, but the recent-link queue could not be updated."
                print(f"[widget] Warning: {queue_warning} {error}")
        response = {"ok": True, "linkId": link_id, "link": link}
        if queue_warning:
            response["warning"] = queue_warning
        self.send_json(201, response)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt: str, *args: object) -> None:
        print("[widget] " + (fmt % args))


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the OBS trivia widget on localhost.")
    parser.add_argument("port", nargs="?", type=int, default=8765)
    args = parser.parse_args()

    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), NoCacheHandler)
    print(f"OBS Trivia Widget: http://127.0.0.1:{args.port}/")
    print(f"Reward link dashboard: http://127.0.0.1:{args.port}/reward-links.html")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
