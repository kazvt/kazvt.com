import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export async function issueAward({ username, assetId, eventId, platform } = {}, options = {}) {
  const apiUrl = options.apiUrl ?? process.env.KAZVT_REWARD_API_URL;
  const issuerKey = options.issuerKey ?? process.env.KAZVT_REWARD_ISSUER_KEY;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof apiUrl !== "string" || !apiUrl || typeof issuerKey !== "string" || issuerKey.length < 32) {
    throw new Error("Set KAZVT_REWARD_API_URL and KAZVT_REWARD_ISSUER_KEY in the trusted issuer environment.");
  }
  if (typeof fetchImpl !== "function") throw new Error("This Node.js runtime does not provide fetch().");

  const base = new URL(apiUrl);
  const localHttp = base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname);
  if (base.protocol !== "https:" && !localHttp) throw new Error("The reward API must use HTTPS.");

  const response = await fetchImpl(new URL("/v1/awards", base), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${issuerKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ username, assetId, ...(eventId ? { eventId } : {}), ...(platform ? { platform } : {}) })
  });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const detail = typeof payload?.error === "string" ? payload.error : "Reward API request failed.";
    throw new Error(`Reward API HTTP ${response.status}: ${detail}`);
  }
  return payload;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [username, assetId, eventId] = process.argv.slice(2);
  issueAward({ username, assetId, eventId }).then(result => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
