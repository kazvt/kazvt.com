#!/usr/bin/env python3
"""Tiny localhost-only static server for the OBS trivia widget."""

from __future__ import annotations

import argparse
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
REWARD_QUEUE_LIMIT = 250
REWARD_QUEUE_LOCK = threading.Lock()

try:
    with (ROOT / "rewards.json").open("r", encoding="utf-8-sig") as catalog_file:
        REWARD_FILES = set(json.load(catalog_file).get("files", []))
except (OSError, json.JSONDecodeError, AttributeError):
    REWARD_FILES = set()


class NoCacheHandler(SimpleHTTPRequestHandler):
    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_reward_queue(self) -> list[dict[str, str]]:
        try:
            with REWARD_QUEUE.open("r", encoding="utf-8") as queue_file:
                data = json.load(queue_file)
            items = data.get("items", []) if isinstance(data, dict) else []
            return items if isinstance(items, list) else []
        except (OSError, json.JSONDecodeError):
            return []

    def do_GET(self) -> None:
        if urlsplit(self.path).path == "/api/rewards":
            with REWARD_QUEUE_LOCK:
                items = self.read_reward_queue()
            self.send_json(200, {"items": items})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/api/rewards":
            self.send_error(404, "Not found")
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
        if not isinstance(username, str) or not username.strip() or len(username) > 100:
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

        parsed_link = urlsplit(link)
        query_id = parse_qs(parsed_link.query).get("id", [""])[0]
        key = parse_qs(parsed_link.fragment).get("key", [""])[0]
        if (parsed_link.scheme != "https" or parsed_link.netloc.lower() != "kazvt.com" or
                parsed_link.path.rstrip("/") != "/reward" or
                not re.fullmatch(r"[A-Za-z0-9_-]{32,2048}", query_id) or
                not re.fullmatch(r"[A-Za-z0-9_-]{32,64}", key)):
            self.send_json(400, {"error": "Reward link format is invalid."})
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
            items = self.read_reward_queue()
            items.insert(0, saved_record)
            items = items[:REWARD_QUEUE_LIMIT]
            REWARD_QUEUE_TEMP.write_text(
                json.dumps({"items": items}, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            REWARD_QUEUE_TEMP.replace(REWARD_QUEUE)
        self.send_json(201, {"ok": True})

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
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
