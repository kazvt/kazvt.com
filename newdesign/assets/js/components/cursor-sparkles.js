const moduleUrl = "https://cdn.jsdelivr.net/npm/cursor-effects@1.0.18/dist/esm.js";

function normalizeList(value, fallback) {
  if (Array.isArray(value) && value.length) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return fallback;
}

function normalizeCount(value, fallback, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(max, Math.round(number)));
}

function pick(list, index) {
  return list[index % list.length];
}

function makeEffect(Constructor, settings, index = 0) {
  return new Constructor({
    colors: settings.colors,
    fairySymbol: pick(settings.symbols, index)
  });
}

export async function startCursorSparkles(options = {}) {
  const settings = {
    enabled: true,
    colors: ["#ffff00", "#ff66ff", "#66ffff", "#ffffff", "#00ff66"],
    symbols: ["✦"],
    dragColors: ["#ffffff", "#ffff00", "#ff00ff", "#00ffff", "#ff9900"],
    dragSymbols: ["✦", "✧", "★"],
    dragLayers: 2,
    ...options
  };
  if (settings.enabled === false) return null;
  try {
    const { fairyDustCursor } = await import(moduleUrl);
    const base = makeEffect(fairyDustCursor, {
      colors: normalizeList(settings.colors, ["#ffffff"]),
      symbols: normalizeList(settings.symbols || settings.fairySymbol, ["✦"])
    });
    const dragSettings = {
      colors: normalizeList(settings.dragColors, normalizeList(settings.colors, ["#ffffff"])),
      symbols: normalizeList(settings.dragSymbols || settings.dragSymbol, ["✦", "✧"])
    };
    const dragLayerCount = normalizeCount(settings.dragLayers, 2, 6);
    let dragEffects = [];
    const startDrag = () => {
      if (dragEffects.length || dragLayerCount <= 0) return;
      dragEffects = Array.from({ length: dragLayerCount }, (_, index) => makeEffect(fairyDustCursor, dragSettings, index));
    };
    const stopDrag = () => {
      dragEffects.forEach((effect) => effect.destroy && effect.destroy());
      dragEffects = [];
    };
    const destroy = () => {
      stopDrag();
      base.destroy && base.destroy();
      document.removeEventListener("pointerdown", startDrag, true);
      document.removeEventListener("dragstart", startDrag, true);
      window.removeEventListener("pointerup", stopDrag, true);
      window.removeEventListener("pointercancel", stopDrag, true);
      window.removeEventListener("blur", stopDrag, true);
      document.removeEventListener("drop", stopDrag, true);
      document.removeEventListener("dragend", stopDrag, true);
    };
    document.addEventListener("pointerdown", startDrag, true);
    document.addEventListener("dragstart", startDrag, true);
    window.addEventListener("pointerup", stopDrag, true);
    window.addEventListener("pointercancel", stopDrag, true);
    window.addEventListener("blur", stopDrag, true);
    document.addEventListener("drop", stopDrag, true);
    document.addEventListener("dragend", stopDrag, true);
    return { destroy };
  } catch {
    return null;
  }
}
