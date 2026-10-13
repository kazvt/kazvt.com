import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTwoRowAwardPreview,
  normalizeAwardUsername,
  otherAwardsFor,
  validateAndSortAssignments
} from "./assignment-registry.mjs";

const assetIds = ["a", "b"].map(character => character.repeat(64));

function makeCatalog() {
  const files = ["gift-current.png", "older-gift-current.png"];
  const assets = Object.fromEntries(assetIds.map((assetId, index) => [files[index], {
    assetId,
    sha256: assetId,
    width: 24,
    height: 24,
    tier: "common"
  }]));
  const assetsById = Object.fromEntries(assetIds.map((assetId, index) => [assetId, {
    filename: files[index],
    width: 24,
    height: 24,
    tier: "common"
  }]));
  return {
    tierWeights: [{ id: "common", label: "Frequent", basisPoints: 10000 }],
    assets,
    assetsById
  };
}

test("award usernames normalize consistently for matching", () => {
  assert.equal(normalizeAwardUsername("  KAZVT "), "kazvt");
  assert.equal(normalizeAwardUsername("Ｋａｚｖｔ"), "kazvt");
  assert.equal(normalizeAwardUsername(null), "");
});

test("other-awards collection excludes the award currently being viewed", () => {
  const assignments = [
    { username: " KAZVT ", assetId: assetIds[0], filename: "current.png" },
    { username: "kazvt", assetId: assetIds[1], filename: "other.png" },
    { username: "someone-else", assetId: "c".repeat(64), filename: "unrelated.png" }
  ];

  assert.deepEqual(otherAwardsFor(assignments, "kazvt", assetIds[0]), [assignments[1]]);
  assert.deepEqual(otherAwardsFor([assignments[0]], "Ｋａｚｖｔ", assetIds[0]), []);
  assert.deepEqual(otherAwardsFor(assignments, "", assetIds[0]), []);
});

test("assignments sort newest first and renamed artwork resolves by content ID", () => {
  const assignments = validateAndSortAssignments({ version: 1, assignments: [
    {
      assetId: assetIds[1], filename: "old-older-gift.png", username: "Kazvt",
      issuedAt: "2025-04-01T00:00:00Z"
    },
    {
      assetId: assetIds[0], filename: "old-gift-name.png", username: " KAZVT ",
      issuedAt: "2026-09-01T00:00:00Z"
    }
  ] }, makeCatalog());

  assert.deepEqual(assignments.map(record => record.issuedAt), [
    "2026-09-01T00:00:00Z",
    "2025-04-01T00:00:00Z"
  ]);
  assert.deepEqual(assignments.map(record => record.filename), [
    "gift-current.png",
    "older-gift-current.png"
  ]);
});

test("invalid and duplicated award records are rejected", () => {
  const valid = {
    assetId: assetIds[0], filename: "gift.png", username: "kazvt",
    issuedAt: "2026-09-01T00:00:00Z"
  };
  assert.throws(() => validateAndSortAssignments({ version: 1, assignments: [
    valid, { ...valid, filename: "duplicate.png" }
  ] }, makeCatalog()), /repeats artwork/);
  assert.throws(() => validateAndSortAssignments({ version: 1, assignments: [
    { ...valid, filename: "../gift.png" }
  ] }, makeCatalog()), /Assignment record 1 is invalid/);
});

test("two-row preview reserves its final slot for the overflow link", () => {
  const assignments = Array.from({ length: 9 }, (_, index) => ({ filename: `gift-${index}.png` }));
  const preview = buildTwoRowAwardPreview(assignments, 4);

  assert.deepEqual(preview.visible, assignments.slice(0, 7));
  assert.equal(preview.overflowCount, 2);
  assert.equal(preview.overflowLabel, "+2");
});

test("a collection that exactly fills two rows does not show a false overflow tile", () => {
  const assignments = Array.from({ length: 8 }, (_, index) => ({ filename: `gift-${index}.png` }));
  const preview = buildTwoRowAwardPreview(assignments, 4);

  assert.deepEqual(preview.visible, assignments);
  assert.equal(preview.overflowCount, 0);
  assert.equal(preview.overflowLabel, "");
});

test("overflow label is capped at 99 while its real count stays available", () => {
  const assignments = Array.from({ length: 110 }, (_, index) => ({ filename: `gift-${index}.png` }));
  const preview = buildTwoRowAwardPreview(assignments, 4);

  assert.equal(preview.visible.length, 7);
  assert.equal(preview.overflowCount, 103);
  assert.equal(preview.overflowLabel, "+99");
});

test("small viewports still fit within two rows", () => {
  const assignments = Array.from({ length: 20 }, (_, index) => index);
  const preview = buildTwoRowAwardPreview(assignments, 2);

  assert.deepEqual(preview.visible, [0, 1, 2]);
  assert.equal(preview.overflowLabel, "+17");
});
