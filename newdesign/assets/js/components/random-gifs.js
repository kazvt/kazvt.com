import { createElement } from "./dom.js";
import { githubApiBlocked, githubApiEnabled, loadGithubContents } from "./github-contents.js";
import { getMotionFrameMs } from "./motion.js";

const imageExtensions = [".gif", ".png"];
const windowDuration = 1000;

function cleanPath(value) {
  return String(value || "").trim().replace(/^\/+|\/+$/g, "");
}

function hasImageExtension(path) {
  const lower = String(path || "").toLowerCase().split("?")[0].split("#")[0];
  return imageExtensions.some((extension) => lower.endsWith(extension));
}

function uniqueFiles(files) {
  return [...new Set((files || []).map(cleanPath).filter(hasImageExtension))];
}

function randomBetween(min, max) {
  if (max <= min) return Math.round((min + max) / 2);
  return Math.round(min + Math.random() * (max - min));
}

function basePathParts() {
  return new URL(".", document.baseURI).pathname.split("/").filter(Boolean);
}

function browserFolderFromPath(path) {
  const cleaned = cleanPath(path);
  if (!cleaned) return "assets/randomGifs";
  const parts = basePathParts();
  if (parts.length && cleaned === parts.join("/")) return "assets/randomGifs";
  if (parts.length && cleaned.startsWith(`${parts.join("/")}/`)) return cleaned.slice(parts.join("/").length + 1) || "assets/randomGifs";
  return cleaned;
}

function publicFolder(config) {
  return cleanPath(config.publicPath || config.assetBase || config.urlPath || config.webPath || config.browserPath || config.folderPublicPath) || browserFolderFromPath(config.path || config.githubPath || config.randomGifsPath || config.imagePath || config.folder || "assets/randomGifs");
}

function assetUrl(file, config) {
  if (/^https?:\/\//i.test(file)) return file;
  const base = publicFolder(config);
  const normalized = cleanPath(file);
  const stripped = normalized.startsWith(`${base}/`) ? normalized.slice(base.length + 1) : normalized.replace(/^assets\/randomGifs\//, "");
  return new URL(`${base}/${stripped.split("/").map(encodeURIComponent).join("/")}`, document.baseURI).href;
}

function inferRepository(repository) {
  const explicit = cleanPath(repository);
  if (explicit) return explicit;
  const host = location.hostname.toLowerCase();
  if (!host.endsWith(".github.io")) return "";
  const owner = host.replace(/\.github\.io$/, "");
  const parts = basePathParts();
  const repo = parts[0] || `${owner}.github.io`;
  return `${owner}/${repo}`;
}

function candidateGithubPaths(config) {
  const paths = [];
  const explicitPath = cleanPath(config.path || config.githubPath || config.randomGifsPath || config.imagePath || config.folder);
  const add = (path) => {
    const cleaned = cleanPath(path);
    if (cleaned && !paths.includes(cleaned)) paths.push(cleaned);
  };
  if (explicitPath) add(explicitPath);
  const parts = basePathParts();
  const host = location.hostname.toLowerCase();
  if (!host.endsWith(".github.io") && parts.length) add(`${parts.join("/")}/assets/randomGifs`);
  add("assets/randomGifs");
  if (host.endsWith(".github.io") && parts.length > 1) add(`${parts.join("/")}/assets/randomGifs`);
  return paths;
}

async function loadManifest(path) {
  if (!path) return [];
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return [];
  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.files)) return data.files;
  return [];
}

async function loadGithubPath(repository, branch, path) {
  const data = await loadGithubContents(repository, branch, path);
  return data.filter((item) => item && item.type === "file" && hasImageExtension(item.name)).map((item) => item.name);
}

async function loadGithubFiles(config) {
  if (!githubApiEnabled(config)) return [];
  const repository = inferRepository(config.repository);
  if (!repository) return [];
  const branch = cleanPath(config.branch);
  for (const path of candidateGithubPaths(config)) {
    if (githubApiBlocked()) return [];
    const files = await loadGithubPath(repository, branch, path).catch(() => []);
    if (files.length) return files;
  }
  return [];
}

async function loadDirectoryFiles(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return [];
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("a[href]")].map((link) => link.getAttribute("href")).filter(hasImageExtension).map((href) => new URL(href, new URL(path, document.baseURI)).href);
}

function manifestPath(config) {
  if (config.manifest === false || config.manifest === null) return "";
  if (typeof config.manifest === "string" && config.manifest.trim()) return config.manifest;
  return `${publicFolder(config)}/manifest.json`;
}

