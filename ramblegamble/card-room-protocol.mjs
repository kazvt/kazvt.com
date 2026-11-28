import { validRequestId } from "./card-room-delivery.mjs?v=answer-edit-20261128-v1";
import { publicTriviaRound, acceptTriviaAnswer } from "./live-trivia.mjs?v=cast-editor-20261128-v1";
import { CARD_GAME_PLAYERS, submitRoundAnswer, answerRevision } from "./card-games.mjs?v=cast-editor-20261128-v1";
import { validPublicKey } from "./card-room-auth.mjs?v=host-security-20261126-v1";
export const ROOM_VERSION = 2;
export const isPlayer = p => CARD_GAME_PLAYERS.includes(p);
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
export function createRoom(hostKey) {
  return { hostKey, id: `rg-${randomToken()}`, tokens: Object.fromEntries(CARD_GAME_PLAYERS.map(p => [p, randomToken()])) };
}
export function validRoom(room) {
  return validPublicKey(room?.hostKey) && /^rg-[a-f0-9]{32}$/.test(room?.id || "") && CARD_GAME_PLAYERS.every(p => /^[a-f0-9]{32}$/.test(room?.tokens?.[p] || ""));
}
export function playerRound(round, player) {
  if (!isPlayer(player) || !round?.id) return null;
  if (round.mode === "trivia") return publicTriviaRound(round, player);
  if (!["red-handed", "quiplash"].includes(round.mode)) return null;
  return { id: round.id, mode: round.mode, phase: round.phase, prompt: round.prompt,
    submitted: Boolean(round.submissions[player]),
    savedAnswer: round.submissions[player] || null,
    answerRevision: answerRevision(round, player),
    ...(round.phase === "submissions" && round.mode === "red-handed" ? { hand: [...round.hands[player]] } : {}) };
}
export function encodePacket(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join("")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
export function decodePacket(value) {
  if (typeof value !== "string" || value.length > 60000 || !/^[\w-]+$/.test(value)) return null;
  try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0)))); }
  catch { return null; }
}
export function authorized(room, message) {
  return validRoom(room) && message?.v === ROOM_VERSION && message.room === room.id && isPlayer(message.player) && message.token === room.tokens[message.player];
}
export function acceptSubmission(room, round, message) {
  if (!authorized(room, message) || message.type !== "submit") return { round, status: "unauthorized" };
  if (message.requestId !== undefined && !validRequestId(message.requestId)) return { round, status: "invalid-answer" };
  if (!round?.id || message.roundId !== round.id) return { round, status: "stale-round" };
  if (round.mode === "trivia") return acceptTriviaAnswer(round, message.player, message.answer);
  if (!["red-handed", "quiplash"].includes(round.mode)) return { round, status: "closed" };
  if (typeof message.answer !== "string" || !message.answer.trim() || message.answer.length > 800) return { round, status: "invalid-answer" };
  if (message.baseRevision !== undefined && (!Number.isSafeInteger(message.baseRevision) || message.baseRevision < 0)) return { round, status: "invalid-answer" };
  if (round.submissions[message.player] === message.answer.trim()) return { round, status: "accepted" };
  if (round.phase !== "submissions") return { round, status: "closed" };
  if (message.baseRevision === undefined && round.submissions[message.player]) return { round, status: "already-submitted" };
  if (message.baseRevision !== undefined && message.baseRevision !== answerRevision(round, message.player)) return { round, status: "answer-changed" };
  const next = submitRoundAnswer(round, message.player, message.answer, undefined, message.baseRevision);
  return { round: next, status: next === round ? "invalid-answer" : "accepted" };
}
