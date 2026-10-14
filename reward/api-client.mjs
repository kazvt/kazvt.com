export async function loadApiAssignments({
  apiBase = globalThis.window?.KAZVT_REWARD_API_BASE,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof apiBase !== "string" || !apiBase.trim()) return null;
  if (typeof fetchImpl !== "function") throw new Error("Reward API fetch is unavailable.");

  const base = new URL(apiBase);
  const localHttp = base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname);
  if (base.protocol !== "https:" && !localHttp) {
    throw new Error("Reward API must use HTTPS.");
  }

  const response = await fetchImpl(new URL("/v1/awards", base), { cache: "no-store" });
  if (!response.ok) throw new Error(`Reward API returned HTTP ${response.status}.`);
  const registry = await response.json();
  if (!registry || registry.version !== 1 || !Array.isArray(registry.assignments)) {
    throw new Error("Reward API returned an invalid assignment index.");
  }
  return registry;
}
