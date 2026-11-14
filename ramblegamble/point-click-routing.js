const ROULETTE_MENU_PARTS = new Set(["center", "rim"]);

export function resolvePointClick(machine, part = "") {
  if (machine === "roulette") return ROULETTE_MENU_PARTS.has(part) ? "open-trivia" : "spin-wheel";
  if (machine === "slot") return part === "arm" ? "pull-lever" : "open-slots";
  return "";
}
