import { createElement } from "./dom.js";
import { githubApiBlocked, githubApiEnabled, loadGithubContents } from "./github-contents.js";
import { getMotionFrameCount, isMotionStepped } from "./motion.js";

const imageExtensions = [".gif", ".png"];
const defaultEdges = ["top", "right", "bottom", "left"];

function cleanPath(value) {
  return String(value || "").trim().replace(/^\/+|\/+$/g, "");
}

function hasImageExtension(path) {
  const lower = String(path || "").toLowerCase().split("?")[0].split("#")[0];
  return imageExtensions.some((extension) => lower.endsWith(extension));
}

function listValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(/[\n,|]+/);
  if (typeof value === "object") return value.files || value.images || value.gifs || value.entries || value.items || [];
  return [];
}

function uniqueFiles(files) {
  return [...new Set(listValues(files).map(cleanPath).filter(hasImageExtension))];
}

function basePathParts() {
  return new URL(".", document.baseURI).pathname.split("/").filter(Boolean);
}

function browserFolderFromPath(path) {
  const cleaned = cleanPath(path);
  if (!cleaned) return "assets/peekGifs";
  const parts = basePathParts();
  if (parts.length && cleaned === parts.join("/")) return "assets/peekGifs";
  if (parts.length && cleaned.startsWith(`${parts.join("/")}/`)) return cleaned.slice(parts.join("/").length + 1) || "assets/peekGifs";
  return cleaned;
}

function publicFolder(config) {
  return cleanPath(config.publicPath || config.assetBase || config.urlPath || config.webPath || config.browserPath || config.folderPublicPath) || browserFolderFromPath(config.path || config.githubPath || config.peekPath || config.imagePath || config.folder || "assets/peekGifs");
}

function assetUrl(file, config) {
  if (/^https?:\/\//i.test(file)) return file;
  const base = publicFolder(config);
  const normalized = cleanPath(file);
  const parts = basePathParts();
  const appPrefix = parts.join("/");
  const withoutAppPrefix = appPrefix && normalized.startsWith(`${appPrefix}/`) ? normalized.slice(appPrefix.length + 1) : normalized;
  if (withoutAppPrefix.startsWith(`${base}/`) || withoutAppPrefix.startsWith("assets/")) return new URL(withoutAppPrefix.split("/").map(encodeURIComponent).join("/"), document.baseURI).href;
  const stripped = withoutAppPrefix.replace(/^assets\/peekGifs\//, "");
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
  const explicitPath = cleanPath(config.path || config.githubPath || config.peekPath || config.imagePath || config.folder);
  const add = (path) => {
    const cleaned = cleanPath(path);
    if (cleaned && !paths.includes(cleaned)) paths.push(cleaned);
  };
  if (explicitPath) add(explicitPath);
  const parts = basePathParts();
  const host = location.hostname.toLowerCase();
  if (!host.endsWith(".github.io") && parts.length) add(`${parts.join("/")}/assets/peekGifs`);
  add("assets/peekGifs");
  if (host.endsWith(".github.io") && parts.length > 1) add(`${parts.join("/")}/assets/peekGifs`);
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

function hasDiscoveryConfig(config) {
  return Boolean(config.path || config.githubPath || config.peekPath || config.imagePath || config.folder || config.files || config.manifest || config.directoryListing);
}

async function resolvePeekFiles(config) {
  const listed = uniqueFiles(config.files || config.images || config.gifs || config.entries || config.items || config.list || []);
  if (listed.length) return listed;
  const manifest = uniqueFiles(await loadManifest(manifestPath(config)).catch(() => []));
  if (manifest.length) return manifest;
  const github = uniqueFiles(await loadGithubFiles(config).catch(() => []));
  if (github.length) return github;
  if (config.directoryListing === true) {
    const directory = uniqueFiles(await loadDirectoryFiles(config.directory || `${publicFolder(config)}/`).catch(() => []));
    if (directory.length) return directory;
  }
  const src = uniqueFiles(config.src || config.source || config.image || config.gif || config.url);
  if (src.length) return src;
  return [];
}

function randomBetween(min, max) {
  if (max <= min) return Math.round((min + max) / 2);
  return Math.round(min + Math.random() * (max - min));
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getTaskbarHeight() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--taskbar-height").trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 30;
}

function workspaceHeight() {
  return Math.max(0, window.innerHeight - getTaskbarHeight());
}

function normalizeEdges(value) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,|]+/) : defaultEdges;
  const edges = source.map((edge) => String(edge || "").toLowerCase().trim()).filter((edge) => defaultEdges.includes(edge));
  return edges.length ? [...new Set(edges)] : defaultEdges;
}

