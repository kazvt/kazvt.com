const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function finiteCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeComposePlacements(placements, items) {
  if (!Array.isArray(placements) || !Array.isArray(items)) return [];
  return placements.flatMap((placement) => {
    if (!placement || typeof placement !== "object") return [];
    const itemIndex = Number(placement.itemIndex ?? placement.item ?? placement.typeIndex);
    const x = finiteCoordinate(placement.x);
    const y = finiteCoordinate(placement.y);
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length || x == null || y == null) return [];
    return [{ itemIndex, x: clamp(x, 0, 100), y: clamp(y, 0, 100) }];
  });
}

export function migrateLegacyComposePlacements(items) {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, itemIndex) => {
    if (!item || typeof item !== "object") return [];
    const x = finiteCoordinate(item.x);
    const y = finiteCoordinate(item.y);
    const defaultX = 8 + (itemIndex % 5) * 18;
    const defaultY = 8 + (Math.floor(itemIndex / 5) % 4) * 18;
    if (x == null || y == null || (Math.abs(x - defaultX) < 0.01 && Math.abs(y - defaultY) < 0.01)) return [];
    return [{ itemIndex, x: clamp(x, 0, 100), y: clamp(y, 0, 100) }];
  });
}

export function snapComposePlacement(pointerX, pointerY, width, height, gridSize = 0, pieceSize = 32) {
  const imageWidth = Math.max(1, finiteCoordinate(width) || 1);
  const imageHeight = Math.max(1, finiteCoordinate(height) || 1);
  const size = Math.max(1, Math.min(finiteCoordinate(pieceSize) || 32, imageWidth, imageHeight));
  const grid = Math.max(0, finiteCoordinate(gridSize) || 0);
  let left = clamp((finiteCoordinate(pointerX) ?? imageWidth / 2) - size / 2, 0, imageWidth - size);
  let top = clamp((finiteCoordinate(pointerY) ?? imageHeight / 2) - size / 2, 0, imageHeight - size);
  if (grid > 0) {
    left = clamp(Math.round(left / grid) * grid, 0, Math.floor((imageWidth - size) / grid) * grid);
    top = clamp(Math.round(top / grid) * grid, 0, Math.floor((imageHeight - size) / grid) * grid);
  }
  return { x: left / imageWidth * 100, y: top / imageHeight * 100 };
}
