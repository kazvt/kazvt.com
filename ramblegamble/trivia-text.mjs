import { MODE_NAMES, isChoiceMode, resolveRoundFormat } from "./trivia-data.js";

export const TRIVIA_EXPORT_FORMAT = "kazvt-ramble-gamble-trivia";
export const TRIVIA_EXPORT_VERSION = 1;

const ROUND_FIELDS = new Set([
  "question", "subtitle", "promptImage", "promptAsset", "mode", "optionCount", "acceptedAnswers",
  "options", "items", "pairs", "categories", "videoUrl", "numberValue", "numberVisible",
  "imageVisible", "backgroundImage", "drawing", "assignments",
]);

const MODE_ALIASES = new Map([
  ["choice", "choice-text"], ["multiple choice", "choice-text"], ["multiple-choice", "choice-text"],
  ["mc", "choice-text"], ["mcq", "choice-text"], ["text choices", "choice-text"], ["text choice", "choice-text"],
  ["image choice", "choice-image"], ["image choices", "choice-image"], ["picture choices", "choice-image"],
  ["wide image choices", "choice-image-wide"], ["wide picture choices", "choice-image-wide"],
  ["short answer", "short-answer"], ["free response", "short-answer"], ["free-response", "short-answer"],
  ["written answer", "short-answer"], ["open answer", "short-answer"], ["no multiple choice", "short-answer"],
  ["number grid", "number-grid"], ["4x4 number grid", "number-grid"], ["image grid", "image-grid"],
  ["timeline", "timeline"], ["order the timeline", "timeline"], ["matching", "match-pairs"],
  ["match pairs", "match-pairs"], ["pair matching", "match-pairs"], ["image sequence", "image-sequence"],
  ["text sequence", "text-sequence"], ["categorize images", "categorize-images"], ["categorise images", "categorize-images"],
  ["sort images", "categorize-images"], ["draw over image", "draw-over-image"], ["drawing", "draw-over-image"],
  ["compose image", "compose-image"], ["number stepper", "number-stepper"], ["memory number", "memory-number"],
  ["video", "video"], ["video prompt", "video"],
]);

const LEVEL_WORDS = new Map([
  ["one", 1], ["first", 1], ["two", 2], ["second", 2], ["three", 3], ["third", 3],
  ["four", 4], ["fourth", 4], ["five", 5], ["fifth", 5],
  ["easy", 1], ["easiest", 1], ["beginner", 1], ["simple", 1],
  ["medium", 3], ["intermediate", 3], ["normal", 3],
  ["hard", 5], ["hardest", 5], ["expert", 5], ["advanced", 5],
]);

