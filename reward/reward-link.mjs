import { encryptReward } from "./reward-crypto.mjs";

export async function createRewardHref(username, assetId, origin) {
  const encrypted = await encryptReward({ version: 2, username, assetId });
  const destination = new URL("/reward/", origin);
  destination.searchParams.set("id", encrypted.id);
  destination.hash = `key=${encrypted.key}`;
  return destination.href;
}
