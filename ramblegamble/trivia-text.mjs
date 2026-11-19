import { MODE_NAMES, isChoiceMode, resolveRoundFormat } from "./trivia-data.js";

export const TRIVIA_EXPORT_FORMAT = "kazvt-ramble-gamble-trivia";
export const TRIVIA_EXPORT_VERSION = 1;

export function decodeTriviaBytes(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  return new TextDecoder("utf-8").decode(bytes);
}

const ROUND_FIELDS = new Set([
  "question", "subtitle", "promptImage", "promptAsset", "mode", "optionCount", "acceptedAnswers",
  "options", "items", "pairs", "categories", "videoUrl", "numberValue", "numberVisible",
  "imageVisible", "backgroundImage", "drawing", "assignments", "selectionRule", "requiredCorrectCount", "numberCode",
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
  ["one", 1], ["first", 1], ["1st", 1], ["two", 2], ["second", 2], ["2nd", 2], ["three", 3], ["third", 3], ["3rd", 3],
  ["four", 4], ["fourth", 4], ["4th", 4], ["five", 5], ["fifth", 5], ["5th", 5],
  ["easy", 1], ["easiest", 1], ["beginner", 1], ["simple", 1],
  ["medium", 3], ["intermediate", 3], ["normal", 3],
  ["hard", 5], ["hardest", 5], ["expert", 5], ["advanced", 5],
]);

function cleanText(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
    .replace(/[！-～]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
    .replace(/<br\s*\/?>/gi, "\n");
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

function normalizeSelectionRule(value) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (/^(?:all|both|all correct|all answers|require all|select all|every|every correct answer|all of them|multiple)$/.test(raw) || /\b(?:require|select|choose)\s+all\b|\b(?:both|every)\s+(?:correct\s+)?(?:answers?|options?|choices?)\b/.test(raw)) return "all";
  if (/^(?:any|one|one correct answer|any one|either|single|at least one|one of them)$/.test(raw) || /\b(?:any one|one of|either|at least one)\b/.test(raw)) return "any";
  return "";
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
        } else if (field === "selectionRule") {
          const rule = normalizeSelectionRule(item);
          if (rule) draft.selectionRule = rule;
        } else if (field === "requiredCorrectCount") {
          const count = Number(item);
          if (Number.isFinite(count)) draft.requiredCorrectCount = Math.max(0, Math.min(24, Math.trunc(count)));
        } else if (field === "numberCode") {
          draft.numberCode = safeString(item).replace(/\D/g, "").slice(0, 4);
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
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    try { return { ok: true, value: JSON.parse(trimmed) }; }
    catch { /* Continue with an embedded JSON object or the human-text parser. */ }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last <= first) return { ok: false };
  try { return { ok: true, value: JSON.parse(text.slice(first, last + 1)) }; }
  catch { return { ok: false }; }
}

function parseJsonPayload(value) {
  if (Array.isArray(value)) return parseQuestionObjects(value);
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

  const questions = value.questions || value.cards || value.items || (Array.isArray(value.rounds) ? value.rounds : null);
  if (Array.isArray(questions)) return parseQuestionObjects(questions);
  return null;
}

