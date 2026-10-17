import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRewardAsset } from "../../../reward/asset-resolver.mjs";
import {
  buildRewardCatalogs,
  TIER_ALGORITHM,
  TIER_BUCKETS,
  tierBucketForSha256,
  tierForSha256
} from "../generate-reward-catalog.mjs";

const REWARD_DIRECTORY = resolve(fileURLToPath(new URL("../../../zzz_assets/rewards/", import.meta.url)));

async function currentArtworkBytesForHistoricalName(filename) {
  const catalog = JSON.parse(await readFile(resolve(REWARD_DIRECTORY, "manifest.json"), "utf8"));
  const assetId = catalog.filenameHistory?.[filename];
  const currentFilename = assetId && catalog.assetsById?.[assetId]?.filename;
  assert.ok(currentFilename, `No current artwork resolves historical name ${filename}.`);
  return readFile(resolve(REWARD_DIRECTORY, currentFilename));
}

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

test("generated catalogs cover every valid PNG/GIF and keep matching deterministic tier metadata", async () => {
  const { manifest, widgetCatalog } = await buildRewardCatalogs();
  assert.equal(manifest.version, 4);
  assert.equal(manifest.assetIdAlgorithm, "sha256-image-bytes-v1");
  assert.equal(manifest.tierAlgorithm, TIER_ALGORITHM);
  assert.equal(manifest.tierWeights.length, 8);
  assert.equal(manifest.tierWeights.find(({ id }) => id === "splus")?.label, "Good Shit");
  assert.deepEqual(manifest.tierWeights.map(({ id, label }) => ({ id, label })),
    TIER_BUCKETS.map(({ id, label }) => ({ id, label })));
  assert.ok(manifest.files.length > 0);
  assert.ok(manifest.files.some(file => file.toLowerCase().endsWith(".gif")));
  assert.equal(widgetCatalog.version, 3);
  assert.equal(widgetCatalog.assetIdAlgorithm, manifest.assetIdAlgorithm);
  assert.deepEqual(widgetCatalog.files, manifest.files);
  assert.equal(Object.keys(manifest.assets).length, manifest.files.length);
  assert.equal(Object.keys(widgetCatalog.assets).length, manifest.files.length);
  assert.equal(manifest.tierWeights.reduce((sum, tier) => sum + tier.basisPoints, 0), 10000);

  for (const file of manifest.files) {
    const metadata = manifest.assets[file];
    assert.match(metadata.sha256, /^[a-f0-9]{64}$/);
    assert.equal(metadata.assetId, metadata.sha256);
    assert.ok(metadata.width > 0);
    assert.ok(metadata.height > 0);
    assert.deepEqual(widgetCatalog.assets[file], {
      assetId: metadata.assetId,
      sha256: metadata.sha256,
      width: metadata.width,
      height: metadata.height
    });
    assert.equal(manifest.assetsById[metadata.assetId].filename, file);
    assert.equal(manifest.filenameHistory[file], metadata.assetId);
    assert.equal(metadata.tier, tierForSha256(metadata.sha256), file);
  }
});

test("GIF dimensions and byte identity are added to both catalogs", async () => {
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "reward-gif-catalog-"));
  try {
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
    await writeFile(resolve(temporaryRoot, "reserved.gif"), gif);
    const { manifest, widgetCatalog } = await buildRewardCatalogs({ rewardDir: temporaryRoot });
    const metadata = manifest.assets["reserved.gif"];
    assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 1, height: 1 });
    assert.equal(metadata.assetId, createHash("sha256").update(gif).digest("hex"));
    assert.equal(widgetCatalog.assets["reserved.gif"].assetId, metadata.assetId);
    assert.equal(resolveRewardAsset(manifest, {
      version: 1, username: "Viewer", file: "reserved.gif"
    }).metadata.assetId, metadata.assetId);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("renaming a PNG preserves its content ID and keeps the old filename as a legacy alias", async () => {
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "reward-asset-id-"));
  const originalName = "first award.png";
  const renamedName = "award name can change.png";
  try {
    const pngBytes = await currentArtworkBytesForHistoricalName("1.png");
    await writeFile(resolve(temporaryRoot, originalName), pngBytes);

    const first = await buildRewardCatalogs({ rewardDir: temporaryRoot });
    const originalId = first.manifest.assets[originalName].assetId;
    await writeFile(resolve(temporaryRoot, "manifest.json"), `${JSON.stringify(first.manifest)}\n`);
    await rename(resolve(temporaryRoot, originalName), resolve(temporaryRoot, renamedName));

    const renamed = await buildRewardCatalogs({ rewardDir: temporaryRoot });
    assert.equal(renamed.manifest.assets[renamedName].assetId, originalId);
    assert.equal(renamed.manifest.assetsById[originalId].filename, renamedName);
    assert.equal(renamed.manifest.filenameHistory[originalName], originalId);
    assert.equal(renamed.manifest.filenameHistory[renamedName], originalId);
    assert.equal(renamed.widgetCatalog.filenameHistory[originalName], originalId);
    assert.deepEqual(resolveRewardAsset(renamed.manifest, {
      version: 2, username: "Viewer", assetId: originalId
    }), {
      filename: renamedName,
      metadata: renamed.manifest.assets[renamedName]
    });
    assert.deepEqual(resolveRewardAsset(renamed.manifest, {
      version: 1, username: "Viewer", file: originalName
    }), {
      filename: renamedName,
      metadata: renamed.manifest.assets[renamedName]
    });

    await writeFile(resolve(temporaryRoot, "manifest.json"), `${JSON.stringify(renamed.manifest)}\n`);
    const differentPng = await currentArtworkBytesForHistoricalName("2.png");
    await writeFile(resolve(temporaryRoot, originalName), differentPng);
    const reusedName = await buildRewardCatalogs({ rewardDir: temporaryRoot });
    assert.equal(reusedName.manifest.filenameHistory[originalName], null);
    assert.equal(resolveRewardAsset(reusedName.manifest, {
      version: 1, username: "Viewer", file: originalName
    }), null);
    assert.equal(resolveRewardAsset(reusedName.manifest, {
      version: 2, username: "Viewer", assetId: originalId
    }).filename, renamedName);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
