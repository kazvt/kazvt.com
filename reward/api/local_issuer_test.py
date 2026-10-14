import hashlib
import json
import struct
import subprocess
import tempfile
import unittest
import zlib
from pathlib import Path

import local_issuer
from local_issuer import RewardIssueError, issue_and_publish, list_available_artwork


def png_bytes(width: int, height: int) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">II", width, height) + bytes((8, 6, 0, 0, 0))
    rows = b"".join(b"\x00" + bytes((30, 90, 170, 255)) * width for _ in range(height))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


def git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


class LocalRewardIssuerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.site = self.base / "site"
        self.remote = self.base / "origin.git"
        self.reward_dir = self.site / "zzz_assets" / "rewards"
        self.reward_dir.mkdir(parents=True)
        subprocess.run(["git", "init", "--bare", "--initial-branch=main", str(self.remote)], check=True, capture_output=True)
        subprocess.run(["git", "init", "--initial-branch=main", str(self.site)], check=True, capture_output=True)
        git(self.site, "config", "user.name", "Reward Issuer Test")
        git(self.site, "config", "user.email", "reward-test@example.invalid")
        self.art_ids = []
        assets = {}
        assets_by_id = {}
        files = []
        for name, width, height in (("toast.png", 2, 3), ("star.png", 3, 2)):
            image = png_bytes(width, height)
            asset_id = hashlib.sha256(image).hexdigest()
            (self.reward_dir / name).write_bytes(image)
            self.art_ids.append(asset_id)
            files.append(name)
            metadata = {"assetId": asset_id, "sha256": asset_id, "width": width, "height": height, "tier": "rare"}
            assets[name] = metadata
            assets_by_id[asset_id] = {"filename": name, "width": width, "height": height, "tier": "rare"}
        self.catalog = {
            "version": 4,
            "assetIdAlgorithm": "sha256-png-bytes-v1",
            "files": files,
            "assets": assets,
            "assetsById": assets_by_id,
        }
        (self.reward_dir / "manifest.json").write_text(json.dumps(self.catalog), encoding="utf-8")
        (self.reward_dir / "assignments.json").write_text(json.dumps({"version": 1, "assignments": []}), encoding="utf-8")
        git(self.site, "add", "zzz_assets/rewards")
        git(self.site, "commit", "-m", "test fixture")
        git(self.site, "remote", "add", "origin", str(self.remote))
        git(self.site, "push", "--set-upstream", "origin", "main")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_issues_once_pushes_only_registry_and_replays_idempotently(self) -> None:
        self.assertEqual(len(list_available_artwork(self.site)), 2)
        request = {"username": "Wïnner", "assetId": self.art_ids[0], "eventId": "match-7-winner-2"}
        first = issue_and_publish(self.site, request, expected_remote=str(self.remote))
        self.assertFalse(first["replayed"])
        self.assertTrue(first["pushed"])
        self.assertRegex(first["assignment"]["linkId"], r"^[A-Za-z0-9_-]{16}$")
        self.assertNotIn("eventId", first["assignment"])
        self.assertEqual(first["assignment"]["eventIdHash"], hashlib.sha256(request["eventId"].encode()).hexdigest())
        self.assertEqual(first["href"], f"https://kazvt.com/reward/?id={first['assignment']['linkId']}")
        self.assertEqual(git(self.site, "diff", "--name-only", "HEAD^", "HEAD"), "zzz_assets/rewards/assignments.json")
        self.assertEqual(len(list_available_artwork(self.site)), 1)

        replay = issue_and_publish(self.site, request, expected_remote=str(self.remote))
        self.assertTrue(replay["replayed"])
        self.assertEqual(replay["assignment"]["linkId"], first["assignment"]["linkId"])
        self.assertEqual(len(json.loads((self.reward_dir / "assignments.json").read_text())["assignments"]), 1)

    def test_rejects_reused_event_for_different_winner_or_art(self) -> None:
        request = {"username": "Winner", "assetId": self.art_ids[0], "eventId": "one-event"}
        issue_and_publish(self.site, request, expected_remote=str(self.remote))
        with self.assertRaisesRegex(RewardIssueError, "different winner or artwork"):
            issue_and_publish(
                self.site,
                {"username": "Other", "assetId": self.art_ids[1], "eventId": "one-event"},
                expected_remote=str(self.remote),
            )
        with self.assertRaisesRegex(RewardIssueError, "already been awarded"):
            issue_and_publish(
                self.site,
                {"username": "Winner", "assetId": self.art_ids[0], "eventId": "different-event"},
                expected_remote=str(self.remote),
            )

    def test_refuses_dirty_worktree_and_modified_png(self) -> None:
        (self.site / "unrelated.tmp").write_text("keep me", encoding="utf-8")
        with self.assertRaisesRegex(RewardIssueError, "local changes"):
            issue_and_publish(
                self.site,
                {"username": "Winner", "assetId": self.art_ids[0], "eventId": "dirty"},
                expected_remote=str(self.remote),
            )
        (self.site / "unrelated.tmp").unlink()
        (self.reward_dir / "toast.png").write_bytes(b"not the cataloged reward")
        with self.assertRaisesRegex(RewardIssueError, "changed after the reward catalog"):
            local_issuer._verify_artwork(self.site, self.catalog, self.art_ids[0])


if __name__ == "__main__":
    unittest.main()
