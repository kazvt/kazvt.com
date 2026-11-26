import { normalizeSlotGrid, SLOT_REEL_COLUMNS, SLOT_REEL_ROWS, SLOT_REEL_SYMBOLS } from "./slot-reels.mjs";

const SIZE = SLOT_REEL_COLUMNS * SLOT_REEL_ROWS;
const OWNER_BY_BERRY = Object.freeze({
  faroeberry: "faroe",
  erinberry: "erin",
  kazberry: "kaz",
});

const cell = (column, row) => row * SLOT_REEL_COLUMNS + column;
const row = (rowIndex) => Array.from({ length: SLOT_REEL_COLUMNS }, (_, column) => cell(column, rowIndex));
const column = (columnIndex) => Array.from({ length: SLOT_REEL_ROWS }, (_, rowIndex) => cell(columnIndex, rowIndex));

// Each mask is read directly from the supplied 5x3 payout reference. Dark cells
// are wildcards; only the listed (yellow) cells must belong to the same berry.
export const SLOT_PAYOUT_PATTERNS = Object.freeze([
  { id: "left-column", points: 4000, cells: column(0) },
  { id: "top-row", points: 8000, cells: row(0) },
  { id: "middle-row", points: 10000, cells: row(1) },
  { id: "bottom-row", points: 8000, cells: row(2) },
  { id: "second-column", points: 5000, cells: column(1) },
  { id: "left-hook", points: 20000, cells: [...row(1), cell(0, 0), cell(0, 2)] },
  { id: "second-hook", points: 25000, cells: [...row(1), cell(1, 0), cell(1, 2)] },
  { id: "center-hook", points: 30000, cells: [...row(1), cell(2, 0), cell(2, 2)] },
  { id: "center-column", points: 6000, cells: column(2) },
  { id: "fourth-hook", points: 25000, cells: [...row(1), cell(3, 0), cell(3, 2)] },
  { id: "right-hook", points: 20000, cells: [...row(1), cell(4, 0), cell(4, 2)] },
  { id: "corner-cross", points: 50000, cells: [cell(0, 0), cell(4, 0), cell(1, 1), cell(2, 1), cell(3, 1), cell(0, 2), cell(4, 2)] },
  { id: "fourth-column", points: 5000, cells: column(3) },
  { id: "diamond", points: 75000, cells: [cell(1, 0), cell(2, 0), cell(3, 0), cell(0, 1), cell(2, 1), cell(4, 1), cell(1, 2), cell(2, 2), cell(3, 2)] },
  { id: "hourglass", points: 60000, cells: [cell(0, 0), cell(2, 0), cell(4, 0), cell(1, 1), cell(2, 1), cell(3, 1), cell(0, 2), cell(2, 2), cell(4, 2)] },
  { id: "crown", points: 50000, cells: [0, 1, 2, 3, 4, cell(1, 1), cell(2, 1), cell(3, 1), cell(0, 2), cell(4, 2)] },
].map((pattern) => Object.freeze({ ...pattern, cells: Object.freeze([...new Set(pattern.cells)]) })));

export function secureRandomIndex(maximum, cryptoSource = globalThis.crypto, fallback = Math.random) {
  const max = Math.floor(Number(maximum));
  if (!Number.isSafeInteger(max) || max < 1) return -1;
  if (max === 1) return 0;

  if (cryptoSource?.getRandomValues && max <= 0x100000000) {
    const range = 0x100000000;
    const limit = Math.floor(range / max) * max;
    const word = new Uint32Array(1);
    do { cryptoSource.getRandomValues(word); } while (word[0] >= limit);
    return word[0] % max;
  }
  return Math.min(max - 1, Math.floor(Math.max(0, Math.min(0.9999999999999999, Number(fallback()) || 0)) * max));
}

export function placeSlotBerry(grid, berry, { axis = "column", index, randomIndex = secureRandomIndex } = {}) {
  const current = normalizeSlotGrid(grid);
  if (!SLOT_REEL_SYMBOLS.includes(berry)) return { grid: current, placedIndex: -1, eligibleIndexes: [] };
  const lineIndex = Number(index);
  const cells = axis === "row"
    ? (Number.isInteger(lineIndex) && lineIndex >= 0 && lineIndex < SLOT_REEL_ROWS ? row(lineIndex) : [])
    : axis === "column"
      ? (Number.isInteger(lineIndex) && lineIndex >= 0 && lineIndex < SLOT_REEL_COLUMNS ? column(lineIndex) : [])
      : [];
  const eligibleIndexes = cells.filter((cellIndex) => current[cellIndex] !== berry);
  if (!eligibleIndexes.length) return { grid: current, placedIndex: -1, eligibleIndexes };
  const choice = Number(randomIndex(eligibleIndexes.length));
  const chosenOffset = Number.isInteger(choice) && choice >= 0 && choice < eligibleIndexes.length ? choice : 0;
  const placedIndex = eligibleIndexes[chosenOffset];
  const next = current.slice();
  next[placedIndex] = berry;
  return { grid: next, placedIndex, eligibleIndexes };
}

export function rotateSlotColumns(grid, columns, { randomIndex = secureRandomIndex } = {}) {
  const next = normalizeSlotGrid(grid);
  const uniqueColumns = [...new Set((Array.isArray(columns) ? columns : [columns])
    .map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value < SLOT_REEL_COLUMNS))];
  const rotations = {};
  for (const columnIndex of uniqueColumns) {
    const shift = 1 + Math.max(0, Math.min(SLOT_REEL_ROWS - 2, Number(randomIndex(SLOT_REEL_ROWS - 1)) || 0));
    rotations[columnIndex] = shift;
    const original = Array.from({ length: SLOT_REEL_ROWS }, (_, rowIndex) => next[cell(columnIndex, rowIndex)]);
    for (let rowIndex = 0; rowIndex < SLOT_REEL_ROWS; rowIndex += 1) {
      next[cell(columnIndex, (rowIndex + shift) % SLOT_REEL_ROWS)] = original[rowIndex];
    }
  }
  return { grid: next, rotations };
}

export function findSlotPayouts(grid) {
  const board = normalizeSlotGrid(grid);
  const wins = [];
  for (const berry of SLOT_REEL_SYMBOLS) {
    for (const pattern of SLOT_PAYOUT_PATTERNS) {
      if (pattern.cells.every((index) => board[index] === berry)) {
        wins.push({ owner: OWNER_BY_BERRY[berry], berry, patternId: pattern.id, points: pattern.points, cells: [...pattern.cells] });
      }
    }
  }
  return wins;
}

export function resolveSlotPayouts(grid) {
  const wins = findSlotPayouts(grid);
  const clearedCells = [...new Set(wins.flatMap((win) => win.cells))].sort((a, b) => a - b);
  const next = normalizeSlotGrid(grid);
  for (const index of clearedCells) next[index] = null;
  const totals = Object.fromEntries(Object.values(OWNER_BY_BERRY).map((owner) => [owner, 0]));
  for (const win of wins) totals[win.owner] += win.points;
  return { grid: next, payouts: wins, totals, clearedCells };
}

export function normalizeSlotGameGrid(value) {
  return normalizeSlotGrid(value).slice(0, SIZE);
}
