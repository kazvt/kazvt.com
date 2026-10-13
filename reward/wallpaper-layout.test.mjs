import assert from "node:assert/strict";
import test from "node:test";
import {
  WALLPAPER_ART_SIZE,
  WALLPAPER_FILLER_SIZE,
  createWallpaperLayout,
  wallpaperPointsForViewport
} from "./wallpaper-layout.mjs";

test("wallpaper positions are deterministic and independent of viewport dimensions", () => {
  const layout = createWallpaperLayout(0x12345678);
  const small = wallpaperPointsForViewport(layout, 900, 700);
  const large = wallpaperPointsForViewport(layout, 1600, 1000);
  const largeById = new Map(large.map(point => [point.id, point]));

  for (const point of small) {
    const matching = largeById.get(point.id);
    assert.ok(matching, `point ${point.id} remains visible in the larger viewport`);
    assert.equal(matching.x, point.x);
    assert.equal(matching.y, point.y);
    assert.equal(matching.size, point.size);
    assert.equal(matching.styleIndex, point.styleIndex);
    assert.equal(matching.spinDirection, point.spinDirection);
  }
});

test("zoom compensation preserves artwork positions and size in screen pixels", () => {
  const layout = createWallpaperLayout(0x87654321);
  const normal = wallpaperPointsForViewport(layout, 1600, 1000, 1);
  const zoomed = wallpaperPointsForViewport(layout, 800, 500, 0.5);
  const zoomedById = new Map(zoomed.map(point => [point.id, point]));

  assert.equal(zoomed.length, normal.length);
  for (const point of normal) {
    const matching = zoomedById.get(point.id);
    assert.ok(matching, `point ${point.id} remains visible at compensated zoom`);
    assert.ok(Math.abs(matching.x * 2 - point.x) < 1e-9);
    assert.ok(Math.abs(matching.y * 2 - point.y) < 1e-9);
    assert.ok(Math.abs(matching.size * 2 - point.size) < 1e-9);
  }
});

test("the seeded scatter changes per reward but stays fixed within a reward", () => {
  const first = createWallpaperLayout(1234);
  const repeat = createWallpaperLayout(1234);
  const other = createWallpaperLayout(5678);
  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first.slice(0, 12).map(point => [point.x, point.y]),
    other.slice(0, 12).map(point => [point.x, point.y]));
});

test("wallpaper art never overlaps during its rotation and wobble", () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const layout = createWallpaperLayout(seed);
    const points = wallpaperPointsForViewport(layout, 1800, 1400);
    for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
        const left = points[leftIndex];
        const right = points[rightIndex];
        const dx = left.x - right.x;
        const dy = left.y - right.y;
        const requiredDistance = left.radius + right.radius + 4;
        assert.ok(dx * dx + dy * dy >= requiredDistance ** 2,
          `wallpaper art overlaps for seed ${seed}`);
      }
    }
  }
});

test("larger screens reveal additional points without moving existing ones", () => {
  const layout = createWallpaperLayout(42);
  const compact = wallpaperPointsForViewport(layout, 500, 700);
  const wider = wallpaperPointsForViewport(layout, 900, 700);
  const widerById = new Map(wider.map(point => [point.id, point]));
  assert.ok(wider.length > compact.length);
  for (const point of compact) {
    const matching = widerById.get(point.id);
    assert.ok(matching, `point ${point.id} stays visible`);
    assert.equal(matching.x, point.x);
    assert.equal(matching.y, point.y);
  }
});

test("smaller filler artwork increases the count while keeping the large repeats", () => {
  const points = wallpaperPointsForViewport(createWallpaperLayout(42), 1920, 1080);
  const large = points.filter(point => point.size === WALLPAPER_ART_SIZE);
  const fillers = points.filter(point => point.size === WALLPAPER_FILLER_SIZE);

  assert.ok(large.length >= 10, "large wallpaper art remains the dominant size");
  assert.ok(fillers.length > 0, "smaller repeats fill safe gaps between larger art");
  assert.ok(points.length > large.length, "the viewport shows more artwork overall");
});
