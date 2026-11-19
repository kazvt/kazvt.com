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

export function nextDiceAsset(current) {
  const currentIndex = DICE_ASSET_CYCLE.findIndex(({ id }) => id === current);
  if (currentIndex < 0) return DICE_ASSET_CYCLE[0];
  return DICE_ASSET_CYCLE[(currentIndex + 1 + DICE_ASSET_CYCLE.length) % DICE_ASSET_CYCLE.length];
}
