import { setTimeout as sleep } from "node:timers/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRewardHref } from "../reward-link.mjs";

const DEFAULT_SITE_ORIGIN = "https://kazvt.com";
const DEFAULT_REPOSITORY = "kazvt/kazvt.com";
const WORKFLOW_PATH = "issue-reward.yml";
const RUN_NAME_PREFIX = "Reward issuance: ";
const ASSET_ID_PATTERN = /^[a-f0-9]{64}$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const FILENAME_PATTERN = /^[^/\\\u0000-\u001f\u007f]{1,255}\.png$/iu;

function normalizeUsername(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLowerCase() : "";
}

function validateOrigin(value) {
  const origin = new URL(value);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error("The rewards site must be configured as a plain HTTPS origin.");
  }
  return origin.origin;
}

function validateRequest(input) {
  const username = typeof input?.username === "string" ? input.username.normalize("NFKC").trim() : "";
  const assetId = typeof input?.assetId === "string" ? input.assetId.toLowerCase() : "";
  const eventId = typeof input?.eventId === "string" ? input.eventId.trim() : "";
  const platform = typeof input?.platform === "string" && input.platform.trim() ? input.platform.trim() : "stream-game";
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

function validateRepository(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error("repository must be in owner/repository form.");
  }
  return value;
}

function validatePublishedData(catalog, registry) {
  if (!catalog || catalog.version !== 4 || catalog.assetIdAlgorithm !== "sha256-png-bytes-v1" ||
      !Array.isArray(catalog.files) || !catalog.assets || !catalog.assetsById ||
      !registry || registry.version !== 1 || !Array.isArray(registry.assignments)) {
    throw new Error("The published reward catalog or assignment registry is invalid.");
  }
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Published reward data returned HTTP ${response.status}.`);
  return response.json();
}

async function readPublishedData(fetchImpl, siteOrigin) {
  const cacheBuster = `?issuer-check=${Date.now()}`;
  const [catalog, registry] = await Promise.all([
    fetchJson(fetchImpl, new URL(`/zzz_assets/rewards/manifest.json${cacheBuster}`, siteOrigin)),
    fetchJson(fetchImpl, new URL(`/zzz_assets/rewards/assignments.json${cacheBuster}`, siteOrigin))
  ]);
  validatePublishedData(catalog, registry);
  return { catalog, registry };
}

function availableFrom(catalog, registry) {
  const assigned = new Set(registry.assignments.map(record =>
    String(record.assetId ?? record.assetSha256 ?? "").toLowerCase()));
  return Object.entries(catalog.assetsById)
    .filter(([assetId]) => ASSET_ID_PATTERN.test(assetId) && !assigned.has(assetId.toLowerCase()))
    .map(([assetId, indexed]) => {
      const metadata = catalog.assets[indexed?.filename];
      if (!indexed || !FILENAME_PATTERN.test(indexed.filename || "") || !catalog.files.includes(indexed.filename) ||
          !metadata || metadata.assetId !== assetId || metadata.sha256 !== assetId ||
          !Number.isSafeInteger(metadata.width) || metadata.width < 1 ||
          !Number.isSafeInteger(metadata.height) || metadata.height < 1 ||
          metadata.tier !== indexed.tier) return null;
      return { assetId, filename: indexed.filename, width: metadata.width, height: metadata.height, tier: metadata.tier };
    })
    .filter(Boolean)
    .sort((left, right) => left.filename.localeCompare(right.filename));
}

function matchEvent(registry, request) {
  return registry.assignments.find(record => record.eventId === request.eventId);
}

function assignmentMatches(assignment, request) {
  return normalizeUsername(assignment.username) === normalizeUsername(request.username) &&
    String(assignment.assetId ?? assignment.assetSha256).toLowerCase() === request.assetId;
}

function rewardLink(assignment, siteOrigin) {
  return createRewardHref(assignment.linkId, siteOrigin);
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2026-03-10",
    "Content-Type": "application/json"
  };
}

async function readWorkflowRuns(fetchImpl, token, repository) {
  const url = new URL(`https://api.github.com/repos/${repository}/actions/workflows/${WORKFLOW_PATH}/runs`);
  url.searchParams.set("event", "workflow_dispatch");
  url.searchParams.set("branch", "main");
  url.searchParams.set("per_page", "100");
  const response = await fetchImpl(url, { headers: githubHeaders(token), cache: "no-store" });
  if (!response.ok) throw new Error(`Could not check the GitHub issuer run (HTTP ${response.status}).`);
  const payload = await response.json();
  return Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
}

/**
 * Reads the static GitHub Pages catalogs. New PNG files become eligible after
 * the reward-catalog workflow and Pages publish finish.
 */
