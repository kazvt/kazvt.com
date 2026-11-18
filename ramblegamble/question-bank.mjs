export const QUESTION_BANK_SESSION_KEY = "ramblegamble.host-questions.v1";

export function normalizeQuestionBank(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry.text !== "string") return [];
    const text = entry.text.trim();
    if (!text) return [];
    const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : `question-${index + 1}`;
    return [{ id, text }];
  });
}

export function readSessionQuestionBank(storage) {
  try {
    const session = storage ?? globalThis.sessionStorage;
    return normalizeQuestionBank(JSON.parse(session.getItem(QUESTION_BANK_SESSION_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function writeSessionQuestionBank(questions, storage) {
  const normalized = normalizeQuestionBank(questions);
  const session = storage ?? globalThis.sessionStorage;
  session.setItem(QUESTION_BANK_SESSION_KEY, JSON.stringify(normalized));
  return normalized;
}

export function createQuestionPicker(random = Math.random) {
  let signature = null;
  let bag = [];

  return (questions) => {
    const bank = normalizeQuestionBank(questions);
    const nextSignature = JSON.stringify(bank);
    if (nextSignature !== signature) {
      signature = nextSignature;
      bag = bank.map((_, index) => index);
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const value = Number(random());
        const normalized = Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
        const swap = Math.floor(normalized * (index + 1));
        [bag[index], bag[swap]] = [bag[swap], bag[index]];
      }
    }

    while (bag.length) {
      const question = bank[bag.pop()];
      if (question) return question.text;
    }
    return "";
  };
}
