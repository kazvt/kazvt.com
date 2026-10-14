import { setTimeout as sleep } from "node:timers/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRewardHref } from "../reward-link.mjs";

const DEFAULT_API_ORIGIN = "http://127.0.0.1:8000";
const DEFAULT_SITE_ORIGIN = "https://kazvt.com";
const ASSET_ID_PATTERN = /^[a-f0-9]{64}$/i;
const LINK_ID_PATTERN = /^(?:[A-Za-z0-9_-]{16,22}|[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const FILENAME_PATTERN = /^[^/\\\u0000-\u001f\u007f]{1,255}\.png$/iu;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

function normalizeUsername(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLowerCase() : "";
}

function validateApiOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The reward API must use a loopback URL such as http://127.0.0.1:8000.");
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname) ||
      url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("For safety, the reward API client only allows a local MSI server URL.");
  }
  return url.origin;
}

function validateSiteOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("The rewards site must be configured as a plain HTTPS origin.");
  }
  return url.origin;
}

function cleanRequest(input) {
  const username = typeof input?.username === "string" ? input.username.normalize("NFKC").trim() : "";
  const assetId = typeof input?.assetId === "string" ? input.assetId.toLowerCase() : "";
  const eventId = typeof input?.eventId === "string" ? input.eventId.trim() : "";
  const platform = typeof input?.platform === "string" && input.platform.trim()
    ? input.platform.trim()
    : "stream-game";
  if (!username || username.length > 100 || CONTROL_CHARACTER_PATTERN.test(username)) {
    throw new Error("username must be 1-100 characters and contain no control characters.");
  }
  if (!ASSET_ID_PATTERN.test(assetId)) throw new Error("assetId must be a SHA-256 artwork ID.");
  if (!eventId || eventId.length > 128 || CONTROL_CHARACTER_PATTERN.test(eventId)) {
    throw new Error("eventId must be a stable 1-128 character ID without control characters.");
  }
  if (!platform || platform.length > 60 || CONTROL_CHARACTER_PATTERN.test(platform)) {
    throw new Error("platform must be 1-60 characters and contain no control characters.");
  }
  return { username, assetId, eventId, platform };
}

function withTimeout(timeoutMs) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0 && typeof AbortSignal?.timeout === "function"
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
}

async function readJson(response, label) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
  if (!response.ok) throw new Error(payload?.error || `${label} returned HTTP ${response.status}.`);
  return payload;
}

function validateArtworkList(items) {
  if (!Array.isArray(items)) throw new Error("The local reward API returned an invalid artwork list.");
  return items.map(item => {
    if (!item || !ASSET_ID_PATTERN.test(item.assetId || "") || !FILENAME_PATTERN.test(item.filename || "") ||
        !Number.isSafeInteger(item.width) || item.width < 1 ||
        !Number.isSafeInteger(item.height) || item.height < 1 || typeof item.tier !== "string") {
      throw new Error("The local reward API returned invalid artwork metadata.");
    }
    return { assetId: item.assetId.toLowerCase(), filename: item.filename, width: item.width, height: item.height, tier: item.tier };
  });
}

