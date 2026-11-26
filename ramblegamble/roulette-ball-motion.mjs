// Geometry values are in the supplied rg_roulette.gltf model's local units.
export const ROULETTE_BALL_COLOR = 0x212068; // sampled from stage.png's dark floor checker
export const ROULETTE_BALL_TRACK_RADIUS = Math.hypot(13, 1); // authored ball offset (-13, 1)
export const ROULETTE_BALL_LANDING_RADIUS = 11.25;
export const ROULETTE_BALL_GEOMETRY_RADIUS = 0.84; // maximum vertex radius in the supplied ball mesh
export const ROULETTE_INNER_YELLOW_RING = Object.freeze({ innerRadius: 10.034, outerRadius: 12.50 });

// Wheel group y=-3.3; yellow pocket floor local y=1.1; ball group y=7.3.
// Add the actual mesh radius so the ball rests on the floor, not above or inside it.
export const ROULETTE_BALL_LANDING_HEIGHT = -3.3 + 1.1 + ROULETTE_BALL_GEOMETRY_RADIUS - 7.3;
export const ROULETTE_BALL_TRACK_HEIGHT = -3.3 + 2.6 + ROULETTE_BALL_GEOMETRY_RADIUS - 7.3;

const OUTWARD_RAMP_END = 0.12;
const INWARD_SETTLE_START = 0.76;

function clamp01(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function rouletteBallPositionAtRadius(position, radius) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) return null;
  if (!Number.isFinite(radius) || radius < 0) return null;

  const currentRadius = Math.hypot(position.x, position.z);
  if (currentRadius < 1e-6) return null;
  const scale = radius / currentRadius;
  return { x: position.x * scale, y: position.y, z: position.z * scale };
}

export function sampleRouletteBallRadius(progress, startingRadius = ROULETTE_BALL_TRACK_RADIUS) {
  const t = clamp01(progress);
  const startRadius = Number.isFinite(startingRadius) && startingRadius >= 0
    ? startingRadius
    : ROULETTE_BALL_TRACK_RADIUS;

  // If a previous spin left the ball in the inner ring, lift it back out to
  // the outer race before the long orbit; then ease it inward to its landing.
  if (t < OUTWARD_RAMP_END) {
    const ramp = smoothstep(t / OUTWARD_RAMP_END);
    return startRadius + (ROULETTE_BALL_TRACK_RADIUS - startRadius) * ramp;
  }
  if (t < INWARD_SETTLE_START) return ROULETTE_BALL_TRACK_RADIUS;

  const settle = smoothstep((t - INWARD_SETTLE_START) / (1 - INWARD_SETTLE_START));
  return ROULETTE_BALL_TRACK_RADIUS
    + (ROULETTE_BALL_LANDING_RADIUS - ROULETTE_BALL_TRACK_RADIUS) * settle;
}

export function sampleRouletteBallHeight(progress, startingHeight = ROULETTE_BALL_LANDING_HEIGHT) {
  const t = clamp01(progress);
  if (t < OUTWARD_RAMP_END) return startingHeight + (ROULETTE_BALL_TRACK_HEIGHT - startingHeight) * smoothstep(t / OUTWARD_RAMP_END);
  if (t < INWARD_SETTLE_START) return ROULETTE_BALL_TRACK_HEIGHT;
  return ROULETTE_BALL_TRACK_HEIGHT + (ROULETTE_BALL_LANDING_HEIGHT - ROULETTE_BALL_TRACK_HEIGHT) * smoothstep((t - INWARD_SETTLE_START) / (1 - INWARD_SETTLE_START));
}

export const ROULETTE_POCKET_COUNT = 38;
// Mesh boundary at +0.1° in local X/Z is cancelled by the wheel mesh's
// +0.1° Y rotation. Relative to the wheel pivot, boundary zero is +X.
export function alignBallToPocket(ballRotation, wheelRotation, ballLocalAngle) {
  const sector = Math.PI * 2 / ROULETTE_POCKET_COUNT;
  const relativeAngle = ballLocalAngle - ballRotation + wheelRotation;
  const nearestCenter = (Math.floor(relativeAngle / sector) + 0.5) * sector;
  return ballRotation + relativeAngle - nearestCenter;
}
