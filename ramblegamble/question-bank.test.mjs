import assert from "node:assert/strict";
import test from "node:test";
import {
  QUESTION_BANK_SESSION_KEY,
  createQuestionPicker,
  normalizeQuestionBank,
  readSessionQuestionBank,
  writeSessionQuestionBank,
} from "./question-bank.mjs";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("question bank keeps only non-empty text and supplies stable ids", () => {
  assert.deepEqual(normalizeQuestionBank([
    { id: " a ", text: "  First question?  " },
    { text: "   " },
    null,
    { text: "Second question?" },
  ]), [
    { id: "a", text: "First question?" },
    { id: "question-4", text: "Second question?" },
  ]);
});

test("question bank writes and rehydrates from session storage", () => {
  const storage = memoryStorage();
  writeSessionQuestionBank([{ id: "q1", text: "Saved for this session?" }], storage);
  assert.deepEqual(readSessionQuestionBank(storage), [{ id: "q1", text: "Saved for this session?" }]);
  assert.ok(storage.getItem(QUESTION_BANK_SESSION_KEY));
});

test("picker uses every current question once, returns empty for an empty bank, and resets after edits", () => {
  const pick = createQuestionPicker(() => 0);
  const bank = [
    { id: "q1", text: "First" },
    { id: "q2", text: "Second" },
    { id: "q3", text: "Third" },
  ];
  const firstRound = [pick(bank), pick(bank), pick(bank)];
  assert.deepEqual(new Set(firstRound), new Set(["First", "Second", "Third"]));
  assert.equal(pick(bank), "");
  assert.equal(pick([{ id: "q4", text: "New question" }]), "New question");
  assert.equal(pick([]), "");
});
