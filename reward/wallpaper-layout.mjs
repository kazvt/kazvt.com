export const WALLPAPER_ART_SIZE = 210;
export const WALLPAPER_STEP_X = 352;
export const WALLPAPER_STEP_Y = WALLPAPER_STEP_X * Math.sqrt(3) / 2;
export const WALLPAPER_JITTER = 10;
export const WALLPAPER_BOUND_RADIUS = WALLPAPER_ART_SIZE * Math.SQRT1_2 * 1.02 + Math.SQRT2 * 3 + 5;

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createCellRandom(seed, row, column) {
  let mixed = seed >>> 0;
  mixed = Math.imul(mixed ^ row, 0x85ebca6b);
  mixed = Math.imul(mixed ^ column, 0xc2b2ae35);
  mixed ^= mixed >>> 16;
  return createSeededRandom(mixed >>> 0);
}

export function wallpaperCell(row, column, seed, zoomCompensation = 1) {
  const scale = Number.isFinite(zoomCompensation) && zoomCompensation > 0 ? zoomCompensation : 1;
  const random = createCellRandom(seed, row, column);
  const styleIndex = Math.floor(random() * 12) + 1;
  const spinDirection = random() < 0.5 ? "wall-art-spin--clockwise" : "wall-art-spin--counterclockwise";
  const angleJitter = (random() * 16 - 8).toFixed(1);
  const driftX = (random() * 6 - 3) * scale;
  const driftY = (random() * 6 - 3) * scale;
  const jitterX = (random() * 2 - 1) * WALLPAPER_JITTER;
  const jitterY = (random() * 2 - 1) * WALLPAPER_JITTER;
  const origin = WALLPAPER_BOUND_RADIUS + 3 + WALLPAPER_JITTER;

  return {
    row,
    column,
    x: (origin + (Math.abs(row) % 2) * WALLPAPER_STEP_X / 2 + column * WALLPAPER_STEP_X + jitterX) * scale,
    y: (origin + row * WALLPAPER_STEP_Y + jitterY) * scale,
    size: WALLPAPER_ART_SIZE * scale,
    radius: WALLPAPER_BOUND_RADIUS * scale,
    styleIndex,
    spinDirection,
    angleJitter,
    driftX: `${driftX.toFixed(2)}px`,
    driftY: `${driftY.toFixed(2)}px`
  };
}

export function wallpaperCellsForViewport(width, height, seed, zoomCompensation = 1) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return [];
  const scale = Number.isFinite(zoomCompensation) && zoomCompensation > 0 ? zoomCompensation : 1;
  const rowStep = WALLPAPER_STEP_Y * scale;
  const columnStep = WALLPAPER_STEP_X * scale;
  const maxRow = Math.ceil(height / rowStep) + 1;
  const maxColumn = Math.ceil(width / columnStep) + 2;
  const cells = [];

  for (let row = -1; row <= maxRow; row += 1) {
    for (let column = -1; column <= maxColumn; column += 1) {
      const cell = wallpaperCell(row, column, seed, scale);
      if (cell.x + cell.radius < 0 || cell.x - cell.radius > width ||
          cell.y + cell.radius < 0 || cell.y - cell.radius > height) continue;
      cells.push(cell);
    }
  }

  return cells;
}
