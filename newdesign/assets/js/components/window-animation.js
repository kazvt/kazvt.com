import { getMotionFrameMs } from "./motion.js";

const duration = 1000;
const activeAnimations = new WeakMap();

function identity() {
  return { tx: 0, ty: 0, sx: 1, sy: 1 };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function applyTransform(element, state) {
  const tx = Math.round(finiteNumber(state.tx, 0));
  const ty = Math.round(finiteNumber(state.ty, 0));
  const sx = finiteNumber(state.sx, 1).toFixed(4);
  const sy = finiteNumber(state.sy, 1).toFixed(4);
  element.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
}

function clearAnimation(element) {
  const existing = activeAnimations.get(element);
  if (existing) {
    if (existing.animation && existing.animation.pause) existing.animation.pause();
    if (window.anime && existing.state) window.anime.remove(existing.state);
    activeAnimations.delete(element);
  }
}

function finishAnimation(element, done) {
  element.classList.remove("is-window-animating");
  element.style.transform = "";
  element.style.transformOrigin = "";
  activeAnimations.delete(element);
  if (done) done();
}

function animateState(element, from, to, origin, easing, done) {
  clearAnimation(element);
  const anime = window.anime;
  if (!anime) {
    finishAnimation(element, done);
    return null;
  }
  const state = { ...from };
  const frameMs = getMotionFrameMs();
  let lastFrame = 0;
  element.classList.add("is-window-animating");
  element.style.transformOrigin = origin;
  applyTransform(element, state);
  const animation = anime({
    targets: state,
    tx: to.tx,
    ty: to.ty,
    sx: to.sx,
    sy: to.sy,
    duration,
    easing,
    update() {
      const now = performance.now();
      if (now - lastFrame < frameMs) return;
      lastFrame = now;
      applyTransform(element, state);
    },
    complete() {
      applyTransform(element, to);
      finishAnimation(element, done);
    }
  });
  activeAnimations.set(element, { animation, state });
  return animation;
}

function getTaskbarTransform(element, taskButton) {
  const rect = element.getBoundingClientRect();
  const target = taskButton.getBoundingClientRect();
  const fromCenterX = rect.left + rect.width / 2;
  const fromCenterY = rect.top + rect.height / 2;
  const toCenterX = target.left + target.width / 2;
  const toCenterY = target.top + target.height / 2;
  const sx = Math.min(0.3, Math.max(0.14, target.width / Math.max(1, rect.width) * 0.72));
  const sy = Math.min(0.16, Math.max(0.055, target.height / Math.max(1, rect.height) * 1.55));
  return {
    tx: toCenterX - fromCenterX,
    ty: toCenterY - fromCenterY,
    sx,
    sy
  };
}

export function animateWindowFlip(element, beforeRect, done) {
  const afterRect = element.getBoundingClientRect();
  const from = {
    tx: beforeRect.left - afterRect.left,
    ty: beforeRect.top - afterRect.top,
    sx: beforeRect.width / Math.max(1, afterRect.width),
    sy: beforeRect.height / Math.max(1, afterRect.height)
  };
  animateState(element, from, identity(), "top left", "easeOutElastic(1.18, .58)", done);
}

export function animateWindowMinimize(element, taskButton, done) {
  animateState(element, identity(), getTaskbarTransform(element, taskButton), "center center", "easeInOutElastic(1.08, .62)", done);
}

export function animateWindowRestoreFromTaskbar(element, taskButton, done) {
  animateState(element, getTaskbarTransform(element, taskButton), identity(), "center center", "easeOutElastic(1.22, .56)", done);
}
