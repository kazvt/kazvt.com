import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [rewardPage, demoPage, sharedHead, sharedBody] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./demo/index.html", import.meta.url), "utf8"),
  readFile(new URL("../_includes/reward/head-assets.html", import.meta.url), "utf8"),
  readFile(new URL("../_includes/reward/body.html", import.meta.url), "utf8"),
]);

test("reward and demo pages use the same shared shell and versioned assets", () => {
  for (const page of [rewardPage, demoPage]) {
    assert.match(page, /\{% include reward\/head-assets\.html %\}/);
    assert.match(page, /\{% include reward\/body\.html %\}/);
    assert.match(page, /layout: null/);
  }

  assert.match(demoPage, /reward_demo: true/);
  assert.match(sharedHead, /id="rewardFavicon"/);
  assert.match(sharedHead, /reward\.css\?v=\{\{ reward_asset_version \}\}/);
  assert.match(sharedHead, /reward\.js\?v=\{\{ reward_asset_version \}\}/);
});

test("the common reward component retains artwork, tier, title, collection, and gallery UI", () => {
  for (const id of [
    "artWallpaper", "rewardDecals", "loadingState", "rewardArtworkMotion", "rewardImage",
    "filename", "rewardTier", "recipient", "awardNote", "awardCollection", "errorState",
    "allRewardsLink",
  ]) {
    assert.match(sharedBody, new RegExp(`id="${id}"`));
  }
  assert.match(sharedBody, /page\.reward_demo/);
});
