import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTwoRowAwardPreview,
  findAssignmentByLinkId,
  findAssignmentForLegacyPayload,
  isRewardLinkId,
  normalizeAwardUsername,
  normalizeRewardLinkId,
  otherAwardsFor,
  validateAndSortAssignments
} from "./assignment-registry.mjs";

const assetIds = ["a", "b"].map(character => character.repeat(64));
const linkIds = [
  "e2b8a0b2-7dd8-4d10-802f-d308ec33ffe7",
  "aB3_dE5-fG7_hJ9k",
  "A".repeat(22)
];

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

test("legacy UUIDs and compact reward links resolve only to their recorded assignments", () => {
  const registry = validateAndSortAssignments({ version: 1, assignments: [
    {
      assetId: assetIds[0], filename: "gift-current.png", username: "kazvt",
      linkId: linkIds[0].toUpperCase(), issuedAt: "2026-09-01T00:00:00Z"
    },
    {
      assetId: assetIds[1], filename: "older-gift-current.png", username: "Viewer",
      linkId: linkIds[1], issuedAt: "2026-09-02T00:00:00Z"
    }
  ] }, makeCatalog());

  assert.equal(findAssignmentByLinkId(registry, linkIds[0]).username, "kazvt");
  assert.equal(findAssignmentByLinkId(registry, linkIds[1]).username, "Viewer");
  assert.equal(findAssignmentByLinkId(registry, linkIds[1].toLowerCase()), null);
  assert.equal(findAssignmentByLinkId(registry, "d2b8a0b2-7dd8-4d10-802f-d308ec33ffe7"), null);
  assert.equal(isRewardLinkId(linkIds[0]), true);
  assert.equal(isRewardLinkId(linkIds[1]), true);
  assert.equal(isRewardLinkId("00000000-0000-0000-0000-000000000000"), false);
  assert.equal(normalizeRewardLinkId(linkIds[0].toUpperCase()), linkIds[0]);
  assert.equal(normalizeRewardLinkId(linkIds[1]), linkIds[1]);
  assert.equal(isRewardLinkId(linkIds[2]), true);
  assert.equal(normalizeRewardLinkId(linkIds[2]), linkIds[2]);
  assert.equal(findAssignmentForLegacyPayload(registry, "KAZVT", assetIds[0]).username, "kazvt");
  assert.equal(findAssignmentForLegacyPayload(registry, "attacker", assetIds[0]), null);
  assert.equal(findAssignmentForLegacyPayload(registry, "kazvt", "c".repeat(64)), null);
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

test("platform user IDs keep reward collections together across handle changes without merging platforms", () => {
  const assignments = [
    { username: "OldHandle", platform: "twitch", userId: "1001", assetId: assetIds[0] },
    { username: "NewHandle", platform: "twitch", userId: "1001", assetId: assetIds[1] },
    { username: "NewHandle", platform: "kick", userId: "1001", assetId: "c".repeat(64) }
  ];

  assert.deepEqual(
    otherAwardsFor(assignments, "NewHandle", assetIds[0], { platform: "twitch", userId: "1001" }),
    [assignments[1]]
  );
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

test("revoked assignment history is never exposed as an active reward or link", () => {
  const active = {
    assetId: assetIds[0], filename: "gift-current.png", username: "Viewer",
    linkId: linkIds[0], issuedAt: "2026-09-02T00:00:00Z"
  };
  const revoked = {
    assetId: assetIds[1], filename: "older-gift-current.png", username: "Viewer",
    linkId: linkIds[1], issuedAt: "2026-09-01T00:00:00Z",
    revokedAt: "2026-09-03T00:00:00Z", revokedBy: "kazvt"
  };
  const assignments = validateAndSortAssignments({
    version: 1,
    assignments: [active],
    revokedAssignments: [revoked],
    rewardCommandEvents: []
  }, makeCatalog());

  assert.deepEqual(assignments.map(item => item.linkId), [linkIds[0]]);
  assert.equal(findAssignmentByLinkId(assignments, linkIds[1]), null);
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
  assert.throws(() => validateAndSortAssignments({ version: 1, assignments: [
    { ...valid, linkId: linkIds[0] }, { ...valid, assetId: assetIds[1], linkId: linkIds[0] }
  ] }, makeCatalog()), /repeats a reward link ID/);
  assert.throws(() => validateAndSortAssignments({ version: 1, assignments: [
    { ...valid, linkId: "not-a-uuid" }
  ] }, makeCatalog()), /Assignment record 1 is invalid/);
  assert.throws(() => validateAndSortAssignments({ version: 1, assignments: [
    { ...valid, linkId: linkIds[1] },
    { ...valid, assetId: assetIds[1], linkId: linkIds[1] }
  ] }, makeCatalog()), /repeats a reward link ID/);
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
