import {
  MODE_NAMES,
  ROUND_IDS,
  ROUND_RULES,
  SPECIAL_ROUNDS,
  isChoiceMode,
  resolveRoundFormat,
  resolveRoundMode,
  resolveTimelineReorder,
} from "./trivia-data.js?v=compose-repeat-grid-20261124-v1";
import {
  QUESTION_BANK_SESSION_KEY,
  readSessionQuestionBank,
  writeSessionQuestionBank,
} from "./question-bank.mjs?v=host-question-bank-session-20261118-v1";
import {
  decodeTriviaBytes,
  exportTriviaText,
  parseTriviaText,
} from "./trivia-text.mjs?v=number-grid-guess-limit-20261121-v1";
import { compareNumberGuess, hasAuthoredTriviaContent, isFourDigitCode, matchesCorrectSelection, normalizeGuessLimit, scoreFourDigitGuess } from "./trivia-game.mjs?v=changeable-number-feedback-20261124-v1";
import { migrateLegacyComposePlacements, normalizeComposePlacements, snapComposePlacement } from "./compose-placement.mjs?v=compose-repeat-place-20261124-v1";
import { CLIENT_ACTIVITY_ROUTES, CLIENT_PACKET_MAX_BYTES, buildClientActivity, validateClientSubmission } from "./trivia-client.mjs?v=player-handoff-20261125-v1";

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const DRAFT_KEY = "ramblegamble.trivia.drafts.v1";
  const GRID_KEY = "ramblegamble.slot-game-board.v1";
  const gridSize = 15;
  const berryNames = { kazberry: "Kazberry", faroeberry: "Faroeberry", erinberry: "Erinberry" };
  const modeValues = Object.keys(MODE_NAMES);
  const modeNames = MODE_NAMES;
  const interfaceRoot = $("#rg-trivia-interface");
  const screen = $(".rg-trivia-screen", interfaceRoot);
  const dialog = $("#rg-console");
  const closeButton = $("#rg-console-close");
  const presentButton = $("#rg-present-toggle");
  const returnToEditButton = $("#rg-stage-edit");
  const tabs = $$("[role='tab']", dialog);
  const panels = $$("[role='tabpanel']", dialog);
  const roundSelect = $("#rg-round-select");
  const difficultySelect = $("#rg-difficulty-select");
  const editor = $(".rg-trivia-editor", dialog);
  const itemsEditor = $("#rg-items-editor");
  const feedback = $("#rg-answer-feedback");
  const answerArea = $("#rg-answer-area");
  const stageItems = $("#rg-stage-items");
  const promptImage = $("#rg-prompt-image");
  const videoBox = $("#rg-video-box");
  const questionText = $("#rg-question-text");
  const subtitleText = $("#rg-question-subtitle");
  const saveState = $("#rg-save-state");
  const questionBankForm = $("#rg-question-bank-form");
  const questionBankInput = $("#rg-new-question");
  const questionBankList = $("#rg-question-bank-list");
  const questionBankEmpty = $("#rg-question-bank-empty");
  const questionBankCount = $("#rg-question-bank-count");
  const importFileInput = $("#rg-import-file");
  const importModeSelect = $("#rg-import-mode");
  const importApplyButton = $("#rg-import-apply");
  const importStatus = $("#rg-import-status");
  const importPreview = $("#rg-import-preview");
  const exportButton = $("#rg-export-trivia");
  const clientTaskStatus = $("#rg-client-task-status");
  const clientOpenLink = $("#rg-client-open-link");
  const clientExportTask = $("#rg-client-export-task");
  const clientAnswerFiles = $("#rg-client-answer-files");
  const clientImportAnswers = $("#rg-client-import-answers");
  const clientExportAnswers = $("#rg-client-export-answers");
  const clientClearAnswers = $("#rg-client-clear-answers");
  const clientTransferStatus = $("#rg-client-transfer-status");
  const clientImportPreview = $("#rg-client-import-preview");
  const clientSubmissionsNode = $("#rg-client-submissions");
  const CLIENT_ISSUED_KEY = "ramblegamble.client-activities.v1";
  const CLIENT_ANSWERS_KEY = "ramblegamble.client-answers.v1";

  let currentRound = "01";
  let currentDifficulty = 1;
  let activeTab = 0;
  let priorFocus = null;
  let saveTimer = 0;
  let activeSequenceIndex = 0;
  let selectedComposePiece = -1;
  let composeCursor = { x: 50, y: 50 };
  let selectedPairLeft = -1;
  let matchedPairIndexes = new Set();
  let drawingData = new Map();
  let numberGuessState = { key: "", guesses: [], solved: false };
  let changeableNumberState = { key: "", solved: false };
  let audioContext = null;
  let lastWrongAt = 0;
  let drafts = loadDrafts();
  let questionBank = readSessionQuestionBank();
  let pendingImport = null;
  let slotGrid = loadGrid();
  let selectedBerry = "kazberry";
  let placementMode = "column";
  let issuedClientActivities = readSessionArray(CLIENT_ISSUED_KEY).filter((entry) => entry && typeof entry.activityId === "string");
  let clientSubmissions = readSessionArray(CLIENT_ANSWERS_KEY).filter((entry) => validateClientSubmission(entry).ok);
  let pendingClientSubmissions = [];

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));
  }

  function safeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const absoluteWeb = /^https?:\/\//i.test(raw);
    const sitePath = /^(\/(?!\/)|\.\/|\.\.\/)/.test(raw);
    if (!absoluteWeb && !sitePath) return "";
    try {
      const parsed = new URL(raw, window.location.href);
      if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || (sitePath && parsed.origin !== window.location.origin)) return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readSessionArray(key) {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function persistClientSessionState() {
    try {
      sessionStorage.setItem(CLIENT_ISSUED_KEY, JSON.stringify(issuedClientActivities.slice(0, 40)));
      sessionStorage.setItem(CLIENT_ANSWERS_KEY, JSON.stringify(clientSubmissions.slice(0, 120)));
      return true;
    } catch (error) {
      console.warn("Player handoff data could not be saved to this tab session:", error);
      return false;
    }
  }

  function taskItems(content) {
    return (content.items || []).filter((item) => item && [item.label, item.image, item.asset].some((value) => String(value || "").trim()));
  }

  function getClientTaskSpec() {
    if (currentRound === "00" || currentRound === "0") return null;
    const effective = effectiveNow();
    const mode = effective.format.mode;
    if (!Object.hasOwn(CLIENT_ACTIVITY_ROUTES, mode)) return null;
    const items = taskItems(effective.content);
    const content = { ...effective.content, items };
    const needsPicture = mode === "draw-over-image" || mode === "compose-image";
    const hasPicture = Boolean(content.backgroundImage || content.promptImage || content.promptAsset);
    if (!items.length) return { ...effective, content, error: "Add at least one task item before exporting." };
    if (needsPicture && !hasPicture) return { ...effective, content, error: "Add the prompt picture before exporting this task." };
    return { ...effective, content, error: "" };
  }

  function syncClientActivityControls() {
    const spec = getClientTaskSpec();
    const mode = spec?.format.mode;
    const supported = Boolean(mode && Object.hasOwn(CLIENT_ACTIVITY_ROUTES, mode));
    clientOpenLink.hidden = !supported;
    clientExportTask.disabled = !supported || Boolean(spec?.error);
    if (!supported) {
      clientTaskStatus.textContent = "Choose a sort, picture-placement, or drawing task.";
    } else {
      const route = CLIENT_ACTIVITY_ROUTES[mode];
      clientOpenLink.href = "/rg/" + route + "/";
      const names = { "categorize-images": "SORT INTO THREE GROUPS", "compose-image": "PLACE IMAGES ON THE PICTURE", "draw-over-image": "DRAW OVER THE PICTURE" };
      clientTaskStatus.textContent = spec.error || (names[mode] + " - ROUND " + currentRound + " / DIFFICULTY " + currentDifficulty + " - " + spec.content.items.length + " item" + (spec.content.items.length === 1 ? "" : "s"));
    }
    clientExportAnswers.disabled = clientSubmissions.length === 0;
    clientClearAnswers.disabled = clientSubmissions.length === 0;
  }

  function downloadClientJson(value, filename) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportClientTask() {
    readEditor();
    const spec = getClientTaskSpec();
    if (!spec || spec.error) {
      clientTransferStatus.textContent = spec?.error || "Select a supported player task first.";
      return;
    }
    clientExportTask.disabled = true;
    clientTransferStatus.textContent = "Preparing the task file and its images...";
    try {
      const media = {};
      const assetIds = new Set([spec.content.promptAsset, ...spec.content.items.map((item) => item.asset)].filter(Boolean));
      for (const id of assetIds) media[id] = await blobToDataUrl(await readMediaBlob(id));
      const packet = buildClientActivity({
        activityId: newQuestionId(), round: currentRound, difficulty: currentDifficulty,
        mode: spec.format.mode, content: spec.content, format: spec.format, media,
      });
      const byteLength = new TextEncoder().encode(JSON.stringify(packet)).byteLength;
      if (byteLength > CLIENT_PACKET_MAX_BYTES) throw new Error("The task file is larger than 50 MB. Reduce the image sizes before exporting it.");
      const record = {
        activityId: packet.activityId,
        mode: packet.mode,
        round: packet.round,
        difficulty: packet.difficulty,
        itemCount: packet.content.items.length,
        createdAt: packet.createdAt,
      };
      issuedClientActivities = [record, ...issuedClientActivities.filter((entry) => entry.activityId !== record.activityId)].slice(0, 40);
      persistClientSessionState();
      const slug = CLIENT_ACTIVITY_ROUTES[packet.mode];
      downloadClientJson(packet, "rg-" + slug + "-round-" + packet.round + "-task.json");
      clientOpenLink.href = "/rg/" + slug + "/";
      clientTransferStatus.textContent = "Task file exported. Give it to players, then import their answer files here.";
    } catch (error) {
      clientTransferStatus.textContent = "Task export failed. " + error.message;
      console.warn("Ramble Gamble player task export failed:", error);
    } finally {
      syncClientActivityControls();
    }
  }

  async function previewClientAnswerFiles() {
    const files = [...(clientAnswerFiles.files || [])];
    pendingClientSubmissions = [];
    clientImportAnswers.disabled = true;
    clientImportPreview.hidden = true;
    if (!files.length) {
      clientTransferStatus.textContent = "Choose one or more player answer JSON files.";
      return;
    }
    try {
      const issued = new Map(issuedClientActivities.map((record) => [record.activityId, record]));
      const parsed = [];
      const errors = [];
      for (const file of files) {
        if (file.size > CLIENT_PACKET_MAX_BYTES) {
          errors.push(file.name + ": file exceeds 50 MB.");
          continue;
        }
        let submission;
        try { submission = JSON.parse(await file.text()); }
        catch { errors.push(file.name + ": invalid JSON."); continue; }
        const record = issued.get(submission?.activityId);
        if (!record) {
          errors.push(file.name + ": task ID was not exported in this host tab session.");
          continue;
        }
        const validation = validateClientSubmission(submission, record);
        if (submission.round !== record.round || submission.difficulty !== record.difficulty) validation.errors.push("The round details do not match the exported task.");
        if (!validation.ok || validation.errors.length) {
          errors.push(file.name + ": " + [...new Set(validation.errors)].join(" "));
          continue;
        }
        parsed.push(submission);
      }
      if (errors.length) {
        clientImportPreview.textContent = "No files were imported. Fix or remove the following:\n- " + errors.join("\n- ");
        clientImportPreview.hidden = false;
        clientTransferStatus.textContent = "Some files need attention.";
        return;
      }
      pendingClientSubmissions = parsed;
      clientImportPreview.textContent = parsed.map((submission) =>
        submission.participant.toUpperCase() + " - ROUND " + submission.round + " / DIFFICULTY " + submission.difficulty + " - " +
        ({ "categorize-images": "SORT", "compose-image": "PLACEMENT", "draw-over-image": "DRAWING" }[submission.mode])
      ).join("\n");
      clientImportPreview.hidden = false;
      clientImportAnswers.disabled = parsed.length === 0;
      clientTransferStatus.textContent = parsed.length + " answer file" + (parsed.length === 1 ? "" : "s") + " ready to import.";
    } catch (error) {
      clientTransferStatus.textContent = "Could not read the selected answer files.";
      clientImportPreview.textContent = error.message;
      clientImportPreview.hidden = false;
    }
  }

  function renderClientSubmissions() {
    clientSubmissionsNode.replaceChildren();
    clientSubmissions.forEach((submission) => {
      const details = document.createElement("details");
      details.className = "rg-client-submission";
      const summary = document.createElement("summary");
      summary.textContent = submission.participant.toUpperCase() + " - ROUND " + submission.round + " / DIFFICULTY " + submission.difficulty + " - " + (submission.snapshot.question || "Untitled task");
      details.append(summary);
      const answer = document.createElement("div");
      answer.className = "rg-client-submission-answer";
      const question = document.createElement("p");
      question.textContent = submission.snapshot.question || "";
      answer.append(question);
      if (submission.mode === "categorize-images") {
        const list = document.createElement("ol");
        submission.answer.assignments.forEach((group, index) => {
          const row = document.createElement("li");
          const item = submission.snapshot.items[index];
          row.textContent = (item?.label || "Image " + (index + 1)) + " - " + (submission.snapshot.categories[group] || "Group " + (group + 1));
          if (item?.image || item?.asset) addImageToNode(row, item.image, item.asset, "rg-client-result-thumb");
          list.append(row);
        });
        answer.append(list);
      } else if (submission.mode === "compose-image") {
        const picture = document.createElement("div");
        picture.className = "rg-client-result-compose";
        picture.style.aspectRatio = submission.snapshot.imageAspect && submission.snapshot.imageAspect !== "auto" ? submission.snapshot.imageAspect.replace(/\s/g, "") : "11 / 3";
        const background = document.createElement("img");
        background.className = "rg-client-result-background";
        background.alt = "";
        background.draggable = false;
        const backgroundUrl = safeUrl(submission.snapshot.backgroundImage || submission.snapshot.promptImage);
        const placeResultImages = () => {
          if (!background.naturalWidth || !background.naturalHeight) return;
          picture.style.aspectRatio = background.naturalWidth + " / " + background.naturalHeight;
          picture.querySelectorAll("[data-result-placement]").forEach((marker) => {
            marker.style.width = Math.min(100, (Number(submission.snapshot.pieceSize) || 32) / background.naturalWidth * 100) + "%";
            marker.style.height = Math.min(100, (Number(submission.snapshot.pieceSize) || 32) / background.naturalHeight * 100) + "%";
          });
        };
        background.addEventListener("load", placeResultImages);
        if (backgroundUrl) background.src = backgroundUrl;
        else if (submission.snapshot.promptAsset) readMedia(submission.snapshot.promptAsset).then((url) => { if (url) background.src = url; });
        picture.append(background);
        submission.answer.placements.forEach((placement, placementIndex) => {
          const item = submission.snapshot.items[placement.itemIndex];
          if (!item) return;
          const marker = document.createElement("span");
          marker.dataset.resultPlacement = String(placementIndex);
          marker.style.left = placement.x + "%";
          marker.style.top = placement.y + "%";
          marker.style.width = "3.7%";
          marker.style.height = "13.4%";
          marker.setAttribute("aria-label", item.label || "Placed image " + (placement.itemIndex + 1));
          if (item.image || item.asset) addImageToNode(marker, item.image, item.asset, "rg-client-result-place-image");
          else marker.textContent = item.label || "IMAGE";
          picture.append(marker);
        });
        answer.append(picture);
        if (background.complete && background.naturalWidth) placeResultImages();
        const list = document.createElement("ol");
        submission.answer.placements.forEach((placement) => {
          const row = document.createElement("li");
          const item = submission.snapshot.items[placement.itemIndex];
          row.textContent = (item?.label || "Image " + (placement.itemIndex + 1)) + " - " + Math.round(placement.x) + "% across, " + Math.round(placement.y) + "% down";
          if (item?.image || item?.asset) addImageToNode(row, item.image, item.asset, "rg-client-result-thumb");
          list.append(row);
        });
        answer.append(list);
      } else if (submission.mode === "draw-over-image") {
        const preview = document.createElement("div");
        preview.className = "rg-client-result-drawing";
        addImageToNode(preview, submission.snapshot.backgroundImage || submission.snapshot.promptImage, submission.snapshot.promptAsset, "rg-client-result-background");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 1000 1000");
        svg.setAttribute("aria-label", "Player drawing");
        for (const stroke of submission.answer.strokes) {
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", stroke.map((point, index) => (index ? "L" : "M") + point.x + " " + point.y).join(" "));
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "#ed1010");
          path.setAttribute("stroke-width", "8");
          path.setAttribute("stroke-linecap", "round");
          path.setAttribute("stroke-linejoin", "round");
          svg.append(path);
        }
        preview.append(svg);
        answer.append(preview);
      }
      const meta = document.createElement("small");
      meta.textContent = "Downloaded " + new Date(submission.submittedAt).toLocaleString();
      answer.append(meta);
      details.append(answer);
      clientSubmissionsNode.append(details);
    });
    if (!clientSubmissions.length) {
      const empty = document.createElement("p");
      empty.className = "rg-client-empty";
      empty.textContent = "No player answers imported in this tab yet.";
      clientSubmissionsNode.append(empty);
    }
    syncClientActivityControls();
  }

  function importClientAnswers() {
    if (!pendingClientSubmissions.length) return;
    const merged = new Map(clientSubmissions.map((submission) => [submission.activityId + ":" + submission.participant, submission]));
    pendingClientSubmissions.forEach((submission) => merged.set(submission.activityId + ":" + submission.participant, submission));
    clientSubmissions = [...merged.values()].slice(-120);
    const persisted = persistClientSessionState();
    clientTransferStatus.textContent = pendingClientSubmissions.length + " answer" + (pendingClientSubmissions.length === 1 ? "" : "s") + " imported." + (persisted ? " Saved in this tab session." : " Visible until this page closes; session storage was unavailable.");
    pendingClientSubmissions = [];
    clientAnswerFiles.value = "";
    clientImportPreview.hidden = true;
    clientImportAnswers.disabled = true;
    renderClientSubmissions();
  }

  function clearClientAnswers() {
    if (!clientSubmissions.length || !window.confirm("Clear imported player answers from this tab? Export Results first if you want a backup.")) return;
    clientSubmissions = [];
    persistClientSessionState();
    clientTransferStatus.textContent = "Imported answers cleared.";
    renderClientSubmissions();
  }

  function listDraftAssetIds(roundDrafts) {
    const ids = new Set();
    for (const levels of Object.values(roundDrafts || {})) {
      for (const draft of Object.values(levels || {})) {
        if (draft?.promptAsset) ids.add(String(draft.promptAsset));
        for (const option of draft?.options || []) if (option?.asset) ids.add(String(option.asset));
        for (const item of draft?.items || []) if (item?.asset) ids.add(String(item.asset));
      }
    }
    return [...ids];
  }

  function readMediaBlob(key) {
    return mediaDb().then((db) => {
      if (!db) throw new Error("Uploaded images are unavailable in this browser.");
      return new Promise((resolve, reject) => {
        const request = db.transaction("images", "readonly").objectStore("images").get(key);
        request.onsuccess = () => request.result ? resolve(request.result) : reject(new Error("An uploaded image could not be found."));
        request.onerror = () => reject(request.error || new Error("An uploaded image could not be read."));
      });
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("An uploaded image could not be exported."));
      reader.readAsDataURL(blob);
    });
  }

  async function createTriviaExport() {
    const media = {};
    for (const id of listDraftAssetIds(drafts.rounds)) media[id] = await blobToDataUrl(await readMediaBlob(id));
    return exportTriviaText({ rounds: drafts.rounds, questionBank, media });
  }

  function downloadTriviaText(contents) {
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ramble-gamble-trivia-" + new Date().toISOString().slice(0, 10) + ".txt";
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function decodeEmbeddedImage(value) {
    const match = String(value || "").match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
    if (!match) return null;
    const binary = atob(match[2].replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const blob = new Blob([bytes], { type: match[1] });
    if (blob.size > 15 * 1024 * 1024) throw new Error("An embedded image exceeds the 15 MB upload limit.");
    return blob;
  }

  async function storeEmbeddedImages(media) {
    const entries = Object.entries(media || {}).flatMap(([oldId, data]) => {
      if (typeof data !== "string" || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(data)) return [];
      const blob = decodeEmbeddedImage(data);
      if (!blob) return [];
      return [[oldId, newQuestionId(), blob]];
    });
    if (!entries.length) return {};
    const db = await mediaDb();
    if (!db) throw new Error("This browser cannot store the imported images.");
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      const store = transaction.objectStore("images");
      for (const [, newId, blob] of entries) store.put(blob, newId);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Imported images could not be stored."));
      transaction.onabort = () => reject(transaction.error || new Error("Imported image storage was cancelled."));
    });
    return Object.fromEntries(entries.map(([oldId, newId]) => [oldId, newId]));
  }

  async function removeStoredMediaAssets(ids) {
    const keys = [...new Set(Object.values(ids || {}))].filter(Boolean);
    if (!keys.length) return;
    const db = await mediaDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      const store = transaction.objectStore("images");
      keys.forEach((key) => store.delete(key));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Unused imported images could not be removed."));
      transaction.onabort = () => reject(transaction.error || new Error("Unused imported images could not be removed."));
    });
  }

  function remapDraftAssets(rounds, idMap) {
    for (const levels of Object.values(rounds || {})) {
      for (const draft of Object.values(levels || {})) {
        if (idMap[draft.promptAsset]) draft.promptAsset = idMap[draft.promptAsset];
        for (const option of draft.options || []) if (idMap[option.asset]) option.asset = idMap[option.asset];
        for (const item of draft.items || []) if (idMap[item.asset]) item.asset = idMap[item.asset];
      }
    }
  }

  function triviaImportSummary(parsed) {
    const roundIds = Object.keys(parsed.rounds || {});
    let levels = 0;
    let options = 0;
    let correct = 0;
    for (const round of Object.values(parsed.rounds || {})) {
      for (const draft of Object.values(round || {})) {
        levels += 1;
        for (const option of draft.options || []) {
          options += 1;
          if (option.correct) correct += 1;
        }
      }
    }
    const bankCount = (parsed.questionBank || []).length;
    const mediaCount = Object.keys(parsed.media || {}).length;
    const lines = [
      roundIds.length + " round" + (roundIds.length === 1 ? "" : "s") + "; " +
        levels + " difficulty entr" + (levels === 1 ? "y" : "ies") + "; " +
        options + " answer option" + (options === 1 ? "" : "s") + " (" + correct + " marked correct); " +
        bankCount + " host-bank question" + (bankCount === 1 ? "" : "s") + "; " +
        mediaCount + " embedded image" + (mediaCount === 1 ? "" : "s") + ".",
      "Merge replaces only matching round/difficulty entries and adds new bank questions. Replace clears the current session's trivia first.",
    ];
    if (parsed.warnings?.length) lines.push("", "Warnings:", ...parsed.warnings.map((warning) => "- " + warning));
    if (parsed.errors?.length) lines.push("", "Errors:", ...parsed.errors.map((error) => "- " + error));
    return lines.join("\n");
  }

  function mergeRoundDrafts(currentRounds, importedRounds) {
    const merged = copy(currentRounds || {});
    for (const [roundId, levels] of Object.entries(importedRounds || {})) {
      merged[roundId] = { ...(merged[roundId] || {}), ...copy(levels) };
    }
    return merged;
  }

  function newQuestionId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function renderQuestionBank() {
    questionBankList.replaceChildren();
    questionBankCount.textContent = questionBank.length + (questionBank.length === 1 ? " QUESTION" : " QUESTIONS");
    questionBankEmpty.hidden = questionBank.length > 0;
    questionBankList.hidden = questionBank.length === 0;
    $("#rg-arcade-status").textContent = questionBank.length
      ? questionBank.length + (questionBank.length === 1 ? " host question ready." : " host questions ready.")
      : "No host questions added yet.";

    questionBank.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = "rg-question-bank-item";
      const text = document.createElement("p");
      text.textContent = entry.text;
      const remove = document.createElement("button");
      remove.className = "rg-secondary-button rg-question-remove";
      remove.type = "button";
      remove.textContent = "REMOVE";
      remove.setAttribute("aria-label", "Remove question " + (index + 1));
      remove.addEventListener("click", () => saveQuestionBank(questionBank.filter((question) => question.id !== entry.id)));
      item.append(text, remove);
      questionBankList.append(item);
    });
  }

  function saveQuestionBank(nextQuestions) {
    try {
      questionBank = writeSessionQuestionBank(nextQuestions);
      renderQuestionBank();
      $("#rg-question-bank-save-state").textContent = "SAVED THIS SESSION";
      $("#rg-question-bank-save-state").dataset.error = "false";
      return true;
    } catch (error) {
      $("#rg-question-bank-save-state").textContent = "SESSION SAVE FAILED";
      $("#rg-question-bank-save-state").dataset.error = "true";
      console.warn("Ramble Gamble question bank could not be saved for this session:", error);
      return false;
    }
  }

  function loadDrafts() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}");
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
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
      saveState.textContent = "SAVED THIS SESSION";
      saveState.dataset.error = "false";
    } catch (error) {
      saveState.textContent = "SAVE FAILED";
      saveState.dataset.error = "true";
      console.warn("Ramble Gamble session draft could not be saved:", error);
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
      videoUrl: "", numberValue: 0, numberVisible: false, imageVisible: true, backgroundImage: "", drawing: "", assignments: [], placements: [],
      selectionRule: format.selectionRule || "any", requiredCorrectCount: format.requiredCorrectCount || 0, numberCode: "", guessLimit: 4,
    };
    let hasExplicitPlacements = false;
    if (!Number.isInteger(number) || number < 1 || number > 36) return { format, content };

    for (let level = 1; level <= Number(difficulty); level += 1) {
      const rule = ROUND_RULES[number]?.[level] || {};
      const draft = drafts.rounds[round]?.[level] || {};
      const requestedMode = draft.mode || rule.mode;
      if (requestedMode && requestedMode !== content.mode && ["number-grid", "image-grid"].includes(requestedMode) && !Object.hasOwn(draft, "optionCount")) delete content.optionCount;
      if (rule.mode) {
        if (content.mode && rule.mode !== content.mode) delete content.optionCount;
        content.mode = rule.mode;
      }
      if (rule.optionCount != null || rule.addOptions || rule.replaceOptions || rule.replaceItems) delete content.optionCount;
      if (draft.mode) content.mode = draft.mode;
      if (rule.resetQuestion) {
        content.question = "";
        content.subtitle = "";
        content.promptImage = "";
        content.promptAsset = "";
        content.acceptedAnswers = [];
        content.drawing = "";
        if (Array.isArray(content.options)) content.options = content.options.map((option) => option && typeof option === "object" ? { ...option, correct: false } : option);
      }
      if (Object.hasOwn(rule, "selectionRule")) content.selectionRule = rule.selectionRule;
      if (Object.hasOwn(rule, "requiredCorrectCount")) content.requiredCorrectCount = rule.requiredCorrectCount;
      if (rule.resetPromptImage) { content.promptImage = ""; content.promptAsset = ""; }
      if (rule.replaceOptions) content.options = [];
      if (rule.replaceItems) { content.items = []; content.placements = []; hasExplicitPlacements = true; }
      if (rule.mode === "match-pairs" && ROUND_RULES[number]?.[level - 1]?.mode !== "match-pairs") content.pairs = [];
      for (const field of ["question", "subtitle", "promptImage", "promptAsset", "optionCount", "acceptedAnswers", "options", "items", "pairs", "categories", "videoUrl", "numberValue", "numberVisible", "imageVisible", "backgroundImage", "drawing", "assignments", "placements", "selectionRule", "requiredCorrectCount", "numberCode", "guessLimit"]) {
        if (Object.hasOwn(draft, field)) {
          content[field] = copy(draft[field]);
          if (field === "placements") hasExplicitPlacements = true;
        }
      }
    }

    content.mode = resolveRoundMode(round, difficulty, drafts.rounds[round] || {});
    if (!modeNames[content.mode]) content.mode = format.mode;
    content.question = String(content.question || "");
    content.subtitle = String(content.subtitle || "");
    content.promptImage = String(content.promptImage || "");
    content.promptAsset = String(content.promptAsset || "");
    content.acceptedAnswers = Array.isArray(content.acceptedAnswers) ? content.acceptedAnswers.map(String) : [];
    content.options = Array.isArray(content.options) ? content.options.filter((item) => item && typeof item === "object").map((item) => ({ label: String(item.label || ""), image: String(item.image || ""), asset: String(item.asset || ""), correct: item.correct === true })) : [];
    content.items = Array.isArray(content.items) ? content.items.filter((item) => item && typeof item === "object").map((item) => ({ label: String(item.label || ""), image: String(item.image || ""), asset: String(item.asset || ""), x: Number.isFinite(Number(item.x)) ? Number(item.x) : 8, y: Number.isFinite(Number(item.y)) ? Number(item.y) : 8 })) : [];
    content.pairs = Array.isArray(content.pairs) ? content.pairs.filter((item) => item && typeof item === "object").map((item) => ({ left: String(item.left || ""), leftImage: String(item.leftImage || ""), right: String(item.right || "") })) : [];
    content.categories = Array.isArray(content.categories) ? content.categories.map(String) : ["Group 1", "Group 2", "Group 3"];
    content.assignments = Array.isArray(content.assignments) ? content.assignments.map((index) => Number.isInteger(index) && index >= 0 && index < 3 ? index : null) : [];
    content.videoUrl = String(content.videoUrl || "");
    content.backgroundImage = String(content.backgroundImage || "");
    content.numberValue = Number.isFinite(Number(content.numberValue)) ? Number(content.numberValue) : 0;
    content.numberVisible = content.numberVisible === true;
    content.imageVisible = content.imageVisible !== false;
    content.drawing = typeof content.drawing === "string" ? content.drawing : "";
    content.selectionRule = content.selectionRule === "all" ? "all" : "any";
    content.requiredCorrectCount = Math.max(0, Math.min(24, Math.trunc(Number(content.requiredCorrectCount) || 0)));
    content.numberCode = String(content.numberCode || "").replace(/\D/g, "").slice(0, 4);
    content.guessLimit = normalizeGuessLimit(content.guessLimit);
    if (content.optionCount == null) content.optionCount = content.mode === "number-grid" ? 16 : content.mode === "image-grid" && format.mode !== "image-grid" ? 12 : format.optionCount;
    content.optionCount = Math.max(0, Math.min(24, Number(content.optionCount) || 0));
    if (isChoiceMode(content.mode) && content.optionCount === 0) content.optionCount = content.mode === "number-grid" ? 16 : content.mode === "image-grid" ? 12 : 6;
    format = {
      ...format,
      optionCount: content.optionCount,
      reorder: resolveTimelineReorder(round, difficulty, drafts.rounds[round] || {}),
    };
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
    content.placements = hasExplicitPlacements
      ? normalizeComposePlacements(content.placements, content.items)
      : content.mode === "compose-image" ? migrateLegacyComposePlacements(content.items) : [];
    return { format: { ...format, mode: content.mode, selectionRule: content.selectionRule, requiredCorrectCount: content.requiredCorrectCount }, content };
  }

  function setTab(index, focus = false) {
    activeTab = (index + tabs.length) % tabs.length;
    dialog.classList.toggle("is-card-host", activeTab === 3);
    if (activeTab !== 2) setPresentation(false);
    tabs.forEach((tab, tabIndex) => {
      const active = tabIndex === activeTab;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[tabIndex].hidden = !active;
      if (active && focus) tab.focus();
    });
  }

  function openConsole(requestedTab = activeTab) {
    priorFocus = document.activeElement;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const tabIndex = Number.isInteger(requestedTab)
      ? requestedTab
      : tabs.findIndex((tab) => tab.id === "rg-tab-" + requestedTab);
    setTab(tabIndex >= 0 ? tabIndex : activeTab);
    tabs[activeTab]?.focus();
  }

  function closeConsole() {
    setPresentation(false);
    dialog.classList.remove("is-card-host");
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    if (priorFocus?.focus) priorFocus.focus();
  }

  function setPresentation(active, focus = false) {
    dialog.classList.toggle("is-presenting", active);
    presentButton.setAttribute("aria-pressed", String(active));
    presentButton.textContent = active ? "PRESENTING" : "PRESENT";
    returnToEditButton.hidden = !active;
    if (focus) (active ? returnToEditButton : presentButton).focus();
  }

  window.addEventListener("rg:open-host-panel", (event) => openConsole(event.detail?.tab || activeTab));
  window.addEventListener("rg:close-host-panel", closeConsole);
  closeButton.addEventListener("click", closeConsole);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeConsole();
  });
  dialog.addEventListener("close", () => { setPresentation(false); priorFocus?.focus?.(); });
  presentButton.addEventListener("click", () => setPresentation(!dialog.classList.contains("is-presenting"), true));
  returnToEditButton.addEventListener("click", () => setPresentation(false, true));
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
    window.dispatchEvent(new CustomEvent("rg:slot-grid-updated", { detail: { grid: slotGrid.slice() } }));
  }

  function publishSlotSettings() {
    window.dispatchEvent(new CustomEvent("rg:slot-settings-updated", {
      detail: { berry: selectedBerry, axis: placementMode },
    }));
  }

  function updateGridStatus() {
    const filled = slotGrid.filter(Boolean).length;
    $("#rg-slot-count").textContent = filled + " / 15";
    $("#rg-slot-help").textContent = placementMode === "row"
      ? "Click a row on the machine screen."
      : "Click a column on the machine screen.";
  }

  function renderGrid() {
    const board = $("#rg-slot-board");
    board.replaceChildren();
    slotGrid.forEach((berry, index) => {
      const cell = document.createElement("div");
      const row = Math.floor(index / 5);
      const column = index % 5;
      cell.className = "rg-slot-cell" + (berry ? " is-filled" : "");
      cell.dataset.index = String(index);
      cell.setAttribute("aria-label", "Row " + (row + 1) + ", column " + (column + 1) + ": " + (berry ? berryNames[berry] : "blank"));
      cell.setAttribute("role", "img");
      const cellIndex = document.createElement("span");
      cellIndex.className = "rg-slot-cell-index";
      cellIndex.textContent = String(index + 1).padStart(2, "0");
      cell.append(cellIndex);
      if (berry) {
        const image = document.createElement("img");
        image.className = "rg-slot-cell-berry";
        image.src = "/ramblegamble/assets/berries/" + berry + ".png";
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        image.draggable = false;
        cell.append(image);
      }
      board.append(cell);
    });
    updateGridStatus();
  }

  $$("[data-berry]").forEach((button) => button.addEventListener("click", () => {
    selectedBerry = button.dataset.berry;
    $$("[data-berry]").forEach((choice) => choice.setAttribute("aria-pressed", String(choice === button)));
    updateGridStatus();
    publishSlotSettings();
  }));
  $$("[data-placement]").forEach((button) => button.addEventListener("click", () => {
    placementMode = button.dataset.placement;
    $$("[data-placement]").forEach((choice) => choice.setAttribute("aria-pressed", String(choice === button)));
    updateGridStatus();
    publishSlotSettings();
  }));
  $("#rg-slot-clear").addEventListener("click", () => {
    slotGrid = Array(gridSize).fill(null);
    persistGrid();
    renderGrid();
    $("#rg-arcade-status").textContent = "Slot board reset.";
  });
  window.addEventListener("rg:slot-grid-updated", (event) => {
    const next = event.detail?.grid;
    if (!Array.isArray(next)) return;
    slotGrid = next.slice(0, gridSize).map((value) => Object.hasOwn(berryNames, value) ? value : null);
    renderGrid();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== GRID_KEY) return;
    slotGrid = loadGrid();
    renderGrid();
  });
  renderGrid();
  publishSlotSettings();

  $("#rg-spin-wheel").addEventListener("click", () => window.dispatchEvent(new CustomEvent("rg:spin-wheel")));
  window.addEventListener("rg:turn-start", (event) => {
    $("#rg-arcade-status").textContent = event.detail?.machine === "wheel" ? "The wheel is spinning..." : "The slot lever is moving...";
  });
  window.addEventListener("rg:turn-finish", (event) => {
    $("#rg-arcade-status").textContent = event.detail?.prompt || "No questions in the bank. Add some in the Trivia tab.";
  });
  window.addEventListener("rg:slot-action-start", () => {
    $("#rg-slot-clear").disabled = true;
    $("#rg-arcade-status").textContent = "Reels spinning...";
  });
  window.addEventListener("rg:slot-action-finish", (event) => {
    $("#rg-slot-clear").disabled = false;
    const totals = event.detail?.totals || {};
    const scored = Object.entries(totals).filter(([, amount]) => amount > 0)
      .map(([name, amount]) => name.toUpperCase() + " +" + Number(amount).toLocaleString());
    $("#rg-arcade-status").textContent = scored.length
      ? scored.join(" - ")
      : event.detail?.reason === "no-eligible-cell" ? "No open spot in that line." : "No pattern.";
  });

  exportButton.addEventListener("click", async () => {
    exportButton.disabled = true;
    importStatus.textContent = "Preparing the complete trivia text file...";
    try {
      const contents = await createTriviaExport();
      downloadTriviaText(contents);
      importStatus.textContent = "Trivia exported as a portable .txt file.";
    } catch (error) {
      importStatus.textContent = "Export failed: " + error.message;
      console.warn("Ramble Gamble trivia export failed:", error);
    } finally {
      exportButton.disabled = false;
    }
  });

  importFileInput.addEventListener("change", async () => {
    const file = importFileInput.files?.[0];
    pendingImport = null;
    importApplyButton.disabled = true;
    importPreview.hidden = true;
    if (!file) {
      importStatus.textContent = "No file selected.";
      return;
    }
    try {
      const parsed = parseTriviaText(decodeTriviaBytes(await file.arrayBuffer()));
      pendingImport = parsed;
      importPreview.textContent = triviaImportSummary(parsed);
      importPreview.hidden = false;
      const hasContent = Object.keys(parsed.rounds || {}).length > 0 || (parsed.questionBank || []).length > 0;
      importApplyButton.disabled = !hasContent || Boolean(parsed.errors?.length);
      importStatus.textContent = file.name + (parsed.errors?.length ? " could not be fully read." : " is ready to import.");
    } catch (error) {
      pendingImport = null;
      importStatus.textContent = "Could not read that text file: " + error.message;
      importPreview.textContent = "";
      importPreview.hidden = true;
      console.warn("Ramble Gamble trivia import preview failed:", error);
    }
  });

  importApplyButton.addEventListener("click", async () => {
    if (!pendingImport || pendingImport.errors?.length) return;
    const importData = pendingImport;
    importApplyButton.disabled = true;
    importFileInput.disabled = true;
    importModeSelect.disabled = true;
    exportButton.disabled = true;
    editor.inert = true;
    questionBankForm.inert = true;
    questionBankList.inert = true;
    importStatus.textContent = "Importing into this browser session...";
    let previousDraftValue;
    let previousBankValue;
    let savedSnapshot = false;
    let idMap = {};
    try {
      previousDraftValue = sessionStorage.getItem(DRAFT_KEY);
      previousBankValue = sessionStorage.getItem(QUESTION_BANK_SESSION_KEY);
      savedSnapshot = true;
      const importedRounds = copy(importData.rounds || {});
      idMap = await storeEmbeddedImages(importData.media);
      remapDraftAssets(importedRounds, idMap);

      const replace = importModeSelect.value === "replace";
      const nextRounds = replace ? importedRounds : mergeRoundDrafts(drafts.rounds, importedRounds);
      let nextBank;
      const importedBank = (importData.questionBank || []).map((entry) => ({ id: newQuestionId(), text: entry.text }));
      if (replace) {
        nextBank = importedBank;
      } else {
        nextBank = [...questionBank];
        const seen = new Set(nextBank.map((entry) => entry.text.trim().toLocaleLowerCase()));
        for (const entry of importedBank) {
          const key = entry.text.trim().toLocaleLowerCase();
          if (!seen.has(key)) { seen.add(key); nextBank.push(entry); }
        }
      }

      const nextDrafts = { version: 1, rounds: nextRounds };
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(nextDrafts));
        writeSessionQuestionBank(nextBank);
      } catch (error) {
        try {
          if (previousDraftValue === null) sessionStorage.removeItem(DRAFT_KEY);
          else sessionStorage.setItem(DRAFT_KEY, previousDraftValue);
          if (previousBankValue === null) sessionStorage.removeItem(QUESTION_BANK_SESSION_KEY);
          else sessionStorage.setItem(QUESTION_BANK_SESSION_KEY, previousBankValue);
        } catch (rollbackError) {
          console.warn("Ramble Gamble trivia session rollback was incomplete:", rollbackError);
        }
        throw error;
      }

      drafts = nextDrafts;
      questionBank = readSessionQuestionBank();
      saveState.textContent = "SAVED THIS SESSION";
      saveState.dataset.error = "false";
      $("#rg-question-bank-save-state").textContent = "SAVED THIS SESSION";
      $("#rg-question-bank-save-state").dataset.error = "false";
      renderQuestionBank();
      render();
      importStatus.textContent = "Import complete. Your existing session was " + (replace ? "replaced." : "merged.");
      pendingImport = null;
      importFileInput.value = "";
    } catch (error) {
      if (Object.keys(idMap).length) {
        try { await removeStoredMediaAssets(idMap); }
        catch (cleanupError) { console.warn("Unused imported images could not be cleaned up:", cleanupError); }
      }
      if (!savedSnapshot) console.warn("Trivia import could not read the existing session snapshot.");
      importStatus.textContent = "Import failed; existing trivia was kept. " + error.message;
      console.warn("Ramble Gamble trivia import failed:", error);
    } finally {
      importFileInput.disabled = false;
      importModeSelect.disabled = false;
      exportButton.disabled = false;
      editor.inert = false;
      questionBankForm.inert = false;
      questionBankList.inert = false;
      importApplyButton.disabled = !pendingImport || Boolean(pendingImport.errors?.length);
    }
  });

  questionBankForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = questionBankInput.value.trim();
    if (!text) {
      questionBankInput.focus();
      return;
    }
    if (saveQuestionBank([...questionBank, { id: newQuestionId(), text }])) {
      questionBankInput.value = "";
      questionBankInput.focus();
    }
  });
  renderQuestionBank();

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
    if (!isChoiceMode(format.mode) || format.mode === "number-grid") return "";
    let html = '<h4 class="rg-editor-section-title">ANSWER OPTIONS <span>(' + format.optionCount + ')</span></h4>';
    html += '<p class="rg-editor-hint">Fill text, an image URL, or both. Check every option that counts as correct.</p>';
    const options = padOptions(content.options, format.optionCount);
    options.forEach((option, index) => {
      html += '<div class="rg-option-row" data-option-row="' + index + '" data-asset-id="' + esc(option.asset || "") + '">';
      if (format.mode === "number-grid") {
        html += '<input type="hidden" data-option-label value="' + (index + 1) + '"><input type="hidden" data-option-image value=""><span>NUMBER ' + String(index + 1).padStart(2, "0") + '</span>';
      } else {
        const textPlaceholder = "Option " + String(index + 1).padStart(2, "0");
        html += '<input type="text" data-option-label placeholder="' + esc(textPlaceholder) + '" value="' + esc(option.label || "") + '" aria-label="Option ' + (index + 1) + ' text">';
        html += '<input type="url" data-option-image placeholder="Image URL (optional)" value="' + esc(option.image || "") + '" aria-label="Option ' + (index + 1) + ' image URL">';
        html += '<label class="rg-option-upload">FILE<input type="file" data-option-file accept="image/*" aria-label="Upload image for option ' + (index + 1) + '"></label>';
      }
      html += '<input type="checkbox" data-option-correct aria-label="Mark option ' + (index + 1) + ' correct" ' + (option.correct ? "checked" : "") + ">";
      html += '</div>';
    });
    return html;
  }

  function itemRowsHTML(format, content) {
    const modes = ["categorize-images", "timeline", "image-sequence", "text-sequence", "compose-image"];
    if (!modes.includes(format.mode)) return "";
    const isTimeline = format.mode === "timeline";
    const isCompose = format.mode === "compose-image";
    const items = content.items || [];
    let html = '<h4 class="rg-editor-section-title">' + (isCompose ? "OBJECT TYPES" : "ITEMS") + ' <span>(' + format.optionCount + ')</span></h4>';
    html += isCompose
      ? '<p class="rg-editor-hint">Select a type, place it on the image, then click a placed object to remove it.</p>'
      : isTimeline
      ? '<p class="rg-editor-hint">Edit event names, then drag a handle or use UP/DOWN to set their order.</p>'
      : '<p class="rg-editor-hint">Use text, an image URL, or both. Empty items remain visibly marked as placeholders.</p>';
    items.forEach((item, index) => {
      const number = String(index + 1).padStart(2, "0");
      html += '<div class="rg-item-row' + (isTimeline ? ' rg-item-row--timeline' : '') + (isCompose ? ' rg-item-row--compose' : '') + '" data-item-row="' + index + '" data-asset-id="' + esc(item.asset || "") + '" data-item-x="' + Number(item.x ?? 0) + '" data-item-y="' + Number(item.y ?? 0) + '">';
      if (isTimeline) {
        html += '<div class="rg-item-order-controls">';
        html += '<button type="button" data-item-drag-handle aria-label="Drag event ' + (index + 1) + ' to reorder">DRAG</button>';
        html += '<button type="button" data-item-move="-1" aria-label="Move event ' + (index + 1) + ' up">UP</button>';
        html += '<button type="button" data-item-move="1" aria-label="Move event ' + (index + 1) + ' down">DOWN</button>';
        html += '<span data-item-number aria-hidden="true">' + number + '</span>';
        html += '</div>';
      }
      html += '<input type="text" data-item-label placeholder="' + (isTimeline ? "Event " : "Item ") + number + '" value="' + esc(item.label || "") + '" aria-label="' + (isTimeline ? "Timeline event " : "Item ") + (index + 1) + ' name">';
      html += '<input type="url" data-item-image placeholder="Image URL" value="' + esc(item.image || "") + '" aria-label="' + (isTimeline ? "Timeline event " : "Item ") + (index + 1) + ' image URL">';
      if (isCompose) html += '<label class="rg-option-upload rg-item-upload">FILE<input type="file" data-item-file accept="image/*" aria-label="Upload image for object type ' + (index + 1) + '"></label>';
      if (!isTimeline) html += '<span aria-hidden="true">' + number + '</span>';
      html += '</div>';
    });
    return html;
  }

  function syncEditorItemRows() {
    const rows = $$("[data-item-row]", itemsEditor);
    rows.forEach((row, index) => {
      const number = String(index + 1).padStart(2, "0");
      row.dataset.itemRow = String(index);
      const numberLabel = $("[data-item-number]", row);
      if (numberLabel) numberLabel.textContent = number;
      const dragHandle = $("[data-item-drag-handle]", row);
      if (dragHandle) dragHandle.setAttribute("aria-label", "Drag event " + (index + 1) + " to reorder");
      const itemLabel = $("[data-item-label]", row);
      if (itemLabel && row.classList.contains("rg-item-row--timeline")) itemLabel.setAttribute("aria-label", "Timeline event " + (index + 1) + " name");
      const imageInput = $("[data-item-image]", row);
      if (imageInput && row.classList.contains("rg-item-row--timeline")) imageInput.setAttribute("aria-label", "Timeline event " + (index + 1) + " image URL");
      const up = $("[data-item-move='-1']", row);
      const down = $("[data-item-move='1']", row);
      if (up) {
        up.disabled = index === 0;
        up.setAttribute("aria-label", "Move event " + (index + 1) + " up");
      }
      if (down) {
        down.disabled = index === rows.length - 1;
        down.setAttribute("aria-label", "Move event " + (index + 1) + " down");
      }
    });
  }

  function moveEditorItem(row, direction) {
    const rows = $$("[data-item-row]", itemsEditor);
    const index = rows.indexOf(row);
    const target = rows[index + direction];
    if (!target) return false;
    if (direction < 0) itemsEditor.insertBefore(row, target);
    else itemsEditor.insertBefore(row, target.nextSibling);
    syncEditorItemRows();
    saveAndRenderStage();
    return true;
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
    if (isChoiceMode(format.mode) && format.mode !== "number-grid") {
      const counts = [5, 6, 8, 9, 10, 12, 13, 16, 18, 24];
      const chosen = counts.includes(format.optionCount) ? format.optionCount : 6;
      html += '<label class="rg-field-label" for="rg-edit-option-count">Number of options<select id="rg-edit-option-count" data-option-count>';
      counts.forEach((count) => { html += '<option value="' + count + '" ' + (count === chosen ? "selected" : "") + '>' + count + '</option>'; });
      html += '</select></label>';
      html += '<label class="rg-field-label" for="rg-edit-selection-rule">How answers are judged<select id="rg-edit-selection-rule" data-selection-rule>';
      html += '<option value="any" ' + (content.selectionRule !== "all" ? "selected" : "") + '>Accept any one marked correct answer</option>';
      html += '<option value="all" ' + (content.selectionRule === "all" ? "selected" : "") + '>Require every marked correct answer</option>';
      html += '</select></label>';
      html += '<label class="rg-field-label" for="rg-edit-required-correct-count" ' + (content.selectionRule === "all" ? "" : "hidden") + '>Required selections <span>(0 = use the number marked correct)</span><input id="rg-edit-required-correct-count" type="number" min="0" max="24" step="1" data-required-correct-count value="' + (content.requiredCorrectCount || 0) + '"></label>';
    }
    if (format.mode === "number-grid") {
      html += '<label class="rg-field-label" for="rg-edit-number-code">Secret 4-digit number<input id="rg-edit-number-code" type="text" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" data-number-code value="' + esc(content.numberCode || "") + '" placeholder="For example, 0042"></label>';
      html += '<label class="rg-field-label" for="rg-edit-guess-limit">Maximum guesses<select id="rg-edit-guess-limit" data-guess-limit>';
      for (let count = 1; count <= 4; count += 1) html += '<option value="' + count + '" ' + (count === normalizeGuessLimit(content.guessLimit) ? "selected" : "") + '>' + count + (count === 1 ? " guess" : " guesses") + '</option>';
      html += '</select></label>';
      html += '<p class="rg-editor-hint">Four digits per guess. Keep leading zeroes if the code begins with 0.</p>';
    }
    if (format.mode === "timeline") {
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
    itemsEditor.innerHTML = itemRowsHTML(format, content) + pairRowsHTML(format, content);
    syncEditorItemRows();
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
      selectionRule: $("[data-selection-rule]", $("#rg-special-fields"))?.value || effectiveNow().content.selectionRule || "any",
      requiredCorrectCount: Number($("[data-required-correct-count]", $("#rg-special-fields"))?.value ?? effectiveNow().content.requiredCorrectCount ?? 0),
      numberCode: $("[data-number-code]", $("#rg-special-fields"))?.value.replace(/\D/g, "").slice(0, 4) || "",
      guessLimit: normalizeGuessLimit($("[data-guess-limit]", $("#rg-special-fields"))?.value ?? effectiveNow().content.guessLimit),
      options: $$("[data-option-row]", $("#rg-options-editor")).map((row) => ({
        label: $("[data-option-label]", row).value,
        image: $("[data-option-image]", row).value.trim(),
        asset: row.dataset.assetId || "",
        correct: $("[data-option-correct]", row).checked,
      })),
      items: $$("[data-item-row]", itemsEditor).map((row, index) => ({
        label: $("[data-item-label]", row).value,
        image: $("[data-item-image]", row).value.trim(),
        asset: row.dataset.assetId || "",
        x: Number.isFinite(Number(row.dataset.itemX)) ? Number(row.dataset.itemX) : effectiveNow().content.items[index]?.x ?? 8 + (index % 5) * 18,
        y: Number.isFinite(Number(row.dataset.itemY)) ? Number(row.dataset.itemY) : effectiveNow().content.items[index]?.y ?? 8 + (Math.floor(index / 5) % 4) * 18,
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
      placements: effectiveNow().content.placements || [],
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
    syncClientActivityControls();
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
    if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
    if (file.size > 15 * 1024 * 1024) throw new Error("Choose an image smaller than 15 MB.");
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
    if (!answer) {
      setAnswerStatus("Enter the answer given first.", "neutral");
      return;
    }
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
    const question = effective.content.question.trim();
    questionText.textContent = question;
    questionText.hidden = !question || currentRound === "00";
    subtitleText.textContent = effective.content.subtitle || "";
    subtitleText.hidden = !effective.content.subtitle || currentRound === "00";
    promptImage.removeAttribute("src");
    promptImage.hidden = true;
    promptImage.alt = effective.content.question ? "" : "Question image for this round";
    const promptUrl = safeUrl(effective.content.promptImage);
    if (!["draw-over-image", "compose-image"].includes(effective.format.mode) && (promptUrl || effective.content.promptAsset)) {
      if (promptUrl) promptImage.src = promptUrl;
      else if (effective.content.promptAsset) readMedia(effective.content.promptAsset).then((url) => { if (url) promptImage.src = url; });
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
      const columns = format.mode === "image-grid" ? (count > 12 ? 6 : format.columns || (count <= 6 ? 3 : 4)) : (count <= 6 ? 3 : count <= 10 ? 5 : 4);
    stageItems.style.setProperty("--rg-choice-columns", String(columns || 2));
    const options = padOptions(content.options, count);
    const multiSelect = content.selectionRule === "all";
    const correctIndexes = options.flatMap((option, index) => option.correct ? [index] : []);
    const selected = new Set();
    const progress = document.createElement("p");
    progress.className = "rg-selection-progress";
    progress.setAttribute("aria-live", "polite");
    options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rg-answer-option";
      button.dataset.optionIndex = String(index);
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", option.label || (option.image || option.asset ? "Image option " + (index + 1) : "Option " + (index + 1)));
      if (option.image || option.asset) addImageToNode(button, option.image, option.asset);
      const label = document.createElement("span");
      const blankOption = format.blankOption && index === options.length - 1;
      label.textContent = option.label || (blankOption ? "BLANK" : (option.image || option.asset ? "" : "OPTION " + String(index + 1).padStart(2, "0")));
      button.append(label);
      button.addEventListener("click", () => {
        if (multiSelect) {
          if (selected.has(index)) selected.delete(index);
          else selected.add(index);
          button.setAttribute("aria-pressed", String(selected.has(index)));
          progress.textContent = selectionProgress(selected.size, content.requiredCorrectCount, correctIndexes.length);
          setAnswerStatus("", "neutral");
        } else {
          $$(".rg-answer-option", stageItems).forEach((other) => other.setAttribute("aria-pressed", "false"));
          button.setAttribute("aria-pressed", "true");
          checkOption(index);
        }
      });
      stageItems.append(button);
    });
    if (multiSelect) {
      progress.textContent = selectionProgress(0, content.requiredCorrectCount, correctIndexes.length);
      const submit = document.createElement("button");
      submit.type = "button";
      submit.className = "rg-stage-button";
      submit.textContent = "CHECK SELECTION";
      submit.addEventListener("click", () => {
        if (!correctIndexes.length || (content.requiredCorrectCount > 0 && correctIndexes.length !== content.requiredCorrectCount)) {
          const setupMessage = content.requiredCorrectCount > 0
            ? "Host setup: mark exactly " + content.requiredCorrectCount + " correct options in the editor."
            : "Host setup: mark at least one correct option in the editor.";
          setAnswerStatus(setupMessage, "neutral");
          return;
        }
        if (!selected.size) {
          setAnswerStatus("Select the correct answer option" + (correctIndexes.length === 1 ? "" : "s") + " first.", "neutral");
          return;
        }
        if (matchesCorrectSelection([...selected], correctIndexes)) {
          setAnswerStatus("CORRECT!", "correct");
          submit.disabled = true;
          $$(".rg-answer-option", stageItems).forEach((button) => { button.disabled = true; });
        } else setAnswerStatus("Not quite - adjust your selection and try again.", "wrong");
      });
      answerArea.append(progress, submit);
    }
  }

  function selectionProgress(selectedCount, requiredCount, correctCount) {
    const expected = requiredCount || correctCount;
    return expected
      ? "Select all " + expected + " correct answer" + (expected === 1 ? "" : "s") + " (" + selectedCount + " selected)."
      : "Select every marked correct answer (" + selectedCount + " selected).";
  }

  function renderNumberGrid(content) {
    const guessLimit = normalizeGuessLimit(content.guessLimit);
    const key = [currentRound, currentDifficulty, content.question, content.numberCode, guessLimit].join(":");
    if (numberGuessState.key !== key) numberGuessState = { key, guesses: [], solved: false };
    const board = document.createElement("div");
    board.className = "rg-number-guess-board";
    board.setAttribute("aria-label", guessLimit + (guessLimit === 1 ? " guess" : " guesses") + ", four digits per guess");
    const instructions = document.createElement("p");
    instructions.className = "rg-number-wordle-instructions";
    instructions.textContent = guessLimit + (guessLimit === 1 ? " guess" : " guesses") + ". Green = right spot, yellow = in the number elsewhere, grey = not in the number.";
    stageItems.append(instructions, board);

    const renderRows = () => {
      board.replaceChildren();
      for (let rowIndex = 0; rowIndex < guessLimit; rowIndex += 1) {
        const entry = numberGuessState.guesses[rowIndex];
        const row = document.createElement("div");
        row.className = "rg-number-guess-row" + (entry ? "" : " is-empty");
        row.setAttribute("aria-label", entry
          ? "Guess " + (rowIndex + 1) + ": " + entry.result.map((color, index) => entry.guess[index] + " " + color).join(", ")
          : "Guess " + (rowIndex + 1) + " not used");
        for (let column = 0; column < 4; column += 1) {
          const cell = document.createElement("span");
          const color = entry?.result[column] || "";
          cell.className = "rg-number-guess-cell" + (color ? " is-" + color : "");
          cell.textContent = entry?.guess[column] || "";
          cell.setAttribute("aria-hidden", "true");
          row.append(cell);
        }
        board.append(row);
      }
    };
    renderRows();

    const form = document.createElement("form");
    form.className = "rg-number-guess-form";
    form.noValidate = true;
    const input = document.createElement("input");
    input.type = "text";
    input.id = "rg-number-guess";
    input.inputMode = "numeric";
    input.maxLength = 4;
    input.pattern = "[0-9]{4}";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Enter a four-digit guess");
    input.placeholder = "4 DIGITS";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "rg-stage-button";
    submit.textContent = "GUESS";
    const codeReady = isFourDigitCode(content.numberCode);
    if (!codeReady) {
      input.disabled = true;
      submit.disabled = true;
      setAnswerStatus("Host: enter a four-digit secret in the editor first.", "neutral");
    }
    if (numberGuessState.solved || numberGuessState.guesses.length >= guessLimit) {
      input.disabled = true;
      submit.disabled = true;
    }
    input.addEventListener("input", () => {
      const clean = input.value.replace(/\D/g, "").slice(0, 4);
      if (input.value !== clean) input.value = clean;
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (numberGuessState.solved || numberGuessState.guesses.length >= guessLimit || !codeReady) return;
      const guess = input.value;
      if (!isFourDigitCode(guess)) {
        setAnswerStatus("Enter exactly four digits.", "neutral");
        input.focus();
        return;
      }
      const result = scoreFourDigitGuess(content.numberCode, guess);
      numberGuessState.guesses.push({ guess, result });
      const correct = result.every((color) => color === "green");
      numberGuessState.solved = correct;
      renderRows();
      if (correct) setAnswerStatus("CORRECT!", "correct");
      else if (numberGuessState.guesses.length >= guessLimit) setAnswerStatus("No guesses left. The number was " + content.numberCode + ".", "wrong");
      else setAnswerStatus((guessLimit - numberGuessState.guesses.length) + (guessLimit - numberGuessState.guesses.length === 1 ? " guess left." : " guesses left."), "neutral");
      input.value = "";
      input.disabled = correct || numberGuessState.guesses.length >= guessLimit;
      submit.disabled = input.disabled;
      if (!input.disabled) input.focus();
    });
    form.append(input, submit);
    answerArea.append(form);
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
    list.setAttribute("role", "list");
    content.items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "rg-timeline-row";
      row.setAttribute("role", "listitem");
      row.timelineItem = item;
      const label = document.createElement("div");
      label.className = "rg-empty-state";
      label.textContent = item.label || "EVENT " + String(index + 1).padStart(2, "0");
      if (item.image) addImageToNode(label, item.image, "", "rg-stage-media");
      row.append(label);
      if (format.reorder) {
        const dragHandle = document.createElement("button");
        dragHandle.type = "button";
        dragHandle.className = "rg-stage-button rg-timeline-drag-handle";
        dragHandle.textContent = "DRAG";
        dragHandle.dataset.timelineDrag = "true";
        dragHandle.setAttribute("aria-label", "Drag to reorder " + (item.label || "event " + (index + 1)));
        row.append(dragHandle);
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
    if (format.reorder) {
      let activeDrag = null;
      const finishDrag = (event) => {
        if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
        const changed = activeDrag.changed;
        activeDrag.row.classList.remove("is-dragging");
        activeDrag = null;
        if (!changed) return;
        writeLevelField("items", [...list.children].map((row) => copy(row.timelineItem)));
        render();
      };
      list.addEventListener("pointerdown", (event) => {
        const handle = event.target.closest("[data-timeline-drag]");
        if (!handle || (event.pointerType === "mouse" && event.button !== 0)) return;
        const row = handle.closest(".rg-timeline-row");
        if (!row) return;
        event.preventDefault();
        activeDrag = { pointerId: event.pointerId, handle, row, changed: false };
        row.classList.add("is-dragging");
        try { handle.setPointerCapture(event.pointerId); } catch {}
      });
      list.addEventListener("pointermove", (event) => {
        if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".rg-timeline-row");
        if (!target || target === activeDrag.row || target.parentElement !== list) return;
        const rect = target.getBoundingClientRect();
        const insertBefore = event.clientY < rect.top + rect.height / 2;
        const reference = insertBefore ? target : target.nextElementSibling;
        if (reference === activeDrag.row || activeDrag.row.nextElementSibling === reference) return;
        list.insertBefore(activeDrag.row, reference);
        activeDrag.changed = true;
      });
      list.addEventListener("pointerup", finishDrag);
      list.addEventListener("pointercancel", finishDrag);
    }
    stageItems.append(list);
  }

  function renderCategorize(format, content) {
    const buckets = document.createElement("div");
    buckets.className = "rg-category-buckets";
    const itemTray = document.createElement("div");
    itemTray.className = "rg-stage-items rg-category-item-grid";
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
        assigned.textContent = "REMOVE - " + (item.label || "IMAGE " + String(index + 1).padStart(2, "0"));
        assigned.setAttribute("aria-label", "Move " + (item.label || "image " + (index + 1)) + " back to the unassigned images");
        assigned.addEventListener("click", (event) => {
          event.stopPropagation();
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
      const label = document.createElement("span");
      label.textContent = item.label || "IMAGE " + String(index + 1).padStart(2, "0");
      tile.append(label);
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
        $$ ("[data-pair-left]", columns).forEach((item) => item.setAttribute("aria-pressed", "false"));
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
    const key = JSON.stringify([currentRound, currentDifficulty, memory, content.question, content.numberValue]);
    if (changeableNumberState.key !== key) changeableNumberState = { key, solved: false };

    const form = document.createElement("form");
    form.className = "rg-number-guess-form rg-changeable-number-form";
    form.noValidate = true;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.placeholder = "NUMBER";
    input.setAttribute("aria-label", "Enter a number");
    const check = document.createElement("button");
    check.type = "submit";
    check.className = "rg-stage-button";
    check.textContent = "CHECK";
    input.disabled = changeableNumberState.solved;
    check.disabled = changeableNumberState.solved;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (changeableNumberState.solved) return;
      const result = compareNumberGuess(content.numberValue, input.value);
      if (!result) {
        setAnswerStatus("ENTER A NUMBER", "neutral");
        input.focus();
        return;
      }
      if (result === "correct") {
        changeableNumberState.solved = true;
        setAnswerStatus("CORRECT!", "correct");
        input.disabled = true;
        check.disabled = true;
        return;
      }
      setAnswerStatus(result.toUpperCase(), "neutral");
      input.value = "";
      input.focus();
    });
    form.append(input, check);
    answerArea.append(form);
  }

  function renderDrawing(content) {
    const wrapper = document.createElement("div");
    wrapper.className = "rg-draw-wrapper";
    if (content.promptImage || content.promptAsset) addImageToNode(wrapper, content.promptImage, content.promptAsset, "rg-draw-background");
    const canvas = document.createElement("canvas");
    canvas.className = "rg-draw-canvas";
    canvas.width = 700;
    canvas.height = 700;
    canvas.setAttribute("aria-label", "Drawing surface. Draw in red over the image.");
    wrapper.append(canvas);
    stageItems.append(wrapper);
    const context = canvas.getContext("2d");
    context.strokeStyle = "#ed1010";
    context.lineWidth = 7;
    context.lineCap = "round";
    context.lineJoin = "round";
    const stored = drawingData.get(currentRound + ":" + currentDifficulty) || content.drawing;
    let restored = !stored;
    if (stored) {
      const image = new Image();
      image.onload = () => { context.drawImage(image, 0, 0, canvas.width, canvas.height); restored = true; };
      image.onerror = () => { restored = true; };
      image.src = stored;
    }
    let drawing = false;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
    };
    canvas.addEventListener("pointerdown", (event) => {
      if (!restored || !event.isPrimary || (event.button != null && event.button !== 0)) return;
      drawing = true;
      try { canvas.setPointerCapture(event.pointerId); } catch { /* Pointer capture can fail if a device cancels immediately. */ }
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
    const finishDrawing = () => {
      if (!drawing) return;
      drawing = false;
      const data = canvas.toDataURL("image/png");
      drawingData.set(currentRound + ":" + currentDifficulty, data);
      writeLevelField("drawing", data);
    };
    canvas.addEventListener("pointerup", finishDrawing);
    canvas.addEventListener("pointercancel", finishDrawing);
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

  function renderCompose(content, format) {
    const layout = document.createElement("div");
    layout.className = "rg-compose-layout";
    const tray = document.createElement("div");
    tray.className = "rg-compose-tray";
    tray.setAttribute("role", "group");
    tray.setAttribute("aria-label", "Object types");
    const board = document.createElement("div");
    board.className = "rg-compose-board";
    board.tabIndex = 0;
    board.style.aspectRatio = format.imageAspect || "11 / 3";
    const gridSize = Math.max(0, Number(format.gridSize) || 0);
    board.dataset.imageWidth = "880";
    board.dataset.imageHeight = "240";
    board.style.setProperty("--rg-compose-piece-width", (32 / 880 * 100) + "%");
    board.style.setProperty("--rg-compose-piece-height", (32 / 240 * 100) + "%");
    board.dataset.gridSize = String(gridSize);
    board.style.setProperty("--rg-compose-grid-width", gridSize ? (gridSize / 880 * 100) + "%" : "0px");
    board.style.setProperty("--rg-compose-grid-height", gridSize ? (gridSize / 240 * 100) + "%" : "0px");
    board.setAttribute("aria-label", "Image board. Select a type, then click to place it. Click a placed object to remove it. With a keyboard, use arrow keys and Enter.");

    const background = document.createElement("img");
    background.className = "rg-compose-background";
    background.alt = "";
    background.draggable = false;
    board.append(background);
    const setBackground = (url) => {
      if (!url) return;
      background.onload = () => {
        if (!board.isConnected || !background.naturalWidth || !background.naturalHeight) return;
        const width = background.naturalWidth;
        const height = background.naturalHeight;
        board.dataset.imageWidth = String(width);
        board.dataset.imageHeight = String(height);
        board.style.aspectRatio = width + " / " + height;
        board.style.setProperty("--rg-compose-piece-width", (32 / width * 100) + "%");
        board.style.setProperty("--rg-compose-piece-height", (32 / height * 100) + "%");
        if (gridSize > 0) {
          board.style.setProperty("--rg-compose-grid-width", (gridSize / width * 100) + "%");
          board.style.setProperty("--rg-compose-grid-height", (gridSize / height * 100) + "%");
        }
        updateGhost();
      };
      background.src = url;
    };
    const backgroundUrl = safeUrl(content.backgroundImage || content.promptImage);
    if (backgroundUrl) setBackground(backgroundUrl);
    else if (content.promptAsset) readMedia(content.promptAsset).then((url) => { if (url && board.isConnected) setBackground(url); });

    const placements = normalizeComposePlacements(content.placements, content.items);
    const ghost = document.createElement("div");
    ghost.className = "rg-compose-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.hidden = true;
    const updateGhost = () => {
      const type = content.items[selectedComposePiece];
      board.classList.toggle("has-selected-type", Boolean(type));
      ghost.replaceChildren();
      ghost.hidden = !type;
      if (!type) return;
      if (type.image || type.asset) addImageToNode(ghost, type.image, type.asset, "rg-compose-pixel-art");
      else ghost.textContent = type.label || "OBJECT";
      const width = Number(board.dataset.imageWidth) || 880;
      const height = Number(board.dataset.imageHeight) || 240;
      const snapped = snapComposePlacement(composeCursor.x / 100 * width, composeCursor.y / 100 * height, width, height, Number(board.dataset.gridSize), 32);
      ghost.style.left = snapped.x + "%";
      ghost.style.top = snapped.y + "%";
      ghost.style.width = "var(--rg-compose-piece-width)";
      ghost.style.height = "var(--rg-compose-piece-height)";
    };
    content.items.forEach((item, index) => {
      const typeButton = document.createElement("button");
      typeButton.type = "button";
      typeButton.className = "rg-compose-type";
      typeButton.dataset.composeType = String(index);
      typeButton.setAttribute("aria-pressed", String(selectedComposePiece === index));
      const label = item.label || "OBJECT " + String(index + 1).padStart(2, "0");
      typeButton.setAttribute("aria-label", "Select " + label);
      if (item.image || item.asset) addImageToNode(typeButton, item.image, item.asset, "rg-compose-pixel-art");
      const text = document.createElement("span");
      text.textContent = item.label || String(index + 1).padStart(2, "0");
      typeButton.append(text);
      typeButton.addEventListener("click", (event) => {
        selectedComposePiece = selectedComposePiece === index ? -1 : index;
        $$("[data-compose-type]", tray).forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.composeType) === selectedComposePiece)));
        updateGhost();
        if (event.detail === 0 && selectedComposePiece >= 0) board.focus();
      });
      tray.append(typeButton);
    });

    placements.forEach((placement, index) => {
      const item = content.items[placement.itemIndex];
      if (!item) return;
      const placed = document.createElement("button");
      placed.type = "button";
      placed.className = "rg-compose-piece";
      placed.dataset.composePlacement = String(index);
      placed.style.left = placement.x + "%";
      placed.style.top = placement.y + "%";
      placed.style.width = "var(--rg-compose-piece-width)";
      placed.style.height = "var(--rg-compose-piece-height)";
      const name = item.label || "OBJECT " + String(placement.itemIndex + 1).padStart(2, "0");
      placed.setAttribute("aria-label", "Remove placed " + name + " " + String(index + 1));
      if (item.image || item.asset) addImageToNode(placed, item.image, item.asset, "rg-compose-pixel-art");
      else placed.textContent = name;
      placed.addEventListener("click", (event) => {
        event.stopPropagation();
        const next = placements.filter((_, placementIndex) => placementIndex !== index);
        writeLevelField("placements", next);
        renderStage();
      });
      board.append(placed);
    });

    board.append(ghost);
    const pointerPlacement = (clientX, clientY) => {
      const rect = board.getBoundingClientRect();
      const imageWidth = Math.max(1, board.clientWidth);
      const imageHeight = Math.max(1, board.clientHeight);
      const localX = Math.max(0, Math.min(imageWidth, clientX - rect.left - board.clientLeft));
      const localY = Math.max(0, Math.min(imageHeight, clientY - rect.top - board.clientTop));
      const width = Number(board.dataset.imageWidth) || 880;
      const height = Number(board.dataset.imageHeight) || 240;
      composeCursor = {
        x: localX / imageWidth * 100,
        y: localY / imageHeight * 100,
      };
      return snapComposePlacement(localX / imageWidth * width, localY / imageHeight * height, width, height, Number(board.dataset.gridSize), 32);
    };
    const placeSelected = (placement) => {
      if (selectedComposePiece < 0 || !content.items[selectedComposePiece]) return;
      writeLevelField("placements", [...placements, { itemIndex: selectedComposePiece, ...placement }]);
      renderStage();
    };
    board.addEventListener("pointermove", (event) => {
      if (selectedComposePiece < 0) return;
      pointerPlacement(event.clientX, event.clientY);
      updateGhost();
    });
    board.addEventListener("click", (event) => {
      if (event.target.closest("[data-compose-placement]") || selectedComposePiece < 0) return;
      placeSelected(pointerPlacement(event.clientX, event.clientY));
    });
    board.addEventListener("keydown", (event) => {
      if (selectedComposePiece < 0) return;
      const width = Number(board.dataset.imageWidth) || 880;
      const height = Number(board.dataset.imageHeight) || 240;
      const step = Number(board.dataset.gridSize) || 8;
      let x = composeCursor.x / 100 * width;
      let y = composeCursor.y / 100 * height;
      if (event.key === "ArrowLeft") x -= step;
      else if (event.key === "ArrowRight") x += step;
      else if (event.key === "ArrowUp") y -= step;
      else if (event.key === "ArrowDown") y += step;
      else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        placeSelected(snapComposePlacement(x, y, width, height, Number(board.dataset.gridSize), 32));
        return;
      } else return;
      event.preventDefault();
      composeCursor = { x: Math.max(0, Math.min(100, x / width * 100)), y: Math.max(0, Math.min(100, y / height * 100)) };
      updateGhost();
    });

    const note = document.createElement("p");
    note.className = "rg-compose-help";
    note.textContent = "Select - place - click to remove";
    layout.append(tray, board);
    stageItems.append(note, layout);
  }

  function renderStage() {
    const effective = effectiveNow();
    const format = effective.format;
    const content = effective.content;
    $("#rg-round-badge").textContent = currentRound === "0" ? "HOST NOTE 0" : "ROUND " + currentRound;
    $("#rg-format-badge").textContent = currentRound === "00" ? "BLANK" : currentRound === "0" ? "SPECIAL INSTRUCTIONS" : (modeNames[format.mode] || "Question").toUpperCase();
    screen.dataset.mode = format.mode;
    screen.dataset.round = currentRound;
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
      $("#rg-format-badge").textContent = "SPECIAL INSTRUCTIONS";
      stageItems.innerHTML = '<div class="rg-host-instructions">' + esc(SPECIAL_ROUNDS["0"].body) + '</div>';
      answerArea.hidden = true;
      return;
    }
    if (!hasAuthoredTriviaContent(content)) {
      $("#rg-format-badge").textContent = "EMPTY ROUND";
      stageItems.hidden = false;
      answerArea.hidden = true;
      const emptyState = document.createElement("p");
      emptyState.className = "rg-round-empty";
      emptyState.textContent = "NO QUESTION SET FOR THIS ROUND";
      stageItems.append(emptyState);
      return;
    }
    if (format.mode === "number-grid") renderNumberGrid(content);
    else if (isChoiceMode(format.mode)) renderChoiceStage(format, content);
    else if (format.mode === "short-answer") renderShortAnswer();
    else if (format.mode === "timeline") renderTimeline(format, content);
    else if (format.mode === "categorize-images") renderCategorize(format, content);
    else if (format.mode === "match-pairs") renderPairs(content);
    else if (format.mode === "image-sequence" || format.mode === "text-sequence") renderSequence(format, content);
    else if (format.mode === "draw-over-image") renderDrawing(content);
    else if (format.mode === "compose-image") renderCompose(content, format);
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
      syncClientActivityControls();
      return;
    }
    if (special?.kind === "host-instructions") {
      renderEditor(resolveRoundFormat("0", 1), { question: "", subtitle: "", promptImage: "", promptAsset: "", mode: "short-answer", acceptedAnswers: [], options: [], items: [], pairs: [], categories: [], videoUrl: "", numberValue: 0 });
      renderStage();
      syncClientActivityControls();
      return;
    }
    const effective = effectiveNow();
    renderEditor(effective.format, effective.content);
    renderStage();
    syncClientActivityControls();
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
    if (event.target.id === "rg-edit-mode" || event.target.id === "rg-edit-option-count" || event.target.id === "rg-edit-selection-rule" || event.target.id === "rg-edit-guess-limit") {
      readEditor();
      render();
      queueSave();
    }
  });
  itemsEditor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-item-move]");
    if (!button) return;
    const row = button.closest("[data-item-row]");
    if (!row || button.disabled) return;
    event.preventDefault();
    moveEditorItem(row, Number(button.dataset.itemMove));
    button.focus();
  });
  let editorItemDrag = null;
  const finishEditorItemDrag = (event) => {
    if (!editorItemDrag || event.pointerId !== editorItemDrag.pointerId) return;
    const { row, changed } = editorItemDrag;
    row.classList.remove("is-dragging");
    editorItemDrag = null;
    if (!changed) return;
    syncEditorItemRows();
    saveAndRenderStage();
  };
  itemsEditor.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-item-drag-handle]");
    if (!handle || (event.pointerType === "mouse" && event.button !== 0)) return;
    const row = handle.closest("[data-item-row]");
    if (!row) return;
    event.preventDefault();
    editorItemDrag = { pointerId: event.pointerId, row, changed: false };
    row.classList.add("is-dragging");
    try { handle.setPointerCapture(event.pointerId); } catch {}
  });
  itemsEditor.addEventListener("pointermove", (event) => {
    if (!editorItemDrag || event.pointerId !== editorItemDrag.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-item-row]");
    if (!target || target === editorItemDrag.row || target.parentElement !== itemsEditor) return;
    const rect = target.getBoundingClientRect();
    const insertBefore = event.clientY < rect.top + rect.height / 2;
    const reference = insertBefore ? target : target.nextElementSibling;
    if (reference === editorItemDrag.row || editorItemDrag.row.nextElementSibling === reference) return;
    itemsEditor.insertBefore(editorItemDrag.row, reference);
    editorItemDrag.changed = true;
  });
  itemsEditor.addEventListener("pointerup", finishEditorItemDrag);
  itemsEditor.addEventListener("pointercancel", finishEditorItemDrag);
  $("#rg-edit-prompt-file").addEventListener("change", (event) => savePromptUpload(event.target.files?.[0]));
  $("#rg-clear-prompt-image").addEventListener("click", () => {
    $("#rg-edit-prompt-image").value = "";
    $("#rg-edit-prompt-file").dataset.assetId = "";
    saveAndRenderStage();
  });
  editor.addEventListener("change", async (event) => {
    const fileInput = event.target.closest("[data-option-file], [data-item-file]");
    if (!fileInput || !fileInput.files?.[0]) return;
    const itemFile = fileInput.matches("[data-item-file]");
    const row = fileInput.closest(itemFile ? "[data-item-row]" : "[data-option-row]");
    if (!row) return;
    try {
      row.dataset.assetId = await storeMedia(fileInput.files[0]);
      $(itemFile ? "[data-item-image]" : "[data-option-image]", row).value = "";
      saveAndRenderStage();
      saveState.textContent = "IMAGE SAVED HERE";
    } catch (error) {
      saveState.textContent = "IMAGE NOT SAVED";
      console.warn("Image upload failed:", error);
    }
  });
  $("#rg-clear-draft").addEventListener("click", () => {
    delete drafts.rounds[currentRound]?.[currentDifficulty];
    if (drafts.rounds[currentRound] && !Object.keys(drafts.rounds[currentRound]).length) delete drafts.rounds[currentRound];
    drawingData.delete(currentRound + ":" + currentDifficulty);
    saveDrafts();
    render();
  });

  clientExportTask.addEventListener("click", exportClientTask);
  clientAnswerFiles.addEventListener("change", previewClientAnswerFiles);
  clientImportAnswers.addEventListener("click", importClientAnswers);
  clientExportAnswers.addEventListener("click", () => {
    if (!clientSubmissions.length) return;
    downloadClientJson({ format: "kazvt.rg.client-results", version: 1, exportedAt: new Date().toISOString(), submissions: clientSubmissions }, "rg-player-results.json");
  });
  clientClearAnswers.addEventListener("click", clearClientAnswers);
  renderClientSubmissions();

  window.addEventListener("pagehide", () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
    if (audioContext && audioContext.state !== "closed") audioContext.close();
    audioContext = null;
  }, { once: true });

  window.addEventListener("pageshow", (event) => { if (event.persisted) render(); });

  render();
})();
