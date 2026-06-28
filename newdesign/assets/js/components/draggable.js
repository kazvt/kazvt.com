import { getMotionFrameMs } from "./motion.js";
import { animateWindowDragJiggle, settleWindowDragJiggle } from "./window-animation.js";

function getTaskbarHeight() {
  const taskbar = document.querySelector(".taskbar");
  return taskbar ? taskbar.getBoundingClientRect().height : 30;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getMoveBounds(element) {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  const taskbarHeight = getTaskbarHeight();
  return {
    minX: 0,
    minY: 0,
    maxX: Math.max(0, window.innerWidth - width),
    maxY: Math.max(0, window.innerHeight - taskbarHeight - height)
  };
}

function getResizeBounds(element) {
  const rect = element.getBoundingClientRect();
  const taskbarHeight = getTaskbarHeight();
  return {
    maxWidth: Math.max(120, window.innerWidth - rect.left),
    maxHeight: Math.max(120, window.innerHeight - taskbarHeight - rect.top)
  };
}

function getMinimums(element, bounds = getResizeBounds(element)) {
  const baseWidth = Number(element.dataset.minWidth || element.offsetWidth / 2);
  const baseHeight = Number(element.dataset.minHeight || element.offsetHeight);
  return {
    minWidth: Math.min(baseWidth, bounds.maxWidth),
    minHeight: Math.min(baseHeight, bounds.maxHeight)
  };
}

function applyMinimums(element, bounds = getResizeBounds(element)) {
  const minimums = getMinimums(element, bounds);
  element.style.minWidth = `${minimums.minWidth}px`;
  element.style.minHeight = `${minimums.minHeight}px`;
  return minimums;
}

function placeElement(element, x, y) {
  const bounds = getMoveBounds(element);
  const left = Math.round(clamp(x, bounds.minX, bounds.maxX));
  const top = Math.round(clamp(y, bounds.minY, bounds.maxY));
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  return {
    desiredX: x,
    desiredY: y,
    left,
    top,
    bounds,
    blockedLeft: x < bounds.minX,
    blockedRight: x > bounds.maxX,
    blockedTop: y < bounds.minY,
    blockedBottom: y > bounds.maxY,
    atLeft: left <= bounds.minX + 1,
    atRight: left >= bounds.maxX - 1,
    atTop: top <= bounds.minY + 1,
    atBottom: top >= bounds.maxY - 1
  };
}

function getDragEdgeState(placement, deltaX, deltaY) {
  const leftPush = placement.blockedLeft || (placement.atLeft && deltaX < 0);
  const rightPush = placement.blockedRight || (placement.atRight && deltaX > 0);
  const topPush = placement.blockedTop || (placement.atTop && deltaY < 0);
  const bottomPush = placement.blockedBottom || (placement.atBottom && deltaY > 0);
  return {
    leftPush,
    rightPush,
    topPush,
    bottomPush,
    horizontalPush: leftPush || rightPush,
    verticalPush: topPush || bottomPush
  };
}

function sizeElement(element, width, height) {
  const bounds = getResizeBounds(element);
  const minimums = applyMinimums(element, bounds);
  element.style.width = `${clamp(width, minimums.minWidth, bounds.maxWidth)}px`;
  element.style.height = `${clamp(height, minimums.minHeight, bounds.maxHeight)}px`;
}

function setPointerCapture(target, event) {
  if (target.setPointerCapture && event.pointerId !== undefined) {
    try {
      target.setPointerCapture(event.pointerId);
    } catch {}
  }
}

function releasePointerCapture(target, id) {
  if (target.releasePointerCapture && id !== undefined) {
    try {
      target.releasePointerCapture(id);
    } catch {}
  }
}

function initMinimums(element) {
  if (!element.dataset.minWidth || !element.dataset.minHeight) {
    element.dataset.minWidth = String(Math.round(element.offsetWidth / 2));
    element.dataset.minHeight = String(Math.round(element.offsetHeight));
  }
  applyMinimums(element);
}

function restoreMaximizedForDrag(element, event, anchor) {
  if (!element.classList.contains("is-maximized")) return;
  const maximizedRect = element.getBoundingClientRect();
  const titleBar = element.querySelector(".title-bar");
  const titleRect = titleBar ? titleBar.getBoundingClientRect() : maximizedRect;
  const beforeRect = {
    left: maximizedRect.left,
    top: maximizedRect.top,
    width: maximizedRect.width,
    height: maximizedRect.height
  };
  const width = Number(element.dataset.restoreWidth || Math.min(620, window.innerWidth));
  const height = Number(element.dataset.restoreHeight || element.dataset.minHeight || element.offsetHeight);
  const ratioX = clamp(anchor && Number.isFinite(anchor.ratioX) ? anchor.ratioX : (event.clientX - titleRect.left) / Math.max(1, titleRect.width), 0, 1);
  const offsetY = clamp(anchor && Number.isFinite(anchor.offsetY) ? anchor.offsetY : event.clientY - titleRect.top, 0, Math.max(1, titleRect.height));
  element.classList.remove("is-maximized");
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  placeElement(element, event.clientX - width * ratioX, event.clientY - offsetY);
  element.dispatchEvent(new CustomEvent("windowstatechange", { bubbles: true }));
  element.dispatchEvent(new CustomEvent("windowdragrestore", { bubbles: true, detail: { beforeRect } }));
}

export function keepInsideViewport(element) {
  if (element.classList.contains("is-maximized")) {
    element.style.left = "0px";
    element.style.top = "0px";
    element.style.width = `${window.innerWidth}px`;
    element.style.height = `${window.innerHeight - getTaskbarHeight()}px`;
    return;
  }
  const rect = element.getBoundingClientRect();
  const bounds = getResizeBounds(element);
  const minimums = applyMinimums(element, bounds);
  element.style.width = `${clamp(element.offsetWidth, minimums.minWidth, bounds.maxWidth)}px`;
  element.style.height = `${clamp(element.offsetHeight, minimums.minHeight, bounds.maxHeight)}px`;
  placeElement(element, rect.left, rect.top);
}

export function makeDraggable(element, handle) {
  let drag = null;
  const startActiveDrag = (event) => {
    const rect = element.getBoundingClientRect();
    drag = {
      id: event.pointerId,
      mode: "active",
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      lastFrameTime: 0,
      latestX: event.clientX,
      latestY: event.clientY,
      previousX: event.clientX,
      previousY: event.clientY
    };
    element.classList.add("is-dragging");
    document.body.classList.add("is-window-dragging");
  };
  const start = (event) => {
    if (element.classList.contains("is-window-animating")) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest(".title-bar-controls")) return;
    setPointerCapture(handle, event);
    if (element.classList.contains("is-maximized")) {
      const maximizedRect = element.getBoundingClientRect();
      const titleBar = element.querySelector(".title-bar");
      const titleRect = titleBar ? titleBar.getBoundingClientRect() : maximizedRect;
      drag = {
        id: event.pointerId,
        mode: "pending-maximized",
        startX: event.clientX,
        startY: event.clientY,
        startTime: performance.now(),
        restoreAnchor: {
          ratioX: clamp((event.clientX - titleRect.left) / Math.max(1, titleRect.width), 0, 1),
          offsetY: clamp(event.clientY - titleRect.top, 0, Math.max(1, titleRect.height))
        }
      };
      event.preventDefault();
      return;
    }
    startActiveDrag(event);
    event.preventDefault();
  };
  const move = (event) => {
    if (!drag) return;
    const points = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
    const latest = points[points.length - 1] || event;
    if (latest.pointerId !== undefined && drag.id !== undefined && latest.pointerId !== drag.id) return;
    if (drag.mode === "pending-maximized") {
      const elapsed = performance.now() - drag.startTime;
      const distance = Math.hypot(latest.clientX - drag.startX, latest.clientY - drag.startY);
      if (elapsed < 300 || distance < 8) {
        event.preventDefault();
        return;
      }
      const anchor = drag.restoreAnchor;
      restoreMaximizedForDrag(element, latest, anchor);
      startActiveDrag(latest);
    }
    drag.latestX = latest.clientX;
    drag.latestY = latest.clientY;
    const now = performance.now();
    const frameMs = getMotionFrameMs();
    if (frameMs <= 0 || now - drag.lastFrameTime >= frameMs) {
      drag.lastFrameTime = now;
      const deltaX = latest.clientX - drag.previousX;
      const deltaY = latest.clientY - drag.previousY;
      const placement = placeElement(element, latest.clientX - drag.offsetX, latest.clientY - drag.offsetY);
      animateWindowDragJiggle(element, deltaX, deltaY, getDragEdgeState(placement, deltaX, deltaY));
      drag.previousX = latest.clientX;
      drag.previousY = latest.clientY;
    }
    event.preventDefault();
  };
  const stop = () => {
    if (!drag) return;
    if (drag.mode === "active") placeElement(element, drag.latestX - drag.offsetX, drag.latestY - drag.offsetY);
    releasePointerCapture(handle, drag.id);
    drag = null;
    element.classList.remove("is-dragging");
    document.body.classList.remove("is-window-dragging");
    settleWindowDragJiggle(element);
  };
  handle.addEventListener("pointerdown", start);
  window.addEventListener("pointermove", move);
  if ("onpointerrawupdate" in window) window.addEventListener("pointerrawupdate", move);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  window.addEventListener("resize", () => keepInsideViewport(element));
  window.addEventListener("load", () => keepInsideViewport(element));
  keepInsideViewport(element);
}

