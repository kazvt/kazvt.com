export const SLOT_REEL_COLUMNS = 5;
export const SLOT_REEL_ROWS = 3;
export const SLOT_REEL_CELL_COUNT = SLOT_REEL_COLUMNS * SLOT_REEL_ROWS;
export const SLOT_REEL_SYMBOLS = Object.freeze([
  "faroeberry",
  "erinberry",
  "kazberry",
]);
export const SLOT_REEL_WILDCARD = "star";

const ALLOWED_SYMBOLS = new Set([...SLOT_REEL_SYMBOLS, SLOT_REEL_WILDCARD]);
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

export function slotCellIndexAtUv(uv) {
  if (!uv || uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) return -1;
  const column = Math.min(SLOT_REEL_COLUMNS - 1, Math.floor(uv.x * SLOT_REEL_COLUMNS));
  const row = Math.min(SLOT_REEL_ROWS - 1, Math.floor((1 - uv.y) * SLOT_REEL_ROWS));
  return row * SLOT_REEL_COLUMNS + column;
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

function chooseTravelRows(column, random, previousSpinRows, reducedMotion) {
  const minimum = reducedMotion ? 2 : 12;
  const maximum = reducedMotion ? 5 : 32;
  const range = maximum - minimum + 1;
  const previous = Number(previousSpinRows?.[column]);
  const hasPrevious = Number.isInteger(previous) && previous >= minimum && previous <= maximum;
  const available = range - Number(hasPrevious);
  const choice = Math.max(0, Math.min(0.999999999999, Number(random()) || 0));
  let offset = Math.floor(choice * available);
  if (hasPrevious && offset >= previous - minimum) offset += 1;
  return minimum + offset;
}

export function createSlotReelMotion(grid, columns, {
  targetGrid = grid,
  startedAt = 0,
  duration = 1850,
  stagger = 115,
  random = Math.random,
  reducedMotion = false,
  previousSpinRows = {},
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
      const travelRows = chooseTravelRows(column, random, previousSpinRows, reducedMotion);
      const start = Array.from({ length: SLOT_REEL_ROWS }, (_, row) => currentGrid[row * SLOT_REEL_COLUMNS + column]);
      const stop = Array.from({ length: travelRows }, () => randomSymbol(random));
      const target = start.map((_, row) => settledGrid[row * SLOT_REEL_COLUMNS + column]);
      return {
        column,
        delay: order * safeStagger,
        duration: reducedMotion ? Math.min(safeDuration, 360) : safeDuration,
        travelRows,
        start,
        stop,
        target,
        strip: [...start, ...stop, ...target],
        targetOffset: SLOT_REEL_ROWS + travelRows,
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