function imageMetrics(image, width) {
  const ratio = image.naturalWidth && image.naturalHeight ? image.naturalHeight / image.naturalWidth : 1.2;
  return {
    tangentSize: Math.max(1, width),
    normalSize: Math.max(1, width * ratio)
  };
}

function edgeLength(edge) {
  return edge === "top" || edge === "bottom" ? window.innerWidth : workspaceHeight();
}

function edgeLimit(settings, edge) {
  const value = settings.maxImagesByEdge[edge] ?? settings.maxImagesPerEdge;
  return Math.max(1, Math.round(numberValue(value, settings.maxImagesPerEdge)));
}

function edgeHasRoom(settings, edge) {
  return settings.activeByEdge[edge].length < edgeLimit(settings, edge);
}

function nextEdge(settings) {
  for (let attempt = 0; attempt < settings.edges.length; attempt += 1) {
    const edge = settings.edges[settings.nextEdgeIndex % settings.edges.length];
    settings.nextEdgeIndex = (settings.nextEdgeIndex + 1) % settings.edges.length;
    if (edgeHasRoom(settings, edge)) return edge;
  }
  return "";
}

function positionOnEdge(settings, edge, tangentSize) {
  const length = edgeLength(edge);
  const margin = Math.max(0, numberValue(settings.margin, 10));
  const gap = Math.max(0, numberValue(settings.gap, 18));
  const half = Math.max(1, tangentSize / 2);
  const min = margin + half;
  const max = length - margin - half;
  if (max < min) return null;
  const slots = settings.activeByEdge[edge];
  const overlaps = (position) => slots.some((slot) => Math.abs(position - slot.position) < half + slot.half + gap);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const position = randomBetween(min, max);
    if (!overlaps(position)) return position;
  }
  const sorted = [...slots].sort((a, b) => a.position - b.position);
  const candidates = [min, (min + max) / 2, max];
  for (let index = 0; index <= sorted.length; index += 1) {
    const start = index === 0 ? min : sorted[index - 1].position + sorted[index - 1].half + gap + half;
    const end = index === sorted.length ? max : sorted[index].position - sorted[index].half - gap - half;
    if (end >= start) candidates.push((start + end) / 2);
  }
  return candidates.find((position) => position >= min && position <= max && !overlaps(position)) ?? null;
}

function setSpritePosition(sprite, edge, position, metrics) {
  const distance = Math.ceil(metrics.normalSize) + 4;
  sprite.style.setProperty("--peek-distance", `${distance}px`);
  if (edge === "top") {
    sprite.style.left = `${Math.round(position)}px`;
    sprite.style.top = "0px";
    return;
  }
  if (edge === "bottom") {
    sprite.style.left = `${Math.round(position)}px`;
    sprite.style.top = `${Math.round(workspaceHeight())}px`;
    return;
  }
  if (edge === "left") {
    sprite.style.left = "0px";
    sprite.style.top = `${Math.round(position)}px`;
    return;
  }
  sprite.style.left = `${Math.round(window.innerWidth)}px`;
  sprite.style.top = `${Math.round(position)}px`;
}

