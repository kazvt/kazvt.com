import { mountCommandCompletion } from "/ramblegamble/console-completion.mjs?v=card-polish-20261127-v1";
import { applyCardShowAction } from "/ramblegamble/card-show-actions.mjs?v=card-polish-20261127-v1";
import { renderTriviaResponses } from "/ramblegamble/trivia-live-view.mjs?v=room-recovery-20261127-v1";
import { activeRoomRound, readLiveTrivia, writeLiveTrivia, subscribeLiveTrivia, newTriviaId, TRIVIA_REQUEST_KEY, TRIVIA_REPLY_KEY, updateTrivia, answerSummary } from "/ramblegamble/live-trivia.mjs?v=show-stage-20261126-v1";
import { withRoomSubmissionLock } from "/ramblegamble/card-room-election.mjs";
import { mountCardRoom } from "/ramblegamble/card-room-host.mjs?v=room-recovery-20261127-v1";
import {
  RG_CONTESTANTS,
  readPointScores,
  writePointScores,
  withPointScoresLock,
} from "/ramblegamble/points-store.mjs?v=card-score-sync-20261127-v1";
import { parsePointsCommand, POINTS_HELP } from "/ramblegamble/points-commands.mjs?v=card-polish-20261127-v1";
import { createSmeemoGame } from "/ramblegamble/card-games.mjs?v=show-stage-20261126-v1";
import { readCardGames, writeCardGames, subscribeCardGames } from "/ramblegamble/card-games-store.mjs?v=show-stage-20261126-v1";

const output = document.getElementById("terminal-output");
const form = document.getElementById("terminal-form");
const input = document.getElementById("terminal-input");
const history = [];
let historyIndex = 0;
let historyDraft = "";
const completion = mountCommandCompletion(input, document.getElementById("terminal-suggestions"), document.getElementById("terminal-ghost"));

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

