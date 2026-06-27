import { createElement } from "./dom.js";

function createSvgElement(tag, attributes = {}, children = []) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === false || value === null || value === undefined) return;
    element.setAttribute(key, value === true ? "" : value);
  });
  children.filter(Boolean).forEach((child) => element.append(child));
  return element;
}

function createStar(side) {
  const gradientId = `old-web-title-star-gradient-${side}`;
  const gradient = createSvgElement("linearGradient", { id: gradientId, x1: "0", y1: "0", x2: "1", y2: "1" }, [
    createSvgElement("stop", { offset: "0%", "stop-color": "#ff0000" }),
    createSvgElement("stop", { offset: "18%", "stop-color": "#ff9900" }),
    createSvgElement("stop", { offset: "34%", "stop-color": "#fff200" }),
    createSvgElement("stop", { offset: "50%", "stop-color": "#00ff38" }),
    createSvgElement("stop", { offset: "66%", "stop-color": "#00c8ff" }),
    createSvgElement("stop", { offset: "82%", "stop-color": "#363cff" }),
    createSvgElement("stop", { offset: "100%", "stop-color": "#ff00e6" })
  ]);
  const polygon = createSvgElement("polygon", {
    points: "32 2 40.4 21.3 61.4 23.8 45.7 38.1 49.9 59 32 48.4 14.1 59 18.3 38.1 2.6 23.8 23.6 21.3",
    fill: `url(#${gradientId})`,
    stroke: "#000080",
    "stroke-width": "3",
    "stroke-linejoin": "round"
  });
  const svg = createSvgElement("svg", { class: `old-web-title__star old-web-title__star--${side}`, viewBox: "0 0 64 64", "aria-hidden": "true", focusable: "false" }, [
    createSvgElement("defs", {}, [gradient]),
    polygon
  ]);
  return svg;
}

export function createSiteTitle(initialTitle) {
  const text = createElement("span", { className: "old-web-title__text", dataset: { siteTitleText: "true" }, text: initialTitle || "Welcome" });
  const element = createElement("section", { className: "old-web-title", "aria-label": "Website title" }, [
    createStar("left"),
    text,
    createStar("right")
  ]);
  return {
    element,
    setTitle(value) {
      const title = String(value || "").trim() || "Welcome";
      text.textContent = title;
      element.setAttribute("aria-label", title);
    }
  };
}
