import {
  CARD_GAME_CATEGORIES,
  CARD_GAME_PLAYERS,
  createQuiplashRound,
  createRedHandedRound,
  createShopRound,
  advanceSmeemoPhase,
  drawSmeemoCard,
  normalizeTextList,
  parseShopCardList,
  recordAudienceVote,
  revealAudienceResults,
  submitRoundAnswer,
  buyShopCard,
} from "./card-games.mjs?v=rg-smeemo-secret-repeat-20261126-v2";
import { readCardGames, writeCardGames, subscribeCardGames } from "./card-games-store.mjs?v=rg-smeemo-secret-repeat-20261126-v2";
import { readPointScores, subscribePointScores, writePointScores } from "./points-store.mjs?v=points-console-20261120-v1";

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const layer = $("#rg-card-games-layer");
  const header = $(".rg-card-games-header", layer);
  const title = $("#rg-card-games-title");
  const content = $("#rg-card-games-content");
  const liveStatus = $("#rg-card-live-status");
  const roomButton = $("#rg-card-room");
  const hostButton = document.createElement("button");
  hostButton.type = "button";
  hostButton.className = "rg-card-room-button rg-card-host-button";
  hostButton.textContent = "HOST";
  hostButton.setAttribute("aria-label", "Open card game host controls");
  roomButton.before(hostButton);

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
  let pointScores = readPointScores();
  let menuOpen = false;
  let dismissedActive = false;
  let selectedBuyer = "faroe";
  let lastActiveMode = null;
  let lastSmeemoId = null;
  let smeemoPhaseTimer = 0;
  let smeemoScheduledSignal = "";
  let menuTimer = 0;

  function element(tag, className = "", text = "") {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== "") item.textContent = text;
    return item;
  }

  function setStageTitle(value, mode = "") {
    title.textContent = value;
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
    voteControls.hidden = !round || round.phase !== "voting";
    revealButton.disabled = !round?.responses?.length;
    shopAdmin.hidden = round?.mode !== "shop" || round.phase !== "shopping";
    if (round?.mode === "red-handed") setAnswerChoices(round, playerSelect.value);
    if (!round) adminStatus.textContent = "Add decks, then choose a game.";
    else if (round.phase === "submissions") {
      const submitted = CARD_GAME_PLAYERS.filter((player) => round.submissions[player]).length;
      adminStatus.textContent = `${modeNames[activeMode]} - ${submitted} of 3 submitted.`;
    } else if (round.phase === "voting") adminStatus.textContent = "Answers are revealed without names. Audience votes on the card table.";
    else if (round.phase === "results") adminStatus.textContent = "Results are on the card table.";
    else if (round.phase === "shopping") adminStatus.textContent = "Choose a buyer on the card table, then select a face-down card.";
    resetButton.hidden = !round;
  }

  function updateFromState(next) {
    state = next;
    loadDeckInputs(state.decks);
    setDeckVisibility();
    setAdminState(state);

    const activeSmeemo = state.smeemo && ["playing", "complete"].includes(state.smeemo.status);
    const newSmeemoGame = Boolean(activeSmeemo && state.smeemo.id && state.smeemo.id !== lastSmeemoId);
    lastSmeemoId = activeSmeemo ? state.smeemo.id : null;
    if (!activeSmeemo) {
      window.clearTimeout(smeemoPhaseTimer);
      smeemoPhaseTimer = 0;
      smeemoScheduledSignal = "";
    }
    const nextMode = activeSmeemo ? "smeemo" : state.round?.mode || null;
    if (nextMode && (nextMode !== lastActiveMode || newSmeemoGame)) {
      lastActiveMode = nextMode;
      dismissedActive = false;
      window.dispatchEvent(new CustomEvent("rg:card-game-active", { detail: { mode: nextMode } }));
    } else if (!nextMode && lastActiveMode) {
      lastActiveMode = null;
      if (!menuOpen) {
        layer.hidden = true;
        content.replaceChildren();
      }
      window.dispatchEvent(new Event("rg:close-card-games"));
    }
    if (menuOpen && !activeSmeemo) {
      renderMenu();
    } else if (dismissedActive) {
      layer.hidden = true;
    } else if (activeSmeemo) {
      menuOpen = false;
      renderSmeemo(state.smeemo);
    } else if (state.round) {
      menuOpen = false;
      renderRound(state.round);
    } else if (menuOpen) renderMenu();
  }

  function sync(next) {
    const result = writeCardGames(next);
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
      const latest = state.smeemo;
      if (!latest || latest.id !== game.id || latest.phase !== game.phase) return;
      const advanced = advanceSmeemoPhase(latest, game.phase);
      if (advanced === latest) return;
      sync({ ...state, smeemo: advanced });
    }, wait);
  }

  function closeHostPanel() {
    window.dispatchEvent(new Event("rg:close-host-panel"));
  }

  function openHostPanel() {
    modeSelect.value = state.round?.mode && state.round.mode !== "smeemo" ? state.round.mode : modeSelect.value;
    setDeckVisibility();
    window.dispatchEvent(new CustomEvent("rg:open-host-panel", { detail: { tab: "card-games" } }));
  }

  function makeModeChoice(mode, imageName, label) {
    const choice = element("button", "rg-mode-choice");
    choice.type = "button";
    choice.dataset.mode = mode;
    choice.setAttribute("aria-label", label);
    const card = element("span", "rg-mode-card");
    const image = element("img");
    image.src = `/ramblegamble/assets/card-games/${imageName}`;
    image.alt = "";
    image.draggable = false;
    const text = element("span", "rg-mode-label", label);
    card.append(image);
    choice.append(card, text);
    choice.addEventListener("click", () => chooseMode(mode, choice));
    return choice;
  }

  function renderMenu() {
    layer.hidden = false;
    hostButton.hidden = true;
    setStageTitle("CARD TABLE", "menu");
    liveStatus.textContent = "Choose a card game.";
    content.replaceChildren();
    const grid = element("div", "rg-card-menu-grid");
    grid.append(
      makeModeChoice("red-handed", "menu-red-handed.png", "Red Handed"),
      makeModeChoice("quiplash", "menu-quiplash.png", "Berryblast"),
      makeModeChoice("shop", "menu-shop.png", "The Shop"),
    );
    content.append(grid);
  }

  function chooseMode(mode, choice) {
    window.clearTimeout(menuTimer);
    const grid = choice.parentElement;
    grid.classList.add("is-choosing");
    choice.classList.add("is-selected");
    modeSelect.value = mode;
    setDeckVisibility();
    menuTimer = window.setTimeout(() => {
      openHostPanel();
      modeSelect.focus({ preventScroll: true });
    }, reducedMotion.matches ? 20 : 760);
  }

  function berryProgress(round) {
    const progress = element("div", "rg-card-progress");
    progress.setAttribute("aria-label", "Player submission status");
    for (const player of CARD_GAME_PLAYERS) {
      const item = element("div", `rg-card-player-progress${round.submissions[player] ? " is-submitted" : ""}`);
      if (round.submissions[player]) {
        const image = element("img");
        image.src = berryImages[player];
        image.alt = `${playerNames[player]} submitted`;
        item.append(image);
      } else {
        const placeholder = element("span", "rg-card-progress-empty");
        placeholder.setAttribute("aria-hidden", "true");
        item.append(placeholder);
      }
      item.append(element("span", "", playerNames[player]));
      progress.append(item);
    }
    return progress;
  }

  function promptCard(text, type = "suspect") {
    const card = element("div", `rg-card-prompt is-${type}`);
    const copy = element("div", "rg-card-prompt-copy", text);
    card.append(copy);
    return card;
  }

  function renderRound(round) {
    layer.hidden = false;
    hostButton.hidden = false;
    setStageTitle(modeNames[round.mode] || "CARD TABLE", round.mode);
    content.replaceChildren();
    if (round.mode === "shop") {
      renderShop(round);
      return;
    }
    const prompt = promptCard(round.prompt, round.mode === "red-handed" ? "suspect" : "quiplash");
    const shell = element("div", "rg-card-round");
    const promptSide = element("div", "rg-card-prompt-side");
    promptSide.append(prompt);
    if (round.phase === "submissions") {
      const submitted = CARD_GAME_PLAYERS.filter((player) => round.submissions[player]).length;
      promptSide.append(berryProgress(round), element("p", "rg-card-round-status", `${submitted} / 3`));
      liveStatus.textContent = `${modeNames[round.mode]}: ${submitted} of 3 players have submitted.`;
      const waiting = element("div", "rg-card-waiting");
      waiting.append(element("h2", "rg-card-results-title", "ANSWERS"), element("p", "rg-card-round-status", "Waiting for all three berries."));
      shell.append(promptSide, waiting);
    } else if (round.phase === "voting") {
      const voteTotal = Object.values(round.votes).reduce((total, count) => total + count, 0);
      liveStatus.textContent = `Audience voting is open. ${voteTotal} votes cast.`;
      const answers = element("div", "rg-card-answer-grid");
      for (const response of round.responses) {
        const answer = element("button", "rg-card-answer");
        answer.type = "button";
        answer.setAttribute("aria-label", `Vote for anonymous answer: ${response.text}`);
        answer.append(element("span", "rg-card-answer-copy", response.text));
        const count = element("span", "rg-card-vote-count", `${round.votes[response.id] || 0} VOTES`);
        answer.append(count);
        answer.addEventListener("click", () => {
          const updated = recordAudienceVote(state.round, response.id);
          if (updated === state.round) return;
          sync({ ...state, round: updated });
        });
        answers.append(answer);
      }
      shell.classList.add("is-voting");
      shell.append(promptSide, answers);
    } else {
      liveStatus.textContent = "Vote results revealed.";
      const results = element("div", "rg-card-results");
      results.append(element("h2", "rg-card-results-title", round.winnerIds.length ? "VOTE RESULTS" : "NO VOTES"));
      const answers = element("div", "rg-card-answer-grid");
      const ordered = [...round.responses].sort((a, b) => (round.votes[b.id] || 0) - (round.votes[a.id] || 0));
      for (const response of ordered) {
        const answer = element("article", `rg-card-answer${round.winnerIds.includes(response.id) ? " is-winner" : ""}`);
        answer.append(element("span", "rg-card-answer-copy", response.text));
        answer.append(element("span", "rg-card-vote-count", `${round.votes[response.id] || 0} VOTES`));
        answers.append(answer);
      }
      results.append(answers);
      shell.classList.add("rg-card-results-layout");
      shell.append(promptSide, results);
    }
    content.append(shell);
  }

  function renderShop(round) {
    const shell = element("div", "rg-shop-stage");
    const buyers = element("div", "rg-shop-buyers");
    for (const player of CARD_GAME_PLAYERS) {
      const button = element("button", "rg-shop-buyer");
      button.type = "button";
      button.setAttribute("aria-pressed", String(selectedBuyer === player));
      const image = element("img");
      image.src = berryImages[player];
      image.alt = "";
      button.append(image, element("span", "", playerNames[player]));
      button.addEventListener("click", () => {
        selectedBuyer = player;
        renderShop(state.round);
      });
      buyers.append(button);
    }
    shell.append(buyers);
    const balances = element("div", "rg-shop-balance");
    for (const player of CARD_GAME_PLAYERS) balances.append(element("span", "", `${playerNames[player]} ${pointScores[player] || 0}`));
    shell.append(balances);
    const grid = element("div", "rg-shop-card-grid");
    for (const card of round.cards) {
      const wrap = element("div", "rg-shop-card-wrap");
      const button = element("button", `rg-shop-card${card.revealed ? " is-revealed" : ""}`);
      button.type = "button";
      button.disabled = Boolean(card.buyer);
      button.setAttribute("aria-label", card.revealed ? `${card.category} card: ${card.name}, purchased by ${card.buyer}` : `${card.category} card, costs ${card.price} points`);
      if (card.revealed) {
        button.append(element("span", "rg-shop-card-name", card.name));
        button.append(element("span", "rg-shop-card-owner", `TAKEN BY ${playerNames[card.buyer]}`));
      }
      button.addEventListener("click", () => {
        const purchase = buyShopCard(state.round, card.id, selectedBuyer, pointScores);
        if (purchase.error) {
          const message = purchase.error === "not-enough-points" ? `${playerNames[selectedBuyer]} needs more points.` : "That card is no longer available.";
          setStatusMessage(message);
          return;
        }
        pointScores = writePointScores(purchase.scores).scores;
        sync({ ...state, round: purchase.round });
        setStatusMessage(`${playerNames[selectedBuyer]} bought ${card.name}.`);
      });
      const label = element("span", "rg-shop-card-type", `${card.category} card`);
      const price = element("span", "rg-shop-card-price", `${card.price} POINTS`);
      wrap.append(button, label, price);
      if (card.buyer) wrap.append(element("span", "rg-shop-card-owner", playerNames[card.buyer]));
      grid.append(wrap);
    }
    shell.append(grid, element("p", "rg-card-round-status", "Choose a berry, then a card."));
    content.append(shell);
    liveStatus.textContent = "Shop is open. Choose a berry, then a card.";
  }

  function renderSmeemo(game) {
    layer.hidden = false;
    hostButton.hidden = true;
    setStageTitle("SMEEMO SCRAMBLE", "smeemo");
    content.replaceChildren();
    const board = element("div", `rg-smeemo-board is-${game.phase}`);
    const railViewport = element("div", "rg-smeemo-rail-viewport");
    const rail = element("div", "rg-smeemo-rail");
    const revealIds = new Set(game.draws.map(({ id }) => id));
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
      button.disabled = game.phase !== "ready" || game.status !== "playing" || revealed;
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
        const berryMark = element("span", "rg-smeemo-berry-mark");
        berryMark.setAttribute("aria-hidden", "true");
        front.append(berryMark);
      }
      if (revealed) front.append(element("span", "rg-smeemo-face-label", smeemoRevealed ? "SMEEMO!" : "BLANK"));
      const back = element("span", "rg-smeemo-card-back");
      back.setAttribute("aria-hidden", "true");
      inner.append(front, back);
      button.append(inner);
      button.addEventListener("click", () => {
        const current = state.smeemo;
        if (!current || current.id !== game.id) return;
        const result = drawSmeemoCard(current, card.id);
        if (result.error) return;
        sync({ ...state, smeemo: result.game });
        window.queueMicrotask(() => content.querySelector(".rg-smeemo-card.is-available")?.focus({ preventScroll: true }));
      });
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
    content.append(element("p", `rg-card-round-status rg-smeemo-status${game.status === "complete" ? " is-complete" : ""}`, statusText));
    liveStatus.textContent = statusText;
    if (game.status === "complete") content.append(element("p", "rg-smeemo-winner", "SMEEMOBERRY FOUND!"));
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
    const next = { ...state, decks };
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
      adminStatus.textContent = modeSelect.value === "red-handed"
        ? "Add at least one A-card and one B-card."
        : modeSelect.value === "quiplash"
          ? "Add at least one prompt."
          : "Add at least one priced card to each shop list.";
      return;
    }
    const next = { ...state, decks, round, smeemo: null };
    menuOpen = false;
    dismissedActive = false;
    sync(next);
    window.dispatchEvent(new CustomEvent("rg:card-game-active", { detail: { mode: round.mode } }));
    closeHostPanel();
  }

  function submitPrivateAnswer() {
    const round = state.round;
    const player = playerSelect.value;
    const answer = round?.mode === "red-handed" ? answerSelect.value : answerText.value;
    const updated = submitRoundAnswer(round, player, answer);
    if (updated === round) {
      adminStatus.textContent = "Choose an A-card or enter an answer first.";
      return;
    }
    answerText.value = "";
    sync({ ...state, round: updated });
    closeHostPanel();
  }

  function openCardMenu() {
    menuOpen = true;
    dismissedActive = false;
    renderMenu();
    closeHostPanel();
  }

  saveButton.addEventListener("click", saveDecks);
  startButton.addEventListener("click", startSelectedGame);
  menuButton.addEventListener("click", openCardMenu);
  modeSelect.addEventListener("change", setDeckVisibility);
  playerSelect.addEventListener("change", () => setAdminState(state));
  submitButton.addEventListener("click", submitPrivateAnswer);
  revealButton.addEventListener("click", () => {
    const round = revealAudienceResults(state.round);
    if (round === state.round) return;
    sync({ ...state, round });
  });
  resetButton.addEventListener("click", () => {
    sync({ ...state, round: null });
    adminStatus.textContent = "Current card game reset.";
  });
  shopRefreshButton.addEventListener("click", () => {
    const round = createShopRound(state.decks.shop);
    if (!round) {
      adminStatus.textContent = "Add at least one priced card to each shop list.";
      return;
    }
    selectedBuyer = "faroe";
    menuOpen = false;
    dismissedActive = false;
    sync({ ...state, round });
    window.dispatchEvent(new CustomEvent("rg:card-game-active", { detail: { mode: "shop" } }));
    closeHostPanel();
  });
  hostButton.addEventListener("click", openHostPanel);
  roomButton.addEventListener("click", () => {
    menuOpen = false;
    dismissedActive = Boolean(state.round || state.smeemo);
    window.clearTimeout(menuTimer);
    layer.hidden = true;
    window.dispatchEvent(new Event("rg:close-card-games"));
  });
  window.addEventListener("rg:show-card-menu", () => {
    menuOpen = true;
    dismissedActive = false;
    renderMenu();
  });
  window.addEventListener("rg:card-game-active", (event) => {
    if (event.detail?.mode) {
      menuOpen = false;
      dismissedActive = false;
    }
  });

  loadDeckInputs(state.decks);
  setDeckVisibility();
  subscribeCardGames(updateFromState);
  subscribePointScores((scores) => {
    pointScores = scores;
    if (state.round?.mode === "shop" && !layer.hidden && !menuOpen && !dismissedActive) renderShop(state.round);
  });
})();
