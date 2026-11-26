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

export function normalizeReelRows(rows) {
  const source = Array.isArray(rows) ? rows : [rows];
  return [...new Set(source.map(Number).filter((row) => (
    Number.isInteger(row) && row >= 0 && row < SLOT_REEL_ROWS
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

function chooseTravelDistance(lineIndex, random, previousTravel, reducedMotion) {
  const minimum = reducedMotion ? 2 : 12;
  const maximum = reducedMotion ? 5 : 32;
  const range = maximum - minimum + 1;
  const previous = Number(previousTravel?.[lineIndex]);
  const hasPrevious = Number.isInteger(previous) && previous >= minimum && previous <= maximum;
  const available = range - Number(hasPrevious);
  const choice = Math.max(0, Math.min(0.999999999999, Number(random()) || 0));
  let offset = Math.floor(choice * available);
  if (hasPrevious && offset >= previous - minimum) offset += 1;
  return minimum + offset;
}

// Placement keeps existing, unchanged icons physically parked. Empty cells
// can still scroll, so the animation does not telegraph the chosen landing
// cell. Never copy a parked icon (especially a wildcard) into the strip.
function reelStrip(start, stop, target, preserveUnchanged) {
  const movingPositions = start.flatMap((symbol, index) =>
    !preserveUnchanged || symbol === null || symbol !== target[index] ? [index] : []);
  const moving = new Set(movingPositions);
  return {
    movingPositions,
    strip: [...start.map((symbol, i) => moving.has(i) ? symbol : null), ...stop,
      ...target.map((symbol, i) => moving.has(i) ? symbol : null)],
  };
}

export function createSlotReelMotion(grid, columns, {
  targetGrid = grid,
  startedAt = 0,
  duration = 1850,
  stagger = 115,
  random = Math.random,
  reducedMotion = false,
  previousSpinRows = {},
  preserveUnchanged = false,
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
    reducedMotion,
    columns: activeColumns.map((column, order) => {
      const travelRows = chooseTravelDistance(column, random, previousSpinRows, reducedMotion);
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
        ...reelStrip(start, stop, target, preserveUnchanged),
        targetOffset: SLOT_REEL_ROWS + travelRows,
      };
    }),
    targetGrid: settledGrid,
  };
}

export function createSlotRowMotion(grid, rows, {
  targetGrid = grid,
  startedAt = 0,
  duration = 1850,
  stagger = 115,
  random = Math.random,
  reducedMotion = false,
  previousSpinColumns = {},
  preserveUnchanged = false,
} = {}) {
  const currentGrid = normalizeSlotGrid(grid);
  const settledGrid = normalizeSlotGrid(targetGrid);
  const activeRows = normalizeReelRows(rows);
  if (!activeRows.length) return null;
  const safeDuration = Math.max(0, Number(duration) || 0);
  const safeStagger = Math.max(0, Number(stagger) || 0);

  return {
    startedAt: Number(startedAt) || 0,
    grid: currentGrid,
    reducedMotion,
    columns: [],
    rows: activeRows.map((row, order) => {
      const travelColumns = chooseTravelDistance(row, random, previousSpinColumns, reducedMotion);
      const start = Array.from({ length: SLOT_REEL_COLUMNS }, (_, column) => currentGrid[row * SLOT_REEL_COLUMNS + column]);
      const stop = Array.from({ length: travelColumns }, () => randomSymbol(random));
      const target = start.map((_, column) => settledGrid[row * SLOT_REEL_COLUMNS + column]);
      return {
        row,
        delay: order * safeStagger,
        duration: reducedMotion ? Math.min(safeDuration, 360) : safeDuration,
        travelColumns,
        start,
        stop,
        target,
        ...reelStrip(start, stop, target, preserveUnchanged),
        targetOffset: SLOT_REEL_COLUMNS + travelColumns,
      };
    }),
    targetGrid: settledGrid,
  };
}

// A brief smooth acceleration, steady travel, and smooth braking. The
// integrated smoothstep velocity has no jump at either phase boundary.
function reelTravel(progress) {
  const acceleration = 0.08;
  const braking = 0.28;
  const brakeStart = 1 - braking;
  const area = 1 - (acceleration + braking) / 2;
  const smooth = (x) => x * x * (3 - 2 * x);
  const integral = (x) => x * x * x * (1 - x / 2);
  if (progress < acceleration) {
    const t = progress / acceleration;
    return { distance: acceleration * integral(t) / area, speed: smooth(t) / area };
  }
  if (progress < brakeStart) {
    return { distance: (progress - acceleration / 2) / area, speed: 1 / area };
  }
  const t = (progress - brakeStart) / braking;
  return {
    distance: (brakeStart - acceleration / 2 + braking * (t - integral(t))) / area,
    speed: (1 - smooth(t)) / area,
  };
}

function sampleLine(line, motion, time) {
  if (!line || !motion) return null;
  const elapsed = Number(time) - motion.startedAt - line.delay;
  if (elapsed < 0) return { offset: 0, symbols: line.start, spinning: true, velocity: 0 };
  if (line.duration <= 0 || elapsed >= line.duration) {
    return { offset: line.targetOffset, symbols: line.target, spinning: false, velocity: 0 };
  }
  if (elapsed === 0) return { offset: 0, symbols: line.start, spinning: true, velocity: 0 };
  const { distance, speed } = reelTravel(clamp01(elapsed / line.duration));
  return { offset: line.targetOffset * distance, symbols: null, spinning: true,
    velocity: line.targetOffset * speed / line.duration };
}

export function sampleSlotReelColumn(columnMotion, motion, time) {
  return sampleLine(columnMotion, motion, time);
}

export function sampleSlotReelRow(rowMotion, motion, time) {
  return sampleLine(rowMotion, motion, time);
}

// Velocity is measured in cells/ms, not per rendered frame. A centered
// exposure is limited to 0.85 cells and never samples past the real stops.
export function slotLineBlur(frame, line, reducedMotion = false) {
  if (reducedMotion || !frame?.spinning || frame.symbols || !(frame.velocity > 0)) return 0;
  return Math.max(0, Math.min(0.85, frame.velocity * 45,
    frame.offset * 2, (line.targetOffset - frame.offset) * 2));
}

// Keep the board snapshot immutable throughout a roll. A placement arrow
// changes one cell; occupied unchanged positions within the track are fixed.
export function slotMotionFrame(motion, time, reducedMotion = false) {
  const grid = motion.grid.slice();
  const lines = [];
  for (const [axis, tracks] of [["column", motion.columns], ["row", motion.rows || []]]) {
    for (const line of tracks) {
      const index = line[axis];
      const positions = line.movingPositions;
      if (!positions.length) continue;
      for (const position of positions) {
        grid[axis === "column" ? position * SLOT_REEL_COLUMNS + index : index * SLOT_REEL_COLUMNS + position] = null;
      }
      const frame = sampleLine(line, motion, time);
      lines.push({ axis, index, positions, line, frame,
        blur: slotLineBlur(frame, line, motion.reducedMotion || reducedMotion) });
    }
  }
  return { grid, lines };
}

// Explicit axis routing shared by the live UI and regression tests. No implicit
// column fallback for an invalid row request.
export function createSlotLineMotion(grid, { axis, indexes }, options = {}) {
  if (axis === "row") return createSlotRowMotion(grid, indexes, options);
  if (axis === "column") return createSlotReelMotion(grid, indexes, options);
  return null;
}
