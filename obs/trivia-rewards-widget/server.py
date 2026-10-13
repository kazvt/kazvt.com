#!/usr/bin/env python3
"""Tiny localhost-only static server for the OBS trivia widget."""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import os
import re
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent
REWARD_QUEUE = ROOT / ".reward-queue.json"
REWARD_QUEUE_TEMP = ROOT / ".reward-queue.json.tmp"
PUBLIC_ASSIGNMENTS = ROOT.parent.parent / "zzz_assets" / "rewards" / "assignments.json"
PUBLIC_ASSIGNMENTS_TEMP = PUBLIC_ASSIGNMENTS.with_name(PUBLIC_ASSIGNMENTS.name + ".tmp")
REWARD_QUEUE_LIMIT = 250
REWARD_QUEUE_LOCK = threading.Lock()
REWARD_STATE_VERSION = 2
PREASSIGNED_REWARDS = {
    "3029196882de1c75ad40ad3cc9ebe3612b8bf29c0328b36d6dce5db6f45ede03": {
        "username": "kazvt",
        "platform": "manual",
        "issuedAt": "2026-10-13T00:00:00.000Z",
    }
}
SUPPORTED_REWARD_PROTECTED_HEADER = base64.urlsafe_b64encode(
    b'{"alg":"dir","enc":"A256GCM"}'
).decode("ascii").rstrip("=")

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


def decode_base64url(value: str) -> bytes:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise ValueError("Invalid base64url value.")
    padded = value + "=" * ((4 - len(value) % 4) % 4)
    decoded = base64.b64decode(padded, altchars=b"-_", validate=True)
    canonical = base64.urlsafe_b64encode(decoded).decode("ascii").rstrip("=")
    if canonical != value:
        raise ValueError("Non-canonical base64url value.")
    return decoded


def _reject_duplicate_header_names(pairs: list[tuple[str, object]]) -> dict[str, object]:
    header: dict[str, object] = {}
    for name, value in pairs:
        if name in header:
            raise ValueError("Duplicate protected header parameter.")
        header[name] = value
    return header


def is_supported_reward_jwe(value: str) -> bool:
    if not isinstance(value, str) or len(value) > 2048:
        return False
    parts = value.split(".")
    if len(parts) != 5 or not parts[0] or parts[1] != "":
        return False
    if parts[0] != SUPPORTED_REWARD_PROTECTED_HEADER:
        return False
    try:
        header = json.loads(
            decode_base64url(parts[0]).decode("utf-8"),
            object_pairs_hook=_reject_duplicate_header_names,
        )
        iv = decode_base64url(parts[2])
        ciphertext = decode_base64url(parts[3])
        tag = decode_base64url(parts[4])
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError, binascii.Error):
        return False
    return (
        isinstance(header, dict)
        and header == {"alg": "dir", "enc": "A256GCM"}
        and len(iv) == 12
        and 0 < len(ciphertext) <= 1024
        and len(tag) == 16
    )


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
            normalized_owners.setdefault(canonical_identity, {
                "filename": current_reward_filename(canonical_identity) or filename,
                "username": owner["username"].strip(),
                "platform": str(owner.get("platform", "chat"))[:60],
                "issuedAt": str(owner.get("issuedAt", ""))[:40],
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
        for assignment in public_registry["assignments"]:
            if not isinstance(assignment, dict):
                raise ValueError("The public assignment record is invalid.")
            filename = assignment.get("filename")
            username = assignment.get("username")
            digest = assignment.get("assetId", assignment.get("assetSha256"))
            legacy_digest = assignment.get("assetSha256")
            platform = assignment.get("platform", "manual")
            issued_at = assignment.get("issuedAt", "")
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
                    not isinstance(issued_at, str) or len(issued_at) > 40):
                raise ValueError("The public assignment record is invalid.")
            identity = digest.lower()
            if identity in seen_public_assets:
                raise ValueError("The public assignment registry repeats artwork.")
            seen_public_assets.add(identity)
            current_filename = current_reward_filename(identity)
            existing = normalized_owners.get(identity)
            if existing and existing["username"].casefold() != username.strip().casefold():
                raise ValueError("The public registry conflicts with the saved ownership ledger.")
            normalized_owners.setdefault(identity, {
                "filename": current_filename or filename,
                "username": username.strip(),
                "platform": platform,
                "issuedAt": issued_at,
            })

        for identity, owner in PREASSIGNED_REWARDS.items():
            filename = current_reward_filename(identity)
            if not filename:
                continue
            existing = normalized_owners.get(identity)
            if existing and existing["username"].casefold() != owner["username"].casefold():
                raise ValueError("The preassigned reward conflicts with the saved ownership ledger.")
            normalized_owners.setdefault(identity, {"filename": filename, **owner})

        return {
            "version": REWARD_STATE_VERSION,
            "owners": normalized_owners,
            "items": items[:REWARD_QUEUE_LIMIT],
        }

    def write_public_assignments(self, owners: dict[str, dict[str, str]]) -> None:
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
        link = record.get("link")
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
        if not isinstance(link, str) or len(link) > 2048:
            self.send_json(400, {"error": "Invalid reward link."})
            return

        try:
            parsed_link = urlsplit(link)
        except ValueError:
            self.send_json(400, {"error": "Reward link format is invalid."})
            return
        query = parse_qs(parsed_link.query, keep_blank_values=True)
        fragment = parse_qs(parsed_link.fragment, keep_blank_values=True)
        query_id = query.get("id", [""])[0]
        key = fragment.get("key", [""])[0]
        if (parsed_link.scheme != "https" or parsed_link.netloc.lower() != "kazvt.com" or
                parsed_link.path.rstrip("/") != "/reward" or
                set(query) != {"id"} or len(query.get("id", [])) != 1 or
                set(fragment) != {"key"} or len(fragment.get("key", [])) != 1 or
                not is_supported_reward_jwe(query_id) or
                not re.fullmatch(r"[A-Za-z0-9_-]{43}", key)):
            self.send_json(400, {"error": "Reward link format is invalid."})
            return
        try:
            if len(decode_base64url(key)) != 32:
                raise ValueError("Wrong key size.")
        except (ValueError, binascii.Error):
            self.send_json(400, {"error": "Reward link key is invalid."})
            return

        saved_record = {
            "id": str(record.get("id", ""))[:80],
            "username": username.strip(),
            "filename": filename,
            "link": link,
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

            owners[identity] = {
                "filename": filename,
                "username": username.strip(),
                "platform": platform,
                "issuedAt": issued_at,
            }
            items = state["items"]
            items.insert(0, saved_record)
            items = items[:REWARD_QUEUE_LIMIT]
            REWARD_QUEUE_TEMP.write_text(
                json.dumps({
                    "version": REWARD_STATE_VERSION,
                    "owners": owners,
                    "items": items,
                }, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            REWARD_QUEUE_TEMP.replace(REWARD_QUEUE)
            try:
                self.write_public_assignments(owners)
            except (OSError, ValueError) as error:
                # The private ledger remains authoritative if the source checkout is read-only
                # or the widget is running from a distributable copy without the website repo.
                print(f"[widget] Warning: public assignment registry was not updated: {error}")
        self.send_json(201, {"ok": True})

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
