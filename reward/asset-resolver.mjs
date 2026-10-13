const ASSET_ID_PATTERN = /^[a-f0-9]{64}$/;
const FILENAME_PATTERN = /^[^/\\\u0000-\u001f]+\.png$/i;

export function resolveAssetById(catalog, assetId) {
  if (typeof assetId !== "string" || !ASSET_ID_PATTERN.test(assetId)) return null;
  const normalizedId = assetId.toLowerCase();
  const indexed = catalog?.assetsById?.[normalizedId];
  if (!indexed || typeof indexed.filename !== "string" || !FILENAME_PATTERN.test(indexed.filename)) return null;
  const metadata = catalog.assets?.[indexed.filename];
  if (!metadata || metadata.assetId !== normalizedId || metadata.sha256 !== normalizedId ||
      metadata.width !== indexed.width || metadata.height !== indexed.height || metadata.tier !== indexed.tier) {
    return null;
  }
  return { filename: indexed.filename, metadata };
}

export function resolveRewardAsset(catalog, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (payload.version === 2) return resolveAssetById(catalog, payload.assetId);
  if (payload.version !== 1 || typeof payload.file !== "string" || payload.file.length > 255 ||
      !FILENAME_PATTERN.test(payload.file)) return null;

  const assetId = catalog?.filenameHistory?.[payload.file];
  return typeof assetId === "string" ? resolveAssetById(catalog, assetId) : null;
}
