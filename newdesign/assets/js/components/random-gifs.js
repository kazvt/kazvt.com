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

function applySpriteTransform(sprite, state) {
  const scaleX = finiteNumber(state.sx, 1).toFixed(4);
  const scaleY = finiteNumber(state.sy, 1).toFixed(4);
  const rotation = finiteNumber(state.r, 0).toFixed(3);
  sprite.style.transform = `scale(${scaleX}, ${scaleY}) rotate(${rotation}deg)`;
}

function ms(value) {
  return Math.max(1, Math.round(value));
}

function introScaleX(settleInMs) {
  const keys = [
    { value: 0.14, duration: 0 },
    { value: 0.74, duration: 210, easing: "easeOutCubic" },
    { value: 1.32, duration: 230, easing: "easeOutBack" },
    { value: 0.84, duration: 170, easing: "easeInOutSine" },
    { value: 1.12, duration: 190, easing: "easeOutQuad" },
    { value: 0.98, duration: 200, easing: "easeInOutSine" }
  ];
  if (settleInMs > 0) keys.push(
    { value: 1.065, duration: ms(settleInMs * 0.16), easing: "easeOutSine" },
    { value: 0.962, duration: ms(settleInMs * 0.18), easing: "easeInOutSine" },
    { value: 1.032, duration: ms(settleInMs * 0.2), easing: "easeOutQuad" },
    { value: 0.986, duration: ms(settleInMs * 0.2), easing: "easeInOutSine" },
    { value: 1.01, duration: ms(settleInMs * 0.14), easing: "easeOutSine" },
    { value: 1, duration: ms(settleInMs * 0.12), easing: "easeOutQuad" }
  );
  else keys.push({ value: 1, duration: 1, easing: "linear" });
  return keys;
}

function introScaleY(settleInMs) {
  const keys = [
    { value: 0.06, duration: 0 },
    { value: 1.38, duration: 210, easing: "easeOutCubic" },
    { value: 0.68, duration: 230, easing: "easeOutBack" },
    { value: 1.18, duration: 170, easing: "easeInOutSine" },
    { value: 0.92, duration: 190, easing: "easeOutQuad" },
    { value: 1.02, duration: 200, easing: "easeInOutSine" }
  ];
  if (settleInMs > 0) keys.push(
    { value: 0.946, duration: ms(settleInMs * 0.16), easing: "easeOutSine" },
    { value: 1.042, duration: ms(settleInMs * 0.18), easing: "easeInOutSine" },
    { value: 0.972, duration: ms(settleInMs * 0.2), easing: "easeOutQuad" },
    { value: 1.014, duration: ms(settleInMs * 0.2), easing: "easeInOutSine" },
    { value: 0.993, duration: ms(settleInMs * 0.14), easing: "easeOutSine" },
    { value: 1, duration: ms(settleInMs * 0.12), easing: "easeOutQuad" }
  );
  else keys.push({ value: 1, duration: 1, easing: "linear" });
  return keys;
}

function introRotation(direction, settleInMs) {
  const keys = [
    { value: direction * -20, duration: 0 },
    { value: direction * 18, duration: 210, easing: "easeOutCubic" },
    { value: direction * -14, duration: 230, easing: "easeOutBack" },
    { value: direction * 9, duration: 170, easing: "easeInOutSine" },
    { value: direction * -5.5, duration: 190, easing: "easeOutQuad" },
    { value: direction * 3.5, duration: 200, easing: "easeInOutSine" }
  ];
  if (settleInMs > 0) keys.push(
    { value: direction * -3.2, duration: ms(settleInMs * 0.16), easing: "easeOutSine" },
    { value: direction * 2.1, duration: ms(settleInMs * 0.18), easing: "easeInOutSine" },
    { value: direction * -1.35, duration: ms(settleInMs * 0.2), easing: "easeOutQuad" },
    { value: direction * 0.75, duration: ms(settleInMs * 0.2), easing: "easeInOutSine" },
    { value: direction * -0.25, duration: ms(settleInMs * 0.14), easing: "easeOutSine" },
    { value: 0, duration: ms(settleInMs * 0.12), easing: "easeOutQuad" }
  );
  else keys.push({ value: 0, duration: 1, easing: "linear" });
  return keys;
}

