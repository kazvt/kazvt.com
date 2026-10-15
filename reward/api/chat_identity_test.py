import json
import tempfile
import unittest
from pathlib import Path

from chat_identity import IdentityLookupError, RewardIdentityCache


class RewardIdentityCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "private" / "identities.json"
        self.cache = RewardIdentityCache(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_at_names_resolve_to_platform_scoped_ids(self):
        self.cache.upsert("twitch", "10001", "Kazvt", "Kazvt")
        self.cache.upsert("kick", "10001", "Other", "Other")
        self.assertEqual(self.cache.resolve("twitch", "@KAZVT")["userId"], "10001")
        self.assertEqual(self.cache.resolve("kick", "other")["platform"], "kick")

    def test_changed_username_replaces_the_old_alias_for_same_stable_id(self):
        self.cache.upsert("youtube", "UC-user-id", "OldHandle", "Old Display")
        self.cache.upsert("youtube", "UC-user-id", "NewHandle", "New Display")
        self.assertEqual(self.cache.resolve("youtube", "@newhandle")["userId"], "UC-user-id")
        with self.assertRaisesRegex(IdentityLookupError, "has not been identified"):
            self.cache.resolve("youtube", "oldhandle")

    def test_ambiguous_display_names_are_rejected(self):
        self.cache.upsert("kick", "1", "first", "Same Name")
        self.cache.upsert("kick", "2", "second", "Same Name")
        with self.assertRaisesRegex(IdentityLookupError, "matches multiple users"):
            self.cache.resolve("kick", "Same Name")

    def test_corrupt_cache_is_not_silently_replaced(self):
        self.path.parent.mkdir(parents=True)
        self.path.write_text(json.dumps({"version": 99, "users": []}), encoding="utf-8")
        with self.assertRaisesRegex(IdentityLookupError, "invalid format"):
            RewardIdentityCache(self.path).upsert("twitch", "7", "person")
        self.assertEqual(json.loads(self.path.read_text(encoding="utf-8"))["version"], 99)


if __name__ == "__main__":
    unittest.main()