export async function listAvailableArtwork({
  siteOrigin = DEFAULT_SITE_ORIGIN,
  fetchImpl = globalThis.fetch
} = {}) {
  const origin = validateOrigin(siteOrigin);
  if (typeof fetchImpl !== "function") throw new Error("This Node.js runtime does not provide fetch().");
  const { catalog, registry } = await readPublishedData(fetchImpl, origin);
  return availableFrom(catalog, registry);
}

/**
 * Dispatches a private GitHub Actions issuance, then waits for that award to
 * appear in the published static registry. The caller must supply a stable
 * eventId so a retry after a timeout cannot issue a second award.
 */
export async function issueAward(input, options = {}) {
  const request = validateRequest(input);
  const siteOrigin = validateOrigin(options.siteOrigin ?? DEFAULT_SITE_ORIGIN);
  const repository = validateRepository(options.repository ?? process.env.KAZVT_GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY);
  const token = options.token ?? process.env.KAZVT_GITHUB_ISSUER_TOKEN;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleepImpl = options.sleepImpl ?? sleep;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const pollIntervalMs = options.pollIntervalMs ?? 2_500;
  if (typeof fetchImpl !== "function") throw new Error("This Node.js runtime does not provide fetch().");

  const initial = await readPublishedData(fetchImpl, siteOrigin);
  const previousEvent = matchEvent(initial.registry, request);
  if (previousEvent) {
    if (!assignmentMatches(previousEvent, request)) throw new Error("eventId is already assigned to a different winner or artwork.");
    return { assignment: previousEvent, href: rewardLink(previousEvent, siteOrigin), replayed: true };
  }
  if (!availableFrom(initial.catalog, initial.registry).some(item => item.assetId === request.assetId)) {
    throw new Error("That artwork is not available in the published reward catalog or has already been awarded.");
  }
  if (typeof token !== "string" || token.length < 20) {
    throw new Error("Set KAZVT_GITHUB_ISSUER_TOKEN to a fine-grained token with Actions: write for this repository.");
  }

  const dispatchedAt = Date.now();
  const dispatchUrl = `https://api.github.com/repos/${repository}/actions/workflows/${WORKFLOW_PATH}/dispatches`;
  const dispatchResponse = await fetchImpl(dispatchUrl, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify({
      ref: "main",
      inputs: {
        username: request.username,
        asset_id: request.assetId,
        event_id: request.eventId,
        platform: request.platform
      }
    })
  });
  if (dispatchResponse.status !== 204) {
    const detail = (await dispatchResponse.text()).slice(0, 500);
    throw new Error(`GitHub did not accept the reward workflow (HTTP ${dispatchResponse.status}). ${detail}`.trim());
  }

  const expectedRunName = `${RUN_NAME_PREFIX}${request.eventId}`;
  const deadline = dispatchedAt + timeoutMs;
  let matchedRunId = null;
  let lastPollingError = "";
  while (Date.now() < deadline) {
    try {
      const { registry } = await readPublishedData(fetchImpl, siteOrigin);
      const assignment = matchEvent(registry, request);
      if (assignment) {
        if (!assignmentMatches(assignment, request)) throw new Error("The published eventId belongs to a different winner or artwork.");
        return { assignment, href: rewardLink(assignment, siteOrigin), replayed: false };
      }
      if (registry.assignments.some(record => String(record.assetId ?? record.assetSha256).toLowerCase() === request.assetId)) {
        throw new Error("The artwork was assigned by a different event while this request was running.");
      }
      const runs = await readWorkflowRuns(fetchImpl, token, repository);
      const run = runs.find(candidate => candidate.display_title === expectedRunName &&
        Date.parse(candidate.created_at) >= dispatchedAt - 5_000);
      if (run) {
        matchedRunId = run.id;
        if (run.status === "completed" && run.conclusion !== "success") {
          throw new Error(`Reward workflow ${run.html_url || run.id} finished with ${run.conclusion || "no conclusion"}.`);
        }
      }
      lastPollingError = "";
    } catch (error) {
      if (/different winner|different event|was assigned by a different event|finished with/.test(error.message)) throw error;
      lastPollingError = error.message || String(error);
    }
    await sleepImpl(pollIntervalMs);
  }
  const actionUrl = `https://github.com/${repository}/actions/workflows/${WORKFLOW_PATH}`;
  const runHint = matchedRunId ? `Run ${matchedRunId} was seen. ` : "";
  const pollingHint = lastPollingError ? ` Last check: ${lastPollingError}` : "";
  throw new Error(`${runHint}The award was dispatched, but it did not appear on GitHub Pages before timeout. Check ${actionUrl}, then retry with the same eventId.${pollingHint}`);
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
