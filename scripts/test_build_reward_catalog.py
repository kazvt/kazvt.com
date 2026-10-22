from __future__ import annotations

import hashlib
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from scripts.build_reward_catalog import CatalogError, build_catalog, normalize_tier_weights


WEIGHTS = [
    {"id": "common", "label": "Frequent", "basisPoints": 3000},
    {"id": "uncommon", "label": "Uncommon", "basisPoints": 2000},
    {"id": "rare", "label": "Rare", "basisPoints": 1500},
    {"id": "epic", "label": "Epic", "basisPoints": 1200},
    {"id": "legendary", "label": "Legendary", "basisPoints": 900},
    {"id": "mythic", "label": "Mythic", "basisPoints": 650},
    {"id": "divine", "label": "Divine", "basisPoints": 450},
    {"id": "splus", "label": "Good Shit", "basisPoints": 300},
]


class RewardCatalogBuilderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def write_png(self, name: str, color: tuple[int, int, int, int]) -> bytes:
        path = self.directory / name
        Image.new("RGBA", (7, 5), color).save(path, format="PNG")
        return path.read_bytes()

    def write_gif(self, name: str) -> bytes:
        first = Image.new("P", (9, 4), 1)
        second = Image.new("P", (9, 4), 2)
        path = self.directory / name
        first.save(path, format="GIF", save_all=True, append_images=[second], duration=90, loop=0)
        return path.read_bytes()

    def test_builds_hash_dimensions_tier_and_keeps_gif_bytes(self) -> None:
        png_bytes = self.write_png("tiny.png", (200, 0, 0, 255))
        gif_bytes = self.write_gif("tiny.gif")
        catalog = build_catalog(self.directory, {"tierWeights": WEIGHTS, "filenameHistory": {"old.gif": "a" * 64}})

        self.assertEqual(catalog["files"], ["tiny.gif", "tiny.png"])
        self.assertEqual(catalog["assets"]["tiny.png"]["assetId"], hashlib.sha256(png_bytes).hexdigest())
        self.assertEqual((catalog["assets"]["tiny.png"]["width"], catalog["assets"]["tiny.png"]["height"]), (7, 5))
        self.assertEqual((catalog["assets"]["tiny.gif"]["width"], catalog["assets"]["tiny.gif"]["height"]), (9, 4))
        self.assertEqual((self.directory / "tiny.gif").read_bytes(), gif_bytes)
        self.assertEqual(catalog["filenameHistory"]["old.gif"], "a" * 64)
        self.assertEqual(catalog["filenameHistory"]["tiny.png"], hashlib.sha256(png_bytes).hexdigest())

    def test_rejects_duplicate_bytes_and_extension_mismatch(self) -> None:
        self.write_png("one.png", (0, 200, 0, 255))
        (self.directory / "two.png").write_bytes((self.directory / "one.png").read_bytes())
        with self.assertRaisesRegex(CatalogError, "identical bytes"):
            build_catalog(self.directory, {"tierWeights": WEIGHTS})

        (self.directory / "two.png").unlink()
        (self.directory / "wrong.gif").write_bytes((self.directory / "one.png").read_bytes())
        with self.assertRaisesRegex(CatalogError, "extension does not match"):
            build_catalog(self.directory, {"tierWeights": WEIGHTS})

    def test_tier_weights_are_ordered_and_sum_to_ten_thousand(self) -> None:
        wrong_order = list(reversed(WEIGHTS))
        with self.assertRaises(CatalogError):
            normalize_tier_weights(wrong_order)
        wrong_sum = [dict(entry) for entry in WEIGHTS]
        wrong_sum[0]["basisPoints"] -= 1
        with self.assertRaisesRegex(CatalogError, "add up to 10,000"):
            normalize_tier_weights(wrong_sum)


if __name__ == "__main__":
    unittest.main()
