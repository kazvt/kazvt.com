import hashlib
import base64
import json
import struct
import subprocess
import tempfile
import unittest
import zlib
from pathlib import Path

import local_issuer
from local_issuer import (
    RewardIssueError,
    clear_user_rewards_and_publish,
    issue_and_publish,
    issue_next_and_publish,
    list_available_artwork,
    unassign_latest_and_publish,
)


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
        (self.site / "reward" / "api").mkdir(parents=True)
        (self.site / ".gitignore").write_text(
            "reward/api/reservations.local.txt\n", encoding="utf-8"
        )
        subprocess.run(["git", "init", "--bare", "--initial-branch=main", str(self.remote)], check=True, capture_output=True)
        subprocess.run(["git", "init", "--initial-branch=main", str(self.site)], check=True, capture_output=True)
        git(self.site, "config", "user.name", "Reward Issuer Test")
        git(self.site, "config", "user.email", "reward-test@example.invalid")
        git(self.site, "config", "commit.gpgsign", "false")
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
            "assetIdAlgorithm": "sha256-image-bytes-v1",
            "files": files,
            "assets": assets,
            "assetsById": assets_by_id,
        }
        (self.reward_dir / "manifest.json").write_text(json.dumps(self.catalog), encoding="utf-8")
        (self.reward_dir / "assignments.json").write_text(json.dumps({"version": 1, "assignments": []}), encoding="utf-8")
        (self.reward_dir / "pool.json").write_text(
            json.dumps({"version": 1, "remaining": 2, "total": 2}), encoding="utf-8"
        )
        git(self.site, "add", ".gitignore", "zzz_assets/rewards")
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
        self.assertEqual(
            git(self.site, "diff", "--name-only", "HEAD^", "HEAD").splitlines(),
            ["zzz_assets/rewards/assignments.json", "zzz_assets/rewards/pool.json"],
        )
        self.assertEqual(len(list_available_artwork(self.site)), 1)
        self.assertEqual(
            json.loads((self.reward_dir / "pool.json").read_text(encoding="utf-8")),
            {"version": 1, "remaining": 1, "total": 2},
        )

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

    def test_chat_issue_uses_platform_user_id_updates_display_name_and_never_reuses_art(self) -> None:
        first = issue_next_and_publish(self.site, {
            "username": "@OldHandle", "userId": "123456", "platform": "twitch",
            "eventId": "twitch:message-1",
        }, expected_remote=str(self.remote))
        self.assertEqual(first["assignment"]["userId"], "123456")
        self.assertEqual(first["assignment"]["username"], "OldHandle")
        self.assertEqual(len(list_available_artwork(self.site)), 1)

        second = issue_next_and_publish(self.site, {
            "username": "NewHandle", "userId": "123456", "platform": "twitch",
            "eventId": "twitch:message-2",
        }, expected_remote=str(self.remote))
        self.assertNotEqual(second["assignment"]["assetId"], first["assignment"]["assetId"])
        records = json.loads((self.reward_dir / "assignments.json").read_text(encoding="utf-8"))["assignments"]
        self.assertEqual({record["username"] for record in records}, {"NewHandle"})
        self.assertEqual({record["userId"] for record in records}, {"123456"})
        self.assertEqual({record["platform"] for record in records}, {"twitch"})

        replay = issue_next_and_publish(self.site, {
            "username": "NewHandle", "userId": "123456", "platform": "twitch",
            "eventId": "twitch:message-2",
        }, expected_remote=str(self.remote))
        self.assertTrue(replay["replayed"])
        self.assertEqual(replay["assignment"]["linkId"], second["assignment"]["linkId"])
        with self.assertRaisesRegex(RewardIssueError, "No unassigned reward artwork"):
            issue_next_and_publish(self.site, {
                "username": "Other", "userId": "999", "platform": "youtube",
                "eventId": "youtube:message-3",
            }, expected_remote=str(self.remote))

    def test_alias_reservation_routes_gif_only_to_matching_user_and_excludes_it_from_pool(self) -> None:
        gif = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")
        filename = "Munch on this RABBIT.gif"
        asset_id = hashlib.sha256(gif).hexdigest()
        (self.reward_dir / filename).write_bytes(gif)
        self.catalog["files"].append(filename)
        self.catalog.setdefault("filenameHistory", {})[filename] = asset_id
        self.catalog["assets"][filename] = {
            "assetId": asset_id, "sha256": asset_id, "width": 1, "height": 1, "tier": "rare",
        }
        self.catalog["assetsById"][asset_id] = {
            "filename": filename, "width": 1, "height": 1, "tier": "rare",
        }
        (self.reward_dir / "manifest.json").write_text(json.dumps(self.catalog), encoding="utf-8")
        (self.site / local_issuer.RESERVATIONS_RELATIVE).write_text(
            '@ExampleViewer, example-viewer-0000 => "E:\\sites\\kazvt.com-1\\zzz_assets\\rewards\\Munch on this RABBIT.gif"\n',
            encoding="utf-8",
        )
        (self.reward_dir / "pool.json").write_text(
            json.dumps({"version": 1, "remaining": 2, "total": 2}), encoding="utf-8"
        )
        git(self.site, "add", "zzz_assets/rewards")
        git(self.site, "commit", "-m", "add reserved GIF test fixture")
        git(self.site, "push", "origin", "main")

        self.assertNotIn(asset_id, {item["assetId"] for item in list_available_artwork(self.site)})
        with self.assertRaisesRegex(RewardIssueError, "reserved for a different username"):
            issue_and_publish(self.site, {
                "username": "Intruder", "assetId": asset_id, "eventId": "manual-reserved-gif",
            }, expected_remote=str(self.remote))

        assigned = issue_next_and_publish(self.site, {
            "username": "@EXAMPLE-VIEWER-0000", "userId": "viewer-1", "platform": "twitch",
            "eventId": "twitch:reserved-gif",
        }, expected_remote=str(self.remote))
        self.assertEqual(assigned["assignment"]["assetId"], asset_id)
        self.assertEqual(assigned["assignment"]["filename"], filename)
        next_award = issue_next_and_publish(self.site, {
            "username": "OtherViewer", "userId": "viewer-2", "platform": "twitch",
            "eventId": "twitch:ordinary-gift",
        }, expected_remote=str(self.remote))
        self.assertNotEqual(next_award["assignment"]["assetId"], asset_id)
        self.assertEqual(len(list_available_artwork(self.site)), 1)
        public_pool = json.loads((self.reward_dir / "pool.json").read_text(encoding="utf-8"))
        self.assertEqual(public_pool, {"version": 1, "remaining": 1, "total": 2})
        public_files = git(self.site, "ls-files").splitlines()
        self.assertNotIn(local_issuer.RESERVATIONS_RELATIVE, public_files)
        self.assertNotIn("example-viewer", " ".join(public_files))

    def test_multiple_reservations_for_one_alias_are_issued_in_file_order(self) -> None:
        (self.site / local_issuer.RESERVATIONS_RELATIVE).write_text(
            "ReservedViewer, reserved-viewer -> toast.png\n"
            "RESERVEDVIEWER, RESERVED-VIEWER => star.png\n",
            encoding="utf-8",
        )
        self.assertEqual(list_available_artwork(self.site), [])

        first = issue_next_and_publish(self.site, {
            "username": "@RESERVED-VIEWER", "userId": "reserved-user", "platform": "twitch",
            "eventId": "twitch:reserved-order-1",
        }, expected_remote=str(self.remote))
        self.assertEqual(first["assignment"]["assetId"], self.art_ids[0])
        self.assertEqual(git(self.site, "status", "--porcelain=v1", "--untracked-files=normal"), "")

        second = issue_next_and_publish(self.site, {
            "username": "ReservedViewer", "userId": "reserved-user", "platform": "twitch",
            "eventId": "twitch:reserved-order-2",
        }, expected_remote=str(self.remote))
        self.assertEqual(second["assignment"]["assetId"], self.art_ids[1])

        with self.assertRaisesRegex(RewardIssueError, "All rewards reserved"):
            issue_next_and_publish(self.site, {
                "username": "reserved-viewer", "userId": "reserved-user", "platform": "twitch",
                "eventId": "twitch:reserved-order-3",
            }, expected_remote=str(self.remote))

    def test_refuses_dirty_worktree_and_modified_png(self) -> None:
        (self.site / "unrelated.tmp").write_text("keep me", encoding="utf-8")
        with self.assertRaisesRegex(RewardIssueError, "local changes"):
            issue_and_publish(
                self.site,
                {"username": "Winner", "assetId": self.art_ids[0], "eventId": "dirty"},
                expected_remote=str(self.remote),
            )
        (self.site / "unrelated.tmp").unlink()
        (self.reward_dir / "toast.png").write_bytes(png_bytes(4, 4))
        with self.assertRaisesRegex(RewardIssueError, "changed after the reward catalog"):
            local_issuer._verify_artwork(self.site, self.catalog, self.art_ids[0])

    def test_clean_checkout_fast_forwards_when_github_main_has_new_commits(self) -> None:
        peer = self.base / "peer"
        subprocess.run(
            ["git", "clone", str(self.remote), str(peer)],
            check=True,
            capture_output=True,
        )
        git(peer, "config", "user.name", "Site Maintainer")
        git(peer, "config", "user.email", "site-maintainer@example.invalid")
        git(peer, "config", "commit.gpgsign", "false")
        (peer / "site-note.txt").write_text("new site edit\n", encoding="utf-8")
        git(peer, "add", "site-note.txt")
        git(peer, "commit", "-m", "site update")
        git(peer, "push", "origin", "main")

        self.assertEqual(local_issuer._repo_sync_state(self.site, str(self.remote)), (0, 0))
        self.assertEqual(git(self.site, "rev-parse", "HEAD"), git(self.site, "rev-parse", "origin/main"))
        self.assertEqual((self.site / "site-note.txt").read_text(encoding="utf-8"), "new site edit\n")
        self.assertEqual(git(self.site, "status", "--porcelain=v1"), "")

    def test_unassign_latest_releases_art_and_preserves_retry_safety(self) -> None:
        winner = {"username": "Viewer", "userId": "yt-user-1", "platform": "youtube"}
        older = issue_next_and_publish(
            self.site, {**winner, "eventId": "youtube:award-older"}, expected_remote=str(self.remote)
        )
        newer = issue_next_and_publish(
            self.site, {**winner, "eventId": "youtube:award-newer"}, expected_remote=str(self.remote)
        )
        self.assertNotEqual(older["assignment"]["assetId"], newer["assignment"]["assetId"])
        self.assertEqual(list_available_artwork(self.site), [])

        removal = {
            **winner,
            "actorLogin": "kazvt",
            "eventId": "youtube:remove-newest",
        }
        result = unassign_latest_and_publish(self.site, removal, expected_remote=str(self.remote))
        self.assertEqual(result["revokedCount"], 1)
        self.assertEqual(result["revoked"][0]["linkId"], newer["assignment"]["linkId"])
        self.assertEqual(
            json.loads((self.reward_dir / "pool.json").read_text(encoding="utf-8")),
            {"version": 1, "remaining": 1, "total": 2},
        )
        registry = json.loads((self.reward_dir / "assignments.json").read_text(encoding="utf-8"))
        self.assertEqual([item["linkId"] for item in registry["assignments"]], [older["assignment"]["linkId"]])
        self.assertEqual([item["linkId"] for item in registry["revokedAssignments"]], [newer["assignment"]["linkId"]])
        self.assertEqual(len(list_available_artwork(self.site)), 1)

        replay = unassign_latest_and_publish(self.site, removal, expected_remote=str(self.remote))
        self.assertTrue(replay["replayed"])
        self.assertEqual(replay["revokedCount"], 1)
        with self.assertRaisesRegex(RewardIssueError, "original chat event cannot issue it again"):
            issue_next_and_publish(
                self.site, {**winner, "eventId": "youtube:award-newer"}, expected_remote=str(self.remote)
            )

        replacement = issue_next_and_publish(
            self.site,
            {"username": "AnotherViewer", "userId": "yt-user-2", "platform": "youtube", "eventId": "youtube:replacement"},
            expected_remote=str(self.remote),
        )
        self.assertEqual(replacement["assignment"]["assetId"], newer["assignment"]["assetId"])
        self.assertEqual(len(list_available_artwork(self.site)), 0)
        replay_after_reissue = unassign_latest_and_publish(
            self.site, removal, expected_remote=str(self.remote)
        )
        self.assertTrue(replay_after_reissue["replayed"])
        current_registry = json.loads((self.reward_dir / "assignments.json").read_text(encoding="utf-8"))
        self.assertEqual(
            {item["linkId"] for item in current_registry["assignments"]},
            {older["assignment"]["linkId"], replacement["assignment"]["linkId"]},
        )

    def test_clear_user_is_all_active_awards_idempotent_and_platform_scoped(self) -> None:
        twitch = {"username": "same-handle", "userId": "shared-id", "platform": "twitch"}
        kick = {"username": "same-handle", "userId": "shared-id", "platform": "kick"}
        twitch_award = issue_next_and_publish(
            self.site, {**twitch, "eventId": "twitch:award"}, expected_remote=str(self.remote)
        )
        kick_award = issue_next_and_publish(
            self.site, {**kick, "eventId": "kick:award"}, expected_remote=str(self.remote)
        )
        self.assertNotEqual(twitch_award["assignment"]["assetId"], kick_award["assignment"]["assetId"])

        clear_request = {
            **twitch,
            "actorLogin": "chimpwurldos",
            "eventId": "twitch:clear-all",
        }
        cleared = clear_user_rewards_and_publish(self.site, clear_request, expected_remote=str(self.remote))
        self.assertEqual(cleared["revokedCount"], 1)
        self.assertEqual(
            json.loads((self.reward_dir / "pool.json").read_text(encoding="utf-8")),
            {"version": 1, "remaining": 1, "total": 2},
        )
        registry = json.loads((self.reward_dir / "assignments.json").read_text(encoding="utf-8"))
        self.assertEqual([item["linkId"] for item in registry["assignments"]], [kick_award["assignment"]["linkId"]])
        self.assertEqual(len(list_available_artwork(self.site)), 1)

        replay = clear_user_rewards_and_publish(self.site, clear_request, expected_remote=str(self.remote))
        self.assertTrue(replay["replayed"])
        self.assertEqual(replay["revokedCount"], 1)

    def test_empty_clear_is_audited_and_replay_does_not_clear_later_awards(self) -> None:
        owner = {"username": "Viewer", "userId": "viewer-1", "platform": "kick"}
        command = {**owner, "actorLogin": "kazvt", "eventId": "kick:clear-before-award"}
        empty = clear_user_rewards_and_publish(self.site, command, expected_remote=str(self.remote))
        self.assertEqual(empty["revokedCount"], 0)
        later = issue_next_and_publish(
            self.site, {**owner, "eventId": "kick:later-award"}, expected_remote=str(self.remote)
        )
        replay = clear_user_rewards_and_publish(self.site, command, expected_remote=str(self.remote))
        self.assertTrue(replay["replayed"])
        registry = json.loads((self.reward_dir / "assignments.json").read_text(encoding="utf-8"))
        self.assertEqual([item["linkId"] for item in registry["assignments"]], [later["assignment"]["linkId"]])


if __name__ == "__main__":
    unittest.main()
