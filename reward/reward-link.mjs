import { isRewardLinkId } from "./assignment-registry.mjs?v=uuid-link-1";

export function createRewardHref(linkId, origin) {
  if (!isRewardLinkId(linkId)) throw new TypeError("A valid reward link ID is required.");
  const destination = new URL("/reward/", origin);
  destination.searchParams.set("id", linkId.toLowerCase());
  return destination.href;
}
