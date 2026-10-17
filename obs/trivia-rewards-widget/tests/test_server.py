from concurrent.futures import ThreadPoolExecutor
import http.client
import importlib.util
import json
import tempfile
import threading
import unittest
from pathlib import Path


SERVER_PATH = Path(__file__).resolve().parents[1] / "server.py"
SPEC = importlib.util.spec_from_file_location("reward_widget_server", SERVER_PATH)
widget_server = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(widget_server)


class RewardQueueApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.original_paths = (
            widget_server.REWARD_QUEUE,
            widget_server.REWARD_QUEUE_TEMP,
            widget_server.PUBLIC_ASSIGNMENTS,
            widget_server.PUBLIC_ASSIGNMENTS_TEMP,
            widget_server.PUBLIC_POOL,
            widget_server.PUBLIC_POOL_TEMP,
            widget_server.RESERVATIONS_FILE,
            widget_server.REWARD_FILES,
            widget_server.REWARD_SHA256,
            widget_server.REWARD_FILENAME_HISTORY,
        )
        widget_server.REWARD_QUEUE = root / "queue.json"
        widget_server.REWARD_QUEUE_TEMP = root / "queue.json.tmp"
        widget_server.PUBLIC_ASSIGNMENTS = root / "assignments.json"
        widget_server.PUBLIC_ASSIGNMENTS_TEMP = root / "assignments.json.tmp"
        widget_server.PUBLIC_POOL = root / "pool.json"
        widget_server.PUBLIC_POOL_TEMP = root / "pool.json.tmp"
        widget_server.RESERVATIONS_FILE = root / "reservations.txt"
        widget_server.RESERVATIONS_FILE.write_text("", encoding="utf-8")
        widget_server.REWARD_FILES = {"test reward.png", "1.png"}
        widget_server.REWARD_SHA256 = {
            "test reward.png": "a" * 64,
            "1.png": "3029196882de1c75ad40ad3cc9ebe3612b8bf29c0328b36d6dce5db6f45ede03",
        }
        widget_server.REWARD_FILENAME_HISTORY = {}
        self.httpd = widget_server.ThreadingHTTPServer(("127.0.0.1", 0), widget_server.NoCacheHandler)
        self.httpd.daemon_threads = True
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)
        (widget_server.REWARD_QUEUE,
         widget_server.REWARD_QUEUE_TEMP,
         widget_server.PUBLIC_ASSIGNMENTS,
         widget_server.PUBLIC_ASSIGNMENTS_TEMP,
         widget_server.PUBLIC_POOL,
         widget_server.PUBLIC_POOL_TEMP,
         widget_server.RESERVATIONS_FILE,
         widget_server.REWARD_FILES,
         widget_server.REWARD_SHA256,
         widget_server.REWARD_FILENAME_HISTORY) = self.original_paths
        self.temp_dir.cleanup()

    def request(self, method: str, path: str, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        data = response.read()
        status = response.status
        connection.close()
        return status, data

    def valid_record(self):
        return {
            "id": "test-1",
            "username": "Viewer",
            "filename": "test reward.png",
            "platform": "twitch",
            "issuedAt": "2026-10-06T12:00:00.000Z",
            "link": "https://attacker.example/reward/?id=made-up",
            "linkId": "00000000-0000-0000-0000-000000000000",
        }

    def post(self, record, headers=None):
        request_headers = {"Content-Type": "application/json"}
        request_headers.update(headers or {})
        return self.request("POST", "/api/rewards", json.dumps(record), request_headers)

    def test_server_issues_short_link_and_ignores_client_supplied_url_and_id(self):
        status, response = self.post(self.valid_record())
        self.assertEqual(status, 201)
        issued = json.loads(response)
        self.assertTrue(issued["ok"])
        self.assertRegex(issued["linkId"], widget_server.COMPACT_REWARD_ID_PATTERN)
        self.assertEqual(len(issued["linkId"]), 16)
        self.assertEqual(issued["link"], f"https://kazvt.com/reward/?id={issued['linkId']}")
        self.assertNotIn("#", issued["link"])
        self.assertNotIn("attacker.example", issued["link"])
        self.assertNotEqual(issued["linkId"], "00000000-0000-0000-0000-000000000000")

        status, response = self.request("GET", "/api/rewards")
        self.assertEqual(status, 200)
        items = json.loads(response)["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["username"], "Viewer")
        self.assertEqual(items[0]["filename"], "test reward.png")
        self.assertEqual(items[0]["link"], issued["link"])
        self.assertEqual(items[0]["linkId"], issued["linkId"])

        public_registry = json.loads(widget_server.PUBLIC_ASSIGNMENTS.read_text(encoding="utf-8"))
        self.assertEqual(public_registry["version"], 1)
        self.assertEqual(len(public_registry["assignments"]), 2)
        assignment = next(item for item in public_registry["assignments"] if item["filename"] == "test reward.png")
        self.assertEqual(assignment["assetSha256"], "a" * 64)
        self.assertEqual(assignment["assetId"], "a" * 64)
        self.assertEqual(assignment["username"], "Viewer")
        self.assertEqual(assignment["linkId"], issued["linkId"])
        saved_owner = object.__new__(widget_server.NoCacheHandler).read_reward_state()["owners"]["a" * 64]
        self.assertEqual(saved_owner["linkId"], issued["linkId"])
        self.assertNotIn("link", assignment)
        self.assertNotIn("id", assignment)
        self.assertNotIn("key", assignment)

        status, response = self.request("GET", "/api/rewards/available")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(response)["files"], [])

    def test_reserved_art_is_omitted_from_pool_and_rejected_for_other_names(self):
        widget_server.RESERVATIONS_FILE.write_text(
            "OnlyViewer, viewer-0000 => test reward.png\n", encoding="utf-8"
        )
        status, response = self.request("GET", "/api/rewards/available")
        self.assertEqual(status, 200)
        self.assertNotIn("test reward.png", json.loads(response)["files"])

        intruder = self.valid_record()
        intruder["username"] = "SomeoneElse"
        status, _ = self.post(intruder)
        self.assertEqual(status, 403)

        intended = self.valid_record()
        intended["username"] = "@VIEWER-0000"
        status, response = self.post(intended)
        self.assertEqual(status, 201, response)

    def test_artwork_cannot_be_assigned_twice(self):
        record = self.valid_record()
        status, _ = self.post(record)
        self.assertEqual(status, 201)

        duplicate = self.valid_record()
        duplicate["id"] = "test-2"
        duplicate["username"] = "AnotherViewer"
        status, response = self.post(duplicate)
        self.assertEqual(status, 409)
        self.assertIn("already been assigned", json.loads(response)["error"])

        status, response = self.request("GET", "/api/rewards")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(response)["items"]), 1)

    def test_concurrent_awards_cannot_assign_the_same_artwork_twice(self):
        first = self.valid_record()
        second = self.valid_record()
        second["id"] = "test-2"
        second["username"] = "AnotherViewer"

        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(self.post, (first, second)))

        self.assertEqual(sorted(status for status, _ in responses), [201, 409])
        saved_state = json.loads(widget_server.REWARD_QUEUE.read_text(encoding="utf-8"))
        awarded_owners = [
            owner for owner in saved_state["owners"].values()
            if owner["filename"] == "test reward.png"
        ]
        self.assertEqual(len(awarded_owners), 1)
        self.assertEqual(len(saved_state["items"]), 1)
        self.assertEqual(saved_state["items"][0]["username"], awarded_owners[0]["username"])

    def test_1_png_is_preassigned_to_kazvt_and_never_offered(self):
        widget_server.REWARD_FILES.add("1.png")
        widget_server.REWARD_FILES.add("copy of 1.png")
        shared_digest = next(iter(widget_server.PREASSIGNED_REWARDS))
        widget_server.REWARD_SHA256 = {
            "1.png": shared_digest,
            "copy of 1.png": shared_digest,
        }
        status, response = self.request("GET", "/api/rewards/available")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(response)["files"], ["test reward.png"])

        for filename in ("1.png", "copy of 1.png"):
            record = self.valid_record()
            record["filename"] = filename
            status, response = self.post(record)
            self.assertEqual(status, 409)
            self.assertIn("already been assigned", json.loads(response)["error"])

    def test_preassigned_artwork_remains_kazvt_after_renaming(self):
        content_id = next(iter(widget_server.PREASSIGNED_REWARDS))
        widget_server.REWARD_FILES = {"renamed special award.png"}
        widget_server.REWARD_SHA256 = {"renamed special award.png": content_id}
        widget_server.REWARD_FILENAME_HISTORY = {"1.png": content_id}

        state = object.__new__(widget_server.NoCacheHandler).read_reward_state()
        self.assertEqual(state["owners"][content_id]["username"], "kazvt")
        self.assertEqual(state["owners"][content_id]["filename"], "renamed special award.png")
        self.assertEqual(
            state["owners"][content_id]["linkId"],
            widget_server.PREASSIGNED_REWARDS[content_id]["linkId"],
        )
        status, response = self.request("GET", "/api/rewards/available")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(response)["files"], [])

    def test_identical_artwork_cannot_repeat_under_a_different_filename(self):
        shared_digest = "a" * 64
        widget_server.REWARD_FILES.add("renamed reward.png")
        widget_server.REWARD_SHA256 = {
            "test reward.png": shared_digest,
            "renamed reward.png": shared_digest,
            "1.png": "3029196882de1c75ad40ad3cc9ebe3612b8bf29c0328b36d6dce5db6f45ede03",
        }
        status, _ = self.post(self.valid_record())
        self.assertEqual(status, 201)

        status, response = self.request("GET", "/api/rewards/available")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(response)["files"], [])

        duplicate = self.valid_record()
        duplicate["filename"] = "renamed reward.png"
        status, response = self.post(duplicate)
        self.assertEqual(status, 409)
        self.assertIn("already been assigned", json.loads(response)["error"])

    def test_legacy_queue_assignments_migrate_into_the_permanent_ledger(self):
        widget_server.REWARD_QUEUE.write_text(
            json.dumps({"items": [self.valid_record()]}), encoding="utf-8"
        )
        status, response = self.request("GET", "/api/rewards/available")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(response)["files"], [])

    def test_public_registry_assignments_are_not_offered_again(self):
        widget_server.PUBLIC_ASSIGNMENTS.write_text(json.dumps({
            "version": 1,
            "assignments": [
                {
                    "assetId": "a" * 64,
                    "filename": "test reward.png",
                    "username": "Viewer",
                    "issuedAt": "2026-10-06T12:00:00.000Z",
                    "platform": "twitch",
                },
                {
                    "assetSha256": next(iter(widget_server.PREASSIGNED_REWARDS)),
                    "filename": "1.png",
                    "username": "kazvt",
                    "issuedAt": "2026-10-13T00:00:00.000Z",
                    "platform": "manual",
                },
            ],
        }), encoding="utf-8")
        status, response = self.request("GET", "/api/rewards/available")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(response)["files"], [])

    def test_renaming_an_assigned_file_keeps_ownership_by_content_id(self):
        content_id = "a" * 64
        widget_server.REWARD_FILES = {"renamed award.png"}
        widget_server.REWARD_SHA256 = {
            "renamed award.png": content_id,
            "1.png": next(iter(widget_server.PREASSIGNED_REWARDS)),
        }
        widget_server.REWARD_FILENAME_HISTORY = {"old award.png": content_id}
        widget_server.PUBLIC_ASSIGNMENTS.write_text(json.dumps({
            "version": 1,
            "assignments": [{
                "assetSha256": content_id,
                "filename": "old award.png",
                "username": "Viewer",
                "issuedAt": "2026-10-06T12:00:00.000Z",
                "platform": "twitch",
            }],
        }), encoding="utf-8")

        handler = object.__new__(widget_server.NoCacheHandler)
        state = handler.read_reward_state()
        self.assertEqual(state["owners"][content_id]["filename"], "renamed award.png")

        handler.write_public_assignments(state["owners"])
        saved = json.loads(widget_server.PUBLIC_ASSIGNMENTS.read_text(encoding="utf-8"))
        assigned = next(row for row in saved["assignments"] if row["assetId"] == content_id)
        self.assertEqual(assigned["filename"], "renamed award.png")
        self.assertRegex(assigned["linkId"], widget_server.COMPACT_REWARD_ID_PATTERN)
        status, response = self.request("GET", "/api/rewards/available")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(response)["files"], [])

        duplicate = self.valid_record()
        duplicate["filename"] = "renamed award.png"
        duplicate["username"] = "AnotherViewer"
        status, response = self.post(duplicate)
        self.assertEqual(status, 409)
        self.assertIn("already been assigned", json.loads(response)["error"])

    def test_rejects_cross_origin_and_form_encoded_posts(self):
        status, _ = self.post(self.valid_record(), {"Origin": "https://attacker.example"})
        self.assertEqual(status, 403)
        status, _ = self.request("POST", "/api/rewards", "{}", {"Content-Type": "text/plain"})
        self.assertEqual(status, 415)
        status, _ = self.request("GET", "/index.html", headers={"Origin": "https://attacker.example"})
        self.assertEqual(status, 403)
        status, _ = self.request("HEAD", "/index.html", headers={"Host": f"evil.example:{self.port}"})
        self.assertEqual(status, 403)

    def test_public_registry_rejects_invalid_or_reused_link_ids(self):
        duplicate_id = "e2b8a0b2-7dd8-4d10-802f-d308ec33ffe7"
        widget_server.PUBLIC_ASSIGNMENTS.write_text(json.dumps({
            "version": 1,
            "assignments": [
                {
                    "assetId": "a" * 64,
                    "filename": "test reward.png",
                    "username": "Viewer",
                    "issuedAt": "2026-10-06T12:00:00.000Z",
                    "platform": "twitch",
                    "linkId": duplicate_id,
                },
                {
                    "assetId": "b" * 64,
                    "filename": "second reward.png",
                    "username": "Someone else",
                    "issuedAt": "2026-10-06T12:01:00.000Z",
                    "platform": "twitch",
                    "linkId": duplicate_id,
                },
            ],
        }), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "repeats a link ID"):
            object.__new__(widget_server.NoCacheHandler).read_reward_state()

        widget_server.PUBLIC_ASSIGNMENTS.write_text(json.dumps({
            "version": 1,
            "assignments": [{
                "assetId": "a" * 64,
                "filename": "test reward.png",
                "username": "Viewer",
                "issuedAt": "2026-10-06T12:00:00.000Z",
                "platform": "twitch",
                "linkId": "not-a-uuid",
            }],
        }), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "record is invalid"):
            object.__new__(widget_server.NoCacheHandler).read_reward_state()

    def test_public_registry_accepts_short_ids_and_preserves_case(self):
        link_id = "aB3_dE5-fG7_hJ9k"
        widget_server.PUBLIC_ASSIGNMENTS.write_text(json.dumps({
            "version": 1,
            "assignments": [{
                "assetId": "a" * 64,
                "filename": "test reward.png",
                "username": "Viewer",
                "issuedAt": "2026-10-06T12:00:00.000Z",
                "platform": "twitch",
                "linkId": link_id,
            }],
        }), encoding="utf-8")
        state = object.__new__(widget_server.NoCacheHandler).read_reward_state()
        self.assertEqual(state["owners"]["a" * 64]["linkId"], link_id)

        duplicate_id = "AaBbCcDdEeFf1234"
        widget_server.PUBLIC_ASSIGNMENTS.write_text(json.dumps({
            "version": 1,
            "assignments": [
                {
                    "assetId": "a" * 64, "filename": "test reward.png", "username": "Viewer",
                    "issuedAt": "2026-10-06T12:00:00.000Z", "platform": "twitch", "linkId": duplicate_id,
                },
                {
                    "assetId": "b" * 64, "filename": "second reward.png", "username": "Someone else",
                    "issuedAt": "2026-10-06T12:01:00.000Z", "platform": "twitch", "linkId": duplicate_id,
                },
            ],
        }), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "repeats a link ID"):
            object.__new__(widget_server.NoCacheHandler).read_reward_state()

    def test_rejects_unknown_assets_and_invalid_host(self):
        record = self.valid_record()
        record["filename"] = "../private.png"
        status, _ = self.post(record)
        self.assertEqual(status, 400)

        status, _ = self.request("GET", "/api/rewards", headers={"Host": f"evil.example:{self.port}"})
        self.assertEqual(status, 403)


if __name__ == "__main__":
    unittest.main()
