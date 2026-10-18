import { createHash } from "node:crypto";
import { readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRewardReservations } from "../../reward/reward-reservations.mjs";

const WIDGET_ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(WIDGET_ROOT, "../..");
const REWARD_DIR = resolve(REPO_ROOT, "zzz_assets", "rewards");
const PUBLIC_MANIFEST = resolve(REWARD_DIR, "manifest.json");
const PUBLIC_ASSIGNMENTS = resolve(REWARD_DIR, "assignments.json");
const PUBLIC_POOL = resolve(REWARD_DIR, "pool.json");
const WIDGET_CATALOG = resolve(WIDGET_ROOT, "rewards.json");
const PRIVATE_RESERVATIONS = resolve(REPO_ROOT, "reward", "api", "reservations.local.txt");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const TIER_BUCKETS = [
  { id: "common", label: "Frequent", upperBound: 3000 },
  { id: "uncommon", label: "Uncommon", upperBound: 5000 },
  { id: "rare", label: "Rare", upperBound: 6500 },
  { id: "epic", label: "Epic", upperBound: 7700 },
  { id: "legendary", label: "Legendary", upperBound: 8600 },
  { id: "mythic", label: "Mythic", upperBound: 9250 },
  { id: "divine", label: "Divine", upperBound: 9700 },
  { id: "splus", label: "Good Shit", upperBound: 10000 }
];

export const TIER_ALGORITHM = "sha256-leading-32-bit-weighted-v2";

export function tierBucketForSha256(sha256) {
  if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(sha256)) {
    throw new TypeError("Expected a 64-character SHA-256 hex digest.");
  }

  return Math.floor((Number.parseInt(sha256.slice(0, 8), 16) / 0x100000000) * 10000);
}

export function tierForSha256(sha256) {
  const bucket = tierBucketForSha256(sha256);
  return TIER_BUCKETS.find(tier => bucket < tier.upperBound)?.id ?? "splus";
}

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

const ASSET_ID_ALGORITHM = "sha256-image-bytes-v1";
const IMAGE_FILENAME = /^[^/\\\u0000-\u001f]+\.(?:png|gif)$/i;

function validAssetId(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function addFilenameHistory(history, filename, assetId) {
  if (typeof filename !== "string" || filename.length > 255 ||
      !IMAGE_FILENAME.test(filename)) return;
  const normalizedId = validAssetId(assetId) ? assetId.toLowerCase() : null;
  if (!Object.prototype.hasOwnProperty.call(history, filename)) {
    history[filename] = normalizedId;
  } else if (history[filename] !== normalizedId) {
    history[filename] = null;
  }
}

function assetIdForPreviousName(manifest, filename) {
  const historical = manifest?.filenameHistory?.[filename];
  if (historical === null) return null;
  if (validAssetId(historical)) return historical.toLowerCase();
  const metadata = manifest?.assets?.[filename];
  const id = metadata?.assetId ?? metadata?.sha256;
  return validAssetId(id) ? id.toLowerCase() : null;
}

function readImageDimensions(bytes, file) {
  let width;
  let height;
  if (bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    if (bytes.length < 33 || bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR") {
      throw new Error(`${file} is not a PNG with a valid IHDR header.`);
    }
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
  } else if (bytes.length >= 13 && /^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6))) {
    width = bytes.readUInt16LE(6);
    height = bytes.readUInt16LE(8);
  } else {
    throw new Error(`${file} is not a supported PNG or GIF image.`);
  }
  if (!width || !height || width > 0x7fffffff || height > 0x7fffffff) {
    throw new Error(`${file} has invalid image dimensions.`);
  }
  return { width, height };
}