async function resolveRandomFiles(config) {
  const listed = uniqueFiles(config.files || []);
  if (listed.length) return listed;
  const manifest = uniqueFiles(await loadManifest(manifestPath(config)).catch(() => []));
  if (manifest.length) return manifest;
  const github = uniqueFiles(await loadGithubFiles(config).catch(() => []));
  if (github.length) return github;
  if (config.directoryListing === true) return uniqueFiles(await loadDirectoryFiles(config.directory || `${publicFolder(config)}/`).catch(() => []));
  return [];
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function settingNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}


function cssNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Number(number.toFixed(3));
}

function normalizeShadowLayer(layer, fallback = {}) {
  if (typeof layer === "string") {
    const trimmed = layer.trim();
    if (!trimmed || trimmed === "none") return null;
    return null;
  }
  if (!layer || typeof layer !== "object") return null;
  const x = cssNumber(layer.x ?? layer.offsetX ?? layer.dx ?? layer.right ?? fallback.x, 15);
  const y = cssNumber(layer.y ?? layer.offsetY ?? layer.dy ?? layer.down ?? fallback.y, 15);
  const blur = cssNumber(layer.blur ?? layer.blurRadius ?? fallback.blur, 0);
  const color = String(layer.color ?? layer.colour ?? fallback.color ?? "#000").trim() || "#000";
  return { x, y, blur, color };
}

function normalizeShadowPreset(preset) {
  const layers = Array.isArray(preset)
    ? preset.map((layer) => normalizeShadowLayer(layer)).filter(Boolean)
    : preset && typeof preset === "object" && Array.isArray(preset.layers)
      ? preset.layers.map((layer) => normalizeShadowLayer(layer, preset)).filter(Boolean)
      : [normalizeShadowLayer(preset)].filter(Boolean);
  return layers;
}

function normalizeShadowCycle(config) {
  const value = config.shadows ?? config.shadowCycle ?? config.hardShadows ?? config.dropShadows ?? config.shadow;
  if (Array.isArray(value)) {
    const shadows = value.map(normalizeShadowPreset).filter((layers) => layers.length);
    if (shadows.length) return shadows;
  }
  const single = normalizeShadowPreset(value);
  if (single.length) return [single];
  return [[{ x: 15, y: 15, blur: 0, color: "#000" }]];
}

function createShadowLayer(src, layer) {
  const element = createElement("span", { className: "random-gifs__shadow" });
  const url = `url("${String(src).replaceAll('"', "%22")}")`;
  element.style.webkitMaskImage = url;
  element.style.maskImage = url;
  element.style.backgroundColor = layer.color;
  element.style.transform = `translate(${layer.x}px, ${layer.y}px)`;
  if (layer.blur > 0) element.style.filter = `blur(${layer.blur}px)`;
  return element;
}

function applySpriteTransform(sprite, state) {
  const scaleX = finiteNumber(state.sx, 1).toFixed(4);
  const scaleY = finiteNumber(state.sy, 1).toFixed(4);
  const rotation = finiteNumber(state.r, 0).toFixed(3);
  const squash = sprite.firstElementChild;
  sprite.style.transform = `rotate(${rotation}deg)`;
  if (squash) squash.style.transform = `scale(${scaleX}, ${scaleY})`;
}

function ms(value) {
  return Math.max(1, Math.round(value));
}

function introScaleX(settleInMs) {
  const keys = [
    { value: 0.16, duration: 0 },
    { value: 1.34, duration: 190, easing: "easeOutCubic" },
    { value: 0.82, duration: 170, easing: "easeInOutSine" },
    { value: 1.17, duration: 160, easing: "easeOutSine" },
    { value: 0.94, duration: 150, easing: "easeInOutSine" },
    { value: 1.07, duration: 140, easing: "easeOutQuad" }
  ];
  if (settleInMs > 0) keys.push(
    { value: 0.968, duration: ms(settleInMs * 0.14), easing: "easeInOutSine" },
    { value: 1.034, duration: ms(settleInMs * 0.16), easing: "easeOutSine" },
    { value: 0.984, duration: ms(settleInMs * 0.18), easing: "easeInOutSine" },
    { value: 1.014, duration: ms(settleInMs * 0.18), easing: "easeOutQuad" },
    { value: 0.995, duration: ms(settleInMs * 0.16), easing: "easeInOutSine" },
    { value: 1, duration: ms(settleInMs * 0.18), easing: "easeOutQuad" }
  );
  else keys.push({ value: 1, duration: 1, easing: "linear" });
  return keys;
}