function parseQuestionObjects(questions) {
  const warnings = [];
  const grouped = new Map();
  let generated = 1;
  for (const [index, item] of questions.entries()) {
    if (!item || typeof item !== "object") { warnings.push(`Question ${index + 1} was skipped because it was not an object.`); continue; }
    const round = normalizeId(item.round ?? item.roundId ?? item.round_id ?? item.roundNumber ?? item.round_number ?? item.questionNumber ?? item.question_number ?? item.number ?? item.id) || String(generated++).padStart(2, "0");
    const question = safeString(item.question ?? item.prompt ?? item.questionText ?? item.front ?? item.term ?? item.title ?? item.text).trim();
    if (!question) { warnings.push(`Entry ${index + 1} has no question text and was skipped.`); continue; }
    const rawOptions = item.options ?? item.choices ?? item.answers ?? item.alternatives;
    const options = normalizeOptionObjects(rawOptions);
    const explicitAccepted = item.acceptedAnswers ?? item.accepted_answers ?? item.expectedAnswer ?? item.expected_answer;
    const answerValue = item.answer ?? item.back ?? item.definition;
    const acceptedAnswers = normalizeAnswerObjects(explicitAccepted ?? (options.length ? null : answerValue));
    const mode = normalizeMode(item.mode ?? item.type ?? item.format) || (options.length > 1 ? "choice-text" : "short-answer");
    const rawCorrect = item.correctAnswers ?? item.correct_answers ?? item.correctAnswer ?? item.correct_answer ?? item.answerKey ?? item.answer_key ?? item.correctOption ?? item.correct_option ?? item.correct ?? (options.length ? answerValue : null);
    const correct = typeof rawCorrect === "boolean" ? null : rawCorrect;
    const hasDifficulty = item.difficulty != null || item.level != null || item.tier != null;
    const rawDifficulty = item.difficulty ?? item.level ?? item.tier ?? 1;
    const parsedDifficulty = parseLevelValue(rawDifficulty) || Number(rawDifficulty) || 1;
    const difficulty = Math.max(1, Math.min(5, Math.trunc(parsedDifficulty)));
    const choiceOptions = options.map((option) => ({ ...option }));
    const correctValues = correct == null ? [] : normalizeAnswerObjects(correct);
    const correctIndexValue = item.correctAnswerIndex ?? item.correct_answer_index ?? item.correctOptionIndex ?? item.correct_option_index ?? item.answerIndex ?? item.answer_index ?? item.correctIndex ?? item.correct_index;
    if (correctIndexValue != null && Number.isInteger(Number(correctIndexValue))) {
      const correctIndex = Number(correctIndexValue);
      if (correctIndex >= 0 && correctIndex < choiceOptions.length) {
        choiceOptions.forEach((option, optionIndex) => { option.correct = optionIndex === correctIndex; });
        correctValues.length = 0;
      }
    } else if (choiceOptions.length && correctValues.length) applyCorrectValues(choiceOptions, correctValues);
    const bool = (value) => value === true || /^(?:true|yes|on|1)$/i.test(String(value ?? ""));
    const rawAdditive = item.additive ?? item.add ?? item.append ?? item.plus;
    const rawNoChoice = item.noMultipleChoice ?? item.no_multiple_choice ?? item.noMc ?? item.noMcq;
    const record = {
      question,
      subtitle: safeString(item.subtitle ?? item.description ?? item.hint),
      mode,
      explicitMode: Boolean(item.mode ?? item.type ?? item.format),
      options: choiceOptions,
      optionsPresent: rawOptions != null,
      acceptedAnswers,
      acceptedPresent: explicitAccepted != null || (!options.length && answerValue != null),
      correctValues,
      additive: bool(rawAdditive) || /\b(?:add|append|plus|additive)\b/i.test(String(rawAdditive ?? "")),
      noMultipleChoice: bool(rawNoChoice) || /\b(?:no|without)\s+(?:multiple[ -]?choice|mcq|mc)\b|\bshort[ -]?answer\b/i.test(String(rawNoChoice ?? "")),
      promptImage: safeString(item.promptImage ?? item.prompt_image ?? item.imageUrl),
      promptAsset: safeString(item.promptAsset ?? item.prompt_asset),
      videoUrl: safeString(item.videoUrl ?? item.video_url),
      backgroundImage: safeString(item.backgroundImage ?? item.background_image),
      numberValue: item.numberValue ?? item.number_value,
      numberVisible: item.numberVisible ?? item.number_visible,
      imageVisible: item.imageVisible ?? item.image_visible,
      drawing: item.drawing,
      categories: item.categories,
      items: item.items,
      pairs: item.pairs,
      assignments: item.assignments,
      optionCount: item.optionCount ?? item.option_count,
      selectionRule: normalizeSelectionRule(item.selectionRule ?? item.selection_rule ?? item.selectionMode ?? item.selection_mode ?? item.answerSelection ?? item.answer_selection ?? item.correctSelection ?? item.correct_selection),
      requiredCorrectCount: item.requiredCorrectCount ?? item.required_correct_count ?? item.requiredSelections ?? item.required_selections ?? item.correctCount ?? item.correct_count,
      numberCode: item.numberCode ?? item.number_code ?? item.secretNumber ?? item.secret_number ?? item.targetNumber ?? item.target_number,
    };
    if (!grouped.has(round)) grouped.set(round, { base: null, levels: new Map() });
    const group = grouped.get(round);
    if (hasDifficulty) {
      if (!group.levels.has(difficulty)) group.levels.set(difficulty, []);
      group.levels.get(difficulty).push(record);
    } else {
      group.base = record;
    }
  }

  const rounds = {};
  for (const [round, group] of grouped) {
    const initial = resolveRoundFormat(round, 1);
    const state = {
      question: "", subtitle: "", mode: initial.mode, optionCount: initial.optionCount,
      acceptedAnswers: [], options: [], promptImage: "", promptAsset: "", items: [], pairs: [],
      categories: ["Group 1", "Group 2", "Group 3"], videoUrl: "", numberValue: 0,
      numberVisible: false, imageVisible: true, backgroundImage: "", drawing: "", assignments: [],
      selectionRule: "any", requiredCorrectCount: 0, numberCode: "",
    };
    rounds[round] = {};
    for (let level = 1; level <= 5; level += 1) {
      const records = [...(group.base ? [group.base] : []), ...(group.levels.get(level) || [])];
      for (const record of records) {
        state.question = record.question || state.question;
        for (const field of ["subtitle", "promptImage", "promptAsset", "videoUrl", "backgroundImage", "drawing"]) {
          if (record[field]) state[field] = record[field];
        }
        for (const field of ["numberValue", "numberVisible", "imageVisible", "categories", "items", "pairs", "assignments", "optionCount", "requiredCorrectCount"]) {
          if (record[field] != null) state[field] = clone(record[field]);
        }
        if (record.selectionRule) state.selectionRule = record.selectionRule;
        if (record.numberCode != null) state.numberCode = safeString(record.numberCode).replace(/\D/g, "").slice(0, 4);
        if (record.mode) state.mode = record.mode;
        if (record.noMultipleChoice) {
          state.mode = "short-answer";
          state.options = [];
          state.optionCount = 0;
        } else {
          if (record.optionsPresent) {
            state.options = record.additive ? [...state.options, ...clone(record.options)] : clone(record.options);
            if (!record.explicitMode && state.options.length) state.mode = "choice-text";
            state.optionCount = state.options.length;
          }
        }
        if (record.acceptedPresent) {
          state.acceptedAnswers = record.additive ? [...state.acceptedAnswers, ...record.acceptedAnswers] : [...record.acceptedAnswers];
          if (!record.optionsPresent && !record.explicitMode) {
            state.mode = "short-answer";
            state.options = [];
            state.optionCount = 0;
          }
        }
        if (record.correctValues.length) {
          if (state.options.length && isChoiceMode(state.mode)) applyCorrectValues(state.options, record.correctValues);
          else {
            if (!record.explicitMode) state.mode = "short-answer";
            state.acceptedAnswers = [...new Set([...state.acceptedAnswers, ...record.correctValues])];
          }
        }
      }
      if (!isChoiceMode(state.mode)) { state.options = []; state.optionCount = 0; }
      else if (state.options.length) state.optionCount = state.options.length;
      rounds[round][level] = clone(state);
    }
  }
  return { rounds, questionBank: [], media: {}, warnings, errors: Object.keys(rounds).length ? [] : ["No usable question records were found."] };
}

