function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function firstValue(object, keys) {
  if (!object || typeof object !== "object") return undefined;
  for (const key of keys) {
    if (hasValue(object[key])) return object[key];
  }
  return undefined;
}

function asGradientStops(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string" && value.trim()) return value.trim();
  return "#5BCEFA, #F5A9B8, #ffffff, #F5A9B8, #5BCEFA";
}

function asDirection(value) {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}deg`;
  if (typeof value === "string" && value.trim()) return value.trim();
  return "90deg";
}

function asOpacity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "1";
  return String(Math.max(0, Math.min(1, number)));
}

function resolveGradient(config) {
  const image = firstValue(config, ["gradient", "background", "backgroundImage", "image"]);
  if (typeof image === "string" && image.includes("gradient(")) return image;
  const direction = asDirection(firstValue(config, ["direction", "angle", "gradientDirection", "selectionDirection"]));
  const stops = asGradientStops(firstValue(config, ["colors", "colours", "stops", "gradientColors", "gradientColours", "selectionColors", "selectionColours"]) || image);
  return `linear-gradient(${direction}, ${stops})`;
}

export function applyTextSelectionTheme(config = {}) {
  const root = document.documentElement;
  root.style.setProperty("--text-selection-gradient", resolveGradient(config));
  root.style.setProperty("--text-selection-opacity", asOpacity(firstValue(config, ["opacity", "alpha", "selectionOpacity"])));
  const color = firstValue(config, ["textColor", "foreground", "color", "selectionTextColor"]);
  if (hasValue(color)) root.style.setProperty("--text-selection-color", color);
  const fallback = firstValue(config, ["fallback", "fallbackColor", "backgroundColor"]);
  if (hasValue(fallback)) root.style.setProperty("--text-selection-fallback", fallback);
}
