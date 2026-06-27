import { createElement } from "./dom.js";

function randomBetween(min, max) {
  if (max <= min) return Math.round((min + max) / 2);
  return Math.round(min + Math.random() * (max - min));
}

function pickEdge() {
  const edges = ["top", "right", "bottom", "left"];
  return edges[Math.floor(Math.random() * edges.length)];
}

function getTaskbarHeight() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--taskbar-height").trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 30;
}

function getImageRect(image) {
  const cssWidth = Number.parseFloat(getComputedStyle(image).width);
  const width = image.offsetWidth || cssWidth || 150;
  const ratio = image.naturalWidth && image.naturalHeight ? image.naturalHeight / image.naturalWidth : 1.2;
  const height = image.offsetHeight || width * ratio;
  return { width, height };
}

function getEdgeMetrics(image) {
  const rect = getImageRect(image);
  return {
    tangentSize: rect.width,
    normalSize: rect.height
  };
}

function setAnchorPosition(element, image, edge) {
  const margin = 10;
  const taskbarHeight = getTaskbarHeight();
  const workspaceHeight = Math.max(0, window.innerHeight - taskbarHeight);
  const metrics = getEdgeMetrics(image);
  const tangentHalf = Math.max(1, metrics.tangentSize / 2);
  const distance = Math.ceil(Math.max(1, metrics.normalSize)) + 4;
  element.style.setProperty("--peek-distance", `${distance}px`);
  if (edge === "top") {
    element.style.setProperty("--peek-anchor-x", `${randomBetween(margin + tangentHalf, window.innerWidth - margin - tangentHalf)}px`);
    element.style.setProperty("--peek-anchor-y", "0px");
    return;
  }
  if (edge === "bottom") {
    element.style.setProperty("--peek-anchor-x", `${randomBetween(margin + tangentHalf, window.innerWidth - margin - tangentHalf)}px`);
    element.style.setProperty("--peek-anchor-y", `${workspaceHeight}px`);
    return;
  }
  if (edge === "left") {
    element.style.setProperty("--peek-anchor-x", "0px");
    element.style.setProperty("--peek-anchor-y", `${randomBetween(margin + tangentHalf, workspaceHeight - margin - tangentHalf)}px`);
    return;
  }
  element.style.setProperty("--peek-anchor-x", `${window.innerWidth}px`);
  element.style.setProperty("--peek-anchor-y", `${randomBetween(margin + tangentHalf, workspaceHeight - margin - tangentHalf)}px`);
}

export function createEdgePeek(options = {}) {
  const settings = {
    src: "assets/img/osaka.gif",
    alt: "Osaka peeking from the desktop edge",
    intervalMs: 10000,
    visibleMs: 3000,
    ...options
  };
  const image = createElement("img", {
    className: "edge-peek__image",
    src: settings.src,
    alt: settings.alt,
    decoding: "async",
    draggable: false
  });
  const element = createElement("div", {
    className: "edge-peek",
    ariaHidden: "true"
  }, [image]);
  let active = false;
  let available = true;
  let hideTimer = null;
  const hide = () => {
    element.classList.remove("is-visible");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      active = false;
    }, 780);
  };
  const pop = () => {
    if (!element.isConnected || active || !available) return;
    active = true;
    const edge = pickEdge();
    element.classList.remove("is-visible");
    element.dataset.edge = edge;
    setAnchorPosition(element, image, edge);
    window.requestAnimationFrame(() => {
      element.classList.add("is-visible");
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hide, settings.visibleMs);
    });
  };
  const startInitialPeek = () => window.setTimeout(pop, settings.initialDelayMs || 1200);
  image.addEventListener("load", () => {
    available = true;
  });
  image.addEventListener("error", () => {
    available = false;
    active = false;
    element.classList.remove("is-visible");
  });
  if (image.complete && image.naturalWidth > 0) startInitialPeek();
  else image.addEventListener("load", startInitialPeek, { once: true });
  window.setInterval(pop, settings.intervalMs);
  return element;
}
