import assert from "node:assert/strict";
import test from "node:test";
import { layoutSideEdgeDecals } from "./decal-layout.mjs";

test("reward decals stay on the left and right edges, clear of top and bottom", () => {
  const width = 470;
  const height = 520;
  const positions = layoutSideEdgeDecals(width, height, 8, 123456);

  assert.equal(positions.length, 8);
  assert.equal(positions.filter(position => position.side === "left").length, 4);
  assert.equal(positions.filter(position => position.side === "right").length, 4);
  for (const position of positions) {
    assert.ok(position.x === 0 || position.x === width);
    assert.ok(position.y > position.size / 2);
    assert.ok(position.y < height - position.size / 2);
  }

  for (const side of ["left", "right"]) {
    const sidePositions = positions.filter(position => position.side === side).sort((a, b) => a.y - b.y);
    for (let index = 1; index < sidePositions.length; index += 1) {
      assert.ok(sidePositions[index].y - sidePositions[index - 1].y >= sidePositions[index].size * 1.45);
    }
  }
});

test("edge decal placement is stable for the same reward and viewport", () => {
  assert.deepEqual(
    layoutSideEdgeDecals(470, 520, 8, 991),
    layoutSideEdgeDecals(470, 520, 8, 991)
  );
});

test("small layouts still place decals only on the vertical sides", () => {
  const positions = layoutSideEdgeDecals(180, 260, 8, 42);
  assert.equal(positions.length, 8);
  assert.ok(positions.every(position => (position.x === 0 || position.x === 180) &&
    position.y >= position.size / 2 && position.y <= 260 - position.size / 2));
});
