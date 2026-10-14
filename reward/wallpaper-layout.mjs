export const WALLPAPER_ART_SIZE = 180;
export const WALLPAPER_MIN_SIZE = 64;
export const WALLPAPER_FILLER_SIZE = 128;
export const WALLPAPER_MEDIUM_SIZE = 96;

function boundRadiusFor(size) {
  return size * Math.SQRT1_2 * 1.02 + Math.SQRT2 * 3 + 5;
}

export const WALLPAPER_BOUND_RADIUS = boundRadiusFor(WALLPAPER_ART_SIZE);

const WORLD_WIDTH = 8192;
const WORLD_HEIGHT = 4096;
const CANDIDATE_TRIES = 40;

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

function canPlacePoint(x, y, grid, gridColumns, gridRows, cellSize, points, minimumDistance) {
  const cellColumn = Math.floor(x / cellSize);
  const cellRow = Math.floor(y / cellSize);
  const minimumDistanceSquared = minimumDistance ** 2;

  for (let row = Math.max(0, cellRow - 2); row <= Math.min(gridRows - 1, cellRow + 2); row += 1) {
    for (let column = Math.max(0, cellColumn - 2); column <= Math.min(gridColumns - 1, cellColumn + 2); column += 1) {
      const pointIndex = grid[row * gridColumns + column];
      if (pointIndex < 0) continue;
      const other = points[pointIndex];
      const dx = x - other.x;
      const dy = y - other.y;
      if (dx * dx + dy * dy < minimumDistanceSquared) return false;
    }
  }

  return true;
}

function createAnchorIndex(anchors = []) {
  const cellSize = WALLPAPER_BOUND_RADIUS * 2 + 4;
  const columns = Math.ceil(WORLD_WIDTH / cellSize);
  const cells = new Map();
  const cellKey = (column, row) => row * columns + column;

  function add(point) {
    const column = Math.floor(point.x / cellSize);
    const row = Math.floor(point.y / cellSize);
    const key = cellKey(column, row);
    const bucket = cells.get(key);
    if (bucket) bucket.push(point);
    else cells.set(key, [point]);
  }

  for (const anchor of anchors) add(anchor);

  return {
    add,
    isSeparated(point) {
      const column = Math.floor(point.x / cellSize);
      const row = Math.floor(point.y / cellSize);
      const reach = Math.ceil((point.radius + WALLPAPER_BOUND_RADIUS + 4) / cellSize);
      for (let nearbyRow = Math.max(0, row - reach); nearbyRow <= Math.min(Math.ceil(WORLD_HEIGHT / cellSize) - 1, row + reach); nearbyRow += 1) {
        for (let nearbyColumn = Math.max(0, column - reach); nearbyColumn <= Math.min(columns - 1, column + reach); nearbyColumn += 1) {
          const bucket = cells.get(cellKey(nearbyColumn, nearbyRow));
          if (!bucket) continue;
          for (const anchor of bucket) {
            const dx = point.x - anchor.x;
            const dy = point.y - anchor.y;
            const requiredDistance = point.radius + anchor.radius + 4;
            if (dx * dx + dy * dy < requiredDistance ** 2) return false;
          }
        }
      }
      return true;
    }
  };
}

function createSingleSizeLayout(seed, artSize, idOffset = 0) {
  const random = createSeededRandom(seed);
  const boundRadius = boundRadiusFor(artSize);
  const minimumDistance = boundRadius * 2 + 4;
  const cellSize = minimumDistance / Math.SQRT2;
  const gridColumns = Math.ceil(WORLD_WIDTH / cellSize);
  const gridRows = Math.ceil(WORLD_HEIGHT / cellSize);
  const grid = new Int32Array(gridColumns * gridRows);
  grid.fill(-1);

  const points = [];
  const active = [];
  const margin = boundRadius + 3;
  const addPoint = (x, y) => {
    const pointIndex = points.length;
    points.push({ x, y });
    active.push(pointIndex);
    const cellColumn = Math.floor(x / cellSize);
    const cellRow = Math.floor(y / cellSize);
    grid[cellRow * gridColumns + cellColumn] = pointIndex;
  };

  const startingPoint = createSeededRandom(seed ^ 0xa511e9b3);
  addPoint(
    margin + startingPoint() * (WORLD_WIDTH - margin * 2),
    margin + startingPoint() * (WORLD_HEIGHT - margin * 2)
  );
  while (active.length > 0) {
    const activeSlot = Math.floor(random() * active.length);
    const origin = points[active[activeSlot]];
    let foundNearbyPoint = false;

    for (let attempt = 0; attempt < CANDIDATE_TRIES; attempt += 1) {
      const angle = random() * Math.PI * 2;
      const distance = minimumDistance * (1 + random());
      const x = origin.x + Math.cos(angle) * distance;
      const y = origin.y + Math.sin(angle) * distance;
      if (x < margin || x > WORLD_WIDTH - margin || y < margin || y > WORLD_HEIGHT - margin) continue;
      if (!canPlacePoint(x, y, grid, gridColumns, gridRows, cellSize, points, minimumDistance)) continue;
      addPoint(x, y);
      foundNearbyPoint = true;
      break;
    }

    if (!foundNearbyPoint) {
      active[activeSlot] = active[active.length - 1];
      active.pop();
    }
  }

  return points.map(({ x, y }, id) => {
    const layoutId = id + idOffset;
    const variantSeed = (seed ^ Math.imul(layoutId + 1, 0x9e3779b1)) >>> 0;
    const variant = createSeededRandom(variantSeed);
    return {
      id: layoutId,
      x,
      y,
      size: artSize,
      radius: boundRadius,
      styleIndex: Math.floor(variant() * 12) + 1,
      spinDirection: variant() < 0.5 ? "wall-art-spin--clockwise" : "wall-art-spin--counterclockwise",
      angleJitter: Number((variant() * 16 - 8).toFixed(1)),
      driftX: variant() * 6 - 3,
      driftY: variant() * 6 - 3
    };
  });
}

