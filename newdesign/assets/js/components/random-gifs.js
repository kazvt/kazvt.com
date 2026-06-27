import { createElement } from "./dom.js";
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

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
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
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  const endpoint = `https://api.github.com/repos/${repository}/contents/${path}${ref}`;
  const response = await fetch(endpoint, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data.filter((item) => item && item.type === "file" && hasImageExtension(item.name)).map((item) => item.name);
}

async function loadGithubFiles(config) {
  const repository = inferRepository(config.repository);
  if (!repository) return [];
  const branch = cleanPath(config.branch);
  for (const path of candidateGithubPaths(config)) {
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

function applySpriteTransform(sprite, state) {
  const scale = finiteNumber(state.s, 1).toFixed(4);
  const rotation = finiteNumber(state.r, 0).toFixed(3);
  sprite.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
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
      sprite.style.transform = "scale(1) rotate(0deg)";
      window.setTimeout(() => runSpriteAnimation(sprite, false, direction, settings, remove), settings.holdMs);
    } else {
      remove();
    }
    return;
  }
  const state = intro ? { s: 0, r: direction * -22 } : { s: 1, r: 0 };
  const frameMs = getMotionFrameMs(settings.fps);
  let lastFrame = 0;
  sprite.style.transformOrigin = "50% 50%";
  applySpriteTransform(sprite, state);
  const config = intro ? {
    s: [
      { value: 1.16, duration: windowDuration, easing: "easeOutElastic(1.35, .52)" },
      { value: 0.9, duration: 520, easing: "easeInOutSine" },
      { value: 1.08, duration: 660, easing: "easeOutElastic(1.08, .58)" },
      { value: 0.965, duration: 620, easing: "easeInOutSine" },
      { value: 1.025, duration: 600, easing: "easeOutElastic(1, .62)" },
      { value: 1, duration: 600, easing: "easeOutQuad" }
    ],
    r: [
      { value: direction * 17, duration: windowDuration, easing: "easeOutElastic(1.22, .48)" },
      { value: direction * -9, duration: 520, easing: "easeInOutSine" },
      { value: direction * 5.2, duration: 660, easing: "easeOutElastic(1, .56)" },
      { value: direction * -2.8, duration: 620, easing: "easeInOutSine" },
      { value: direction * 1.2, duration: 600, easing: "easeOutQuad" },
      { value: 0, duration: 600, easing: "easeOutQuad" }
    ]
  } : {
    s: [
      { value: 1.09, duration: 520, easing: "easeOutQuad" },
      { value: 0.94, duration: 560, easing: "easeInOutSine" },
      { value: 1.06, duration: 560, easing: "easeOutQuad" },
      { value: 0.98, duration: 460, easing: "easeInOutSine" },
      { value: 0, duration: windowDuration, easing: "easeInOutElastic(1.1, .6)" }
    ],
    r: [
      { value: direction * -7, duration: 520, easing: "easeOutQuad" },
      { value: direction * 9, duration: 560, easing: "easeInOutSine" },
      { value: direction * -5, duration: 560, easing: "easeOutQuad" },
      { value: direction * 3, duration: 460, easing: "easeInOutSine" },
      { value: direction * 24, duration: windowDuration, easing: "easeInOutElastic(1.05, .58)" }
    ]
  };
  anime({
    targets: state,
    ...config,
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
  const settings = {
    spawnEveryMs: Math.max(1500, Number(config.spawnEveryMs) || Number(config.intervalMs) || 8500),
    initialDelayMs: Math.max(0, Number(config.initialDelayMs) || 1200),
    maxOnScreen: Math.max(1, Number(config.maxOnScreen) || 3),
    minHeight: Math.max(12, Number(config.minHeight) || 46),
    maxHeight: Math.max(12, Number(config.maxHeight) || 116),
    holdMs: Math.max(0, Number(config.holdMs) || 1300),
    fps: Number(config.fps) || 24
  };
  let active = 0;
  const spawn = () => {
    if (!host.isConnected || active >= settings.maxOnScreen) return;
    active += 1;
    const height = randomBetween(settings.minHeight, settings.maxHeight);
    const direction = Math.random() < 0.5 ? -1 : 1;
    const image = createElement("img", {
      className: "random-gifs__image",
      src: assetUrl(pick(files), config),
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
