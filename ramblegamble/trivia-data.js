// Sparse tier rules intentionally inherit forward. Only the sanitized brief's
// structural information lives here; no redacted prompt or answer is guessed.
export const ROUND_RULES = {
  1: { 1: { mode: "choice-text", optionCount: 6 }, 2: { addOptions: 4, resetQuestion: true }, 3: { resetQuestion: true }, 4: { resetQuestion: true }, 5: { mode: "short-answer", optionCount: 0, resetQuestion: true } },
  2: { 1: { mode: "choice-text", optionCount: 6, promptImage: true }, 3: { promptImage: true, replaceOptions: true }, 5: { mode: "short-answer", optionCount: 0 } },
  3: { 1: { mode: "choice-text", optionCount: 6 }, 2: { addOptions: 4 }, 5: { mode: "short-answer", optionCount: 0 } },
  4: { 1: { mode: "choice-image-wide", optionCount: 6 }, 3: { mode: "choice-image", optionCount: 6, replaceOptions: true, resetQuestion: true }, 4: { addOptions: 4 } },
  5: { 1: { mode: "choice-text", optionCount: 5 }, 2: { addOptions: 3 }, 3: { resetQuestion: true }, 4: { resetQuestion: true }, 5: { resetQuestion: true } },
  6: { 1: { mode: "choice-text", optionCount: 6 }, 2: { addOptions: 4 }, 3: { resetQuestion: true }, 4: { resetQuestion: true }, 5: { resetQuestion: true } },
  7: { 1: { mode: "choice-text", optionCount: 6 }, 3: { addOptions: 3 } },
  8: { 1: { mode: "choice-text", optionCount: 6 }, 2: { mode: "match-pairs", optionCount: 12, pairCount: 6 }, 3: { mode: "short-answer", optionCount: 0, pairCount: 0, resetQuestion: true }, 4: { resetQuestion: true }, 5: { resetQuestion: true } },
  9: { 1: { mode: "choice-text", optionCount: 6 }, 2: { replaceOptions: true, resetQuestion: true }, 3: { replaceOptions: true, resetQuestion: true }, 4: { optionCount: 13, replaceOptions: true, resetQuestion: true }, 5: { replaceOptions: true, resetQuestion: true } },
  10: { 1: { mode: "choice-text", optionCount: 6 }, 2: { addOptions: 4 }, 3: { mode: "number-grid", optionCount: 16, rows: 4, columns: 4, resetQuestion: true }, 4: { resetQuestion: true }, 5: { resetQuestion: true } },
  11: { 1: { mode: "choice-text", optionCount: 6 }, 3: { addOptions: 4 } },
  12: { 1: { mode: "choice-text", optionCount: 6 }, 2: { addOptions: 4 }, 3: { mode: "short-answer", optionCount: 0, resetQuestion: true } },
  13: { 1: { mode: "draw-over-image", optionCount: 0, promptImage: true }, 3: { promptImage: true, resetQuestion: true }, 5: { promptImage: true, resetQuestion: true } },
  14: { 1: { mode: "categorize-images", optionCount: 18, categories: 3, imageAspect: "square" } },
  15: { 1: { mode: "timeline", optionCount: 7 }, 2: { resetQuestion: true, replaceItems: true }, 3: { optionCount: 8, reorder: true, resetQuestion: true, replaceItems: true }, 4: { reorder: true, resetQuestion: true, replaceItems: true }, 5: { reorder: true, resetQuestion: true, replaceItems: true } },
  16: { 1: { mode: "short-answer", optionCount: 0 } },
  17: { 1: { mode: "image-sequence", optionCount: 7, imageAspect: "square" } },
  18: { 1: { mode: "choice-image", optionCount: 10, imageAspect: "square" } },
  19: { 1: { mode: "short-answer", optionCount: 0 } },
  20: { 1: { mode: "short-answer", optionCount: 0 } },
  21: { 1: { mode: "match-pairs", optionCount: 24, pairCount: 12, imageAspect: "6 / 5" } },
  22: { 1: { mode: "short-answer", optionCount: 0 } },
  23: { 1: { mode: "image-grid", optionCount: 12, rows: 3, columns: 4, imageAspect: "square" } },
  24: { 1: { mode: "choice-text", optionCount: 6, blankOption: true } },
  25: { 1: { mode: "short-answer", optionCount: 0 } },
  26: { 1: { mode: "image-sequence", optionCount: 6, imageAspect: "square" } },
  27: { 1: { mode: "text-sequence", optionCount: 24 } },
  28: { 1: { mode: "compose-image", optionCount: 6, promptImage: true, imageAspect: "square" } },
  29: { 1: { mode: "choice-text", optionCount: 6 } },
  30: { 1: { mode: "image-sequence", optionCount: 2, imageAspect: "square" } },
  31: { 1: { mode: "number-stepper", optionCount: 0 } },
  32: { 1: { mode: "memory-number", optionCount: 0, promptImage: true } },
  33: { 1: { mode: "short-answer", optionCount: 0 } },
  34: { 1: { mode: "short-answer", optionCount: 0 }, 2: { resetQuestion: true }, 3: { resetQuestion: true }, 4: { resetQuestion: true }, 5: { resetQuestion: true } },
  35: { 1: { mode: "video", optionCount: 0 } },
  36: { 1: { mode: "short-answer", optionCount: 0 } },
};

