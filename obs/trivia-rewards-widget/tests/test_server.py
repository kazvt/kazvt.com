import base64
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


def base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def noncanonical_base64url(value: str) -> str:
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    last_value = alphabet.index(value[-1])
    changed_last_value = (last_value & 0b110000) | ((last_value + 1) & 0b001111)
    return value[:-1] + alphabet[changed_last_value]


def syntactically_valid_jwe() -> str:
    header = base64url(b'{"alg":"dir","enc":"A256GCM"}')
    iv = base64url(bytes(range(12)))
    ciphertext = base64url(b"opaque")
    tag = base64url(bytes(range(16)))
    return f"{header}..{iv}.{ciphertext}.{tag}"


class RewardQueueApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.original_paths = (
            widget_server.REWARD_QUEUE,
            widget_server.REWARD_QUEUE_TEMP,
            widget_server.REWARD_FILES,
        )
        widget_server.REWARD_QUEUE = root / "queue.json"
        widget_server.REWARD_QUEUE_TEMP = root / "queue.json.tmp"
        widget_server.REWARD_FILES = {"test reward.png"}
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
         widget_server.REWARD_FILES) = self.original_paths
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
        token = syntactically_valid_jwe()
        key = base64url(bytes(range(32)))
        return {
            "id": "test-1",
            "username": "Viewer",
            "filename": "test reward.png",
            "platform": "twitch",
            "issuedAt": "2026-10-06T12:00:00.000Z",
            "link": f"https://kazvt.com/reward/?id={token}#key={key}",
        }

    def post(self, record, headers=None):
        request_headers = {"Content-Type": "application/json"}
        request_headers.update(headers or {})
        return self.request("POST", "/api/rewards", json.dumps(record), request_headers)

    def test_valid_link_is_saved_and_returned_to_dashboard(self):
        status, response = self.post(self.valid_record())
        self.assertEqual(status, 201)
        self.assertEqual(json.loads(response), {"ok": True})

        status, response = self.request("GET", "/api/rewards")
        self.assertEqual(status, 200)
        items = json.loads(response)["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["username"], "Viewer")
        self.assertEqual(items[0]["filename"], "test reward.png")

    def test_rejects_cross_origin_and_form_encoded_posts(self):
        status, _ = self.post(self.valid_record(), {"Origin": "https://attacker.example"})
        self.assertEqual(status, 403)
        status, _ = self.request("POST", "/api/rewards", "{}", {"Content-Type": "text/plain"})
        self.assertEqual(status, 415)
        status, _ = self.request("GET", "/index.html", headers={"Origin": "https://attacker.example"})
        self.assertEqual(status, 403)
        status, _ = self.request("HEAD", "/index.html", headers={"Host": f"evil.example:{self.port}"})
        self.assertEqual(status, 403)

    def test_rejects_duplicate_or_extra_url_fields_and_noncanonical_keys(self):
        record = self.valid_record()
        record["link"] += "&id=duplicate"
        status, _ = self.post(record)
        self.assertEqual(status, 400)

        record = self.valid_record()
        record["link"] += "&extra=unexpected"
        status, _ = self.post(record)
        self.assertEqual(status, 400)

        record = self.valid_record()
        record["link"] += "&key=duplicate"
        status, _ = self.post(record)
        self.assertEqual(status, 400)

        record = self.valid_record()
        prefix, key = record["link"].rsplit("#key=", 1)
        record["link"] = f"{prefix}#key={noncanonical_base64url(key)}"
        status, _ = self.post(record)
        self.assertEqual(status, 400)

    def test_rejects_unknown_assets_bad_jwe_and_invalid_host(self):
        record = self.valid_record()
        record["filename"] = "../private.png"
        status, _ = self.post(record)
        self.assertEqual(status, 400)

        record = self.valid_record()
        bad_header = base64url(b'{"alg":"dir","enc":"A128GCM"}')
        bad_jwe = f"{bad_header}..{base64url(bytes(range(12)))}.{base64url(b'opaque')}.{base64url(bytes(range(16)))}"
        record["link"] = f"https://kazvt.com/reward/?id={bad_jwe}#key={base64url(bytes(range(32)))}"
        status, _ = self.post(record)
        self.assertEqual(status, 400)

        record = self.valid_record()
        duplicate_header = base64url(b'{"alg":"none","alg":"dir","enc":"A256GCM"}')
        duplicate_jwe = f"{duplicate_header}..{base64url(bytes(range(12)))}.{base64url(b'opaque')}.{base64url(bytes(range(16)))}"
        record["link"] = f"https://kazvt.com/reward/?id={duplicate_jwe}#key={base64url(bytes(range(32)))}"
        status, _ = self.post(record)
        self.assertEqual(status, 400)

        status, _ = self.request("GET", "/api/rewards", headers={"Host": f"evil.example:{self.port}"})
        self.assertEqual(status, 403)


if __name__ == "__main__":
    unittest.main()
