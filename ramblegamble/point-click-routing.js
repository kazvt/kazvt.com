const ROULETTE_MENU_PARTS = new Set(["center", "rim"]);

export function resolveArcadeShortcut(key) {
  const shortcut = String(key || "").toLowerCase();
  if (shortcut === "1" || shortcut === "p") return "participants";
  if (shortcut === "d") return "dice-door";
  if (shortcut === "4" || shortcut === "h") return "host";
  if (shortcut === "5") return "card-table";
  if (shortcut === "8") return "hazel";
  if (shortcut === "c") return "cheer";
  return "";
}

export function resolvePointClick(machine, part = "", focused = false) {
  if (machine === "dice-door") return focused ? "open-dice" : "focus-dice-door";
  if (machine === "roulette") return ROULETTE_MENU_PARTS.has(part) ? "show-trivia" : "spin-wheel";
  if (machine === "slot") {
    if (part === "arm") return "pull-lever";
    if (part === "slot-reel-display") return "place-slot-berry";
    const button = /^button([1-5])$/.exec(part);
    if (button) return `spin-column-${Number(button[1]) - 1}`;
    return "";
  }
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

// A tightly framed cabinet can fill the screen edges. Its decorative body
// must not trap the player in the close-up; real controls still take priority.
export function resolveSceneNavigationZone({ interaction, view, ...geometry } = {}) {
  const decorativeSlot = view === "slot" && interaction?.machine === "slot"
    && (!interaction.part || interaction.part === "machine");
  return interaction && !decorativeSlot ? "" : resolvePointClickZone(geometry);
}

export function resolvePointClickAction({ zone = "", machine = "", part = "", focused = false, canGoBack = false } = {}) {
  if (zone === "left") return "look-left";
  if (zone === "right") return "look-right";
  if (zone === "back") return canGoBack ? "back" : "";
  if (machine === "host") return focused ? "" : "focus-host";
  if (machine === "hazel") return focused ? "" : "focus-hazel";
  if (machine === "contestant") return focused ? "" : "focus-contestant";
  if (machine === "card-table") return focused ? "open-card-games" : "focus-card-table";
  if (machine === "roulette" && ROULETTE_MENU_PARTS.has(part)) return "show-trivia";
  if ((machine === "roulette" || machine === "slot") && !focused) return `focus-${machine}`;
  return resolvePointClick(machine, part, focused);
}

export function resolvePointClickCursor({ zone = "", actionable = false } = {}) {
  if (zone === "left" || zone === "right" || zone === "back") return zone;
  return actionable ? "hover" : "default";
}

export function resolvePointClickBack(view = {}) {
  const { kind = "overview", look = 0, retreat = 0 } = view;
  // Back at the overview only restores the starting forward view. It must never
  // dolly the camera beyond the initial point, including for a stale retreat state.
  if (kind === "overview") {
    if (look !== 0 || retreat > 0) return { ...view, look: 0, retreat: 0 };
    return null;
  }
  if (kind === "contestant") return { kind: "contestants", look, retreat: 0 };
  return { kind: "overview", look, retreat: 0 };
}

// Right-click deletion is an explicit tool, never an alternate spin or place.
export function resolveSlotContextCell({ button, view, selected, interaction } = {}) {
  const index = interaction?.cellIndex;
  return button === 2 && view === "slot" && ["faroeberry", "erinberry", "kazberry", "star"].includes(selected)
    && interaction?.machine === "slot" && interaction.part === "slot-reel-display"
    && Number.isInteger(index) && index >= 0 && index < 15 ? index : -1;
}

export function resolveHostContextAction(interaction) {
  if(interaction?.machine === "roulette") return "trivia";
  if(interaction?.machine === "slot") return "slots";
  if(interaction?.machine === "card-table") return "card-games";
  if(interaction?.machine === "dice-door") return "dice";
  return "";
}
