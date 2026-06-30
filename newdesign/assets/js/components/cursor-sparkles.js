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

function normalizeSize(value, fallback = 21) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(1, Math.min(128, number));
}

function normalizeRange(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function localFairyDustCursor(options = {}) {
  const possibleColors = normalizeList(options.colors, ["#D61C59", "#E7D84B", "#1B8798"]);
  const hasWrapperEl = options.element;
  const element = hasWrapperEl || document.body;
  const particles = [];
  const canvImages = [];
  const cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const lastPos = { x: cursor.x, y: cursor.y };
  const char = options.fairySymbol || "*";
  const size = normalizeSize(options.size ?? options.sparkleSize ?? options.particleSize ?? options.fontSize ?? options.fairySize, 21);
  const amount = normalizeCount(options.amount ?? options.intensity ?? options.particleCount ?? options.particles ?? options.density, 1, 24);
  const font = String(options.font || `${size}px ${options.fontFamily || "serif"}`);
  const shadowBlur = normalizeRange(options.shadowBlur ?? options.blur ?? options.glowBlur, Math.max(1.2, size * 0.16), 0, 48);
  const shadowColor = options.shadowColor || options.shadow || options.glowColor || "rgba(0, 0, 0, 0.42)";
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = window.innerWidth;
  let height = window.innerHeight;
  let canvas = null;
  let context = null;
  let animationFrame = 0;
  let alive = false;

  const drawParticles = () => {
    if (!context) return;
    if (particles.length) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < particles.length; index += 1) particles[index].update(context);
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        if (particles[index].lifeSpan < 0) particles.splice(index, 1);
      }
    } else {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const loop = () => {
    drawParticles();
    animationFrame = window.requestAnimationFrame(loop);
  };

  const updateCanvasSize = () => {
    width = hasWrapperEl ? element.clientWidth : window.innerWidth;
    height = hasWrapperEl ? element.clientHeight : window.innerHeight;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  };

  const addParticle = (x, y) => {
    if (!canvImages.length || amount <= 0) return;
    for (let index = 0; index < amount; index += 1) particles.push(new Particle(x, y, canvImages[Math.floor(Math.random() * canvImages.length)]));
  };

  const pointFromEvent = (event) => {
    if (hasWrapperEl) {
      const rect = element.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    return { x: event.clientX, y: event.clientY };
  };

  const onMouseMove = (event) => {
    window.requestAnimationFrame(() => {
      const point = pointFromEvent(event);
      cursor.x = point.x;
      cursor.y = point.y;
      const distance = Math.hypot(cursor.x - lastPos.x, cursor.y - lastPos.y);
      if (distance > 1.5) {
        addParticle(cursor.x, cursor.y);
        lastPos.x = cursor.x;
        lastPos.y = cursor.y;
      }
    });
  };

  const onTouchMove = (event) => {
    for (let index = 0; index < event.touches.length; index += 1) {
      const touch = event.touches[index];
      const point = pointFromEvent(touch);
      addParticle(point.x, point.y);
    }
  };

  const createImages = () => {
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    measureContext.font = font;
    measureContext.textBaseline = "middle";
    measureContext.textAlign = "center";
    possibleColors.forEach((color) => {
      const measurements = measureContext.measureText(char);
      const imageCanvas = document.createElement("canvas");
      const imageContext = imageCanvas.getContext("2d");
      const textWidth = Math.max(1, Math.ceil(measurements.width || size));
      const textHeight = Math.max(1, Math.ceil((measurements.actualBoundingBoxAscent || size * 0.75) + (measurements.actualBoundingBoxDescent || size * 0.25)));
      const padding = Math.ceil(shadowBlur * 2 + size * 0.04);
      const imageWidth = textWidth + padding * 2;
      const imageHeight = textHeight + padding * 2;
      imageCanvas.width = imageWidth;
      imageCanvas.height = imageHeight;
      imageContext.fillStyle = color;
      imageContext.textAlign = "center";
      imageContext.font = font;
      imageContext.textBaseline = "alphabetic";
      imageContext.shadowColor = shadowColor;
      imageContext.shadowBlur = shadowBlur;
      imageContext.shadowOffsetX = 0;
      imageContext.shadowOffsetY = 0;
      imageContext.fillText(char, imageWidth / 2, padding + (measurements.actualBoundingBoxAscent || size * 0.75));
      canvImages.push(imageCanvas);
    });
  };

  const init = () => {
    if (prefersReducedMotion.matches || alive) return false;
    alive = true;
    canvas = document.createElement("canvas");
    context = canvas.getContext("2d");
    canvas.style.top = "0px";
    canvas.style.left = "0px";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = options.zIndex || "9999999999";
    canvas.style.position = hasWrapperEl ? "absolute" : "fixed";
    element.appendChild(canvas);
    updateCanvasSize();
    createImages();
    element.addEventListener("mousemove", onMouseMove);
    element.addEventListener("touchmove", onTouchMove, { passive: true });
    element.addEventListener("touchstart", onTouchMove, { passive: true });
    window.addEventListener("resize", updateCanvasSize);
    loop();
    return true;
  };

  const destroy = () => {
    alive = false;
    if (canvas) canvas.remove();
    window.cancelAnimationFrame(animationFrame);
    element.removeEventListener("mousemove", onMouseMove);
    element.removeEventListener("touchmove", onTouchMove);
    element.removeEventListener("touchstart", onTouchMove);
    window.removeEventListener("resize", updateCanvasSize);
  };

  prefersReducedMotion.onchange = () => {
    if (prefersReducedMotion.matches) destroy();
    else init();
  };

  function Particle(x, y, canvasItem) {
    const lifeSpan = Math.floor(Math.random() * 30 + 60);
    this.initialLifeSpan = lifeSpan;
    this.lifeSpan = lifeSpan;
    this.velocity = {
      x: (Math.random() < 0.5 ? -1 : 1) * (Math.random() / 2),
      y: Math.random() * 0.7 + 0.9
    };
    this.position = { x, y };
    this.canv = canvasItem;
    this.update = function updateParticle(ctx) {
      this.position.x += this.velocity.x;
      this.position.y += this.velocity.y;
      this.lifeSpan -= 1;
      this.velocity.y += 0.02;
      const scale = Math.max(this.lifeSpan / this.initialLifeSpan, 0);
      ctx.drawImage(this.canv, this.position.x - this.canv.width / 2 * scale, this.position.y - this.canv.height / 2, this.canv.width * scale, this.canv.height * scale);
    };
  }

  init();
  return { destroy };
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
      fairySymbol: pick(settings.symbols, index),
      size: settings.size,
      amount: settings.amount,
      font: settings.font,
      fontFamily: settings.fontFamily,
      shadowBlur: settings.shadowBlur,
      shadowColor: settings.shadowColor
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
  const nestedSize = nestedValue(settings, mode, ["size", "sparkleSize", "particleSize", "fontSize", "fairySize"]);
  const nestedAmount = nestedValue(settings, mode, ["amount", "intensity", "particleCount", "particles", "density", "sparkleAmount", "sparkleIntensity"]);
  const nestedFont = nestedValue(settings, mode, ["font"]);
  const nestedFontFamily = nestedValue(settings, mode, ["fontFamily", "family"]);
  const nestedShadowBlur = nestedValue(settings, mode, ["shadowBlur", "blur", "glowBlur"]);
  const nestedShadowColor = nestedValue(settings, mode, ["shadowColor", "shadow", "glowColor"]);
  const topColors = topLevelModeValue(settings, mode, ["colors", "colours"]);
  const topSymbols = topLevelModeValue(settings, mode, ["symbols", "fairySymbols", "fairySymbol"]);
  const topSize = topLevelModeValue(settings, mode, ["size", "sparkleSize", "particleSize", "fontSize", "fairySize"]);
  const topAmount = topLevelModeValue(settings, mode, ["amount", "intensity", "particleCount", "particles", "density", "sparkleAmount", "sparkleIntensity"]);
  const topFont = topLevelModeValue(settings, mode, ["font"]);
  const topFontFamily = topLevelModeValue(settings, mode, ["fontFamily", "family"]);
  const topShadowBlur = topLevelModeValue(settings, mode, ["shadowBlur", "blur", "glowBlur"]);
  const topShadowColor = topLevelModeValue(settings, mode, ["shadowColor", "shadow", "glowColor"]);
  const layers = nestedValue(settings, mode, ["layers", "layerCount", "count"]);
  return {
    colors: normalizeList(firstValue(nestedColors, topColors), fallbackColors),
    symbols: normalizeList(firstValue(nestedSymbols, topSymbols), fallbackSymbols),
    size: normalizeSize(firstValue(nestedSize, topSize, fallbacks.size, settings.size ?? settings.sparkleSize ?? settings.particleSize ?? settings.fontSize ?? settings.fairySize), 21),
    amount: normalizeCount(firstValue(nestedAmount, topAmount, fallbacks.amount, settings.amount ?? settings.intensity ?? settings.particleCount ?? settings.particles ?? settings.density ?? settings.sparkleAmount ?? settings.sparkleIntensity), 1, 24),
    font: firstValue(nestedFont, topFont, settings.font),
    fontFamily: firstValue(nestedFontFamily, topFontFamily, settings.fontFamily),
    shadowBlur: firstValue(nestedShadowBlur, topShadowBlur, settings.shadowBlur ?? settings.blur ?? settings.glowBlur),
    shadowColor: firstValue(nestedShadowColor, topShadowColor, settings.shadowColor ?? settings.shadow ?? settings.glowColor),
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
    const fairyDustCursor = localFairyDustCursor;
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
      if (!moveEffects.length && moveLayerCount > 0) moveEffects = createEffects(fairyDustCursor, moveSettings, "move", moveLayerCount, fps);
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
