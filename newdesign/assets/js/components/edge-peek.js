import { createElement } from "./dom.js";

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function pickEdge() {
  const edges = ["top", "right", "bottom", "left"];
  return edges[Math.floor(Math.random() * edges.length)];
}

function setEdgePosition(element, edge) {
  if (edge === "top" || edge === "bottom") {
    element.style.setProperty("--peek-x", `${randomBetween(12, 88)}vw`);
    element.style.removeProperty("--peek-y");
    return;
  }
  element.style.setProperty("--peek-y", `${randomBetween(12, 74)}vh`);
  element.style.removeProperty("--peek-x");
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
    decoding: "async"
  });
  const element = createElement("div", {
    className: "edge-peek",
    ariaHidden: "true"
  }, [image]);
  let active = false;
  let hideTimer = null;
  image.addEventListener("error", () => element.remove());
  const pop = () => {
    if (!element.isConnected || active) return;
    active = true;
    const edge = pickEdge();
    element.dataset.edge = edge;
    setEdgePosition(element, edge);
    element.classList.add("is-visible");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      element.classList.remove("is-visible");
      active = false;
    }, settings.visibleMs);
  };
  window.setInterval(pop, settings.intervalMs);
  return element;
}
