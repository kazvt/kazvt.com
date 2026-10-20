import assert from "node:assert/strict";
import test from "node:test";

import { REWARD_DECAL_POOL } from "../decal-pool.mjs";
import {
  createGalleryDecalSeed,
  GALLERY_DECAL_COUNT,
  selectGalleryEdgeDecals
} from "./gallery-decals.mjs";

test("gallery decal scatter uses a spaced set of unique pool entries on both panel sides", () => {
  const first = selectGalleryEdgeDecals(914, 1160, 0x12345678);
  const repeated = selectGalleryEdgeDecals(914, 1160, 0x12345678);

  assert.equal(GALLERY_DECAL_COUNT, 16);
  assert.equal(first.length, GALLERY_DECAL_COUNT);
  assert.deepEqual(first, repeated);
  assert.equal(new Set(first.map(({ item }) => item.src)).size, first.length);
  assert.equal(first.filter(({ position }) => position.side === "left").length, 8);
  assert.equal(first.filter(({ position }) => position.side === "right").length, 8);
  assert.ok(first.every(({ item }) => REWARD_DECAL_POOL.includes(item)));

  for (const side of ["left", "right"]) {
    const sideDecals = first
      .filter(({ position }) => position.side === side)
      .sort((a, b) => a.position.y - b.position.y);
    const minimumGap = Math.min(...sideDecals.slice(1).map((decal, index) =>
      decal.position.y - sideDecals[index].position.y
    ));
    assert.ok(minimumGap >= sideDecals[0].position.size * 1.5);
  }
});

test("gallery decal selection changes for a new page-load seed", () => {
  assert.notDeepEqual(
    selectGalleryEdgeDecals(914, 1160, 0x12345678).map(({ item }) => item.src),
    selectGalleryEdgeDecals(914, 1160, 0x87654321).map(({ item }) => item.src)
  );
});

test("restricted pool GIFs only appear on their assigned side", () => {
  const sideRestrictions = new Map([
    ["AJ3PGGLROVFZ4RADSQHDTT6ILHCMIGVD_repaired.gif", "left"],
    ["FZOIT4NKHYKHZELQATMJIGYUJM3VUZ45.gif", "right"],
    ["S4PFGWRLGB34WVSA3KRJ6US45232D3EU.gif", "left"],
    ["WLDLDJVKFZKRH5VLQSGZM4EPB7TN6MEC.gif", "right"],
    ["CWKDK64M4KFOKNEK5244P52V57DJGDPL.gif", "left"],
    ["FAY72EKBPY2XQ7TG6DXLZASSTYAT3HR6.gif", "right"]
  ]);

  for (let seed = 1; seed <= 512; seed += 1) {
    for (const { item, position } of selectGalleryEdgeDecals(914, 1160, seed)) {
      const filename = item.src.split("/").at(-1);
      if (sideRestrictions.has(filename)) {
        assert.equal(position.side, sideRestrictions.get(filename), filename);
      }
    }
  }
});

test("gallery decal positions stay within the panel height and random seed generation has a fallback", () => {
  const entries = selectGalleryEdgeDecals(914, 1160, 99);
  for (const { position } of entries) {
    assert.ok(position.y >= position.size / 2);
    assert.ok(position.y <= 1160 - position.size / 2);
    assert.ok(position.x === 0 || position.x === 914);
  }

  assert.equal(createGalleryDecalSeed({ getRandomValues: values => { values[0] = 77; } }), 77);
  assert.equal(createGalleryDecalSeed({ getRandomValues: () => { throw new Error("unsupported"); } }) > 0, true);
});
