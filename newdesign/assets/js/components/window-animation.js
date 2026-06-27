import { getMotionFrameMs } from "./motion.js";

const duration = 1000;
const activeAnimations = new WeakMap();

function identity() {
  return { tx: 0, ty: 0, sx: 1, sy: 1, r: 0 };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function applyTransform(element, state) {
  const tx = Math.round(finiteNumber(state.tx, 0));
  const ty = Math.round(finiteNumber(state.ty, 0));
  const rotation = finiteNumber(state.r, 0).toFixed(3);
  const sx = finiteNumber(state.sx, 1).toFixed(4);
  const sy = finiteNumber(state.sy, 1).toFixed(4);
  element.style.transform = `translate(${tx}px, ${ty}px) rotate(${rotation}deg) scale(${sx}, ${sy})`;
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

function rotationForTravel(transform) {
  const horizontal = finiteNumber(transform.tx, 0);
  const vertical = finiteNumber(transform.ty, 0);
  const sign = horizontal || vertical ? Math.sign(horizontal || -vertical) : 1;
  return sign || 1;
}

function animateState(element, from, to, origin, easing, rotationKeyframes, done) {
  clearAnimation(element);
  const anime = window.anime;
  if (!anime) {
    finishAnimation(element, done);
    return null;
  }
  const state = { ...identity(), ...from };
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
    r: rotationKeyframes || to.r,
    duration,
    easing,
    update() {
      const now = performance.now();
      if (frameMs > 0 && now - lastFrame < frameMs) return;
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
    sy,
    r: 0
  };
}

export function animateWindowFlip(element, beforeRect, done) {
  const afterRect = element.getBoundingClientRect();
  const goingBigger = afterRect.width * afterRect.height >= beforeRect.width * beforeRect.height;
  const tilt = goingBigger ? -2.8 : 2.8;
  const from = {
    tx: beforeRect.left - afterRect.left,
    ty: beforeRect.top - afterRect.top,
    sx: beforeRect.width / Math.max(1, afterRect.width),
    sy: beforeRect.height / Math.max(1, afterRect.height),
    r: tilt
  };
  animateState(element, from, identity(), "top left", "easeOutElastic(1.18, .58)", [
    { value: tilt, duration: 0 },
    { value: tilt * -0.62, duration: 300, easing: "easeOutQuad" },
    { value: tilt * 0.32, duration: 260, easing: "easeInOutSine" },
    { value: 0, duration: 440, easing: "easeOutElastic(1.05, .52)" }
  ], done);
}

export function animateWindowMinimize(element, taskButton, done) {
  const target = getTaskbarTransform(element, taskButton);
  const tilt = rotationForTravel(target) * 7.5;
  animateState(element, identity(), target, "center center", "easeInOutElastic(1.08, .62)", [
    { value: 0, duration: 0 },
    { value: tilt, duration: 260, easing: "easeOutQuad" },
    { value: tilt * -0.42, duration: 270, easing: "easeInOutSine" },
    { value: 0, duration: 470, easing: "easeOutElastic(1.08, .55)" }
  ], done);
}

export function animateWindowRestoreFromTaskbar(element, taskButton, done) {
  const start = getTaskbarTransform(element, taskButton);
  const tilt = rotationForTravel(start) * -8;
  start.r = tilt;
  animateState(element, start, identity(), "center center", "easeOutElastic(1.22, .56)", [
    { value: tilt, duration: 0 },
    { value: tilt * -0.56, duration: 320, easing: "easeOutQuad" },
    { value: tilt * 0.25, duration: 260, easing: "easeInOutSine" },
    { value: 0, duration: 420, easing: "easeOutElastic(1.12, .52)" }
  ], done);
}
