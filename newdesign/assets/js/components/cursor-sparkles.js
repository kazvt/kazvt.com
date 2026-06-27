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

function styleCursorLayers() {
  document.querySelectorAll("canvas").forEach((canvas) => {
    if (canvas.classList.contains("cursor-sparkles-canvas")) return;
    const style = getComputedStyle(canvas);
    if (style.position === "fixed" || style.position === "absolute") {
      canvas.classList.add("cursor-sparkles-canvas");
      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.zIndex = "2147483646";
      canvas.style.pointerEvents = "none";
    }
  });
}

function makeEffect(Constructor, settings, index = 0, fps = 60) {
  activeFps = normalizeFps(fps, 60);
  patchEventListeners();
  captureConstructedListeners = true;
  try {
    const effect = new Constructor({
      colors: settings.colors,
      fairySymbol: pick(settings.symbols, index)
    });
    styleCursorLayers();
    return effect;
  } finally {
    captureConstructedListeners = false;
  }
}

export async function startCursorSparkles(options = {}) {
  const settings = {
    enabled: true,
    colors: ["#ffff00", "#ff66ff", "#66ffff", "#ffffff", "#00ff66"],
    symbols: ["✦"],
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
    const base = makeEffect(fairyDustCursor, {
      colors: normalizeList(settings.colors, ["#ffffff"]),
      symbols: normalizeList(settings.symbols || settings.fairySymbol, ["✦"])
    }, 0, fps);
    const dragSettings = {
      colors: normalizeList(settings.dragColors, normalizeList(settings.colors, ["#ffffff"])),
      symbols: normalizeList(settings.dragSymbols || settings.dragSymbol, ["✦", "✧"])
    };
    const dragLayerCount = normalizeCount(settings.dragLayers, 2, 6);
    let dragEffects = [];
    const startDrag = () => {
      if (dragEffects.length || dragLayerCount <= 0) return;
      dragEffects = Array.from({ length: dragLayerCount }, (_, index) => makeEffect(fairyDustCursor, dragSettings, index, fps));
      styleCursorLayers();
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
    window.setTimeout(styleCursorLayers, 0);
    return { destroy };
  } catch {
    return null;
  }
}
