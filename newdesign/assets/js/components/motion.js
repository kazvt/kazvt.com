const defaultFps = 24;

export function getMotionFps(value = defaultFps) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return defaultFps;
  return Math.min(Math.max(number, 1), 60);
}

export function getMotionFrameMs(value = defaultFps) {
  return 1000 / getMotionFps(value);
}

export function getMotionFrameCount(durationMs, fps = defaultFps) {
  return Math.max(1, Math.round((Math.max(0, Number(durationMs) || 0) / 1000) * getMotionFps(fps)));
}
