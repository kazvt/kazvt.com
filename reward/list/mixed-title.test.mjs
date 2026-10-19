import assert from "node:assert/strict";
import test from "node:test";

import { createMixedTitleGlyphs } from "./mixed-title.mjs";

test("mixed title font cycles shuffle all four fonts and never repeat adjacent glyph fonts", () => {
  let seed = 17;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const rendered = createMixedTitleGlyphs("ABCDEFGH", random);
  const fonts = rendered.map(item => item.fontClass);

  assert.equal(new Set(fonts.slice(0, 4)).size, 4);
  assert.equal(new Set(fonts.slice(4, 8)).size, 4);
  assert.ok(fonts.includes("mixed-title-glyph--comic"));
  for (let index = 1; index < fonts.length; index += 1) {
    assert.notEqual(fonts[index], fonts[index - 1]);
  }
});

test("mixed title font assignment preserves spaces and extended grapheme clusters", () => {
  const rendered = createMixedTitleGlyphs("A 🔥 B", () => 0.5);
  assert.deepEqual(rendered.map(item => item.glyph), ["A", " ", "🔥", " ", "B"]);
  assert.equal(rendered[1].fontClass, null);
  assert.equal(rendered[3].fontClass, null);
});

test("mixed title font assignment safely bounds an unusual random source", () => {
  const rendered = createMixedTitleGlyphs("Hi", () => 1);
  assert.ok(rendered.every(item => item.fontClass?.startsWith("mixed-title-glyph--")));
});
