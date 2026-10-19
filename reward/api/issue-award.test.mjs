import assert from "node:assert/strict";
import test from "node:test";
import { issueAward, listAvailableArtwork } from "./issue-award.mjs";

const ASSET_ID = "a".repeat(64);
const LINK_ID = "abcdefghijklmnop";
const artwork = { assetId: ASSET_ID, filename: "new-reward.png", width: 120, height: 90, tier: "rare" };
const request = {
  username: "Winner", assetId: ASSET_ID, eventId: "match-2026-10-14-7",
  platform: "stream-game", reason: "won tic tac toe"
};
const assignment = {
  ...artwork,
  assetSha256: ASSET_ID,
  issuedAt: "2026-10-14T10:00:00.000Z",
  username: request.username,
  platform: request.platform,
  reason: request.reason,
  linkId: LINK_ID,
  eventIdHash: "b".repeat(64)
};

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

test("lists available art from the local MSI endpoint and sends same-origin headers", async () => {
  let calledUrl;
  let calledInit;
  const fetchImpl = async (url, init) => {
    calledUrl = new URL(url);
    calledInit = init;
    return response({ ok: true, artworks: [artwork] });
  };
  assert.deepEqual(await listAvailableArtwork({ fetchImpl }), [artwork]);
  assert.equal(calledUrl.href, "http://127.0.0.1:8000/reward-api/available");
  assert.equal(calledInit.headers.Origin, "http://127.0.0.1:8000");
  assert.equal(calledInit.cache, "no-store");
});

test("issues locally, waits for Pages, and returns a verifiable public reward link", async () => {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, init });
    if (url.hostname === "127.0.0.1") return response({ ok: true, assignment, replayed: false, pushed: true }, 201);
    if (url.pathname.endsWith("assignments.json")) return response({ version: 1, assignments: [assignment] });
    throw new Error(`Unexpected request ${url}`);
  };
  const result = await issueAward(request, { fetchImpl, siteOrigin: "https://kazvt.com" });
  assert.equal(result.href, `https://kazvt.com/reward/?id=${LINK_ID}`);
  assert.equal(result.assignment.linkId, LINK_ID);
  assert.equal(result.replayed, false);
  const issueCall = calls.find(call => call.url.pathname === "/reward-api/issue");
  assert.equal(issueCall.init.method, "POST");
  assert.equal(issueCall.init.headers.Origin, "http://127.0.0.1:8000");
  assert.equal(JSON.parse(issueCall.init.body).eventId, request.eventId);
  assert.equal(JSON.parse(issueCall.init.body).reason, request.reason);
  assert.equal(calls.some(call => call.url.hostname === "api.github.com"), false);
});

test("accepts a published replay for the same winner and art", async () => {
  const replayedAssignment = { ...assignment };
  const fetchImpl = async input => {
    const url = new URL(input);
    if (url.hostname === "127.0.0.1") return response({ ok: true, assignment: replayedAssignment, replayed: true, pushed: true });
    if (url.pathname.endsWith("assignments.json")) return response({ version: 1, assignments: [replayedAssignment] });
    throw new Error(`Unexpected request ${url}`);
  };
  const result = await issueAward(request, { fetchImpl });
  assert.equal(result.replayed, true);
  assert.equal(result.assignment.linkId, LINK_ID);
});

test("rejects non-loopback API URLs and invalid issuance inputs", async () => {
  await assert.rejects(listAvailableArtwork({ apiOrigin: "https://evil.example" }), /only allows a local MSI server/);
  await assert.rejects(issueAward({ ...request, username: "" }), /username/);
  await assert.rejects(issueAward({ ...request, eventId: "" }), /eventId/);
  await assert.rejects(issueAward({ ...request, reason: "x".repeat(181) }), /reason/);
  await assert.rejects(issueAward({ ...request, reason: "win \u202e replay" }), /bidirectional/);
});

test("does not claim success when the public Pages registry never catches up", async () => {
  const fetchImpl = async input => {
    const url = new URL(input);
    if (url.hostname === "127.0.0.1") return response({ ok: true, assignment, replayed: false, pushed: true }, 201);
    if (url.pathname.endsWith("assignments.json")) return response({ version: 1, assignments: [] });
    throw new Error(`Unexpected request ${url}`);
  };
  await assert.rejects(issueAward(request, {
    fetchImpl,
    timeoutMs: 3,
    pollIntervalMs: 1,
    sleepImpl: async () => {}
  }), /pushed to GitHub.*Retry with the same eventId/);
});
