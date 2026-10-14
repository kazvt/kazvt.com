const ASSET_ID_PATTERN = /^[a-f0-9]{64}$/i;
const USERNAME_PATTERN = /^[^\u0000-\u001f\u007f]+$/u;
const PNG_FILENAME_PATTERN = /^[^/\\\u0000-\u001f\u007f]{1,255}\.png$/iu;
const COMPACT_ID_PATTERN = /^[A-Za-z0-9_-]{16,22}$/;
const UUID4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 4096;

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || "https://kazvt.com,https://www.kazvt.com")
    .split(",").map(value => value.trim()).filter(Boolean));
}

function response(request, env, payload, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    ...extraHeaders
  });
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function error(request, env, status, message) {
  return response(request, env, { error: message }, status);
}

function normalizeUsername(value) {
  return value.normalize("NFKC").trim().toLowerCase();
}

function constantTimeEqual(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

function hasIssuerKey(request, env) {
  const expected = env.AWARD_ISSUER_KEY;
  if (typeof expected !== "string" || expected.length < 32) return "misconfigured";
  const authorization = request.headers.get("Authorization") || "";
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
  return match && constantTimeEqual(match[1], expected);
}

function newLinkId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function siteUrl(env, path) {
  const origin = new URL(env.SITE_ORIGIN || "https://kazvt.com");
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("SITE_ORIGIN must be a plain HTTPS origin.");
  }
  return new URL(path, origin);
}

async function readJson(url) {
  const result = await fetch(url, { headers: { Accept: "application/json" }, redirect: "error" });
  if (!result.ok) throw new Error(`Public reward data returned HTTP ${result.status}.`);
  const text = await result.text();
  if (new TextEncoder().encode(text).length > 4 * 1024 * 1024) {
    throw new Error("Public reward data exceeded the size limit.");
  }
  return JSON.parse(text);
}

async function readCatalog(env) {
  const catalog = await readJson(siteUrl(env, "/zzz_assets/rewards/manifest.json"));
  if (!catalog || catalog.version !== 4 || catalog.assetIdAlgorithm !== "sha256-png-bytes-v1" ||
      !Array.isArray(catalog.files) || !catalog.assets || !catalog.assetsById) {
    throw new Error("The published reward catalog is invalid.");
  }
  return catalog;
}

async function readStaticAssignments(env) {
  const registry = await readJson(siteUrl(env, "/zzz_assets/rewards/assignments.json"));
  if (!registry || registry.version !== 1 || !Array.isArray(registry.assignments)) {
    throw new Error("The published reward assignments are invalid.");
  }
  for (const record of registry.assignments) {
    const assetId = record?.assetId ?? record?.assetSha256;
    if (!record || typeof record !== "object" || typeof assetId !== "string" || !ASSET_ID_PATTERN.test(assetId) ||
        typeof record.username !== "string" || !record.username.trim() ||
        record.username.length > 100 || !USERNAME_PATTERN.test(record.username) ||
        !PNG_FILENAME_PATTERN.test(record.filename || "") ||
        (record.linkId != null && typeof record.linkId !== "string") ||
        (record.linkId && !(COMPACT_ID_PATTERN.test(record.linkId) || UUID4_PATTERN.test(record.linkId)))) {
      throw new Error("A published reward assignment is invalid.");
    }
  }
  return registry.assignments;
}

function catalogAsset(catalog, assetId) {
  const indexed = catalog.assetsById?.[assetId];
  if (!indexed || !PNG_FILENAME_PATTERN.test(indexed.filename || "") ||
      !catalog.files.includes(indexed.filename)) return null;
  const metadata = catalog.assets[indexed.filename];
  if (!metadata || metadata.assetId !== assetId || metadata.sha256 !== assetId ||
      !Number.isSafeInteger(metadata.width) || metadata.width < 1 ||
      !Number.isSafeInteger(metadata.height) || metadata.height < 1 ||
      metadata.tier !== indexed.tier) return null;
  return { assetId, filename: indexed.filename, width: metadata.width, height: metadata.height, tier: metadata.tier };
}

function assignmentFromRow(row) {
  return {
    assetId: row.asset_id,
    assetSha256: row.asset_id,
    filename: row.filename,
    username: row.username,
    issuedAt: row.issued_at,
    platform: row.platform,
    linkId: row.link_id
  };
}

async function readDatabaseAwards(db) {
  const result = await db.prepare("SELECT * FROM awards ORDER BY issued_at DESC, link_id ASC").all();
  if (!result || !Array.isArray(result.results)) throw new Error("The reward database did not return records.");
  return result.results;
}

