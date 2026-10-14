import assert from "node:assert/strict";
import test from "node:test";
import { assignReward } from "./award-registry.mjs";

const ART_AVAILABLE = "a".repeat(64);
const ART_ALREADY_AWARDED = "b".repeat(64);
const LINK_ID = "abcdefghijklmnopqrstuv";
const manifest = {
  version: 4,
  assetIdAlgorithm: "sha256-png-bytes-v1",
  files: ["fresh.png", "owned.png"],
  assets: {
    "fresh.png": { assetId: ART_AVAILABLE, sha256: ART_AVAILABLE, width: 80, height: 50, tier: "rare" },
    "owned.png": { assetId: ART_ALREADY_AWARDED, sha256: ART_ALREADY_AWARDED, width: 50, height: 80, tier: "epic" }
  },
  assetsById: {
    [ART_AVAILABLE]: { filename: "fresh.png", width: 80, height: 50, tier: "rare" },
    [ART_ALREADY_AWARDED]: { filename: "owned.png", width: 50, height: 80, tier: "epic" }
  }
};
const registry = {
  version: 1,
  assignments: [{
    assetId: ART_ALREADY_AWARDED,
    assetSha256: ART_ALREADY_AWARDED,
    filename: "owned.png",
    username: "kazvt",
    issuedAt: "2026-10-13T00:00:00.000Z",
    platform: "manual",
    linkId: "e2b8a0b2-7dd8-4d10-802f-d308ec33ffe7"
  }]
};
const input = { username: "Winner", assetId: ART_AVAILABLE, eventId: "match-42-winner-1", platform: "stream-game" };

test("assigns a catalog artwork exactly once and creates an opaque short link", () => {
  const result = assignReward({ manifest, registry, input, issuedAt: "2026-10-14T10:00:00.000Z", makeLinkId: () => LINK_ID });
  assert.equal(result.replayed, false);
  assert.equal(result.assignment.filename, "fresh.png");
  assert.equal(result.assignment.linkId, LINK_ID);
  assert.equal(result.assignment.eventId, input.eventId);
  assert.equal(result.registry.assignments.length, 2);
});

test("retries with the same event and award return the existing record without duplicating it", () => {
  const first = assignReward({ manifest, registry, input, makeLinkId: () => LINK_ID });
  const retry = assignReward({ manifest, registry: first.registry, input, makeLinkId: () => "zyxwvutsrqponmlkjihgfedc" });
  assert.equal(retry.replayed, true);
  assert.equal(retry.assignment.linkId, LINK_ID);
  assert.equal(retry.registry.assignments.length, 2);
});

test("rejects reused events with different winners or artwork and already-awarded artwork", () => {
  const first = assignReward({ manifest, registry, input, makeLinkId: () => LINK_ID });
  assert.throws(() => assignReward({
    manifest,
    registry: first.registry,
    input: { ...input, username: "someone else" },
    makeLinkId: () => "zyxwvutsrqponmlkjihgfedc"
  }), /eventId is already assigned/);
  assert.throws(() => assignReward({
    manifest,
    registry,
    input: { ...input, assetId: ART_ALREADY_AWARDED },
    makeLinkId: () => "zyxwvutsrqponmlkjihgfedc"
  }), /already been awarded/);
});

test("rejects unknown artwork, invalid input and non-unique link IDs", () => {
  assert.throws(() => assignReward({ manifest, registry, input: { ...input, assetId: "f".repeat(64) } }), /not present/);
  assert.throws(() => assignReward({ manifest, registry, input: { ...input, username: "" } }), /username/);
  assert.throws(() => assignReward({ manifest, registry, input: { ...input, eventId: "" } }), /eventId/);
  assert.throws(() => assignReward({ manifest, registry, input, makeLinkId: () => "bad" }), /unique reward link/);
});
