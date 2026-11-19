export const DICE_DOOR_OPENING = Object.freeze({
  // The Dice entrance is the pink dice-framed opening on the room's right wall.
  // This is the exact two-triangle purple backing panel in the supplied GLTF.
  wallX: 16.764,
  interactionOffset: 0.025,
  minY: 0,
  maxY: 2.032,
  minZ: -2.4384,
  maxZ: -1.4224,
  tolerance: 0.002,
});

export function isDiceDoorBackingTriangle(points, opening = DICE_DOOR_OPENING) {
  if (!Array.isArray(points) || points.length !== 3) return false;
  const tolerance = opening.tolerance ?? 0.002;
  const insideOpening = points.every(({ x, y, z }) =>
    Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
      && Math.abs(x - opening.wallX) <= tolerance
      && y >= opening.minY - tolerance
      && y <= opening.maxY + tolerance
      && z >= opening.minZ - tolerance
      && z <= opening.maxZ + tolerance
  );
  if (!insideOpening) return false;

  // Ignore zero-area seam triangles along the jambs; only remove real backing
  // surface, not the dice-frame edges that share its boundary coordinates.
  const [a, b, c] = points;
  const doubleArea = Math.abs(
    (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y),
  );
  return doubleArea > tolerance * tolerance;
}
