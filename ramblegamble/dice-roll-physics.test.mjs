import test from "node:test";
import assert from "node:assert/strict";
import {
  createDiceFlightState,
  DICE_FLIGHT_DURATION,
  DICE_FLIGHT_STEP,
  DICE_SETTLE_DURATION,
  stepDiceFlight,
} from "./dice-roll-physics.mjs";

function constantRandom(value = 0.5) {
  return () => value;
}

test("a throw rises, tumbles on multiple axes, bounces, and settles on the floor", () => {
  const flight = createDiceFlightState({ origin: [-1.4, 0.08, 0], lane: -1, random: constantRandom(0.6) });
  const initialSpin = { ...flight.angularVelocity };
  let highestPoint = flight.position.y;

  for (let elapsed = 0; elapsed < DICE_FLIGHT_DURATION; elapsed += DICE_FLIGHT_STEP) {
    stepDiceFlight(flight, DICE_FLIGHT_STEP);
    highestPoint = Math.max(highestPoint, flight.position.y);
    assert.ok(flight.position.y >= 0, "the simulated die must not tunnel below the floor");
  }

  assert.ok(highestPoint > 0.5, "the launch should have a visible arc without throwing the die out of frame");
  assert.ok(Math.abs(initialSpin.x) > 1 && Math.abs(initialSpin.y) > 1 && Math.abs(initialSpin.z) > 1);
  assert.ok(flight.bounceCount >= 1, "the die should visibly rebound at least once");
  assert.equal(flight.landed, true);
  assert.equal(flight.position.y, 0);
  assert.ok(flight.elapsed >= DICE_FLIGHT_DURATION - DICE_FLIGHT_STEP);
  assert.ok(Number.isFinite(flight.position.x) && Number.isFinite(flight.position.z));
});

test("identical random inputs produce repeatable throw trajectories", () => {
  const first = createDiceFlightState({ origin: [1.4, 0, 0], lane: 1, random: constantRandom(0.3) });
  const second = createDiceFlightState({ origin: [1.4, 0, 0], lane: 1, random: constantRandom(0.3) });
  for (let i = 0; i < 180; i += 1) {
    stepDiceFlight(first, DICE_FLIGHT_STEP);
    stepDiceFlight(second, DICE_FLIGHT_STEP);
  }
  assert.deepEqual(first, second);
});

test("fixed-step motion stays consistent when frames arrive at different rates", () => {
  const at120Hz = createDiceFlightState({ origin: [0, 0.08, 0], lane: -1, random: constantRandom(0.72) });
  const at60Hz = createDiceFlightState({ origin: [0, 0.08, 0], lane: -1, random: constantRandom(0.72) });
  for (let i = 0; i < 162; i += 1) stepDiceFlight(at120Hz, DICE_FLIGHT_STEP);
  for (let i = 0; i < 81; i += 1) stepDiceFlight(at60Hz, DICE_FLIGHT_STEP * 2);
  for (const key of ["x", "y", "z"]) {
    assert.ok(Math.abs(at120Hz.position[key] - at60Hz.position[key]) < 1e-8);
    assert.ok(Math.abs(at120Hz.velocity[key] - at60Hz.velocity[key]) < 1e-8);
  }
  assert.equal(at120Hz.bounceCount, at60Hz.bounceCount);
  assert.equal(at120Hz.landed, at60Hz.landed);
});

test("the complete toss has a deliberate flight and settle phase", () => {
  assert.ok(DICE_FLIGHT_DURATION > 1);
  assert.ok(DICE_SETTLE_DURATION >= 0.5);
});

test("flight setup and stepping reject invalid inputs", () => {
  assert.throws(() => createDiceFlightState({ origin: [0, 0], lane: 1 }), /three-value/);
  assert.throws(() => createDiceFlightState({ origin: [0, 0, 0], lane: 0 }), /lane/);
  assert.throws(() => createDiceFlightState({ origin: [0, 0, 0], lane: 1, random: () => 2 }), /between zero and one/);
  const flight = createDiceFlightState({ origin: [0, 0, 0], lane: -1 });
  assert.throws(() => stepDiceFlight(flight, -0.1), /non-negative/);
  assert.throws(() => stepDiceFlight(flight, Number.NaN), /non-negative/);
});
