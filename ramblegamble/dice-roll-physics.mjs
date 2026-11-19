export const DICE_PHYSICS_FIXED_STEP = 1 / 120;
export const DICE_PHYSICS_MAX_SUBSTEPS = 10;

const GRAVITY = 9.81;
const TAU = Math.PI * 2;

function unitSample(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("A random sample must be in the range [0, 1).");
  }
  return value;
}

function signedSample(random) {
  return unitSample(random) * 2 - 1;
}

function validateVector(vector, name) {
  if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(Number.isFinite)) {
    throw new TypeError(`${name} must be a finite three-value vector.`);
  }
}

function randomUnitQuaternion(random) {
  // Shoemake's construction samples orientations uniformly over SO(3).
  const u1 = unitSample(random);
  const u2 = unitSample(random);
  const u3 = unitSample(random);
  const rootOneMinusU1 = Math.sqrt(1 - u1);
  const rootU1 = Math.sqrt(u1);
  return [
    rootOneMinusU1 * Math.sin(TAU * u2),
    rootOneMinusU1 * Math.cos(TAU * u2),
    rootU1 * Math.sin(TAU * u3),
    rootU1 * Math.cos(TAU * u3),
  ];
}

export function createDiceThrow({ restPosition, lane, random = Math.random, reducedMotion = false } = {}) {
  validateVector(restPosition, "restPosition");
  if (lane !== -1 && lane !== 1) throw new RangeError("lane must be -1 or 1.");
  if (typeof random !== "function") throw new TypeError("random must be a function.");

  const lowMotion = Boolean(reducedMotion);
  const inward = -lane;
  const height = lowMotion ? 1.2 : 1.65 + unitSample(random) * 0.25;
  const position = [
    restPosition[0] + lane * (lowMotion ? 0.18 : 0.42) + signedSample(random) * (lowMotion ? 0.08 : 0.16),
    restPosition[1] + height,
    restPosition[2] + signedSample(random) * (lowMotion ? 0.12 : 0.32),
  ];
  const velocity = [
    inward * (lowMotion ? 0.22 + unitSample(random) * 0.25 : 0.45 + unitSample(random) * 0.75) + signedSample(random) * 0.16,
    -(lowMotion ? 0.35 + unitSample(random) * 0.25 : 0.65 + unitSample(random) * 0.6),
    signedSample(random) * (lowMotion ? 0.18 + unitSample(random) * 0.18 : 0.35 + unitSample(random) * 0.6),
  ];

  const spinAxisY = signedSample(random);
  const spinAngle = unitSample(random) * TAU;
  const spinAxisRadius = Math.sqrt(1 - spinAxisY * spinAxisY);
  const spinSpeed = lowMotion ? 3.6 + unitSample(random) * 2.4 : 8 + unitSample(random) * 5.5;
  const angularVelocity = [
    spinAxisRadius * Math.cos(spinAngle) * spinSpeed,
    spinAxisY * spinSpeed,
    spinAxisRadius * Math.sin(spinAngle) * spinSpeed,
  ];

  return Object.freeze({
    position: Object.freeze(position),
    quaternion: Object.freeze(randomUnitQuaternion(random)),
    velocity: Object.freeze(velocity),
    angularVelocity: Object.freeze(angularVelocity),
  });
}

function rotateVector(quaternion, vector) {
  const [qx, qy, qz, qw] = quaternion;
  const [vx, vy, vz] = vector;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ];
}

function normalizedQuaternion(quaternion) {
  const values = Array.isArray(quaternion)
    ? quaternion
    : [quaternion?.x, quaternion?.y, quaternion?.z, quaternion?.w];
  if (values.length !== 4 || !values.every(Number.isFinite)) {
    throw new TypeError("quaternion must contain four finite values.");
  }
  const length = Math.hypot(...values);
  if (length < 1e-9) throw new RangeError("quaternion must have non-zero length.");
  return values.map((value) => value / length);
}

export function getUpwardFaceIndex(quaternion, faces) {
  if (!Array.isArray(faces) || faces.length === 0 || faces.some(({ normal }) => !Array.isArray(normal) || normal.length !== 3)) {
    throw new TypeError("faces must contain local three-value normals.");
  }

  const orientation = normalizedQuaternion(quaternion);
  let upwardIndex = 0;
  let highestUpDot = -Infinity;
  faces.forEach(({ normal }, index) => {
    const worldNormal = rotateVector(orientation, normal);
    if (worldNormal[1] > highestUpDot) {
      highestUpDot = worldNormal[1];
      upwardIndex = index;
    }
  });
  return upwardIndex;
}

export function getBoxHalfExtentAlongWorldY(quaternion, halfExtents) {
  validateVector(halfExtents, "halfExtents");
  if (halfExtents.some((value) => value <= 0)) throw new RangeError("halfExtents must be positive.");
  const orientation = normalizedQuaternion(quaternion);
  const worldYFromLocalX = rotateVector(orientation, [1, 0, 0])[1];
  const worldYFromLocalY = rotateVector(orientation, [0, 1, 0])[1];
  const worldYFromLocalZ = rotateVector(orientation, [0, 0, 1])[1];
  return Math.abs(worldYFromLocalX) * halfExtents[0]
    + Math.abs(worldYFromLocalY) * halfExtents[1]
    + Math.abs(worldYFromLocalZ) * halfExtents[2];
}

