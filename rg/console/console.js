import {
  RG_CONTESTANTS,
  readPointScores,
  writePointScores,
} from "/ramblegamble/points-store.mjs?v=points-console-20261120-v1";

const output = document.getElementById("terminal-output");
const form = document.getElementById("terminal-form");
const input = document.getElementById("terminal-input");
const history = [];
let historyIndex = 0;

function addLine(text, className = "") {
  const line = document.createElement("p");
  line.className = `terminal-line${className ? ` ${className}` : ""}`;
  line.textContent = text;
  output.append(line);
  output.scrollTop = output.scrollHeight;
}

function formatScores(scores) {
  return RG_CONTESTANTS.map((name) => `${name}: ${scores[name]}`).join("  ");
}

function usageError() {
  addLine("Usage: points [faroe|erin|kaz] | points add <name> [amount] | points set <name> <total> | points reset [name]", "terminal-error");
}

function parseName(value) {
  const name = String(value || "").trim().replace(/^@/, "").toLowerCase();
  return RG_CONTESTANTS.includes(name) ? name : null;
}

function parseWholeNumber(value, { positive = false } = {}) {
  if (!/^\d+$/.test(String(value ?? ""))) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > 1000000 || (positive && number < 1)) return null;
  return number;
}

function execute(rawCommand) {
  const command = rawCommand.trim();
  if (!command) return;
  addLine(`> ${command}`, "terminal-command");
  const [verb, ...args] = command.split(/\s+/);
  const action = verb.toLowerCase();

  if (action === "help") {
    addLine("help · clear · points [faroe|erin|kaz] · points add <name> [amount] · points set <name> <total> · points reset [name]");
    return;
  }
  if (action === "clear") {
    output.replaceChildren();
    return;
  }
  if (action !== "points") {
    addLine(`Unknown command: ${verb}. Type help.`, "terminal-error");
    return;
  }

  const scores = readPointScores();
  const subcommand = args[0]?.toLowerCase();
  if (!subcommand) {
    addLine(formatScores(scores));
    return;
  }
  if (subcommand === "add") {
    if (args.length < 2 || args.length > 3) return usageError();
    const name = parseName(args[1]);
    const amount = args.length === 2 ? 1 : parseWholeNumber(args[2], { positive: true });
    if (!name || amount === null || scores[name] + amount > Number.MAX_SAFE_INTEGER) return usageError();
    scores[name] += amount;
    const result = writePointScores(scores);
    addLine(`${name}: ${result.scores[name]} (+${amount})${result.persisted ? "" : " · browser storage unavailable; update was sent to open tabs only"}`);
    return;
  }
  if (subcommand === "set") {
    if (args.length !== 3) return usageError();
    const name = parseName(args[1]);
    const total = parseWholeNumber(args[2]);
    if (!name || total === null) return usageError();
    scores[name] = total;
    const result = writePointScores(scores);
    addLine(`${name}: ${result.scores[name]}${result.persisted ? "" : " · browser storage unavailable; update was sent to open tabs only"}`);
    return;
  }
  if (subcommand === "reset") {
    if (args.length > 2) return usageError();
    const name = args.length === 1 ? null : parseName(args[1]);
    if (args.length === 2 && !name) return usageError();
    if (name) scores[name] = 0;
    else for (const contestant of RG_CONTESTANTS) scores[contestant] = 0;
    const result = writePointScores(scores);
    addLine(name ? `${name}: 0` : `Scores reset · ${formatScores(result.scores)}`);
    if (!result.persisted) addLine("Browser storage unavailable; update was sent to open tabs only", "terminal-error");
    return;
  }

  if (args.length !== 1) return usageError();
  const name = parseName(subcommand);
  if (!name) return usageError();
  addLine(`${name}: ${scores[name]}`);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = input.value;
  if (command.trim()) {
    history.push(command);
    historyIndex = history.length;
    execute(command);
  }
  input.value = "";
});

input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    input.value = history[historyIndex] || "";
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    input.value = history[historyIndex] || "";
  }
});

addLine("RG points console · type help");
addLine(formatScores(readPointScores()));
