import assert from "node:assert/strict";
import test from "node:test";
import { isFourDigitCode, matchesCorrectSelection, scoreFourDigitGuess } from "./trivia-game.mjs";

test("four-digit codes preserve leading zeroes and reject incomplete or non-digit values", () => {
  assert.equal(isFourDigitCode("0042"), true);
  assert.equal(isFourDigitCode("42"), false);
  assert.equal(isFourDigitCode("12a4"), false);
});

test("number guesses mark exact positions green, misplaced digits yellow, and absent digits grey", () => {
  assert.deepEqual(scoreFourDigitGuess("1234", "1329"), ["green", "yellow", "yellow", "grey"]);
  assert.deepEqual(scoreFourDigitGuess("1234", "1234"), ["green", "green", "green", "green"]);
  assert.deepEqual(scoreFourDigitGuess("1234", "5678"), ["grey", "grey", "grey", "grey"]);
});

test("duplicate digits are only marked yellow as many times as they occur in the secret", () => {
  assert.deepEqual(scoreFourDigitGuess("1123", "1111"), ["green", "yellow", "grey", "grey"]);
  assert.deepEqual(scoreFourDigitGuess("1001", "1100"), ["green", "yellow", "yellow", "green"]);
  assert.equal(scoreFourDigitGuess("1234", "123"), null);
});

test("all-correct selection requires exactly the marked options", () => {
  assert.equal(matchesCorrectSelection([1], [1, 4]), false);
  assert.equal(matchesCorrectSelection([1, 4], [1, 4]), true);
  assert.equal(matchesCorrectSelection([1, 4, 5], [1, 4]), false);
  assert.equal(matchesCorrectSelection([1, 1], [1]), false);
  assert.equal(matchesCorrectSelection([1], []), false);
});
