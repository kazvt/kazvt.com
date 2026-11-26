const FOUR_DIGITS = /^\d{4}$/;

export function hasAuthoredTriviaContent(content = {}) {
  const hasText = (value) => typeof value === "string" && value.trim().length > 0;
  const hasMedia = (value) => hasText(value);

  return hasText(content.question)
    || hasText(content.subtitle)
    || hasMedia(content.promptImage)
    || hasMedia(content.promptAsset)
    || hasMedia(content.videoUrl)
    || hasMedia(content.backgroundImage)
    || hasMedia(content.drawing)
    || hasText(content.numberCode)
    || content.numberVisible === true
    || (Number.isFinite(Number(content.numberValue)) && Number(content.numberValue) !== 0)
    || (Array.isArray(content.acceptedAnswers) && content.acceptedAnswers.some(hasText))
    || (Array.isArray(content.options) && content.options.some((option) =>
      hasText(option?.label) || hasMedia(option?.image) || hasMedia(option?.asset)))
    || (Array.isArray(content.items) && content.items.some((item) =>
      hasText(item?.label) || hasMedia(item?.image) || hasMedia(item?.asset)))
    || (Array.isArray(content.pairs) && content.pairs.some((pair) =>
      hasText(pair?.left) || hasMedia(pair?.leftImage) || hasText(pair?.right)))
    || (Array.isArray(content.categories) && content.categories.some((category, index) =>
      hasText(category) && category.trim() !== "Group " + (index + 1)))
    || (Array.isArray(content.assignments) && content.assignments.some((assignment) => assignment != null));
}

export function isFourDigitCode(value) {
  return FOUR_DIGITS.test(String(value ?? ""));
}

export function normalizeGuessLimit(value) {
  if (value == null || String(value).trim() === "") return 4;
  const count = Number(value);
  if (!Number.isFinite(count)) return 4;
  return Math.max(1, Math.min(4, Math.trunc(count)));
}

export function compareNumberGuess(answer, guess) {
  const rawGuess = String(guess ?? "").trim();
  if (!rawGuess) return null;
  const target = Number(answer);
  const attempt = Number(rawGuess);
  if (!Number.isFinite(target) || !Number.isFinite(attempt)) return null;
  if (attempt < target) return "higher";
  if (attempt > target) return "lower";
  return "correct";
}

// Score duplicate digits with Wordle's exact-first, then present-elsewhere rule.
export function scoreFourDigitGuess(secret, guess) {
  const target = String(secret ?? "");
  const attempt = String(guess ?? "");
  if (!isFourDigitCode(target) || !isFourDigitCode(attempt)) return null;

  const result = Array(4).fill("grey");
  const remaining = new Map();
  for (let index = 0; index < 4; index += 1) {
    if (attempt[index] === target[index]) result[index] = "green";
    else remaining.set(target[index], (remaining.get(target[index]) || 0) + 1);
  }
  for (let index = 0; index < 4; index += 1) {
    if (result[index] === "green") continue;
    const available = remaining.get(attempt[index]) || 0;
    if (available > 0) {
      result[index] = "yellow";
      remaining.set(attempt[index], available - 1);
    }
  }
  return result;
}

export function matchesCorrectSelection(selected, correct) {
  if (!Array.isArray(selected) || !Array.isArray(correct) || correct.length === 0) return false;
  if (new Set(selected).size !== selected.length || new Set(correct).size !== correct.length) return false;
  if (selected.some((index) => !Number.isInteger(index)) || correct.some((index) => !Number.isInteger(index))) return false;
  const selectedSet = new Set(selected);
  return selectedSet.size === correct.length && correct.every((index) => selectedSet.has(index));
}
