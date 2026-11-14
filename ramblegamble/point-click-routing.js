const ROULETTE_MENU_PARTS = new Set(["center", "rim"]);

export function resolvePointClick(machine, part = "") {
  if (machine === "roulette") return ROULETTE_MENU_PARTS.has(part) ? "open-trivia" : "spin-wheel";
  if (machine === "slot") return part === "arm" ? "pull-lever" : "open-slots";
  return "";
}

export function resolvePointClickZone({ x, y, width, height, canGoBack = false }) {
  if (!(width > 0) || !(height > 0)) return "";

  const backBand = Math.min(84, Math.max(48, height * 0.11));
  if (canGoBack && y >= height - backBand) return "back";

  const sideBand = Math.min(96, Math.max(42, width * 0.075));
  if (x <= sideBand) return "left";
  if (x >= width - sideBand) return "right";
  return "";
}

export function resolvePointClickAction({ zone = "", machine = "", part = "", focused = false, canGoBack = false } = {}) {
  if (zone === "left") return "look-left";
  if (zone === "right") return "look-right";
  if (zone === "back") return canGoBack ? "back" : "";
  if (machine === "contestant") return focused ? "" : "focus-contestants";
  if ((machine === "roulette" || machine === "slot") && !focused) return `focus-${machine}`;
  return resolvePointClick(machine, part);
}

export function resolvePointClickCursor({ zone = "", actionable = false } = {}) {
  if (zone === "left" || zone === "right" || zone === "back") return zone;
  return actionable ? "hover" : "default";
}
