import test from "node:test";
import assert from "node:assert/strict";
import { migrateLegacyComposePlacements, normalizeComposePlacements, snapComposePlacement } from "./compose-placement.mjs";

test("compose placements allow multiple instances of the same item type", () => {
  const items = [{ label: "Star" }, { label: "Moon" }];
  assert.deepEqual(normalizeComposePlacements([
    { itemIndex: 0, x: 12, y: 25 },
    { itemIndex: 0, x: 48, y: 50 },
    { itemIndex: 1, x: 74, y: 20 },
  ], items), [
    { itemIndex: 0, x: 12, y: 25 },
    { itemIndex: 0, x: 48, y: 50 },
    { itemIndex: 1, x: 74, y: 20 },
  ]);
});

test("compose placements discard invalid references and clamp coordinates", () => {
  assert.deepEqual(normalizeComposePlacements([
    { itemIndex: 0, x: -20, y: 120 },
    { itemIndex: 3, x: 50, y: 50 },
    { itemIndex: 1, x: "bad", y: 50 },
    null,
  ], [{ label: "A" }, { label: "B" }]), [{ itemIndex: 0, x: 0, y: 100 }]);
});

test("legacy single-piece positions migrate without treating defaults as placements", () => {
  assert.deepEqual(migrateLegacyComposePlacements([
    { x: 8, y: 8 },
    { x: 30, y: 42 },
    { x: 44, y: 8 },
  ]), [{ itemIndex: 1, x: 30, y: 42 }]);
});

test("compose clicks snap the top-left of a doubled-size sprite to image grid cells", () => {
  const result = snapComposePlacement(101, 77, 880, 240, 16, 32);
  assert.deepEqual(result, { x: 80 / 880 * 100, y: 64 / 240 * 100 });
  assert.deepEqual(snapComposePlacement(0, 0, 880, 240, 16, 32), { x: 0, y: 0 });
});
