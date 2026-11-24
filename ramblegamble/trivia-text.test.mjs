import assert from "node:assert/strict";
import test from "node:test";
import { decodeTriviaBytes, exportTriviaText, parseTriviaText } from "./trivia-text.mjs";

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

  const headerless = parseTriviaText("What is 2 + 2?,4\nCapital of France?,Paris\n");
  assert.deepEqual(headerless.rounds["01"][1].acceptedAnswers, ["4"]);
  assert.deepEqual(headerless.rounds["02"][1].acceptedAnswers, ["Paris"]);

  const quizletStyle = parseTriviaText("What is 2 + 2? - 4\nCapital of France? - Paris\n");
  assert.deepEqual(quizletStyle.rounds["01"][1].acceptedAnswers, ["4"]);
  assert.deepEqual(quizletStyle.rounds["02"][1].acceptedAnswers, ["Paris"]);
});

test("delimited difficulty rows group by round, add tier choices, and accept separate option columns", () => {
  const csv = parseTriviaText(
    "Round,Question,Difficulty,Answers,Correct,Add\n" +
    "03,Pick a color?,1,Red|Blue,1,false\n" +
    "03,Pick a color?,2,Green|Gold,3,true\n",
  );
  assert.deepEqual(csv.rounds["03"][1].options.map((option) => option.label), ["Red", "Blue"]);
  assert.deepEqual(csv.rounds["03"][2].options.map((option) => option.label), ["Red", "Blue", "Green", "Gold"]);
  assert.equal(csv.rounds["03"][2].options[2].correct, true);
  assert.deepEqual(csv.rounds["03"][3].options.map((option) => option.label), ["Red", "Blue", "Green", "Gold"]);

  const columns = parseTriviaText("Question,Option 1,Option 2,Correct answer\nPick one?,A,B,B\n");
  assert.deepEqual(columns.rounds["01"][1].options.map((option) => option.label), ["A", "B"]);
  assert.equal(columns.rounds["01"][1].options[1].correct, true);
});

test("question headers, correct-answer prose, no-choice aliases, and full-width digits are forgiving", () => {
  const imported = parseTriviaText([
    "Ｑ０３: Pick an answer?",
    "Difficulty 1:",
    "- Alpha",
    "- Beta",
    "Correct answer: B",
    "Difficulty 5 (no MCQ):",
    "Answer: The written response",
  ].join("\n"));
  assert.equal(imported.rounds["03"][1].question, "Pick an answer?");
  assert.equal(imported.rounds["03"][1].options[1].correct, true);
  assert.equal(imported.rounds["03"][5].mode, "short-answer");
  assert.deepEqual(imported.rounds["03"][5].acceptedAnswers, ["The written response"]);
});

test("human labels, parenthesized add notes, and short-answer lines are interpreted", () => {
  const imported = parseTriviaText(`
Q: Which answer stays with the question?
Difficulty: 1
Option A: Alpha
Option B: Beta (correct)
Level: 2 (add these)
Choice C: Gamma
Difficulty: 5 (no multiple choice)
Answer: A written response
`);
  const round = imported.rounds["01"];
  assert.deepEqual(round[1].options.map((option) => option.label), ["Alpha", "Beta"]);
  assert.equal(round[1].options[1].correct, true);
  assert.deepEqual(round[2].options.map((option) => option.label), ["Alpha", "Beta", "Gamma"]);
  assert.deepEqual(round[4].options.map((option) => option.label), ["Alpha", "Beta", "Gamma"]);
  assert.equal(round[5].mode, "short-answer");
  assert.deepEqual(round[5].acceptedAnswers, ["A written response"]);

  const simple = parseTriviaText("Question: What is the answer?\nAnswer: Forty two");
  assert.equal(simple.rounds["01"][1].mode, "short-answer");
  assert.deepEqual(simple.rounds["01"][1].acceptedAnswers, ["Forty two"]);

  const parenthesized = parseTriviaText("Round 09: Another question?\n1:\n- Base\n2 (append these):\n- Added\n");
  assert.deepEqual(parenthesized.rounds["09"][2].options.map((option) => option.label), ["Base", "Added"]);
});

