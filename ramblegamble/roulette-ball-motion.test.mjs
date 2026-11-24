import test from "node:test";
import assert from "node:assert/strict";
import {
  ROULETTE_BALL_COLOR,
  ROULETTE_BALL_GEOMETRY_RADIUS,
  ROULETTE_BALL_LANDING_RADIUS,
  ROULETTE_BALL_TRACK_RADIUS,
  ROULETTE_INNER_YELLOW_RING,
  rouletteBallPositionAtRadius,
  sampleRouletteBallRadius,
} from "./roulette-ball-motion.mjs";

test("ball settles fully inside the wheel's inner yellow band, clear of the number ring", () => {
  assert.ok(ROULETTE_BALL_LANDING_RADIUS - ROULETTE_BALL_GEOMETRY_RADIUS > ROULETTE_INNER_YELLOW_RING.innerRadius);
  assert.ok(ROULETTE_BALL_LANDING_RADIUS + ROULETTE_BALL_GEOMETRY_RADIUS < ROULETTE_INNER_YELLOW_RING.outerRadius);
  assert.equal(sampleRouletteBallRadius(1), ROULETTE_BALL_LANDING_RADIUS);
});

test("the ball begins on the authored outer race and moves inward only as it settles", () => {
  assert.equal(ROULETTE_BALL_TRACK_RADIUS, Math.hypot(13, 1));
  assert.equal(sampleRouletteBallRadius(0), ROULETTE_BALL_TRACK_RADIUS);
  assert.equal(sampleRouletteBallRadius(0.5), ROULETTE_BALL_TRACK_RADIUS);
  assert.ok(sampleRouletteBallRadius(0.9) < ROULETTE_BALL_TRACK_RADIUS);
  assert.ok(sampleRouletteBallRadius(0.9) > ROULETTE_BALL_LANDING_RADIUS);
});

test("a new spin smoothly returns a settled ball to the outer race and preserves its height and angle", () => {
  const settled = rouletteBallPositionAtRadius({ x: -8.1, y: -7, z: 0.9 }, ROULETTE_BALL_LANDING_RADIUS);
  assert.ok(settled);
  assert.ok(Math.abs(Math.hypot(settled.x, settled.z) - ROULETTE_BALL_LANDING_RADIUS) < 1e-10);
  assert.equal(settled.y, -7);

  const startRadius = Math.hypot(settled.x, settled.z);
  assert.equal(sampleRouletteBallRadius(0, startRadius), startRadius);
  assert.ok(sampleRouletteBallRadius(0.12, startRadius) > startRadius);
  assert.equal(sampleRouletteBallRadius(0.12, startRadius), ROULETTE_BALL_TRACK_RADIUS);
});

test("the ball uses the exact dark checker color from the floor texture", () => {
  assert.equal(ROULETTE_BALL_COLOR, 0x212068);
});

test("invalid orbit positions and radii are rejected without producing non-finite coordinates", () => {
  assert.equal(rouletteBallPositionAtRadius({ x: 0, y: 0, z: 0 }, 8), null);
  assert.equal(rouletteBallPositionAtRadius({ x: 1, y: 0, z: 0 }, -1), null);
  assert.equal(rouletteBallPositionAtRadius({ x: Infinity, y: 0, z: 0 }, 8), null);
  assert.equal(sampleRouletteBallRadius(NaN), ROULETTE_BALL_TRACK_RADIUS);
});
