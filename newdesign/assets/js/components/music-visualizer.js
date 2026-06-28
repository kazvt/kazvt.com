import { createElement } from "./dom.js";
import { getMotionFrameMs } from "./motion.js";

const styles = ["wmp-bars", "wmp-scope", "winamp-avs"];
const edges = ["top", "right", "bottom", "left"];

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function pickStyle(value) {
  const aliases = { bars: "wmp-bars", scope: "wmp-scope", avs: "winamp-avs", winamp: "winamp-avs" };
  const key = String(value || "").trim();
  const resolved = aliases[key] || key;
  return styles.includes(resolved) ? resolved : "wmp-bars";
}

function pickEdge(value) {
  return edges.includes(value) ? value : "bottom";
}

function normalizedWord(value) {
  return String(value || "").trim().toLowerCase();
}

function isOffWord(value) {
  return ["0", "false", "no", "off", "none", "transparent", "hidden", "disabled"].includes(normalizedWord(value));
}

function isOnWord(value) {
  return ["1", "true", "yes", "on", "solid", "visible", "enabled"].includes(normalizedWord(value));
}

function booleanSetting(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (isOffWord(value)) return false;
  if (isOnWord(value)) return true;
  return Boolean(value);
}

function showBackground(settings) {
  if (settings.noBackground !== undefined) return !booleanSetting(settings.noBackground, false);
  if (settings.withoutBackground !== undefined) return !booleanSetting(settings.withoutBackground, false);
  const keys = ["showBackground", "backgroundEnabled", "backgroundVisible", "hasBackground", "chrome", "frame"];
  for (const key of keys) {
    if (settings[key] !== undefined) return booleanSetting(settings[key], true);
  }
  if (settings.background !== undefined && (typeof settings.background === "boolean" || typeof settings.background === "number" || isOffWord(settings.background) || isOnWord(settings.background))) return booleanSetting(settings.background, true);
  return true;
}