async function allAssignments(env) {
  const [staticAssignments, rows] = await Promise.all([
    readStaticAssignments(env),
    readDatabaseAwards(env.DB)
  ]);
  const records = [];
  const byAsset = new Map();
  const byLink = new Map();

  for (const record of [...staticAssignments, ...rows.map(assignmentFromRow)]) {
    const assetId = String(record.assetId ?? record.assetSha256).toLowerCase();
    const linkId = UUID4_PATTERN.test(record.linkId || "") ? record.linkId.toLowerCase() : record.linkId;
    if (!ASSET_ID_PATTERN.test(assetId) || (linkId &&
        !(COMPACT_ID_PATTERN.test(linkId) || UUID4_PATTERN.test(linkId)))) {
      throw new Error("The reward index contains a malformed assignment.");
    }
    const canonical = { ...record, assetId, assetSha256: assetId, linkId };
    const priorAsset = byAsset.get(assetId);
    const priorLink = linkId ? byLink.get(linkId) : null;
    if (priorAsset || priorLink) {
      const prior = priorAsset || priorLink;
      if (prior.assetId !== canonical.assetId || prior.linkId !== canonical.linkId ||
          normalizeUsername(prior.username) !== normalizeUsername(canonical.username)) {
        throw new Error("The reward index contains conflicting assignments.");
      }
      continue;
    }
    byAsset.set(assetId, canonical);
    if (linkId) byLink.set(linkId, canonical);
    records.push(canonical);
  }

  records.sort((left, right) => Date.parse(right.issuedAt || "") - Date.parse(left.issuedAt || "") ||
    left.filename.localeCompare(right.filename));
  return records;
}

function validEventId(value) {
  return value == null || (typeof value === "string" && value.length > 0 && value.length <= 128 &&
    USERNAME_PATTERN.test(value));
}

function sameIssue(row, username, assetId) {
  return row && row.asset_id === assetId && normalizeUsername(row.username) === normalizeUsername(username);
}