test("CSV handles multiline quoted cells and lettered answer columns", () => {
  const imported = parseTriviaText(
    'Question,Option A,Option B,Correct Answer\n"A question\nwith a second line?",First,Second,B\n',
  );
  assert.equal(imported.rounds["01"][1].question, "A question\nwith a second line?");
  assert.deepEqual(imported.rounds["01"][1].options.map((option) => option.label), ["First", "Second"]);
  assert.equal(imported.rounds["01"][1].options[1].correct, true);
});

test("BOM-marked UTF-16 spreadsheet text decodes without losing non-ASCII answers", () => {
  const source = "Question,Answer\nWhat is the word?,Café\n";
  const bytes = [0xff, 0xfe];
  for (const character of source) {
    const code = character.charCodeAt(0);
    bytes.push(code & 0xff, code >> 8);
  }
  const decoded = decodeTriviaBytes(new Uint8Array(bytes));
  const imported = parseTriviaText(decoded);
  assert.deepEqual(imported.rounds["01"][1].acceptedAnswers, ["Café"]);
});

test("generic JSON question arrays accept common prompt, option, and key aliases", () => {
  const imported = parseTriviaText(JSON.stringify({
    questions: [{ prompt: "What is 2 + 2?", choices: ["3", "4"], correctAnswer: "B" }],
  }));
  assert.equal(imported.rounds["01"][1].question, "What is 2 + 2?");
  assert.deepEqual(imported.rounds["01"][1].options.map((option) => option.label), ["3", "4"]);
  assert.equal(imported.rounds["01"][1].options[1].correct, true);

  const objectChoices = parseTriviaText(JSON.stringify({
    cards: [{ questionText: "Choose one", answers: [{ text: "Wrong" }, { label: "Right", isCorrect: true }] }],
  }));
  assert.equal(objectChoices.rounds["01"][1].options[1].correct, true);

  const topLevelArray = parseTriviaText(JSON.stringify([
    { prompt: "An array-wrapped question?", options: ["No", "Yes"], correct: "B" },
  ]));
  assert.equal(topLevelArray.rounds["01"][1].question, "An array-wrapped question?");
  assert.equal(topLevelArray.rounds["01"][1].options[1].correct, true);

  const indexedCorrect = parseTriviaText(JSON.stringify({
    questions: [{ question: "Which one?", options: ["First", "Second"], correctIndex: 0 }],
  }));
  assert.equal(indexedCorrect.rounds["01"][1].options[0].correct, true);

  const boundedAttempts = parseTriviaText(JSON.stringify({ questions: [
    { question: "Guess the code", mode: "number-grid", numberCode: "0042", maxGuesses: 2 },
  ] }));
  assert.equal(boundedAttempts.rounds["01"][1].guessLimit, 2);

  const tiers = parseTriviaText(JSON.stringify({ questions: [
    { round: 4, question: "Tiered choices?", difficulty: 1, options: ["A", "B"], answer: "B" },
    { round: 4, question: "Tiered choices?", difficulty: 2, options: ["C"], add: "add these" },
  ] }));
  assert.deepEqual(tiers.rounds["04"][1].options.map((option) => option.label), ["A", "B"]);
  assert.equal(tiers.rounds["04"][1].options[1].correct, true);
  assert.deepEqual(tiers.rounds["04"][2].options.map((option) => option.label), ["A", "B", "C"]);
  assert.deepEqual(tiers.rounds["04"][3].options.map((option) => option.label), ["A", "B", "C"]);
});

