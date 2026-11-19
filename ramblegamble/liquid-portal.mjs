const LIQUID_PARAMETERS = [
  ["theatre", "on"],
  ["fullscreen", "on"],
  ["color_low", "#031f16"],
  ["color_mid", "#076831"],
  ["color_high", "#84c226"],
  ["viscosity", "0"],
  ["speed", "2"],
  ["fold_size", "0.65"],
  ["zoom", "0.74"],
  ["wrap_edges", "off"],
  ["height_range", "0.45"],
  ["relief", "1.65"],
  ["detail", "61%"],
  ["gloss", "1.80"],
  ["sharpness", "33"],
  ["blur", "0"],
  ["saturation", "0.88"],
  ["contrast", "0.90"],
  ["brightness", "-0.060"],
  ["render_quality", "50%"],
];

export const LIQUID_PORTAL_SOURCE = `/liquid/?${new URLSearchParams(LIQUID_PARAMETERS)}`;
export const LIQUID_PORTAL_WIDTH = 512;
export const LIQUID_PORTAL_HEIGHT = 1024;

function formatCssNumber(value) {
  const rounded = Number(value.toFixed(15));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function createCssProjectiveQuad(width, height, corners) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  if (!Array.isArray(corners) || corners.length !== 4) return null;
  if (!corners.every((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))) return null;

  const source = [[0, 0], [width, 0], [width, height], [0, height]];
  const equations = [];
  for (let index = 0; index < 4; index += 1) {
    const [x, y] = source[index];
    const { x: targetX, y: targetY } = corners[index];
    equations.push([x, y, 1, 0, 0, 0, -targetX * x, -targetX * y, targetX]);
    equations.push([0, 0, 0, x, y, 1, -targetY * x, -targetY * y, targetY]);
  }

  // A homography makes this live iframe behave like a perspective-projected
  // plane without copying pixels out of its own WebGL canvas.
  for (let column = 0; column < 8; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < 8; row += 1) {
      if (Math.abs(equations[row][column]) > Math.abs(equations[pivotRow][column])) pivotRow = row;
    }
    if (Math.abs(equations[pivotRow][column]) < 1e-12) return null;
    [equations[column], equations[pivotRow]] = [equations[pivotRow], equations[column]];

    const pivot = equations[column][column];
    for (let entry = column; entry <= 8; entry += 1) equations[column][entry] /= pivot;
    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue;
      const factor = equations[row][column];
      if (factor === 0) continue;
      for (let entry = column; entry <= 8; entry += 1) {
        equations[row][entry] -= factor * equations[column][entry];
      }
    }
  }

  const [a, c, e, b, d, f, g, h] = equations.map((row) => row[8]);
  const matrix = [a, b, 0, g, c, d, 0, h, 0, 0, 1, 0, e, f, 0, 1];
  if (!matrix.every(Number.isFinite)) return null;
  return `matrix3d(${matrix.map(formatCssNumber).join(",")})`;
}