function normalizeAnswerObjects(value) {
  if (Array.isArray(value)) return value.map((entry) => typeof entry === "string" ? entry.trim() : safeString(entry?.text ?? entry?.label ?? entry?.answer).trim()).filter(Boolean);
  if (typeof value === "string") return splitLooseList(value);
  return value == null ? [] : [safeString(value).trim()].filter(Boolean);
}

function normalizeOptionObjects(value) {
  if (!Array.isArray(value)) return normalizeAnswerObjects(value).map((label) => ({ label, image: "", asset: "", correct: false }));
  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      const parsed = parseAnswerLine(entry);
      return parsed.text ? [{ label: parsed.text, image: parsed.image, asset: "", correct: parsed.correct }] : [];
    }
    if (!entry || typeof entry !== "object") return [];
    const label = safeString(entry.label ?? entry.text ?? entry.name ?? entry.answer ?? entry.value).trim();
    if (!label && !entry.image && !entry.url && !entry.asset) return [];
    return [{
      label,
      image: safeString(entry.image ?? entry.imageUrl ?? entry.url),
      asset: safeString(entry.asset ?? entry.assetId),
      correct: entry.correct === true || entry.isCorrect === true || entry.is_correct === true || entry.correct_answer === true,
    }];
  });
}

function parseDelimited(text) {
  const firstLine = text.split("\n", 1)[0];
  const delimiter = ["\t", ",", ";", "|"].sort((a, b) => countChar(firstLine, b) - countChar(firstLine, a))[0];
  if (!delimiter || countChar(firstLine, delimiter) < 1) return null;
  const rows = parseDelimitedRows(text, delimiter);
  const header = rows[0].map(normalizeHeader);
  const indexes = {};
  header.forEach((name, index) => { if (name) indexes[name] = index; });
  let questionColumn = findColumn(indexes, ["question", "q", "prompt", "question text", "front", "term", "title", "text"]);
  let answerColumn = findColumn(indexes, ["answers", "options", "choices", "answer", "accepted answers", "accepted answer", "correct answer", "answer key", "back", "definition"]);
  const optionColumns = header.map((name, index) => /^(?:option|choice|answer)(?:\s*(?:#\s*)?[1-9]\d*|\s+[a-z])$/i.test(name) ? index : -1).filter((index) => index >= 0);
  const headerless = questionColumn < 0;
  if (headerless && rows[0].length < 2) return null;
  if (headerless) { questionColumn = 0; answerColumn = 1; }
  if (answerColumn < 0 && !optionColumns.length) return null;
  const dataIndexes = headerless ? {} : indexes;

  const warnings = [];
  const grouped = new Map();
  let sequence = 1;
  for (const [rowIndex, row] of (headerless ? rows : rows.slice(1)).entries()) {
    if (!row.some((cell) => cell.trim())) continue;
    const question = String(row[questionColumn] || "").trim();
    if (!question) { warnings.push("Row " + (rowIndex + (headerless ? 1 : 2)) + " has no question and was skipped."); continue; }
    const rowRound = normalizeId(getColumn(row, dataIndexes, ["round", "round id", "question id", "number", "id"]));
    const round = rowRound || String(sequence++).padStart(2, "0");
    const difficulty = Math.max(1, Math.min(5, Number(getColumn(row, dataIndexes, ["difficulty", "level", "tier", "diff"])) || 1));
    const answerHeading = answerColumn >= 0 ? header[answerColumn] : "";
    const isAcceptedColumn = (headerless && row.length === 2) || ["answer", "accepted answer", "accepted answers", "definition", "back"].includes(answerHeading) ||
      (!optionColumns.length && ["correct answer", "answer key"].includes(answerHeading));
    const rawAnswers = answerColumn >= 0 ? splitLooseList(row[answerColumn]) : [];
    const options = headerless && row.length > 2
      ? row.slice(1).map((cell) => String(cell || "").trim()).filter(Boolean)
      : optionColumns.length
      ? optionColumns.map((column) => String(row[column] || "").trim()).filter(Boolean)
      : isAcceptedColumn ? [] : rawAnswers;
    const accepted = isAcceptedColumn ? rawAnswers : splitLooseList(getColumn(row, dataIndexes, ["accepted answers", "accepted answer"]));
    const correctValues = splitLooseList(getColumn(row, dataIndexes, ["correct", "correct answer", "answer key", "correct answers", "correct option", "correct choice"]));
    const mode = normalizeMode(getColumn(row, dataIndexes, ["mode", "type", "template"])) || (options.length > 1 ? "choice-text" : "short-answer");
    const selectionRule = normalizeSelectionRule(getColumn(row, dataIndexes, ["selection rule", "answer selection", "selection mode", "correct selection", "answer rule", "multi select"]));
    const requiredCorrectCount = Number(getColumn(row, dataIndexes, ["required correct count", "required selections", "correct count", "select count"]));
    const numberCode = getColumn(row, dataIndexes, ["number code", "secret number", "target number", "wordle code"]).replace(/\D/g, "").slice(0, 4);
    const optionObjects = options.map((label) => ({ label, image: "", asset: "", correct: false }));
    applyCorrectValues(optionObjects, correctValues);
    const record = {
      question,
      subtitle: getColumn(row, dataIndexes, ["subtitle", "description", "hint"]),
      mode,
      options: optionObjects,
      accepted,
      correctValues,
      additive: /^(?:1|true|yes|on|add|append|plus)$/i.test(getColumn(row, dataIndexes, ["add", "additive", "append", "plus"])),
      noMultipleChoice: /^(?:1|true|yes|on|no|none)$/i.test(getColumn(row, dataIndexes, ["no multiple choice", "no mc", "no mcq"])),
      selectionRule,
      requiredCorrectCount: Number.isFinite(requiredCorrectCount) ? Math.max(0, Math.min(24, Math.trunc(requiredCorrectCount))) : undefined,
      numberCode,
    };
    if (!grouped.has(round)) grouped.set(round, new Map());
    const tiers = grouped.get(round);
    if (!tiers.has(difficulty)) tiers.set(difficulty, []);
    tiers.get(difficulty).push(record);
  }

  const rounds = {};
  for (const [roundId, tierRecords] of grouped) {
    const initial = resolveRoundFormat(roundId, 1);
    const state = {
      question: "", subtitle: "", mode: initial.mode, optionCount: initial.optionCount,
      options: [], acceptedAnswers: [], promptImage: "", promptAsset: "", items: [], pairs: [],
      categories: ["Group 1", "Group 2", "Group 3"], videoUrl: "", numberValue: 0,
      numberVisible: false, imageVisible: true, backgroundImage: "", drawing: "", assignments: [],
      selectionRule: "any", requiredCorrectCount: 0, numberCode: "",
    };
    rounds[roundId] = {};
    for (let level = 1; level <= 5; level += 1) {
      for (const record of tierRecords.get(level) || []) {
        state.question = record.question || state.question;
        state.subtitle = record.subtitle || state.subtitle;
        if (record.selectionRule) state.selectionRule = record.selectionRule;
        if (record.requiredCorrectCount != null) state.requiredCorrectCount = record.requiredCorrectCount;
        if (record.numberCode) state.numberCode = record.numberCode;
        if (record.noMultipleChoice) {
          state.mode = "short-answer";
          state.options = [];
          state.optionCount = 0;
        } else {
          state.mode = record.mode || state.mode;
          if (record.options.length) {
            state.options = record.additive ? [...state.options, ...clone(record.options)] : clone(record.options);
            state.optionCount = state.options.length;
          }
          if (record.accepted.length) state.acceptedAnswers = record.additive ? [...state.acceptedAnswers, ...record.accepted] : [...record.accepted];
          if (record.correctValues.length && state.options.length) applyCorrectValues(state.options, record.correctValues);
        }
      }
      if (isChoiceMode(state.mode)) state.optionCount = state.options.length || state.optionCount;
      else { state.options = []; state.optionCount = 0; }
      rounds[roundId][level] = clone(state);
    }
  }
  return { rounds, questionBank: [], media: {}, warnings, errors: Object.keys(rounds).length ? [] : ["No usable question rows were found."] };
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { row.push(field.trim()); field = ""; }
    else if (character === "\n" && !quoted) {
      row.push(field.trim());
      if (row.some((cell) => cell)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  row.push(field.trim());
  if (row.some((cell) => cell)) rows.push(row);
  return rows;
}

function countChar(text, character) { return [...text].filter((entry) => entry === character).length; }
function normalizeHeader(value) { return String(value).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "); }
function findColumn(indexes, aliases) { for (const alias of aliases) if (Object.hasOwn(indexes, alias)) return indexes[alias]; return -1; }
function getColumn(row, indexes, aliases) { const column = findColumn(indexes, aliases); return column < 0 ? "" : String(row[column] || "").trim(); }

function decodeEntities(value) {
  return String(value)
    .replace(/&#x([\da-f]+);?/gi, (_, hex) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, number) => safeCodePoint(Number(number)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'");
}

function parseHumanText(input) {
  const lines = decodeEntities(cleanText(input).replace(/\\[ \t]*\n/g, "\n")).split("\n");
  const rounds = {};
  const questionBank = [];
  const warnings = [];
  let current = null;
  let currentLevel = 1;
  let section = "rounds";
  let pendingList = "";
  let autoRound = 1;
  let inlinePairMode = false;

  function newRound(rawId, question = "") {
    flushRound();
    const id = normalizeId(rawId) || nextFreeRoundId(rounds, autoRound);
    autoRound = Number(id) + 1;
    current = { id, question: question.trim(), base: {}, levels: new Map() };
    currentLevel = 1;
    pendingList = "";
    inlinePairMode = false;
    ensureLevel(1);
  }

  function ensureLevel(level = currentLevel) {
    if (!current) return null;
    if (!current.levels.has(level)) current.levels.set(level, {
      fields: {}, options: [], optionsPresent: false, accepted: [], acceptedPresent: false,
      correct: [], additive: false, noMultipleChoice: false,
    });
    return current.levels.get(level);
  }

  function targetFields() {
    if (!current) return null;
    if (currentLevel === 0) return current.base;
    return ensureLevel(currentLevel).fields;
  }

  function appendQuestion(value) {
    const fields = targetFields();
    if (!fields) return;
    fields.question = [fields.question || (currentLevel === 1 ? current.question : ""), value].filter(Boolean).join(" ").trim();
    if (currentLevel === 1) current.question = fields.question;
  }

  function addQuestionBank(value) {
    const text = String(value || "").trim();
    if (text) questionBank.push({ id: `text-${questionBank.length + 1}`, text });
  }

  function setQuestionField(value) {
    if (section === "bank") { addQuestionBank(value); return; }
    if (!current) { newRound("", value); return; }
    if (current.question && current.question !== value.trim() && currentLevel === 1 && currentHasContent()) {
      newRound("", value);
      return;
    }
    const fields = targetFields();
    fields.question = value.trim();
    if (currentLevel === 1) current.question = fields.question;
    pendingList = "";
  }

  function currentHasContent() {
    return [...current.levels.values()].some((block) => block.optionsPresent || block.acceptedPresent || block.fields.question || block.fields.subtitle);
  }

  function applyHeaderMarkers(block, annotation) {
    const value = String(annotation || "").toLowerCase();
    if (/\b(?:add|append|plus|additional|also include|additive|and these)\b/.test(value) || /\+\s*(?:these|answers|options)?/.test(value)) block.additive = true;
    if (/\b(?:no|without|not)\s+(?:multiple[ -]?choice|mcq|mc)\b|\bshort[ -]?answer\b|\bfree[ -]?(?:response|text)\b/.test(value)) block.noMultipleChoice = true;
    const mode = normalizeMode(value.replace(/[\[\](){}]/g, "").replace(/^(?:mode|type|format)\s*[:=]?\s*/, ""));
    if (mode) block.fields.mode = mode;
    const selectionRule = normalizeSelectionRule(value.replace(/[\[\](){}]/g, ""));
    if (selectionRule) block.fields.selectionRule = selectionRule;
  }

  function flushRound() {
    if (!current) return;
    const id = current.id;
    const levels = {};
    const base = current.base;
    const defaults = resolveRoundFormat(id, 1);
    let state = {
      question: base.question || current.question || "", subtitle: base.subtitle || "",
      promptImage: base.promptImage || "", promptAsset: "", mode: base.mode || defaults.mode,
      optionCount: Number.isFinite(Number(base.optionCount)) ? Number(base.optionCount) : defaults.optionCount,
      acceptedAnswers: [], options: [], items: [], pairs: [], categories: ["Group 1", "Group 2", "Group 3"],
      videoUrl: "", numberValue: 0, numberVisible: false, imageVisible: true, backgroundImage: "", drawing: "", assignments: [],
      selectionRule: "any", requiredCorrectCount: 0, numberCode: "",
    };
    if (Array.isArray(base.acceptedAnswers)) state.acceptedAnswers = [...base.acceptedAnswers];
    const sharedQuestion = current.question || base.question || "";

    for (let level = 1; level <= 5; level += 1) {
      const block = current.levels.get(level);
      if (block) {
        for (const [field, value] of Object.entries(block.fields)) {
          if (field === "acceptedAnswers") state.acceptedAnswers = [...value];
          else if (field === "options" && Array.isArray(value)) state.options = clone(value);
          else if (field === "items" || field === "pairs" || field === "categories" || field === "assignments") state[field] = clone(value);
          else state[field] = value;
        }
        if (block.noMultipleChoice) {
          state.mode = "short-answer";
          state.options = [];
          state.optionCount = 0;
        }
        if (block.optionsPresent) {
          const answerOptions = block.options.map((entry) => ({ label: entry.text, image: entry.image || "", asset: "", correct: entry.correct === true }));
          if (block.noMultipleChoice || block.fields.mode === "short-answer") {
            const answers = answerOptions.map((entry) => entry.label).filter(Boolean);
            state.acceptedAnswers = block.additive ? [...state.acceptedAnswers, ...answers] : answers;
            state.options = [];
            state.mode = "short-answer";
            state.optionCount = 0;
          } else {
            state.options = block.additive ? [...state.options, ...answerOptions] : answerOptions;
            if (!block.fields.mode && !isChoiceMode(state.mode)) state.mode = "choice-text";
            state.optionCount = state.options.length;
          }
        }
        if (block.acceptedPresent) {
          if (!block.optionsPresent && !block.fields.mode) {
            state.mode = "short-answer";
            state.options = [];
            state.optionCount = 0;
          }
          state.acceptedAnswers = block.additive ? [...state.acceptedAnswers, ...block.accepted] : [...block.accepted];
        }
        if (block.correct.length) {
          if (state.options.length) applyCorrectValues(state.options, block.correct);
          else {
            if (!block.fields.mode) state.mode = "short-answer";
            state.acceptedAnswers = [...new Set([...state.acceptedAnswers, ...block.correct])];
          }
        }
        if (block.noMultipleChoice) {
          state.mode = "short-answer";
          state.optionCount = 0;
          state.options = [];
        }
      }
      if (!state.question && sharedQuestion) state.question = sharedQuestion;
      if (isChoiceMode(state.mode)) {
        if (state.options.length) state.optionCount = state.options.length;
        else if (!Number.isFinite(Number(state.optionCount))) state.optionCount = resolveRoundFormat(id, level).optionCount;
      } else {
        state.options = [];
        state.optionCount = 0;
      }
      levels[level] = {
        question: state.question, subtitle: state.subtitle, promptImage: state.promptImage, promptAsset: state.promptAsset,
        mode: state.mode, optionCount: state.optionCount, acceptedAnswers: [...state.acceptedAnswers],
        options: clone(state.options), items: clone(state.items), pairs: clone(state.pairs), categories: clone(state.categories),
        videoUrl: state.videoUrl, numberValue: state.numberValue, numberVisible: state.numberVisible,
        imageVisible: state.imageVisible, backgroundImage: state.backgroundImage, drawing: state.drawing,
        assignments: clone(state.assignments), selectionRule: state.selectionRule,
        requiredCorrectCount: state.requiredCorrectCount, numberCode: state.numberCode,
      };
    }
    rounds[id] = levels;
    current = null;
    currentLevel = 1;
    pendingList = "";
  }

  for (const [lineIndex, original] of lines.entries()) {
    let line = original.trim();
    if (!line) { pendingList = ""; continue; }
    if (/^#|^\/\//.test(line) || /^```/.test(line)) continue;
    if (/^(?:[-=_*]){3,}$/.test(line)) { pendingList = ""; continue; }

    const bankHeading = /^(?:\[\s*)?(?:session\s+)?(?:question\s+bank|host\s+questions|random\s+questions|random\s+prompts)(?:\s*\])?\s*:?$/i.test(line);
    if (bankHeading) { flushRound(); section = "bank"; continue; }
    if (/^(?:\[\s*)?(?:trivia\s+)?(?:rounds?|questions?)(?:\s*\])?\s*:?$/i.test(line)) { flushRound(); section = "rounds"; continue; }

    const explicitRound = parseRoundHeader(line);
    if (explicitRound) {
      section = "rounds";
      newRound(explicitRound.id, explicitRound.question);
      continue;
    }

    if (current && section === "rounds") {
      const paddedRound = line.match(/^\s*0(\d{1,2})\s*[:.)]\s*(.*)$/);
      if (paddedRound && Number(paddedRound[1]) >= 1 && Number(paddedRound[1]) <= 36 && paddedRound[2].trim()) {
        newRound(paddedRound[1], paddedRound[2]);
        continue;
      }
    }

    if (!current && section === "rounds") {
      const bareRound = line.match(/^\s*(\d{1,2})\s*[:.)]\s*(.*)$/);
      if (bareRound && Number(bareRound[1]) >= 1 && Number(bareRound[1]) <= 36) {
        newRound(bareRound[1], bareRound[2]);
        continue;
      }
    }

    if (current && section === "rounds") {
      const difficulty = parseDifficultyHeader(line);
      if (difficulty) {
        currentLevel = difficulty.level;
        const block = ensureLevel(currentLevel);
        applyHeaderMarkers(block, difficulty.annotation);
        pendingList = "";
        continue;
      }
    }

    const inlinePair = section === "rounds" ? parseInlineQuestionAnswer(line) : null;
    if (inlinePair && (!current || inlinePairMode)) {
      newRound("", inlinePair.question);
      const block = ensureLevel(1);
      block.acceptedPresent = true;
      block.accepted.push(inlinePair.answer);
      block.fields.mode = "short-answer";
      inlinePairMode = true;
      continue;
    }

    if (current && section === "rounds" && pendingList === "options" && isLabeledAnswer(line)) {
      const answer = parseAnswerLine(line);
      const block = ensureLevel(currentLevel);
      block.optionsPresent = true;
      block.options.push(answer);
      continue;
    }

    if (section === "bank" && isBullet(line)) {
      const answer = parseAnswerLine(line);
      addQuestionBank(answer.text);
      continue;
    }

    const field = parseField(line);
    if (field) {
      const { name, value } = field;
      if (["question", "prompt", "stem", "front", "term"].includes(name)) {
        if (section === "bank") addQuestionBank(value);
        else setQuestionField(value);
      } else if (name === "round") {
        const round = normalizeId(value);
        if (round) newRound(round, "");
      } else if (["difficulty", "level", "tier", "diff"].includes(name)) {
        if (current) {
          const parsedLevel = parseLevelSpec(value);
          if (parsedLevel.level) {
            currentLevel = parsedLevel.level;
            applyHeaderMarkers(ensureLevel(currentLevel), parsedLevel.annotation);
          }
        }
      } else if (name === "options") {
        if (!current) { warnings.push(`Line ${lineIndex + 1}: options appeared before a question.`); continue; }
        const block = ensureLevel(currentLevel);
        block.optionsPresent = true;
        block.options.push(...splitLooseList(value).map(parseAnswerLine));
        pendingList = "options";
      } else if (name === "option-entry") {
        if (!current) { warnings.push(`Line ${lineIndex + 1}: an answer choice appeared before a question.`); continue; }
        const block = ensureLevel(currentLevel);
        block.optionsPresent = true;
        block.options.push(parseAnswerLine(value));
        pendingList = "options";
      } else if (name === "accepted") {
        if (!current) { warnings.push(`Line ${lineIndex + 1}: answers appeared before a question.`); continue; }
        const block = ensureLevel(currentLevel);
        block.acceptedPresent = true;
        block.accepted.push(...splitLooseList(value));
        pendingList = "accepted";
      } else if (name === "correct") {
        if (!current) continue;
        ensureLevel(currentLevel).correct.push(...splitLooseList(value));
        pendingList = "";
      } else if (name === "mode") {
        if (!current) continue;
        const mode = normalizeMode(value);
        if (mode) ensureLevel(currentLevel).fields.mode = mode;
        else warnings.push(`Line ${lineIndex + 1}: unrecognized question type “${value}”.`);
        pendingList = "";
      } else if (name === "subtitle" || name === "promptimage" || name === "video" || name === "backgroundimage" || name === "drawing") {
        if (!current) continue;
        const key = ({ promptimage: "promptImage", backgroundimage: "backgroundImage" })[name] || name;
        ensureLevel(currentLevel).fields[key] = value;
        pendingList = "";
      } else if (name === "number") {
        if (current) ensureLevel(currentLevel).fields.numberValue = finiteOr(value, 0);
        pendingList = "";
      } else if (name === "selectionrule") {
        if (current) {
          const selectionRule = normalizeSelectionRule(value);
          if (selectionRule) ensureLevel(currentLevel).fields.selectionRule = selectionRule;
          else warnings.push(`Line ${lineIndex + 1}: use “any” or “all” for the answer selection rule.`);
        }
        pendingList = "";
      } else if (name === "requiredcorrectcount") {
        const count = Number(value);
        if (current && Number.isFinite(count)) ensureLevel(currentLevel).fields.requiredCorrectCount = Math.max(0, Math.min(24, Math.trunc(count)));
        pendingList = "";
      } else if (name === "numbercode") {
        if (current) ensureLevel(currentLevel).fields.numberCode = value.replace(/\D/g, "").slice(0, 4);
        pendingList = "";
      } else if (name === "additive") {
        if (current) ensureLevel(currentLevel).additive = /^(?:true|yes|on|add|append|plus)$/i.test(value);
        pendingList = "";
      } else if (name === "nomultiplechoice") {
        if (current) ensureLevel(currentLevel).noMultipleChoice = /^(?:true|yes|on|1)$/i.test(value);
        pendingList = "";
      } else {
        warnings.push(`Line ${lineIndex + 1}: ignored “${line.slice(0, 80)}”.`);
      }
      continue;
    }

    const noChoiceOnly = /^(?:\[|\(|\{)?\s*(?:no|without|not)\s+(?:multiple[ -]?choice|mcq|mc)|^\s*(?:short[ -]?answer|free[ -]?(?:response|text))/i.test(line);
    if (noChoiceOnly && current) {
      const block = ensureLevel(currentLevel);
      applyHeaderMarkers(block, line);
      pendingList = "";
      continue;
    }
    if (/^(?:\[|\(|\{)?\s*(?:add|append|plus|additional|add these|add more)\b/i.test(line) && current) {
      ensureLevel(currentLevel).additive = true;
      pendingList = "";
      continue;
    }

    if (section === "bank") {
      addQuestionBank(isBullet(line) ? parseAnswerLine(line).text : line);
      continue;
    }

    if (current && isBullet(line)) {
      const answer = parseAnswerLine(line);
      const block = ensureLevel(currentLevel);
      block.optionsPresent = true;
      block.options.push(answer);
      pendingList = "options";
      continue;
    }
    if (current && pendingList === "options" && isLabeledAnswer(line)) {
      const answer = parseAnswerLine(line);
      const block = ensureLevel(currentLevel);
      block.optionsPresent = true;
      block.options.push(answer);
      continue;
    }
    if (current && pendingList === "accepted" && line) {
      ensureLevel(currentLevel).accepted.push(...splitLooseList(line));
      continue;
    }
    if (current) {
      appendQuestion(line);
      continue;
    }
    if (line.endsWith("?")) {
      addQuestionBank(line);
      continue;
    }
    warnings.push(`Line ${lineIndex + 1}: could not identify a round, question, answer, or section; skipped.`);
  }
  flushRound();

  return {
    rounds,
    questionBank,
    media: {},
    warnings,
    errors: Object.keys(rounds).length || questionBank.length ? [] : ["No questions were recognized. Add a question heading or a Question/Prompt field, then provide any answers or difficulty blocks."],
  };
}

function nextFreeRoundId(rounds, start = 1) {
  for (let value = Math.max(1, start); value <= 36; value += 1) {
    const id = String(value).padStart(2, "0");
    if (!rounds[id]) return id;
  }
  return "36";
}

function parseInlineQuestionAnswer(line) {
  const tab = line.indexOf("\t");
  let question = "";
  let answer = "";
  if (tab >= 0) {
    question = line.slice(0, tab).trim();
    answer = line.slice(tab + 1).trim();
  } else {
    const match = line.match(/^(.+?)\s+(?:-|–|—)\s+(.+)$/);
    if (!match) return null;
    question = match[1].trim();
    answer = match[2].trim();
  }
  if (!question || !answer || isBullet(line)) return null;
  return { question, answer };
}

function parseRoundHeader(line) {
  let match = line.match(/^\s*(?:round|question\s*#?|q)\s*#?\s*(\d{1,2})\s*(?:[:.)–—-]|\s+-\s*)\s*(.*)$/i);
  if (match) return { id: match[1], question: match[2].trim() };
  match = line.match(/^\s*(\d{1,2})\s*[:.)–—-]\s*(.*)$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (number < 1 || number > 36) return null;
  if (number <= 5) return null;
  return { id: match[1], question: match[2].trim() };
}

function parseDifficultyHeader(line) {
  let match = line.match(/^\s*(?:difficult(?:y|ies)|diff|level|tier|stage|d)\s*(?:(?:number|level|tier)\s*)?#?\s*(\d+|one|first|1st|two|second|2nd|three|third|3rd|four|fourth|4th|five|fifth|5th|easy|easiest|beginner|simple|medium|intermediate|normal|hard|hardest|expert|advanced)\s*(?:[:=.)–—-]\s*)?(.*)$/i);
  if (match) {
    const level = parseLevelValue(match[1]);
    return level ? { level, annotation: match[2].trim() } : null;
  }
  match = line.match(/^\s*0?([1-5])\s*(?:\(([^)]*)\)|\[([^\]]*)\]|\{([^}]*)\})?\s*:\s*(.*)$/);
  if (match) return { level: Number(match[1]), annotation: [match[2], match[3], match[4], match[5]].filter(Boolean).join(" ").trim() };
  match = line.match(/^\s*(one|first|1st|two|second|2nd|three|third|3rd|four|fourth|4th|five|fifth|5th|easy|easiest|beginner|simple|medium|intermediate|normal|hard|hardest|expert|advanced)\s*[:=]\s*(.*)$/i);
  if (match) return { level: parseLevelValue(match[1]), annotation: match[2].trim() };
  match = line.match(/^\s*(?:1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth|easy|easiest|medium|normal|hard|hardest|expert|beginner|simple|intermediate|advanced)\s+(?:difficulty|level|tier)\s*:?\s*(.*)$/i);
  if (match) {
    const levelToken = line.match(/^\s*(1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth|easy|easiest|medium|normal|hard|hardest|expert|beginner|simple|intermediate|advanced)/i)?.[1];
    return { level: parseLevelValue(levelToken), annotation: match[1].trim() };
  }
  return null;
}

function parseLevelSpec(value) {
  const match = String(value || "").replace(/^\s*(?:difficulty|diff|level|tier|stage|d)\s*#?\s*/i, "").match(/^\s*(\S+)([\s\S]*)$/);
  if (!match) return { level: 0, annotation: "" };
  return { level: parseLevelValue(match[1]), annotation: match[2].trim() };
}

function parseLevelValue(value) {
  const key = String(value || "").trim().toLowerCase();
  const number = Number.parseInt(key, 10);
  if (Number.isInteger(number) && number >= 1 && number <= 5) return number;
  return LEVEL_WORDS.get(key) || 0;
}

function parseField(line) {
  const match = line.match(/^\s*(?:[-*]\s*)?([a-z][a-z _-]{0,35})\s*[:=]\s*(.*)$/i);
  if (!match) return null;
  const rawName = match[1].trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const aliases = new Map([
    ["q", "question"], ["question", "question"], ["question text", "question"], ["prompt", "prompt"], ["prompt text", "prompt"], ["stem", "stem"], ["front", "front"], ["term", "term"], ["round", "round"], ["round number", "round"], ["question number", "round"], ["id", "round"],
    ["difficulty", "difficulty"], ["diff", "diff"], ["d", "difficulty"], ["level", "level"], ["tier", "tier"],
    ["answers", "options"], ["answer choices", "options"], ["mc answers", "options"], ["answer options", "options"], ["options", "options"], ["choices", "options"], ["choice", "options"], ["multiple choice", "options"], ["possible answers", "options"], ["alternatives", "options"],
    ["a", "accepted"], ["ans", "accepted"], ["answer", "accepted"], ["the answer", "accepted"], ["the answer is", "accepted"], ["accepted answer", "accepted"], ["accepted answers", "accepted"], ["expected answer", "accepted"], ["expected answers", "accepted"], ["solution", "accepted"], ["answer key", "correct"], ["correct", "correct"], ["correct answer", "correct"], ["the correct answer", "correct"], ["the correct answer is", "correct"], ["correct answers", "correct"], ["correct option", "correct"], ["correct choice", "correct"], ["right answer", "correct"], ["right option", "correct"], ["key", "correct"],
    ["mode", "mode"], ["type", "mode"], ["format", "mode"], ["template", "mode"], ["question type", "mode"],
    ["subtitle", "subtitle"], ["description", "subtitle"], ["hint", "subtitle"],
    ["image", "promptimage"], ["prompt image", "promptimage"], ["image url", "promptimage"], ["prompt image url", "promptimage"],
    ["video", "video"], ["video url", "video"], ["background image", "backgroundimage"], ["background image url", "backgroundimage"],
    ["number", "number"], ["starting number", "number"], ["value", "number"],
    ["selection", "selectionrule"], ["selection rule", "selectionrule"], ["answer selection", "selectionrule"], ["answer selection rule", "selectionrule"], ["answer rule", "selectionrule"], ["correct selection", "selectionrule"], ["correct answer rule", "selectionrule"], ["select mode", "selectionrule"], ["select any or all", "selectionrule"], ["multi select", "selectionrule"],
    ["required correct count", "requiredcorrectcount"], ["required selections", "requiredcorrectcount"], ["number to select", "requiredcorrectcount"], ["correct count", "requiredcorrectcount"],
    ["number code", "numbercode"], ["secret number", "numbercode"], ["target number", "numbercode"], ["wordle code", "numbercode"],
    ["add", "additive"], ["add these", "additive"], ["add to previous", "additive"], ["additive", "additive"], ["append", "additive"], ["plus", "additive"],
    ["no multiple choice", "nomultiplechoice"], ["without multiple choice", "nomultiplechoice"], ["no mc", "nomultiplechoice"], ["no mcq", "nomultiplechoice"],
  ]);
  const optionEntry = rawName.match(/^(?:option|choice|answer)\s+([a-z0-9]+)$/);
  if (optionEntry) return { name: "option-entry", value: match[2].trim() };
  const name = aliases.get(rawName);
  return name ? { name, value: match[2].trim() } : null;
}

function splitLooseList(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  let parts;
  if (text.includes("|") || text.includes(";")) parts = text.split(/[|;]/);
  else if (text.includes(",") && !/\b(?:https?:\/\/|data:)/i.test(text)) parts = text.split(",");
  else parts = [text];
  return parts.map((part) => part.trim()).filter(Boolean);
}

function safeCodePoint(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
}

function isBullet(line) { return /^\s*(?:[-*+•‣▪◦–—]\s+|\[\s*[xX✓✔ ]\s*\]\s*|\d+\s*[.)]\s+|[A-Za-z]\s*[.)]\s+)/.test(line); }
function isLabeledAnswer(line) { return /^\s*(?:option|choice|answer)\s+[A-Za-z0-9]+\s*[:.)-]\s*|^[A-Za-z]\s*:\s*/i.test(line); }

function parseAnswerLine(value) {
  let text = String(value || "").trim();
  let correct = false;
  if (/^\[\s*[xX✓✔]\s*\]\s*/.test(text) || /^(?:✓|✔)\s*/.test(text)) { correct = true; text = text.replace(/^\[\s*[xX✓✔]\s*\]\s*|^(?:✓|✔)\s*/, ""); }
  if (/\s*(?:\[(?:correct|right|x|✓|✔)\]|\((?:correct|right|✓|✔)\)|\*\*?)\s*$/i.test(text)) {
    correct = true;
    text = text.replace(/\s*(?:\[(?:correct|right|x|✓|✔)\]|\((?:correct|right|✓|✔)\)|\*\*?)\s*$/i, "");
  }
  text = text.replace(/^\s*(?:option|choice|answer)\s+[A-Za-z0-9]+\s*[:.)-]\s*/i, "");
  text = text.replace(/^\s*(?:[-*+•‣▪◦–—]\s+|\[\s*[xX✓✔ ]\s*\]\s*|\d+\s*[.)]\s+|[A-Za-z]\s*[.)]\s+)/, "");
  return { text: text.trim(), image: "", correct };
}

function applyCorrectValues(options, correctValues) {
  const values = normalizeAnswerObjects(correctValues).map((value) => value.trim());
  for (const option of options) {
    if (option && typeof option === "object") option.correct = false;
  }
  for (const value of values) {
    const numeric = Number.parseInt(value, 10);
    const letter = /^[A-Za-z]$/.test(value) ? value.toUpperCase().charCodeAt(0) - 64 : 0;
    const index = Number.isInteger(numeric) && numeric > 0 ? numeric - 1 : letter > 0 ? letter - 1 : -1;
    if (index >= 0 && options[index]) { options[index].correct = true; continue; }
    const found = options.find((option) => String(option?.label || option?.text || "").trim().toLowerCase() === value.toLowerCase());
    if (found) found.correct = true;
  }
}
