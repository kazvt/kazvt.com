export const DICE_DOOR_OPENING = Object.freeze({
  // Measured from the supplied stage model: remove the purple back skin inside
  // the existing dice frame while keeping its jambs, sill, and lintel intact.
  minX: 14.478,
  maxX: 16.8265,
  minY: 0.4572,
  maxY: 2.5908,
  wallZ: -6.1585,
  tolerance: 0.002,
});

export function isDiceDoorBackingTriangle(points, opening = DICE_DOOR_OPENING) {
  if (!Array.isArray(points) || points.length !== 3) return false;
  const tolerance = opening.tolerance ?? 0.002;
  return points.every(({ x, y, z }) =>
    Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
      && Math.abs(z - opening.wallZ) <= tolerance
      && x >= opening.minX - tolerance
      && x <= opening.maxX + tolerance
      && y >= opening.minY - tolerance
      && y <= opening.maxY + tolerance
  );
}
