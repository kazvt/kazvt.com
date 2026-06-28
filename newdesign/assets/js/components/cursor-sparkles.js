const moduleUrl = "https://cdn.jsdelivr.net/npm/cursor-effects@1.0.18/dist/esm.js";
const moveEvents = new Set(["mousemove", "pointermove", "touchmove"]);
const listenerMap = new WeakMap();
let nativeAdd = null;
let nativeRemove = null;
let captureConstructedListeners = false;
let activeFps = 60;
let patched = false;

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

function normalizeFps(value, fallback = 60) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.max(number, 1), 60);
}

function captureOf(options) {
  if (typeof options === "boolean") return options;
  return Boolean(options && options.capture);
}

function pick(list, index) {
  return list[index % list.length];
}

function callListener(listener, context, event) {
  if (typeof listener === "function") return listener.call(context, event);
  if (listener && typeof listener.handleEvent === "function") return listener.handleEvent(event);
  return undefined;
}

function throttleListener(listener, fps) {
  if (fps >= 60) return listener;
  const frameMs = 1000 / fps;
  let lastTime = 0;
  let timer = 0;
  let latestEvent = null;
  let latestContext = null;
  const fire = () => {
    timer = 0;
    lastTime = performance.now();
    const event = latestEvent;
    const context = latestContext;
    latestEvent = null;
    latestContext = null;
    callListener(listener, context, event);
  };
  return function throttledCursorMove(event) {
    latestEvent = event;
    latestContext = this;
    const now = performance.now();
    const remaining = frameMs - (now - lastTime);
    if (remaining <= 0 || remaining > frameMs) {
      window.clearTimeout(timer);
      fire();
      return;
    }
    if (!timer) timer = window.setTimeout(fire, remaining);
  };
}

function getTargetStore(target) {
  let targetStore = listenerMap.get(target);
  if (!targetStore) {
    targetStore = new Map();
    listenerMap.set(target, targetStore);
  }
  return targetStore;
}

function getTypeStore(target, type) {
  const targetStore = getTargetStore(target);
  let typeStore = targetStore.get(type);
  if (!typeStore) {
    typeStore = new WeakMap();
    targetStore.set(type, typeStore);
  }
  return typeStore;
}

function storeWrapped(target, type, listener, capture, wrapped) {
  if (!listener || (typeof listener !== "function" && typeof listener !== "object")) return;
  const typeStore = getTypeStore(target, type);
  let listenerStore = typeStore.get(listener);
  if (!listenerStore) {
    listenerStore = new Map();
    typeStore.set(listener, listenerStore);
  }
  listenerStore.set(capture ? "1" : "0", wrapped);
}

function takeWrapped(target, type, listener, capture) {
  const targetStore = listenerMap.get(target);
  const typeStore = targetStore && targetStore.get(type);
  const listenerStore = typeStore && typeStore.get(listener);
  return listenerStore && listenerStore.get(capture ? "1" : "0");
}

