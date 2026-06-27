const defaultFps = 24;
let activeFps = defaultFps;

function normalizeFps(value = activeFps) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return defaultFps;
  return Math.min(Math.max(number, 1), 60);
}

function applyMotionVariables() {
  const root = document.documentElement;
  root.style.setProperty("--site-motion-fps", String(activeFps));
  root.style.setProperty("--site-motion-frame-ms", activeFps >= 60 ? "0ms" : `${(1000 / activeFps).toFixed(4)}ms`);
}

export function setMotionFps(value) {
  activeFps = normalizeFps(value);
  applyMotionVariables();
  return activeFps;
}

export function getMotionFps(value = activeFps) {
  return normalizeFps(value);
}

export function isMotionStepped(value = activeFps) {
  return getMotionFps(value) < 60;
}

export function getMotionFrameMs(value = activeFps) {
  return isMotionStepped(value) ? 1000 / getMotionFps(value) : 0;
}

export function getMotionFrameCount(durationMs, fps = activeFps) {
  return Math.max(1, Math.round((Math.max(0, Number(durationMs) || 0) / 1000) * getMotionFps(fps)));
}

applyMotionVariables();
