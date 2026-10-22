"""Safety tests for reward-editor operations against temporary site fixtures."""

from __future__ import annotations

import hashlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "reward-editor-local"))
import server  # noqa: E402
from build_reward_catalog import build_catalog  # noqa: E402


class LocalRewardEditorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="kazvt-reward-editor-")
        self.site = Path(self.temp.name)
        self.previous_root = server.ROOT
        server.ROOT = self.site

        (self.site / ".git").mkdir()
        artwork_dir = self.site / "zzz_assets" / "rewards"
        artwork_dir.mkdir(parents=True)
        for index, color in enumerate(((220, 30, 40), (20, 140, 80), (30, 70, 220)), 1):
            buffer = io.BytesIO()
            Image.new("RGB", (3 + index, 5), color).save(buffer, format="PNG")
            (artwork_dir / f"reward-{index}.png").write_bytes(buffer.getvalue())

        weights = [
            {"id": tier_id, "label": tier_id.title(), "basisPoints": 1250}
            for tier_id in server.local_issuer.TIER_IDS
        ]
        catalog = build_catalog(artwork_dir, {"tierWeights": weights})
        self.write_json("zzz_assets/rewards/manifest.json", catalog)
        self.write_json("zzz_assets/rewards/assignments.json", {"version": 1, "assignments": []})
        self.write_json("zzz_assets/rewards/pool.json", {"version": 1, "remaining": 3, "total": 3})

    def tearDown(self) -> None:
        server.ROOT = self.previous_root
        self.temp.cleanup()

    def write_json(self, relative: str, value: dict) -> None:
        path = self.site / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")

    def read_json(self, relative: str) -> dict:
        return json.loads((self.site / relative).read_text(encoding="utf-8"))

    def create_assignment(self, filename: str = "reward-1.png") -> dict:
        catalog = self.read_json("zzz_assets/rewards/manifest.json")
        asset_id = catalog["assets"][filename]["assetId"]
        registry_path = self.site / server.ASSIGNMENTS_REL
        return server._assignment_mutation({
            "action": "create",
            "expectedAssignments": server._file_hash(registry_path),
            "assignment": {
                "assetId": asset_id,
                "username": "CaseSensitiveUser",
                "platform": "twitch",
                "reason": "won tic tac toe",
                "issuedAt": "2026-10-22T12:00:00.000Z",
            },
        })

    def test_assignment_create_archive_restore_keep_pool_and_link_consistent(self) -> None:
        created = self.create_assignment()
        registry = self.read_json(server.ASSIGNMENTS_REL)
        record = registry["assignments"][0]
        self.assertEqual(record["username"], "CaseSensitiveUser")
        self.assertEqual(record["reason"], "won tic tac toe")
        self.assertEqual(created["pool"]["remaining"], 2)

        archived = server._assignment_mutation({
            "action": "archive",
            "linkId": record["linkId"],
            "expectedAssignments": server._file_hash(self.site / server.ASSIGNMENTS_REL),
        })
        registry = self.read_json(server.ASSIGNMENTS_REL)
        self.assertEqual(registry["assignments"], [])
        self.assertEqual(registry["editorArchivedAssignments"][0]["linkId"], record["linkId"])
        self.assertEqual(archived["pool"]["remaining"], 3)

        restored = server._assignment_mutation({
            "action": "restore",
            "linkId": record["linkId"],
            "expectedAssignments": server._file_hash(self.site / server.ASSIGNMENTS_REL),
        })
        registry = self.read_json(server.ASSIGNMENTS_REL)
        self.assertEqual(registry["assignments"][0]["linkId"], record["linkId"])
        self.assertEqual(registry["editorArchivedAssignments"], [])
        self.assertEqual(restored["pool"]["remaining"], 2)

    def test_private_reservation_reduces_pool_and_follows_artwork_rename(self) -> None:
        reservation_path = self.site / server.RESERVATIONS_REL
        text = "CaseUser, case-user-0000 => C:/old site/zzz_assets/rewards/reward-3.png\n"
        result = server._save_reservations({
            "text": text,
            "expectedReservations": server._file_hash(reservation_path),
        })
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["pool"]["total"], 2)
        self.assertEqual(result["pool"]["remaining"], 2)

        catalog = self.read_json(server.CATALOG_REL)
        filename = "reward-3.png"
        old_path = self.site / "zzz_assets" / "rewards" / filename
        result = server._rename_artwork({
            "filename": filename,
            "newFilename": "new reserved reward.png",
            "expectedCatalog": server._file_hash(self.site / server.CATALOG_REL),
            "expectedFile": server._file_hash(old_path),
        })
        self.assertEqual(result["filename"], "new reserved reward.png")
        self.assertFalse(old_path.exists())
        self.assertTrue((old_path.parent / result["filename"]).is_file())
        self.assertIn("new reserved reward.png", reservation_path.read_text(encoding="utf-8"))
        self.assertEqual(self.read_json(server.CATALOG_REL)["assets"][result["filename"]]["assetId"], catalog["assets"][filename]["assetId"])
        self.assertEqual(server._load_core()[3]["entries"][0]["filename"], result["filename"])

    def test_tier_weights_rebuild_hash_tiers_and_reject_stale_edits(self) -> None:
        catalog = self.read_json(server.CATALOG_REL)
        weights = [
            {"id": tier["id"], "label": f"Custom {tier['id']}", "basisPoints": 1250}
            for tier in catalog["tierWeights"]
        ]
        result = server._save_tier_weights({
            "tierWeights": weights,
            "expectedCatalog": server._file_hash(self.site / server.CATALOG_REL),
        })
        self.assertEqual(result["pool"]["total"], 3)
        rebuilt = self.read_json(server.CATALOG_REL)
        self.assertEqual(rebuilt["tierWeights"][0]["label"], "Custom common")
        self.assertEqual(sum(tier["basisPoints"] for tier in rebuilt["tierWeights"]), 10_000)

        with self.assertRaisesRegex(server.ApiError, "changed since"):
            server._save_tier_weights({"tierWeights": weights, "expectedCatalog": "stale"})

    def test_private_paths_and_reservation_rewrite_are_bounded(self) -> None:
        with self.assertRaises(server.ApiError):
            server._safe_relative("../reward/manifest.json")
        with self.assertRaises(server.ApiError):
            server._public_path("/reward/api/reservations.local.txt")
        source = 'alice -> "E:\\site\\zzz_assets\\rewards\\reward-1.png"\n'
        changed = server._rewrite_reservation_targets(source, "reward-1.png", "renamed.png")
        self.assertEqual(changed, 'alice -> "E:\\site\\zzz_assets\\rewards\\renamed.png"\n')


if __name__ == "__main__":
    unittest.main()
