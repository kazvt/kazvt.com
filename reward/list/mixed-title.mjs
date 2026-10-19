const TITLE_FONT_CLASSES = Object.freeze([
  "mixed-title-glyph--spiral",
  "mixed-title-glyph--panties",
  "mixed-title-glyph--bricked",
  "mixed-title-glyph--comic"
]);

function splitGraphemes(value) {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), part => part.segment);
  }
  return Array.from(value);
}

function randomIndex(length, random) {
  const sample = Number(random());
  const boundedSample = Number.isFinite(sample) ? Math.max(0, Math.min(sample, 1 - Number.EPSILON)) : 0;
  return Math.floor(boundedSample * length);
}

function shuffledFonts(random) {
  const fonts = [...TITLE_FONT_CLASSES];
  for (let index = fonts.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, random);
    [fonts[index], fonts[swapIndex]] = [fonts[swapIndex], fonts[index]];
  }
  return fonts;
}

export function createMixedTitleGlyphs(value, random = Math.random) {
  const glyphs = splitGraphemes(String(value));
  const result = [];
  let fontBag = [];
  let previousFont = "";

  for (const glyph of glyphs) {
    if (/^\s+$/u.test(glyph)) {
      result.push({ glyph, fontClass: null });
      continue;
    }

    if (fontBag.length === 0) fontBag = shuffledFonts(random);
    let fontClass = fontBag.pop();
    if (fontClass === previousFont && fontBag.length > 0) {
      const alternateIndex = fontBag.findIndex(candidate => candidate !== previousFont);
      if (alternateIndex >= 0) {
        [fontBag[fontBag.length - 1], fontBag[alternateIndex]] =
          [fontBag[alternateIndex], fontBag[fontBag.length - 1]];
        fontClass = fontBag.pop();
      }
    }

    result.push({ glyph, fontClass });
    previousFont = fontClass;
  }

  return result;
}
