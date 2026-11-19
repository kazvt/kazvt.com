import test from "node:test";
import assert from "node:assert/strict";
import { DICE_ASSET_CYCLE, DICE_FACE_ORDER, nextDiceAsset } from "./dice-game-state.mjs";

test("face choices cycle through Blank, Erinberry, Faroeberry, and Kazberry", () => {
  assert.deepEqual(DICE_ASSET_CYCLE.map(({ id }) => id), ["blank", "erinberry", "faroeberry", "kazberry"]);
  assert.equal(nextDiceAsset("blank").id, "erinberry");
  assert.equal(nextDiceAsset("erinberry").id, "faroeberry");
  assert.equal(nextDiceAsset("faroeberry").id, "kazberry");
  assert.equal(nextDiceAsset("kazberry").id, "blank");
  assert.equal(nextDiceAsset("unrecognised").id, "blank");
});

test("the six selectable stickers map one-to-one to the six physical die normals", () => {
  assert.deepEqual(DICE_FACE_ORDER.map(({ id }) => id), ["top", "bottom", "front", "back", "left", "right"]);
  assert.equal(new Set(DICE_FACE_ORDER.map(({ normal }) => normal.join(","))).size, 6);
  for (const { normal } of DICE_FACE_ORDER) assert.ok(Math.hypot(...normal) === 1);
});
