import assert from "node:assert/strict";
import test from "node:test";
import { exportTriviaText, parseTriviaText } from "./trivia-text.mjs";

test("sample numbered difficulty format inherits, adds, replaces, and switches to short answer", () => {
  const imported = parseTriviaText(`
03: This is the question?
1:
  - one
  - two
2: [add these]
  - three
  - four
5: [no multiple choice]
  - final answer
`);

  assert.deepEqual(imported.errors, []);
  const round = imported.rounds["03"];
  assert.equal(round[1].question, "This is the question?");
  assert.deepEqual(round[1].options.map((option) => option.label), ["one", "two"]);
  assert.deepEqual(round[2].options.map((option) => option.label), ["one", "two", "three", "four"]);
  assert.deepEqual(round[3].options.map((option) => option.label), ["one", "two", "three", "four"]);
  assert.deepEqual(round[4].options.map((option) => option.label), ["one", "two", "three", "four"]);
  assert.equal(round[5].mode, "short-answer");
  assert.deepEqual(round[5].acceptedAnswers, ["final answer"]);
});

test("a non-additive difficulty replaces its answer set and common labels are understood", () => {
  const imported = parseTriviaText(`Round 07 - Name this place
Difficulty: easy
Type: multiple choice
Options:
A) First
B) Second (correct)
Level 3:
Answers: New 1 | New 2
Correct answer: 2
`);

  const round = imported.rounds["07"];
  assert.equal(round[1].mode, "choice-text");
  assert.deepEqual(round[1].options.map((option) => option.label), ["First", "Second"]);
  assert.equal(round[1].options[1].correct, true);
  assert.deepEqual(round[2].options.map((option) => option.label), ["First", "Second"]);
  assert.deepEqual(round[3].options.map((option) => option.label), ["New 1", "New 2"]);
  assert.equal(round[3].options[1].correct, true);
});

test("HTML spacing, wrapped lines, punctuation, and a host-question section are accepted", () => {
  const imported = parseTriviaText(`
&#x20;Round 12: A wrapped
question lives here?
1st difficulty (plus more):
- Alpha
- Beta

SESSION QUESTION BANK
- Ask the table?
- Another prompt!
`);
  assert.equal(imported.rounds["12"][1].question, "A wrapped question lives here?");
  assert.deepEqual(imported.rounds["12"][1].options.map((option) => option.label), ["Alpha", "Beta"]);
  assert.deepEqual(imported.questionBank.map((entry) => entry.text), ["Ask the table?", "Another prompt!"]);
});

test("common quoted CSV and tab-separated question/answer files import as short-answer rounds", () => {
  const csv = parseTriviaText('Question,Answer\n"Capital of Australia?",Canberra\n');
  assert.deepEqual(csv.rounds["01"][1].acceptedAnswers, ["Canberra"]);
  assert.equal(csv.rounds["01"][1].mode, "short-answer");

  const tsv = parseTriviaText("Question\tChoices\tCorrect\nPick one?\tRed|Blue|Green\tB\n");
  assert.deepEqual(tsv.rounds["01"][1].options.map((option) => option.label), ["Red", "Blue", "Green"]);
  assert.equal(tsv.rounds["01"][1].options[1].correct, true);
});

test("JSON text export round-trips modes, tier fields, correct answers, media references, and bank entries", () => {
  const data = {
    rounds: { "03": { 1: {
      question: "Pick one?", mode: "choice-text", optionCount: 2,
      options: [{ label: "A", image: "", asset: "asset-one", correct: true }, { label: "B", image: "", asset: "", correct: false }],
      acceptedAnswers: ["Alternate"], subtitle: "A hint", promptImage: "", promptAsset: "asset-one",
      items: [], pairs: [], categories: [], videoUrl: "", numberValue: 0, numberVisible: false,
      imageVisible: true, backgroundImage: "", drawing: "", assignments: [],
    } } },
    questionBank: [{ id: "bank-1", text: "Ask everyone?" }],
    media: { "asset-one": "data:image/png;base64,aGVsbG8=" },
  };
  const parsed = parseTriviaText(exportTriviaText(data));
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.rounds, data.rounds);
  assert.deepEqual(parsed.questionBank, data.questionBank);
  assert.deepEqual(parsed.media, data.media);
});

test("empty or unrelated files return a visible diagnostic instead of an empty successful import", () => {
  assert.match(parseTriviaText("\n ").errors[0], /empty/i);
  assert.match(parseTriviaText("some random notes without question structure").errors[0], /No questions were recognized/i);
});
