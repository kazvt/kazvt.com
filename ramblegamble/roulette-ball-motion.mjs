// Geometry values are in the supplied rg_roulette.gltf model's local units.
export const ROULETTE_BALL_COLOR = 0x212068; // sampled from stage.png's dark floor checker
export const ROULETTE_BALL_TRACK_RADIUS = Math.hypot(13, 1); // authored ball offset (-13, 1)
export const ROULETTE_BALL_LANDING_RADIUS = 8.2;
export const ROULETTE_BALL_GEOMETRY_RADIUS = 0.84; // maximum vertex radius in the supplied ball mesh
export const ROULETTE_INNER_YELLOW_RING = Object.freeze({ innerRadius: 6, outerRadius: 10 });

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
