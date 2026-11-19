const FOUR_DIGITS = /^\d{4}$/;

export function isFourDigitCode(value) {
  return FOUR_DIGITS.test(String(value ?? ""));
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
