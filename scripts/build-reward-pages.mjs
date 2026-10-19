#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_HEAD = path.join(ROOT, "_includes", "reward", "head-assets.html");
const SHARED_BODY = path.join(ROOT, "_includes", "reward", "body.html");
const ASSET_PATHS = [
  "reward/reward.css",
  "reward/demo/demo.css",
  "reward/reward.js",
];

async function assetVersion() {
  const hash = createHash("sha256");
  for (const relativePath of ASSET_PATHS) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(path.join(ROOT, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 12);
}

function applyTokens(template, tokens, sourceName) {
  let result = template;
  for (const [name, value] of Object.entries(tokens)) {
    result = result.replaceAll(`{{${name}}}`, value);
  }
  const unresolved = result.match(/\{\{[^}]+\}\}|\{%[\s\S]*?%\}/g);
  if (unresolved) {
    throw new Error(`${sourceName} contains unresolved template syntax: ${unresolved.join(", ")}`);
  }
  return result;
}

function documentFor({ demo, head, body }) {
  const demoMetadata = demo
    ? [
        '  <meta name="description" content="A randomized, non-claimable preview of the kazvt.com chat rewards.">',
        '  <meta name="robots" content="noindex,follow">',
      ].join("\n")
    : "";
  const demoAttribute = demo ? "data-reward-demo " : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self' https://raw.githubusercontent.com; base-uri 'none'; form-action 'none'">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
${demoMetadata ? `${demoMetadata}\n` : ""}${head}
  <link rel="stylesheet" href="/zzz_shared/square-corners.css?v=1">
</head>
<body ${demoAttribute}data-page-state="loading">
${body}
</body>
</html>
`;
}

async function buildRewardPages() {
  const [headTemplate, bodyTemplate, version] = await Promise.all([
    readFile(SHARED_HEAD, "utf8"),
    readFile(SHARED_BODY, "utf8"),
    assetVersion(),
  ]);

  const pages = [
    {
      output: "reward/index.html",
      demo: false,
      tokens: {
        REWARD_DEMO_CLASS: "",
        REWARD_DEMO_NOTE: "",
        ERROR_TITLE: "Reward link unavailable",
        ERROR_MESSAGE: "Complete link required.",
        DEMO_FOOTNOTE: "",
      },
    },
    {
      output: "reward/demo/index.html",
      demo: true,
      tokens: {
        REWARD_DEMO_CLASS: " reward-demo-card",
        REWARD_DEMO_NOTE: "Demo only. No reward is issued or attached to this name.",
        ERROR_TITLE: "Demo temporarily unavailable",
        ERROR_MESSAGE: "Couldn't load a demo. Please try again.",
        DEMO_FOOTNOTE: '<p class="demo-footnote" hidden>The name and artwork are randomized. Nothing is assigned or saved.</p>',
      },
    },
  ];

  for (const page of pages) {
    const head = applyTokens(headTemplate, { REWARD_ASSET_VERSION: version }, "shared reward head");
    const body = applyTokens(bodyTemplate, page.tokens, "shared reward body");
    const output = documentFor({ demo: page.demo, head, body });
    await writeFile(path.join(ROOT, page.output), output, "utf8");
    console.log(`generated ${page.output}`);
  }
}

buildRewardPages().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
