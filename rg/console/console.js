import {
  RG_CONTESTANTS,
  readPointScores,
  writePointScores,
} from "/ramblegamble/points-store.mjs?v=points-console-20261120-v1";
import { parsePointsCommand, POINTS_HELP } from "/ramblegamble/points-commands.mjs?v=rg-smeemo-manual-20261125-v1";
import { createSmeemoGame } from "/ramblegamble/card-games.mjs?v=rg-smeemo-secret-repeat-20261126-v4";
import { readCardGames, writeCardGames } from "/ramblegamble/card-games-store.mjs?v=rg-smeemo-secret-repeat-20261126-v4";

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

function execute(rawCommand) {
  const command = rawCommand.trim();
  if (!command) return;
  addLine(`> ${command}`, "terminal-command");
  const parsed = parsePointsCommand(command);
  if (parsed.action === "noop") return;
  if (parsed.action === "help") {
    addLine(POINTS_HELP);
    return;
  }
  if (parsed.action === "clear") {
    output.replaceChildren();
    return;
  }
  if (parsed.action === "error") {
    addLine(parsed.message || "Invalid command. Type help.", "terminal-error");
    return;
  }
  if (parsed.action === "smeemo-start") {
    const state = readCardGames();
    state.round = null;
    state.smeemo = createSmeemoGame();
    const result = writeCardGames(state);
    addLine(`Smeemo Scramble started - reveal cards on the room page${result.persisted ? "" : " - update sent to open tabs only"}`);
    return;
  }
  if (parsed.action === "smeemo-reset") {
    const state = readCardGames();
    state.smeemo = null;
    const result = writeCardGames(state);
    addLine(`Smeemo Scramble reset${result.persisted ? "" : " - update sent to open tabs only"}`);
    return;
  }
  const scores = readPointScores();
  if (parsed.action === "inspect-all") {
    addLine(formatScores(scores));
    return;
  }
  if (parsed.action === "inspect") {
    addLine(`${parsed.name}: ${scores[parsed.name]}`);
    return;
  }
  if (parsed.action === "add") {
    if (scores[parsed.name] + parsed.amount > Number.MAX_SAFE_INTEGER) {
      addLine("Point total would exceed the safe integer limit.", "terminal-error");
      return;
    }
    scores[parsed.name] += parsed.amount;
    const result = writePointScores(scores);
    addLine(`${parsed.name}: ${result.scores[parsed.name]} (+${parsed.amount})${result.persisted ? "" : " - browser storage unavailable; update was sent to open tabs only"}`);
    return;
  }
  if (parsed.action === "set") {
    scores[parsed.name] = parsed.total;
    const result = writePointScores(scores);
    addLine(`${parsed.name}: ${result.scores[parsed.name]}${result.persisted ? "" : " - browser storage unavailable; update was sent to open tabs only"}`);
    return;
  }
  if (parsed.action === "reset") {
    if (parsed.name) scores[parsed.name] = 0;
    else for (const contestant of RG_CONTESTANTS) scores[contestant] = 0;
    const result = writePointScores(scores);
    addLine(parsed.name ? `${parsed.name}: 0` : `Scores reset - ${formatScores(result.scores)}`);
    if (!result.persisted) addLine("Browser storage unavailable; update was sent to open tabs only", "terminal-error");
  }
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

addLine("RG console - type help");
addLine(formatScores(readPointScores()));
