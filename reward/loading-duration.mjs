export const MIN_REWARD_LOADING_MS = 3000;

export function minimumLoadingDelay(startedAt, currentTime) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(currentTime)) {
    return MIN_REWARD_LOADING_MS;
  }

  const elapsed = Math.max(0, currentTime - startedAt);
  return Math.max(0, MIN_REWARD_LOADING_MS - elapsed);
}
