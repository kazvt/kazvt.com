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
  const assignmentLoader = rewardScript.match(/async function openReward[\s\S]*?(?=\n  await \(window\.KazvtI18n\?\.ready)/)?.[0] ?? "";
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

test("the optional reason note is centered on the reward panel's bottom edge", () => {
  assert.match(sharedBody, /<\/section>\s*<p id="awardReason" class="reward-reason"/,
    "the reason note sits outside the content stack so it can anchor to the panel");

  const anchorRule = rewardStyles.match(/\.reward-card\s*>\s*#awardReason\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(anchorRule, /position:\s*absolute/);
  assert.match(anchorRule, /left:\s*50%/);
  assert.match(anchorRule, /bottom:\s*0/);
  assert.match(anchorRule, /transform:\s*translate\(-50%,\s*50%\)/,
    "the note's center is the fixed point on the panel edge, so longer notes expand around it");
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

test("palette-free galleries keep their glyph collage except tier-styled reward names and notes", () => {
  assert.match(galleryScript, /createMixedGlyphs\(text\)/,
    "all wrapped gallery text uses the mixed-font glyph generator");
  assert.match(galleryScript, /mixTextIn\(document\.body\)/,
    "static page copy receives the treatment on load");
  assert.match(galleryScript, /new MutationObserver/,
    "async status copy and dynamically rendered cards receive the same treatment");
  assert.match(galleryScript, /mixed-page-glyph \$\{fontClass\}/,
    "each non-space grapheme gets its own font span");
  assert.match(galleryScript, /currentWord\.className = "mixed-page-word"/,
    "glyphs stay grouped by word rather than becoming individual wrap points");
  assert.match(galleryStyles, /\.mixed-page-word\s*\{[^}]*display:\s*inline-block/,
    "whole words move together unless an unusually long word must break to fit");
  assert.match(galleryScript, /parent\.closest\([\s\S]*?\.tier-font-text/,
    "tier-styled reward text is excluded from the page-wide glyph observer");
  assert.match(galleryScript, /createText\("p", "artwork-name tier-font-text"/,
    "reward names opt into their own tier font");
  assert.match(galleryScript, /createText\("span", "award-reason-text tier-font-text"/,
    "the optional reason note also opts into its reward's tier font");
  for (const [tier, font] of [
    ["common", "Naughty Tape"], ["uncommon", "Comic Sans MS"], ["rare", "SPIRAL"],
    ["epic", "Panties Bottom"], ["legendary", "Freak Show"],
    ["mythic", "Crash Team Racing"], ["divine", "Bricked Up"], ["splus", "SPIRAL"]
  ]) {
    assert.match(galleryStyles, new RegExp(`\\.award-card\\[data-tier="${tier}"\\][^{]*\\{[^}]*--reward-tier-font:\\s*"${font}"`),
      `${tier} reward text uses the same font mapping as its individual reward page`);
  }
  assert.match(galleryScript, /renderMixedText\(pageTitle, title\)/,
    "the main and username-filtered headings use the shared renderer");
  assert.match(galleryStyles, /\.mixed-page-glyph--comic\s*\{[^}]*"Comic Sans MS"/,
    "Comic Sans is available as one of the glyph fonts");
  assert.match(galleryStyles, /input:focus:not\(:placeholder-shown\) ~ \.search-glyph-overlay\s*\{\s*display:\s*none/,
    "search typing remains native once the user enters a query");
  assert.match(galleryPage, /id="poolMeterEmptyCount"/,
    "the decorative zero-pool label is real text, so it can use per-glyph fonts");
  assert.match(galleryPage, /id="searchGlyphOverlay"[^>]*aria-hidden="true"/,
    "the collage search overlay remains decorative to assistive technology");
  assert.match(galleryPage, /list\.css\?v=reward-intro-comic-20261022-v1/,
    "the updated gallery stylesheet receives a fresh cache key");
  assert.match(galleryPage, /list\.js\?v=gallery-edge-decals-20261020-v3/,
    "the updated gallery script receives a fresh cache key");
  const previewBackdrop = galleryStyles.match(/\.artwork-frame::before\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(previewBackdrop, /opacity:\s*0\.7\s*;/,
    "only the artwork preview backdrop is reduced to 70% opacity");
  assert.doesNotMatch(galleryStyles.match(/\.artwork-frame\s*\{([^}]*)\}/)?.[1] ?? "", /opacity:/,
    "the preview frame itself is not faded along with its artwork");
  assert.match(galleryPage, /id="galleryDecals"[^>]*aria-hidden="true"/,
    "gallery decals are decorative and hidden from assistive technology");
  assert.match(galleryStyles, /\.gallery-edge-decal\s*\{[^}]*filter:\s*grayscale\(70%\)/,
    "gallery decals retain some color while being mostly desaturated");
  assert.match(galleryStyles, /\.index-shell\s*>\s*:not\(\.gallery-decal-layer\)\s*\{[^}]*z-index:\s*1/,
    "all gallery content stays layered above the edge decals");
  assert.doesNotMatch(demoPage, /mixed-page-glyph|mixed-glyphs\.mjs|list\.js/,
    "the standalone demo page does not load the palette-free gallery treatment");
  assert.doesNotMatch(rewardPage, /mixed-page-glyph|mixed-glyphs\.mjs|list\.js/,
    "individual reward pages do not load the palette-free gallery treatment");
});
