import assert from "node:assert/strict";
import test from "node:test";
import { issueAward, listAvailableArtwork } from "./issue-award.mjs";

const ASSET_ID = "a".repeat(64);
const LINK_ID = "abcdefghijklmnopqrstuv";
const catalog = {
  version: 4,
  assetIdAlgorithm: "sha256-png-bytes-v1",
  files: ["new-reward.png"],
  assets: {
    "new-reward.png": { assetId: ASSET_ID, sha256: ASSET_ID, width: 120, height: 90, tier: "rare" }
  },
  assetsById: {
    [ASSET_ID]: { filename: "new-reward.png", width: 120, height: 90, tier: "rare" }
  }
};
const emptyRegistry = { version: 1, assignments: [] };
const request = { username: "Winner", assetId: ASSET_ID, eventId: "match-2026-10-14-7", platform: "stream-game" };

function urlOf(input) {
  return new URL(input instanceof URL ? input.href : String(input));
}

test("lists only unassigned reward PNGs from the published Pages catalog", async () => {
  const fetchImpl = async input => {
    const url = urlOf(input);
    if (url.pathname.endsWith("manifest.json")) return Response.json(catalog);
    if (url.pathname.endsWith("assignments.json")) return Response.json(emptyRegistry);
    throw new Error(`Unexpected request ${url}`);
  };
  assert.deepEqual(await listAvailableArtwork({ fetchImpl }), [{
    assetId: ASSET_ID, filename: "new-reward.png", width: 120, height: 90, tier: "rare"
  }]);
});

test("dispatches through GitHub and waits for the award to publish on Pages", async () => {
  let dispatchedBody;
  let publishedRegistry = emptyRegistry;
  const issued = {
    assetId: ASSET_ID,
    assetSha256: ASSET_ID,
    filename: "new-reward.png",
    username: request.username,
    issuedAt: "2026-10-14T10:00:00.000Z",
    platform: request.platform,
    linkId: LINK_ID,
    eventId: request.eventId
  };
  const fetchImpl = async (input, init = {}) => {
    const url = urlOf(input);
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/dispatches")) {
      dispatchedBody = JSON.parse(init.body);
      publishedRegistry = { version: 1, assignments: [issued] };
      return Response.json({ workflow_run_id: 456, html_url: "https://github.com/kazvt/kazvt.com/actions/runs/456" }, { status: 200 });
    }
    if (url.hostname === "kazvt.com" && url.pathname.endsWith("manifest.json")) return Response.json(catalog);
    if (url.hostname === "kazvt.com" && url.pathname.endsWith("assignments.json")) return Response.json(publishedRegistry);
    throw new Error(`Unexpected request ${url}`);
  };
  const result = await issueAward(request, {
    token: "github_pat_test_token_long_enough",
    fetchImpl,
    sleepImpl: async () => {},
    siteOrigin: "https://kazvt.com"
  });
  assert.equal(dispatchedBody.ref, "main");
  assert.deepEqual(dispatchedBody.inputs, {
    username: request.username,
    asset_id: ASSET_ID,
    event_id: request.eventId,
    platform: request.platform
  });
  assert.equal(result.assignment.linkId, LINK_ID);
  assert.equal(result.href, `https://kazvt.com/reward/?id=${LINK_ID}`);
  assert.equal(result.replayed, false);
});

test("an already published retry returns its original link without dispatching again", async () => {
  const existing = {
    assetId: ASSET_ID,
    filename: "new-reward.png",
    username: request.username,
    issuedAt: "2026-10-14T10:00:00.000Z",
    platform: request.platform,
    linkId: LINK_ID,
    eventId: request.eventId
  };
  let dispatches = 0;
  const fetchImpl = async input => {
    const url = urlOf(input);
    if (url.pathname.endsWith("manifest.json")) return Response.json(catalog);
    if (url.pathname.endsWith("assignments.json")) return Response.json({ version: 1, assignments: [existing] });
    if (url.hostname === "api.github.com") dispatches += 1;
    throw new Error(`Unexpected request ${url}`);
  };
  const result = await issueAward(request, { fetchImpl });
  assert.equal(result.replayed, true);
  assert.equal(result.href, `https://kazvt.com/reward/?id=${LINK_ID}`);
  assert.equal(dispatches, 0);
});

test("reports a failed GitHub Actions issuance instead of pretending it succeeded", async () => {
  const fetchImpl = async (input, init = {}) => {
    const url = urlOf(input);
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/dispatches")) return new Response(null, { status: 204 });
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/runs")) {
      return Response.json({ workflow_runs: [{
        display_title: `Reward issuance: ${request.eventId}`,
        created_at: new Date().toISOString(),
        status: "completed",
        conclusion: "failure",
        id: 999,
        html_url: "https://github.com/kazvt/kazvt.com/actions/runs/999"
      }] });
    }
    if (url.pathname.endsWith("manifest.json")) return Response.json(catalog);
    if (url.pathname.endsWith("assignments.json")) return Response.json(emptyRegistry);
    throw new Error(`Unexpected request ${url}`);
  };
  await assert.rejects(issueAward(request, {
    token: "github_pat_test_token_long_enough",
    fetchImpl,
    sleepImpl: async () => {}
  }), /finished with failure/);
});
