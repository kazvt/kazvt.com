import { isRewardLinkId, normalizeRewardLinkId } from "./assignment-registry.mjs?v=github-static-2";

export function createRewardHref(linkId, origin) {
  if (!isRewardLinkId(linkId)) throw new TypeError("A valid reward link ID is required.");
  const destination = new URL("/reward/", origin);
  destination.searchParams.set("id", normalizeRewardLinkId(linkId));
  return destination.href;
}
