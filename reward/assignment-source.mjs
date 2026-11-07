const ASSIGNMENT_PATH = "/zzz_assets/rewards/assignments.json";
const PUBLIC_REPOSITORY = "https://raw.githubusercontent.com/kazvt/kazvt.com/main/zzz_assets/rewards/assignments.json";
const DEFAULT_REQUEST_TIMEOUT_MS = 6_000;

function withCacheBust(url, token) {
  const result = new URL(url);
  result.searchParams.set("_", String(token));
  return result.href;
}

function registryHasLink(registry, expectedLinkId) {
  if (!expectedLinkId || !Array.isArray(registry?.assignments)) return false;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expectedLinkId);
  return registry.assignments.some(assignment => {
    const linkId = typeof assignment?.linkId === "string" ? assignment.linkId : "";
    return isUuid ? linkId.toLowerCase() === expectedLinkId.toLowerCase() : linkId === expectedLinkId;
  });
}

export function assignmentRegistrySources({ hostname = "", origin = "https://kazvt.com", cacheBust = Date.now() } = {}) {
  const local = withCacheBust(new URL(ASSIGNMENT_PATH, origin).href, cacheBust);
  const host = String(hostname || "").toLowerCase();
  const isProductionSite = host === "kazvt.com" || host === "www.kazvt.com";
  return isProductionSite ? [withCacheBust(PUBLIC_REPOSITORY, cacheBust), local] : [local];
}

async function readRegistrySource(fetchImpl, url, requestTimeoutMs, controller = null) {
  let timeoutId;
  const requestController = controller ?? (typeof AbortController === "function" ? new AbortController() : null);
  if (requestController && Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0) {
    timeoutId = setTimeout(() => requestController.abort(), requestTimeoutMs);
  }

  try {
    const init = { cache: "no-store", credentials: "omit" };
    if (requestController) init.signal = requestController.signal;
    const response = await fetchImpl(url, init);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function fetchAssignmentRegistry({
  fetchImpl = globalThis.fetch,
  hostname = globalThis.location?.hostname ?? "",
  origin = globalThis.location?.origin ?? "https://kazvt.com",
  cacheBust = Date.now(),
  expectedLinkId = "",
  allowPublishedLookupForExpectedLink = false,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("Fetch is not available.");

  const sources = assignmentRegistrySources({ hostname, origin, cacheBust });
  if (expectedLinkId && allowPublishedLookupForExpectedLink && sources.length === 1) {
    // Local previews intentionally keep their ordinary gallery isolated from
    // production. A specific reward URL is different: it may have just been
    // issued on the live site, so resolve that ID against the public ledger.
    let localRegistry;
    try {
      localRegistry = await readRegistrySource(fetchImpl, sources[0], requestTimeoutMs);
      if (registryHasLink(localRegistry, expectedLinkId)) return localRegistry;
    } catch {
      // Continue to the published ledger; a preview server may not have this file.
    }

    try {
      const publishedRegistry = await fetchAssignmentRegistry({
        fetchImpl,
        hostname: "kazvt.com",
        origin: "https://kazvt.com",
        cacheBust,
        expectedLinkId,
        requestTimeoutMs
      });
      if (registryHasLink(publishedRegistry, expectedLinkId)) return publishedRegistry;
    } catch {
      // Preserve a valid local snapshot below so existing preview behavior is
      // unchanged if production is unavailable.
    }
    if (localRegistry) return localRegistry;
    throw new Error("The award assignment registry could not be loaded.");
  }

  if (expectedLinkId && sources.length > 1) {
    // A successful GitHub raw response can still be an older CDN snapshot just
    // after the issuer has pushed a new reward. Check both public copies at the
    // same time and prefer the one that actually contains this link ID.
    const reads = sources.map(url => {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      return {
        controller,
        promise: readRegistrySource(fetchImpl, url, requestTimeoutMs, controller)
      };
    });
    try {
      // Resolve as soon as either source has the requested assignment; don't
      // wait for a slower stale source after the current copy is already found.
      const winner = await Promise.any(reads.map(async (read, index) => {
        const registry = await read.promise;
        if (!registryHasLink(registry, expectedLinkId)) throw new Error("This registry snapshot predates the requested reward.");
        return { index, registry };
      }));
      reads.forEach((read, index) => {
        if (index !== winner.index) read.controller?.abort();
      });
      return winner.registry;
    } catch {
      // Neither source had this ID yet (or both failed). Preserve a successful
      // stale snapshot so the page's bounded retry can check again shortly.
    }
    const results = await Promise.allSettled(reads.map(read => read.promise));
    const registries = results
      .filter(result => result.status === "fulfilled")
      .map(result => result.value);
    if (registries.length) return registries[0];

    const lastError = [...results].reverse().find(result => result.status === "rejected")?.reason;
    throw new Error("The award assignment registry could not be loaded.", { cause: lastError });
  }

  let lastError;
  for (const url of sources) {
    try {
      return await readRegistrySource(fetchImpl, url, requestTimeoutMs);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error("The award assignment registry could not be loaded.", { cause: lastError });
}
