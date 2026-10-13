import assert from "node:assert/strict";
import test from "node:test";
import {
  WALLPAPER_BOUND_RADIUS,
  wallpaperCell,
  wallpaperCellsForViewport
} from "./wallpaper-layout.mjs";

test("wallpaper cells keep the same seeded positions as viewport dimensions change", () => {
  const small = wallpaperCellsForViewport(900, 700, 0x12345678);
  const large = wallpaperCellsForViewport(1600, 1000, 0x12345678);
  const largeByKey = new Map(large.map(cell => [`${cell.row}:${cell.column}`, cell]));

  for (const cell of small) {
    const matching = largeByKey.get(`${cell.row}:${cell.column}`);
    assert.ok(matching, `cell ${cell.row}:${cell.column} remains in the larger viewport`);
    assert.equal(matching.x, cell.x);
    assert.equal(matching.y, cell.y);
    assert.equal(matching.size, cell.size);
    assert.equal(matching.styleIndex, cell.styleIndex);
    assert.equal(matching.spinDirection, cell.spinDirection);
  }
});

test("zoom compensation preserves artwork coordinates and size in screen pixels", () => {
  const normal = wallpaperCell(2, 3, 0x87654321, 1);
  const zoomed = wallpaperCell(2, 3, 0x87654321, 0.5);
  assert.ok(Math.abs(zoomed.x * 2 - normal.x) < 1e-9);
  assert.ok(Math.abs(zoomed.y * 2 - normal.y) < 1e-9);
  assert.ok(Math.abs(zoomed.size * 2 - normal.size) < 1e-9);
});

test("neighboring wallpaper art remains separated through its rotation and wobble", () => {
  for (let seed = 1; seed <= 80; seed += 1) {
    const cells = wallpaperCellsForViewport(1800, 1400, seed);
    for (let leftIndex = 0; leftIndex < cells.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < cells.length; rightIndex += 1) {
        const left = cells[leftIndex];
        const right = cells[rightIndex];
        const dx = left.x - right.x;
        const dy = left.y - right.y;
        if (Math.abs(dx) <= 500 && Math.abs(dy) <= 500) {
          assert.ok(dx * dx + dy * dy >= (WALLPAPER_BOUND_RADIUS * 2) ** 2,
            `wallpaper cells overlap for seed ${seed}`);
        }
      }
    }
  }
});

test("viewport size only changes which fixed cells are visible", () => {
  const compact = wallpaperCellsForViewport(500, 700, 42);
  const wider = wallpaperCellsForViewport(900, 700, 42);
  assert.ok(wider.length > compact.length);
  assert.deepEqual(
    compact.map(cell => `${cell.row}:${cell.column}`).sort(),
    wider.filter(cell => cell.x + cell.radius >= 0 && cell.x - cell.radius <= 500 &&
        cell.y + cell.radius >= 0 && cell.y - cell.radius <= 700)
      .map(cell => `${cell.row}:${cell.column}`).sort()
  );
});