function introScaleY(settleInMs) {
  const keys = [
    { value: 0.12, duration: 0 },
    { value: 0.76, duration: 190, easing: "easeOutCubic" },
    { value: 1.28, duration: 170, easing: "easeInOutSine" },
    { value: 0.88, duration: 160, easing: "easeOutSine" },
    { value: 1.13, duration: 150, easing: "easeInOutSine" },
    { value: 0.97, duration: 140, easing: "easeOutQuad" }
  ];
  if (settleInMs > 0) keys.push(
    { value: 1.026, duration: ms(settleInMs * 0.14), easing: "easeInOutSine" },
    { value: 0.972, duration: ms(settleInMs * 0.16), easing: "easeOutSine" },
    { value: 1.015, duration: ms(settleInMs * 0.18), easing: "easeInOutSine" },
    { value: 0.988, duration: ms(settleInMs * 0.18), easing: "easeOutQuad" },
    { value: 1.004, duration: ms(settleInMs * 0.16), easing: "easeInOutSine" },
    { value: 1, duration: ms(settleInMs * 0.18), easing: "easeOutQuad" }
  );
  else keys.push({ value: 1, duration: 1, easing: "linear" });
  return keys;
}

function introRotation(direction, settleInMs) {
  const keys = [
    { value: direction * -4.5, duration: 0 },
    { value: direction * 3.2, duration: 210, easing: "easeOutCubic" },
    { value: direction * -2.2, duration: 220, easing: "easeInOutSine" },
    { value: direction * 1.2, duration: 200, easing: "easeOutQuad" }
  ];
  if (settleInMs > 0) keys.push(
    { value: direction * -0.7, duration: ms(settleInMs * 0.22), easing: "easeInOutSine" },
    { value: direction * 0.35, duration: ms(settleInMs * 0.22), easing: "easeOutSine" },
    { value: direction * -0.14, duration: ms(settleInMs * 0.2), easing: "easeInOutSine" },
    { value: 0, duration: ms(settleInMs * 0.2), easing: "easeOutQuad" }
  );
  else keys.push({ value: 0, duration: 1, easing: "linear" });
  return keys;
}

function outroScaleX(settleOutMs) {
  const keys = [];
  if (settleOutMs > 0) keys.push(
    { value: 0.88, duration: ms(settleOutMs * 0.13), easing: "easeOutSine" },
    { value: 1.22, duration: ms(settleOutMs * 0.14), easing: "easeInOutSine" },
    { value: 0.82, duration: ms(settleOutMs * 0.13), easing: "easeOutQuad" },
    { value: 1.16, duration: ms(settleOutMs * 0.12), easing: "easeInOutSine" },
    { value: 0.94, duration: ms(settleOutMs * 0.1), easing: "easeOutSine" },
    { value: 1.06, duration: ms(settleOutMs * 0.1), easing: "easeInOutSine" },
    { value: 1, duration: ms(settleOutMs * 0.1), easing: "easeOutQuad" }
  );
  keys.push(
    { value: 1.24, duration: 135, easing: "easeOutCubic" },
    { value: 0.76, duration: 115, easing: "easeInOutSine" },
    { value: 1.42, duration: 125, easing: "easeOutBack" },
    { value: 0.18, duration: 255, easing: "easeInBack" },
    { value: 0, duration: 370, easing: "easeInExpo" }
  );
  return keys;
}

function outroScaleY(settleOutMs) {
  const keys = [];
  if (settleOutMs > 0) keys.push(
    { value: 1.16, duration: ms(settleOutMs * 0.13), easing: "easeOutSine" },
    { value: 0.82, duration: ms(settleOutMs * 0.14), easing: "easeInOutSine" },
    { value: 1.22, duration: ms(settleOutMs * 0.13), easing: "easeOutQuad" },
    { value: 0.9, duration: ms(settleOutMs * 0.12), easing: "easeInOutSine" },
    { value: 1.07, duration: ms(settleOutMs * 0.1), easing: "easeOutSine" },
    { value: 0.97, duration: ms(settleOutMs * 0.1), easing: "easeInOutSine" },
    { value: 1, duration: ms(settleOutMs * 0.1), easing: "easeOutQuad" }
  );
  keys.push(
    { value: 0.76, duration: 135, easing: "easeOutCubic" },
    { value: 1.34, duration: 115, easing: "easeInOutSine" },
    { value: 0.42, duration: 125, easing: "easeOutBack" },
    { value: 0.08, duration: 255, easing: "easeInBack" },
    { value: 0.02, duration: 370, easing: "easeInExpo" }
  );
  return keys;
}

