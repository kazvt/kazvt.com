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
  assert.equal(REWARD_DECAL_POOL.length, 66);
  assert.equal(new Set(sources).size, sources.length);
  assert.ok(!sources.includes("/reward/retro/decal-pool/532EV253ZQEW44WBJXAA4O7ENQPQ5UBC.gif"));
  assert.ok(!sources.includes("/reward/retro/decal-pool/4HIPRF5OTTQDQNUUF2FJGODOYYYYHR5K.gif"));
  assert.ok(!sources.includes("/reward/retro/decal-pool/3IXSSZGOSDMVNZ64BMYP4S2EZQLSTVTW.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/dancey_bgless.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/672ZLW3ZRJMOYJ4OFMF4VOTN45WFA5VL.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/S4PFGWRLGB34WVSA3KRJ6US45232D3EU.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/WLDLDJVKFZKRH5VLQSGZM4EPB7TN6MEC.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/awaw.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/WNYOPWW72P424UFMBK7YTD76GSFCYYIL.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/CWKDK64M4KFOKNEK5244P52V57DJGDPL.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/DFKBEM3QMD4SYQEUYGRXVNNZLPUJX5AO.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/AMLVTNU2URJXNELKRPSKE7NTY5VTTA4E.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/FAY72EKBPY2XQ7TG6DXLZASSTYAT3HR6.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/ROSN2WTVW2U2AUQKM5JYHT2JAHTA7S22.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/PIUMSHKA5VQRPNYL5YA523BW7BVVF7IE.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/QP3WU3GXFXMXCHPXCFWL3HZ6MAPTP7PC.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/2EYNBD774YWU6RPB5T6ZDUHI4QV5TSHX_bgless.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/57BLD2VKXE35ZAXFUQ7MUJS3KEMRWYQF.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/JZSVZSUQGID7GWMAUNLS45CBCRBMRRIV.gif"));
  assert.ok(sources.includes("/reward/retro/decal-pool/VUOP5UKB566QCBHE55NGQIZMLZMRI5OV.gif"));
});

test("the five supplied celebration sprites are eligible for either side", () => {
  const suppliedFiles = [
    "QP3WU3GXFXMXCHPXCFWL3HZ6MAPTP7PC.gif",
    "2EYNBD774YWU6RPB5T6ZDUHI4QV5TSHX_bgless.gif",
    "57BLD2VKXE35ZAXFUQ7MUJS3KEMRWYQF.gif",
    "JZSVZSUQGID7GWMAUNLS45CBCRBMRRIV.gif",
    "VUOP5UKB566QCBHE55NGQIZMLZMRI5OV.gif"
  ];
  for (const filename of suppliedFiles) {
    const item = REWARD_DECAL_POOL.find(entry => entry.src.endsWith(`/${filename}`));
    assert.ok(item, `${filename} is present in the reward decal pool`);
    assert.equal(item.side, undefined, `${filename} is not restricted to one edge`);
  }
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

test("side-restricted GIFs only appear on their intended edge", () => {
  const sideRestrictions = new Map([
    ["AJ3PGGLROVFZ4RADSQHDTT6ILHCMIGVD_repaired.gif", "left"],
    ["FZOIT4NKHYKHZELQATMJIGYUJM3VUZ45.gif", "right"],
    ["S4PFGWRLGB34WVSA3KRJ6US45232D3EU.gif", "left"],
    ["WLDLDJVKFZKRH5VLQSGZM4EPB7TN6MEC.gif", "right"],
    ["CWKDK64M4KFOKNEK5244P52V57DJGDPL.gif", "left"],
    ["FAY72EKBPY2XQ7TG6DXLZASSTYAT3HR6.gif", "right"]
  ]);
  const seen = new Set();

  for (let index = 1; index <= 256; index += 1) {
    const assetHash = index.toString(16).padStart(64, "0");
    for (const { item, position } of selectRewardEdgeDecals(assetHash, 470, 520)) {
      const filename = item.src.split("/").at(-1);
      if (!sideRestrictions.has(filename)) continue;
      assert.equal(position.side, sideRestrictions.get(filename), filename);
      seen.add(filename);
    }
  }

  assert.deepEqual([...seen].sort(), [...sideRestrictions.keys()].sort());
});

test("invalid artwork hashes and unusable dimensions produce no edge decals", () => {
  assert.deepEqual(selectRewardEdgeDecals("not-a-content-hash", 470, 520), []);
  assert.deepEqual(selectRewardEdgeDecals(ASSET_HASH, 0, 520), []);
  assert.deepEqual(selectRewardEdgeDecals(ASSET_HASH, 470, 0), []);
});