function cleanText(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeMode(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
  if (MODE_NAMES[raw]) return raw;
  if (MODE_NAMES[raw.replaceAll(" ", "-")]) return raw.replaceAll(" ", "-");
  return MODE_ALIASES.get(raw) || "";
}

function normalizeId(value) {
  const number = Number.parseInt(String(value).replace(/\D/g, ""), 10);
  return Number.isInteger(number) && number >= 1 && number <= 36 ? String(number).padStart(2, "0") : "";
}

function safeString(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function sanitizeRoundDrafts(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const rounds = {};
  for (const [rawRound, rawLevels] of Object.entries(value)) {
    const round = normalizeId(rawRound);
    if (!round || !rawLevels || typeof rawLevels !== "object" || Array.isArray(rawLevels)) continue;
    const levels = {};
    for (const [rawLevel, rawDraft] of Object.entries(rawLevels)) {
      const level = Number.parseInt(rawLevel, 10);
      if (!Number.isInteger(level) || level < 1 || level > 5 || !rawDraft || typeof rawDraft !== "object" || Array.isArray(rawDraft)) continue;
      const draft = {};
      for (const [field, item] of Object.entries(rawDraft)) {
        if (!ROUND_FIELDS.has(field)) continue;
        if (["question", "subtitle", "promptImage", "promptAsset", "videoUrl", "backgroundImage", "drawing"].includes(field)) {
          draft[field] = safeString(item);
        } else if (field === "mode") {
          const mode = normalizeMode(item);
          if (mode) draft.mode = mode;
        } else if (field === "optionCount") {
          const count = Number(item);
          if (Number.isFinite(count)) draft.optionCount = Math.max(0, Math.min(24, Math.trunc(count)));
        } else if (["acceptedAnswers", "categories"].includes(field)) {
          if (Array.isArray(item)) draft[field] = item.map(safeString);
        } else if (field === "options" && Array.isArray(item)) {
          draft.options = item.filter((option) => option && typeof option === "object").map((option) => ({
            label: safeString(option.label), image: safeString(option.image), asset: safeString(option.asset), correct: option.correct === true,
          }));
        } else if (field === "items" && Array.isArray(item)) {
          draft.items = item.filter((entry) => entry && typeof entry === "object").map((entry) => ({
            label: safeString(entry.label), image: safeString(entry.image), x: finiteOr(entry.x, 8), y: finiteOr(entry.y, 8),
          }));
        } else if (field === "pairs" && Array.isArray(item)) {
          draft.pairs = item.filter((entry) => entry && typeof entry === "object").map((entry) => ({
            left: safeString(entry.left), leftImage: safeString(entry.leftImage), right: safeString(entry.right),
          }));
        } else if (field === "assignments" && Array.isArray(item)) {
          draft.assignments = item.map((assignment) => Number.isInteger(assignment) && assignment >= 0 && assignment < 3 ? assignment : null);
        } else if (["numberVisible", "imageVisible"].includes(field)) {
          draft[field] = item === true;
        } else if (field === "numberValue") {
          draft.numberValue = finiteOr(item, 0);
        }
      }
      levels[level] = draft;
    }
    if (Object.keys(levels).length) rounds[round] = levels;
  }
  return rounds;
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeQuestionBank(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    const text = typeof entry === "string" ? entry.trim() : safeString(entry?.text).trim();
    if (!text) return [];
    return [{ id: safeString(entry?.id).trim() || `imported-${index + 1}`, text }];
  });
}

export function exportTriviaText({ rounds = {}, questionBank = [], media = {} } = {}) {
  const payload = {
    format: TRIVIA_EXPORT_FORMAT,
    version: TRIVIA_EXPORT_VERSION,
    rounds: sanitizeRoundDrafts(rounds),
    questionBank: normalizeQuestionBank(questionBank),
    media: Object.fromEntries(Object.entries(media).filter(([, data]) => typeof data === "string" && /^data:image\/[a-z0-9.+-]+;base64,/i.test(data))),
  };
  return [
    "# KAZVT Ramble Gamble trivia export",
    "# UTF-8 plain text. The JSON below is the portable, round-trippable data.",
    "# You can also import informal question lists, numbered rounds, answer bullets, and difficulty tiers.",
    JSON.stringify(payload, null, 2),
    "",
  ].join("\n");
}

export function parseTriviaText(input) {
  const text = cleanText(input);
  if (!text.trim()) return { rounds: {}, questionBank: [], media: {}, warnings: [], errors: ["The file is empty."] };

  const json = extractJson(text);
  if (json.ok) {
    const parsed = parseJsonPayload(json.value);
    if (parsed) return parsed;
  }

  const delimited = parseDelimited(text);
  if (delimited) return delimited;
  return parseHumanText(text);
}

function extractJson(text) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last <= first) return { ok: false };
  try { return { ok: true, value: JSON.parse(text.slice(first, last + 1)) }; }
  catch { return { ok: false }; }
}

function parseJsonPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.format === TRIVIA_EXPORT_FORMAT && Number(value.version) !== TRIVIA_EXPORT_VERSION) {
    return { rounds: {}, questionBank: [], media: {}, warnings: [], errors: [`Unsupported trivia export version: ${value.version}.`] };
  }

  const roundsValue = value.rounds?.rounds || value.rounds || value.drafts?.rounds || value.drafts;
  if (roundsValue && typeof roundsValue === "object" && !Array.isArray(roundsValue)) {
    const rounds = sanitizeRoundDrafts(roundsValue);
    const questionBank = normalizeQuestionBank(value.questionBank || value.prompts || []);
    const media = value.media && typeof value.media === "object" && !Array.isArray(value.media) ? value.media : {};
    const invalidMedia = Object.values(media).filter((entry) => typeof entry !== "string" || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(entry)).length;
    return {
      rounds, questionBank, media,
      warnings: invalidMedia ? [`${invalidMedia} embedded image value(s) were not recognized and will be skipped.`] : [],
      errors: Object.keys(rounds).length || questionBank.length ? [] : ["The JSON contains no recognizable rounds or questions."],
    };
  }

  const questions = value.questions || value.cards || value.items;
  if (Array.isArray(questions)) return parseQuestionObjects(questions);
  return null;
}