async function callLocalApi(fetchImpl, apiOrigin, path, init = {}, timeoutMs = 180_000) {
  let response;
  try {
    response = await fetchImpl(new URL(path, apiOrigin), {
      ...init,
      headers: {
        Accept: "application/json",
        Origin: apiOrigin,
        ...init.headers
      },
      signal: init.signal ?? withTimeout(timeoutMs),
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(`Could not reach the local MSI reward API at ${apiOrigin}. Make sure msi.py is running. ${error?.message || ""}`.trim());
  }
  return readJson(response, "The local MSI reward API");
}

async function readPublishedRegistry(fetchImpl, siteOrigin, timeoutMs) {
  const url = new URL("/zzz_assets/rewards/assignments.json", siteOrigin);
  url.searchParams.set("issuer-check", String(Date.now()));
  let response;
  try {
    response = await fetchImpl(url, { cache: "no-store", headers: { Accept: "application/json" }, signal: withTimeout(timeoutMs) });
  } catch (error) {
    throw new Error(`Could not verify the public reward registry yet. ${error?.message || ""}`.trim());
  }
  const registry = await readJson(response, "The public reward registry");
  if (registry.version !== 1 || !Array.isArray(registry.assignments)) {
    throw new Error("The public reward registry has an unsupported format.");
  }
  return registry;
}

/** Lists unassigned reward art from the local MSI-hosted catalog. */
export async function listAvailableArtwork({
  apiOrigin = process.env.KAZVT_REWARD_API_ORIGIN ?? DEFAULT_API_ORIGIN,
  fetchImpl = globalThis.fetch,
  timeoutMs = 180_000
} = {}) {
  const origin = validateApiOrigin(apiOrigin);
  if (typeof fetchImpl !== "function") throw new Error("This Node.js runtime does not provide fetch().");
  const payload = await callLocalApi(fetchImpl, origin, "/reward-api/available", { method: "GET" }, timeoutMs);
  if (payload?.ok !== true) throw new Error(payload?.error || "The local reward catalog is unavailable.");
  return validateArtworkList(payload.artworks);
}

/**
 * Issues one award through the loopback-only MSI server. MSI commits and pushes
 * only assignments.json using the existing Git login; this helper waits until
 * GitHub Pages serves that assignment before returning its public URL.
 */
export async function issueAward(input, options = {}) {
  const request = cleanRequest(input);
  const apiOrigin = validateApiOrigin(options.apiOrigin ?? process.env.KAZVT_REWARD_API_ORIGIN ?? DEFAULT_API_ORIGIN);
  const siteOrigin = validateSiteOrigin(options.siteOrigin ?? DEFAULT_SITE_ORIGIN);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleepImpl = options.sleepImpl ?? sleep;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;
  if (typeof fetchImpl !== "function") throw new Error("This Node.js runtime does not provide fetch().");

  const result = await callLocalApi(fetchImpl, apiOrigin, "/reward-api/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  }, timeoutMs);
  if (result?.ok !== true || !result.assignment || !LINK_ID_PATTERN.test(result.assignment.linkId || "")) {
    throw new Error(result?.error || "The local reward API returned an invalid assignment.");
  }
  if (normalizeUsername(result.assignment.username) !== normalizeUsername(request.username) ||
      String(result.assignment.assetId ?? result.assignment.assetSha256).toLowerCase() !== request.assetId ||
      result.pushed !== true) {
    throw new Error("The local API response did not match the requested award or confirm its push.");
  }
  const href = createRewardHref(result.assignment.linkId, siteOrigin);

  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const registry = await readPublishedRegistry(fetchImpl, siteOrigin, Math.min(15_000, timeoutMs));
      const published = registry.assignments.find(record => record.linkId === result.assignment.linkId);
      if (published) {
        if (normalizeUsername(published.username) !== normalizeUsername(request.username) ||
            String(published.assetId ?? published.assetSha256).toLowerCase() !== request.assetId) {
          throw new Error("The public registry contains conflicting data for this reward link.");
        }
        return {
          assignment: published,
          href,
          replayed: Boolean(result.replayed),
          pushed: true
        };
      }
      lastError = "GitHub Pages has not finished publishing the registry yet.";
    } catch (error) {
      if (/conflicting data/.test(error.message)) throw error;
      lastError = error.message || String(error);
    }
    await sleepImpl(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
  }
  throw new Error(`The award was pushed to GitHub, but the public page has not confirmed it yet. Retry with the same eventId; do not issue a second event. ${lastError}`.trim());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [username, assetId, eventId, platform] = process.argv.slice(2);
  issueAward({ username, assetId, eventId, platform }).then(result => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}
