export const DICE_ASSET_CYCLE = Object.freeze([
  Object.freeze({ id: "blank", label: "Blank" }),
  Object.freeze({ id: "erinberry", label: "Erinberry" }),
  Object.freeze({ id: "faroeberry", label: "Faroeberry" }),
  Object.freeze({ id: "kazberry", label: "Kazberry" }),
]);

export const DICE_FACE_ORDER = Object.freeze([
  Object.freeze({ id: "top", label: "TOP", normal: Object.freeze([0, 1, 0]), rotation: Object.freeze([-Math.PI / 2, 0, 0]) }),
  Object.freeze({ id: "bottom", label: "BOTTOM", normal: Object.freeze([0, -1, 0]), rotation: Object.freeze([Math.PI / 2, 0, 0]) }),
  Object.freeze({ id: "front", label: "FRONT", normal: Object.freeze([0, 0, 1]), rotation: Object.freeze([0, 0, 0]) }),
  Object.freeze({ id: "back", label: "BACK", normal: Object.freeze([0, 0, -1]), rotation: Object.freeze([0, Math.PI, 0]) }),
  Object.freeze({ id: "left", label: "LEFT", normal: Object.freeze([-1, 0, 0]), rotation: Object.freeze([0, -Math.PI / 2, 0]) }),
  Object.freeze({ id: "right", label: "RIGHT", normal: Object.freeze([1, 0, 0]), rotation: Object.freeze([0, Math.PI / 2, 0]) }),
]);

const ASSET_IDS = new Set(DICE_ASSET_CYCLE.map(({ id }) => id));

export function nextDiceAsset(current) {
  const currentIndex = DICE_ASSET_CYCLE.findIndex(({ id }) => id === current);
  return DICE_ASSET_CYCLE[(currentIndex + 1 + DICE_ASSET_CYCLE.length) % DICE_ASSET_CYCLE.length];
}

export function chooseDiceOutcome(assignments, random = Math.random) {
  if (!Array.isArray(assignments) || assignments.length !== DICE_FACE_ORDER.length) {
    throw new TypeError("A die needs exactly six configured face assets.");
  }
  if (!assignments.every((asset) => ASSET_IDS.has(asset))) {
    throw new TypeError("A die face uses an unknown berry asset.");
  }
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample > 1) {
    throw new RangeError("The random sample must be between zero and one.");
  }
  const index = Math.min(DICE_FACE_ORDER.length - 1, Math.floor(sample * DICE_FACE_ORDER.length));
  return Object.freeze({ index, face: DICE_FACE_ORDER[index], asset: assignments[index] });
}
