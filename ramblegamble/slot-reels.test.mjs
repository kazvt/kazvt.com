import test from "node:test";
import assert from "node:assert/strict";
import {
  SLOT_REEL_CELL_COUNT,
  SLOT_REEL_WILDCARD,
  createSlotReelMotion,
  normalizeReelColumns,
  normalizeSlotGrid,
  sampleSlotReelColumn,
  slotCellIndexAtUv,
  slotScreenPoint,
} from "./slot-reels.mjs";

test("slot grid parsing clamps malformed values to blank and always returns 15 cells", () => {
  const grid = normalizeSlotGrid(JSON.stringify(["faroeberry", "not-a-berry", "kazberry"]));
  assert.equal(grid.length, SLOT_REEL_CELL_COUNT);
  assert.deepEqual(grid.slice(0, 3), ["faroeberry", null, "kazberry"]);
  assert.ok(grid.slice(3).every((value) => value === null));
  assert.deepEqual(normalizeSlotGrid("not json"), Array(SLOT_REEL_CELL_COUNT).fill(null));
});

test("saved slot grids retain the star wildcard", () => {
  const grid = Array(15).fill(null);
  grid[8] = SLOT_REEL_WILDCARD;
  assert.equal(normalizeSlotGrid(grid)[8], SLOT_REEL_WILDCARD);
});

test("column selection is unique, numeric, and bounded to the five physical reels", () => {
  assert.deepEqual(normalizeReelColumns([4, 1, 4, -1, 5, "2", "nope"]), [4, 1, 2]);
  assert.deepEqual(normalizeReelColumns([]), []);
});

test("reel motion preserves the configured stop, staggers columns, and settles exactly", () => {
  const grid = ["kazberry", null, "erinberry", "faroeberry", null,
    null, "faroeberry", null, "kazberry", "erinberry",
    "erinberry", null, "kazberry", null, "faroeberry"];
  const motion = createSlotReelMotion(grid, [0, 2, 4], {
    startedAt: 100,
    duration: 1800,
    stagger: 120,
    random: () => 0.5,
  });
  assert.deepEqual(motion.columns.map(({ column, delay }) => [column, delay]), [[0, 0], [2, 120], [4, 240]]);
  const first = motion.columns[0];
  assert.equal(sampleSlotReelColumn(first, motion, 100).offset, 0);
  assert.equal(sampleSlotReelColumn(first, motion, 1900).spinning, false);
  assert.deepEqual(sampleSlotReelColumn(first, motion, 1900).symbols, ["kazberry", null, "erinberry"]);
  assert.deepEqual(motion.grid, normalizeSlotGrid(grid));
});

test("reel animation lands on its computed board outcome", () => {
  const starting = Array(15).fill(null);
  const target = starting.slice();
  target[7] = "erinberry";
  target[14] = "kazberry";
  const motion = createSlotReelMotion(starting, [2, 4], {
    targetGrid: target,
    startedAt: 0,
    duration: 100,
    random: () => 0.5,
  });
  assert.deepEqual(motion.columns.map((column) => column.target), [[null, "erinberry", null], [null, null, "kazberry"]]);
  assert.deepEqual(motion.targetGrid, target);
});

test("the same reel gets a different travel distance on consecutive spins", () => {
  const first = createSlotReelMotion(Array(15).fill(null), [2], { random: () => 0 });
  const second = createSlotReelMotion(Array(15).fill(null), [2], {
    random: () => 0,
    previousSpinRows: { 2: first.columns[0].travelRows },
  });
  assert.notEqual(second.columns[0].travelRows, first.columns[0].travelRows);
  assert.equal(first.columns[0].targetOffset, 3 + first.columns[0].travelRows);
  assert.equal(second.columns[0].targetOffset, 3 + second.columns[0].travelRows);
});

test("screen UV coordinates map to the correct top-left-origin row and column", () => {
  assert.equal(slotCellIndexAtUv({ x: 0.01, y: 0.99 }), 0);
  assert.equal(slotCellIndexAtUv({ x: 0.99, y: 0.99 }), 4);
  assert.equal(slotCellIndexAtUv({ x: 0.01, y: 0.01 }), 10);
  assert.equal(slotCellIndexAtUv({ x: 0.99, y: 0.01 }), 14);
  assert.equal(slotCellIndexAtUv({ x: 1, y: 0 }), 14);
  assert.equal(slotCellIndexAtUv({ x: -0.1, y: 0.5 }), -1);
});

test("a column's texture-space quad maps to the machine's front panel and stays in front", () => {
  const upperLeft = slotScreenPoint(6, 17, 0.06);
  const lowerRight = slotScreenPoint(74, 57, 0.06);
  assert.ok(upperLeft.x > lowerRight.x, "glTF panel U runs opposite the visible horizontal direction");
  assert.ok(upperLeft.y > lowerRight.y, "the top of the display is above its bottom");
  assert.ok(upperLeft.z > lowerRight.z, "front-panel depth follows its sloped baked mesh");
  assert.ok(upperLeft.z < -3, "the overlay is nudged toward the viewer from the cabinet face");
});
