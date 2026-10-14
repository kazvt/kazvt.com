import { randomBytes } from "node:crypto";

const ASSET_ID_PATTERN = /^[a-f0-9]{64}$/i;
const LINK_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const FILENAME_PATTERN = /^[^/\\\u0000-\u001f\u007f]{1,255}\.png$/iu;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

export function normalizeUsername(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLowerCase() : "";
}

function cleanRequest(input) {
  const username = typeof input?.username === "string" ? input.username.normalize("NFKC").trim() : "";
  const assetId = typeof input?.assetId === "string" ? input.assetId.toLowerCase() : "";
  const eventId = typeof input?.eventId === "string" ? input.eventId.trim() : "";
  const platform = typeof input?.platform === "string" && input.platform.trim()
    ? input.platform.trim()
    : "stream-game";

  if (!username || username.length > 100 || CONTROL_CHARACTER_PATTERN.test(username)) {
    throw new Error("username must be 1-100 characters and contain no control characters.");
  }
  if (!ASSET_ID_PATTERN.test(assetId)) throw new Error("assetId must be a SHA-256 artwork ID.");
  if (!eventId || eventId.length > 128 || CONTROL_CHARACTER_PATTERN.test(eventId)) {
    throw new Error("eventId must be a stable 1-128 character ID without control characters.");
  }
  if (!platform || platform.length > 60 || CONTROL_CHARACTER_PATTERN.test(platform)) {
    throw new Error("platform must be 1-60 characters and contain no control characters.");
  }
  return { username, assetId, eventId, platform };
}

function findArtwork(manifest, assetId) {
  if (!manifest || manifest.version !== 4 || manifest.assetIdAlgorithm !== "sha256-png-bytes-v1" ||
      !Array.isArray(manifest.files) || !manifest.assets || !manifest.assetsById) {
    throw new Error("The published reward catalog is invalid.");
  }
  const indexed = manifest.assetsById[assetId];
  if (!indexed || typeof indexed.filename !== "string" || !FILENAME_PATTERN.test(indexed.filename) ||
      !manifest.files.includes(indexed.filename)) return null;
  const metadata = manifest.assets[indexed.filename];
  if (!metadata || metadata.assetId !== assetId || metadata.sha256 !== assetId ||
      !Number.isSafeInteger(metadata.width) || metadata.width < 1 ||
      !Number.isSafeInteger(metadata.height) || metadata.height < 1 ||
      typeof metadata.tier !== "string" || metadata.tier !== indexed.tier) return null;
  return { filename: indexed.filename };
}

function newLinkId() {
  return randomBytes(16).toString("base64url");
}

export function assignReward({ manifest, registry, input, issuedAt = new Date().toISOString(), makeLinkId = newLinkId }) {
  const request = cleanRequest(input);
  const artwork = findArtwork(manifest, request.assetId);
  if (!artwork) throw new Error("That artwork is not present in the published reward catalog.");
  if (!registry || registry.version !== 1 || !Array.isArray(registry.assignments)) {
    throw new Error("The reward assignment registry is invalid.");
  }
  if (!Number.isFinite(Date.parse(issuedAt))) throw new Error("issuedAt must be a valid timestamp.");

  const existingEvent = registry.assignments.find(record => record.eventId === request.eventId);
  if (existingEvent) {
    if (normalizeUsername(existingEvent.username) !== normalizeUsername(request.username) ||
        String(existingEvent.assetId ?? existingEvent.assetSha256).toLowerCase() !== request.assetId) {
      throw new Error("eventId is already assigned to a different winner or artwork.");
    }
    return { registry, assignment: existingEvent, replayed: true };
  }

  const existingArtwork = registry.assignments.find(record =>
    String(record.assetId ?? record.assetSha256).toLowerCase() === request.assetId);
  if (existingArtwork) throw new Error("That artwork has already been awarded.");

  const linkId = makeLinkId();
  if (!LINK_ID_PATTERN.test(linkId) || registry.assignments.some(record => record.linkId === linkId)) {
    throw new Error("Could not generate a unique reward link ID.");
  }

  const assignment = {
    assetId: request.assetId,
    assetSha256: request.assetId,
    filename: artwork.filename,
    username: request.username,
    issuedAt,
    platform: request.platform,
    linkId,
    eventId: request.eventId
  };
  return {
    registry: { version: 1, assignments: [...registry.assignments, assignment] },
    assignment,
    replayed: false
  };
}
