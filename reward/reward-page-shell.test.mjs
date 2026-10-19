import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [rewardPage, demoPage, sharedHead, sharedBody, rewardScript, rewardStyles, galleryScript, galleryStyles, galleryPage] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./demo/index.html", import.meta.url), "utf8"),
  readFile(new URL("../_includes/reward/head-assets.html", import.meta.url), "utf8"),
  readFile(new URL("../_includes/reward/body.html", import.meta.url), "utf8"),
  readFile(new URL("./reward.js", import.meta.url), "utf8"),
  readFile(new URL("./reward.css", import.meta.url), "utf8"),
  readFile(new URL("../reward/list/list.js", import.meta.url), "utf8"),
  readFile(new URL("../reward/list/list.css", import.meta.url), "utf8"),
  readFile(new URL("../reward/list/index.html", import.meta.url), "utf8"),
]);

test("reward and demo pages use the same shared shell and versioned assets", () => {
  for (const page of [rewardPage, demoPage]) {
    assert.doesNotMatch(page, /\{%|\{\{/,
      "published reward documents must be fully rendered static HTML");
    assert.match(page, /<meta charset="utf-8">/);
    assert.match(page, /id="rewardFavicon"/);
    assert.match(page, /id="rewardArtworkMotion"/);
  }

  assert.match(sharedHead, /id="rewardFavicon"/);
  assert.match(sharedHead, /reward\.css\?v=\{\{REWARD_ASSET_VERSION\}\}/);
  assert.match(sharedHead, /reward\.js\?v=\{\{REWARD_ASSET_VERSION\}\}/);
  assert.match(rewardPage, /reward\.css\?v=[a-f0-9]{12}/);
  assert.match(demoPage, /reward\.css\?v=[a-f0-9]{12}/);
  assert.doesNotMatch(rewardPage, /data-reward-demo/);
  assert.match(demoPage, /<body data-reward-demo data-page-state="loading">/);
  assert.match(rewardPage, /Reward link unavailable/);
  assert.match(demoPage, /Demo temporarily unavailable/);
  assert.match(rewardPage, /Complete link required\./);
  assert.match(demoPage, /Couldn't load a demo\. Please try again\./);
});

test("the common reward component retains artwork, tier, title, collection, and gallery UI", () => {
  for (const id of [
    "artWallpaper", "rewardDecals", "loadingState", "rewardArtworkMotion", "rewardImage",
    "filename", "awardReason", "rewardTier", "recipient", "awardNote", "awardCollection", "errorState",
    "allRewardsLink",
  ]) {
    assert.match(sharedBody, new RegExp(`id="${id}"`));
  }
  assert.match(sharedBody, /\{\{REWARD_DEMO_CLASS\}\}/);

  const sharedRenderer = rewardScript.match(/async function renderRewardPage[\s\S]*?(?=async function openDemo)/)?.[0] ?? "";
  const demoLoader = rewardScript.match(/async function openDemo[\s\S]*?(?=async function openReward)/)?.[0] ?? "";
  const assignmentLoader = rewardScript.match(/async function openReward[\s\S]*?(?=\n  if \(document\.body\.hasAttribute)/)?.[0] ?? "";
  assert.match(sharedRenderer, /setRewardFavicon\(file, metadata\.assetId\)/);
  assert.match(sharedRenderer, /if \(allRewardsLink\) allRewardsLink\.hidden = false;/,
    "the shared reward gallery link is shown for both assigned rewards and demos");
  assert.doesNotMatch(sharedRenderer, /allRewardsLink\.hidden\s*=\s*demo/,
    "demo mode must not suppress shared reward-page UI");

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

test("all reward-panel content layers above the side decals", () => {
  const decalRule = rewardStyles.match(/\.reward-decal-layer\s*\{([^}]*)\}/)?.[1] ?? "";
  const contentRule = rewardStyles.match(/\.reward-card\s*>\s*:not\(\.reward-decal-layer\)\s*\{([^}]*)\}/)?.[1] ?? "";
  const decalZIndex = Number(decalRule.match(/\bz-index:\s*(-?\d+)/)?.[1]);
  const contentZIndex = Number(contentRule.match(/\bz-index:\s*(-?\d+)/)?.[1]);

  assert.ok(Number.isFinite(decalZIndex), "side decal layer has an explicit stacking level");
  assert.ok(Number.isFinite(contentZIndex), "panel content has an explicit stacking level");
  assert.ok(contentZIndex > decalZIndex,
    "artwork, tier, and text must paint above the side decal layer");
});

test("gallery usernames follow the whole-card reward link while detail usernames still open the gallery", () => {
  const cardRenderer = galleryScript.match(/async function makeCard\([\s\S]*?(?=\n  function updateResults)/)?.[0] ?? "";
  assert.match(cardRenderer, /createText\("h2", "username username-display", shownUsername\)/,
    "the gallery card displays its username as non-interactive text");
  assert.doesNotMatch(cardRenderer, /createUserRewardListHref|username-list-link/,
    "clicking the card username must not route to the user's gallery");
  assert.match(cardRenderer, /createRewardHref\(assignment\.linkId/,
    "the card still links to the individual reward");

  const cardOverlay = galleryStyles.match(/\.open-button\[href\]::after\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(cardOverlay, /\binset:\s*0\s*;/,
    "the reward link overlay continues to make the whole card clickable");

  const usernameMention = rewardScript.match(/function usernameMention\(username\)\s*\{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(usernameMention, /createUserRewardListHref\(username/,
    "username links on individual reward pages still open that user's gallery");
});

test("palette-free reward gallery titles use the mixed font set while the demo stays separate", () => {
  assert.match(galleryScript, /createMixedTitleGlyphs\(text\)/,
    "gallery headings are rendered glyph-by-glyph from the mixed-font pool");
  assert.match(galleryScript, /let title = "Rewards"/,
    "the unfiltered rewards gallery gets the mixed title treatment");
  assert.match(galleryScript, /title = `\$\{displayUsername\(requestedUsername\)\} Rewards`/,
    "username-filtered galleries use the same title renderer");
  assert.match(galleryStyles, /\.mixed-title-glyph--comic\s*\{[^}]*"Comic Sans MS"/,
    "Comic Sans is available as one of the glyph fonts");
  assert.match(galleryPage, /list\.css\?v=indecisive-title-fonts-20261020-v2/,
    "the updated collage stylesheet receives a fresh cache key");
  assert.match(galleryPage, /list\.js\?v=indecisive-title-fonts-20261020-v2/,
    "the updated collage script receives a fresh cache key");
  assert.doesNotMatch(demoPage, /mixed-title-glyph|mixed-title\.mjs|list\.js/,
    "the standalone demo page does not load the palette-free gallery title treatment");
});
