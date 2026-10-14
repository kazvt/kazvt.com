export const WALLPAPER_ART_SIZE = 210;
export const WALLPAPER_MIN_SIZE = 100;
export const WALLPAPER_FILLER_SIZE = 148;
export const WALLPAPER_MEDIUM_SIZE = 124;

function boundRadiusFor(size) {
  return size * Math.SQRT1_2 * 1.02 + Math.SQRT2 * 3 + 5;
}

export const WALLPAPER_BOUND_RADIUS = boundRadiusFor(WALLPAPER_ART_SIZE);

const WORLD_WIDTH = 16384;
const WORLD_HEIGHT = 8192;
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

function staysSeparated(point, anchors) {
  return anchors.every(anchor => {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const requiredDistance = point.radius + anchor.radius + 4;
    return dx * dx + dy * dy >= requiredDistance ** 2;
  });
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

export function createWallpaperLayout(seed) {
  const layers = [
    { size: WALLPAPER_ART_SIZE, salt: 0 },
    { size: WALLPAPER_FILLER_SIZE, salt: 0x85ebca6b },
    { size: WALLPAPER_MEDIUM_SIZE, salt: 0xc2b2ae35 },
    { size: WALLPAPER_MIN_SIZE, salt: 0x27d4eb2f },
    { size: WALLPAPER_MIN_SIZE, salt: 0x165667b1 },
    { size: WALLPAPER_MIN_SIZE, salt: 0xd3a2646c },
    { size: WALLPAPER_MIN_SIZE, salt: 0xfd7046c5 }
  ];
  const layout = [];
  let nextId = 0;

  for (const layer of layers) {
    const layerSeed = (seed ^ layer.salt) >>> 0;
    const candidates = createSingleSizeLayout(layerSeed, layer.size, nextId);
    layout.push(...candidates.filter(point => staysSeparated(point, layout)));
    nextId += candidates.length;
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
