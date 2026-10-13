import assert from "node:assert/strict";
import test from "node:test";
import { createRewardHref } from "./reward-link.mjs";
import { decryptReward } from "./reward-crypto.mjs";

test("each award gets its own direct URL for the exact assigned artwork", async () => {
  const awards = [
    { username: "kazvt", assetId: "a".repeat(64) },
    { username: "Kazvt", assetId: "b".repeat(64) }
  ];
  const hrefs = await Promise.all(awards.map(award =>
    createRewardHref(award.username, award.assetId, "https://kazvt.com")));

  assert.notEqual(hrefs[0], hrefs[1]);
  for (const [index, href] of hrefs.entries()) {
    const url = new URL(href);
    const payload = await decryptReward(url.searchParams.get("id"), new URLSearchParams(url.hash.slice(1)).get("key"));
    assert.equal(url.origin, "https://kazvt.com");
    assert.equal(url.pathname, "/reward/");
    assert.deepEqual(payload, { version: 2, ...awards[index] });
  }
});
