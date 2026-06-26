function getTaskbarHeight() {
  const taskbar = document.querySelector(".taskbar");
  return taskbar ? taskbar.getBoundingClientRect().height : 30;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getBounds(element) {
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

function placeElement(element, x, y) {
  const bounds = getBounds(element);
  element.style.left = `${clamp(x, bounds.minX, bounds.maxX)}px`;
  element.style.top = `${clamp(y, bounds.minY, bounds.maxY)}px`;
}

export function keepInsideViewport(element) {
  const rect = element.getBoundingClientRect();
  placeElement(element, rect.left, rect.top);
}

export function makeDraggable(element, handle) {
  let drag = null;
  const start = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest(".title-bar-controls")) return;
    const rect = element.getBoundingClientRect();
    drag = {
      id: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    element.classList.add("is-dragging");
    event.preventDefault();
  };
  const move = (event) => {
    if (!drag) return;
    if (event.pointerId !== undefined && drag.id !== undefined && event.pointerId !== drag.id) return;
    placeElement(element, event.clientX - drag.offsetX, event.clientY - drag.offsetY);
    event.preventDefault();
  };
  const stop = () => {
    if (!drag) return;
    drag = null;
    element.classList.remove("is-dragging");
  };
  handle.addEventListener("pointerdown", start);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  window.addEventListener("resize", () => keepInsideViewport(element));
  window.addEventListener("load", () => keepInsideViewport(element));
  keepInsideViewport(element);
}