function outroRotation(direction, settleOutMs) {
  const keys = [];
  if (settleOutMs > 0) keys.push(
    { value: direction * 1.4, duration: ms(settleOutMs * 0.14), easing: "easeOutSine" },
    { value: direction * -1.8, duration: ms(settleOutMs * 0.16), easing: "easeInOutSine" },
    { value: direction * 1.1, duration: ms(settleOutMs * 0.14), easing: "easeOutQuad" },
    { value: direction * -0.55, duration: ms(settleOutMs * 0.12), easing: "easeInOutSine" },
    { value: 0, duration: ms(settleOutMs * 0.12), easing: "easeOutQuad" }
  );
  keys.push(
    { value: direction * -1.6, duration: 135, easing: "easeOutCubic" },
    { value: direction * 1.2, duration: 135, easing: "easeInOutSine" },
    { value: direction * -0.45, duration: 220, easing: "easeOutQuad" },
    { value: 0, duration: 510, easing: "easeInBack" }
  );
  return keys;
}

function imageDimensions(image, height) {
  const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
  return { width: Math.max(1, height * ratio), height };
}

function workspaceHeight() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--taskbar-height").trim();
  const taskbar = Number.parseFloat(value);
  return window.innerHeight - (Number.isFinite(taskbar) ? taskbar : 30);
}

