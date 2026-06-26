const musicExtensions = [".mp3", ".wav"];

function cleanPath(value) {
  return String(value || "").trim();
}

function hasMusicExtension(path) {
  const lower = path.toLowerCase().split("?")[0].split("#")[0];
  return musicExtensions.some((extension) => lower.endsWith(extension));
}

function uniqueFiles(files) {
  return [...new Set(files.map(cleanPath).filter(hasMusicExtension))];
}

function assetUrl(file) {
  if (/^https?:\/\//i.test(file)) return file;
  const name = file.replace(/^assets\/music\//, "").split("/").map(encodeURIComponent).join("/");
  return new URL(`assets/music/${name}`, document.baseURI).href;
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

function inferRepository(repository) {
  const explicit = cleanPath(repository);
  if (explicit) return explicit;
  const host = location.hostname.toLowerCase();
  if (!host.endsWith(".github.io")) return "";
  const owner = host.replace(/\.github\.io$/, "");
  const parts = location.pathname.split("/").filter(Boolean);
  const repo = parts[0] || `${owner}.github.io`;
  return `${owner}/${repo}`;
}

async function loadGithubFiles(config) {
  const repository = inferRepository(config.repository);
  if (!repository) return [];
  const branch = cleanPath(config.branch);
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  const endpoint = `https://api.github.com/repos/${repository}/contents/assets/music${ref}`;
  const response = await fetch(endpoint, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data.filter((item) => item && item.type === "file" && hasMusicExtension(item.name)).map((item) => `assets/music/${item.name}`);
}

async function loadDirectoryFiles(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return [];
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("a[href]")].map((link) => link.getAttribute("href")).filter(hasMusicExtension).map((href) => new URL(href, new URL(path, document.baseURI)).href);
}

async function resolveMusicFiles(config) {
  const listed = uniqueFiles(config.files || []);
  if (listed.length) return listed;
  const manifest = uniqueFiles(await loadManifest(config.manifest || "assets/music/manifest.json").catch(() => []));
  if (manifest.length) return manifest;
  const github = uniqueFiles(await loadGithubFiles(config).catch(() => []));
  if (github.length) return github;
  return uniqueFiles(await loadDirectoryFiles(config.directory || "assets/music/").catch(() => []));
}

function randomIndex(length, currentIndex) {
  if (length < 2) return 0;
  let next = Math.floor(Math.random() * length);
  while (next === currentIndex) next = Math.floor(Math.random() * length);
  return next;
}

function bindUnlock(play) {
  let done = false;
  const events = ["pointerdown", "mousedown", "touchstart", "keydown", "click"];
  const unlock = () => {
    if (done) return;
    done = true;
    events.forEach((eventName) => document.removeEventListener(eventName, unlock, true));
    play();
  };
  events.forEach((eventName) => document.addEventListener(eventName, unlock, { capture: true, once: true }));
}

export async function startMusic(config = {}) {
  const files = await resolveMusicFiles(config);
  if (!files.length) return null;
  const audio = document.createElement("audio");
  let currentIndex = -1;
  audio.preload = "auto";
  audio.volume = Number.isFinite(config.volume) ? config.volume : 0.45;
  audio.hidden = true;
  audio.setAttribute("aria-hidden", "true");
  document.body.append(audio);

  const choose = () => {
    currentIndex = randomIndex(files.length, currentIndex);
    audio.src = assetUrl(files[currentIndex]);
  };

  const play = async () => {
    if (!audio.src) choose();
    try {
      await audio.play();
    } catch {
      bindUnlock(play);
    }
  };

  audio.addEventListener("ended", () => {
    choose();
    play();
  });

  choose();
  play();
  return audio;
}
