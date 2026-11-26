import test from "node:test";
import assert from "node:assert/strict";
import { SLOT_PAYOUT_PATTERNS, findSlotPayouts, getSlotEligibleIndexes, placeSlotBerry, placeSlotWildcard, resolveSlotPayouts, removeSlotSymbol, rotateSlotColumns, secureRandomIndex } from "./slot-game.mjs";
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
  assert.equal(result.totals.faroe, 30000);
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

test("greedy payout claims the eye first; no cell can be paid twice", () => {
  const eye = SLOT_PAYOUT_PATTERNS.find(({ id }) => id === "diamond");
  const grid = blankBoard();
  for (const index of eye.cells) grid[index] = "kazberry";
  const result = resolveSlotPayouts(grid);
  assert.deepEqual(result.payouts.map(({ patternId }) => patternId), ["diamond"]);
  assert.equal(result.totals.kaz, 75000);
  assert.equal(result.clearedCells.length, 9);
  const full = resolveSlotPayouts(Array(15).fill("kazberry"));
  assert.equal(full.payouts[0].patternId, "diamond");
  assert.equal(full.payouts.flatMap(({ cells }) => cells).length, full.clearedCells.length);
});

test("disjoint winners pay independently, even for the same berry", () => {
  const grid = blankBoard();
  for (const i of [0, 5, 10, 1, 6, 11]) grid[i] = "erinberry";
  for (const i of [3, 8, 13]) grid[i] = "faroeberry";
  const result = resolveSlotPayouts(grid);
  assert.deepEqual(result.totals, { faroe: 5000, erin: 9000, kaz: 0 });
  assert.equal(result.grid[3], null);
});

test("every mask works with any number of stars as long as a real berry remains", () => {
  for (const pattern of SLOT_PAYOUT_PATTERNS) {
    for (const berry of ["kazberry", "faroeberry", "erinberry"]) {
      for (let count = 0; count < pattern.cells.length; count++) {
        const grid = blankBoard();
        pattern.cells.forEach((index, i) => { grid[index] = i < count ? "star" : berry; });
        const result = resolveSlotPayouts(grid);
        assert.equal(result.payouts[0]?.patternId, pattern.id, `${pattern.id}, ${berry}, ${count}`);
        assert.equal(result.payouts[0]?.points, pattern.points);
      }
    }
  }
});

test("wildcards shared across owners are consumed by the higher prize only", () => {
  const grid = blankBoard();
  [0, 1, 2, 3].forEach(i => { grid[i] = "kazberry"; });
  grid[4] = "star"; // top row
  grid[2] = "star"; grid[7] = "erinberry"; grid[12] = "erinberry";
  const result = resolveSlotPayouts(grid);
  assert.equal(result.totals.kaz, 8000);
  assert.equal(result.totals.erin, 0);
  assert.equal(result.grid[7], "erinberry");
});

test("remove one berry or star without changing other cells or the source", () => {
  const grid = blankBoard(); grid[2] = "star"; grid[7] = "kazberry";
  const result = removeSlotSymbol(grid, 2);
  assert.equal(result.removed, true);
  assert.equal(result.grid[2], null);
  assert.equal(result.grid[7], "kazberry");
  assert.equal(grid[2], "star");
  assert.equal(removeSlotSymbol(result.grid, 2).removed, false);
  assert.equal(removeSlotSymbol(grid, -1).removed, false);
  assert.equal(removeSlotSymbol(grid, null).removed, false);
});

test("secure random integer selection stays in range and uses crypto when available", () => {
  let calls = 0;
  const cryptoSource = { getRandomValues: (word) => { calls += 1; word[0] = 11; return word; } };
  assert.equal(secureRandomIndex(5, cryptoSource), 1);
  assert.equal(calls, 1);
  assert.equal(secureRandomIndex(0), -1);
  assert.equal(secureRandomIndex(5, null, () => 0.99), 4);
});
