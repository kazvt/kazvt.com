const musicExtensions = [".mp3", ".wav"];
const firstFadeMs = 2000;
const transitionFadeMs = 6000;

function cleanPath(value) {
  return String(value || "").trim().replace(/^\/+|\/+$/g, "");
}

function clampVolume(value) {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0.5, 0), 1);
}

function clampUnit(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 1);
}

function hasMusicExtension(path) {
  const lower = String(path || "").toLowerCase().split("?")[0].split("#")[0];
  return musicExtensions.some((extension) => lower.endsWith(extension));
}

function uniqueFiles(files) {
  return [...new Set(files.map(cleanPath).filter(hasMusicExtension))];
}

function cookieName(config) {
  return cleanPath(config.cookieName || "xp_music_choice") || "xp_music_choice";
}

function volumeCookieName(config) {
  return cleanPath(config.volumeCookieName || "xp_music_volume") || "xp_music_volume";
}

function getCookieValue(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) || "";
}

function setCookieValue(name, value) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

function savedVolume(config) {
  const cookie = getCookieValue(volumeCookieName(config));
  if (cookie !== "") return clampVolume(Number(decodeURIComponent(cookie)));
  return clampVolume(Number(config.volume));
}

function rememberVolume(config, value) {
  setCookieValue(volumeCookieName(config), String(clampVolume(Number(value))));
}

