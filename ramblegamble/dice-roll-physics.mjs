export const DICE_FLIGHT_STEP = 1 / 120;
export const DICE_FLIGHT_DURATION = 1.35;
export const DICE_SETTLE_DURATION = 0.72;

const GRAVITY = 19.2;
const BOUNCE_RESTITUTION = 0.44;
const REST_BOUNCE_SPEED = 0.75;

function sample(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("The random sample must be between zero and one.");
  }
  return value;
}

function signedRandom(random) {
  return sample(random) * 2 - 1;
}

function validateVector(vector, name) {
  if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(Number.isFinite)) {
    throw new TypeError(`${name} must be a finite three-value position.`);
  }
}

export function createDiceFlightState({ origin, lane, random = Math.random } = {}) {
  validateVector(origin, "origin");
  if (lane !== -1 && lane !== 1) throw new RangeError("lane must be -1 or 1.");
  if (typeof random !== "function") throw new TypeError("random must be a function.");

  const spinDirection = sample(random) < 0.5 ? -1 : 1;
  return {
    elapsed: 0,
    position: { x: origin[0], y: Math.max(0, origin[1]), z: origin[2] },
    velocity: {
      x: lane * (0.8 + sample(random) * 0.9),
      y: 6.1 + sample(random) * 1.25,
      z: 0.45 + sample(random) * 0.85,
    },
    angularVelocity: {
      x: spinDirection * (9 + sample(random) * 7),
      y: signedRandom(random) * 8,
      z: -spinDirection * (8 + sample(random) * 8),
    },
    bounceCount: 0,
    landed: false,
  };
}

function stepFixed(state, delta) {
  const { position, velocity, angularVelocity } = state;
  state.elapsed += delta;

  if (state.landed) {
    const floorFriction = Math.exp(-5.2 * delta);
    const spinFriction = Math.exp(-4.4 * delta);
    velocity.x *= floorFriction;
    velocity.z *= floorFriction;
    angularVelocity.x *= spinFriction;
    angularVelocity.y *= spinFriction;
    angularVelocity.z *= spinFriction;
    position.x += velocity.x * delta;
    position.z += velocity.z * delta;
    position.y = 0;
    return;
  }

  velocity.y -= GRAVITY * delta;
  position.x += velocity.x * delta;
  position.y += velocity.y * delta;
  position.z += velocity.z * delta;

  const airDamping = Math.exp(-0.34 * delta);
  angularVelocity.x *= airDamping;
  angularVelocity.y *= airDamping;
  angularVelocity.z *= airDamping;

  if (position.y > 0) return;
  position.y = 0;

  if (velocity.y < -REST_BOUNCE_SPEED && state.bounceCount < 3) {
    velocity.y = -velocity.y * BOUNCE_RESTITUTION;
    velocity.x *= 0.8;
    velocity.z *= 0.8;
    angularVelocity.x = angularVelocity.x * 0.82 + velocity.z * 0.42;
    angularVelocity.z = angularVelocity.z * 0.82 - velocity.x * 0.42;
    angularVelocity.y *= 0.82;
    state.bounceCount += 1;
    return;
  }

  velocity.y = 0;
  velocity.x *= 0.5;
  velocity.z *= 0.5;
  angularVelocity.x *= 0.52;
  angularVelocity.y *= 0.52;
  angularVelocity.z *= 0.52;
  state.landed = true;
}

export function stepDiceFlight(state, deltaSeconds) {
  if (!state || typeof state !== "object") throw new TypeError("A dice flight state is required.");
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("deltaSeconds must be a finite non-negative number.");
  }

  let remaining = deltaSeconds;
  while (remaining > 1e-9) {
    const delta = Math.min(DICE_FLIGHT_STEP, remaining);
    stepFixed(state, delta);
    remaining -= delta;
  }
  return state;
}
