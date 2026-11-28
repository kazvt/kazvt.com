import { createQuiplashRound, createRedHandedRound, createShopRound, closeCardSubmissions, revealCardAnswers, revealAudienceResults, recordAudienceVote } from "./card-games.mjs?v=answer-edit-20261128-v1";

export function newCardShowRound(decks, mode, prompt = "") {
  if (mode === "quiplash") return createQuiplashRound(prompt ? [prompt] : decks.quiplash);
  if (mode === "red-handed") return createRedHandedRound(decks.evidence, prompt ? [prompt] : decks.suspects);
  if (mode === "shop") return createShopRound(decks.shop);
  return null;
}

// Call under the same Web Lock used by incoming WebRTC submissions.
export function applyCardShowAction(state, action, { mode, prompt, roundId, responseId } = {}) {
  const current = state.round;
  if (action === "start") {
    const round = newCardShowRound(state.decks, mode, prompt);
    if (!round) throw Error(mode === "red-handed" ? "Add evidence and a prompt." : mode === "shop" ? "Add shop cards." : "Add a prompt.");
    return { ...state, round, smeemo: null };
  }
  if (!current || !["quiplash", "red-handed"].includes(current.mode) || state.smeemo || (roundId && current.id !== roundId) || (mode && current.mode !== mode)) throw Error("No matching active card round.");
  const round = action === "close" ? closeCardSubmissions(current)
    : action === "reveal" ? revealCardAnswers(current)
    : action === "all" ? revealCardAnswers(current, true)
    : action === "results" ? revealAudienceResults(current)
    : action === "vote" ? recordAudienceVote(current, responseId) : current;
  if (round === current) throw Error(action === "close" ? "No answers to close, or submissions already closed." : action === "reveal" || action === "all" ? "No answers waiting to reveal." : "Action not available in this phase.");
  return { ...state, round };
}
