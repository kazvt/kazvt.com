import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [rewardPage, demoPage, sharedHead, sharedBody, rewardScript] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./demo/index.html", import.meta.url), "utf8"),
  readFile(new URL("../_includes/reward/head-assets.html", import.meta.url), "utf8"),
  readFile(new URL("../_includes/reward/body.html", import.meta.url), "utf8"),
  readFile(new URL("./reward.js", import.meta.url), "utf8"),
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

  const sharedRenderer = rewardScript.match(/async function renderRewardPage[\s\S]*?(?=async function openDemo)/)?.[0] ?? "";
  const demoLoader = rewardScript.match(/async function openDemo[\s\S]*?(?=async function openReward)/)?.[0] ?? "";
  const assignmentLoader = rewardScript.match(/async function openReward[\s\S]*?(?=\n  if \(document\.body\.hasAttribute)/)?.[0] ?? "";
  assert.match(sharedRenderer, /setRewardFavicon\(file, metadata\.assetId\)/);

  const titleIndex = sharedRenderer.indexOf("setRewardTitle(file, displayName)");
  const faviconIndex = sharedRenderer.indexOf("setRewardFavicon(file, metadata.assetId)");
  const imageWaitIndex = sharedRenderer.indexOf("await waitForRewardImage(imageUrl)");
  const minimumLoadingWaitIndex = sharedRenderer.indexOf("await waitForMinimumLoading()");
  assert.ok(titleIndex >= 0 && faviconIndex >= 0, "title and favicon are set once reward identity is known");
  assert.ok(titleIndex < imageWaitIndex && titleIndex < minimumLoadingWaitIndex,
    "tab title updates before image loading and the minimum loading screen delay");
  assert.ok(faviconIndex < imageWaitIndex && faviconIndex < minimumLoadingWaitIndex,
    "reward favicon starts loading before image loading and the minimum loading screen delay");

  assert.match(demoLoader, /await renderRewardPage\(/);
  assert.match(assignmentLoader, /await renderRewardPage\(/);
});
