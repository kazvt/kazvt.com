import { CARD_GAME_PLAYERS, submitRoundAnswer } from "./card-games.mjs?v=scene-table-20261126-v1";
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
  if (!isPlayer(player) || !round?.id || !["red-handed", "quiplash"].includes(round.mode)) return null;
  return { id: round.id, mode: round.mode, phase: round.phase, prompt: round.prompt,
    submitted: Boolean(round.submissions[player]),
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
  if (!round?.id || message.roundId !== round.id) return { round, status: "stale-round" };
  if (typeof message.answer !== "string" || !message.answer.trim() || message.answer.length > 800) return { round, status: "invalid-answer" };
  if (round.submissions[message.player]) return { round, status: round.submissions[message.player] === message.answer.trim() ? "accepted" : "already-submitted" };
  if (round.phase !== "submissions") return { round, status: "closed" };
  const next = submitRoundAnswer(round, message.player, message.answer);
  return { round: next, status: next === round ? "invalid-answer" : "accepted" };
}
