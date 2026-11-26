import test from "node:test";
import assert from "node:assert/strict";
import { SLOT_PAYOUT_PATTERNS, findSlotPayouts, getSlotEligibleIndexes, placeSlotBerry, placeSlotWildcard, resolveSlotPayouts, rotateSlotColumns, secureRandomIndex } from "./slot-game.mjs";
import { SLOT_REEL_WILDCARD } from "./slot-reels.mjs";

const blankBoard = () => Array(15).fill(null);

test("the payout table preserves all 16 reference awards and mask sizes", () => {
  assert.deepEqual(SLOT_PAYOUT_PATTERNS.map(({ points }) => points), [
    4000, 8000, 10000, 8000, 5000, 20000, 25000, 30000,
    6000, 25000, 20000, 50000, 5000, 75000, 60000, 50000,
  ]);
  assert.deepEqual(SLOT_PAYOUT_PATTERNS.map(({ cells }) => cells.length), [
    3, 5, 5, 5, 3, 7, 7, 7, 3, 7, 7, 7, 3, 9, 9, 10,
  ]);
  assert.equal(new Set(SLOT_PAYOUT_PATTERNS.map(({ id }) => id)).size, 16);
});

test("placement chooses uniformly from the chosen line, replacing other berries but never its own", () => {
  const grid = blankBoard();
  grid[2] = "kazberry";
  grid[7] = "erinberry";
  const first = placeSlotBerry(grid, "kazberry", { axis: "column", index: 2, randomIndex: () => 0 });
  assert.deepEqual(first.eligibleIndexes, [7, 12]);
  assert.equal(first.placedIndex, 7);
  assert.equal(first.grid[7], "kazberry");
  assert.equal(first.grid[2], "kazberry");
  assert.equal(first.grid[12], null);

  const second = placeSlotBerry(grid, "faroeberry", { axis: "row", index: 1, randomIndex: () => 2 });
  assert.equal(second.placedIndex, 7);
  assert.equal(second.grid[7], "faroeberry");
  assert.equal(grid[7], "erinberry", "the source board is immutable");
});

test("line availability matches placement eligibility for each row and column", () => {
  const grid = blankBoard();
  grid[0] = "kazberry";
  grid[5] = "kazberry";
  grid[10] = "kazberry";
  grid[11] = "erinberry";
  assert.deepEqual(getSlotEligibleIndexes(grid, "kazberry", { axis: "column", index: 0 }), []);
  assert.deepEqual(getSlotEligibleIndexes(grid, "kazberry", { axis: "column", index: 1 }), [1, 6, 11]);
  assert.deepEqual(getSlotEligibleIndexes(grid, "kazberry", { axis: "row", index: 0 }), [1, 2, 3, 4]);
  assert.deepEqual(getSlotEligibleIndexes(grid, "kazberry", { axis: "row", index: 9 }), []);
  assert.deepEqual(getSlotEligibleIndexes(grid, "mysteryberry", { axis: "row", index: 0 }), []);
  assert.deepEqual(getSlotEligibleIndexes(grid, "kazberry", { axis: "diagonal", index: 0 }), []);
});

test("wildcard placement targets the exact slot, replaces an occupied cell, and leaves input unchanged", () => {
  const grid = blankBoard();
  grid[7] = "erinberry";
  const result = placeSlotWildcard(grid, 7);
  assert.equal(result.placedIndex, 7);
  assert.equal(result.grid[7], SLOT_REEL_WILDCARD);
  assert.equal(grid[7], "erinberry");
  assert.equal(placeSlotWildcard(result.grid, 7).placedIndex, -1);
  assert.equal(placeSlotWildcard(grid, 15).placedIndex, -1);
  assert.equal(placeSlotWildcard(grid, -1).placedIndex, -1);
});

test("ordinary berry placement cannot overwrite a wildcard", () => {
  const grid = blankBoard();
  grid[0] = "star";
  grid[1] = "erinberry";
  assert.deepEqual(getSlotEligibleIndexes(grid, "kazberry", { axis: "column", index: 0 }), [5, 10]);
});

test("placement is a no-op when a selected line is already entirely the active player's berry", () => {
  const grid = blankBoard();
  for (let row = 0; row < 3; row += 1) grid[row * 5 + 4] = "erinberry";
  const result = placeSlotBerry(grid, "erinberry", { axis: "column", index: 4 });
  assert.equal(result.placedIndex, -1);
  assert.deepEqual(result.grid, grid);
  assert.deepEqual(result.eligibleIndexes, []);
});

