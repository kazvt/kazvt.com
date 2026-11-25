import test from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_ACTIVITY_FORMAT,
  CLIENT_SUBMISSION_FORMAT,
  buildClientActivity,
  createClientSubmission,
  validateClientActivity,
  validateClientSubmission,
} from "./trivia-client.mjs";

const activity = (mode = "categorize-images", extra = {}) => buildClientActivity({
  activityId: "activity-123",
  round: "14",
  difficulty: 1,
  mode,
  content: {
    question: "Sort these",
    categories: ["A", "B", "C"],
    items: [{ label: "one", image: "/one.png", asset: "" }, { label: "two", image: "", asset: "" }],
    ...extra,
  },
});

test("activity packets are versioned, portable, and omit unused empty editor slots", () => {
  const packet = buildClientActivity({
    activityId: "activity-123", round: "14", difficulty: 1, mode: "categorize-images",
    content: { question: "Sort", categories: ["A", "B", "C"], items: [{ label: "A", image: "a.png" }, { label: "", image: "" }] },
  });
  assert.equal(packet.format, CLIENT_ACTIVITY_FORMAT);
  assert.equal(packet.version, 1);
  assert.equal(packet.content.items.length, 1);
  assert.equal(validateClientActivity(packet, "categorize-images").ok, true);
});

test("activity packets require compatible route, media, and task setup", () => {
  const packet = activity();
  assert.equal(validateClientActivity(packet, "categorize-images").ok, true);
  assert.equal(validateClientActivity(packet, "compose-image").ok, false);
  assert.equal(validateClientActivity({ ...packet, format: "other" }).ok, false);
  assert.equal(validateClientActivity({ ...packet, content: { ...packet.content, categories: ["A"] } }).ok, false);
  assert.equal(validateClientActivity({ ...packet, content: { ...packet.content, promptImage: "javascript:alert(1)" } }).ok, false);
  const missingMedia = { ...packet, content: { ...packet.content, items: [{ label: "image", image: "", asset: "missing" }] } };
  assert.equal(validateClientActivity(missingMedia).ok, false);
  assert.throws(() => activity("draw-over-image"), /needs a prompt image/);
});

test("embedded image data survives the client packet without depending on browser storage", () => {
  const data = "data:image/png;base64,aGVsbG8=";
  const packet = buildClientActivity({
    activityId: "activity-image", round: "28", difficulty: 1, mode: "compose-image",
    content: { question: "Place it", promptAsset: "prompt", items: [{ label: "berry", asset: "berry" }] },
    format: { gridSize: 16 },
    media: { prompt: data, berry: data },
  });
  assert.equal(packet.media.prompt, data);
  assert.equal(validateClientActivity(packet, "compose-image").ok, true);
});

test("sort submissions require one valid group per item and preserve participant and task identity", () => {
  const packet = activity();
  const answer = createClientSubmission(packet, "faroe", { assignments: [0, 2] }, "2026-11-25T00:00:00.000Z");
  assert.equal(answer.format, CLIENT_SUBMISSION_FORMAT);
  assert.equal(validateClientSubmission(answer, { activityId: packet.activityId, mode: packet.mode, itemCount: 2 }).ok, true);
  assert.equal(validateClientSubmission({ ...answer, answer: { assignments: [0, null] } }).ok, false);
  assert.equal(validateClientSubmission({ ...answer, participant: "someone-else" }).ok, false);
  assert.equal(validateClientSubmission(answer, { activityId: "another-task" }).ok, false);
});

test("placement and drawing submissions validate bounded normalized coordinates", () => {
  const place = activity("compose-image", { promptImage: "/picture.png" });
  const placements = createClientSubmission(place, "kaz", { placements: [{ itemIndex: 1, x: 50, y: 25 }] });
  assert.equal(validateClientSubmission(placements, { itemCount: 2 }).ok, true);
  assert.equal(validateClientSubmission({ ...placements, answer: { placements: [{ itemIndex: 9, x: 50, y: 25 }] } }).ok, false);

  const draw = activity("draw-over-image", { promptImage: "/picture.png" });
  const drawing = createClientSubmission(draw, "erin", { strokes: [[{ x: 10, y: 20 }, { x: 1000, y: 900 }]] });
  assert.equal(validateClientSubmission(drawing, { itemCount: 2 }).ok, true);
  assert.equal(validateClientSubmission({ ...drawing, answer: { strokes: [[{ x: -1, y: 20 }]] } }).ok, false);
});
