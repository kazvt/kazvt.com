export const CLIENT_ACTIVITY_FORMAT = "kazvt.rg.client-activity";
export const CLIENT_SUBMISSION_FORMAT = "kazvt.rg.client-submission";
export const CLIENT_PACKET_VERSION = 1;
export const CLIENT_ACTIVITY_ROUTES = Object.freeze({
  "categorize-images": "sort3",
  "compose-image": "place",
  "draw-over-image": "draw",
});
export const CLIENT_PARTICIPANTS = Object.freeze(["faroe", "erin", "kaz"]);
export const CLIENT_PACKET_MAX_BYTES = 50 * 1024 * 1024;
export const CLIENT_IMAGE_MAX_DATA_URL_CHARS = 21 * 1024 * 1024;

const allowedModes = new Set(Object.keys(CLIENT_ACTIVITY_ROUTES));
const imageDataUrl = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/\s]+=*$/i;

function cleanString(value, maxLength = 5000) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function isSafeImageReference(value) {
  if (typeof value !== "string" || !value || value.length > CLIENT_IMAGE_MAX_DATA_URL_CHARS) return false;
  if (imageDataUrl.test(value)) return true;
  if (/^https:\/\//i.test(value)) return true;
  if (/^http:\/\//i.test(value)) return true;
  return /^(?:\/(?!\/)|\.\.?\/)[^\\]*$/.test(value);
}

function checkMedia(media, errors) {
  if (!media || typeof media !== "object" || Array.isArray(media)) {
    errors.push("The task image data is missing or invalid.");
    return;
  }
  for (const [id, data] of Object.entries(media)) {
    if (!id || id.length > 200 || typeof data !== "string" || !imageDataUrl.test(data) || data.length > CLIENT_IMAGE_MAX_DATA_URL_CHARS) {
      errors.push("An embedded image is invalid or exceeds the 15 MB image limit.");
      return;
    }
  }
}

export function buildClientActivity({ activityId, round, difficulty, mode, content, format = {}, media = {}, createdAt = new Date().toISOString() }) {
  const items = (Array.isArray(content?.items) ? content.items : []).filter((item) =>
    item && typeof item === "object" && [item.label, item.image, item.asset].some((value) => String(value || "").trim()));
  const packet = {
    format: CLIENT_ACTIVITY_FORMAT,
    version: CLIENT_PACKET_VERSION,
    activityId: cleanString(activityId, 120),
    createdAt: cleanString(createdAt, 80),
    round: cleanString(String(round ?? ""), 4),
    difficulty: Math.max(1, Math.min(5, Math.trunc(Number(difficulty) || 1))),
    mode,
    content: {
      question: cleanString(content?.question),
      subtitle: cleanString(content?.subtitle, 2000),
      promptImage: cleanString(content?.promptImage, CLIENT_IMAGE_MAX_DATA_URL_CHARS),
      promptAsset: cleanString(content?.promptAsset, 200),
      backgroundImage: cleanString(content?.backgroundImage, CLIENT_IMAGE_MAX_DATA_URL_CHARS),
      categories: (Array.isArray(content?.categories) ? content.categories : []).slice(0, 3).map((name) => cleanString(String(name ?? ""), 300)),
      items: items.slice(0, 24).map((item) => ({
        label: cleanString(String(item.label || ""), 500),
        image: cleanString(String(item.image || ""), CLIENT_IMAGE_MAX_DATA_URL_CHARS),
        asset: cleanString(String(item.asset || ""), 200),
      })),
      imageAspect: cleanString(String(format.imageAspect || "auto"), 40),
      gridSize: Math.max(0, Math.min(128, Math.trunc(Number(format.gridSize) || 0))),
      pieceSize: 32,
    },
    media: media && typeof media === "object" && !Array.isArray(media) ? { ...media } : {},
  };
  const result = validateClientActivity(packet);
  if (!result.ok) throw new Error(result.errors.join(" "));
  return packet;
}

export function validateClientActivity(packet, expectedMode = "") {
  const errors = [];
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) return { ok: false, errors: ["This is not a Ramble Gamble task file."] };
  if (packet.format !== CLIENT_ACTIVITY_FORMAT || packet.version !== CLIENT_PACKET_VERSION) errors.push("This task file format or version is not supported.");
  if (typeof packet.activityId !== "string" || !packet.activityId.trim() || packet.activityId.length > 120) errors.push("The task file has no valid activity ID.");
  if (!allowedModes.has(packet.mode)) errors.push("This task type is not supported by the player pages.");
  if (expectedMode && packet.mode !== expectedMode) errors.push("This task belongs on /rg/" + (CLIENT_ACTIVITY_ROUTES[packet.mode] || "") + ", not this page.");
  if (typeof packet.round !== "string" || !/^\d{1,2}$/.test(packet.round)) errors.push("The task file has an invalid round number.");
  if (!Number.isInteger(packet.difficulty) || packet.difficulty < 1 || packet.difficulty > 5) errors.push("The task file has an invalid difficulty.");
  if (!packet.content || typeof packet.content !== "object" || Array.isArray(packet.content)) {
    errors.push("The task content is missing.");
    return { ok: false, errors };
  }
  const content = packet.content;
  if (typeof content.question !== "string" || content.question.length > 5000) errors.push("The question text is invalid.");
  if (!Array.isArray(content.items) || content.items.length < 1 || content.items.length > 24) errors.push("The task must include between 1 and 24 items.");
  else content.items.forEach((item, index) => {
    if (!item || typeof item !== "object" || typeof item.label !== "string" || item.label.length > 500 || typeof item.image !== "string" || typeof item.asset !== "string") {
      errors.push("Task item " + (index + 1) + " is invalid.");
      return;
    }
    if (item.image && !isSafeImageReference(item.image)) errors.push("Task item " + (index + 1) + " has an unsupported image reference.");
  });
  checkMedia(packet.media, errors);
  for (const item of content.items || []) {
    if (item?.asset && !Object.hasOwn(packet.media || {}, item.asset)) errors.push("An item refers to missing embedded image data.");
  }
  if (content.promptAsset && !Object.hasOwn(packet.media || {}, content.promptAsset)) errors.push("The prompt refers to missing embedded image data.");
  const hasPrompt = Boolean(content.promptImage || content.promptAsset || content.backgroundImage);
  if ((packet.mode === "draw-over-image" || packet.mode === "compose-image") && !hasPrompt) errors.push("This activity needs a prompt image before it can be shared.");
  if (packet.mode === "categorize-images" && (!Array.isArray(content.categories) || content.categories.length !== 3)) errors.push("Sort tasks need exactly three groups.");
  if (content.promptImage && !isSafeImageReference(content.promptImage)) errors.push("The prompt image reference is invalid.");
  if (content.backgroundImage && !isSafeImageReference(content.backgroundImage)) errors.push("The picture image reference is invalid.");
  const encodedLength = (() => {
    try { return new TextEncoder().encode(JSON.stringify(packet)).byteLength; } catch { return CLIENT_PACKET_MAX_BYTES + 1; }
  })();
  if (encodedLength > CLIENT_PACKET_MAX_BYTES) errors.push("This task file is larger than 50 MB. Reduce the image sizes before exporting it.");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function createClientSubmission(activity, participant, answer, submittedAt = new Date().toISOString()) {
  const snapshot = activity.content;
  return {
    format: CLIENT_SUBMISSION_FORMAT,
    version: CLIENT_PACKET_VERSION,
    submissionId: globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + "-" + Math.random().toString(36).slice(2)),
    activityId: activity.activityId,
    round: activity.round,
    difficulty: activity.difficulty,
    mode: activity.mode,
    participant,
    submittedAt,
    snapshot: {
      question: cleanString(snapshot.question),
      subtitle: cleanString(snapshot.subtitle, 2000),
      categories: (snapshot.categories || []).slice(0, 3).map((name) => cleanString(name, 300)),
      items: (snapshot.items || []).map((item) => ({ label: cleanString(item.label, 500), image: item.image, asset: item.asset })),
      promptImage: snapshot.promptImage,
      promptAsset: snapshot.promptAsset,
      backgroundImage: snapshot.backgroundImage,
      imageAspect: snapshot.imageAspect,
      gridSize: snapshot.gridSize,
      pieceSize: snapshot.pieceSize,
    },
    answer,
  };
}

export function validateClientSubmission(submission, expected = {}) {
  const errors = [];
  if (!submission || typeof submission !== "object" || Array.isArray(submission)) return { ok: false, errors: ["This is not a Ramble Gamble answer file."] };
  if (submission.format !== CLIENT_SUBMISSION_FORMAT || submission.version !== CLIENT_PACKET_VERSION) errors.push("This answer file format or version is not supported.");
  if (typeof submission.submissionId !== "string" || !submission.submissionId || submission.submissionId.length > 160) errors.push("The answer file has no valid submission ID.");
  if (typeof submission.activityId !== "string" || !submission.activityId || submission.activityId.length > 120) errors.push("The answer file has no valid activity ID.");
  if (expected.activityId && submission.activityId !== expected.activityId) errors.push("This answer belongs to a different exported task.");
  if (!allowedModes.has(submission.mode) || (expected.mode && submission.mode !== expected.mode)) errors.push("The answer file has an unexpected task type.");
  if (!CLIENT_PARTICIPANTS.includes(submission.participant)) errors.push("Choose one of the three registered players in the player page.");
  if (typeof submission.round !== "string" || !/^\d{1,2}$/.test(submission.round) || !Number.isInteger(submission.difficulty) || submission.difficulty < 1 || submission.difficulty > 5) errors.push("The answer file has invalid round details.");
  const snapshot = submission.snapshot;
  const answer = submission.answer;
  if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.items) || snapshot.items.length < 1 || snapshot.items.length > 24) errors.push("The answer is missing its task summary.");
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) errors.push("The answer data is missing.");
  if (errors.length) return { ok: false, errors };

  if (typeof snapshot.question !== "string" || snapshot.question.length > 5000 ||
      !Array.isArray(snapshot.categories) || snapshot.categories.length > 3 ||
      snapshot.items.some((item) => !item || typeof item !== "object" || typeof item.label !== "string" || item.label.length > 500 ||
        typeof item.image !== "string" || (item.image && !isSafeImageReference(item.image)) || typeof item.asset !== "string" || item.asset.length > 200)) {
    errors.push("The answer task summary contains invalid text or images.");
  }
  if (snapshot.promptImage && !isSafeImageReference(snapshot.promptImage)) errors.push("The answer summary has an invalid prompt image.");
  if (snapshot.backgroundImage && !isSafeImageReference(snapshot.backgroundImage)) errors.push("The answer summary has an invalid picture image.");
  if (typeof snapshot.promptAsset !== "string" || snapshot.promptAsset.length > 200) errors.push("The answer summary has an invalid prompt asset reference.");

  const itemCount = expected.itemCount ?? snapshot.items.length;
  if (itemCount !== snapshot.items.length) errors.push("The task item count does not match this exported task.");
  if (submission.mode === "categorize-images") {
    const assignments = answer.assignments;
    if (!Array.isArray(snapshot.categories) || snapshot.categories.length !== 3 || !Array.isArray(assignments) || assignments.length !== itemCount || assignments.some((group) => !Number.isInteger(group) || group < 0 || group > 2)) errors.push("The sort answer must place every item into one of the three groups.");
  } else if (submission.mode === "compose-image") {
    const placements = answer.placements;
    if (!Array.isArray(placements) || placements.length > 500 || placements.some((placement) =>
      !placement || !Number.isInteger(placement.itemIndex) || placement.itemIndex < 0 || placement.itemIndex >= itemCount ||
      !Number.isFinite(placement.x) || placement.x < 0 || placement.x > 100 || !Number.isFinite(placement.y) || placement.y < 0 || placement.y > 100)) errors.push("The picture-placement answer contains invalid positions.");
  } else if (submission.mode === "draw-over-image") {
    const strokes = answer.strokes;
    const pointCount = Array.isArray(strokes) ? strokes.reduce((count, stroke) => count + (Array.isArray(stroke) ? stroke.length : 0), 0) : 0;
    if (!Array.isArray(strokes) || strokes.length > 500 || pointCount > 40000 || strokes.some((stroke) =>
      !Array.isArray(stroke) || stroke.length < 1 || stroke.some((point) =>
        !point || !Number.isFinite(point.x) || point.x < 0 || point.x > 1000 || !Number.isFinite(point.y) || point.y < 0 || point.y > 1000))) errors.push("The drawing answer contains invalid strokes.");
  }
  if (JSON.stringify(submission).length > CLIENT_PACKET_MAX_BYTES) errors.push("This answer file is larger than 50 MB.");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