function patchEventListeners() {
  if (patched) return;
  patched = true;
  nativeAdd = EventTarget.prototype.addEventListener;
  nativeRemove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function patchedAddEventListener(type, listener, options) {
    if (captureConstructedListeners && moveEvents.has(type) && listener && activeFps < 60) {
      const wrapped = throttleListener(listener, activeFps);
      storeWrapped(this, type, listener, captureOf(options), wrapped);
      return nativeAdd.call(this, type, wrapped, options);
    }
    return nativeAdd.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function patchedRemoveEventListener(type, listener, options) {
    const wrapped = moveEvents.has(type) ? takeWrapped(this, type, listener, captureOf(options)) : null;
    return nativeRemove.call(this, type, wrapped || listener, options);
  };
}

function styleCanvas(canvas, mode) {
  canvas.classList.add("cursor-sparkles-canvas");
  if (mode) canvas.dataset.cursorSparklesMode = mode;
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "2147483646";
  canvas.style.pointerEvents = "none";
}

function styleCursorLayers(mode = "") {
  document.querySelectorAll("canvas").forEach((canvas) => {
    const style = getComputedStyle(canvas);
    if (canvas.classList.contains("cursor-sparkles-canvas") || style.position === "fixed" || style.position === "absolute") styleCanvas(canvas, canvas.dataset.cursorSparklesMode || mode);
  });
}

function makeEffect(Constructor, settings, index = 0, fps = 60, mode = "move") {
  activeFps = normalizeFps(fps, 60);
  patchEventListeners();
  const before = new Set(document.querySelectorAll("canvas"));
  captureConstructedListeners = true;
  try {
    const effect = new Constructor({
      colors: settings.colors,
      fairySymbol: pick(settings.symbols, index)
    });
    const canvases = [...document.querySelectorAll("canvas")].filter((canvas) => !before.has(canvas));
    canvases.forEach((canvas) => styleCanvas(canvas, mode));
    styleCursorLayers(mode);
    return { effect, canvases };
  } finally {
    captureConstructedListeners = false;
  }
}

function destroyEffect(instance) {
  if (!instance) return;
  if (instance.effect && instance.effect.destroy) instance.effect.destroy();
  if (Array.isArray(instance.canvases)) instance.canvases.forEach((canvas) => canvas.remove());
}

function destroyEffects(effects) {
  effects.forEach(destroyEffect);
}

function nestedValue(settings, groupName, names) {
  const group = settings[groupName] || {};
  for (const name of names) {
    if (group[name] !== undefined) return group[name];
  }
  for (const name of names) {
    const prefixed = `${groupName}${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    if (settings[prefixed] !== undefined) return settings[prefixed];
  }
  return undefined;
}

function firstValue(...items) {
  for (const item of items) {
    if (item !== undefined && item !== null && item !== "") return item;
  }
  return undefined;
}

function topLevelModeValue(settings, mode, names) {
  for (const name of names) {
    if (mode === "move" && settings[name] !== undefined) return settings[name];
    const prefixed = `${mode}${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    if (settings[prefixed] !== undefined) return settings[prefixed];
  }
  return undefined;
}

function modeSettings(settings, mode, fallbacks = {}) {
  const fallbackColors = fallbacks.colors || ["#ffffff"];
  const fallbackSymbols = fallbacks.symbols || ["✦"];
  const nestedColors = nestedValue(settings, mode, ["colors", "colours"]);
  const nestedSymbols = nestedValue(settings, mode, ["symbols", "fairySymbols", "fairySymbol"]);
  const topColors = topLevelModeValue(settings, mode, ["colors", "colours"]);
  const topSymbols = topLevelModeValue(settings, mode, ["symbols", "fairySymbols", "fairySymbol"]);
  const layers = nestedValue(settings, mode, ["layers", "layerCount", "intensity", "amount", "count"]);
  return {
    colors: normalizeList(firstValue(topColors, nestedColors), fallbackColors),
    symbols: normalizeList(firstValue(topSymbols, nestedSymbols), fallbackSymbols),
    layers
  };
}

function createEffects(Constructor, settings, mode, count, fps) {
  return Array.from({ length: count }, (_, index) => makeEffect(Constructor, settings, index, fps, mode));
}

function eventPoint(event) {
  const point = event.touches && event.touches[0] ? event.touches[0] : event.changedTouches && event.changedTouches[0] ? event.changedTouches[0] : event;
  return { x: Number(point.clientX) || 0, y: Number(point.clientY) || 0 };
}

function isPrimaryPointer(event) {
  if (event.button !== undefined && event.button !== 0) return false;
  if (event.buttons !== undefined && event.type !== "pointerdown" && event.type !== "mousedown" && event.buttons < 1) return false;
  return true;
}

function isDragTarget(target) {
  return Boolean(target && target.closest && target.closest(".title-bar, .window-resize-handle, .volume-popup__range, input[type='range'], [draggable='true']"));
}

export async function startCursorSparkles(options = {}) {
  const settings = {
    enabled: true,
    colors: ["#ffff00", "#ff66ff", "#66ffff", "#ffffff", "#00ff66"],
    symbols: ["✦"],
    moveLayers: 1,
    dragColors: ["#ffffff", "#ffff00", "#ff00ff", "#00ffff", "#ff9900"],
    dragSymbols: ["✦", "✧", "★"],
    dragLayers: 2,
    fps: 60,
    ...options
  };
  if (settings.enabled === false) return null;
  try {
    const { fairyDustCursor } = await import(moduleUrl);
    const fps = normalizeFps(settings.fps, 60);
    const moveSettings = modeSettings({ ...settings, move: settings.move || settings.normal || settings.idle || {} }, "move", {
      colors: normalizeList(settings.colors, ["#ffffff"]),
      symbols: normalizeList(settings.symbols || settings.fairySymbol, ["✦"])
    });
    const dragSettings = modeSettings({ ...settings, drag: settings.drag || settings.dragging || settings.down || {} }, "drag", {
      colors: normalizeList(settings.dragColors, normalizeList(settings.colors, ["#ffffff"])),
      symbols: normalizeList(settings.dragSymbols || settings.dragSymbol, ["✦", "✧"])
    });
    const moveLayerCount = normalizeCount(moveSettings.layers ?? settings.moveLayers ?? settings.layers, 1, 8);
    const dragLayerCount = normalizeCount(dragSettings.layers ?? settings.dragLayers, 2, 10);
    let dragging = false;
    let pending = null;
    let moveEffects = createEffects(fairyDustCursor, moveSettings, "move", moveLayerCount, fps);
    let dragEffects = [];
    const startDrag = () => {
      pending = null;
      if (dragging) return;
      dragging = true;
      destroyEffects(moveEffects);
      moveEffects = [];
      if (dragLayerCount > 0) dragEffects = createEffects(fairyDustCursor, dragSettings, "drag", dragLayerCount, fps);
      styleCursorLayers("drag");
    };
    const beginGesture = (event) => {
      if (!isPrimaryPointer(event)) return;
      const point = eventPoint(event);
      pending = { x: point.x, y: point.y };
      if (isDragTarget(event.target)) startDrag();
    };
    const moveGesture = (event) => {
      if (dragging) return;
      if (!pending) {
        if (event.buttons === undefined || event.buttons < 1) return;
        beginGesture(event);
        return;
      }
      const point = eventPoint(event);
      if (Math.hypot(point.x - pending.x, point.y - pending.y) >= 2) startDrag();
    };
    const stopDrag = () => {
      pending = null;
      if (!dragging) return;
      dragging = false;
      destroyEffects(dragEffects);
      dragEffects = [];
      if (moveLayerCount > 0) moveEffects = createEffects(fairyDustCursor, moveSettings, "move", moveLayerCount, fps);
      styleCursorLayers("move");
    };
    const destroy = () => {
      destroyEffects(dragEffects);
      destroyEffects(moveEffects);
      dragEffects = [];
      moveEffects = [];
      document.removeEventListener("pointerdown", beginGesture, true);
      document.removeEventListener("mousedown", beginGesture, true);
      document.removeEventListener("touchstart", beginGesture, true);
      document.removeEventListener("pointermove", moveGesture, true);
      document.removeEventListener("mousemove", moveGesture, true);
      document.removeEventListener("touchmove", moveGesture, true);
      document.removeEventListener("dragstart", startDrag, true);
      window.removeEventListener("pointerup", stopDrag, true);
      window.removeEventListener("pointercancel", stopDrag, true);
      window.removeEventListener("mouseup", stopDrag, true);
      window.removeEventListener("touchend", stopDrag, true);
      window.removeEventListener("touchcancel", stopDrag, true);
      window.removeEventListener("blur", stopDrag, true);
      document.removeEventListener("drop", stopDrag, true);
      document.removeEventListener("dragend", stopDrag, true);
    };
    document.addEventListener("pointerdown", beginGesture, true);
    document.addEventListener("mousedown", beginGesture, true);
    document.addEventListener("touchstart", beginGesture, true);
    document.addEventListener("pointermove", moveGesture, true);
    document.addEventListener("mousemove", moveGesture, true);
    document.addEventListener("touchmove", moveGesture, true);
    document.addEventListener("dragstart", startDrag, true);
    window.addEventListener("pointerup", stopDrag, true);
    window.addEventListener("pointercancel", stopDrag, true);
    window.addEventListener("mouseup", stopDrag, true);
    window.addEventListener("touchend", stopDrag, true);
    window.addEventListener("touchcancel", stopDrag, true);
    window.addEventListener("blur", stopDrag, true);
    document.addEventListener("drop", stopDrag, true);
    document.addEventListener("dragend", stopDrag, true);
    window.setTimeout(() => styleCursorLayers("move"), 0);
    return { destroy };
  } catch {
    return null;
  }
}
