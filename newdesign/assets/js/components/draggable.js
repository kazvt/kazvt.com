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

function restoreMaximizedForDrag(element, event) {
  if (!element.classList.contains("is-maximized")) return;
  const maximizedRect = element.getBoundingClientRect();
  const width = Number(element.dataset.restoreWidth || Math.min(620, window.innerWidth));
  const height = Number(element.dataset.restoreHeight || element.dataset.minHeight || element.offsetHeight);
  const ratioX = clamp((event.clientX - maximizedRect.left) / Math.max(1, maximizedRect.width), 0.08, 0.92);
  element.classList.remove("is-maximized");
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  placeElement(element, event.clientX - width * ratioX, Math.max(0, event.clientY - 10));
  element.dispatchEvent(new CustomEvent("windowstatechange", { bubbles: true }));
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
      offsetY: event.clientY - rect.top
    };
    element.classList.add("is-dragging");
    document.body.classList.add("is-window-dragging");
  };
  const start = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest(".title-bar-controls")) return;
    setPointerCapture(handle, event);
    if (element.classList.contains("is-maximized")) {
      drag = {
        id: event.pointerId,
        mode: "pending-maximized",
        startX: event.clientX,
        startY: event.clientY,
        startTime: performance.now()
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
      if (elapsed < 1000 || distance < 8) {
        event.preventDefault();
        return;
      }
      restoreMaximizedForDrag(element, latest);
      startActiveDrag(latest);
    }
    placeElement(element, latest.clientX - drag.offsetX, latest.clientY - drag.offsetY);
    event.preventDefault();
  };
  const stop = () => {
    if (!drag) return;
    releasePointerCapture(handle, drag.id);
    drag = null;
    element.classList.remove("is-dragging");
    document.body.classList.remove("is-window-dragging");
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
      startHeight: element.offsetHeight
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
    sizeElement(element, resize.startWidth + event.clientX - resize.startX, resize.startHeight + event.clientY - resize.startY);
    event.preventDefault();
  };
  const stop = () => {
    if (!resize) return;
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
