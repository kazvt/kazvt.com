import assert from "node:assert/strict";
import test from "node:test";
import { rewardFaviconForAsset } from "./reward-favicon.mjs";

test("reward favicons use the reward image and a content-hash cache key", () => {
  const assetId = "a".repeat(64);
  const favicon = rewardFaviconForAsset("Fit checkkkk 🔥🔥🔥.gif", assetId, "https://kazvt.com");
  const url = new URL(favicon.href, "https://kazvt.com");

  assert.equal(url.pathname, "/zzz_assets/rewards/Fit%20checkkkk%20%F0%9F%94%A5%F0%9F%94%A5%F0%9F%94%A5.gif");
  assert.equal(url.searchParams.get("v"), assetId);
  assert.equal(favicon.type, "image/gif");
});

test("PNG rewards use the PNG favicon type", () => {
  const favicon = rewardFaviconForAsset("Reward art.PNG", "b".repeat(64), "https://kazvt.com");

  assert.equal(favicon.type, "image/png");
});

test("invalid asset names and IDs cannot become favicon URLs", () => {
  const validId = "c".repeat(64);
  for (const filename of ["", "../reward.gif", "folder\\reward.gif", "bad\nname.png", "x.svg"]) {
    assert.equal(rewardFaviconForAsset(filename, validId, "https://kazvt.com"), null);
  }
  assert.equal(rewardFaviconForAsset("reward.gif", "not-a-hash", "https://kazvt.com"), null);
});