async function readPreviousManifest(rewardDir) {
  try {
    return JSON.parse(await readFile(resolve(rewardDir, "manifest.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`Could not read the previous reward manifest: ${error.message || error}`);
  }
}

async function readMsiSourceManifest(sourceManifest) {
  if (!sourceManifest) return null;
  let parsed = sourceManifest;
  if (typeof sourceManifest === "string") {
    try {
      parsed = JSON.parse(await readFile(sourceManifest, "utf8"));
    } catch (error) {
      throw new Error(`Could not read the MSI source manifest: ${error.message || error}`);
    }
  }
  if (!parsed || parsed.schema_version !== 3 ||
      !Array.isArray(parsed.files) || !parsed.file_info || typeof parsed.file_info !== "object" ||
      parsed.metadata_options?.hash_algorithms?.includes("sha256") !== true ||
      parsed.metadata_options?.image_dimensions !== true ||
      parsed.metadata_options?.filename_history !== true ||
      !parsed.filename_history || typeof parsed.filename_history !== "object" || Array.isArray(parsed.filename_history)) {
    throw new Error("The MSI source manifest is missing required SHA-256, image-dimension, or filename-history metadata.");
  }
  return parsed;
}

function validateMsiImageRecord(sourceManifest, filename) {
  const record = sourceManifest?.file_info?.[filename];
  const sha256 = record?.hashes?.sha256;
  const width = record?.image?.width;
  const height = record?.image?.height;
  if (!record || record.type !== "image" || record.hash_errors?.sha256 || record.image?.metadata_error ||
      !validAssetId(sha256) || !Number.isSafeInteger(width) || width < 1 ||
      !Number.isSafeInteger(height) || height < 1 || !Number.isSafeInteger(record.size_bytes) || record.size_bytes < 1) {
    throw new Error(`${filename} is missing valid image metadata in the MSI source manifest.`);
  }
  return { sha256: sha256.toLowerCase(), width, height, sizeBytes: record.size_bytes, record };
}

export async function buildRewardCatalogs({ rewardDir = REWARD_DIR, previousManifest, sourceManifest } = {}) {
  const previous = previousManifest === undefined
    ? await readPreviousManifest(rewardDir)
    : previousManifest;
  const msiManifest = await readMsiSourceManifest(sourceManifest);
  const entries = await readdir(rewardDir, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && IMAGE_FILENAME.test(entry.name))
    .map(entry => entry.name)
    .sort(compareNames);

  if (files.length === 0) throw new Error(`No PNG or GIF reward images found in ${rewardDir}.`);
  if (files.some(file => file.length > 255)) {
    throw new Error("Reward filenames must fit within the 255-character filesystem component limit.");
  }
  if (msiManifest && JSON.stringify(msiManifest.files) !== JSON.stringify(files)) {
    throw new Error("The MSI source manifest file list is stale; wait for the manifest watcher and try again.");
  }

  const assets = {};
  const assetsById = {};
  for (const file of files) {
    let width;
    let height;
    let sha256;
    if (msiManifest) {
      const metadata = validateMsiImageRecord(msiManifest, file);
      const currentStat = await stat(resolve(rewardDir, file), { bigint: true });
      if (currentStat.size !== BigInt(metadata.sizeBytes) ||
          (metadata.record.modified_ns_exact && currentStat.mtimeNs.toString() !== metadata.record.modified_ns_exact)) {
        throw new Error(`${file} changed since MSI last indexed it; wait for the manifest watcher and try again.`);
      }
      ({ width, height, sha256 } = metadata);
    } else {
      const bytes = await readFile(resolve(rewardDir, file));
      ({ width, height } = readImageDimensions(bytes, file));
      sha256 = createHash("sha256").update(bytes).digest("hex");
    }
    if (Object.prototype.hasOwnProperty.call(assetsById, sha256)) {
      throw new Error(`${file} has identical artwork bytes to ${assetsById[sha256].filename}; keep one file per award.`);
    }
    const tier = tierForSha256(sha256);
    const metadata = { assetId: sha256, sha256, width, height, tier };
    assets[file] = metadata;
    assetsById[sha256] = { filename: file, width, height, tier };
  }

  const filenameHistory = {};
  if (previous && typeof previous === "object") {
    if (previous.filenameHistory && typeof previous.filenameHistory === "object" &&
        !Array.isArray(previous.filenameHistory)) {
      for (const [filename, assetId] of Object.entries(previous.filenameHistory)) {
        addFilenameHistory(filenameHistory, filename, assetId);
      }
    }
    if (Array.isArray(previous.files) && previous.assets && typeof previous.assets === "object") {
      for (const filename of previous.files) {
        addFilenameHistory(filenameHistory, filename, assetIdForPreviousName(previous, filename));
      }
    }
  }
  if (msiManifest) {
    for (const [filename, assetId] of Object.entries(msiManifest.filename_history)) {
      addFilenameHistory(filenameHistory, filename, assetId);
    }
  }
  for (const [filename, metadata] of Object.entries(assets)) {
    addFilenameHistory(filenameHistory, filename, metadata.assetId);
  }

  return {
    manifest: {
      version: 4,
      assetIdAlgorithm: ASSET_ID_ALGORITHM,
      tierAlgorithm: TIER_ALGORITHM,
      tierWeights: TIER_BUCKETS.map(({ id, label }, index) => ({
        id,
        label,
        basisPoints: TIER_BUCKETS[index].upperBound - (TIER_BUCKETS[index - 1]?.upperBound ?? 0)
      })),
      files,
      assets,
      assetsById,
      filenameHistory
    },
    widgetCatalog: {
      version: 3,
      assetIdAlgorithm: ASSET_ID_ALGORITHM,
      files,
      assets: Object.fromEntries(files.map(file => [file, {
        assetId: assets[file].assetId,
        sha256: assets[file].sha256,
        width: assets[file].width,
        height: assets[file].height
      }])),
      filenameHistory
    }
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

async function readOptionalText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function buildAnonymousPool(manifest, reservationText) {
  const registryText = await readOptionalText(PUBLIC_ASSIGNMENTS);
  const reservations = parseRewardReservations(reservationText, manifest);
  let registry = { assignments: [] };
  if (registryText) {
    try {
      registry = JSON.parse(registryText);
    } catch (error) {
      throw new Error(`Could not read the public reward assignment registry: ${error.message || error}`);
    }
  }
  if (!registry || !Array.isArray(registry.assignments)) {
    throw new Error("The public reward assignment registry is invalid.");
  }

  const artworkIds = new Set(manifest.files
    .map(filename => manifest.assets[filename]?.assetId?.toLowerCase())
    .filter(assetId => validAssetId(assetId)));
  const reservedIds = new Set([...reservations.assetIds].filter(assetId => artworkIds.has(assetId)));
  const eligibleIds = new Set([...artworkIds].filter(assetId => !reservedIds.has(assetId)));
  for (const assignment of registry.assignments) {
    const assetId = assignment?.assetId ?? assignment?.assetSha256;
    if (typeof assetId === "string") eligibleIds.delete(assetId.toLowerCase());
  }
  return {
    version: 1,
    remaining: eligibleIds.size,
    total: artworkIds.size - reservedIds.size
  };
}

export async function syncRewardCatalogs({ checkOnly = false } = {}) {
  const { manifest, widgetCatalog } = await buildRewardCatalogs();
  const outputs = [
    [PUBLIC_MANIFEST, asJson(manifest)],
    [WIDGET_CATALOG, asJson(widgetCatalog)]
  ];
  let privateReservationsAvailable = true;
  try {
    const reservationText = await readFile(PRIVATE_RESERVATIONS, "utf8");
    const pool = await buildAnonymousPool(manifest, reservationText);
    outputs.push([PUBLIC_POOL, asJson(pool)]);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    privateReservationsAvailable = false;
  }

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
    console.log(`Reward catalogs match all ${manifest.files.length} PNG/GIF assets.`);
    if (!privateReservationsAvailable) {
      console.log("Private reservation config is absent; the anonymous pool count was left unchanged.");
    }
    return;
  }

  for (const [path, contents] of outputs) await writeAtomically(path, contents);
  console.log(`Generated tiers for ${manifest.files.length} PNG/GIF assets.`);
  if (!privateReservationsAvailable) {
    console.log("Private reservation config is absent; the anonymous pool count was left unchanged.");
  }
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
