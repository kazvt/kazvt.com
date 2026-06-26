import { node } from "./dom.js";

export function createArt({ src, alt }) {
  return node("figure", { className: "desktop__art-wrap", "aria-label": alt }, [
    node("img", { className: "desktop__art", src, alt, decoding: "async" })
  ]);
}
