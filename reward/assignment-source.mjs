const ASSIGNMENT_PATH = "/zzz_assets/rewards/assignments.json";
const PUBLIC_REPOSITORY = "https://raw.githubusercontent.com/kazvt/kazvt.com/main/zzz_assets/rewards/assignments.json";

function withCacheBust(url, token) {
  const result = new URL(url);
  result.searchParams.set("_", String(token));
  return result.href;
}

export function assignmentRegistrySources({ hostname = "", origin = "https://kazvt.com", cacheBust = Date.now() } = {}) {
  const local = withCacheBust(new URL(ASSIGNMENT_PATH, origin).href, cacheBust);
  const isProductionSite = hostname.toLowerCase() === "kazvt.com" || hostname.toLowerCase() === "www.kazvt.com";
  return isProductionSite ? [withCacheBust(PUBLIC_REPOSITORY, cacheBust), local] : [local];
}

export async function fetchAssignmentRegistry({
  fetchImpl = globalThis.fetch,
  hostname = globalThis.location?.hostname ?? "",
  origin = globalThis.location?.origin ?? "https://kazvt.com",
  cacheBust = Date.now()
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("Fetch is not available.");

  let lastError;
  for (const url of assignmentRegistrySources({ hostname, origin, cacheBust })) {
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