function createSprite(file, settings) {
  const width = randomBetween(settings.minWidth, settings.maxWidth);
  const image = createElement("img", {
    className: "edge-peek__image",
    src: assetUrl(file, settings),
    alt: settings.alt,
    decoding: "async",
    draggable: false
  });
  const sprite = createElement("div", {
    className: "edge-peek__sprite",
    ariaHidden: "true"
  }, [image]);
  sprite.style.setProperty("--peek-width", `${width}px`);
  sprite.style.setProperty("--peek-duration", `${settings.motionMs}ms`);
  sprite.style.setProperty("--peek-frames", String(getMotionFrameCount(settings.motionMs, settings.fps)));
  sprite.style.setProperty("--peek-timing", isMotionStepped(settings.fps) ? `steps(${getMotionFrameCount(settings.motionMs, settings.fps)}, end)` : "linear");
  return { sprite, image, width };
}

export async function createEdgePeek(options = {}) {
  const files = await resolvePeekFiles(options);
  const maxImagesPerEdge = Math.max(1, Math.round(numberValue(options.maxImagesPerEdge ?? options.maxImagePerEdge ?? options.maxPerEdge, 1)));
  const maxImagesByEdge = options.maxImagesByEdge || options.maxPerEdgeByEdge || {};
  const settings = {
    alt: options.alt || "Peeking image from the desktop edge",
    spawnEveryMs: Math.max(100, numberValue(options.spawnEveryMs ?? options.spawnEverySomething ?? options.intervalMs, 10000)),
    initialDelayMs: Math.max(0, numberValue(options.initialDelayMs, 300)),
    visibleMs: Math.max(0, numberValue(options.visibleMs ?? options.holdMs, 3000)),
    motionMs: Math.max(1, numberValue(options.motionMs ?? options.transitionMs, 750)),
    minWidth: Math.max(8, numberValue(options.minWidth ?? options.minwidth, 104)),
    maxWidth: Math.max(8, numberValue(options.maxWidth ?? options.maxwidth, 178)),
    maxOnScreen: Math.max(1, Math.round(numberValue(options.maxOnScreen ?? options.maxImages, maxImagesPerEdge * normalizeEdges(options.edges || options.edgeOrder).length))),
    maxImagesPerEdge,
    maxImagesByEdge,
    gap: Math.max(0, numberValue(options.gap ?? options.gaps ?? options.edgeGap ?? options.edgeGaps, 18)),
    margin: Math.max(0, numberValue(options.margin ?? options.edgeMargin, 10)),
    fps: numberValue(options.fps, 24),
    edges: normalizeEdges(options.edges || options.edgeOrder),
    activeByEdge: { top: [], right: [], bottom: [], left: [] },
    nextEdgeIndex: 0
  };
  settings.maxWidth = Math.max(settings.minWidth, settings.maxWidth);
  const host = createElement("section", { className: "edge-peek", "aria-hidden": "true" });
  if (!files.length) return host;
  let active = 0;
  let nextIndex = 0;
  const nextFile = () => {
    const file = files[nextIndex % files.length];
    nextIndex = (nextIndex + 1) % files.length;
    return file;
  };
  const removeSlot = (edge, slot) => {
    settings.activeByEdge[edge] = settings.activeByEdge[edge].filter((item) => item !== slot);
  };
  const spawn = () => {
    if (!host.isConnected || active >= settings.maxOnScreen) return;
    const edge = nextEdge(settings);
    if (!edge) return;
    active += 1;
    const { sprite, image, width } = createSprite(nextFile(), settings);
    let started = false;
    let slot = null;
    const remove = () => {
      if (slot) removeSlot(edge, slot);
      sprite.remove();
      active = Math.max(0, active - 1);
    };
    const hide = () => {
      sprite.classList.remove("is-visible");
      window.setTimeout(remove, settings.motionMs);
    };
    const begin = () => {
      if (started) return;
      started = true;
      if (!host.isConnected) return remove();
      const metrics = imageMetrics(image, width);
      const position = positionOnEdge(settings, edge, metrics.tangentSize);
      if (position === null) return remove();
      slot = { position, half: metrics.tangentSize / 2 };
      settings.activeByEdge[edge].push(slot);
      sprite.dataset.edge = edge;
      sprite.classList.add("is-preparing");
      setSpritePosition(sprite, edge, position, metrics);
      sprite.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          sprite.classList.remove("is-preparing");
          sprite.classList.add("is-visible");
          window.setTimeout(hide, settings.visibleMs);
        });
      });
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
