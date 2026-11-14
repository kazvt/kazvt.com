import test from "node:test";
import assert from "node:assert/strict";
import { MODE_NAMES, ROUND_IDS, SPECIAL_ROUNDS, resolveRoundFormat } from "./trivia-data.js";

test("special round ids stay distinct from rounds 1 through 36", () => {
  assert.equal(ROUND_IDS.length, 38);
  assert.equal(ROUND_IDS[0], "00");
  assert.equal(ROUND_IDS[1], "0");
  assert.equal(ROUND_IDS[2], "01");
  assert.equal(ROUND_IDS.at(-1), "36");
  assert.equal(SPECIAL_ROUNDS["00"].kind, "blank");
  assert.equal(SPECIAL_ROUNDS["0"].kind, "host-instructions");
});

test("sparse difficulties inherit and additive choices accumulate", () => {
  assert.deepEqual(
    [1, 2, 3, 4].map((difficulty) => resolveRoundFormat("01", difficulty).optionCount),
    [6, 10, 10, 10],
  );
  assert.equal(resolveRoundFormat("01", 5).mode, "short-answer");
  assert.equal(resolveRoundFormat("01", 5).optionCount, 0);
  assert.equal(resolveRoundFormat("05", 2).optionCount, 8);
  assert.equal(resolveRoundFormat("07", 3).optionCount, 9);
});

test("question-specific templates preserve the supplied counts and modes", () => {
  const q4d2 = resolveRoundFormat("04", 2);
  const q4d3 = resolveRoundFormat("04", 3);
  const q4d4 = resolveRoundFormat("04", 4);
  assert.equal(q4d2.mode, "choice-image-wide");
  assert.equal(q4d3.mode, "choice-image");
  assert.equal(q4d4.optionCount, 10);
  assert.equal(resolveRoundFormat("08", 2).pairCount, 6);
  assert.equal(resolveRoundFormat("08", 2).optionCount, 12);
  assert.equal(resolveRoundFormat("08", 3).mode, "short-answer");
  assert.equal(resolveRoundFormat("09", 4).optionCount, 13);
  assert.equal(resolveRoundFormat("09", 5).optionCount, 13);
  assert.equal(resolveRoundFormat("10", 5).mode, "number-grid");
  assert.equal(resolveRoundFormat("10", 5).rows, 4);
  assert.equal(resolveRoundFormat("10", 5).columns, 4);
});

test("special media templates keep their authored sizes", () => {
  const q14 = resolveRoundFormat("14", 1);
  const q15d2 = resolveRoundFormat("15", 2);
  const q15d3 = resolveRoundFormat("15", 3);
  assert.deepEqual([q14.mode, q14.optionCount, q14.categories], ["categorize-images", 18, 3]);
  assert.equal(q15d2.optionCount, 7);
  assert.equal(q15d3.optionCount, 8);
  assert.equal(q15d3.reorder, true);
  assert.deepEqual([resolveRoundFormat("18", 1).mode, resolveRoundFormat("18", 1).optionCount], ["choice-image", 10]);
  assert.deepEqual([resolveRoundFormat("21", 1).pairCount, resolveRoundFormat("21", 1).optionCount], [12, 24]);
  assert.deepEqual([resolveRoundFormat("23", 1).rows, resolveRoundFormat("23", 1).columns], [3, 4]);
  assert.equal(resolveRoundFormat("28", 1).mode, "compose-image");
  assert.equal(resolveRoundFormat("31", 1).mode, "number-stepper");
  assert.equal(resolveRoundFormat("32", 1).mode, "memory-number");
  assert.equal(resolveRoundFormat("35", 1).mode, "video");
});

test("every configured template has a readable label", () => {
  for (let round = 1; round <= 36; round += 1) {
    for (let difficulty = 1; difficulty <= 5; difficulty += 1) {
      const format = resolveRoundFormat(String(round).padStart(2, "0"), difficulty);
      assert.ok(MODE_NAMES[format.mode], "round " + round + ", difficulty " + difficulty);
      assert.ok(format.optionCount >= 0 && format.optionCount <= 24);
    }
  }
});
