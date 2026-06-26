import { node } from "./dom.js";

export function createArt({ src, alt }) {
  return node("figure", { className: "desktop__art-wrap" }, [
    node("img", { className: "desktop__art", src, alt, decoding: "async" })
  ]);
}