test("a reel spin rotates only chosen columns by one or two cells", () => {
  const grid = ["faroeberry", "erinberry", "kazberry", null, null,
    "erinberry", "kazberry", "faroeberry", null, null,
    "kazberry", "faroeberry", "erinberry", null, null];
  const result = rotateSlotColumns(grid, [0, 0, 6], { randomIndex: () => 1 });
  assert.deepEqual(result.rotations, { 0: 1 });
  assert.deepEqual([result.grid[0], result.grid[5], result.grid[10]], ["kazberry", "faroeberry", "erinberry"]);
  assert.deepEqual(result.grid.slice(1, 5), grid.slice(1, 5));
});

test("a reel spin can settle in its starting orientation after a full turn", () => {
  const grid = ["faroeberry", "erinberry", "kazberry", null, null,
    "erinberry", "kazberry", "faroeberry", null, null,
    "kazberry", "faroeberry", "erinberry", null, null];
  const result = rotateSlotColumns(grid, [0], { randomIndex: () => 0 });
  assert.deepEqual(result.rotations, { 0: 0 });
  assert.deepEqual(result.grid, grid);
});

test("every authored mask pays for its owner, regardless of who caused the board change", () => {
  for (const pattern of SLOT_PAYOUT_PATTERNS) {
    const grid = blankBoard();
    for (const index of pattern.cells) grid[index] = "kazberry";
    assert.ok(findSlotPayouts(grid).some((win) => win.owner === "kaz" && win.patternId === pattern.id), pattern.id);
  }

  const grid = blankBoard();
  for (const index of SLOT_PAYOUT_PATTERNS.find(({ id }) => id === "center-hook").cells) grid[index] = "faroeberry";
  const result = resolveSlotPayouts(grid);
  assert.ok(result.payouts.some((win) => win.owner === "faroe" && win.patternId === "center-hook"));
  assert.ok(result.totals.faroe >= 30000);
  assert.equal(result.totals.kaz, 0);
});

test("star substitutes for a missing berry and pays the owner of the real berries", () => {
  const grid = blankBoard();
  grid[0] = "kazberry";
  grid[5] = "star";
  grid[10] = "star";
  const wins = findSlotPayouts(grid);
  assert.deepEqual(wins.map(({ owner, patternId, points }) => ({ owner, patternId, points })), [
    { owner: "kaz", patternId: "left-column", points: 4000 },
  ]);
  const result = resolveSlotPayouts(grid);
  assert.deepEqual(result.clearedCells, [0, 5, 10]);
  assert.equal(result.totals.kaz, 4000);
});

test("all-star and mixed-berry patterns are not winning combinations", () => {
  const grid = blankBoard();
  [0, 5, 10].forEach((index) => { grid[index] = "star"; });
  assert.deepEqual(findSlotPayouts(grid), []);
  grid[0] = "kazberry";
  grid[5] = "erinberry";
  assert.deepEqual(findSlotPayouts(grid), []);
});

test("a placed wildcard follows its column during a spin", () => {
  const grid = blankBoard();
  grid[0] = "star";
  const result = rotateSlotColumns(grid, [0], { randomIndex: () => 1 });
  assert.equal(result.grid.indexOf("star"), 5);
});

test("simultaneous overlapping patterns each pay once and remove the union of matched cells", () => {
  const grid = Array(15).fill("kazberry");
  const result = resolveSlotPayouts(grid);
  assert.equal(result.payouts.length, 16);
  assert.equal(result.totals.kaz, 401000);
  assert.deepEqual(result.clearedCells, Array.from({ length: 15 }, (_, index) => index));
  assert.ok(result.grid.every((berry) => berry === null));
});

test("secure random integer selection stays in range and uses crypto when available", () => {
  let calls = 0;
  const cryptoSource = { getRandomValues: (word) => { calls += 1; word[0] = 11; return word; } };
  assert.equal(secureRandomIndex(5, cryptoSource), 1);
  assert.equal(calls, 1);
  assert.equal(secureRandomIndex(0), -1);
  assert.equal(secureRandomIndex(5, null, () => 0.99), 4);
});
