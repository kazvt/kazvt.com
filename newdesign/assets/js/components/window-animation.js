import { getMotionFrameMs } from "./motion.js";

const duration = 1000;
const activeAnimations = new WeakMap();
const dragAnimations = new WeakMap();

function identity() {
  return { tx: 0, ty: 0, sx: 1, sy: 1, r: 0, o: 1 };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function applyTransform(element, state) {
  const tx = Math.round(finiteNumber(state.tx, 0));
  const ty = Math.round(finiteNumber(state.ty, 0));
  const rotation = finiteNumber(state.r, 0).toFixed(3);
  const sx = finiteNumber(state.sx, 1).toFixed(4);
  const sy = finiteNumber(state.sy, 1).toFixed(4);
  const opacity = finiteNumber(state.o, 1).toFixed(4);
  element.style.transform = `translate(${tx}px, ${ty}px) rotate(${rotation}deg) scale(${sx}, ${sy})`;
  element.style.opacity = opacity;
}

function clearAnimation(element) {
  const existing = activeAnimations.get(element);
  if (existing) {
    if (existing.animation && existing.animation.pause) existing.animation.pause();
    if (window.anime && existing.state) window.anime.remove(existing.state);
    activeAnimations.delete(element);
  }
}

function clearDragAnimation(element) {
  const existing = dragAnimations.get(element);
  if (existing) {
    if (existing.animation && existing.animation.pause) existing.animation.pause();
    if (window.anime && existing.state) window.anime.remove(existing.state);
    dragAnimations.delete(element);
  }
}

function makeFrameStepper() {
  const frameMs = getMotionFrameMs();
  let lastFrame = 0;
  return () => {
    if (frameMs <= 0) return true;
    const now = performance.now();
    if (now - lastFrame < frameMs) return false;
    lastFrame = now;
    return true;
  };
}

function renderStepped(stepper, element, state) {
  if (!stepper()) return;
  applyTransform(element, state);
}

function finishAnimation(element, done) {
  element.classList.remove("is-window-animating");
  element.style.transform = "";
  element.style.transformOrigin = "";
  element.style.opacity = "";
  activeAnimations.delete(element);
  if (done) done();
}

function finishDrag(element) {
  element.classList.remove("is-drag-jiggling");
  element.style.transform = "";
  element.style.transformOrigin = "";
  element.style.opacity = "";
  dragAnimations.delete(element);
}

function rotationForTravel(transform) {
  const horizontal = finiteNumber(transform.tx, 0);
  const vertical = finiteNumber(transform.ty, 0);
  const sign = horizontal || vertical ? Math.sign(horizontal || -vertical) : 1;
  return sign || 1;
}

function animateState(element, from, to, origin, easing, keyframes, done) {
  clearDragAnimation(element);
  clearAnimation(element);
  const anime = window.anime;
  if (!anime) {
    finishAnimation(element, done);
    return null;
  }
  const state = { ...identity(), ...from };
  const target = { ...identity(), ...to };
  const stepper = makeFrameStepper();
  element.classList.add("is-window-animating");
  element.style.transformOrigin = origin;
  applyTransform(element, state);
  const animation = anime({
    targets: state,
    tx: keyframes && keyframes.tx ? keyframes.tx : target.tx,
    ty: keyframes && keyframes.ty ? keyframes.ty : target.ty,
    sx: keyframes && keyframes.sx ? keyframes.sx : target.sx,
    sy: keyframes && keyframes.sy ? keyframes.sy : target.sy,
    r: keyframes && keyframes.r ? keyframes.r : target.r,
    o: keyframes && keyframes.o ? keyframes.o : target.o,
    duration,
    easing,
    update() {
      renderStepped(stepper, element, state);
    },
    complete() {
      applyTransform(element, target);
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
    r: 0,
    o: 1
  };
}

function travelStretch(transform) {
  const distance = Math.hypot(finiteNumber(transform.tx, 0), finiteNumber(transform.ty, 0));
  const amount = clamp(distance / 1200, 0.035, 0.125);
  return {
    sx: 1 + amount,
    sy: 1 - amount * 0.44
  };
}

export function animateWindowFlip(element, beforeRect, done) {
  const afterRect = element.getBoundingClientRect();
  const goingBigger = afterRect.width * afterRect.height >= beforeRect.width * beforeRect.height;
  const tilt = goingBigger ? -3.6 : 3.6;
  const from = {
    tx: beforeRect.left - afterRect.left,
    ty: beforeRect.top - afterRect.top,
    sx: beforeRect.width / Math.max(1, afterRect.width),
    sy: beforeRect.height / Math.max(1, afterRect.height),
    r: tilt,
    o: 1
  };
  animateState(element, from, identity(), "top left", "easeOutElastic(1.28, .55)", {
    r: [
      { value: tilt, duration: 0 },
      { value: tilt * -0.82, duration: 320, easing: "easeOutQuad" },
      { value: tilt * 0.45, duration: 260, easing: "easeInOutSine" },
      { value: tilt * -0.16, duration: 220, easing: "easeOutQuad" },
      { value: 0, duration: 200, easing: "easeOutElastic(1.12, .48)" }
    ]
  }, done);
}

export function animateWindowMinimize(element, taskButton, done) {
  const target = getTaskbarTransform(element, taskButton);
  const tilt = rotationForTravel(target) * 8.5;
  const stretch = travelStretch(target);
  animateState(element, identity(), target, "center center", "easeInOutElastic(1.16, .58)", {
    sx: [
      { value: stretch.sx, duration: 190, easing: "easeOutQuad" },
      { value: 0.86, duration: 180, easing: "easeInOutSine" },
      { value: target.sx, duration: 630, easing: "easeInOutElastic(1.12, .56)" }
    ],
    sy: [
      { value: stretch.sy, duration: 190, easing: "easeOutQuad" },
      { value: 1.08, duration: 180, easing: "easeInOutSine" },
      { value: target.sy, duration: 630, easing: "easeInOutElastic(1.12, .56)" }
    ],
    r: [
      { value: 0, duration: 0 },
      { value: tilt, duration: 260, easing: "easeOutQuad" },
      { value: tilt * -0.55, duration: 260, easing: "easeInOutSine" },
      { value: tilt * 0.22, duration: 220, easing: "easeOutQuad" },
      { value: 0, duration: 260, easing: "easeOutElastic(1.08, .5)" }
    ]
  }, done);
}

export function animateWindowRestoreFromTaskbar(element, taskButton, done) {
  const start = getTaskbarTransform(element, taskButton);
  const tilt = rotationForTravel(start) * -8.5;
  start.r = tilt;
  const stretch = travelStretch(start);
  animateState(element, start, identity(), "center center", "easeOutElastic(1.28, .54)", {
    sx: [
      { value: start.sx, duration: 0 },
      { value: stretch.sx, duration: 300, easing: "easeOutQuad" },
      { value: 0.96, duration: 240, easing: "easeInOutSine" },
      { value: 1.025, duration: 220, easing: "easeOutQuad" },
      { value: 1, duration: 240, easing: "easeOutElastic(1.06, .5)" }
    ],
    sy: [
      { value: start.sy, duration: 0 },
      { value: stretch.sy, duration: 300, easing: "easeOutQuad" },
      { value: 1.035, duration: 240, easing: "easeInOutSine" },
      { value: 0.99, duration: 220, easing: "easeOutQuad" },
      { value: 1, duration: 240, easing: "easeOutElastic(1.06, .5)" }
    ],
    r: [
      { value: tilt, duration: 0 },
      { value: tilt * -0.68, duration: 320, easing: "easeOutQuad" },
      { value: tilt * 0.32, duration: 260, easing: "easeInOutSine" },
      { value: tilt * -0.12, duration: 200, easing: "easeOutQuad" },
      { value: 0, duration: 220, easing: "easeOutElastic(1.12, .48)" }
    ]
  }, done);
}

export function animateWindowClose(element, done) {
  animateState(element, identity(), { tx: 0, ty: 0, sx: 0.72, sy: 0.72, r: 0, o: 1 }, "center center", "easeInOutElastic(1.14, .56)", {
    sx: [
      { value: 1.055, duration: 170, easing: "easeOutQuad" },
      { value: 0.94, duration: 180, easing: "easeInOutSine" },
      { value: 1.025, duration: 170, easing: "easeOutQuad" },
      { value: 0.72, duration: 480, easing: "easeInBack" }
    ],
    sy: [
      { value: 0.965, duration: 170, easing: "easeOutQuad" },
      { value: 1.045, duration: 180, easing: "easeInOutSine" },
      { value: 0.985, duration: 170, easing: "easeOutQuad" },
      { value: 0.72, duration: 480, easing: "easeInBack" }
    ],
    r: [
      { value: -3.2, duration: 160, easing: "easeOutQuad" },
      { value: 2.4, duration: 170, easing: "easeInOutSine" },
      { value: -1.2, duration: 160, easing: "easeOutQuad" },
      { value: 0, duration: 510, easing: "easeOutElastic(1.05, .5)" }
    ]
  }, done);
}

export function animateWindowDragJiggle(element, deltaX, deltaY, edgeState = {}) {
  if (element.classList.contains("is-window-animating")) return;
  const anime = window.anime;
  const horizontal = finiteNumber(deltaX, 0);
  const vertical = finiteNumber(deltaY, 0);
  const now = performance.now();
  const frameMs = getMotionFrameMs();
  const existing = dragAnimations.get(element) || {
    state: { r: 0, sx: 1, sy: 1, tx: 0, ty: 0, o: 1 },
    last: 0,
    filteredX: 0,
    filteredY: 0,
    dominant: "horizontal",
    stepper: makeFrameStepper()
  };
  existing.filteredX = existing.filteredX * 0.84 + horizontal * 0.16;
  existing.filteredY = existing.filteredY * 0.84 + vertical * 0.16;
  const pullX = existing.filteredX;
  const pullY = existing.filteredY;
  const absX = Math.abs(pullX);
  const absY = Math.abs(pullY);
  if (absX > absY * 1.22) existing.dominant = "horizontal";
  if (absY > absX * 1.22) existing.dominant = "vertical";
  const dominantHorizontal = existing.dominant === "horizontal";
  const horizontalPull = dominantHorizontal ? Math.min(1, Math.sqrt(absX / 38)) : 0;
  const verticalPull = dominantHorizontal ? 0 : Math.min(1, Math.sqrt(absY / 38));
  const targetRotation = dominantHorizontal ? clamp(pullX * 0.12, -2, 2) : 0;
  const horizontalEdgePush = dominantHorizontal && edgeState.horizontalPush;
  const verticalEdgePush = !dominantHorizontal && edgeState.verticalPush;
  const targetScaleX = dominantHorizontal
    ? (horizontalEdgePush ? clamp(1 - horizontalPull * 0.2, 0.8, 1) : clamp(1 + horizontalPull * 0.2, 1, 1.2))
    : (verticalEdgePush ? clamp(1 + verticalPull * 0.2, 1, 1.2) : clamp(1 - verticalPull * 0.2, 0.8, 1));
  const targetScaleY = dominantHorizontal
    ? (horizontalEdgePush ? clamp(1 + horizontalPull * 0.08, 1, 1.08) : clamp(1 - horizontalPull * 0.05, 0.95, 1))
    : (verticalEdgePush ? clamp(1 - verticalPull * 0.05, 0.95, 1) : clamp(1 + verticalPull * 0.08, 1, 1.08));
  const origin = edgeState.leftPush
    ? "0% 12px"
    : edgeState.rightPush
      ? "100% 12px"
      : edgeState.topPush
        ? "50% 0%"
        : edgeState.bottomPush
          ? "50% 100%"
          : "50% 12px";
  if (!anime) {
    element.style.transformOrigin = origin;
    element.style.transform = `rotate(${targetRotation.toFixed(3)}deg) scale(${targetScaleX.toFixed(4)}, ${targetScaleY.toFixed(4)})`;
    return;
  }
  if (frameMs > 0 && now - existing.last < frameMs) return;
  if (existing.animation && existing.animation.pause) existing.animation.pause();
  anime.remove(existing.state);
  existing.last = now;
  element.classList.add("is-drag-jiggling");
  element.style.transformOrigin = origin;
  existing.animation = anime({
    targets: existing.state,
    r: targetRotation,
    sx: targetScaleX,
    sy: targetScaleY,
    duration: 360,
    easing: "easeOutCubic",
    update() {
      renderStepped(existing.stepper, element, existing.state);
    }
  });
  dragAnimations.set(element, existing);
}

export function settleWindowDragJiggle(element) {
  const anime = window.anime;
  const existing = dragAnimations.get(element);
  if (!anime || !existing) {
    if (!element.classList.contains("is-window-animating")) finishDrag(element);
    return;
  }
  if (existing.animation && existing.animation.pause) existing.animation.pause();
  anime.remove(existing.state);
  existing.stepper = makeFrameStepper();
  existing.animation = anime({
    targets: existing.state,
    r: [
      { value: existing.state.r * -0.38, duration: 180, easing: "easeOutQuad" },
      { value: existing.state.r * 0.16, duration: 170, easing: "easeInOutSine" },
      { value: 0, duration: 430, easing: "easeOutElastic(1.1, .46)" }
    ],
    sx: [
      { value: 0.992, duration: 180, easing: "easeOutQuad" },
      { value: 1.006, duration: 170, easing: "easeInOutSine" },
      { value: 1, duration: 430, easing: "easeOutElastic(1.05, .5)" }
    ],
    sy: [
      { value: 1.006, duration: 180, easing: "easeOutQuad" },
      { value: 0.996, duration: 170, easing: "easeInOutSine" },
      { value: 1, duration: 430, easing: "easeOutElastic(1.05, .5)" }
    ],
    tx: 0,
    ty: 0,
    o: 1,
    duration: 780,
    easing: "linear",
    update() {
      renderStepped(existing.stepper, element, existing.state);
    },
    complete() {
      finishDrag(element);
    }
  });
  dragAnimations.set(element, existing);
}
