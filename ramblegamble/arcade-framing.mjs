// World-space front edge of the authored stage recess (outer/lower lip, X/Z).
// Keep the wheel outside the lip itself, not outside the entire stage AABB.
export const ROULETTE_RECESS = Object.freeze({
  left: 10.0326, right: 13.5894, frontZ: -1.3716, clearance: 0.18,
});

export function rouletteRecessCenter(radius) {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Invalid roulette footprint radius');
  return {
    x: (ROULETTE_RECESS.left + ROULETTE_RECESS.right) / 2,
    z: ROULETTE_RECESS.frontZ + radius + ROULETTE_RECESS.clearance,
  };
}

// Fit interaction geometry, not the whole cabinet. Points are in the camera's
// right/up/toward-camera basis, relative to a provisional target. Reserve space
// for the berry picker, score HUD and navigation bands. Fit the actual points
// in the perspective frustum, including their different depths.
export function fitSlotInteractionFrame(points, {width, height, fov = 42, near = 0.1}) {
  const w = Math.max(1, width), h = Math.max(1, height);
  const tanY = Math.tan(fov * Math.PI / 360), tanX = tanY * w / h;
  const side = Math.min(Math.min(96, Math.max(42, w * .075)) + 8, w * .17);
  const top = Math.min(84, h * .30);
  const bottom = Math.min(Math.min(84, Math.max(48, h * .11)) + 8, h * .23);
  const xMin = -1 + 2 * side / w, xMax = 1 - 2 * side / w;
  const yMin = -1 + 2 * bottom / h, yMax = 1 - 2 * top / h;
  // At distance d, every projected coordinate must lie between lo and hi.
  // Each point then constrains the permitted target shift to an interval.
  // Their common intersection gives the minimum admissible distance exactly.
  function axis(key, lo, hi, tan) {
    const lower = Math.max(...points.map(p => p[key] + hi * tan * p.z));
    const upper = Math.min(...points.map(p => p[key] + lo * tan * p.z));
    return { lower, upper, lo, hi, tan, distance: (lower - upper) / ((hi - lo) * tan) };
  }
  const x = axis('x', xMin, xMax, tanX), y = axis('y', yMin, yMax, tanY);
  const distance = Math.max(x.distance, y.distance, ...points.map(p => p.z + near + .08), .25) * 1.025;
  const shift = a => ((a.lower - a.hi * a.tan * distance) + (a.upper - a.lo * a.tan * distance)) / 2;
  return {distance, shiftX: shift(x), shiftY: shift(y), limits: {xMin, xMax, yMin, yMax}};
}

// Fit a square HTML arrow into the projected strip between the reel screen
// and the physical spin buttons. All coordinates are CSS pixels in the canvas.
// Include the physical controls' 5px picking padding so their hit areas stay free.
export function fitSlotColumnArrow({ x, size, screenBottom, spinButtons, index }) {
  const [left, right] = screenBottom;
  const edgeY = px => left.y + (right.y - left.y) * (px - left.x) / (right.x - left.x);
  if (!Number.isFinite(x) || !Number.isFinite(size) || size <= 0 || Math.abs(right.x - left.x) < 1e-6 || !spinButtons[index]) return null;
  const band = side => {
    const minX = x - side / 2, maxX = x + side / 2;
    const top = Math.max(edgeY(minX), edgeY(maxX)) + 3;
    const bottom = Math.min(spinButtons[index].top, ...spinButtons.filter(b => b.right + 5 >= minX && b.left - 5 <= maxX).map(b => b.top)) - 6;
    return { top, bottom };
  };
  // Test the full square width: at angled views a neighboring physical button
  // or the sloped screen edge can limit the available space.
  let low = 0, high = size;
  for (let i = 0; i < 18; i += 1) {
    const mid = (low + high) / 2;
    const { top, bottom } = band(mid);
    if (bottom - top >= mid) low = mid;
    else high = mid;
  }
  if (low < 1) return null;
  const { top, bottom } = band(low);
  return { x, y: (top + bottom) / 2, size: low };
}
