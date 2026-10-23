const ASSIGNMENT_PATH = "/zzz_assets/rewards/assignments.json";
const PUBLIC_REPOSITORY = "https://raw.githubusercontent.com/kazvt/kazvt.com/main/zzz_assets/rewards/assignments.json";

function withCacheBust(url, token) {
  const result = new URL(url);
  result.searchParams.set("_", String(token));
  return result.href;
}

export function assignmentRegistrySources({ hostname = "", origin = "https://kazvt.com", cacheBust = Date.now() } = {}) {
  const local = withCacheBust(new URL(ASSIGNMENT_PATH, origin).href, cacheBust);
  const host = String(hostname || "").toLowerCase();
  const isProductionSite = host === "kazvt.com" || host === "www.kazvt.com";
  return isProductionSite ? [withCacheBust(PUBLIC_REPOSITORY, cacheBust), local] : [local];
}

export async function fetchAssignmentRegistry({
  fetchImpl = globalThis.fetch,
  hostname = globalThis.location?.hostname ?? "",
  origin = globalThis.location?.origin ?? "https://kazvt.com",
  cacheBust = Date.now(),
  expectedLinkId = ""
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("Fetch is not available.");

  const sources = assignmentRegistrySources({ hostname, origin, cacheBust });
  if (expectedLinkId && sources.length > 1) {
    // A successful GitHub raw response can still be an older CDN snapshot just
    // after the issuer has pushed a new reward. Check both public copies at the
    // same time and prefer the one that actually contains this link ID.
    const results = await Promise.allSettled(sources.map(async url => {
      const response = await fetchImpl(url, { cache: "no-store", credentials: "omit" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }));
    const registries = results
      .filter(result => result.status === "fulfilled")
      .map(result => result.value);
    const matching = registries.find(registry => Array.isArray(registry?.assignments) &&
      registry.assignments.some(assignment => assignment?.linkId === expectedLinkId));
    if (matching) return matching;
    if (registries.length) return registries[0];

    const lastError = [...results].reverse().find(result => result.status === "rejected")?.reason;
    throw new Error("The award assignment registry could not be loaded.", { cause: lastError });
  }

  let lastError;
  for (const url of sources) {
    try {
      const response = await fetchImpl(url, { cache: "no-store", credentials: "omit" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error("The award assignment registry could not be loaded.", { cause: lastError });
}
