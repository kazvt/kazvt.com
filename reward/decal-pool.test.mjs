import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { REWARD_DECAL_COUNT, REWARD_DECAL_POOL, selectRewardEdgeDecals } from "./decal-pool.mjs";

const ASSET_HASH = "f848b442a199edfda84d6a1a5697a5a017224be42b53798b79ffb2d6f1eb4921";
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the edge pool includes the existing decals and every added GIF exactly once", () => {
  const sources = REWARD_DECAL_POOL.map(item => item.src);
  assert.equal(REWARD_DECAL_POOL.length, 43);
  assert.equal(new Set(sources).size, sources.length);
  assert.ok(sources.includes("/reward/retro/decal-pool/dancey_bgless.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/672ZLW3ZRJMOYJ4OFMF4VOTN45WFA5VL.gif"));
});

test("every pool entry resolves to a local GIF file", async () => {
  for (const item of REWARD_DECAL_POOL) {
    const filePath = path.resolve(REPOSITORY_ROOT, `.${item.src}`);
    const contents = await readFile(filePath);
    assert.ok(contents.subarray(0, 6).toString("ascii").startsWith("GIF8"), item.src);
  }
});

test("each image hash deterministically chooses eight unique decals and balanced side placements", () => {
  const first = selectRewardEdgeDecals(ASSET_HASH, 470, 520);
  const repeated = selectRewardEdgeDecals(ASSET_HASH, 470, 520);

  assert.equal(first.length, REWARD_DECAL_COUNT);
  assert.deepEqual(first, repeated);
  assert.equal(new Set(first.map(entry => entry.item.src)).size, REWARD_DECAL_COUNT);
  assert.equal(first.filter(entry => entry.position.side === "left").length, 4);
  assert.equal(first.filter(entry => entry.position.side === "right").length, 4);
  for (const { position } of first) {
    assert.ok(position.x === 0 || position.x === 470);
    assert.ok(position.y >= position.size / 2);
    assert.ok(position.y <= 520 - position.size / 2);
  }
});

test("directional GIFs only appear on their intended edge", () => {
  let sawLeftArrow = false;
  let sawRightArrow = false;

  for (let index = 1; index <= 256; index += 1) {
    const assetHash = index.toString(16).padStart(64, "0");
    for (const { item, position } of selectRewardEdgeDecals(assetHash, 470, 520)) {
      if (item.src.endsWith("AJ3PGGLROVFZ4RADSQHDTT6ILHCMIGVD.gif")) {
        assert.equal(position.side, "left");
        sawLeftArrow = true;
      }
      if (item.src.endsWith("FZOIT4NKHYKHZELQATMJIGYUJM3VUZ45.gif")) {
        assert.equal(position.side, "right");
        sawRightArrow = true;
      }
    }
  }

  assert.ok(sawLeftArrow);
  assert.ok(sawRightArrow);
});

test("invalid artwork hashes and unusable dimensions produce no edge decals", () => {
  assert.deepEqual(selectRewardEdgeDecals("not-a-content-hash", 470, 520), []);
  assert.deepEqual(selectRewardEdgeDecals(ASSET_HASH, 0, 520), []);
  assert.deepEqual(selectRewardEdgeDecals(ASSET_HASH, 470, 0), []);
});
