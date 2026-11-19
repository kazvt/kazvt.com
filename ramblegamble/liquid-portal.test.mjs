import assert from "node:assert/strict";
import test from "node:test";
import {
  createCssProjectiveQuad,
  LIQUID_PORTAL_HEIGHT,
  LIQUID_PORTAL_SOURCE,
  LIQUID_PORTAL_WIDTH,
} from "./liquid-portal.mjs";

function mapCssMatrix(matrixText, x, y) {
  const values = matrixText.match(/matrix3d\(([^)]+)\)/)?.[1]
    .split(",")
    .map(Number);
  assert.equal(values?.length, 16);
  const denominator = values[3] * x + values[7] * y + values[15];
  return {
    x: (values[0] * x + values[4] * y + values[12]) / denominator,
    y: (values[1] * x + values[5] * y + values[13]) / denominator,
  };
}

test("liquid portal iframe maps its corners to the perspective-projected doorway", () => {
  const corners = [
    { x: 130, y: 70 },
    { x: 390, y: 92 },
    { x: 365, y: 620 },
    { x: 148, y: 590 },
  ];
  const matrix = createCssProjectiveQuad(512, 1024, corners);
  assert.ok(matrix);
  const sourceCorners = [[0, 0], [512, 0], [512, 1024], [0, 1024]];
  for (let index = 0; index < sourceCorners.length; index += 1) {
    const projected = mapCssMatrix(matrix, ...sourceCorners[index]);
    assert.ok(Math.abs(projected.x - corners[index].x) < 1e-5);
    assert.ok(Math.abs(projected.y - corners[index].y) < 1e-5);
  }
});

test("front-facing portal rectangles map without unintended rotation or distortion", () => {
  const matrix = createCssProjectiveQuad(512, 1024, [
    { x: 40, y: 30 },
    { x: 296, y: 30 },
    { x: 296, y: 542 },
    { x: 40, y: 542 },
  ]);
  assert.ok(matrix);
  assert.deepEqual(mapCssMatrix(matrix, 0, 0), { x: 40, y: 30 });
  assert.deepEqual(mapCssMatrix(matrix, 512, 1024), { x: 296, y: 542 });
});

test("degenerate or invalid portal geometry is rejected", () => {
  assert.equal(createCssProjectiveQuad(0, 100, []), null);
  assert.equal(createCssProjectiveQuad(100, 100, [{ x: 0, y: 0 }]), null);
  assert.equal(createCssProjectiveQuad(100, 100, [
    { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 },
  ]), null);
  assert.equal(createCssProjectiveQuad(100, 100, [
    { x: 0, y: 0 }, { x: Number.NaN, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 },
  ]), null);
});

test("liquid portal URL requests a clean theatre view and applies the provided settings", () => {
  const parameters = new URL(`https://kazvt.com${LIQUID_PORTAL_SOURCE}`).searchParams;
  assert.equal(parameters.get("theatre"), "on");
  assert.equal(parameters.get("fullscreen"), "on");
  assert.equal(parameters.get("color_low"), "#031f16");
  assert.equal(parameters.get("color_mid"), "#076831");
  assert.equal(parameters.get("color_high"), "#84c226");
  assert.equal(parameters.get("speed"), "2");
  assert.equal(parameters.get("fold_size"), "0.65");
  assert.equal(parameters.get("zoom"), "0.74");
  assert.equal(parameters.get("height_range"), "0.45");
  assert.equal(parameters.get("detail"), "61%");
  assert.equal(parameters.get("render_quality"), "50%");
  assert.equal(LIQUID_PORTAL_WIDTH / LIQUID_PORTAL_HEIGHT, 0.5);
});