export function makeResizable(element) {
  const handle = document.createElement("div");
  handle.className = "window-resize-handle";
  handle.setAttribute("aria-hidden", "true");
  element.append(handle);
  let resize = null;
  const start = (event) => {
    if (element.classList.contains("is-maximized")) return;
    if (event.button !== undefined && event.button !== 0) return;
    initMinimums(element);
    resize = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: element.offsetWidth,
      startHeight: element.offsetHeight,
      latestX: event.clientX,
      latestY: event.clientY,
      lastFrameTime: 0
    };
    setPointerCapture(handle, event);
    element.classList.add("is-resizing");
    document.body.classList.add("is-window-resizing");
    event.preventDefault();
    event.stopPropagation();
  };
  const move = (event) => {
    if (!resize) return;
    if (event.pointerId !== undefined && resize.id !== undefined && event.pointerId !== resize.id) return;
    resize.latestX = event.clientX;
    resize.latestY = event.clientY;
    const now = performance.now();
    const frameMs = getMotionFrameMs();
    if (frameMs <= 0 || now - resize.lastFrameTime >= frameMs) {
      resize.lastFrameTime = now;
      sizeElement(element, resize.startWidth + event.clientX - resize.startX, resize.startHeight + event.clientY - resize.startY);
    }
    event.preventDefault();
  };
  const stop = () => {
    if (!resize) return;
    sizeElement(element, resize.startWidth + resize.latestX - resize.startX, resize.startHeight + resize.latestY - resize.startY);
    releasePointerCapture(handle, resize.id);
    resize = null;
    element.classList.remove("is-resizing");
    document.body.classList.remove("is-window-resizing");
    keepInsideViewport(element);
  };
  handle.addEventListener("pointerdown", start);
  window.addEventListener("pointermove", move);
  if ("onpointerrawupdate" in window) window.addEventListener("pointerrawupdate", move);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  window.addEventListener("load", () => initMinimums(element));
  window.addEventListener("resize", () => keepInsideViewport(element));
  requestAnimationFrame(() => initMinimums(element));
}

export function maximizeElement(element) {
  if (!element.classList.contains("is-maximized")) {
    const rect = element.getBoundingClientRect();
    element.dataset.restoreLeft = String(rect.left);
    element.dataset.restoreTop = String(rect.top);
    element.dataset.restoreWidth = String(element.offsetWidth);
    element.dataset.restoreHeight = String(element.offsetHeight);
    element.classList.add("is-maximized");
    element.style.left = "0px";
    element.style.top = "0px";
    element.style.width = `${window.innerWidth}px`;
    element.style.height = `${window.innerHeight - getTaskbarHeight()}px`;
    element.dispatchEvent(new CustomEvent("windowstatechange", { bubbles: true }));
    return true;
  }
  element.classList.remove("is-maximized");
  element.style.left = `${element.dataset.restoreLeft || 0}px`;
  element.style.top = `${element.dataset.restoreTop || 0}px`;
  element.style.width = `${element.dataset.restoreWidth || element.offsetWidth}px`;
  element.style.height = `${element.dataset.restoreHeight || element.offsetHeight}px`;
  keepInsideViewport(element);
  element.dispatchEvent(new CustomEvent("windowstatechange", { bubbles: true }));
  return false;
}