function backgroundColor(settings, fallback) {
  return typeof settings.background === "string" && !isOffWord(settings.background) && !isOnWord(settings.background) ? settings.background : fallback;
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function rangePart(range, keys) {
  if (!range || typeof range !== "object" || Array.isArray(range)) return undefined;
  for (const key of keys) {
    if (range[key] !== undefined) return range[key];
  }
  return undefined;
}

function frequencyRange(settings, audio, dataLength) {
  if (!dataLength || !audio || !audio.context || !audio.analyser) return null;
  const range = settings.frequencyRange || settings.frequencies || settings.frequencyBand || settings.frequencyLimits || settings.captureFrequencies;
  const rangeMin = Array.isArray(range) ? range[0] : rangePart(range, ["min", "minimum", "from", "start", "low", "lowHz", "minHz", "minFrequency", "minFrequencyHz"]);
  const rangeMax = Array.isArray(range) ? range[1] : rangePart(range, ["max", "maximum", "to", "end", "high", "highHz", "maxHz", "maxFrequency", "maxFrequencyHz"]);
  const minHz = Math.max(0, firstNumber(settings.minFrequencyHz, settings.minFrequency, settings.frequencyMinHz, settings.frequencyMin, settings.lowFrequencyHz, settings.lowFrequency, settings.lowHz, rangeMin) ?? 0);
  const nyquist = audio.context.sampleRate / 2;
  const maxHz = Math.min(nyquist, firstNumber(settings.maxFrequencyHz, settings.maxFrequency, settings.frequencyMaxHz, settings.frequencyMax, settings.highFrequencyHz, settings.highFrequency, settings.highHz, rangeMax) ?? nyquist);
  if (!(maxHz > minHz) || minHz <= 0 && maxHz >= nyquist) return null;
  const binWidth = nyquist / dataLength;
  const start = Math.max(0, Math.min(dataLength - 1, Math.floor(minHz / binWidth)));
  const end = Math.max(start + 1, Math.min(dataLength, Math.ceil(maxHz / binWidth)));
  return { start, end, minHz, maxHz };
}

function limitedFrequencyData(data, settings, audio) {
  const range = frequencyRange(settings, audio, data.length);
  if (!range) return data;
  return data.subarray(range.start, range.end);
}

function percent(value, fallback) {
  return clamp(value === undefined ? fallback : value, 0, 100);
}

function isHorizontal(edge) {
  return edge === "top" || edge === "bottom";
}

function setupCanvas(canvas, element, edge, thickness, length, x, y) {
  const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const viewportWidth = window.innerWidth;
  const viewportHeight = Math.max(0, window.innerHeight - 30);
  const horizontal = isHorizontal(edge);
  const resolvedThickness = Math.max(18, Number(thickness) || 76);
  const resolvedLength = length === "auto" || length === "edge" || length === "100%" ? (horizontal ? viewportWidth : viewportHeight) : Math.max(40, Number(length) || (horizontal ? viewportWidth : viewportHeight));
  const edgeLength = Math.min(resolvedLength, horizontal ? viewportWidth : viewportHeight);
  const cssWidth = horizontal ? edgeLength : resolvedThickness;
  const cssHeight = horizontal ? resolvedThickness : edgeLength;
  const drawWidth = horizontal ? cssWidth : cssHeight;
  const drawHeight = horizontal ? cssHeight : cssWidth;
  element.style.width = `${cssWidth}px`;
  element.style.height = `${cssHeight}px`;
  element.style.left = "auto";
  element.style.right = "auto";
  element.style.top = "auto";
  element.style.bottom = "auto";
  if (edge === "top") {
    element.style.top = "0px";
    element.style.left = `${Math.round((viewportWidth - cssWidth) * (x / 100))}px`;
  }
  if (edge === "bottom") {
    element.style.bottom = "var(--taskbar-height)";
    element.style.left = `${Math.round((viewportWidth - cssWidth) * (x / 100))}px`;
  }
  if (edge === "left") {
    element.style.left = "0px";
    element.style.top = `${Math.round((viewportHeight - cssHeight) * (y / 100))}px`;
  }
  if (edge === "right") {
    element.style.right = "0px";
    element.style.top = `${Math.round((viewportHeight - cssHeight) * (y / 100))}px`;
  }
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.max(1, Math.round(cssWidth * ratio));
  canvas.height = Math.max(1, Math.round(cssHeight * ratio));
  const context = canvas.getContext("2d", { alpha: true });
  context.imageSmoothingEnabled = false;
  return { width: drawWidth, height: drawHeight, context, ratio };
}

function orientContext(context, ratio, edge, width, height) {
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (edge === "top") context.transform(1, 0, 0, -1, 0, height);
  if (edge === "left") context.transform(0, 1, -1, 0, height, 0);
  if (edge === "right") context.transform(0, 1, 1, 0, 0, 0);
}

function clearFrame(context, width, height, options) {
  context.clearRect(0, 0, width, height);
  if (!options.showBackground) return;
  context.fillStyle = backgroundColor(options, "#000034");
  context.fillRect(0, 0, width, height);
  context.strokeStyle = options.border || "#b9b9b9";
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
  context.strokeStyle = "#4b4b4b";
  context.strokeRect(2.5, 2.5, Math.max(0, width - 5), Math.max(0, height - 5));
}

function drawWmpBars(context, width, height, data, options) {
  clearFrame(context, width, height, options);
  const padding = 7;
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const count = Math.max(8, Math.min(64, Math.floor(innerWidth / 8)));
  const gap = 2;
  const barWidth = Math.max(2, Math.floor((innerWidth - gap * (count - 1)) / count));
  const block = Math.max(2, Math.floor(innerHeight / 13));
  for (let index = 0; index < count; index += 1) {
    const sourceIndex = Math.floor((index / count) * data.length);
    const value = data[sourceIndex] / 255;
    const blocks = Math.max(1, Math.round(value * 12));
    const x = padding + index * (barWidth + gap);
    for (let row = 0; row < blocks; row += 1) {
      const y = padding + innerHeight - (row + 1) * block;
      if (row > 9) context.fillStyle = "#ff3333";
      else if (row > 6) context.fillStyle = "#ffff00";
      else context.fillStyle = "#00ff66";
      context.fillRect(x, y, barWidth, Math.max(1, block - 1));
    }
  }
}

function drawWmpScope(context, width, height, data, options) {
  clearFrame(context, width, height, { ...options, background: backgroundColor(options, "#000000") });
  const padding = 8;
  const mid = height / 2;
  context.strokeStyle = "#002e00";
  context.lineWidth = 1;
  for (let x = padding; x < width - padding; x += 12) {
    context.beginPath();
    context.moveTo(x + 0.5, padding);
    context.lineTo(x + 0.5, height - padding);
    context.stroke();
  }
  for (let y = padding; y < height - padding; y += 10) {
    context.beginPath();
    context.moveTo(padding, y + 0.5);
    context.lineTo(width - padding, y + 0.5);
    context.stroke();
  }
  context.strokeStyle = options.line || "#00ff00";
  context.lineWidth = 2;
  context.beginPath();
  for (let index = 0; index < data.length; index += 1) {
    const x = padding + (index / (data.length - 1)) * Math.max(1, width - padding * 2);
    const value = (data[index] - 128) / 128;
    const y = mid + value * (height * 0.38);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
}

function drawWinampAvs(context, width, height, frequency, time, options) {
  clearFrame(context, width, height, { ...options, background: backgroundColor(options, "#080015") });
  const midX = width / 2;
  const midY = height / 2;
  const points = Math.max(24, Math.min(96, Math.floor(width / 7)));
  context.strokeStyle = "#ff00ff";
  context.lineWidth = 2;
  context.beginPath();
  for (let index = 0; index < points; index += 1) {
    const t = index / (points - 1);
    const f = frequency[Math.floor(t * frequency.length)] / 255;
    const wave = (time[Math.floor(t * time.length)] - 128) / 128;
    const x = t * width;
    const y = midY + wave * height * 0.22 - f * height * 0.26;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
  context.strokeStyle = "#00ffff";
  context.beginPath();
  for (let index = 0; index < points; index += 1) {
    const t = index / (points - 1);
    const f = frequency[Math.floor(t * frequency.length)] / 255;
    const wave = (time[Math.floor(t * time.length)] - 128) / 128;
    const x = t * width;
    const y = midY - wave * height * 0.22 + f * height * 0.26;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
  const bars = Math.max(12, Math.min(48, Math.floor(width / 14)));
  for (let index = 0; index < bars; index += 1) {
    const t = index / bars;
    const f = frequency[Math.floor(t * frequency.length)] / 255;
    const barHeight = Math.max(2, f * height * 0.44);
    const x = Math.round(midX + (index - bars / 2) * 11);
    context.fillStyle = index % 2 ? "#ffff00" : "#ff6600";
    context.fillRect(x, midY - barHeight / 2, 5, barHeight);
  }
}

export function createMusicVisualizer(config = {}, music) {
  const settings = {
    enabled: false,
    style: "wmp-bars",
    edge: "bottom",
    size: 76,
    length: "100%",
    x: 50,
    y: 50,
    fftSize: 512,
    smoothing: 0.72,
    fps: 24,
    ...config
  };
  if (!settings.enabled || !music || typeof music.createAnalyser !== "function") return null;
  const edge = pickEdge(settings.edge);
  const visualStyle = pickStyle(settings.style || settings.type || settings.mode || settings.preset);
  settings.showBackground = showBackground(settings);
  const canvas = createElement("canvas", { className: "music-visualizer__canvas", ariaHidden: "true" });
  const label = createElement("div", { className: "music-visualizer__label", text: visualStyle.replace(/-/g, " ") });
  const backgroundClass = settings.showBackground ? "" : " music-visualizer--transparent";
  const element = createElement("div", { className: `music-visualizer music-visualizer--${edge} music-visualizer--${visualStyle}${backgroundClass}`, ariaHidden: "true" }, [canvas, label]);
  let frame = null;
  let stopped = false;
  let lastFrame = 0;
  let layout = null;
  const audio = music.createAnalyser({ fftSize: settings.fftSize, smoothing: settings.smoothing });
  const frequencyData = new Uint8Array(audio.analyser.frequencyBinCount);
  const timeData = new Uint8Array(audio.analyser.fftSize);
  const events = ["pointerdown", "mousedown", "mouseup", "touchstart", "touchend", "keydown", "click"];
  const resume = () => audio.resume();
  events.forEach((name) => window.addEventListener(name, resume, { capture: true, passive: true }));
  const resize = () => {
    layout = setupCanvas(canvas, element, edge, settings.size, settings.length, percent(settings.x, 50), percent(settings.y, 50));
  };
  const render = (now) => {
    if (stopped) return;
    const frameMs = getMotionFrameMs(settings.fps);
    if (!frameMs || now - lastFrame >= frameMs - 0.5) {
      lastFrame = now;
      audio.analyser.getByteFrequencyData(frequencyData);
      audio.analyser.getByteTimeDomainData(timeData);
      const capturedFrequencyData = limitedFrequencyData(frequencyData, settings, audio);
      if (!layout) resize();
      orientContext(layout.context, layout.ratio, edge, layout.width, layout.height);
      if (visualStyle === "wmp-bars") drawWmpBars(layout.context, layout.width, layout.height, capturedFrequencyData, settings);
      if (visualStyle === "wmp-scope") drawWmpScope(layout.context, layout.width, layout.height, timeData, settings);
      if (visualStyle === "winamp-avs") drawWinampAvs(layout.context, layout.width, layout.height, capturedFrequencyData, timeData, settings);
    }
    frame = requestAnimationFrame(render);
  };
  window.addEventListener("resize", resize);
  resize();
  frame = requestAnimationFrame(render);
  element.destroy = () => {
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
    events.forEach((name) => window.removeEventListener(name, resume, true));
  };
  return element;
}
