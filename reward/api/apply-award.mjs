import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assignReward } from "./award-registry.mjs";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REWARD_DIRECTORY = resolve(REPOSITORY_ROOT, "zzz_assets/rewards");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJsonAtomically(path, value) {
  const temporaryPath = `${path}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export async function applyAwardFromEnvironment({ rewardDirectory = REWARD_DIRECTORY, env = process.env } = {}) {
  const input = {
    username: env.REWARD_USERNAME,
    assetId: env.REWARD_ASSET_ID,
    eventId: env.REWARD_EVENT_ID,
    platform: env.REWARD_PLATFORM || "stream-game"
  };
  const manifestPath = resolve(rewardDirectory, "manifest.json");
  const registryPath = resolve(rewardDirectory, "assignments.json");
  const [manifest, registry] = await Promise.all([readJson(manifestPath), readJson(registryPath)]);
  const result = assignReward({ manifest, registry, input });
  if (!result.replayed) await writeJsonAtomically(registryPath, result.registry);
  return { assignment: result.assignment, replayed: result.replayed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyAwardFromEnvironment().then(result => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}
