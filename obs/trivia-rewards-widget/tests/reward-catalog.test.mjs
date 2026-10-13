import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRewardCatalogs,
  TIER_ALGORITHM,
  TIER_BUCKETS,
  tierBucketForSha256,
  tierForSha256
} from "../generate-reward-catalog.mjs";

function digest(prefix) {
  return `${prefix}${"0".repeat(64 - prefix.length)}`;
}

test("SHA-256 buckets map deterministically to the eight ordered reward tiers", () => {
  assert.equal(tierBucketForSha256(digest("00000000")), 0);
  assert.equal(tierForSha256(digest("00000000")), "common");
  assert.equal(tierForSha256(digest("60000000")), "uncommon");
  assert.equal(tierForSha256(digest("90000000")), "rare");
  assert.equal(tierForSha256(digest("b0000000")), "epic");
  assert.equal(tierForSha256(digest("d0000000")), "legendary");
  assert.equal(tierForSha256(digest("e8000000")), "mythic");
  assert.equal(tierForSha256(digest("f0000000")), "divine");
  assert.equal(tierForSha256(digest("fa000000")), "splus");
  assert.equal(tierBucketForSha256(digest("ffffffff")), 9999);
  assert.equal(tierForSha256(digest("ffffffff")), "splus");
});

test("identical asset bytes keep their tier, regardless of filename or catalog order", () => {
  const contentHash = "1f4d7a29" + "b".repeat(56);
  assert.equal(tierForSha256(contentHash), tierForSha256(contentHash));
  assert.equal(tierForSha256(contentHash), "common");
});

test("tier assignment rejects malformed digests", () => {
  assert.throws(() => tierForSha256("not-a-hash"), /SHA-256/);
  assert.throws(() => tierForSha256("g".repeat(64)), /SHA-256/);
});

test("generated catalogs cover every valid PNG and keep matching deterministic tier metadata", async () => {
  const { manifest, widgetCatalog } = await buildRewardCatalogs();
  assert.equal(manifest.version, 3);
  assert.equal(manifest.tierAlgorithm, TIER_ALGORITHM);
  assert.equal(manifest.tierWeights.length, 8);
  assert.deepEqual(manifest.tierWeights.map(({ id, label }) => ({ id, label })),
    TIER_BUCKETS.map(({ id, label }) => ({ id, label })));
  assert.ok(manifest.files.length > 0);
  assert.equal(widgetCatalog.version, 2);
  assert.deepEqual(widgetCatalog.files, manifest.files);
  assert.equal(Object.keys(manifest.assets).length, manifest.files.length);
  assert.equal(Object.keys(widgetCatalog.assets).length, manifest.files.length);
  assert.equal(manifest.tierWeights.reduce((sum, tier) => sum + tier.basisPoints, 0), 10000);

  for (const file of manifest.files) {
    const metadata = manifest.assets[file];
    assert.match(metadata.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(widgetCatalog.assets[file], { sha256: metadata.sha256 });
    assert.equal(metadata.tier, tierForSha256(metadata.sha256), file);
  }
});