function createJitteredSizeLayout(seed, artSize, idOffset, anchors) {
  const random = createSeededRandom(seed);
  const radius = boundRadiusFor(artSize);
  const minimumDistance = radius * 2 + 4;
  const spacing = minimumDistance * 1.12;
  const rowSpacing = spacing * Math.sqrt(3) / 2;
  const margin = radius + 3;
  const originX = margin + random() * spacing;
  const originY = margin + random() * rowSpacing;
  const candidates = [];

  for (let row = 0, y = originY; y <= WORLD_HEIGHT - margin; row += 1, y += rowSpacing) {
    const rowOffset = (row % 2) * spacing / 2 + (random() - 0.5) * spacing * 0.32;
    for (let x = originX + rowOffset; x <= WORLD_WIDTH - margin; x += spacing) {
      candidates.push({
        x: x + (random() - 0.5) * spacing * 0.32,
        y: y + (random() - 0.5) * rowSpacing * 0.32
      });
    }
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  const spatialIndex = createAnchorIndex(anchors);
  const points = [];
  for (const candidate of candidates) {
    if (candidate.x < margin || candidate.x > WORLD_WIDTH - margin ||
        candidate.y < margin || candidate.y > WORLD_HEIGHT - margin) continue;
    const id = idOffset + points.length;
    const variant = createSeededRandom((seed ^ Math.imul(id + 1, 0x9e3779b1)) >>> 0);
    const point = {
      id,
      ...candidate,
      size: artSize,
      radius,
      styleIndex: Math.floor(variant() * 12) + 1,
      spinDirection: variant() < 0.5 ? "wall-art-spin--clockwise" : "wall-art-spin--counterclockwise",
      angleJitter: Number((variant() * 16 - 8).toFixed(1)),
      driftX: variant() * 6 - 3,
      driftY: variant() * 6 - 3
    };
    if (!spatialIndex.isSeparated(point)) continue;
    spatialIndex.add(point);
    points.push(point);
  }

  return points;
}

export function createWallpaperLayout(seed) {
  const layers = [
    { size: WALLPAPER_ART_SIZE, salt: 0 },
    { size: WALLPAPER_FILLER_SIZE, salt: 0x85ebca6b },
    { size: WALLPAPER_MEDIUM_SIZE, salt: 0xc2b2ae35 },
    { size: WALLPAPER_MIN_SIZE, salt: 0x27d4eb2f },
    { size: WALLPAPER_MIN_SIZE, salt: 0x165667b1 },
    { size: WALLPAPER_MIN_SIZE, salt: 0xd3a2646c },
    { size: WALLPAPER_MIN_SIZE, salt: 0xfd7046c5 },
    { size: WALLPAPER_MIN_SIZE, salt: 0xb55a4f09 },
    { size: WALLPAPER_MIN_SIZE, salt: 0x0a21b5f3 },
    { size: WALLPAPER_MIN_SIZE, salt: 0x51f15e2d },
    { size: WALLPAPER_MIN_SIZE, salt: 0x9e3779b9 },
    { size: WALLPAPER_MIN_SIZE, salt: 0x7f4a7c15 },
    { size: WALLPAPER_MIN_SIZE, salt: 0x6a09e667 },
    { size: WALLPAPER_MIN_SIZE, salt: 0xbb67ae85 },
    { size: WALLPAPER_MIN_SIZE, salt: 0x3c6ef372 },
    { size: WALLPAPER_MIN_SIZE, salt: 0xa54ff53a }
  ];
  const primary = createSingleSizeLayout(seed, WALLPAPER_ART_SIZE);
  const layout = primary.filter(point => point.id % 5 < 2);
  let nextId = 0;

  nextId = primary.length;
  for (const layer of layers.slice(1)) {
    const layerSeed = (seed ^ layer.salt) >>> 0;
    const points = createJitteredSizeLayout(layerSeed, layer.size, nextId, layout);
    layout.push(...points);
    nextId += points.length;
  }

  return layout;
}

export function wallpaperPointsForViewport(layout, width, height, zoomCompensation = 1) {
  if (!Array.isArray(layout) || !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(height) || height <= 0) return [];
  const scale = Number.isFinite(zoomCompensation) && zoomCompensation > 0 ? zoomCompensation : 1;
  const physicalWidth = width / scale;
  const physicalHeight = height / scale;

  return layout
    .filter(point => point.x + point.radius >= 0 && point.x - point.radius <= physicalWidth &&
      point.y + point.radius >= 0 && point.y - point.radius <= physicalHeight)
    .map(point => ({
      ...point,
      x: point.x * scale,
      y: point.y * scale,
      size: point.size * scale,
      radius: point.radius * scale,
      driftX: `${(point.driftX * scale).toFixed(2)}px`,
      driftY: `${(point.driftY * scale).toFixed(2)}px`
    }));
}
