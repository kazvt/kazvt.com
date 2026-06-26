import { createElement } from "./dom.js";

export function createArt({ src, alt }) {
  return createElement("figure", { className: "desktop-art" }, [
    createElement("img", { className: "desktop-art__image", src, alt, decoding: "async" })
  ]);
}
