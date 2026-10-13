import { createHash } from "node:crypto";
import { readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WIDGET_ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(WIDGET_ROOT, "../..");
const REWARD_DIR = resolve(REPO_ROOT, "assets", "rewards");
const PUBLIC_MANIFEST = resolve(REWARD_DIR, "manifest.json");
const WIDGET_CATALOG = resolve(WIDGET_ROOT, "rewards.json");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const TIER_BUCKETS = [
  { id: "common", label: "Common", upperBound: 6000 },
  { id: "uncommon", label: "Uncommon", upperBound: 8200 },
  { id: "rare", label: "Rare", upperBound: 9400 },
  { id: "epic", label: "Epic", upperBound: 9850 },
  { id: "legendary", label: "Legendary", upperBound: 10000 }
];

export const TIER_ALGORITHM = "sha256-leading-32-bit-weighted-v1";

export function tierBucketForSha256(sha256) {
  if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(sha256)) {
    throw new TypeError("Expected a 64-character SHA-256 hex digest.");
  }

  return Math.floor((Number.parseInt(sha256.slice(0, 8), 16) / 0x100000000) * 10000);
}

export function tierForSha256(sha256) {
  const bucket = tierBucketForSha256(sha256);
  return TIER_BUCKETS.find(tier => bucket < tier.upperBound)?.id ?? "legendary";
}

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export async function buildRewardCatalogs() {
  const entries = await readdir(REWARD_DIR, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map(entry => entry.name)
    .sort(compareNames);

  if (files.length === 0) throw new Error(`No PNG reward images found in ${REWARD_DIR}.`);

  const assets = {};
  for (const file of files) {
    const bytes = await readFile(resolve(REWARD_DIR, file));
    if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new Error(`${file} has a .png extension but is not a PNG image.`);
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    assets[file] = { sha256, tier: tierForSha256(sha256) };
  }

  return {
    manifest: {
      version: 2,
      tierAlgorithm: TIER_ALGORITHM,
      tierWeights: TIER_BUCKETS.map(({ id, label }, index) => ({
        id,
        label,
        basisPoints: TIER_BUCKETS[index].upperBound - (TIER_BUCKETS[index - 1]?.upperBound ?? 0)
      })),
      files,
      assets
    },
    widgetCatalog: { version: 1, files }
  };
}

function asJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeAtomically(path, contents) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export async function syncRewardCatalogs({ checkOnly = false } = {}) {
  const { manifest, widgetCatalog } = await buildRewardCatalogs();
  const outputs = [
    [PUBLIC_MANIFEST, asJson(manifest)],
    [WIDGET_CATALOG, asJson(widgetCatalog)]
  ];

  if (checkOnly) {
    const stale = [];
    for (const [path, expected] of outputs) {
      let current = "";
      try {
        current = await readFile(path, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (current !== expected) stale.push(path);
    }
    if (stale.length) throw new Error(`Reward catalogs are stale: ${stale.join(", ")}. Run this script to regenerate them.`);
    console.log(`Reward catalogs match all ${manifest.files.length} PNG assets.`);
    return;
  }

  for (const [path, contents] of outputs) await writeAtomically(path, contents);
  console.log(`Generated tiers for ${manifest.files.length} PNG assets.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== "--check") || args.filter(argument => argument === "--check").length > 1) {
    console.error("Usage: node generate-reward-catalog.mjs [--check]");
    process.exitCode = 2;
  } else {
    syncRewardCatalogs({ checkOnly: args.includes("--check") }).catch(error => {
      console.error(`[reward catalog] ${error.message || error}`);
      process.exitCode = 1;
    });
  }
}