test("JSON text export round-trips modes, tier fields, correct answers, media references, and bank entries", () => {
  const data = {
    rounds: {
      "03": { 1: {
      question: "Pick one?", mode: "choice-text", optionCount: 2,
      options: [{ label: "A", image: "", asset: "asset-one", correct: true }, { label: "B", image: "", asset: "", correct: false }],
      acceptedAnswers: ["Alternate"], subtitle: "A hint", promptImage: "", promptAsset: "asset-one",
      items: [], pairs: [], categories: [], videoUrl: "", numberValue: 0, numberVisible: false,
      imageVisible: true, backgroundImage: "", drawing: "", assignments: [],
      selectionRule: "all", requiredCorrectCount: 2, numberCode: "0042", guessLimit: 2,
      } },
      "28": { 1: {
        question: "Place the objects", mode: "compose-image", optionCount: 6,
        items: [{ label: "Pixel", image: "", asset: "asset-two", x: 8, y: 8 }],
        placements: [{ itemIndex: 0, x: 16, y: 24 }, { itemIndex: 0, x: 72, y: 48 }],
        options: [], acceptedAnswers: [], pairs: [], categories: [], videoUrl: "", numberValue: 0,
        imageVisible: true, backgroundImage: "", drawing: "", assignments: [],
      } },
    },
    questionBank: [{ id: "bank-1", text: "Ask everyone?" }],
    media: { "asset-one": "data:image/png;base64,aGVsbG8=", "asset-two": "data:image/png;base64,cGl4ZWw=" },
  };
  const parsed = parseTriviaText(exportTriviaText(data));
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.rounds, data.rounds);
  assert.deepEqual(parsed.questionBank, data.questionBank);
  assert.deepEqual(parsed.media, data.media);
  assert.deepEqual(parsed.rounds["28"][1].placements, data.rounds["28"][1].placements);

  const clamped = parseTriviaText(JSON.stringify({ rounds: { "10": { 3: { mode: "number-grid", guessLimit: 9 } } } }));
  assert.equal(clamped.rounds["10"][3].guessLimit, 4);
});

test("multiple correct answers and selection rules import from human text and JSON", () => {
  const human = parseTriviaText(`
Round 09: Select the listed answers
Difficulty 4:
Mode: multiple choice
Selection rule: require all correct answers
Required selections: 2
Options:
- [x] First answer
- [x] Second answer
- Third answer
Difficulty 5:
Selection rule: one of the correct answers
`);
  assert.equal(human.rounds["09"][4].selectionRule, "all");
  assert.equal(human.rounds["09"][4].requiredCorrectCount, 2);
  assert.deepEqual(human.rounds["09"][4].options.filter((option) => option.correct).map((option) => option.label), ["First answer", "Second answer"]);
  assert.equal(human.rounds["09"][5].selectionRule, "any");

  const json = parseTriviaText(JSON.stringify({ questions: [{
    round: 11, difficulty: 2, question: "Pick both", options: ["A", "B", "C"],
    correctAnswers: ["A", "B"], selectionMode: "all", requiredSelections: 2,
  }] }));
  assert.equal(json.rounds["11"][2].selectionRule, "all");
  assert.equal(json.rounds["11"][2].requiredCorrectCount, 2);
  assert.deepEqual(json.rounds["11"][2].options.filter((option) => option.correct).map((option) => option.label), ["A", "B"]);
});

test("number-grid answer codes import as text and preserve leading zeroes", () => {
  const imported = parseTriviaText(`
Round 10: Guess the code
Difficulty 3:
Mode: 4x4 number grid
Secret number: 0042
`);
  assert.equal(imported.rounds["10"][3].mode, "number-grid");
  assert.equal(imported.rounds["10"][3].numberCode, "0042");
  assert.equal(imported.rounds["10"][3].guessLimit, 4);

  const customLimit = parseTriviaText(`
Round 10: Guess the code
Difficulty 3:
Mode: 4x4 number grid
Secret number: 0042
Maximum guesses: 2
`);
  assert.equal(customLimit.rounds["10"][3].guessLimit, 2);

  const delimited = parseTriviaText("Question,Mode,Secret Number\nGuess the code,number grid,0071\n");
  assert.equal(delimited.rounds["01"][1].numberCode, "0071");
  const delimitedLimit = parseTriviaText("Question,Mode,Secret Number,Max Guesses\nGuess the code,number grid,0071,3\n");
  assert.equal(delimitedLimit.rounds["01"][1].guessLimit, 3);
});

test("empty or unrelated files return a visible diagnostic instead of an empty successful import", () => {
  assert.match(parseTriviaText("\n ").errors[0], /empty/i);
  assert.match(parseTriviaText("some random notes without question structure").errors[0], /No questions were recognized/i);
});
