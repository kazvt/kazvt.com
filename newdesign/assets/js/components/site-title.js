import { createElement } from "./dom.js";

const starCharacters = ["★", "✦", "✧", "✶", "✷", "✹", "✺"];

function createStars(side) {
  return createElement("span", { className: `old-web-title__stars old-web-title__stars--${side}`, "aria-hidden": "true" }, starCharacters.map((star, index) => createElement("span", { className: `old-web-title__star old-web-title__star--${index + 1}`, text: star })));
}

export function createSiteTitle(initialTitle) {
  const text = createElement("span", { className: "old-web-title__text", dataset: { siteTitleText: "true" }, text: initialTitle || "Welcome" });
  const element = createElement("section", { className: "old-web-title", "aria-label": "Website title" }, [
    createStars("left"),
    text,
    createStars("right")
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
