export const SLOT_REEL_COLUMNS = 5;
export const SLOT_REEL_ROWS = 3;
export const SLOT_REEL_CELL_COUNT = SLOT_REEL_COLUMNS * SLOT_REEL_ROWS;
export const SLOT_REEL_SYMBOLS = Object.freeze([
  "faroeberry",
  "erinberry",
  "kazberry",
]);

const ALLOWED_SYMBOLS = new Set(SLOT_REEL_SYMBOLS);
const DISPLAY_TEXTURE = Object.freeze({
  width: 128,
  panelLeftX: -5.1,
  panelRightX: 5,
  panelLeftTopY: 8.2,
  panelRightTopY: 8,
  panelLeftBottomY: 0.1,
  panelRightBottomY: 0,
  topZ: -3,
  bottomZ: -4,
});

export function normalizeSlotGrid(value) {
  let candidate = value;
  if (typeof candidate === "string") {
    try { candidate = JSON.parse(candidate); }
    catch { candidate = null; }
  }
  if (candidate && !Array.isArray(candidate) && Array.isArray(candidate.grid)) candidate = candidate.grid;
  return Array.from({ length: SLOT_REEL_CELL_COUNT }, (_, index) => {
    const symbol = candidate?.[index];
    return ALLOWED_SYMBOLS.has(symbol) ? symbol : null;
  });
}

export function normalizeReelColumns(columns) {
  const source = Array.isArray(columns) ? columns : [columns];
  return [...new Set(source.map(Number).filter((column) => (
    Number.isInteger(column) && column >= 0 && column < SLOT_REEL_COLUMNS
  )))];
}

export function slotScreenPoint(textureX, textureY, depth = 0) {
  const { width, panelLeftX, panelRightX, panelLeftTopY, panelRightTopY,
    panelLeftBottomY, panelRightBottomY, topZ, bottomZ } = DISPLAY_TEXTURE;
  const u = textureX / width;
  const v = textureY / width;
  const panelU = u / 0.625;
  const x = panelRightX + (panelLeftX - panelRightX) * panelU;
  const topY = panelRightTopY + (panelLeftTopY - panelRightTopY) * panelU;
  const bottomY = panelRightBottomY + (panelLeftBottomY - panelRightBottomY) * panelU;
  const y = topY + (bottomY - topY) * (v / 0.5);
  const z = topZ + (bottomZ - topZ) * (v / 0.5) - depth;
  return { x, y, z };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function randomSymbol(random) {
  const choice = clamp01(Number(random()) || 0);
  // Empty reel stops are slightly less common than berries, but remain possible.
  if (choice < 0.12) return null;
  return SLOT_REEL_SYMBOLS[Math.min(
    SLOT_REEL_SYMBOLS.length - 1,
    Math.floor(((choice - 0.12) / 0.88) * SLOT_REEL_SYMBOLS.length),
  )];
}

export function createSlotReelMotion(grid, columns, {
  targetGrid = grid,
  startedAt = 0,
  duration = 1850,
  stagger = 115,
  random = Math.random,
  reducedMotion = false,
} = {}) {
  const currentGrid = normalizeSlotGrid(grid);
  const settledGrid = normalizeSlotGrid(targetGrid);
  const activeColumns = normalizeReelColumns(columns);
  if (!activeColumns.length) return null;
  const safeDuration = Math.max(0, Number(duration) || 0);
  const safeStagger = Math.max(0, Number(stagger) || 0);

  return {
    startedAt: Number(startedAt) || 0,
    grid: currentGrid,
    columns: activeColumns.map((column, order) => {
      const randomRows = reducedMotion ? 5 : 18 + Math.floor(clamp01(Number(random()) || 0) * 9);
      const start = Array.from({ length: SLOT_REEL_ROWS }, (_, row) => currentGrid[row * SLOT_REEL_COLUMNS + column]);
      const stop = Array.from({ length: randomRows }, () => randomSymbol(random));
      const target = start.map((_, row) => settledGrid[row * SLOT_REEL_COLUMNS + column]);
      return {
        column,
        delay: order * safeStagger,
        duration: reducedMotion ? Math.min(safeDuration, 360) : safeDuration,
        start,
        stop,
        target,
        strip: [...start, ...stop, ...target],
        targetOffset: SLOT_REEL_ROWS + stop.length,
      };
    }),
    targetGrid: settledGrid,
  };
}

export function sampleSlotReelColumn(columnMotion, motion, time) {
  if (!columnMotion || !motion) return null;
  const elapsed = Number(time) - motion.startedAt - columnMotion.delay;
  if (elapsed <= 0) return { offset: 0, symbols: columnMotion.start, spinning: true };
  if (columnMotion.duration <= 0 || elapsed >= columnMotion.duration) {
    return { offset: columnMotion.targetOffset, symbols: columnMotion.target, spinning: false };
  }

  const progress = clamp01(elapsed / columnMotion.duration);
  // Symbols move at a steady initial pace, then ease down into the exact stop.
  const eased = progress < 0.72
    ? progress / 0.72 * 0.82
    : 0.82 + 0.18 * (1 - Math.pow(1 - (progress - 0.72) / 0.28, 3));
  return { offset: columnMotion.targetOffset * eased, symbols: null, spinning: true };
}

