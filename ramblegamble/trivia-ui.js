import {
  MODE_NAMES,
  ROUND_IDS,
  ROUND_RULES,
  SPECIAL_ROUNDS,
  isChoiceMode,
  resolveRoundFormat,
} from "./trivia-data.js";

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const DRAFT_KEY = "ramblegamble.trivia.drafts.v1";
  const GRID_KEY = "ramblegamble.slot-grid.v1";
  const gridSize = 15;
  const berryNames = { kazberry: "Kazberry", faroeberry: "Faroeberry", erinberry: "Erinberry" };
  const modeValues = Object.keys(MODE_NAMES);
  const modeNames = MODE_NAMES;
  const interfaceRoot = $("#rg-trivia-interface");
  const screen = $(".rg-trivia-screen", interfaceRoot);
  const launchButton = $("#rg-console-launch");
  const dialog = $("#rg-console");
  const closeButton = $("#rg-console-close");
  const tabs = $$("[role='tab']", dialog);
  const panels = $$("[role='tabpanel']", dialog);
  const roundSelect = $("#rg-round-select");
  const difficultySelect = $("#rg-difficulty-select");
  const editor = $(".rg-trivia-editor", dialog);
  const feedback = $("#rg-answer-feedback");
  const answerArea = $("#rg-answer-area");
  const stageItems = $("#rg-stage-items");
  const promptImage = $("#rg-prompt-image");
  const videoBox = $("#rg-video-box");
  const questionText = $("#rg-question-text");
  const subtitleText = $("#rg-question-subtitle");
  const saveState = $("#rg-save-state");

  let currentRound = "01";
  let currentDifficulty = 1;
  let activeTab = 0;
  let priorFocus = null;
  let saveTimer = 0;
  let activeSequenceIndex = 0;
  let selectedComposePiece = -1;
  let selectedPairLeft = -1;
  let matchedPairIndexes = new Set();
  let drawingData = new Map();
  let audioContext = null;
  let lastWrongAt = 0;
  let drafts = loadDrafts();
  let slotGrid = loadGrid();
  let selectedBerry = "kazberry";
  let placementMode = "column";

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));
  }

  function safeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw, window.location.href);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadDrafts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
      if (parsed && parsed.version === 1 && parsed.rounds && typeof parsed.rounds === "object") return parsed;
    } catch (error) {
      console.warn("Ramble Gamble drafts could not be read:", error);
    }
    return { version: 1, rounds: {} };
  }

  function loadGrid() {
    try {
      const parsed = JSON.parse(localStorage.getItem(GRID_KEY) || "null");
      if (Array.isArray(parsed) && parsed.length === gridSize) {
        return parsed.map((value) => Object.hasOwn(berryNames, value) ? value : null);
      }
    } catch (error) {
      console.warn("Ramble Gamble slot layout could not be read:", error);
    }
    return Array(gridSize).fill(null);
  }

  function saveDrafts() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
      saveState.textContent = "SAVED HERE";
      saveState.dataset.error = "false";
    } catch (error) {
      saveState.textContent = "SAVE FAILED";
      saveState.dataset.error = "true";
      console.warn("Ramble Gamble local draft could not be saved:", error);
    }
  }

  function queueSave() {
    saveState.textContent = "SAVING...";
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDrafts, 180);
  }

  function levelDraft(round = currentRound, difficulty = currentDifficulty) {
    if (!drafts.rounds[round]) drafts.rounds[round] = {};
    if (!drafts.rounds[round][difficulty]) drafts.rounds[round][difficulty] = {};
    return drafts.rounds[round][difficulty];
  }

  function writeLevelField(field, value) {
    if (currentRound === "00" || currentRound === "0") return;
    levelDraft()[field] = value;
    queueSave();
  }

  function getEffectiveContent(round = currentRound, difficulty = currentDifficulty) {
    const number = Number.parseInt(round, 10);
    let format = resolveRoundFormat(round, difficulty);
    const content = {
      question: "", subtitle: "", promptImage: "", promptAsset: "", mode: "",
      options: [], acceptedAnswers: [], items: [], pairs: [], categories: ["Group 1", "Group 2", "Group 3"],
      videoUrl: "", numberValue: 0, numberVisible: false, imageVisible: true, backgroundImage: "", drawing: "", assignments: [],
    };
    if (!Number.isInteger(number) || number < 1 || number > 36) return { format, content };

    for (let level = 1; level <= Number(difficulty); level += 1) {
      const rule = ROUND_RULES[number]?.[level] || {};
      const draft = drafts.rounds[round]?.[level] || {};
      if (rule.replaceOptions) content.options = [];
      if (rule.mode === "match-pairs" && ROUND_RULES[number]?.[level - 1]?.mode !== "match-pairs") content.pairs = [];
      for (const field of ["question", "subtitle", "promptImage", "promptAsset", "mode", "optionCount", "acceptedAnswers", "options", "items", "pairs", "categories", "videoUrl", "numberValue", "numberVisible", "imageVisible", "backgroundImage", "drawing", "assignments"]) {
        if (Object.hasOwn(draft, field)) content[field] = copy(draft[field]);
      }
    }

    if (!modeNames[content.mode]) content.mode = format.mode;
    if (content.optionCount == null) content.optionCount = format.optionCount;
    content.optionCount = Math.max(0, Math.min(24, Number(content.optionCount) || 0));
    if (isChoiceMode(content.mode) && content.optionCount === 0) content.optionCount = 6;
    format = { ...format, optionCount: content.optionCount };
    if (isChoiceMode(content.mode)) {
      while (content.options.length < format.optionCount) content.options.push({ label: "", image: "", correct: false });
      content.options = content.options.slice(0, format.optionCount);
    }
    if (content.mode === "match-pairs") {
      while (content.pairs.length < format.pairCount) content.pairs.push({ left: "", leftImage: "", right: "" });
      content.pairs = content.pairs.slice(0, format.pairCount);
    }
    const itemModes = ["categorize-images", "timeline", "image-sequence", "text-sequence", "compose-image"];
    if (itemModes.includes(content.mode)) {
      while (content.items.length < format.optionCount) content.items.push({ label: "", image: "", x: 8 + (content.items.length % 5) * 18, y: 8 + (Math.floor(content.items.length / 5) % 4) * 18 });
      content.items = content.items.slice(0, format.optionCount);
    }
    return { format: { ...format, mode: content.mode }, content };
  }

  function setTab(index, focus = false) {
    activeTab = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, tabIndex) => {
      const active = tabIndex === activeTab;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[tabIndex].hidden = !active;
      if (active && focus) tab.focus();
    });
  }

  function openConsole() {
    priorFocus = document.activeElement;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    setTab(activeTab);
    tabs[activeTab]?.focus();
  }

  function closeConsole() {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    if (priorFocus?.focus) priorFocus.focus();
  }

  launchButton.addEventListener("click", openConsole);
  closeButton.addEventListener("click", closeConsole);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeConsole();
  });
  dialog.addEventListener("close", () => priorFocus?.focus?.());
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setTab(index));
    tab.addEventListener("keydown", (event) => {
      let next = index;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next += 1;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next -= 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      setTab(next, true);
    });
  });

  function persistGrid() {
    try { localStorage.setItem(GRID_KEY, JSON.stringify(slotGrid)); }
    catch (error) { console.warn("Ramble Gamble slot layout could not be saved:", error); }
  }

  function updateGridStatus() {
    const filled = slotGrid.filter(Boolean).length;
    $("#rg-slot-count").textContent = filled + (filled === 1 ? " BERRY" : " BERRIES") + " / 15";
    $("#rg-slot-help").textContent = placementMode === "blank"
      ? "Click a square to clear that space."
      : "Click a square to fill its whole " + placementMode + " with " + berryNames[selectedBerry] + ".";
  }

  function renderGrid() {
    const board = $("#rg-slot-board");
    board.replaceChildren();
    slotGrid.forEach((berry, index) => {
      const cell = document.createElement("button");
      const row = Math.floor(index / 5);
      const column = index % 5;
      cell.type = "button";
      cell.className = "rg-slot-cell" + (berry ? " is-filled" : "");
      cell.dataset.index = String(index);
      cell.setAttribute("aria-label", "Row " + (row + 1) + ", column " + (column + 1) + ": " + (berry ? berryNames[berry] : "blank"));
      cell.innerHTML = '<span class="rg-slot-cell-index">' + String(index + 1).padStart(2, "0") + "</span>" + (berry ? esc(berryNames[berry]) : "");
      cell.addEventListener("click", () => applyGridAction(index));
      board.append(cell);
    });
    updateGridStatus();
  }

  function applyGridAction(index) {
    if (placementMode === "blank") slotGrid[index] = null;
    else if (placementMode === "row") {
      const start = Math.floor(index / 5) * 5;
      for (let offset = 0; offset < 5; offset += 1) slotGrid[start + offset] = selectedBerry;
    } else {
      const column = index % 5;
      for (let row = 0; row < 3; row += 1) slotGrid[row * 5 + column] = selectedBerry;
    }
    persistGrid();
    renderGrid();
    const changed = placementMode === "blank" ? "Square cleared." : berryNames[selectedBerry] + " placed in the " + placementMode + ".";
    $("#rg-arcade-status").textContent = changed;
  }

  $$("[data-berry]").forEach((button) => button.addEventListener("click", () => {
    selectedBerry = button.dataset.berry;
    $$("[data-berry]").forEach((choice) => choice.setAttribute("aria-pressed", String(choice === button)));
    updateGridStatus();
  }));
  $$("[data-placement]").forEach((button) => button.addEventListener("click", () => {
    placementMode = button.dataset.placement;
    $$("[data-placement]").forEach((choice) => choice.setAttribute("aria-pressed", String(choice === button)));
    updateGridStatus();
  }));
  $("#rg-slot-clear").addEventListener("click", () => {
    slotGrid = Array(gridSize).fill(null);
    persistGrid();
    renderGrid();
    $("#rg-arcade-status").textContent = "The slot menu grid is clear.";
  });
  renderGrid();

  $("#rg-spin-wheel").addEventListener("click", () => window.dispatchEvent(new CustomEvent("rg:spin-wheel")));
  $("#rg-pull-slots").addEventListener("click", () => window.dispatchEvent(new CustomEvent("rg:pull-slots")));
  window.addEventListener("rg:turn-start", (event) => {
    $("#rg-arcade-status").textContent = event.detail?.machine === "wheel" ? "The wheel is spinning..." : "The slot lever is moving...";
  });
  window.addEventListener("rg:turn-finish", (event) => {
    $("#rg-arcade-status").textContent = event.detail?.prompt || "Turn complete.";
  });

  function parseList(value) {
    return String(value || "").split(/[\n,|]+/).map((part) => part.trim()).filter(Boolean);
  }

  function padOptions(options, count) {
    const result = copy(options || []);
    while (result.length < count) result.push({ label: "", image: "", asset: "", correct: false });
    return result.slice(0, count);
  }

  function effectiveNow() { return getEffectiveContent(); }

  function renderModeOptions() {
    const select = $("#rg-edit-mode");
    if (!select.options.length) {
      modeValues.forEach((mode) => {
        const option = document.createElement("option");
        option.value = mode;
        option.textContent = modeNames[mode];
        select.append(option);
      });
    }
  }

  function optionRowsHTML(format, content) {
    if (!isChoiceMode(format.mode)) return "";
    let html = '<h4 class="rg-editor-section-title">ANSWER OPTIONS <span>(' + format.optionCount + ')</span></h4>';
    html += '<p class="rg-editor-hint">Fill text, an image URL, or both. Select the radio button for the correct choice.</p>';
    const options = padOptions(content.options, format.optionCount);
    options.forEach((option, index) => {
      const fixedNumber = format.mode === "number-grid" ? String(index + 1) : "";
      const textPlaceholder = fixedNumber || "Option " + String(index + 1).padStart(2, "0");
      html += '<div class="rg-option-row" data-option-row="' + index + '" data-asset-id="' + esc(option.asset || "") + '">';
      html += '<input type="text" data-option-label placeholder="' + esc(textPlaceholder) + '" value="' + esc(option.label || "") + '" aria-label="Option ' + (index + 1) + ' text">';
      html += '<input type="url" data-option-image placeholder="Image URL (optional)" value="' + esc(option.image || "") + '" aria-label="Option ' + (index + 1) + ' image URL">';
      html += '<input type="radio" name="rg-correct-option" data-option-correct aria-label="Mark option ' + (index + 1) + ' correct" ' + (option.correct ? "checked" : "") + ">";
      html += '</div>';
    });
    return html;
  }

  function itemRowsHTML(format, content) {
    const modes = ["categorize-images", "timeline", "image-sequence", "text-sequence", "compose-image"];
    if (!modes.includes(format.mode)) return "";
    const items = content.items || [];
    let html = '<h4 class="rg-editor-section-title">' + (format.mode === "compose-image" ? "PIECES" : "ITEMS") + ' <span>(' + format.optionCount + ')</span></h4>';
    html += '<p class="rg-editor-hint">Use text, an image URL, or both. Empty items remain visibly marked as placeholders.</p>';
    items.forEach((item, index) => {
      html += '<div class="rg-item-row" data-item-row="' + index + '">';
      html += '<input type="text" data-item-label placeholder="Item ' + String(index + 1).padStart(2, "0") + '" value="' + esc(item.label || "") + '" aria-label="Item ' + (index + 1) + ' text">';
      html += '<input type="url" data-item-image placeholder="Image URL" value="' + esc(item.image || "") + '" aria-label="Item ' + (index + 1) + ' image URL">';
      html += '<span aria-hidden="true">' + String(index + 1).padStart(2, "0") + '</span></div>';
    });
    return html;
  }

  function pairRowsHTML(format, content) {
    if (format.mode !== "match-pairs") return "";
    let html = '<h4 class="rg-editor-section-title">PAIRS <span>(' + format.pairCount + ')</span></h4>';
    html += '<p class="rg-editor-hint">Enter the matching left and right items. Images can be entered as URLs on the left.</p>';
    content.pairs.forEach((pair, index) => {
      html += '<div class="rg-item-row" data-pair-row="' + index + '">';
      html += '<input type="text" data-pair-left placeholder="Left item ' + (index + 1) + ' / image URL" value="' + esc(pair.left || "") + '" aria-label="Pair ' + (index + 1) + ' left item">';
      html += '<input type="text" data-pair-right placeholder="Matching text ' + (index + 1) + '" value="' + esc(pair.right || "") + '" aria-label="Pair ' + (index + 1) + ' right item">';
      html += '<span aria-hidden="true">' + String(index + 1).padStart(2, "0") + '</span></div>';
    });
    return html;
  }

  function renderSpecialFields(format, content) {
    let html = "";
    if (isChoiceMode(format.mode)) {
      const counts = [5, 6, 8, 9, 10, 12, 13, 16, 18, 24];
      const chosen = counts.includes(format.optionCount) ? format.optionCount : 6;
      html += '<label class="rg-field-label" for="rg-edit-option-count">Number of options<select id="rg-edit-option-count" data-option-count>';
      counts.forEach((count) => { html += '<option value="' + count + '" ' + (count === chosen ? "selected" : "") + '>' + count + '</option>'; });
      html += '</select></label>';
    }
    if (format.mode === "categorize-images") {
      html += '<h4 class="rg-editor-section-title">CATEGORY NAMES</h4>';
      for (let index = 0; index < format.categories; index += 1) {
        html += '<label class="rg-field-label">Group ' + (index + 1) + '<input type="text" data-category-index="' + index + '" value="' + esc(content.categories[index] || "Group " + (index + 1)) + '"></label>';
      }
    }
    if (format.mode === "number-stepper" || format.mode === "memory-number") {
      html += '<label class="rg-field-label" for="rg-edit-number">Starting number<input id="rg-edit-number" type="number" data-number-value value="' + Number(content.numberValue || 0) + '"></label>';
    }
    if (format.mode === "video") {
      html += '<label class="rg-field-label" for="rg-edit-video">Video URL<input id="rg-edit-video" type="url" data-video-url value="' + esc(content.videoUrl || "") + '" placeholder="https://…"></label>';
    }
    if (format.mode === "compose-image") {
      html += '<label class="rg-field-label">Background image<input type="url" data-background-image value="' + esc(content.backgroundImage || "") + '" placeholder="Use prompt image URL or a separate one"></label>';
    }
    return html;
  }

  function renderEditor(format, content) {
    renderModeOptions();
    $("#rg-edit-question").value = content.question || "";
    $("#rg-edit-subtitle").value = content.subtitle || "";
    $("#rg-edit-prompt-image").value = content.promptImage || "";
    $("#rg-edit-prompt-file").dataset.assetId = content.promptAsset || "";
    $("#rg-edit-answers").value = Array.isArray(content.acceptedAnswers) ? content.acceptedAnswers.join("\n") : "";
    $("#rg-edit-mode").value = format.mode;
    $("#rg-special-fields").innerHTML = renderSpecialFields(format, content);
    $("#rg-options-editor").innerHTML = optionRowsHTML(format, content);
    $("#rg-items-editor").innerHTML = itemRowsHTML(format, content) + pairRowsHTML(format, content);
    const disabled = currentRound === "00" || currentRound === "0";
    $$("input, textarea, select, button", editor).forEach((control) => {
      if (control.id !== "rg-clear-draft") control.disabled = disabled;
    });
    $("#rg-clear-draft").disabled = disabled;
  }

  function readEditor() {
    const countInput = $("[data-option-count]", $("#rg-special-fields"));
    const selectedOptionCount = Number(countInput?.value || 0);
    const content = {
      question: $("#rg-edit-question").value,
      subtitle: $("#rg-edit-subtitle").value,
      promptImage: $("#rg-edit-prompt-image").value.trim(),
      promptAsset: $("#rg-edit-prompt-file").dataset.assetId || "",
      mode: $("#rg-edit-mode").value,
      acceptedAnswers: parseList($("#rg-edit-answers").value),
      options: $$("[data-option-row]", $("#rg-options-editor")).map((row) => ({
        label: $("[data-option-label]", row).value,
        image: $("[data-option-image]", row).value.trim(),
        asset: row.dataset.assetId || "",
        correct: $("[data-option-correct]", row).checked,
      })),
      items: $$("[data-item-row]", $("#rg-items-editor")).map((row, index) => ({
        label: $("[data-item-label]", row).value,
        image: $("[data-item-image]", row).value.trim(),
        x: effectiveNow().content.items[index]?.x ?? 8 + (index % 5) * 18,
        y: effectiveNow().content.items[index]?.y ?? 8 + (Math.floor(index / 5) % 4) * 18,
      })),
      pairs: $$("[data-pair-row]", $("#rg-items-editor")).map((row) => ({
        left: $("[data-pair-left]", row).value,
        leftImage: "",
        right: $("[data-pair-right]", row).value,
      })),
      categories: $$("[data-category-index]", $("#rg-special-fields")).map((input) => input.value),
      videoUrl: $("[data-video-url]", $("#rg-special-fields"))?.value.trim() || "",
      numberValue: Number($("[data-number-value]", $("#rg-special-fields"))?.value || 0),
      backgroundImage: $("[data-background-image]", $("#rg-special-fields"))?.value.trim() || "",
      imageVisible: effectiveNow().content.imageVisible,
      numberVisible: effectiveNow().content.numberVisible,
      drawing: drawingData.get(currentRound + ":" + currentDifficulty) || effectiveNow().content.drawing || "",
      assignments: effectiveNow().content.assignments || [],
    };
    if (content.promptImage) content.promptAsset = "";
    delete content.optionCount;
    levelDraft()["question"] = content.question;
    Object.assign(levelDraft(), content);
    if (countInput && selectedOptionCount !== resolveRoundFormat(currentRound, currentDifficulty).optionCount) levelDraft().optionCount = selectedOptionCount;
    else delete levelDraft().optionCount;
  }

  function saveAndRenderStage() {
    if (currentRound === "00" || currentRound === "0") return;
    readEditor();
    queueSave();
    renderStage();
  }

  function addImageToNode(node, url, assetId, className) {
    const safe = safeUrl(url);
    const append = (resolved) => {
      if (!resolved) return;
      const image = document.createElement("img");
      image.className = className || "";
      image.src = resolved;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => image.remove(), { once: true });
      node.append(image);
    };
    if (safe) append(safe);
    else if (assetId) readMedia(assetId).then(append);
  }

  let mediaDbPromise;
  const objectUrls = new Map();
  function mediaDb() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (!mediaDbPromise) mediaDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("ramblegamble-host-media", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("images");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(() => null);
    return mediaDbPromise;
  }

  async function storeMedia(file) {
    const db = await mediaDb();
    if (!db) throw new Error("Local image storage is unavailable in this browser.");
    const key = "image-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      transaction.objectStore("images").put(file, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    return key;
  }

  async function readMedia(key) {
    if (objectUrls.has(key)) return objectUrls.get(key);
    const db = await mediaDb();
    if (!db) return "";
    const blob = await new Promise((resolve, reject) => {
      const request = db.transaction("images", "readonly").objectStore("images").get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(() => null);
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    objectUrls.set(key, url);
    return url;
  }

  async function savePromptUpload(file) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      $("#rg-edit-prompt-file").dataset.assetId = await storeMedia(file);
      $("#rg-edit-prompt-image").value = "";
      saveAndRenderStage();
      saveState.textContent = "IMAGE SAVED HERE";
    } catch (error) {
      saveState.textContent = "IMAGE NOT SAVED";
      console.warn("Image upload failed:", error);
    }
  }

  function setAnswerStatus(message, state) {
    feedback.textContent = message;
    interfaceRoot.classList.remove("is-error", "is-correct");
    if (state === "wrong") {
      void interfaceRoot.offsetWidth;
      interfaceRoot.classList.add("is-error");
      playErrorSound();
      window.setTimeout(() => interfaceRoot.classList.remove("is-error"), 360);
    } else if (state === "correct") interfaceRoot.classList.add("is-correct");
  }

  function playErrorSound() {
    const now = performance.now();
    if (now - lastWrongAt < 260) return;
    lastWrongAt = now;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioContext) audioContext = new AudioCtor();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime;
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(190, start);
      oscillator.frequency.exponentialRampToValueAtTime(110, start + 0.13);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.17);
    } catch (error) {
      console.warn("The local error tone could not play:", error);
    }
  }

  function normalizeAnswer(value) {
    return String(value || "").normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  }

  function checkFreeAnswer() {
    const effective = effectiveNow();
    if (!effective.content.acceptedAnswers.length) {
      setAnswerStatus("Add accepted answers in the host editor first.", "neutral");
      return;
    }
    const answer = normalizeAnswer($("#rg-short-answer").value);
    const accepted = effective.content.acceptedAnswers.map(normalizeAnswer);
    if (answer && accepted.includes(answer)) setAnswerStatus("CORRECT!", "correct");
    else setAnswerStatus("Not quite - try another answer.", "wrong");
  }

  function checkOption(index) {
    const { content } = effectiveNow();
    if (!content.options.some((option) => option.correct)) {
      setAnswerStatus("Mark the correct option in the host editor first.", "neutral");
      return;
    }
    if (content.options[index]?.correct) setAnswerStatus("CORRECT!", "correct");
    else setAnswerStatus("Not quite - try another choice.", "wrong");
  }

  function setQuestionContent(effective) {
    questionText.textContent = effective.content.question || (currentRound === "00" ? "" : "Add this round's question");
    questionText.hidden = currentRound === "00";
    subtitleText.textContent = effective.content.subtitle || "";
    subtitleText.hidden = !effective.content.subtitle || currentRound === "00";
    promptImage.replaceChildren();
    promptImage.hidden = true;
    if (!["draw-over-image", "compose-image"].includes(effective.format.mode) && (effective.content.promptImage || effective.content.promptAsset)) {
      promptImage.src = safeUrl(effective.content.promptImage) || "";
      if (!promptImage.src && effective.content.promptAsset) readMedia(effective.content.promptAsset).then((url) => { if (url) promptImage.src = url; });
      promptImage.hidden = false;
      promptImage.onerror = () => { promptImage.hidden = true; };
    }
    videoBox.replaceChildren();
    videoBox.hidden = effective.format.mode !== "video";
    if (effective.format.mode === "video") {
      const url = safeUrl(effective.content.videoUrl);
      if (url) {
        const video = document.createElement("video");
        video.controls = true;
        video.preload = "metadata";
        video.src = url;
        videoBox.append(video);
      } else videoBox.textContent = "Add a video URL in the host editor.";
    }
  }

  function renderChoiceStage(format, content) {
    screen.dataset.mode = format.mode;
    const count = format.optionCount;
    const columns = format.mode === "image-grid" ? format.columns : (count <= 6 ? 3 : count <= 10 ? 5 : 4);
    stageItems.style.setProperty("--rg-choice-columns", String(columns || 2));
    const options = padOptions(content.options, count);
    options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rg-answer-option";
      button.dataset.optionIndex = String(index);
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", option.label || (option.image || option.asset ? "Image option " + (index + 1) : "Option " + (index + 1)));
      if (option.image || option.asset) addImageToNode(button, option.image, option.asset);
      const label = document.createElement("span");
      label.textContent = option.label || (option.image || option.asset ? "" : (format.mode === "number-grid" ? String(index + 1) : "OPTION " + String(index + 1).padStart(2, "0")));
      button.append(label);
      button.addEventListener("click", () => {
        $$(".rg-answer-option", stageItems).forEach((other) => other.setAttribute("aria-pressed", "false"));
        button.setAttribute("aria-pressed", "true");
        checkOption(index);
      });
      stageItems.append(button);
    });
  }

  function renderShortAnswer() {
    const input = document.createElement("input");
    input.type = "text";
    input.id = "rg-short-answer";
    input.autocomplete = "off";
    input.placeholder = "Enter the answer given";
    input.setAttribute("aria-label", "Answer given by contestant");
    const check = document.createElement("button");
    check.type = "button";
    check.className = "rg-stage-button";
    check.textContent = "CHECK ANSWER";
    check.addEventListener("click", checkFreeAnswer);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") checkFreeAnswer(); });
    answerArea.append(input, check);
  }

  function renderSequence(format, content) {
    const items = content.items || [];
    if (!items.length) return;
    activeSequenceIndex = Math.min(activeSequenceIndex, items.length - 1);
    const item = items[activeSequenceIndex] || {};
    const card = document.createElement("div");
    card.className = "rg-empty-state";
    card.textContent = item.label || "ITEM " + String(activeSequenceIndex + 1).padStart(2, "0");
    if (item.image) addImageToNode(card, item.image, "", "rg-stage-media");
    stageItems.append(card);
    const controls = document.createElement("div");
    controls.className = "rg-answer-area";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "rg-stage-button";
    previous.textContent = "PREVIOUS";
    previous.disabled = activeSequenceIndex === 0;
    previous.addEventListener("click", () => { activeSequenceIndex -= 1; renderStage(); });
    const count = document.createElement("span");
    count.textContent = (activeSequenceIndex + 1) + " / " + items.length;
    const next = document.createElement("button");
    next.type = "button";
    next.className = "rg-stage-button";
    next.textContent = "NEXT";
    next.disabled = activeSequenceIndex >= items.length - 1;
    next.addEventListener("click", () => { activeSequenceIndex += 1; renderStage(); });
    controls.append(previous, count, next);
    answerArea.append(controls);
  }

  function renderTimeline(format, content) {
    const list = document.createElement("div");
    list.className = "rg-timeline-list";
    content.items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "rg-timeline-row";
      const label = document.createElement("div");
      label.className = "rg-empty-state";
      label.textContent = item.label || "EVENT " + String(index + 1).padStart(2, "0");
      if (item.image) addImageToNode(label, item.image, "", "rg-stage-media");
      row.append(label);
      if (format.reorder) {
        for (const direction of [-1, 1]) {
          const move = document.createElement("button");
          move.type = "button";
          move.className = "rg-stage-button";
          move.textContent = direction < 0 ? "UP" : "DOWN";
          move.setAttribute("aria-label", (direction < 0 ? "Move up " : "Move down ") + (item.label || "event " + (index + 1)));
          move.disabled = direction < 0 ? index === 0 : index === content.items.length - 1;
          move.addEventListener("click", () => {
            const nextItems = copy(content.items);
            const target = index + direction;
            [nextItems[index], nextItems[target]] = [nextItems[target], nextItems[index]];
            writeLevelField("items", nextItems);
            render();
          });
          row.append(move);
        }
      } else row.append(document.createElement("span"));
      list.append(row);
    });
    stageItems.append(list);
  }

  function renderCategorize(format, content) {
    const buckets = document.createElement("div");
    buckets.className = "rg-category-buckets";
    const itemTray = document.createElement("div");
    itemTray.className = "rg-stage-items";
    itemTray.style.setProperty("--rg-choice-columns", "3");
    let selectedItem = -1;
    const bucketsList = [];
    for (let index = 0; index < format.categories; index += 1) {
      const bucket = document.createElement("div");
      bucket.className = "rg-category-bucket";
      const title = document.createElement("strong");
      title.textContent = content.categories[index] || "Group " + (index + 1);
      bucket.append(title);
      bucket.addEventListener("click", () => {
        if (selectedItem < 0) return;
        const assignments = [...(content.assignments || [])];
        assignments[selectedItem] = index;
        writeLevelField("assignments", assignments);
        selectedItem = -1;
        render();
        setAnswerStatus("Item assigned to " + title.textContent + ".", "neutral");
      });
      bucketsList.push(bucket);
    }
    content.items.forEach((item, index) => {
      const group = content.assignments?.[index];
      if (Number.isInteger(group) && bucketsList[group]) {
        const assigned = document.createElement("button");
        assigned.type = "button";
        assigned.className = "rg-pair-card";
        assigned.dataset.assignedItem = String(index);
        assigned.textContent = item.label || "IMAGE " + String(index + 1).padStart(2, "0") + " - REMOVE";
        assigned.addEventListener("click", () => {
          const assignments = [...(content.assignments || [])];
          assignments[index] = null;
          writeLevelField("assignments", assignments);
          render();
        });
        if (item.image) addImageToNode(assigned, item.image, "", "rg-stage-media");
        bucketsList[group].append(assigned);
        return;
      }
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "rg-answer-option";
      tile.dataset.categoryItem = String(index);
      tile.textContent = item.label || "IMAGE " + String(index + 1).padStart(2, "0");
      if (item.image) addImageToNode(tile, item.image, "", "rg-stage-media");
      tile.addEventListener("click", () => {
        selectedItem = index;
        $$("[data-category-item]", itemTray).forEach((other) => other.setAttribute("aria-pressed", "false"));
        tile.setAttribute("aria-pressed", "true");
      });
      itemTray.append(tile);
    });
    bucketsList.forEach((bucket) => buckets.append(bucket));
    stageItems.append(itemTray, buckets);
    answerArea.innerHTML = '<span class="rg-editor-hint">Select an image, then choose its group. These local placements are host-side notes only.</span>';
  }

  function renderPairs(content) {
    const columns = document.createElement("div");
    columns.className = "rg-pair-columns";
    const left = document.createElement("div");
    const right = document.createElement("div");
    const order = content.pairs.map((_, index) => index).sort((a, b) => ((a * 7 + 3) % Math.max(1, content.pairs.length)) - ((b * 7 + 3) % Math.max(1, content.pairs.length)));
    content.pairs.forEach((pair, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rg-pair-card";
      const leftImage = safeUrl(pair.leftImage) || safeUrl(pair.left);
      if (leftImage) {
        button.setAttribute("aria-label", "Left image " + (index + 1));
        addImageToNode(button, leftImage, "", "rg-stage-media");
      } else button.textContent = pair.left || "LEFT " + String(index + 1).padStart(2, "0");
      button.dataset.pairLeft = String(index);
      button.addEventListener("click", () => {
        selectedPairLeft = index;
        $$("[data-pair-left]", columns).forEach((other) => other.setAttribute("aria-pressed", "false"));
        button.setAttribute("aria-pressed", "true");
      });
      left.append(button);
    });
    order.forEach((index) => {
      const pair = content.pairs[index];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rg-pair-card";
      button.textContent = pair.right || "RIGHT " + String(index + 1).padStart(2, "0");
      button.dataset.pairRight = String(index);
      button.addEventListener("click", () => {
        if (selectedPairLeft < 0) {
          setAnswerStatus("Choose a left item first.", "neutral");
          return;
        }
        if (selectedPairLeft === index) {
          matchedPairIndexes.add(index);
          button.classList.add("is-correct");
          $$("[data-pair-left]", columns).find((item) => Number(item.dataset.pairLeft) === index)?.classList.add("is-correct");
          setAnswerStatus("Pair matched.", "correct");
        } else setAnswerStatus("Those do not match - try again.", "wrong");
        selectedPairLeft = -1;
      });
      if (matchedPairIndexes.has(index)) button.classList.add("is-correct");
      right.append(button);
    });
    columns.append(left, right);
    stageItems.append(columns);
  }

  function renderNumberStepper(content, memory = false) {
    if (memory) {
      const imageToggle = document.createElement("button");
      imageToggle.type = "button";
      imageToggle.className = "rg-stage-button";
      imageToggle.textContent = content.imageVisible ? "HIDE IMAGE" : "SHOW IMAGE";
      imageToggle.addEventListener("click", () => {
        writeLevelField("imageVisible", !content.imageVisible);
        render();
      });
      answerArea.append(imageToggle);
      promptImage.hidden = !content.imageVisible;
    }
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "rg-stage-button";
    reveal.textContent = content.numberVisible ? "HIDE NUMBER" : "REVEAL NUMBER";
    reveal.addEventListener("click", () => {
      writeLevelField("numberVisible", !content.numberVisible);
      render();
    });
    answerArea.append(reveal);
    if (content.numberVisible || !memory) {
      const output = document.createElement("strong");
      output.className = "rg-question-text";
      output.textContent = String(Number(content.numberValue) || 0);
      answerArea.append(output);
      for (const delta of [-1, 1]) {
        const step = document.createElement("button");
        step.type = "button";
        step.className = "rg-stepper-button";
        step.textContent = delta < 0 ? "-" : "+";
        step.setAttribute("aria-label", delta < 0 ? "Decrease number" : "Increase number");
        step.addEventListener("click", () => {
          writeLevelField("numberValue", (Number(content.numberValue) || 0) + delta);
          render();
        });
        answerArea.append(step);
      }
    }
  }

  function renderDrawing(content) {
    const wrapper = document.createElement("div");
    wrapper.className = "rg-draw-wrapper";
    if (content.promptImage || content.promptAsset) addImageToNode(wrapper, content.promptImage, content.promptAsset, "rg-draw-background");
    const canvas = document.createElement("canvas");
    canvas.className = "rg-draw-canvas";
    canvas.width = 700;
    canvas.height = 420;
    canvas.setAttribute("aria-label", "Drawing surface. Draw in red over the image.");
    wrapper.append(canvas);
    stageItems.append(wrapper);
    const context = canvas.getContext("2d");
    context.strokeStyle = "#ed1010";
    context.lineWidth = 7;
    context.lineCap = "round";
    context.lineJoin = "round";
    const stored = drawingData.get(currentRound + ":" + currentDifficulty) || content.drawing;
    if (stored) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = stored;
    }
    let drawing = false;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
    };
    canvas.addEventListener("pointerdown", (event) => {
      drawing = true;
      canvas.setPointerCapture(event.pointerId);
      const p = point(event);
      context.beginPath();
      context.moveTo(p.x, p.y);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drawing) return;
      const p = point(event);
      context.lineTo(p.x, p.y);
      context.stroke();
    });
    canvas.addEventListener("pointerup", () => {
      if (!drawing) return;
      drawing = false;
      const data = canvas.toDataURL("image/png");
      drawingData.set(currentRound + ":" + currentDifficulty, data);
      writeLevelField("drawing", data);
    });
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "rg-stage-button";
    clear.textContent = "CLEAR DRAWING";
    clear.addEventListener("click", () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawingData.delete(currentRound + ":" + currentDifficulty);
      writeLevelField("drawing", "");
    });
    answerArea.append(clear);
  }

  function renderCompose(content) {
    const board = document.createElement("div");
    board.className = "rg-compose-board";
    board.tabIndex = 0;
    board.setAttribute("aria-label", "Image composition board. Select a piece, then click a place on the board.");
    const background = safeUrl(content.backgroundImage || content.promptImage);
    if (background) board.style.backgroundImage = 'url("' + background.replace(/["\\]/g, "") + '")';
    content.items.forEach((item, index) => {
      const piece = document.createElement("button");
      piece.type = "button";
      piece.className = "rg-compose-piece";
      piece.textContent = item.label || "PIECE " + (index + 1);
      piece.style.left = (item.x ?? 8) + "%";
      piece.style.top = (item.y ?? 8) + "%";
      piece.dataset.piece = String(index);
      piece.setAttribute("aria-pressed", String(selectedComposePiece === index));
      if (item.image) addImageToNode(piece, item.image, "", "rg-stage-media");
      piece.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedComposePiece = index;
        $$(".rg-compose-piece", board).forEach((other) => other.setAttribute("aria-pressed", String(other === piece)));
        setAnswerStatus("Piece selected - click the large image to place it.", "neutral");
      });
      board.append(piece);
    });
    board.addEventListener("click", (event) => {
      if (selectedComposePiece < 0) return;
      const rect = board.getBoundingClientRect();
      const x = Math.max(0, Math.min(90, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(90, ((event.clientY - rect.top) / rect.height) * 100));
      const items = copy(content.items);
      items[selectedComposePiece].x = x;
      items[selectedComposePiece].y = y;
      writeLevelField("items", items);
      selectedComposePiece = -1;
      render();
    });
    stageItems.append(board);
  }

  function renderStage() {
    const effective = effectiveNow();
    const format = effective.format;
    const content = effective.content;
    $("#rg-round-badge").textContent = currentRound === "0" ? "HOST NOTE 0" : "ROUND " + currentRound;
    $("#rg-format-badge").textContent = currentRound === "00" ? "BLANK" : currentRound === "0" ? "SPECIAL INSTRUCTIONS" : (modeNames[format.mode] || "Question").toUpperCase();
    screen.dataset.mode = format.mode;
    setQuestionContent(effective);
    stageItems.replaceChildren();
    answerArea.replaceChildren();
    feedback.textContent = "";
    interfaceRoot.classList.remove("is-error", "is-correct");

    if (currentRound === "00") {
      questionText.hidden = true;
      subtitleText.hidden = true;
      promptImage.hidden = true;
      stageItems.hidden = true;
      answerArea.hidden = true;
      return;
    }
    stageItems.hidden = false;
    answerArea.hidden = false;
    if (currentRound === "0") {
      questionText.textContent = SPECIAL_ROUNDS["0"].question;
      questionText.hidden = false;
      promptImage.hidden = true;
      stageItems.innerHTML = '<div class="rg-host-instructions">' + esc(SPECIAL_ROUNDS["0"].body) + '</div>';
      answerArea.hidden = true;
      return;
    }
    if (isChoiceMode(format.mode)) renderChoiceStage(format, content);
    else if (format.mode === "short-answer") renderShortAnswer();
    else if (format.mode === "timeline") renderTimeline(format, content);
    else if (format.mode === "categorize-images") renderCategorize(format, content);
    else if (format.mode === "match-pairs") renderPairs(content);
    else if (format.mode === "image-sequence" || format.mode === "text-sequence") renderSequence(format, content);
    else if (format.mode === "draw-over-image") renderDrawing(content);
    else if (format.mode === "compose-image") renderCompose(content);
    else if (format.mode === "number-stepper") renderNumberStepper(content, false);
    else if (format.mode === "memory-number") renderNumberStepper(content, true);
    else if (format.mode === "video" && !safeUrl(content.videoUrl)) stageItems.textContent = "Add a video URL in the host editor.";
  }

  function render() {
    activeSequenceIndex = 0;
    selectedComposePiece = -1;
    selectedPairLeft = -1;
    matchedPairIndexes = new Set();
    const special = SPECIAL_ROUNDS[currentRound];
    if (special?.kind === "blank") {
      renderEditor(resolveRoundFormat("00", 1), { question: "", subtitle: "", promptImage: "", promptAsset: "", mode: "short-answer", acceptedAnswers: [], options: [], items: [], pairs: [], categories: [], videoUrl: "", numberValue: 0 });
      $("#rg-round-badge").textContent = "ROUND 00";
      $("#rg-format-badge").textContent = "BLANK SLATE";
      renderStage();
      return;
    }
    if (special?.kind === "host-instructions") {
      renderEditor(resolveRoundFormat("0", 1), { question: "", subtitle: "", promptImage: "", promptAsset: "", mode: "short-answer", acceptedAnswers: [], options: [], items: [], pairs: [], categories: [], videoUrl: "", numberValue: 0 });
      renderStage();
      return;
    }
    const effective = effectiveNow();
    renderEditor(effective.format, effective.content);
    renderStage();
  }

  ROUND_IDS.forEach((round) => {
    const option = document.createElement("option");
    option.value = round;
    option.textContent = round === "00" ? "00 / BLANK" : round === "0" ? "0 / HOST NOTE" : round;
    roundSelect.append(option);
  });
  roundSelect.value = currentRound;
  roundSelect.addEventListener("change", () => { currentRound = roundSelect.value; render(); });
  difficultySelect.addEventListener("change", () => { currentDifficulty = Number(difficultySelect.value); render(); });
  editor.addEventListener("input", (event) => {
    if (event.target.id === "rg-edit-mode") return;
    saveAndRenderStage();
  });
  editor.addEventListener("change", (event) => {
    if (event.target.id === "rg-edit-mode" || event.target.id === "rg-edit-option-count") {
      readEditor();
      render();
      queueSave();
    }
  });
  $("#rg-edit-prompt-file").addEventListener("change", (event) => savePromptUpload(event.target.files?.[0]));
  editor.addEventListener("change", async (event) => {
    const fileInput = event.target.closest("[data-option-file]");
    if (!fileInput || !fileInput.files?.[0]) return;
    const row = fileInput.closest("[data-option-row]");
    if (!row) return;
    try {
      row.dataset.assetId = await storeMedia(fileInput.files[0]);
      $("[data-option-image]", row).value = "";
      saveAndRenderStage();
      saveState.textContent = "IMAGE SAVED HERE";
    } catch (error) { saveState.textContent = "IMAGE NOT SAVED"; }
  });
  $("#rg-clear-draft").addEventListener("click", () => {
    delete drafts.rounds[currentRound]?.[currentDifficulty];
    if (drafts.rounds[currentRound] && !Object.keys(drafts.rounds[currentRound]).length) delete drafts.rounds[currentRound];
    drawingData.delete(currentRound + ":" + currentDifficulty);
    saveDrafts();
    render();
  });

  window.addEventListener("pagehide", () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    if (audioContext && audioContext.state !== "closed") audioContext.close();
  }, { once: true });

  render();
})();