export function createDicePhysicsWorld(CANNON) {
  if (!CANNON?.World || !CANNON?.Body || !CANNON?.Plane || !CANNON?.Vec3) {
    throw new TypeError("A compatible cannon-es module is required.");
  }

  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -GRAVITY, 0),
    allowSleep: true,
  });
  world.allowSleep = true;
  world.solver.iterations = 18;
  world.solver.tolerance = 0.001;
  world.defaultContactMaterial.friction = 0.2;
  world.defaultContactMaterial.restitution = 0.18;
  world.defaultContactMaterial.contactEquationStiffness = 1e7;
  world.defaultContactMaterial.contactEquationRelaxation = 3;
  world.defaultContactMaterial.frictionEquationStiffness = 1e7;
  world.defaultContactMaterial.frictionEquationRelaxation = 3;

  const floor = new CANNON.Body({ mass: 0 });
  floor.addShape(new CANNON.Plane());
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  // Invisible tray rails keep high-energy throws in the visible roll area.
  const addRail = (halfExtents, position) => {
    const rail = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(...position) });
    rail.addShape(new CANNON.Box(new CANNON.Vec3(...halfExtents)));
    world.addBody(rail);
  };
  const wallHalfHeight = 3.6;
  const trayHalfWidth = 4.2;
  const trayHalfDepth = 2.8;
  addRail([0.12, wallHalfHeight, trayHalfDepth], [-trayHalfWidth, wallHalfHeight, 0]);
  addRail([0.12, wallHalfHeight, trayHalfDepth], [trayHalfWidth, wallHalfHeight, 0]);
  addRail([trayHalfWidth, wallHalfHeight, 0.12], [0, wallHalfHeight, -trayHalfDepth]);
  addRail([trayHalfWidth, wallHalfHeight, 0.12], [0, wallHalfHeight, trayHalfDepth]);

  return world;
}

export function createDiceBody(CANNON, world, halfExtents, position) {
  validateVector(halfExtents, "halfExtents");
  validateVector(position, "position");
  if (halfExtents.some((value) => value <= 0)) throw new RangeError("halfExtents must be positive.");

  const body = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(...position),
    allowSleep: true,
    sleepSpeedLimit: 0.11,
    sleepTimeLimit: 0.6,
    linearDamping: 0.018,
    angularDamping: 0.018,
  });
  body.addShape(new CANNON.Box(new CANNON.Vec3(...halfExtents)));
  world.addBody(body);
  return body;
}

export function prepareDiceBodyForThrow(CANNON, body, launch) {
  for (const key of ["position", "quaternion", "velocity", "angularVelocity"]) {
    if (!Array.isArray(launch?.[key]) || launch[key].some((value) => !Number.isFinite(value))) {
      throw new TypeError(`launch.${key} must contain finite values.`);
    }
  }
  if (launch.quaternion.length !== 4) throw new TypeError("launch.quaternion must contain four values.");

  body.position.set(...launch.position);
  body.quaternion.set(...launch.quaternion);
  body.velocity.set(...launch.velocity);
  body.angularVelocity.set(...launch.angularVelocity);
  body.force.set(0, 0, 0);
  body.torque.set(0, 0, 0);
  body.vlambda.set(0, 0, 0);
  body.wlambda.set(0, 0, 0);
  body.wakeUp();
  body.aabbNeedsUpdate = true;
  body.updateAABB();
  body.updateInertiaWorld(true);
  body.previousPosition.copy(body.position);
  body.interpolatedPosition.copy(body.position);
  body.previousQuaternion.copy(body.quaternion);
  body.interpolatedQuaternion.copy(body.quaternion);
  return body;
}

export function resizeDiceBody(body, halfExtents) {
  validateVector(halfExtents, "halfExtents");
  if (halfExtents.some((value) => value <= 0)) throw new RangeError("halfExtents must be positive.");
  const shape = body.shapes[0];
  if (!shape?.halfExtents || typeof shape.updateConvexPolyhedronRepresentation !== "function") {
    throw new TypeError("The dice body must use a cannon-es box shape.");
  }

  const current = [shape.halfExtents.x, shape.halfExtents.y, shape.halfExtents.z];
  const oldSupport = getBoxHalfExtentAlongWorldY(body.quaternion, current);
  const newSupport = getBoxHalfExtentAlongWorldY(body.quaternion, halfExtents);
  const isOnFloor = body.position.y - oldSupport <= 0.035;
  shape.halfExtents.set(...halfExtents);
  shape.updateConvexPolyhedronRepresentation();
  body.updateMassProperties();
  if (isOnFloor) body.position.y += newSupport - oldSupport;
  body.aabbNeedsUpdate = true;
  body.updateAABB();
  body.updateInertiaWorld(true);
  body.previousPosition.copy(body.position);
  body.interpolatedPosition.copy(body.position);
  return body;
}

export function stepDicePhysics(world, deltaSeconds) {
  if (!world || typeof world.step !== "function") throw new TypeError("A cannon-es world is required.");
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("deltaSeconds must be finite and non-negative.");
  }
  const maxFrameDelta = DICE_PHYSICS_FIXED_STEP * DICE_PHYSICS_MAX_SUBSTEPS;
  world.step(DICE_PHYSICS_FIXED_STEP, Math.min(deltaSeconds, maxFrameDelta), DICE_PHYSICS_MAX_SUBSTEPS);
  return world;
}
