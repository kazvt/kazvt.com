function cleanPath(value) {
  return String(value || "").trim().replace(/^\/+|\/+$/g, "");
}

function state() {
  if (!window.__xpGithubContents) window.__xpGithubContents = { cache: new Map(), blockedUntil: 0 };
  return window.__xpGithubContents;
}

function cacheKey(endpoint) {
  return `xp:github:${endpoint}`;
}

function readSession(endpoint) {
  try {
    const item = sessionStorage.getItem(cacheKey(endpoint));
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (!parsed || !Array.isArray(parsed.data)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSession(endpoint, data) {
  try {
    sessionStorage.setItem(cacheKey(endpoint), JSON.stringify({ data }));
  } catch {}
}

function readBlockedUntil() {
  try {
    return Number(sessionStorage.getItem("xp:github-blocked-until")) || 0;
  } catch {
    return 0;
  }
}

function writeBlockedUntil(value) {
  try {
    sessionStorage.setItem("xp:github-blocked-until", String(value));
  } catch {}
}

function valueIsFalse(value) {
  return value === false || value === 0 || String(value).toLowerCase().trim() === "false" || String(value).trim() === "0";
}

export function githubApiEnabled(config = {}) {
  const value = config.githubApi ?? config.useGithubApi ?? config.githubContentsApi ?? config.api;
  return !valueIsFalse(value);
}

export function githubApiBlocked() {
  const store = state();
  const until = Math.max(store.blockedUntil || 0, readBlockedUntil());
  if (until > Date.now()) {
    store.blockedUntil = until;
    return true;
  }
  store.blockedUntil = 0;
  return false;
}

function blockGithubApi() {
  const until = Date.now() + 10 * 60 * 1000;
  const store = state();
  store.blockedUntil = until;
  writeBlockedUntil(until);
}

export async function loadGithubContents(repository, branch, path) {
  const repo = cleanPath(repository);
  const contentPath = cleanPath(path);
  if (!repo || !contentPath || githubApiBlocked()) return [];
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  const endpoint = `https://api.github.com/repos/${repo}/contents/${contentPath}${ref}`;
  const store = state();
  if (store.cache.has(endpoint)) return store.cache.get(endpoint);
  const cached = readSession(endpoint);
  if (cached) {
    store.cache.set(endpoint, cached);
    return cached;
  }
  const response = await fetch(endpoint, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (response.status === 403 || response.status === 429) {
    blockGithubApi();
    return [];
  }
  if (!response.ok) return [];
  const data = await response.json();
  const items = Array.isArray(data) ? data : [];
  store.cache.set(endpoint, items);
  writeSession(endpoint, items);
  return items;
}