function musicKey(file) {
  let value = String(file || "").trim();
  try {
    if (/^https?:\/\//i.test(value)) value = new URL(value).pathname;
  } catch {}
  value = decodeURIComponent(value).replace(/^\/+/, "");
  value = value.replace(/^.*?assets\/music\//, "");
  return cleanPath(value).toLowerCase();
}

function assetUrl(file) {
  if (/^https?:\/\//i.test(file)) return file;
  const name = file.replace(/^assets\/music\//, "").split("/").map(encodeURIComponent).join("/");
  return new URL(`assets/music/${name}`, document.baseURI).href;
}

function basePathParts() {
  return new URL(".", document.baseURI).pathname.split("/").filter(Boolean);
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
  const explicitPath = cleanPath(config.path || config.githubPath || config.musicPath);
  const add = (path) => {
    const cleaned = cleanPath(path);
    if (cleaned && !paths.includes(cleaned)) paths.push(cleaned);
  };
  if (explicitPath) add(explicitPath);
  const parts = basePathParts();
  const host = location.hostname.toLowerCase();
  if (!host.endsWith(".github.io") && parts.length) add(`${parts.join("/")}/assets/music`);
  add("assets/music");
  if (host.endsWith(".github.io") && parts.length > 1) add(`${parts.join("/")}/assets/music`);
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
  return data.filter((item) => item && item.type === "file" && hasMusicExtension(item.name)).map((item) => `assets/music/${item.name}`);
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
  return [...doc.querySelectorAll("a[href]")].map((link) => link.getAttribute("href")).filter(hasMusicExtension).map((href) => new URL(href, new URL(path, document.baseURI)).href);
}

async function resolveMusicFiles(config) {
  const listed = uniqueFiles(config.files || []);
  if (listed.length) return listed;
  const manifest = uniqueFiles(await loadManifest(config.manifest || "assets/music/manifest.json").catch(() => []));
  if (manifest.length) return manifest;
  const github = uniqueFiles(await loadGithubFiles(config).catch(() => []));
  if (github.length) return github;
  if (config.directoryListing === true) return uniqueFiles(await loadDirectoryFiles(config.directory || "assets/music/").catch(() => []));
  return [];
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

function createPlayer(state) {
  const audio = document.createElement("audio");
  const player = {
    audio,
    fade: 0,
    frame: 0,
    token: 0
  };
  audio.preload = "auto";
  audio.volume = 0;
  audio.muted = state.muted;
  audio.hidden = true;
  audio.setAttribute("aria-hidden", "true");
  document.body.append(audio);
  return player;
}

function applyPlayerVolume(player, state) {
  player.audio.volume = clampVolume(state.volume * player.fade);
  player.audio.muted = state.muted;
}

function setPlayerFade(player, state, value) {
  player.fade = clampUnit(value);
  applyPlayerVolume(player, state);
}

function cancelFade(player) {
  player.token += 1;
  if (player.frame) cancelAnimationFrame(player.frame);
  player.frame = 0;
}

function fadePlayer(player, state, to, duration) {
  cancelFade(player);
  const token = player.token;
  const from = player.fade;
  const target = clampUnit(to);
  const length = Math.max(0, Number(duration) || 0);
  if (!length) {
    setPlayerFade(player, state, target);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now) => {
      if (player.token !== token) return resolve();
      const progress = Math.min((now - start) / length, 1);
      setPlayerFade(player, state, from + (target - from) * progress);
      if (progress < 1) {
        player.frame = requestAnimationFrame(tick);
      } else {
        player.frame = 0;
        resolve();
      }
    };
    player.frame = requestAnimationFrame(tick);
  });
}

export async function startMusic(config = {}) {
  const state = {
    volume: savedVolume(config),
    muted: false
  };
  let current = null;
  let standby = null;
  let currentIndex = -1;
  let unlockWaiting = false;
  let transitionRunning = false;
  let firstPlayDone = false;
  const files = await resolveMusicFiles(config);
  const choiceCookie = cookieName(config);

  const controller = {
    get audio() {
      return current ? current.audio : null;
    },
    get files() {
      return files;
    },
    getVolume() {
      return state.volume;
    },
    setVolume(value) {
      state.volume = clampVolume(Number(value));
      rememberVolume(config, state.volume);
      [current, standby].filter(Boolean).forEach((player) => applyPlayerVolume(player, state));
    },
    getMuted() {
      return state.muted;
    },
    setMuted(value) {
      state.muted = Boolean(value);
      [current, standby].filter(Boolean).forEach((player) => applyPlayerVolume(player, state));
    },
    play() {
      return play();
    }
  };

  if (!files.length) return controller;

  current = createPlayer(state);
  standby = createPlayer(state);

  function rememberChoice(index) {
    if (files[index]) setCookieValue(choiceCookie, musicKey(files[index]));
  }

  function rememberedIndex() {
    const remembered = decodeURIComponent(getCookieValue(choiceCookie) || "").toLowerCase();
    if (!remembered) return -1;
    return files.findIndex((file) => musicKey(file) === remembered);
  }

  function chooseInitialIndex() {
    const remembered = rememberedIndex();
    return remembered >= 0 ? remembered : randomIndex(files.length, currentIndex);
  }

  function loadPlayer(player, index) {
    cancelFade(player);
    player.audio.pause();
    player.audio.removeAttribute("src");
    player.audio.load();
    player.audio.src = assetUrl(files[index]);
    player.audio.currentTime = 0;
    setPlayerFade(player, state, 0);
  }

  function prepareNextPlayer() {
    const nextIndex = randomIndex(files.length, currentIndex);
    loadPlayer(standby, nextIndex);
    return nextIndex;
  }

  async function safePlay(player, retry) {
    try {
      await player.audio.play();
      unlockWaiting = false;
      return true;
    } catch {
      if (!unlockWaiting) {
        unlockWaiting = true;
        bindUnlock(retry);
      }
      return false;
    }
  }

  async function startFirstTrack() {
    if (!current.audio.src) {
      currentIndex = chooseInitialIndex();
      loadPlayer(current, currentIndex);
      rememberChoice(currentIndex);
    }
    const didPlay = await safePlay(current, play);
    if (!didPlay) return;
    if (!firstPlayDone) {
      firstPlayDone = true;
      await fadePlayer(current, state, 1, firstFadeMs);
    } else {
      setPlayerFade(current, state, 1);
    }
  }

  async function transitionToNext(useFade) {
    if (transitionRunning || !current) return;
    transitionRunning = true;
    const outgoing = current;
    const incoming = standby;
    const nextIndex = prepareNextPlayer();
    const didPlay = await safePlay(incoming, () => transitionToNext(useFade));
    if (!didPlay) {
      transitionRunning = false;
      return;
    }
    const duration = useFade ? transitionFadeMs : transitionFadeMs;
    await Promise.all([
      useFade ? fadePlayer(outgoing, state, 0, duration) : Promise.resolve(setPlayerFade(outgoing, state, 0)),
      fadePlayer(incoming, state, 1, duration)
    ]);
    outgoing.audio.pause();
    outgoing.audio.removeAttribute("src");
    outgoing.audio.load();
    current = incoming;
    standby = outgoing;
    currentIndex = nextIndex;
    rememberChoice(currentIndex);
    transitionRunning = false;
  }

  function shouldBeginTransition(player) {
    if (player !== current || transitionRunning || !firstPlayDone) return false;
    const duration = player.audio.duration;
    if (!Number.isFinite(duration) || duration <= transitionFadeMs / 1000 + 0.5) return false;
    return duration - player.audio.currentTime <= transitionFadeMs / 1000;
  }

  [current, standby].forEach((player) => {
    player.audio.addEventListener("timeupdate", () => {
      if (shouldBeginTransition(player)) transitionToNext(true);
    });
    player.audio.addEventListener("ended", () => {
      if (player === current && !transitionRunning) transitionToNext(false);
    });
  });

  async function play() {
    if (!current) return;
    if (!firstPlayDone || !current.audio.src || current.audio.paused) await startFirstTrack();
  }

  play();
  return controller;
}
