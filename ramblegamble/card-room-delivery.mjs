// A reliable data channel is not a durable application acknowledgement.
export const ACK_TIMEOUT_MS = 8000;
export const validRequestId = id => typeof id === 'string' && /^[a-z0-9-]{1,64}$/i.test(id);
export function matchesAck(pending, message) {
  return !!pending && message?.roundId === pending.roundId && validRequestId(pending.requestId) && message.requestId === pending.requestId;
}
export function pendingReceipt(pending, round) {
  if (!pending || !round || pending.roundId !== round.id) return null;
  if (round.mode === 'trivia') {
    try { const answer = JSON.parse(pending.answer); if (answer.id && round.attempts?.some(a => a.id === answer.id && a.guess === answer.guess)) return 'accepted'; } catch {}
  }
  if (round.submitted) return round.savedAnswer === undefined || round.savedAnswer === pending.answer ? 'accepted' : 'already-submitted';
  if (round.phase !== 'submissions') return 'closed';
  return null;
}