function parseQuestionObjects(questions) {
  const rounds = {};
  const warnings = [];
  let generated = 1;
  for (const [index, item] of questions.entries()) {
    if (!item || typeof item !== "object") { warnings.push(`Question ${index + 1} was skipped because it was not an object.`); continue; }
    const round = normalizeId(item.round ?? item.id ?? item.number ?? item.questionNumber) || String(generated++).padStart(2, "0");
    const question = safeString(item.question ?? item.prompt ?? item.questionText ?? item.front ?? item.term ?? item.title ?? item.text).trim();
    if (!question) { warnings.push(`Entry ${index + 1} has no question text and was skipped.`); continue; }
    const difficulty = Math.max(1, Math.min(5, Number(item.difficulty ?? item.level ?? item.tier) || 1));
    const options = normalizeAnswerObjects(item.options ?? item.choices ?? item.answers);
    const acceptedAnswers = normalizeAnswerObjects(item.acceptedAnswers ?? item.accepted_answers ?? item.answer ?? item.back ?? item.definition);
    const mode = normalizeMode(item.mode ?? item.type ?? item.format) || (options.length > 1 ? "choice-text" : "short-answer");
    const correct = item.correct ?? item.correctAnswer ?? item.correct_answer ?? item.answerKey;
    if (options.length && correct != null) applyCorrectValues(options, normalizeAnswerObjects(correct));
    const roundDrafts = {};
    for (let level = 1; level <= 5; level += 1) {
      const levelOptions = level === difficulty ? options : [];
      roundDrafts[level] = {
        question, mode: level === difficulty ? mode : "short-answer",
        optionCount: level === difficulty ? levelOptions.length : 0,
        options: levelOptions,
        acceptedAnswers: level === difficulty ? acceptedAnswers : [],
      };
    }
    rounds[round] = roundDrafts;
  }
  return { rounds, questionBank: [], media: {}, warnings, errors: Object.keys(rounds).length ? [] : ["No usable question records were found."] };
}

function normalizeAnswerObjects(value) {
  if (Array.isArray(value)) return value.map((entry) => typeof entry === "string" ? entry.trim() : safeString(entry?.text ?? entry?.label ?? entry?.answer).trim()).filter(Boolean);
  if (typeof value === "string") return splitLooseList(value);
  return value == null ? [] : [safeString(value).trim()].filter(Boolean);
}

function parseDelimited(text) {
  const firstLine = text.split("\n", 1)[0];
  const delimiter = ["\t", ",", ";", "|"].sort((a, b) => countChar(firstLine, b) - countChar(firstLine, a))[0];
  if (!delimiter || countChar(firstLine, delimiter) < 1) return null;
  const rows = text.split("\n").map((line) => parseDelimitedRow(line, delimiter));
  const header = rows[0].map(normalizeHeader);
  const indexes = {};
  header.forEach((name, index) => { if (name) indexes[name] = index; });
  const questionColumn = findColumn(indexes, ["question", "prompt", "question text", "front", "term", "title", "text"]);
  const answerColumn = findColumn(indexes, ["answers", "options", "choices", "answer", "accepted answers", "back", "definition"]);
  if (questionColumn < 0 || answerColumn < 0) return null;

  const rounds = {};
  const warnings = [];
  let sequence = 1;
  for (const [rowIndex, row] of rows.slice(1).entries()) {
    if (!row.some((cell) => cell.trim())) continue;
    const question = String(row[questionColumn] || "").trim();
    if (!question) { warnings.push(`Row ${rowIndex + 2} has no question and was skipped.`); continue; }
    const round = normalizeId(getColumn(row, indexes, ["round", "round id", "question id", "number", "id"])) || String(sequence++).padStart(2, "0");
    const difficulty = Math.max(1, Math.min(5, Number(getColumn(row, indexes, ["difficulty", "level", "tier", "diff"])) || 1));
    const options = splitLooseList(row[answerColumn]);
    const correctValues = splitLooseList(getColumn(row, indexes, ["correct", "correct answer", "answer key", "correct answers"]));
    const accepted = splitLooseList(getColumn(row, indexes, ["accepted answers", "answer key", "correct answer"]));
    const mode = normalizeMode(getColumn(row, indexes, ["mode", "type", "template"])) || (options.length > 1 ? "choice-text" : "short-answer");
    if (isChoiceMode(mode)) applyCorrectValues(options.map((label) => ({ label, correct: false })), correctValues);
    const optionObjects = options.map((label) => ({ label, image: "", asset: "", correct: false }));
    applyCorrectValues(optionObjects, correctValues);
    const levels = {};
    for (let level = 1; level <= 5; level += 1) {
      levels[level] = {
        question,
        subtitle: getColumn(row, indexes, ["subtitle", "description", "hint"]),
        mode: level === difficulty ? mode : "short-answer",
        options: level === difficulty ? optionObjects : [],
        optionCount: level === difficulty ? optionObjects.length : 0,
        acceptedAnswers: level === difficulty ? accepted : [],
      };
    }
    rounds[round] = levels;
  }
  return { rounds, questionBank: [], media: {}, warnings, errors: Object.keys(rounds).length ? [] : ["No usable question rows were found."] };
}

function parseDelimitedRow(line, delimiter) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { fields.push(field.trim()); field = ""; }
    else field += character;
  }
  fields.push(field.trim());
  return fields;
}

function countChar(text, character) { return [...text].filter((entry) => entry === character).length; }
function normalizeHeader(value) { return String(value).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "); }
function findColumn(indexes, aliases) { for (const alias of aliases) if (Object.hasOwn(indexes, alias)) return indexes[alias]; return -1; }
function getColumn(row, indexes, aliases) { const column = findColumn(indexes, aliases); return column < 0 ? "" : String(row[column] || "").trim(); }
