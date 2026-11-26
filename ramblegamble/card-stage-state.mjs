// Game data persists; the decision to show it is local to this page load.
export function activeCardStage(state) {
  const game = state?.smeemo;
  if (game && ["playing", "complete"].includes(game.status)) return { mode: "smeemo", key: `smeemo:${game.id}` };
  const round = state?.round;
  if (!round) return null;
  // Legacy shop rounds have no ID. Purchases must not change their identity.
  return { mode: round.mode, key: `${round.mode}:${round.id || "legacy"}` };
}

export function cardStageChange(previous, state) {
  const active = activeCardStage(state);
  return { active, opened: Boolean(active && active.key !== previous?.key), ended: Boolean(previous && !active) };
}
