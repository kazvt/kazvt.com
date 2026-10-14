import { resolveAssetById } from "./asset-resolver.mjs";

const FILENAME_PATTERN = /^[^/\\\u0000-\u001f]+\.png$/i;
const ASSET_ID_PATTERN = /^[a-f0-9]{64}$/i;
const UUID4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPACT_REWARD_ID_PATTERN = /^[A-Za-z0-9_-]{16,22}$/;

export function normalizeAwardUsername(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLowerCase() : "";
}

export function isRewardLinkId(value) {
  return typeof value === "string" && (UUID4_PATTERN.test(value) || COMPACT_REWARD_ID_PATTERN.test(value));
}

export function normalizeRewardLinkId(value) {
  if (typeof value !== "string") return "";
  if (UUID4_PATTERN.test(value)) return value.toLowerCase();
  return COMPACT_REWARD_ID_PATTERN.test(value) ? value : "";
}

export function findAssignmentByLinkId(assignments, linkId) {
  if (!Array.isArray(assignments) || !isRewardLinkId(linkId)) return null;
  const normalizedId = normalizeRewardLinkId(linkId);
  return assignments.find(assignment => assignment.linkId === normalizedId) ?? null;
}

export function findAssignmentForLegacyPayload(assignments, username, assetId) {
  if (!Array.isArray(assignments) || typeof assetId !== "string" || !ASSET_ID_PATTERN.test(assetId)) return null;
  const normalizedUsername = normalizeAwardUsername(username);
  if (!normalizedUsername) return null;
  const normalizedAssetId = assetId.toLowerCase();
  return assignments.find(assignment => assignment.assetId === normalizedAssetId &&
    normalizeAwardUsername(assignment.username) === normalizedUsername) ?? null;
}

export function otherAwardsFor(assignments, username, currentAssetId) {
  if (!Array.isArray(assignments)) return [];
  const normalizedUsername = normalizeAwardUsername(username);
  const currentId = typeof currentAssetId === "string" ? currentAssetId.toLowerCase() : "";
  if (!normalizedUsername) return [];
  return assignments.filter(assignment => {
    const assetId = typeof assignment?.assetId === "string" ? assignment.assetId.toLowerCase() : "";
    return normalizeAwardUsername(assignment?.username) === normalizedUsername &&
      (!currentId || assetId !== currentId);
  });
}

export function buildTwoRowAwardPreview(assignments, columnCount) {
  const columns = Number.isFinite(columnCount) ? Math.max(1, Math.floor(columnCount)) : 1;
  const capacity = columns * 2;
  const hasOverflow = assignments.length > capacity;
  const visibleCount = hasOverflow ? capacity - 1 : capacity;
  const visible = assignments.slice(0, visibleCount);
  const overflowCount = assignments.length - visible.length;
  return {
    visible,
    overflowCount,
    overflowLabel: overflowCount ? `+${Math.min(99, overflowCount)}` : ""
  };
}

function tierForHash(sha256, catalog) {
  const bucket = Math.floor((Number.parseInt(sha256.slice(0, 8), 16) / 0x100000000) * 10000);
  let upperBound = 0;
  for (const tier of catalog.tierWeights) {
    upperBound += tier.basisPoints;
    if (bucket < upperBound) return tier;
  }
  return null;
}

export function validateAndSortAssignments(registry, catalog) {
  if (!registry || registry.version !== 1 || !Array.isArray(registry.assignments)) {
    throw new Error("The assignment registry is invalid.");
  }

  const seenAssets = new Set();
  const seenLinkIds = new Set();
  const assignments = registry.assignments.map((record, index) => {
    const recordedAssetId = record?.assetId ?? record?.assetSha256;
    const linkId = record?.linkId ?? "";
    if (!record || typeof record !== "object" || Array.isArray(record) ||
        typeof record.filename !== "string" || record.filename.length > 255 ||
        !FILENAME_PATTERN.test(record.filename) ||
        typeof record.username !== "string" || !record.username.trim() ||
        record.username.length > 100 || /[\u0000-\u001f]/.test(record.username) ||
        typeof recordedAssetId !== "string" || !ASSET_ID_PATTERN.test(recordedAssetId) ||
        (record.assetId != null && record.assetSha256 != null &&
          record.assetId.toLowerCase() !== record.assetSha256.toLowerCase()) ||
        (linkId !== "" && !isRewardLinkId(linkId)) ||
        typeof record.issuedAt !== "string" || record.issuedAt.length > 40 ||
        !Number.isFinite(Date.parse(record.issuedAt))) {
      throw new Error(`Assignment record ${index + 1} is invalid.`);
    }

    const assetId = recordedAssetId.toLowerCase();
    if (seenAssets.has(assetId)) throw new Error("The assignment registry repeats artwork.");
    seenAssets.add(assetId);
    const normalizedLinkId = normalizeRewardLinkId(linkId);
    if (normalizedLinkId && seenLinkIds.has(normalizedLinkId)) {
      throw new Error("The assignment registry repeats a reward link ID.");
    }
    if (normalizedLinkId) seenLinkIds.add(normalizedLinkId);

    const tier = tierForHash(assetId, catalog);
    const current = resolveAssetById(catalog, assetId);
    const artworkIsCurrent = Boolean(current && current.metadata.tier === tier?.id);
    return {
      filename: artworkIsCurrent ? current.filename : record.filename,
      username: record.username.trim(),
      assetId,
      linkId: normalizedLinkId,
      issuedAt: record.issuedAt,
      tierId: tier?.id ?? "",
      tierLabel: tier?.label ?? "Award",
      artworkIsCurrent
    };
  });

  assignments.sort((left, right) => Date.parse(right.issuedAt) - Date.parse(left.issuedAt) ||
    left.filename.localeCompare(right.filename));
  return assignments;
}