const baseFormat = Object.freeze({
  mode: "short-answer",
  optionCount: 0,
  promptImage: false,
  rows: 0,
  columns: 0,
  categories: 0,
  pairCount: 0,
  reorder: false,
  blankOption: false,
  imageAspect: "auto",
});

export const SPECIAL_ROUNDS = Object.freeze({
  "00": Object.freeze({ kind: "blank", title: "00", question: "" }),
  "0": Object.freeze({
    kind: "host-instructions",
    title: "0",
    question: "Hello, gameshow contestants!",
    body: "Write one true fact about yourself, then write one lie about each of the other two contestants and one lie about Lillie. Send each lie to the person it is about. When all three lies about you arrive, confirm they are lies. Then send Lillie your true statement and all three lies about you, in a random order, without revealing which one is true.",
  }),
});

export const ROUND_IDS = Object.freeze(["00", "0", ...Array.from({ length: 36 }, (_, index) => String(index + 1).padStart(2, "0"))]);

export function resolveRoundFormat(roundId, difficulty = 1) {
  const roundNumber = Number.parseInt(roundId, 10);
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > 36) return { ...baseFormat };

  const rules = ROUND_RULES[roundNumber] || {};
  const targetDifficulty = Math.max(1, Math.min(5, Number(difficulty) || 1));
  const format = { ...baseFormat };

  for (let level = 1; level <= targetDifficulty; level += 1) {
    const patch = rules[level];
    if (!patch) continue;
    const { addOptions = 0, replaceOptions, resetQuestion, replaceItems, ...settings } = patch;
    Object.assign(format, settings);
    if (addOptions) format.optionCount += addOptions;
  }

  return format;
}

export const MODE_NAMES = Object.freeze({
  "choice-text": "Text choices",
  "choice-image": "Image choices",
  "choice-image-wide": "Wide image choices",
  "short-answer": "Host-entered answer",
  "number-grid": "4 x 4 number grid",
  "draw-over-image": "Draw over image",
  "categorize-images": "Sort into three groups",
  timeline: "Order the timeline",
  "match-pairs": "Match pairs",
  "image-sequence": "Images, one at a time",
  "text-sequence": "Texts, one at a time",
  "image-grid": "4 x 3 image selection",
  "compose-image": "Place images on the picture",
  "number-stepper": "Changeable number",
  "memory-number": "Reveal image, then changeable number",
  video: "Video prompt",
});

export function isChoiceMode(mode) {
  return ["choice-text", "choice-image", "choice-image-wide", "number-grid", "image-grid"].includes(mode);
}
