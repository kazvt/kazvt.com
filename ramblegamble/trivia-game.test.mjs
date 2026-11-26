import assert from "node:assert/strict";
import test from "node:test";
import { compareNumberGuess, hasAuthoredTriviaContent, isFourDigitCode, matchesCorrectSelection, normalizeGuessLimit, scoreFourDigitGuess } from "./trivia-game.mjs";

test("blank round templates stay blank until the host adds visible content", () => {
  assert.equal(hasAuthoredTriviaContent({
    question: "", subtitle: "", promptImage: "", promptAsset: "", videoUrl: "",
    options: Array.from({ length: 6 }, () => ({ label: "", image: "", asset: "", correct: false })),
    items: [], pairs: [], categories: ["Group 1", "Group 2", "Group 3"],
    assignments: [], numberValue: 0, numberVisible: false, numberCode: "", acceptedAnswers: [],
  }), false);
  assert.equal(hasAuthoredTriviaContent({ items: [{ label: "", image: "", asset: "stored-image" }] }), true);
  assert.equal(hasAuthoredTriviaContent({ question: "  What is this?  " }), true);
  assert.equal(hasAuthoredTriviaContent({ options: [{ label: "", image: "/berry.png" }] }), true);
  assert.equal(hasAuthoredTriviaContent({ categories: ["Fruit", "Group 2", "Group 3"] }), true);
  assert.equal(hasAuthoredTriviaContent({ numberVisible: true, numberValue: 0 }), true);
});

test("four-digit codes preserve leading zeroes and reject incomplete or non-digit values", () => {
  assert.equal(isFourDigitCode("0042"), true);
  assert.equal(isFourDigitCode("42"), false);
  assert.equal(isFourDigitCode("12a4"), false);
});

test("guess limit defaults to four and only allows a lower positive attempt count", () => {
  assert.equal(normalizeGuessLimit(undefined), 4);
  assert.equal(normalizeGuessLimit(""), 4);
  assert.equal(normalizeGuessLimit(3), 3);
  assert.equal(normalizeGuessLimit(1.9), 1);
  assert.equal(normalizeGuessLimit(0), 1);
  assert.equal(normalizeGuessLimit(8), 4);
  assert.equal(normalizeGuessLimit("invalid"), 4);
});

test("changeable-number rounds give higher/lower feedback and validate numeric guesses", () => {
  assert.equal(compareNumberGuess(42, "17"), "higher");
  assert.equal(compareNumberGuess(42, "68"), "lower");
  assert.equal(compareNumberGuess(42, "42"), "correct");
  assert.equal(compareNumberGuess(0, "-1"), "higher");
  assert.equal(compareNumberGuess(17.5, "17.25"), "higher");
  assert.equal(compareNumberGuess(17.5, ""), null);
  assert.equal(compareNumberGuess(17.5, "not a number"), null);
  assert.equal(compareNumberGuess(Infinity, "1"), null);
});

test("number guesses mark exact positions green, misplaced digits yellow, and absent digits grey", () => {
  assert.deepEqual(scoreFourDigitGuess("1234", "1329"), ["green", "yellow", "yellow", "grey"]);
  assert.deepEqual(scoreFourDigitGuess("1234", "1234"), ["green", "green", "green", "green"]);
  assert.deepEqual(scoreFourDigitGuess("1234", "5678"), ["grey", "grey", "grey", "grey"]);
});

test("duplicate digits are only marked yellow as many times as they occur in the secret", () => {
  assert.deepEqual(scoreFourDigitGuess("1213", "1112"), ["green", "grey", "green", "yellow"]);
  assert.deepEqual(scoreFourDigitGuess("1001", "1100"), ["green", "yellow", "green", "yellow"]);
  assert.equal(scoreFourDigitGuess("1234", "123"), null);
});

test("all-correct selection requires exactly the marked options", () => {
  assert.equal(matchesCorrectSelection([1], [1, 4]), false);
  assert.equal(matchesCorrectSelection([1, 4], [1, 4]), true);
  assert.equal(matchesCorrectSelection([1, 4, 5], [1, 4]), false);
  assert.equal(matchesCorrectSelection([1, 1], [1]), false);
  assert.equal(matchesCorrectSelection([1], []), false);
});