const quadrants = [
  { x: 0.25, y: 0.25 },
  { x: 0.75, y: 0.25 },
  { x: 0.75, y: 0.75 },
  { x: 0.25, y: 0.75 }
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomBias() {
  return (Math.random() + Math.random()) / 2 * 2 - 1;
}

function safeCenterRange(axisSize, spriteSize, margin) {
  const half = spriteSize / 2;
  const min = margin + half;
  const max = axisSize - margin - half;
  if (max < min) return { min: axisSize / 2, max: axisSize / 2 };
  return { min, max };
}

function placeSprite(sprite, image, height, settings) {
  const dimensions = imageDimensions(image, height);
  const margin = Math.max(0, settingNumber(settings.margin, 12));
  const width = window.innerWidth;
  const heightLimit = workspaceHeight();
  const quadrant = quadrants[settings.nextQuadrant % quadrants.length];
  settings.nextQuadrant = (settings.nextQuadrant + 1) % quadrants.length;
  const deadzone = clamp(settingNumber(settings.deadzonePercent, 30), 0, 98);
  const spread = clamp(settingNumber(settings.quadrantSpreadPercent, 100 - deadzone), 2, 100) / 100;
  const radiusX = width * 0.25 * spread;
  const radiusY = heightLimit * 0.25 * spread;
  const rangeX = safeCenterRange(width, dimensions.width, margin);
  const rangeY = safeCenterRange(heightLimit, dimensions.height, margin);
  const centerX = width * quadrant.x;
  const centerY = heightLimit * quadrant.y;
  const spriteCenterX = clamp(centerX + randomBias() * radiusX, rangeX.min, rangeX.max);
  const spriteCenterY = clamp(centerY + randomBias() * radiusY, rangeY.min, rangeY.max);
  sprite.style.left = `${Math.round(spriteCenterX - dimensions.width / 2)}px`;
  sprite.style.top = `${Math.round(spriteCenterY - dimensions.height / 2)}px`;
}

function runSpriteAnimation(sprite, intro, direction, settings, remove) {
  const anime = window.anime;
  if (!anime) {
    if (intro) {
      applySpriteTransform(sprite, { sx: 1, sy: 1, r: 0 });
      window.setTimeout(() => runSpriteAnimation(sprite, false, direction, settings, remove), settings.holdMs);
    } else {
      remove();
    }
    return;
  }
  const state = intro ? { sx: 0.16, sy: 0.12, r: direction * -4.5 } : { sx: 1, sy: 1, r: 0 };
  const frameMs = getMotionFrameMs(settings.fps);
  let lastFrame = 0;
  sprite.style.transformOrigin = "50% 50%";
  applySpriteTransform(sprite, state);
  const animationConfig = intro ? {
    sx: introScaleX(settings.settleInMs),
    sy: introScaleY(settings.settleInMs),
    r: introRotation(direction, settings.settleInMs)
  } : {
    sx: outroScaleX(settings.settleOutMs),
    sy: outroScaleY(settings.settleOutMs),
    r: outroRotation(direction, settings.settleOutMs)
  };
  anime({
    targets: state,
    ...animationConfig,
    update() {
      const now = performance.now();
      if (frameMs > 0 && now - lastFrame < frameMs) return;
      lastFrame = now;
      applySpriteTransform(sprite, state);
    },
    complete() {
      if (intro) window.setTimeout(() => runSpriteAnimation(sprite, false, direction, settings, remove), settings.holdMs);
      else remove();
    }
  });
}

export async function createRandomGifs(config = {}) {
  const host = createElement("section", { className: "random-gifs-host", "aria-hidden": "true" });
  const files = await resolveRandomFiles(config);
  if (!files.length) return host;
  const minHeight = Math.max(12, settingNumber(config.minHeight, 46));
  const maxHeight = Math.max(minHeight, settingNumber(config.maxHeight, 116));
  const settings = {
    spawnEveryMs: Math.max(100, settingNumber(config.spawnEveryMs ?? config.intervalMs, 8500)),
    initialDelayMs: Math.max(0, settingNumber(config.initialDelayMs, 1200)),
    maxOnScreen: Math.max(1, settingNumber(config.maxOnScreen, 3)),
    minHeight,
    maxHeight,
    holdMs: Math.max(0, settingNumber(config.holdMs, 1300)),
    settleInMs: Math.max(0, settingNumber(config.settleInMs ?? config.settleIn ?? config.introSettleMs ?? config.enterSettleMs, 2400)),
    settleOutMs: Math.max(0, settingNumber(config.settleOutMs ?? config.settleOut ?? config.outroSettleMs ?? config.exitSettleMs, 2200)),
    fps: settingNumber(config.fps, 24),
    deadzonePercent: settingNumber(config.deadzonePercent ?? config.deadzone ?? config.quadrantDeadzonePercent, 30),
    quadrantSpreadPercent: config.quadrantSpreadPercent ?? config.spreadPercent ?? config.spawnSpreadPercent,
    margin: settingNumber(config.margin ?? config.edgeMargin, 12),
    nextQuadrant: 0,
    shadows: normalizeShadowCycle(config),
    nextShadow: 0
  };
  let active = 0;
  let nextIndex = 0;
  const activeSources = new Set();
  const nextSource = () => {
    let fallback = "";
    for (let attempt = 0; attempt < files.length; attempt += 1) {
      const file = files[nextIndex % files.length];
      nextIndex = (nextIndex + 1) % files.length;
      const source = assetUrl(file, config);
      if (!fallback) fallback = source;
      if (!activeSources.has(source) || activeSources.size >= files.length) return source;
    }
    return fallback || assetUrl(files[0], config);
  };
  const nextShadow = () => {
    const shadow = settings.shadows[settings.nextShadow % settings.shadows.length];
    settings.nextShadow = (settings.nextShadow + 1) % settings.shadows.length;
    return shadow;
  };
  const spawn = () => {
    if (!host.isConnected || active >= settings.maxOnScreen) return;
    active += 1;
    const height = randomBetween(settings.minHeight, settings.maxHeight);
    const direction = Math.random() < 0.5 ? -1 : 1;
    const source = nextSource();
    activeSources.add(source);
    const image = createElement("img", {
      className: "random-gifs__image",
      src: source,
      alt: "",
      decoding: "async",
      draggable: "false"
    });
    const shadowLayers = nextShadow().map((layer) => createShadowLayer(source, layer));
    const squash = createElement("div", { className: "random-gifs__squash" }, [...shadowLayers, image]);
    const sprite = createElement("div", { className: "random-gifs__sprite" }, [squash]);
    sprite.style.height = `${height}px`;
    sprite.style.visibility = "hidden";
    let started = false;
    const remove = () => {
      activeSources.delete(source);
      sprite.remove();
      active = Math.max(0, active - 1);
    };
    const begin = () => {
      if (started) return;
      started = true;
      if (!host.isConnected) return remove();
      placeSprite(sprite, image, height, settings);
      sprite.style.visibility = "visible";
      runSpriteAnimation(sprite, true, direction, settings, remove);
    };
    image.addEventListener("load", begin, { once: true });
    image.addEventListener("error", remove, { once: true });
    host.append(sprite);
    if (image.complete && image.naturalWidth) begin();
  };
  window.setTimeout(spawn, settings.initialDelayMs);
  window.setInterval(spawn, settings.spawnEveryMs);
  return host;
}
