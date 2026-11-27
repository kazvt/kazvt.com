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

test("the ball uses the lighter violet presentation color", () => {
  assert.equal(ROULETTE_BALL_COLOR, 0x8260c4);
});

test("invalid orbit positions and radii are rejected without producing non-finite coordinates", () => {
  assert.equal(rouletteBallPositionAtRadius({ x: 0, y: 0, z: 0 }, 8), null);
  assert.equal(rouletteBallPositionAtRadius({ x: 1, y: 0, z: 0 }, -1), null);
  assert.equal(rouletteBallPositionAtRadius({ x: Infinity, y: 0, z: 0 }, 8), null);
  assert.equal(sampleRouletteBallRadius(NaN), ROULETTE_BALL_TRACK_RADIUS);
});

test('ball descends from track to actual yellow pocket floor with mesh-radius clearance', async () => {
  const { ROULETTE_BALL_LANDING_HEIGHT, ROULETTE_BALL_TRACK_HEIGHT, sampleRouletteBallHeight } = await import('./roulette-ball-motion.mjs');
  assert.ok(Math.abs(ROULETTE_BALL_LANDING_HEIGHT + 7.3 - 0.84 - (-3.3 + 1.1)) < 1e-9);
  assert.equal(sampleRouletteBallHeight(0), ROULETTE_BALL_LANDING_HEIGHT);
  assert.equal(sampleRouletteBallHeight(.5), ROULETTE_BALL_TRACK_HEIGHT);
  assert.equal(sampleRouletteBallHeight(1), ROULETTE_BALL_LANDING_HEIGHT);
});

test('landing angle is centered between actual 38 pocket boundaries at arbitrary wheel orientations', async () => {
  const { alignBallToPocket, ROULETTE_POCKET_COUNT } = await import('./roulette-ball-motion.mjs');
  const sector = Math.PI * 2 / ROULETTE_POCKET_COUNT;
  for (const wheel of [0, 3.1, 35, -12]) for (const ball of [0, 2, -70, 100]) {
    const angle = Math.atan2(1,-13);
    const adjusted = alignBallToPocket(ball,wheel,angle);
    assert.ok(Math.abs(adjusted-ball) <= sector/2+1e-9);
    const pocket = (angle-adjusted+wheel)/sector;
    assert.ok(Math.abs(pocket-Math.floor(pocket)-.5) < 1e-9);
  }
});
