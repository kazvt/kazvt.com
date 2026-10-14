import assert from "node:assert/strict";
import test from "node:test";
import { handleRequest } from "../src/index.mjs";

const ART_A = "a".repeat(64);
const ART_B = "b".repeat(64);
const ISSUER_KEY = "0123456789abcdef0123456789abcdef0123456789abc";
const catalog = {
  version: 4,
  assetIdAlgorithm: "sha256-png-bytes-v1",
  files: ["alpha.png", "beta.png"],
  assets: {
    "alpha.png": { assetId: ART_A, sha256: ART_A, width: 32, height: 32, tier: "common" },
    "beta.png": { assetId: ART_B, sha256: ART_B, width: 48, height: 48, tier: "rare" }
  },
  assetsById: {
    [ART_A]: { assetId: ART_A, filename: "alpha.png", width: 32, height: 32, tier: "common" },
    [ART_B]: { assetId: ART_B, filename: "beta.png", width: 48, height: 48, tier: "rare" }
  }
};
const staticAssignments = [{
  assetId: ART_B,
  assetSha256: ART_B,
  filename: "beta.png",
  username: "kazvt",
  issuedAt: "2026-10-13T00:00:00.000Z",
  platform: "manual",
  linkId: "e2b8a0b2-7dd8-4d10-802f-d308ec33ffe7"
}];

class FakeD1 {
  rows = [];

  prepare(sql) {
    return {
      bind: (...values) => ({
        first: async () => this.first(sql, values),
        all: async () => this.all(sql),
        run: async () => this.run(sql, values)
      })
    };
  }

  async first(sql, values) {
    if (sql.includes("WHERE event_id =")) return this.rows.find(row => row.event_id === values[0]) ?? null;
    if (sql.includes("WHERE asset_id =")) return this.rows.find(row => row.asset_id === values[0]) ?? null;
    if (sql.includes("WHERE link_id =")) return this.rows.find(row => row.link_id === values[0]) ?? null;
    throw new Error(`Unsupported fake query: ${sql}`);
  }

  async all() {
    return { results: [...this.rows].sort((left, right) => right.issued_at.localeCompare(left.issued_at)) };
  }

  async run(sql, values) {
    if (!sql.startsWith("INSERT INTO awards")) throw new Error(`Unsupported fake query: ${sql}`);
    const [link_id, asset_id, username, username_key, filename, issued_at, platform, event_id] = values;
    if (this.rows.some(row => row.asset_id === asset_id || row.link_id === link_id ||
        (event_id && row.event_id === event_id))) throw new Error("unique constraint failed");
    this.rows.push({ link_id, asset_id, username, username_key, filename, issued_at, platform, event_id });
    return { success: true };
  }
}

test("the issuer is private, idempotent, one-of-one, and readable by the public site", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname.endsWith("/manifest.json")) return Response.json(catalog);
    if (url.pathname.endsWith("/assignments.json")) return Response.json({ version: 1, assignments: staticAssignments });
    throw new Error(`Unexpected upstream fetch: ${url}`);
  };

  const env = {
    SITE_ORIGIN: "https://kazvt.com",
    ALLOWED_ORIGINS: "https://kazvt.com,https://www.kazvt.com",
    AWARD_ISSUER_KEY: ISSUER_KEY,
    DB: new FakeD1()
  };
  const issue = (body, headers = {}) => handleRequest(new Request("https://api.test/v1/awards", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  }), env);

  try {
    const unauthorized = await issue({ username: "attacker", assetId: ART_A });
    assert.equal(unauthorized.status, 401);

    const browserRequest = await issue({ username: "attacker", assetId: ART_A }, {
      Authorization: `Bearer ${ISSUER_KEY}`,
      Origin: "https://kazvt.com"
    });
    assert.equal(browserRequest.status, 403);

    const forbiddenStaticArtwork = await issue({ username: "viewer", assetId: ART_B }, {
      Authorization: `Bearer ${ISSUER_KEY}`
    });
    assert.equal(forbiddenStaticArtwork.status, 409);

    const first = await issue({ username: "Winner", assetId: ART_A, eventId: "round-7-winner-1" }, {
      Authorization: `Bearer ${ISSUER_KEY}`
    });
    assert.equal(first.status, 201);
    const firstPayload = await first.json();
    assert.match(firstPayload.assignment.linkId, /^[A-Za-z0-9_-]{22}$/);
    assert.equal(firstPayload.assignment.filename, "alpha.png");
    assert.equal(firstPayload.href, `https://kazvt.com/reward/?id=${firstPayload.assignment.linkId}`);

    const retry = await issue({ username: "Winner", assetId: ART_A, eventId: "round-7-winner-1" }, {
      Authorization: `Bearer ${ISSUER_KEY}`
    });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).assignment.linkId, firstPayload.assignment.linkId);

    const conflictingRetry = await issue({ username: "SomeoneElse", assetId: ART_A, eventId: "round-7-winner-1" }, {
      Authorization: `Bearer ${ISSUER_KEY}`
    });
    assert.equal(conflictingRetry.status, 409);

    const duplicateArtwork = await issue({ username: "Another", assetId: ART_A, eventId: "round-8-winner-1" }, {
      Authorization: `Bearer ${ISSUER_KEY}`
    });
    assert.equal(duplicateArtwork.status, 409);

    const list = await handleRequest(new Request("https://api.test/v1/awards", {
      headers: { Origin: "https://kazvt.com" }
    }), env);
    assert.equal(list.status, 200);
    assert.equal(list.headers.get("Access-Control-Allow-Origin"), "https://kazvt.com");
    const registry = await list.json();
    assert.deepEqual(registry.assignments.map(record => record.assetId).sort(), [ART_A, ART_B].sort());

    const detail = await handleRequest(new Request(`https://api.test/v1/awards/${firstPayload.assignment.linkId}`), env);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).assignment.username, "Winner");

    const available = await handleRequest(new Request("https://api.test/v1/artwork/available"), env);
    assert.equal(available.status, 200);
    assert.deepEqual((await available.json()).artwork, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
