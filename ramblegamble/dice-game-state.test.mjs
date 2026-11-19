import test from "node:test";
import assert from "node:assert/strict";
import { chooseDiceOutcome, DICE_ASSET_CYCLE, DICE_FACE_ORDER, nextDiceAsset } from "./dice-game-state.mjs";

test("face choices cycle through Blank, Erinberry, Faroeberry, and Kazberry", () => {
  assert.deepEqual(DICE_ASSET_CYCLE.map(({ id }) => id), ["blank", "erinberry", "faroeberry", "kazberry"]);
  assert.equal(nextDiceAsset("blank").id, "erinberry");
  assert.equal(nextDiceAsset("erinberry").id, "faroeberry");
  assert.equal(nextDiceAsset("faroeberry").id, "kazberry");
  assert.equal(nextDiceAsset("kazberry").id, "blank");
  assert.equal(nextDiceAsset("unrecognised").id, "blank");
});

test("a roll chooses an assigned face and correctly bounds the top endpoint", () => {
  const assignments = ["blank", "erinberry", "faroeberry", "kazberry", "blank", "kazberry"];
  assert.deepEqual(chooseDiceOutcome(assignments, () => 0), {
    index: 0, face: DICE_FACE_ORDER[0], asset: "blank",
  });
  assert.equal(chooseDiceOutcome(assignments, () => 0.999999).index, 5);
  assert.equal(chooseDiceOutcome(assignments, () => 1).index, 5);
});

test("a roll rejects malformed face configurations and invalid random samples", () => {
  assert.throws(() => chooseDiceOutcome(["blank"]), /exactly six/);
  assert.throws(() => chooseDiceOutcome(["blank", "blank", "blank", "blank", "blank", "??"]), /unknown/);
  for (const sample of [-0.1, 1.1, Number.NaN]) {
    assert.throws(() => chooseDiceOutcome(Array(6).fill("blank"), () => sample), /between zero and one/);
  }
});