function outroScaleX(settleOutMs) {
  const keys = [];
  if (settleOutMs > 0) keys.push(
    { value: 1.08, duration: ms(settleOutMs * 0.18), easing: "easeOutSine" },
    { value: 0.9, duration: ms(settleOutMs * 0.18), easing: "easeInOutSine" },
    { value: 1.16, duration: ms(settleOutMs * 0.22), easing: "easeOutQuad" },
    { value: 0.96, duration: ms(settleOutMs * 0.18), easing: "easeInOutSine" },
    { value: 1.05, duration: ms(settleOutMs * 0.14), easing: "easeOutSine" },
    { value: 1, duration: ms(settleOutMs * 0.1), easing: "easeOutQuad" }
  );
  keys.push(
    { value: 0.72, duration: 180, easing: "easeInSine" },
    { value: 1.12, duration: 180, easing: "easeOutQuad" },
    { value: 0.08, duration: 640, easing: "easeInBack" }
  );
  return keys;
}

function outroScaleY(settleOutMs) {
  const keys = [];
  if (settleOutMs > 0) keys.push(
    { value: 0.93, duration: ms(settleOutMs * 0.18), easing: "easeOutSine" },
    { value: 1.12, duration: ms(settleOutMs * 0.18), easing: "easeInOutSine" },
    { value: 0.84, duration: ms(settleOutMs * 0.22), easing: "easeOutQuad" },
    { value: 1.04, duration: ms(settleOutMs * 0.18), easing: "easeInOutSine" },
    { value: 0.97, duration: ms(settleOutMs * 0.14), easing: "easeOutSine" },
    { value: 1, duration: ms(settleOutMs * 0.1), easing: "easeOutQuad" }
  );
  keys.push(
    { value: 1.28, duration: 180, easing: "easeInSine" },
    { value: 0.78, duration: 180, easing: "easeOutQuad" },
    { value: 0.04, duration: 640, easing: "easeInBack" }
  );
  return keys;
}

function outroRotation(direction, settleOutMs) {
  const keys = [];
  if (settleOutMs > 0) keys.push(
    { value: direction * 4, duration: ms(settleOutMs * 0.18), easing: "easeOutSine" },
    { value: direction * -5.8, duration: ms(settleOutMs * 0.18), easing: "easeInOutSine" },
    { value: direction * 7.8, duration: ms(settleOutMs * 0.22), easing: "easeOutQuad" },
    { value: direction * -3.6, duration: ms(settleOutMs * 0.18), easing: "easeInOutSine" },
    { value: direction * 1.8, duration: ms(settleOutMs * 0.14), easing: "easeOutSine" },
    { value: 0, duration: ms(settleOutMs * 0.1), easing: "easeOutQuad" }
  );
  keys.push(
    { value: direction * -10, duration: 180, easing: "easeInSine" },
    { value: direction * 14, duration: 180, easing: "easeOutQuad" },
    { value: direction * 31, duration: 640, easing: "easeInBack" }
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

function placeSprite(sprite, image, height) {
  const dimensions = imageDimensions(image, height);
  const margin = 12;
  const maxLeft = Math.max(margin, window.innerWidth - dimensions.width - margin);
  const maxTop = Math.max(margin, workspaceHeight() - dimensions.height - margin);
  sprite.style.left = `${randomBetween(margin, maxLeft)}px`;
  sprite.style.top = `${randomBetween(margin, maxTop)}px`;
}

function runSpriteAnimation(sprite, intro, direction, settings, remove) {
  const anime = window.anime;
  if (!anime) {
    if (intro) {
      sprite.style.transform = "scale(1, 1) rotate(0deg)";
      window.setTimeout(() => runSpriteAnimation(sprite, false, direction, settings, remove), settings.holdMs);
    } else {
      remove();
    }
    return;
  }
  const state = intro ? { sx: 0.14, sy: 0.06, r: direction * -20 } : { sx: 1, sy: 1, r: 0 };
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
    fps: settingNumber(config.fps, 24)
  };
  let active = 0;
  let nextIndex = 0;
  const nextFile = () => {
    const file = files[nextIndex % files.length];
    nextIndex = (nextIndex + 1) % files.length;
    return file;
  };
  const spawn = () => {
    if (!host.isConnected || active >= settings.maxOnScreen) return;
    active += 1;
    const height = randomBetween(settings.minHeight, settings.maxHeight);
    const direction = Math.random() < 0.5 ? -1 : 1;
    const image = createElement("img", {
      className: "random-gifs__image",
      src: assetUrl(nextFile(), config),
      alt: "",
      decoding: "async",
      draggable: "false"
    });
    const sprite = createElement("div", { className: "random-gifs__sprite" }, [image]);
    sprite.style.height = `${height}px`;
    sprite.style.visibility = "hidden";
    let started = false;
    const remove = () => {
      sprite.remove();
      active = Math.max(0, active - 1);
    };
    const begin = () => {
      if (started) return;
      started = true;
      if (!host.isConnected) return remove();
      placeSprite(sprite, image, height);
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