async function issueAward(request, env) {
  if (request.headers.has("Origin")) {
    return error(request, env, 403, "Issuing is server-to-server only.");
  }
  const authorized = hasIssuerKey(request, env);
  if (authorized === "misconfigured") return error(request, env, 503, "Award issuer is not configured.");
  if (!authorized) return error(request, env, 401, "Award issuer authentication failed.");
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return error(request, env, 415, "Content-Type must be application/json.");
  }

  const announcedLength = Number(request.headers.get("Content-Length") || 0);
  if (announcedLength > MAX_BODY_BYTES) return error(request, env, 413, "Award request is too large.");
  let rawBody;
  try {
    rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return error(request, env, 413, "Award request is too large.");
    }
  } catch {
    return error(request, env, 400, "Award request could not be read.");
  }

  let body;
  try { body = JSON.parse(rawBody); } catch { return error(request, env, 400, "Award request is not valid JSON."); }
  const allowedFields = new Set(["username", "assetId", "eventId", "platform"]);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !allowedFields.has(key))) {
    return error(request, env, 400, "Award request contains unsupported fields.");
  }

  const username = typeof body.username === "string" ? body.username.normalize("NFKC").trim() : "";
  const assetId = typeof body.assetId === "string" ? body.assetId.toLowerCase() : "";
  const eventId = body.eventId ?? null;
  const platform = body.platform ?? "stream-game";
  if (!username || username.length > 100 || !USERNAME_PATTERN.test(username)) {
    return error(request, env, 400, "Username must be 1-100 characters without control characters.");
  }
  if (!ASSET_ID_PATTERN.test(assetId)) return error(request, env, 400, "assetId must be a SHA-256 artwork ID.");
  if (!validEventId(eventId)) return error(request, env, 400, "eventId must be 1-128 characters without control characters.");
  if (typeof platform !== "string" || !platform.trim() || platform.length > 60 || !USERNAME_PATTERN.test(platform)) {
    return error(request, env, 400, "platform must be 1-60 characters without control characters.");
  }

  let catalog;
  let staticAssignments;
  let artwork;
  try {
    [catalog, staticAssignments] = await Promise.all([readCatalog(env), readStaticAssignments(env)]);
    artwork = catalogAsset(catalog, assetId);
  } catch {
    return error(request, env, 503, "The published reward catalog is temporarily unavailable.");
  }
  if (!artwork) return error(request, env, 404, "That artwork is not in the published reward folder.");

  const db = env.DB;
  if (!db || typeof db.prepare !== "function") return error(request, env, 503, "Reward storage is not configured.");
  try {
    if (eventId) {
      const previousEvent = await db.prepare("SELECT * FROM awards WHERE event_id = ? LIMIT 1").bind(eventId).first();
      if (previousEvent) {
        if (sameIssue(previousEvent, username, assetId)) {
          return response(request, env, { assignment: assignmentFromRow(previousEvent), replayed: true }, 200);
        }
        return error(request, env, 409, "eventId was already used for a different award.");
      }
    }

    if (staticAssignments.some(record => String(record.assetId ?? record.assetSha256).toLowerCase() === assetId)) {
      return error(request, env, 409, "That artwork has already been assigned.");
    }
    const previousAsset = await db.prepare("SELECT * FROM awards WHERE asset_id = ? LIMIT 1").bind(assetId).first();
    if (previousAsset) return error(request, env, 409, "That artwork has already been assigned.");

    const linkId = newLinkId();
    const issuedAt = new Date().toISOString();
    const assignment = {
      assetId,
      assetSha256: assetId,
      filename: artwork.filename,
      username,
      issuedAt,
      platform: platform.trim(),
      linkId
    };
    try {
      const result = await db.prepare(
        "INSERT INTO awards (link_id, asset_id, username, username_key, filename, issued_at, platform, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(linkId, assetId, username, normalizeUsername(username), artwork.filename, issuedAt, platform.trim(), eventId).run();
      if (result?.success === false) throw new Error("Database rejected award insert.");
    } catch {
      if (eventId) {
        const eventWinner = await db.prepare("SELECT * FROM awards WHERE event_id = ? LIMIT 1").bind(eventId).first();
        if (eventWinner) {
          if (sameIssue(eventWinner, username, assetId)) {
            return response(request, env, { assignment: assignmentFromRow(eventWinner), replayed: true }, 200);
          }
          return error(request, env, 409, "eventId was already used for a different award.");
        }
      }
      const assetWinner = await db.prepare("SELECT * FROM awards WHERE asset_id = ? LIMIT 1").bind(assetId).first();
      if (assetWinner) return error(request, env, 409, "That artwork has already been assigned.");
      throw new Error("Award could not be saved.");
    }

    return response(request, env, {
      assignment,
      href: `${(env.SITE_ORIGIN || "https://kazvt.com").replace(/\/$/, "")}/reward/?id=${encodeURIComponent(linkId)}`
    }, 201);
  } catch {
    return error(request, env, 503, "Award storage is temporarily unavailable.");
  }
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("Origin");
    if (!origin || !allowedOrigins(env).has(origin) ||
        request.headers.get("Access-Control-Request-Method") !== "GET") {
      return new Response(null, { status: 403, headers: { "Vary": "Origin" } });
    }
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin"
    } });
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return response(request, env, { ok: true, service: "kazvt-reward-api" });
  }
  if (request.method === "POST" && url.pathname === "/v1/awards") {
    return issueAward(request, env);
  }
  if (request.method !== "GET") {
    return error(request, env, 405, "Method not allowed.");
  }

  try {
    if (url.pathname === "/v1/awards" || /^\/v1\/awards\/[^/]+$/.test(url.pathname) ||
        url.pathname === "/v1/artwork/available") {
      const records = await allAssignments(env);
      if (url.pathname === "/v1/awards") {
        const requestedUsername = url.searchParams.get("username");
        if (requestedUsername != null && (requestedUsername.length > 100 || !USERNAME_PATTERN.test(requestedUsername))) {
          return error(request, env, 400, "Invalid username filter.");
        }
        const filtered = requestedUsername == null ? records : records.filter(record =>
          normalizeUsername(record.username) === normalizeUsername(requestedUsername));
        return response(request, env, { version: 1, assignments: filtered });
      }

      if (url.pathname === "/v1/artwork/available") {
        const catalog = await readCatalog(env);
        const assignedIds = new Set(records.map(record => record.assetId));
        const artwork = Object.values(catalog.assetsById)
          .filter(item => item && ASSET_ID_PATTERN.test(item.assetId || "") && !assignedIds.has(item.assetId))
          .map(item => catalogAsset(catalog, item.assetId))
          .filter(Boolean)
          .sort((left, right) => left.filename.localeCompare(right.filename));
        return response(request, env, { version: 1, artwork });
      }

      let linkId;
      try { linkId = decodeURIComponent(url.pathname.slice("/v1/awards/".length)); }
      catch { return error(request, env, 400, "Invalid reward link ID."); }
      const normalizedId = UUID4_PATTERN.test(linkId) ? linkId.toLowerCase() : linkId;
      if (!(COMPACT_ID_PATTERN.test(normalizedId) || UUID4_PATTERN.test(normalizedId))) {
        return error(request, env, 400, "Invalid reward link ID.");
      }
      const assignment = records.find(record => record.linkId === normalizedId);
      return assignment
        ? response(request, env, { assignment })
        : error(request, env, 404, "Reward link not found.");
    }
    return error(request, env, 404, "Not found.");
  } catch {
    return error(request, env, 503, "Public reward data is temporarily unavailable.");
  }
}

export default { fetch: handleRequest };