const answersPanel=document.getElementById('console-answers'), answersContent=document.getElementById('console-answer-content');
let triviaOnly=false;
function refreshAnswers(){
  if(!answersPanel.open)return;
  const round=triviaOnly?readLiveTrivia():activeRoomRound();
  answersContent.replaceChildren();
  if(!round){answersContent.textContent='No active round.';return;}
  const heading=document.createElement('p');heading.textContent=round.prompt||round.mode;answersContent.append(heading);
  const body=document.createElement('div');answersContent.append(body);
  if(round.mode==='trivia'){renderTriviaResponses(body,round);return;}
  for(const name of RG_CONTESTANTS){const row=document.createElement('p');row.textContent=`${name.toUpperCase()}: ${round.submissions?.[name]||'Waiting'}`;body.append(row);}
}
answersPanel.addEventListener('toggle',refreshAnswers);
async function execute(rawCommand) {
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
  if (parsed.action === "answers") { triviaOnly=false; answersPanel.open=true; refreshAnswers(); return; }
  if (parsed.action.startsWith("card-")) {
    try {
      await withRoomSubmissionLock(() => {
        const action = parsed.action.slice(5), state = readCardGames();
        if (action !== "start" && activeRoomRound()?.id !== state.round?.id) throw Error("No active card round.");
        const next = applyCardShowAction(state, action, parsed);
        const result = writeCardGames(next, { requirePersistence: true });
        if (!result.persisted) throw Error("Could not save card round.");
        cardRoom.publish(); refreshAnswers();
        const round = result.state.round;
        addLine(action === "start" ? `${round.mode}: ${round.prompt}` : `${round.mode}: ${round.phase} (${round.revealedCount || 0}/${round.responses.length})`);
      });
    } catch(error) { addLine(error.message, "terminal-error"); }
    return;
  }
  if (parsed.action === "smeemo-start" || parsed.action === "smeemo-reset") {
    try {
      await withRoomSubmissionLock(() => {
        const state = readCardGames();
        if (parsed.action === "smeemo-start") {
          state.round = null;
          state.smeemo = createSmeemoGame();
        } else {
          if (state.smeemo) state.round = null; // Never restore a legacy underlying round.
          state.smeemo = null;
        }
        const result = writeCardGames(state, { requirePersistence: true });
        if (!result.persisted) throw Error("Could not save Smeemo state; no update committed.");
        cardRoom.publish(); refreshAnswers();
        addLine(parsed.action === "smeemo-start" ? "Smeemo Scramble started - reveal cards on the room page" : "Smeemo Scramble reset");
      });
    } catch (error) { addLine(error.message, "terminal-error"); }
    return;
  }
  if (parsed.action === "trivia-start") {
    const id=newTriviaId();
    try { localStorage.setItem(TRIVIA_REQUEST_KEY,JSON.stringify({id,round:parsed.round,difficulty:parsed.difficulty,at:Date.now()})); addLine(`Trivia ${parsed.round} / ${parsed.difficulty} — sending to /rg/…`); }
    catch { addLine("Could not send the trivia command; browser storage unavailable.","terminal-error"); return; }
    setTimeout(()=>{try { if(JSON.parse(localStorage.getItem(TRIVIA_REPLY_KEY))?.id!==id&&JSON.parse(localStorage.getItem(TRIVIA_REQUEST_KEY))?.id===id)addLine("No display reply. Keep the /rg/ tab open and unlocked with the imported question bank.","terminal-error"); }catch{}},12000);
    return;
  }
  if (parsed.action.startsWith("trivia-")) {
    const action=parsed.action.slice(7),round=readLiveTrivia();
    if(!round){addLine("No live trivia question.","terminal-error");return;}
    if(action==='answers'){triviaOnly=true;answersPanel.open=true;refreshAnswers();for(const player of RG_CONTESTANTS)addLine(`${player}: ${answerSummary(round,player)}`);return;}
    try{await updateTrivia(current=>{if(!current||current.id!==round.id)throw Error('Question changed.');if(action==='close')return {...current,phase:'closed'};const q={...current.question};if(['next','previous'].includes(action)){if(!['image-sequence','text-sequence'].includes(q.kind))throw Error('Not a sequence.');q.sequenceIndex=Math.max(0,Math.min(q.items.length-1,q.sequenceIndex+(action==='next'?1:-1)));}else{if(q.kind!=='memory-number')throw Error('Not a memory question.');q.imageVisible=action==='show';q.promptImage=q.imageVisible?current.secret.memoryImage:'';}return {...current,question:q};});addLine(`Trivia ${action}.`);}catch(e){addLine(e.message,"terminal-error");}return;
  }
  try {
    await withPointScoresLock(() => {
      const latest = readPointScores({ strict: true });
      if (parsed.action === "inspect-all") { addLine(formatScores(latest)); return; }
      if (parsed.action === "inspect") { addLine(`${parsed.name}: ${latest[parsed.name]}`); return; }
      let removed = 0;
      if (parsed.action === "add") {
        if (latest[parsed.name] + parsed.amount > Number.MAX_SAFE_INTEGER) throw Error("Point total would exceed the safe integer limit.");
        latest[parsed.name] += parsed.amount;
      } else if (parsed.action === "remove") {
        removed = Math.min(latest[parsed.name], parsed.amount);
        latest[parsed.name] -= removed;
      } else if (parsed.action === "set") latest[parsed.name] = parsed.total;
      else if (parsed.action === "reset") {
        if (parsed.name) latest[parsed.name] = 0;
        else for (const contestant of RG_CONTESTANTS) latest[contestant] = 0;
      } else return;
      const result = writePointScores(latest);
      if (!result.persisted) throw Error("Could not save points; no update committed.");
      addLine(parsed.name ? `${parsed.name}: ${result.scores[parsed.name]}${parsed.action === "add" ? ` (+${parsed.amount})` : parsed.action === "remove" ? ` (-${removed})` : ""}` : `Scores reset - ${formatScores(result.scores)}`);
    });
  } catch (error) { addLine(error.message, "terminal-error"); }

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
  historyDraft = "";
  completion.hide();
});

input.addEventListener("keydown", (event) => {
  if (completion.handleKey(event) || event.isComposing || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "ArrowUp") {
    if (historyIndex === history.length) historyDraft = input.value;
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    input.value = history[historyIndex] ?? historyDraft;
    input.setSelectionRange(input.value.length, input.value.length);
    completion.hide();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    input.value = history[historyIndex] ?? historyDraft;
    input.setSelectionRange(input.value.length, input.value.length);
    completion.hide();
  }
});

addLine("RG console - type help");
addLine(formatScores(readPointScores()));

const cardRoom = mountCardRoom(document.getElementById("console-card-room"), {
  role: "/rg/console/",
  getRound: () => activeRoomRound(),
  commitRound: round => { if(round.mode==='trivia')return writeLiveTrivia(round); return writeCardGames({ ...readCardGames(), round }, { requirePersistence: true }).persisted; },
  onStatus: message => {addLine(message);refreshAnswers();},
});
subscribeCardGames(() => {cardRoom.publish();refreshAnswers();});

subscribeLiveTrivia(()=>{cardRoom.publish();refreshAnswers();});
window.addEventListener("storage",event=>{if(event.key!==TRIVIA_REPLY_KEY)return;try{const reply=JSON.parse(event.newValue);if(reply?.message)addLine(reply.message,reply.ok?"":"terminal-error");}catch{}});
