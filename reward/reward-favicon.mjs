const ASSET_ID_PATTERN = /^[a-f0-9]{64}$/i;
const FILENAME_PATTERN = /^[^/\\\u0000-\u001f]+\.(?:png|gif)$/i;

export function rewardFaviconForAsset(filename, assetId, origin) {
  if (typeof filename !== "string" || filename.length > 255 || !FILENAME_PATTERN.test(filename) ||
      typeof assetId !== "string" || !ASSET_ID_PATTERN.test(assetId)) {
    return null;
  }

  const faviconUrl = new URL(`/zzz_assets/rewards/${encodeURIComponent(filename)}`, origin);
  faviconUrl.searchParams.set("v", assetId.toLowerCase());
  return {
    href: `${faviconUrl.pathname}${faviconUrl.search}`,
    type: filename.toLowerCase().endsWith(".gif") ? "image/gif" : "image/png",
  };
}
