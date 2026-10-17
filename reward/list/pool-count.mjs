const SMALL_COUNT_WORDS = [
  "ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"
];

export function formatPoolCount(count) {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("The pool count must be a non-negative safe integer.");
  }
  return SMALL_COUNT_WORDS[count] ?? String(count);
}
