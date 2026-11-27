import { audienceReact } from "./audience-state.mjs?v=show-energy-20261127-v1";
import { showBurst, voteFlight, purchaseFlight } from "./show-ui-fx.mjs?v=shop-motion-20261127-v1";
import { createSmeemoImpact, smeemoImpactTransition } from "./smeemo-impact.mjs?v=room-audio-20261127-v1";
import { applyCardShowAction } from "./card-show-actions.mjs?v=card-polish-20261127-v1";
import { activeRoomRound, subscribeLiveTrivia, writeLiveTrivia, writeLiveTriviaDraft } from "./live-trivia.mjs?v=match-number-20261127-v1";
import { activeCardStage, cardStageChange } from "./card-stage-state.mjs?v=wildcard-shared-20261126-v1";
import { withRoomSubmissionLock } from "./card-room-election.mjs";
import { mountCardRoom } from "./card-room-host.mjs?v=match-number-20261127-v1";
import { foley } from "./game-foley.mjs?v=neon-focus-20261127-v1";
import {
  CARD_GAME_CATEGORIES,
  CARD_GAME_PLAYERS,
  createQuiplashRound,
  newRoundId,
  createRedHandedRound,
  createShopRound,
  advanceSmeemoPhase,
  drawSmeemoCard,
  normalizeTextList,
  parseShopCardList,
  recordAudienceVote,
  visibleCardResponses,
  submitRoundAnswer,
  buyShopCard,
} from "./card-games.mjs?v=show-stage-20261126-v1";
import { readCardGames, writeCardGames, subscribeCardGames } from "./card-games-store.mjs?v=show-stage-20261126-v1";
import { readPointScores, subscribePointScores, writePointScores, withPointScoresLock } from "./points-store.mjs?v=player-stats-20261127-v1";

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const layer = $("#rg-card-games-layer");
  const header = $(".rg-card-games-header", layer);
  const title = $("#rg-card-games-title");
  const content = $("#rg-card-games-content");
  const liveStatus = $("#rg-card-live-status");
  const roomButton = $("#rg-card-room");

  const modeSelect = $("#rg-card-mode");
  const saveButton = $("#rg-card-save");
  const menuButton = $("#rg-card-menu");
  const startButton = $("#rg-card-start");
  const evidenceInput = $("#rg-card-evidence");
  const suspectInput = $("#rg-card-suspects");
  const quiplashInput = $("#rg-card-prompts");
  const shopInputs = {
    penalty: $("#rg-shop-penalty"),
    challenge: $("#rg-shop-challenge"),
    instant: $("#rg-shop-instant"),
  };
  const playerSelect = $("#rg-card-player");
  const answerChoiceWrap = $("#rg-card-answer-choice");
  const answerSelect = $("#rg-card-answer");
  const answerTextWrap = $("#rg-card-answer-text");
  const answerText = $("#rg-card-answer-textarea");
  const submitButton = $("#rg-card-submit");
  const privateEntry = $("#rg-card-private-entry");
  const voteControls = $("#rg-card-vote-controls");
  const revealButton = $("#rg-card-reveal-results");
  const shopAdmin = $("#rg-card-shop-admin");
  const shopRefreshButton = $("#rg-card-shop-refresh");
  const adminStatus = $("#rg-card-admin-status");
  const resetButton = $("#rg-card-reset");
  for (const control of [startButton, submitButton, shopRefreshButton, resetButton]) control.dataset.foley = "off";
  const deckEditors = [...document.querySelectorAll(".rg-card-deck")];
  const berryImages = {
    faroe: "/ramblegamble/assets/berries/faroeberry.png",
    erin: "/ramblegamble/assets/berries/erinberry.png",
    kaz: "/ramblegamble/assets/berries/kazberry.png",
  };
  const playerNames = { faroe: "FAROE", erin: "ERIN", kaz: "KAZ" };
  const modeNames = { "red-handed": "RED HANDED", quiplash: "BERRYBLAST", shop: "THE SHOP" };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let state = readCardGames();
  if (state.round && ["red-handed", "quiplash"].includes(state.round.mode) && !state.round.id) state = writeCardGames({ ...state, round: { ...state.round, id: newRoundId() } }).state;
  let network = null;
  let pointScores = readPointScores();
  let shopBalanceNodes = new Map();
  let menuOpen = false;
  // A restored round is not an instruction to open its interface.
  let dismissedActive = Boolean(activeCardStage(state));
  let selectedBuyer = "faroe";
  let lastActiveStage = activeCardStage(state);
  let smeemoPhaseTimer = 0;
  let smeemoScheduledSignal = "";
  let menuTimer = 0;
  let menuSelection = "";
  let menuGeneration = 0;
  let lastPresentation = { id: null, visible: [], phase: null };
  let shopPresentation = { id: null, revealed: new Set() };
  let smeemoPresentation = { id: null, revealed: new Set() };
  const preview = $(".rg-preview");
  const impact = createSmeemoImpact({
    requestFrame: fn => window.requestAnimationFrame(fn), cancelFrame: id => window.cancelAnimationFrame(id),
    now: () => performance.now(),
    canRun: () => !document.hidden && !document.documentElement?.hasAttribute("data-rg-host-locked")
      && !dismissedActive && !menuOpen && !layer.hidden && state.smeemo
      && !preview.classList.contains("is-menu") && !preview.classList.contains("is-dice-mode"),
    isVisible: () => !layer.classList.contains("is-off-table"),
    reduced: () => reducedMotion.matches,
    size: () => ({ width: preview.clientWidth, height: preview.clientHeight }),
    paint: ({ energy, x, y, scale, uiX, uiY, uiScale }) => {
      const vars = { "--quake-x": `${x}px`, "--quake-y": `${y}px`, "--quake-scale": scale,
        "--quake-ui-x": `${uiX}px`, "--quake-ui-y": `${uiY}px`, "--quake-ui-scale": uiScale, "--quake-energy": energy };
      for (const [key, value] of Object.entries(vars)) preview.style.setProperty(key, String(value));
      preview.classList.add("is-smeemo-impact");
    },
    clear: () => preview.classList.remove("is-smeemo-impact"),
    sound: (event, spec) => {
      foley.start("smeemo-rumble", "smeemoRumble", { volume: .75 + spec.strength * .25 });
      if (event.kind === "win") {
        foley.stop("smeemo-hit");
        foley.start("smeemo-win", "smeemoWin", { maxDelay: 350 });
      } else foley.start("smeemo-hit", "smeemoHit", { rate: spec.rate, endRate: spec.rate * 1.12, volume: .8 + spec.strength * .2 });
    },
    stopSound: () => { for (const channel of ["smeemo-rumble", "smeemo-hit", "smeemo-win"]) foley.stop(channel); },
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) impact.stop(); });
  window.addEventListener("pagehide", impact.stop);


  function element(tag, className = "", text = "") {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== "") item.textContent = text;
    return item;
  }

  function setStageTitle(value, mode = "") {
    title.textContent = value;
    title.classList.toggle("rg-visually-hidden", mode === "menu");
    if (mode) header.dataset.cardMode = mode;
    else delete header.dataset.cardMode;
  }

  function saveDeckInputs({ report = true } = {}) {
    const shop = {};
    const invalid = [];
    for (const category of CARD_GAME_CATEGORIES) {
      const parsed = parseShopCardList(shopInputs[category].value);
      shop[category] = parsed.cards;
      if (parsed.invalid.length) invalid.push(`${category}: ${parsed.invalid.slice(0, 2).join(", ")}`);
    }
    if (invalid.length) {
      if (report) adminStatus.textContent = `Fix shop lines: ${invalid.join("; ")}`;
      return null;
    }
    return {
      evidence: normalizeTextList(evidenceInput.value),
      suspects: normalizeTextList(suspectInput.value),
      quiplash: normalizeTextList(quiplashInput.value),
      shop,
    };
  }

  function loadDeckInputs(decks) {
    const values = [
      [evidenceInput, decks.evidence],
      [suspectInput, decks.suspects],
      [quiplashInput, decks.quiplash],
      ...CARD_GAME_CATEGORIES.map((category) => [shopInputs[category], decks.shop[category].map(({ name, price }) => `${name} [${price}]`)]),
    ];
    for (const [input, list] of values) {
      if (document.activeElement === input) continue;
      input.value = list.map((entry) => typeof entry === "string" ? entry : `${entry.name} [${entry.price}]`).join("\n");
    }
  }

  function setDeckVisibility() {
    const mode = modeSelect.value;
    for (const editor of deckEditors) editor.hidden = editor.dataset.deckFor !== mode;
    $("#rg-card-network").hidden = mode === "shop" && !["red-handed", "quiplash"].includes(state.round?.mode);
  }

  function setAnswerChoices(round, player) {
    answerSelect.replaceChildren();
    const answers = round?.mode === "red-handed" ? round.hands?.[player] || [] : [];
    for (const [index, answer] of answers.entries()) {
      const option = element("option", "", answer);
      option.value = answer;
      option.dataset.handIndex = String(index);
      answerSelect.append(option);
    }
    answerSelect.disabled = !answers.length || Boolean(round?.submissions?.[player]);
    if (answers.length && !answers.includes(answerSelect.value)) answerSelect.value = answers[0];
  }

  function setAdminState(current) {
    const round = current.round;
    const activeMode = round?.mode || "";
    const isSubmitting = Boolean(round && ["red-handed", "quiplash"].includes(round.mode) && round.phase === "submissions");
    privateEntry.hidden = !isSubmitting;
    answerChoiceWrap.hidden = round?.mode !== "red-handed";
    answerTextWrap.hidden = round?.mode !== "quiplash";
    answerText.disabled = round?.mode !== "quiplash" || Boolean(round?.submissions?.[playerSelect.value]);
    submitButton.disabled = !isSubmitting || Boolean(round?.submissions?.[playerSelect.value]);
    voteControls.hidden = !round || !["reveal", "voting"].includes(round.phase);
    revealButton.disabled = !round?.responses?.length;
    revealButton.textContent = round?.phase === "reveal" ? "REVEAL NEXT" : "REVEAL RESULTS";
    shopAdmin.hidden = round?.mode !== "shop" || round.phase !== "shopping";
    if (round?.mode === "red-handed") setAnswerChoices(round, playerSelect.value);
    if (!round) adminStatus.textContent = "Add decks, then choose a game.";
    else if (round.phase === "submissions") {
      const submitted = CARD_GAME_PLAYERS.filter((player) => round.submissions[player]).length;
      adminStatus.textContent = `${modeNames[activeMode]} - ${submitted} of 3 submitted.`;
    } else if (round.phase === "reveal") adminStatus.textContent = `${round.revealedCount || 0} / ${round.responses.length} revealed.`;
    else if (round.phase === "voting") adminStatus.textContent = "Answers are revealed without names. Audience votes on the card table.";
    else if (round.phase === "results") adminStatus.textContent = "Results are on the card table.";
    else if (round.phase === "shopping") adminStatus.textContent = "Choose a buyer on the card table, then select a face-down card.";
    resetButton.hidden = !round;
  }

  function updateFromState(next) {
    const before = state?.round, after = next?.round;
    const previousSmeemo = state?.smeemo;
    if (!dismissedActive && !menuOpen && before?.id && before.id === after?.id && !layer.hidden) {
      const prior = Object.values(before.submissions || {}).filter(Boolean).length;
      const current = Object.values(after.submissions || {}).filter(Boolean).length;
      if (current > prior) foley.play(after.phase === "reveal" ? "cardFan" : "submit");
      if ((after.revealedCount || 0) > (before.revealedCount || 0)) foley.play("flip");
      if (after.phase === "results" && before.phase !== "results") foley.play("confirm");
    }
    const decksChanged = JSON.stringify(state?.decks) !== JSON.stringify(next.decks);
    state = next;
    if (decksChanged) loadDeckInputs(state.decks);
    setDeckVisibility();
    setAdminState(state);
    network?.publish();

    const { active, opened, ended } = cardStageChange(lastActiveStage, state);
    lastActiveStage = active;
    const activeSmeemo = active?.mode === "smeemo";
    if (!activeSmeemo || dismissedActive || menuOpen) {
      impact.stop();
      window.clearTimeout(smeemoPhaseTimer);
      smeemoPhaseTimer = 0;
      smeemoScheduledSignal = "";
    }
    if (opened) {
      impact.stop(); // No tail from a previous round may leak into this one.
      foley.stop("card-menu-hover");
      if (!activeSmeemo) foley.start("cards-motion", "deal");
      else foley.stop("cards-motion");
      menuOpen = false;
      dismissedActive = false;
      window.clearTimeout(menuTimer);
      menuTimer = 0;
      window.dispatchEvent(new CustomEvent("rg:card-game-active", { detail: { mode: active.mode } }));
    } else if (ended && !menuOpen && !dismissedActive) {
      layer.hidden = true;
      content.replaceChildren();
      window.dispatchEvent(new Event("rg:close-card-games"));
    }
    // The menu has no saved-round controls. Background updates never rebuild it.
    if (menuOpen) return;
    if (dismissedActive || !active) layer.hidden = true;
    else if (activeSmeemo) {
      const unchanged = !opened && !layer.hidden && previousSmeemo?.id === state.smeemo.id
        && previousSmeemo.phase === state.smeemo.phase && previousSmeemo.status === state.smeemo.status
        && JSON.stringify(previousSmeemo.draws) === JSON.stringify(state.smeemo.draws);
      if (!unchanged) renderSmeemo(state.smeemo);
      const event = smeemoImpactTransition(previousSmeemo, state.smeemo, opened);
      if (event) {impact.trigger(event);audienceReact(event.kind==="win"?"shock":"suspense");}
    }
    else renderRound(state.round);
  }

  function sync(next) {
    const result = writeCardGames(next, { requirePersistence: true });
    if (!result.persisted) throw Error("Could not save game state.");
    updateFromState(result.state);
    return result;
  }

  const smeemoPhaseDurations = { preview: 1650, stacking: 1100, stacked: 780, dealing: 1230 };
  const smeemoNextPhase = { preview: "stacking", stacking: "stacked", stacked: "dealing", dealing: "ready" };

  function scheduleSmeemoAdvance(game) {
    const duration = smeemoPhaseDurations[game.phase];
    const nextPhase = smeemoNextPhase[game.phase];
    if (!duration || !nextPhase || game.status !== "playing") {
      window.clearTimeout(smeemoPhaseTimer);
      smeemoPhaseTimer = 0;
      smeemoScheduledSignal = "";
      return;
    }
    const signal = `${game.id}:${game.phase}`;
    if (smeemoScheduledSignal === signal) return;
    window.clearTimeout(smeemoPhaseTimer);
    smeemoScheduledSignal = signal;
    const wait = reducedMotion.matches ? 70 : duration;
    smeemoPhaseTimer = window.setTimeout(() => {
      smeemoPhaseTimer = 0;
      smeemoScheduledSignal = "";
      // Automatic show animation is safe to advance while host controls are locked.
      withRoomSubmissionLock(() => {
        const current = readCardGames(), latest = current.smeemo;
        if (dismissedActive || menuOpen || layer.hidden || !latest || latest.id !== game.id || latest.phase !== game.phase) return;
        const advanced = advanceSmeemoPhase(latest, game.phase);
        if (advanced === latest) return;
        if (!dismissedActive && !layer.hidden && !document.documentElement?.hasAttribute("data-rg-host-locked")) {
          if (advanced.phase === "stacking") foley.start("cards-motion", "shuffle");
          if (advanced.phase === "dealing") foley.start("cards-motion", "deal");
        }
        sync({ ...current, smeemo: advanced });
      }).catch(error => { liveStatus.textContent = error.message; });
    }, wait);
  }

  function closeHostPanel() {
    window.dispatchEvent(new Event("rg:close-host-panel"));
  }

  function openHostPanel(mode = state.round?.mode) {
    if (typeof mode === "string" && modeNames[mode]) modeSelect.value = mode;
    setDeckVisibility();
    window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "card-games" } }));
  }

  // The stable outer button owns hit testing; only its visual carrier tilts.
  function bindCardTilt(button) {
    const reset = () => { button.style.removeProperty("--tilt-x"); button.style.removeProperty("--tilt-y"); };
    button.addEventListener("pointermove", event => {
      if (reducedMotion.matches || event.pointerType === "touch" || event.buttons || button.disabled) return reset();
      const rect = button.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      button.style.setProperty("--tilt-x", `${-y * 12}deg`);
      button.style.setProperty("--tilt-y", `${x * 17}deg`);
    });
    button.addEventListener("pointerleave", reset);
    button.addEventListener("pointercancel", reset);
    button.addEventListener("blur", reset);
  }

  function makeModeChoice(mode, imageName, label) {
    const choice = element("button", "rg-mode-choice");
    choice.type = "button";
    choice.dataset.mode = mode;
    choice.setAttribute("aria-label", label);
    const card = element("span", "rg-mode-card");
    const face = (name, side) => {
      const image = element("img", `rg-mode-face rg-mode-${side}`);
      image.src = `/ramblegamble/assets/card-games/${name}`;
      image.alt = "";
      image.draggable = false;
      return image;
    };
    const stage = element("span", "rg-mode-stage");
    const depth = element("span", "rg-mode-depth");
    for (const z of [-2, 0, 2]) {
      const edge = face(imageName, "edge");
      edge.style.setProperty("--edge-z", `${z}px`);
      card.append(edge);
    }
    const sheen = element("span", "rg-mode-sheen");
    sheen.setAttribute("aria-hidden", "true");
    sheen.style.setProperty("--face-mask", `url('/ramblegamble/assets/card-games/${imageName}')`);
    card.append(face(imageName, "front"), face("menu-card-back.png", "back"), sheen);
    depth.append(card); stage.append(depth);
    choice.append(stage, element("span", "rg-mode-label", label));
    bindCardTilt(choice);
    const hover = () => {
      if (!menuOpen || menuTimer || layer.hidden || document.documentElement?.hasAttribute("data-rg-host-locked")) return;
      // Short recorded card-slide, not a second selection/flip sound.
      foley.start("card-menu-hover", "deal", { volume: .9, maxDelay: 150 });
    };
    choice.addEventListener("pointerenter", event => {
      if (event.isTrusted && (event.pointerType === "mouse" || event.pointerType === "pen")) hover();
    });
    choice.addEventListener("focus", event => {
      if (event.isTrusted && choice.matches(":focus-visible")) hover();
    });
    choice.addEventListener("click", () => chooseMode(mode, choice));
    choice.addEventListener("contextmenu", event => { event.preventDefault(); event.stopPropagation(); openHostPanel(mode); });
    return choice;
  }

  function renderMenu() {
    impact.stop();
    foley.stop("card-menu-hover");
    window.clearTimeout(menuTimer);
    menuTimer = 0;
    menuSelection = "";
    menuGeneration++;
    layer.hidden = false;
    setStageTitle("Choose a card game", "menu");
    liveStatus.textContent = "Choose a card game.";
    lastPresentation = { id: null, visible: [], phase: null };
    shopPresentation = { id: null, revealed: new Set() };
    smeemoPresentation = { id: null, revealed: new Set() };
    content.replaceChildren();
    const grid = element("div", "rg-card-menu-grid");
    grid.append(
      makeModeChoice("red-handed", "menu-red-handed-face.png", "Red-Handed"),
      makeModeChoice("quiplash", "menu-quiplash-face.png", "BerryBlast"),
      makeModeChoice("shop", "menu-shop-face.png", "Shop"),
    );
    content.append(grid);
  }

  function chooseMode(mode, choice) {
    if (!menuOpen || menuTimer || menuSelection) return;
    const generation = menuGeneration;
    const expectedStage = activeCardStage(state)?.key;
    foley.stop("card-menu-hover");
    foley.play("flip");
    const grid = choice.parentElement;
    menuSelection = mode;
    grid.classList.add("is-choosing", "is-animating");
    for (const button of grid.children) button.classList.toggle("is-selected", button === choice);
    modeSelect.value = mode;
    setDeckVisibility();
    menuTimer = window.setTimeout(() => {
      menuTimer = 0;
      grid.classList.remove("is-animating");
      if (!menuOpen) return;
      if (document.documentElement?.hasAttribute("data-rg-host-locked")) { renderMenu(); return; }
      runRoomMutation(() => {
        // A queued selection must not replace a newer round or a closed menu.
        if (!menuOpen || menuSelection !== mode || generation !== menuGeneration) return;
        const latest = readCardGames();
        if (activeCardStage(latest)?.key !== expectedStage) { updateFromState(latest); return; }
        const next = applyCardShowAction(latest, "start", { mode });
        sync(next); closeHostPanel();
      }, error => { if (menuOpen && generation === menuGeneration) { renderMenu(); content.append(element("p", "rg-show-notice", error.message)); } else adminStatus.textContent = error.message; });
    }, reducedMotion.matches ? 20 : 940);
  }

  function berryProgress(round) {
    const progress = element("div", "rg-card-progress");
    progress.setAttribute("aria-label", "Player submission status");
    for (const player of CARD_GAME_PLAYERS) {
      const item = element("div", `rg-card-player-progress${round.submissions[player] ? " is-submitted" : ""}`);
      {
        const image = element("img");
        image.src = berryImages[player];
        image.alt = `${playerNames[player]} ${round.submissions[player] ? "submitted" : "waiting"}`;
        item.append(image);
      }
      progress.append(item);
    }
    return progress;
  }

  function promptCard(text, type = "suspect") {
    const card = element("div", `rg-card-prompt is-${type}`);
    const copy = element("div", "rg-card-prompt-copy", text);
    copy.tabIndex = 0;
    card.append(copy);
    return card;
  }

  function showAction(action, roundId, responseId) {
    return runRoomMutation(() => {
      const latest = readCardGames();
      if (activeRoomRound()?.id !== roundId) throw Error("Round changed.");
      const next = applyCardShowAction(latest, action, { roundId, responseId });
      sync(next);
      if (action === "vote") foley.play("vote");
    });
  }

  function renderRound(round) {
    layer.hidden = false;
    setStageTitle(modeNames[round.mode] || "CARD TABLE", round.mode);
    if (round.mode === "shop") { renderShop(round); return; }
    const visible = visibleCardResponses(round);
    const sameRound = lastPresentation.id === round.id;
    const fresh = new Set(visible.filter(r => !sameRound || !lastPresentation.visible.includes(r.id)).map(r => r.id));
    const resultsNow = round.phase === "results" && (!sameRound || lastPresentation.phase !== "results");
    const previousVotes=lastPresentation.votes||{};
    lastPresentation = { id: round.id, visible: visible.map(r => r.id), phase: round.phase, votes:{...round.votes} };
    if(sameRound&&!layer.classList.contains("is-off-table")){if(resultsNow)audienceReact("cheer");else if(fresh.size)audienceReact("suspense");}
    content.replaceChildren();
    const shell = element("div", `rg-card-round rg-show-round${round.mode === "quiplash" ? " is-berryblast" : " is-red-handed"}`);
    const promptSide = element("div", "rg-card-prompt-side");
    const prompt = promptCard(round.prompt, round.mode === "red-handed" ? "suspect" : "quiplash");
    if (!sameRound) prompt.classList.add("rg-prompt-deal");
    promptSide.append(prompt, berryProgress(round));
    const submitted = CARD_GAME_PLAYERS.filter(player => round.submissions[player]).length;
    const answers = element("div", "rg-card-answer-grid rg-show-answer-grid");
    const right = element("div", "rg-show-answers");
    if (round.phase === "submissions") {
      right.append(element("p", "rg-show-status", `${submitted} / 3`));
      liveStatus.textContent = `${submitted} of 3 submitted.`;
    } else {
      for (const [i, response] of visible.entries()) {
        const canVote = round.phase === "voting";
        const winner = round.phase === "results" && round.winnerIds.includes(response.id);
        const answer = element(canVote ? "button" : "article", `rg-card-answer${winner ? " is-winner" : ""}${fresh.has(response.id) ? " rg-show-reveal" : ""}${winner && resultsNow ? " rg-show-winner" : ""}`);
        if (canVote) { answer.type = "button"; answer.setAttribute("aria-label", `Vote for anonymous answer: ${response.text}`); answer.addEventListener("click", () => showAction("vote", round.id, response.id)); }
        answer.style.setProperty("--reveal-delay", `${Math.min(i, 2) * 75}ms`);
        const copy = element("span", "rg-card-answer-copy", response.text);
        if (!canVote) copy.tabIndex = 0;
        answer.append(copy);
        if (round.phase !== "reveal") answer.append(element("span", "rg-card-vote-count", `${round.votes[response.id] || 0} VOTES`));
        answers.append(answer);
        if(sameRound&&!resultsNow&&round.phase==="voting"&&(round.votes[response.id]||0)>(previousVotes[response.id]||0))requestAnimationFrame(()=>voteFlight(answer));
        if(winner&&resultsNow&&sameRound)requestAnimationFrame(()=>showBurst(answer,{count:20,color:"#ffe476"}));
      }
      if (round.phase === "reveal") {
        for (let i = visible.length; i < round.responses.length; i++) {
          const back = element("div", "rg-show-answer-back");
          back.setAttribute("aria-label", "Unrevealed answer");
          answers.append(back);
        }
        liveStatus.textContent = `${visible.length} of ${round.responses.length} answers revealed.`;
      } else liveStatus.textContent = round.phase === "results" ? "Vote results." : "Voting open.";
      right.append(answers);
    }
    const controls = element("div", "rg-show-actions");
    const addAction = (label, action) => {
      const button = element("button", "rg-card-room-button rg-show-action", label);
      button.type = "button"; button.dataset.foley = "off";
      button.addEventListener("click", () => showAction(action, round.id)); controls.append(button);
    };
    if (round.phase === "submissions" && submitted > 0) addAction("LOCK ANSWERS", "close");
    if (round.phase === "reveal") { addAction("REVEAL NEXT", "reveal"); if (round.responses.length - round.revealedCount > 1) addAction("ALL", "all"); }
    if (round.phase === "voting") addAction("RESULTS", "results");
    if (round.phase === "results") {
      const button = element("button", "rg-card-room-button rg-show-action", "NEW ROUND");
      button.type = "button"; button.dataset.foley = "off";
      button.addEventListener("click", () => runRoomMutation(() => {
        const latest = readCardGames(); if (latest.round?.id !== round.id) return;
        sync(applyCardShowAction(latest, "start", { mode: round.mode }));
      }, error => { liveStatus.textContent = error.message; content.append(element("p", "rg-show-notice", error.message)); })); controls.append(button);
    }
    right.append(controls); shell.append(promptSide, right); content.append(shell);
  }

  const shopColors = { faroe: "#54e49b", erin: "#be9aff", kaz: "#ffde63" };
  function selectShopBuyer(view, player) {
    selectedBuyer = player;
    view.shell.style.setProperty("--shop-buyer-color", shopColors[player]);
    for (const [name, node] of view.buyers) node.setAttribute("aria-pressed", String(name === player));
  }

  function refreshShopCard(view, entry, card, animate) {
    const { button, wrap, front, price, owner } = entry;
    // All hidden data stays out of the document until the purchase is committed.
    const signature = JSON.stringify([card.revealed, card.buyer, card.price, card.revealed ? card.name : null]);
    if (entry.signature === signature) return;
    const newlyRevealed = animate && card.revealed && !entry.revealed;
    entry.signature = signature;
    entry.revealed = Boolean(card.revealed);
    button.disabled = Boolean(card.buyer);
    button.classList.toggle("is-revealed", Boolean(card.revealed));
    button.setAttribute("aria-label", card.revealed ? `${card.category} card: ${card.name}, purchased by ${card.buyer}` : `${card.category} card, costs ${card.price} points`);
    front.replaceChildren();
    price.textContent = `${card.price} POINTS`;
    owner.textContent = card.buyer ? playerNames[card.buyer] : "";
    owner.hidden = !card.buyer;
    if (card.revealed) {
      front.append(element("span", "rg-shop-card-name", card.name));
      front.append(element("span", "rg-shop-card-owner", `TAKEN BY ${playerNames[card.buyer]}`));
    }
    if (card.buyer) wrap.style.setProperty("--shop-card-color", shopColors[card.buyer]);
    else wrap.style.removeProperty("--shop-card-color");
    if (newlyRevealed) {
      button.classList.add("is-newly-revealed");
      wrap.classList.add("rg-purchase-impact");
      // Allow one browser paint to establish the revealed card geometry.
      requestAnimationFrame(() => {
        if (content.children[0] !== view.shell || layer.hidden || layer.classList.contains("is-off-table") || !entry.revealed) return;
        purchaseFlight(wrap, view.buyers.get(card.buyer), card.price);
      });
      window.setTimeout(() => { button.classList.remove("is-newly-revealed"); wrap.classList.remove("rg-purchase-impact"); }, 1450);
    } else if (!card.revealed) {
      button.classList.remove("is-newly-revealed"); wrap.classList.remove("rg-purchase-impact");
    }
  }

  function renderShop(round) {
    // Preserve DOM identity during balance notifications, buyer selection and
    // duplicate room publications; in-flight card turns must not restart.
    const structure = JSON.stringify(round.cards.map(card => [card.id, card.category]));
    if (shopPresentation.id === round.id && shopPresentation.structure === structure && content.children[0] === shopPresentation.shell) {
      selectShopBuyer(shopPresentation, selectedBuyer);
      for (const card of round.cards) refreshShopCard(shopPresentation, shopPresentation.cards.get(card.id), card, true);
      return;
    }
    const shell = element("div", "rg-shop-stage");
    const view = { id: round.id, structure, shell, buyers: new Map(), cards: new Map() };
    shopPresentation = view;
    const buyers = element("div", "rg-shop-buyers");
    for (const player of CARD_GAME_PLAYERS) {
      const button = element("button", "rg-shop-buyer");
      button.type = "button";
      button.style.setProperty("--shop-seat-color", shopColors[player]);
      const image = element("img");
      image.src = berryImages[player];
      image.alt = "";
      button.append(image, element("span", "", playerNames[player]));
      button.addEventListener("click", () => {
        if (shopPresentation !== view || layer.hidden || selectedBuyer === player) return;
        foley.play("select");
        selectShopBuyer(view, player);
        showBurst(button, { color: shopColors[player], count: 8 });
      });
      buyers.append(button); view.buyers.set(player, button);
    }
    shell.append(buyers); selectShopBuyer(view, selectedBuyer);
    const balances = element("div", "rg-shop-balance");
    shopBalanceNodes = new Map();
    for (const player of CARD_GAME_PLAYERS) {
      const node = element("span", "rg-shop-balance-value", `${playerNames[player]} ${pointScores[player] || 0}`);
      node.style.setProperty("--shop-seat-color", shopColors[player]);
      shopBalanceNodes.set(player, node); balances.append(node);
    }
    shell.append(balances);
    const grid = element("div", "rg-shop-card-grid");
    for (const [index, card] of round.cards.entries()) {
      const wrap = element("div", "rg-shop-card-wrap");
      const button = element("button", "rg-shop-card");
      button.type = "button";
      wrap.style.setProperty("--deal-delay", `${index * 135}ms`);
      wrap.style.setProperty("--deal-turn", `${(index - 1) * 24}deg`);
      wrap.style.setProperty("--deal-shift", `${(index - 1) * 12}%`);
      wrap.style.setProperty("--shop-category-color", ["#ff7881", "#c6a0ff", "#71e2ae"][index % 3]);
      bindCardTilt(button);
      const motion = element("span", "rg-shop-card-motion rg-shop-deal");
      window.setTimeout(() => motion.classList.remove("rg-shop-deal"), 1000 + index * 135);
      const drift = element("span", "rg-shop-card-drift");
      const inner = element("span", "rg-shop-card-inner");
      const back = element("span", "rg-shop-card-back");
      back.setAttribute("aria-hidden", "true");
      const front = element("span", "rg-shop-card-front");
      for (const z of [-3, 0, 3]) {
        const edge = element("span", "rg-shop-card-edge");
        edge.style.setProperty("--shop-edge-z", `${z}px`);
        edge.setAttribute("aria-hidden", "true"); inner.append(edge);
      }
      inner.append(back, front); drift.append(inner); motion.append(drift); button.append(motion);
      button.addEventListener("click", () => {
        const buyer = selectedBuyer;
        return runRoomMutation(() => withPointScoresLock(() => {
          if (document.documentElement?.hasAttribute("data-rg-host-locked")) return;
          const latest = readCardGames();
          if (latest.round?.id !== round.id || latest.smeemo || dismissedActive || layer.hidden || menuOpen || shopPresentation !== view || content.children[0] !== view.shell || layer.classList.contains("is-off-table")) return;
          const priorScores = readPointScores({ strict: true });
          const purchase = buyShopCard(latest.round, card.id, buyer, priorScores);
          if (purchase.error) {
            const message = purchase.error === "not-enough-points" ? `${playerNames[buyer]} needs more points.` : "That card is no longer available.";
            foley.play("error");
            setStatusMessage(message);
            return;
          }
          const savedScores = writePointScores(purchase.scores);
          if (!savedScores.persisted) throw Error("Could not save points; purchase cancelled.");
          let savedRound;
          try {
            savedRound = writeCardGames({ ...latest, round: purchase.round }, { requirePersistence: true });
            if (!savedRound.persisted) throw Error("Could not save game state.");
          } catch (error) {
            if (!writePointScores(priorScores).persisted) throw Error("Purchase could not be saved or refunded; check points in the console.");
            throw error;
          }
          pointScores = savedScores.scores;
          updateFromState(savedRound.state);
          foley.play("flip");
          foley.play("purchase");
          audienceReact("cheer");
          const bought = purchase.round.cards.find(entry => entry.id === card.id);
          setStatusMessage(`${playerNames[buyer]} bought ${bought.name}.`);
        }), error => {
          const message = error.message || "Purchase failed; retry.";
          if (shopPresentation === view && !layer.hidden) setStatusMessage(message);
          else adminStatus.textContent = message;
        });
      });
      const label = element("span", "rg-shop-card-type", `${card.category} card`);
      const price = element("span", "rg-shop-card-price");
      const owner = element("span", "rg-shop-card-owner rg-shop-owner-tag");
      wrap.append(button, label, price, owner);
      const entry = { button, wrap, front, price, owner, revealed: false, signature: null };
      view.cards.set(card.id, entry); refreshShopCard(view, entry, card, false);
      grid.append(wrap);
    }
    shell.append(grid, element("p", "rg-card-round-status", "Choose a berry, then a card."));
    content.replaceChildren(shell);
    liveStatus.textContent = "Shop is open. Choose a berry, then a card.";
  }

  function renderSmeemo(game) {
    layer.hidden = false;
    setStageTitle("SMEEMO SCRAMBLE", "smeemo");
    content.replaceChildren();
    const board = element("div", `rg-smeemo-board is-${game.phase}`);
    const railViewport = element("div", "rg-smeemo-rail-viewport");
    const rail = element("div", "rg-smeemo-rail");
    const revealIds = new Set(game.draws.map(({ id }) => id));
    const priorReveals = smeemoPresentation.id === game.id ? smeemoPresentation.revealed : revealIds;
    smeemoPresentation = { id: game.id, revealed: revealIds };
    const order = ["preview", "stacking", "stacked"].includes(game.phase)
      ? game.previewOrder.map((id) => game.cards.find((card) => card.id === id)).filter(Boolean)
      : game.cards;

    for (const [index, card] of order.entries()) {
      const revealed = revealIds.has(card.id);
      const showingFront = revealed;
      const smeemoRevealed = revealed && card.smeemo;
      const isAvailable = game.phase === "ready" && game.status === "playing" && !revealed;
      const button = element("button", `rg-smeemo-card${showingFront ? " is-face-up" : " is-face-down"}${revealed ? " is-revealed" : ""}${isAvailable ? " is-available" : ""}${smeemoRevealed ? " is-smeemo" : ""}`);
      button.type = "button";
      button.dataset.foley = "off"; // Only committed reveal emits the impact.
      button.disabled = game.phase !== "ready" || game.status !== "playing" || revealed;
      if (revealed && !priorReveals.has(card.id)) button.classList.add("is-newly-revealed");
      bindCardTilt(button);
      button.setAttribute("aria-label", showingFront
        ? `Card ${index + 1}: ${card.smeemo ? "Smeemoberry" : "blank"}`
        : `Reveal card ${index + 1}`);
      button.style.setProperty("--card-index", String(index));
      button.style.setProperty("--stack-delay", `${index * 38}ms`);
      button.style.setProperty("--deal-delay", `${index * 54}ms`);
      button.style.setProperty("--flip-delay", `${index * 48 + 90}ms`);
      button.style.setProperty("--home-rotation", `${((index % 3) - 1) * 1.4}deg`);
      const inner = element("span", "rg-smeemo-card-inner");
      const front = element("span", `rg-smeemo-card-front${smeemoRevealed ? " is-berry" : ""}`);
      if (smeemoRevealed) {
        const berryMark = element("img", "rg-smeemo-berry-mark");
        berryMark.src = "/ramblegamble/assets/berries/smeemo-card-mark.png";
        berryMark.alt = "";
        berryMark.setAttribute("aria-hidden", "true");
        front.append(berryMark);
      }
      if (revealed) front.append(element("span", "rg-smeemo-face-label", smeemoRevealed ? "SMEEMO!" : "BLANK"));
      const back = element("span", "rg-smeemo-card-back");
      back.setAttribute("aria-hidden", "true");
      inner.append(front, back);
      button.append(inner);
      button.addEventListener("click", () => runRoomMutation(() => {
        const latest = readCardGames(), current = latest.smeemo;
        if (dismissedActive || menuOpen || layer.hidden || layer.classList.contains("is-off-table") || !current || current.id !== game.id) return;
        const result = drawSmeemoCard(current, card.id);
        if (result.error) return;
        sync({ ...latest, smeemo: result.game });
        window.queueMicrotask(() => content.querySelector(".rg-smeemo-card.is-available")?.focus({ preventScroll: true }));
      }));
      rail.append(button);
    }

    railViewport.append(rail);
    board.append(railViewport);
    content.append(board);
    if (["stacking", "stacked", "dealing"].includes(game.phase)) {
      const railRect = railViewport.getBoundingClientRect();
      const stackCenter = railRect.left + railRect.width / 2;
      for (const [index, card] of [...rail.children].entries()) {
        const rect = card.getBoundingClientRect();
        const dx = stackCenter - (rect.left + rect.width / 2);
        card.style.setProperty("--stack-x", `${dx}px`);
        card.style.setProperty("--mid-x", `${dx * 0.42}px`);
        card.style.setProperty("--stack-layer-x", `${(index - 4) * 1.25}px`);
        card.style.setProperty("--stack-layer-y", `${(4 - index) * 1.25}px`);
        card.style.setProperty("--stack-rotation", `${(index - 4) * 3}deg`);
      }
    }

    let statusText = `${game.draws.length} / 9 REVEALED`;
    if (game.phase === "preview") statusText = "FIND THE SMEEMOBERRY";
    else if (["stacking", "stacked", "dealing"].includes(game.phase)) statusText = "SHUFFLING...";
    else if (game.phase === "ready" && game.status === "playing") statusText += " - CHOOSE A CARD";
    else if (game.status === "complete") statusText = "SMEEMOBERRY FOUND!";
    if (game.status === "complete") {
      const newlyWon = game.draws.some(draw => draw.smeemo && !priorReveals.has(draw.id));
      content.append(element("p", `rg-smeemo-winner${newlyWon ? " is-newly-won" : ""}`, statusText));
    } else content.append(element("p", "rg-card-round-status rg-smeemo-status", statusText));
    liveStatus.textContent = statusText;
    scheduleSmeemoAdvance(game);
  }

  function setStatusMessage(message) {
    adminStatus.textContent = message;
    liveStatus.textContent = message;
    const status = content.querySelector(".rg-card-round-status");
    if (status) status.textContent = message;
  }

  function saveDecks() {
    const decks = saveDeckInputs();
    if (!decks) return false;
    const next = { ...readCardGames(), decks };
    const result = sync(next);
    adminStatus.textContent = result.persisted ? "Lists saved in this browser." : "Saved for open tabs only; browser storage is unavailable.";
    return true;
  }

  function startSelectedGame() {
    const decks = saveDeckInputs();
    if (!decks) return;
    let round = null;
    if (modeSelect.value === "red-handed") round = createRedHandedRound(decks.evidence, decks.suspects);
    if (modeSelect.value === "quiplash") round = createQuiplashRound(decks.quiplash);
    if (modeSelect.value === "shop") round = createShopRound(decks.shop);
    if (!round) {
      foley.play("error");
      adminStatus.textContent = modeSelect.value === "red-handed"
        ? "Add at least one A-card and one B-card."
        : modeSelect.value === "quiplash"
          ? "Add at least one prompt."
          : "Add at least one priced card to each shop list.";
      return;
    }
    const next = { ...readCardGames(), decks, round, smeemo: null };
    sync(next);
    closeHostPanel();
  }

  function submitPrivateAnswer() {
    const expectedId = state.round?.id;
    const player = playerSelect.value;
    const answer = state.round?.mode === "red-handed" ? answerSelect.value : answerText.value;
    runRoomMutation(() => {
    const latest = readCardGames();
    const round = latest.round;
    if (!expectedId || round?.id !== expectedId) { adminStatus.textContent = "Round changed; choose the answer again."; return; }
    const updated = submitRoundAnswer(round, player, answer);
    if (updated === round) {
      foley.play("error");
      adminStatus.textContent = "Choose an A-card or enter an answer first.";
      return;
    }
    answerText.value = "";
    sync({ ...latest, round: updated });
    closeHostPanel();
    });
  }

  function openCardMenu() {
    foley.play("cardFan");
    menuOpen = true;
    dismissedActive = Boolean(activeCardStage(state));
    renderMenu();
    window.dispatchEvent(new CustomEvent("rg:card-game-active", { detail: { mode: "menu" } }));
    closeHostPanel();
  }

  function runRoomMutation(action, onError = error => { adminStatus.textContent = error.message || "Card room update failed; retry."; liveStatus.textContent = adminStatus.textContent; if(!layer.hidden) content.append(element("p", "rg-show-notice", adminStatus.textContent)); }) {
    return withRoomSubmissionLock(() => {
      if (document.documentElement?.hasAttribute("data-rg-host-locked")) return;
      return action();
    }).catch(onError);
  }
  saveButton.addEventListener("click", () => runRoomMutation(saveDecks));
  startButton.addEventListener("click", () => runRoomMutation(startSelectedGame));
  menuButton.addEventListener("click", openCardMenu);
  modeSelect.addEventListener("change", setDeckVisibility);
  playerSelect.addEventListener("change", () => setAdminState(state));
  submitButton.addEventListener("click", submitPrivateAnswer);
  answerText.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); submitPrivateAnswer(); } });
  revealButton.addEventListener("click", () => showAction(state.round?.phase === "reveal" ? "reveal" : "results", state.round?.id));
  layer.addEventListener("contextmenu", event => { event.preventDefault(); openHostPanel(menuOpen ? menuSelection || modeSelect.value : state.round?.mode); });
  resetButton.addEventListener("click", () => runRoomMutation(() => {
    impact.stop();
    foley.stop("cards-motion");
    foley.play("erase");
    sync({ ...readCardGames(), round: null, smeemo: null });
    adminStatus.textContent = "Current card game reset.";
  }));
  shopRefreshButton.addEventListener("click", () => runRoomMutation(() => {
    const latest = readCardGames();
    const round = createShopRound(latest.decks.shop);
    if (!round) {
      foley.play("error");
      adminStatus.textContent = "Add at least one priced card to each shop list.";
      return;
    }
    selectedBuyer = "faroe";
    sync({ ...latest, round, smeemo:null });
    closeHostPanel();
  }));
  roomButton.addEventListener("click", () => {
    impact.stop();
    foley.stop("card-menu-hover");
    foley.stop("cards-motion");
    menuOpen = false;
    dismissedActive = Boolean(activeCardStage(state));
    window.clearTimeout(smeemoPhaseTimer);
    smeemoPhaseTimer = 0;
    smeemoScheduledSignal = "";
    window.clearTimeout(menuTimer);
    menuTimer = 0;
    layer.hidden = true;
    window.dispatchEvent(new Event("rg:close-card-games"));
  });
  window.addEventListener("rg:show-card-menu", () => {
    // Repeated table clicks are not permission to interrupt a running game.
    if (!layer.hidden || menuOpen) return;
    menuOpen = true;
    dismissedActive = Boolean(activeCardStage(state));
    renderMenu();
  });

  network = mountCardRoom($("#rg-card-network"), { getRound: () => activeRoomRound(), commitDraft:writeLiveTriviaDraft, commitRound: round => { if(round.mode==='trivia')return writeLiveTrivia(round); const result = writeCardGames({ ...readCardGames(), round }, { requirePersistence: true }); if (result.persisted) { updateFromState(result.state); } return result.persisted; }, onStatus: message => { adminStatus.textContent = message; } });
  loadDeckInputs(state.decks);
  setDeckVisibility();
  subscribeCardGames(updateFromState);
  subscribeLiveTrivia(()=>network.publish(),{drafts:false});
  window.addEventListener("rg:trivia-stage-open",()=>{ impact.stop(); foley.stop("card-menu-hover"); menuOpen=false; dismissedActive=Boolean(activeCardStage(state)); window.clearTimeout(smeemoPhaseTimer); smeemoPhaseTimer=0; window.clearTimeout(menuTimer); menuTimer=0; layer.hidden=true; });
  subscribePointScores((scores) => {
    pointScores = scores;
    for (const [player, node] of shopBalanceNodes) node.textContent = `${playerNames[player]} ${scores[player]}`;
  });
})();
