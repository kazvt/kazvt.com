import test from "node:test";
import assert from "node:assert/strict";
import {
  createDiceThrow,
  DICE_PHYSICS_FIXED_STEP,
  DICE_PHYSICS_MAX_SUBSTEPS,
  getBoxHalfExtentAlongWorldY,
  getUpwardFaceIndex,
  stepDicePhysics,
} from "./dice-roll-physics.mjs";
import { DICE_FACE_ORDER } from "./dice-game-state.mjs";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test("throws begin above the table with downward momentum and genuine angular momentum", () => {
  const launch = createDiceThrow({ restPosition: [-1.4, 1.18, 0], lane: -1, random: seededRandom(12) });
  assert.ok(launch.position[1] > 1.18);
  assert.ok(launch.velocity[1] < 0);
  assert.ok(Math.hypot(...launch.angularVelocity) > 8);
  assert.ok(Math.abs(Math.hypot(...launch.quaternion) - 1) < 1e-12);
  assert.equal("result" in launch, false);
  assert.equal("target" in launch, false);
});

test("identical random launches are repeatable without preselecting an outcome", () => {
  const first = createDiceThrow({ restPosition: [1.4, 1.18, 0], lane: 1, random: seededRandom(42) });
  const second = createDiceThrow({ restPosition: [1.4, 1.18, 0], lane: 1, random: seededRandom(42) });
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, createDiceThrow({ restPosition: [1.4, 1.18, 0], lane: 1, random: seededRandom(43) }));
});

test("reduced-motion throws still use physics, but with a shorter drop and less spin", () => {
  const random = seededRandom(79);
  const normal = createDiceThrow({ restPosition: [0, 1.18, 0], lane: -1, random });
  const reduced = createDiceThrow({ restPosition: [0, 1.18, 0], lane: -1, random: seededRandom(79), reducedMotion: true });
  assert.ok(reduced.position[1] < normal.position[1]);
  assert.ok(Math.hypot(...reduced.angularVelocity) < Math.hypot(...normal.angularVelocity));
  assert.ok(reduced.velocity[1] < 0);
});

test("the upward sticker is read from the simulated quaternion for all six sides", () => {
  const half = Math.SQRT1_2;
  const cases = [
    [[0, 0, 0, 1], "top"],
    [[1, 0, 0, 0], "bottom"],
    [[-half, 0, 0, half], "front"],
    [[half, 0, 0, half], "back"],
    [[0, 0, half, half], "right"],
    [[0, 0, -half, half], "left"],
  ];
  for (const [quaternion, faceId] of cases) {
    const index = getUpwardFaceIndex(quaternion, DICE_FACE_ORDER);
    assert.equal(DICE_FACE_ORDER[index].id, faceId);
  }
});

test("support height follows the actual body orientation instead of forcing a pose", () => {
  const half = Math.SQRT1_2;
  assert.equal(getBoxHalfExtentAlongWorldY([0, 0, 0, 1], [1, 2, 3]), 2);
  assert.ok(Math.abs(getBoxHalfExtentAlongWorldY([-half, 0, 0, half], [1, 2, 3]) - 3) < 1e-12);
});

test("physics uses a fixed step and caps substeps after a long frame", () => {
  const calls = [];
  const world = { step: (...args) => calls.push(args) };
  stepDicePhysics(world, 1);
  assert.deepEqual(calls, [[DICE_PHYSICS_FIXED_STEP, DICE_PHYSICS_FIXED_STEP * DICE_PHYSICS_MAX_SUBSTEPS, DICE_PHYSICS_MAX_SUBSTEPS]]);
});

test("throw setup rejects invalid inputs and degenerate orientations", () => {
  assert.throws(() => createDiceThrow({ restPosition: [0, 1], lane: -1 }), /three-value/);
  assert.throws(() => createDiceThrow({ restPosition: [0, 1, 0], lane: 0 }), /lane/);
  assert.throws(() => createDiceThrow({ restPosition: [0, 1, 0], lane: -1, random: () => 1 }), /\[0, 1\)/);
  assert.throws(() => getUpwardFaceIndex([0, 0, 0, 0], DICE_FACE_ORDER), /non-zero/);
  assert.throws(() => stepDicePhysics({ step() {} }, -0.1), /non-negative/);
});
