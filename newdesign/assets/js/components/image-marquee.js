import { createElement } from "./dom.js";
import { getMotionFrameCount, getMotionFps, isMotionStepped } from "./motion.js";
import { githubApiBlocked, githubApiEnabled, loadGithubContents } from "./github-contents.js";

const imageExtensions = [".gif", ".png"];

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

function basePathParts() {
  return new URL(".", document.baseURI).pathname.split("/").filter(Boolean);
}

function browserFolderFromPath(path) {
  const cleaned = cleanPath(path);
  if (!cleaned) return "assets/marquee";
  const parts = basePathParts();
  if (parts.length && cleaned === parts.join("/")) return "assets/marquee";
  if (parts.length && cleaned.startsWith(`${parts.join("/")}/`)) return cleaned.slice(parts.join("/").length + 1) || "assets/marquee";
  return cleaned;
}

function publicFolder(config) {
  return cleanPath(config.publicPath || config.assetBase || config.urlPath || config.webPath || config.browserPath || config.folderPublicPath) || browserFolderFromPath(config.path || config.githubPath || config.marqueePath || config.imagePath || config.folder || "assets/marquee");
}

function assetUrl(file, config) {
  if (/^https?:\/\//i.test(file)) return file;
  const base = publicFolder(config);
  const normalized = cleanPath(file);
  const stripped = normalized.startsWith(`${base}/`) ? normalized.slice(base.length + 1) : normalized.replace(/^assets\/marquee\//, "");
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
  const explicitPath = cleanPath(config.path || config.githubPath || config.marqueePath || config.imagePath || config.folder);
  const add = (path) => {
    const cleaned = cleanPath(path);
    if (cleaned && !paths.includes(cleaned)) paths.push(cleaned);
  };
  if (explicitPath) add(explicitPath);
  const parts = basePathParts();
  const host = location.hostname.toLowerCase();
  if (!host.endsWith(".github.io") && parts.length) add(`${parts.join("/")}/assets/marquee`);
  add("assets/marquee");
  if (host.endsWith(".github.io") && parts.length > 1) add(`${parts.join("/")}/assets/marquee`);
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

async function resolveMarqueeFiles(config) {
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

function clampPercent(value, fallback) {
  return Math.min(100, Math.max(0, finiteNumber(value, fallback)));
}

function normalizeDirection(value) {
  return String(value || "horizontal").toLowerCase() === "vertical" ? "vertical" : "horizontal";
}

function gapPixels(config, height) {
  const explicit = config.gaps ?? config.gap ?? config.gapWidth;
  if (explicit === true) return Math.max(0, finiteNumber(height, 0));
  if (explicit === false || explicit === null || explicit === undefined || explicit === "") return 0;
  return Math.max(0, finiteNumber(explicit, 0));
}

function relativeZ(config) {
  const value = config.z ?? config.relativeZ ?? config.relative_z ?? config["relative-z"] ?? config.layer ?? 0;
  const number = finiteNumber(value, 0);
  return Math.max(0, Math.round(10000 + number));
}

function buildGap() {
  return createElement("span", { className: "image-marquee__gap", "aria-hidden": "true" });
}

function buildSequence(files, config) {
  const sequence = [];
  const repeat = Math.max(Number(config.repeat) || 36, 12);
  const height = Number(config.height) || Number(config.size) || 34;
  const gap = gapPixels(config, height);
  for (let index = 0; index < repeat; index += 1) {
    files.forEach((file) => {
      sequence.push(createElement("img", {
        className: "image-marquee__image",
        src: assetUrl(file, config),
        alt: "",
        loading: "lazy",
        decoding: "async",
        draggable: "false"
      }));
      if (gap > 0) sequence.push(buildGap());
    });
  }
  return sequence;
}

function marqueeDefinitions(config) {
  const list = Array.isArray(config) ? config : Array.isArray(config.marquees) ? config.marquees : Array.isArray(config.items) ? config.items : Array.isArray(config.entries) ? config.entries : [];
  if (!list.length) return [config];
  const parent = Array.isArray(config) ? {} : { ...config };
  delete parent.marquees;
  delete parent.items;
  delete parent.entries;
  if (parent.manifest === "assets/marquee/manifest.json") delete parent.manifest;
  return list.filter((item) => item && typeof item === "object").map((item) => ({ ...parent, ...item }));
}

function applyLayout(marquee, config, direction) {
  const height = Number(config.height) || Number(config.size) || 34;
  const blinkMs = Number(config.blinkMs);
  const speedSeconds = Number(config.speedSeconds) || 24;
  const fps = getMotionFps(config.fps);
  const gap = gapPixels(config, height);
  marquee.style.setProperty("--marquee-speed", `${speedSeconds}s`);
  marquee.style.setProperty("--marquee-frames", String(getMotionFrameCount(speedSeconds * 1000, fps)));
  marquee.style.setProperty("--marquee-timing", isMotionStepped(fps) ? `steps(${getMotionFrameCount(speedSeconds * 1000, fps)}, end)` : "linear");
  marquee.style.setProperty("--marquee-blink", `${Number.isFinite(blinkMs) ? blinkMs : 1000}ms`);
  marquee.style.setProperty("--marquee-height", `${height}px`);
  marquee.style.setProperty("--marquee-gap", `${gap}px`);
  marquee.style.zIndex = String(relativeZ(config));
  if (blinkMs === 0) marquee.classList.add("image-marquee--no-blink");
  if (direction === "vertical") {
    const x = clampPercent(config.x ?? config.X, 0);
    marquee.style.left = `${x}%`;
    marquee.style.transform = `translateX(-${x}%)`;
  } else {
    const y = clampPercent(config.y ?? config.Y, 100);
    marquee.style.top = `${y}%`;
    marquee.style.transform = `translateY(-${y}%)`;
  }
}

async function createSingleImageMarquee(config = {}) {
  const direction = normalizeDirection(config.direction);
  const marquee = createElement("section", { className: `image-marquee image-marquee--${direction} is-hidden`, "aria-hidden": "true" });
  applyLayout(marquee, config, direction);
  const files = await resolveMarqueeFiles(config);
  if (!files.length) return marquee;
  const first = createElement("div", { className: "image-marquee__track" }, buildSequence(files, config));
  const second = createElement("div", { className: "image-marquee__track", "aria-hidden": "true" }, buildSequence(files, config));
  marquee.append(createElement("div", { className: "image-marquee__belt" }, [first, second]));
  marquee.classList.remove("is-hidden");
  return marquee;
}

export async function createImageMarquee(config = {}) {
  const host = createElement("div", { className: "image-marquees" });
  const marquees = await Promise.all(marqueeDefinitions(config).map((item) => createSingleImageMarquee(item)));
  host.replaceChildren(...marquees);
  return host;
}
