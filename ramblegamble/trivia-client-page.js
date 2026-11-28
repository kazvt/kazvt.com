import { ROOM_VERSION, decodePacket, isPlayer } from './card-room-protocol.mjs?v=answer-edit-20261128-v1';
import { validNonce, validPublicKey } from './card-room-auth.mjs?v=host-security-20261126-v1';
import { foley } from "./game-foley.mjs?v=sky-soot-20261127-v1";
import { createClientSubmission, validateClientActivity, CLIENT_PACKET_MAX_BYTES } from "./trivia-client.mjs?v=player-handoff-20261125-v1";
import { snapComposePlacement } from "./compose-placement.mjs?v=compose-repeat-place-20261124-v1";

(() => {
  "use strict";
  // Legacy activity URLs with a private invitation are aliases of the same
  // authenticated live controller, not a second independent seat/connection.
  const invite = decodePacket(location.hash.slice(1));
  if(invite?.v===ROOM_VERSION && isPlayer(invite.player) && /^rg-[a-f0-9]{32}$/.test(invite.room) && validNonce(invite.token) && validPublicKey(invite.hostKey)) {
    location.replace('/rg/player/'+location.hash); return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const expectedMode = document.body.dataset.rgClientMode;
  const taskFile = $("#rg-client-task-file");
  const playerSelect = $("#rg-client-player");
  const status = $("#rg-client-status");
  const activityRoot = $("#rg-client-activity");
  const questionNode = $("#rg-client-question");
  const subtitleNode = $("#rg-client-subtitle");
  const work = $("#rg-client-work");
  const saveButton = $("#rg-client-save");
  const copyButton = $("#rg-client-copy");
  const pageTitle = $("#rg-client-title");
  let activity = null;
  let answer = null;
  let selectedItem = -1;
  let selectedPiece = -1;
  let boardMetrics = { width: 880, height: 240 };
  let cursor = { x: 50, y: 50 };
  let drawingPointer = null;
  let activePath = null;
  let drawingBoard = null;
  let drawingSvg = null;

  const clamp = (number, low, high) => Math.max(low, Math.min(high, number));
  const escapeKey = (value) => String(value).replace(/[^a-z0-9_-]/gi, "_").slice(0, 120);

  function imageSource(url, asset) {
    if (asset && typeof activity?.media?.[asset] === "string") return activity.media[asset];
    if (typeof url === "string" && (/^https?:\/\//i.test(url) || /^(?:\/(?!\/)|\.\.?\/)/.test(url) || /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,/i.test(url))) {
      try {
        if (/^data:/i.test(url)) return url;
        const parsed = new URL(url, window.location.href);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
      } catch { /* Invalid image path. */ }
    }
    return "";
  }

  function makeImage(item, className = "") {
    const source = imageSource(item?.image, item?.asset);
    if (!source) return null;
    const image = document.createElement("img");
    image.className = className;
    image.src = source;
    image.alt = item?.label || "";
    image.draggable = false;
    image.addEventListener("error", () => { image.hidden = true; }, { once: true });
    return image;
  }

  function draftKey() {
    return "ramblegamble.client-draft.v1." + escapeKey(activity?.activityId || "") + "." + escapeKey(playerSelect.value || "none");
  }

  function initialAnswer(packet) {
    if (packet.mode === "categorize-images") return { assignments: Array(packet.content.items.length).fill(null) };
    if (packet.mode === "compose-image") return { placements: [] };
    return { strokes: [] };
  }

  function loadAnswer(packet) {
    const fallback = initialAnswer(packet);
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey()) || "null");
      if (!saved || typeof saved !== "object") return fallback;
      if (packet.mode === "categorize-images" && Array.isArray(saved.assignments) && saved.assignments.length === packet.content.items.length) {
        return { assignments: saved.assignments.map((group) => Number.isInteger(group) && group >= 0 && group < 3 ? group : null) };
      }
      if (packet.mode === "compose-image" && Array.isArray(saved.placements)) {
        return { placements: saved.placements.filter((entry) => entry && Number.isInteger(entry.itemIndex) && entry.itemIndex >= 0 && entry.itemIndex < packet.content.items.length && Number.isFinite(entry.x) && entry.x >= 0 && entry.x <= 100 && Number.isFinite(entry.y) && entry.y >= 0 && entry.y <= 100).slice(0, 500) };
      }
      if (packet.mode === "draw-over-image" && Array.isArray(saved.strokes)) {
        return { strokes: saved.strokes.filter((stroke) => Array.isArray(stroke) && stroke.length > 0 && stroke.every((point) => point && Number.isFinite(point.x) && point.x >= 0 && point.x <= 1000 && Number.isFinite(point.y) && point.y >= 0 && point.y <= 1000)).slice(0, 500) };
      }
    } catch { /* A blocked or malformed tab draft must not prevent the task from opening. */ }
    return fallback;
  }

  function saveDraft() {
    if (!activity || !answer || !playerSelect.value) return;
    try {
      sessionStorage.setItem(draftKey(), JSON.stringify(answer));
      status.textContent = "Draft saved in this tab - " + completionText();
    } catch {
      status.textContent = "Working in this tab - " + completionText();
    }
    updateActions();
  }

  function completionText() {
    if (!activity || !answer) return "";
    if (activity.mode === "categorize-images") {
      const assigned = answer.assignments.filter((value) => Number.isInteger(value)).length;
      return assigned + " / " + answer.assignments.length + " sorted";
    }
    if (activity.mode === "compose-image") return answer.placements.length + " placed";
    return answer.strokes.length + " stroke" + (answer.strokes.length === 1 ? "" : "s");
  }

  function isComplete() {
    if (!activity || !answer || !playerSelect.value) return false;
    if (activity.mode === "categorize-images") return answer.assignments.length > 0 && answer.assignments.every((group) => Number.isInteger(group) && group >= 0 && group < 3);
    if (activity.mode === "compose-image") return answer.placements.length > 0;
    return answer.strokes.length > 0;
  }

  function updateActions() {
    saveButton.disabled = !isComplete();
    copyButton.disabled = !isComplete();
  }

  function assignItem(itemIndex, categoryIndex) {
    if (!activity || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= activity.content.items.length) return;
    if (answer.assignments[itemIndex] !== categoryIndex) foley.play("place");
    answer.assignments[itemIndex] = categoryIndex;
    selectedItem = -1;
    renderSort();
    saveDraft();
  }

  function renderSort() {
    work.replaceChildren();
    const tools = document.createElement("div");
    tools.className = "rg-client-sort-tools";
    const hint = document.createElement("span");
    hint.textContent = "Choose an image, then a group - or drag it across.";
    const progress = document.createElement("span");
    progress.className = "rg-client-sort-progress";
    progress.textContent = completionText();
    tools.append(hint, progress);

    const grid = document.createElement("div");
    grid.className = "rg-client-item-grid";
    activity.content.items.forEach((item, index) => {
      if (Number.isInteger(answer.assignments[index])) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rg-client-sort-item";
      button.draggable = true;
      button.dataset.itemIndex = String(index);
      button.setAttribute("aria-pressed", String(selectedItem === index));
      button.setAttribute("aria-label", "Select " + (item.label || "image " + (index + 1)));
      const image = makeImage(item);
      if (image) button.append(image);
      const label = document.createElement("span");
      label.textContent = item.label || "IMAGE " + String(index + 1).padStart(2, "0");
      button.append(label);
      button.addEventListener("click", () => { selectedItem = selectedItem === index ? -1 : index; renderSort(); });
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", String(index));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      });
      grid.append(button);
    });

    const groups = document.createElement("div");
    groups.className = "rg-client-groups";
    activity.content.categories.forEach((name, groupIndex) => {
      const group = document.createElement("section");
      group.className = "rg-client-group";
      group.setAttribute("aria-label", name || "Group " + (groupIndex + 1));
      const choose = document.createElement("button");
      choose.type = "button";
      choose.className = "rg-client-group-button";
      choose.textContent = name || "GROUP " + (groupIndex + 1);
      choose.addEventListener("click", () => {
        if (selectedItem >= 0) assignItem(selectedItem, groupIndex);
      });
      group.append(choose);
      group.addEventListener("dragover", (event) => { event.preventDefault(); group.classList.add("is-drop-target"); });
      group.addEventListener("dragleave", (event) => { if (!group.contains(event.relatedTarget)) group.classList.remove("is-drop-target"); });
      group.addEventListener("drop", (event) => {
        event.preventDefault();
        group.classList.remove("is-drop-target");
        const index = Number(event.dataTransfer?.getData("text/plain"));
        if (Number.isInteger(index)) assignItem(index, groupIndex);
      });
      activity.content.items.forEach((item, index) => {
        if (answer.assignments[index] !== groupIndex) return;
        const assigned = document.createElement("button");
        assigned.type = "button";
        assigned.className = "rg-client-assigned";
        assigned.setAttribute("aria-label", "Return " + (item.label || "image " + (index + 1)) + " to the ungrouped images");
        const image = makeImage(item);
        if (image) assigned.append(image);
        const label = document.createElement("span");
        label.textContent = item.label || "IMAGE " + String(index + 1).padStart(2, "0");
        assigned.append(label);
        assigned.addEventListener("click", () => { foley.play("remove"); answer.assignments[index] = null; renderSort(); saveDraft(); });
        assigned.addEventListener("dragstart", (event) => { event.dataTransfer?.setData("text/plain", String(index)); });
        group.append(assigned);
      });
      groups.append(group);
    });
    work.append(tools, grid, groups);
  }

  function renderCompose() {
    work.replaceChildren();
    const layout = document.createElement("div");
    layout.className = "rg-client-compose-layout";
    const tray = document.createElement("div");
    tray.className = "rg-client-compose-tray";
    tray.setAttribute("role", "group");
    tray.setAttribute("aria-label", "Select an image to place");
    const board = document.createElement("div");
    board.className = "rg-client-picture";
    board.tabIndex = 0;
    board.setAttribute("role", "application");
    board.setAttribute("aria-label", "Picture placement board. Select an image and click to place it. Click a placed image to remove it. Use arrow keys and Enter to place with a keyboard.");
    board.style.aspectRatio = activity.content.imageAspect && activity.content.imageAspect !== "auto" ? activity.content.imageAspect.replace(/\s/g, "") : "11 / 3";
    const image = document.createElement("img");
    image.className = "rg-client-picture-background";
    image.alt = "";
    image.draggable = false;
    const background = imageSource(activity.content.backgroundImage || activity.content.promptImage, activity.content.promptAsset);
    image.src = background;
    const gridSize = activity.content.gridSize;
    const pieceSize = activity.content.pieceSize || 32;
    const setMetrics = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      boardMetrics = { width: image.naturalWidth, height: image.naturalHeight };
      board.style.aspectRatio = image.naturalWidth + " / " + image.naturalHeight;
      const gridW = gridSize > 0 ? gridSize / boardMetrics.width * 100 : 0;
      const gridH = gridSize > 0 ? gridSize / boardMetrics.height * 100 : 0;
      board.style.setProperty("--rg-client-grid-w", gridW + "%");
      board.style.setProperty("--rg-client-grid-h", gridH + "%");
      if (gridSize > 0) {
        board.style.backgroundImage = "linear-gradient(rgba(0,0,0,.36) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.36) 1px, transparent 1px), repeating-conic-gradient(#f4f4f4 0 25%, #c9c9c9 0 50%)";
        board.style.backgroundSize = gridW + "% " + gridH + "% , " + gridW + "% " + gridH + "% , " + (gridW * 2) + "% " + (gridH * 2) + "%";
      }
      renderPlaced();
      updateGhost();
    };
    image.addEventListener("load", setMetrics);
    image.addEventListener("error", () => { status.textContent = "The picture could not be loaded. Re-open the task file or tell the host."; });
    board.append(image);
    const pieces = new Map();
    const ghost = document.createElement("div");
    ghost.className = "rg-client-place-ghost";
    ghost.hidden = true;

    activity.content.items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rg-client-compose-type";
      button.setAttribute("aria-pressed", String(selectedPiece === index));
      button.setAttribute("aria-label", "Select " + (item.label || "image " + (index + 1)));
      const thumb = makeImage(item);
      if (thumb) button.append(thumb);
      const label = document.createElement("span");
      label.textContent = item.label || "IMAGE " + String(index + 1).padStart(2, "0");
      button.append(label);
      button.addEventListener("click", () => {
        selectedPiece = selectedPiece === index ? -1 : index;
        tray.querySelectorAll("[aria-pressed]").forEach((node) => node.setAttribute("aria-pressed", String(Number(node.dataset.itemIndex) === selectedPiece)));
        board.classList.toggle("has-selected-type", selectedPiece >= 0);
        updateGhost();
      });
      button.dataset.itemIndex = String(index);
      tray.append(button);
      pieces.set(index, item);
    });

    function snapped(clientX, clientY) {
      const rect = board.getBoundingClientRect();
      const left = clamp(clientX - rect.left - board.clientLeft, 0, Math.max(0, board.clientWidth));
      const top = clamp(clientY - rect.top - board.clientTop, 0, Math.max(0, board.clientHeight));
      return snapComposePlacement(left / Math.max(1, board.clientWidth) * boardMetrics.width, top / Math.max(1, board.clientHeight) * boardMetrics.height, boardMetrics.width, boardMetrics.height, gridSize, pieceSize);
    }

    function sizePiece(node) {
      node.style.width = Math.min(100, pieceSize / boardMetrics.width * 100) + "%";
      node.style.height = Math.min(100, pieceSize / boardMetrics.height * 100) + "%";
    }

    function renderPlaced() {
      board.querySelectorAll("[data-placement-index]").forEach((node) => node.remove());
      answer.placements.forEach((placement, placementIndex) => {
        const item = pieces.get(placement.itemIndex);
        if (!item) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "rg-client-place-piece";
        button.dataset.placementIndex = String(placementIndex);
        button.style.left = placement.x + "%";
        button.style.top = placement.y + "%";
        sizePiece(button);
        button.setAttribute("aria-label", "Remove placed " + (item.label || "image " + (placement.itemIndex + 1)));
        const placedImage = makeImage(item);
        if (placedImage) button.append(placedImage);
        else button.textContent = item.label || "IMAGE";
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          foley.play("remove");
          answer.placements.splice(placementIndex, 1);
          renderPlaced();
          saveDraft();
        });
        board.append(button);
      });
      if (ghost.parentElement !== board) board.append(ghost);
    }

    function updateGhost() {
      ghost.replaceChildren();
      ghost.hidden = selectedPiece < 0;
      if (selectedPiece < 0) return;
      const item = pieces.get(selectedPiece);
      const thumb = makeImage(item);
      if (thumb) ghost.append(thumb);
      else ghost.textContent = item?.label || "IMAGE";
      ghost.style.left = cursor.x + "%";
      ghost.style.top = cursor.y + "%";
      sizePiece(ghost);
    }

    const placeAt = (position) => {
      if (selectedPiece < 0 || !pieces.has(selectedPiece)) return;
      foley.play("place");
      answer.placements.push({ itemIndex: selectedPiece, x: position.x, y: position.y });
      renderPlaced();
      saveDraft();
    };

    board.addEventListener("pointermove", (event) => {
      if (selectedPiece < 0) return;
      const pos = snapped(event.clientX, event.clientY);
      cursor = { x: pos.x, y: pos.y };
      updateGhost();
    });
    board.addEventListener("click", (event) => {
      if (event.target.closest("[data-placement-index]") || selectedPiece < 0) return;
      placeAt(snapped(event.clientX, event.clientY));
    });
    board.addEventListener("keydown", (event) => {
      if (selectedPiece < 0) return;
      const step = gridSize || 8;
      let x = cursor.x / 100 * boardMetrics.width;
      let y = cursor.y / 100 * boardMetrics.height;
      if (event.key === "ArrowLeft") x -= step;
      else if (event.key === "ArrowRight") x += step;
      else if (event.key === "ArrowUp") y -= step;
      else if (event.key === "ArrowDown") y += step;
      else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        placeAt({ x: cursor.x, y: cursor.y });
        return;
      } else return;
      event.preventDefault();
      const pos = snapComposePlacement(x, y, boardMetrics.width, boardMetrics.height, gridSize, pieceSize);
      cursor = { x: pos.x, y: pos.y };
      updateGhost();
    });

    const hint = document.createElement("p");
    hint.className = "rg-client-compose-hint";
    hint.textContent = "Select an image, click to place it - click a placed image to remove it.";
    layout.append(tray, board);
    work.append(hint, layout);
    board.append(ghost);
    if (image.complete && image.naturalWidth) setMetrics();
  }

  function renderDrawing() {
    work.replaceChildren();
    const tools = document.createElement("div");
    tools.className = "rg-client-draw-tools";
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "rg-client-button rg-client-button-secondary";
    undo.textContent = "UNDO";
    undo.addEventListener("click", () => { if(answer.strokes.length) foley.play("erase"); answer.strokes.pop(); paintStrokes(); saveDraft(); });
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "rg-client-button rg-client-button-secondary";
    clear.textContent = "CLEAR";
    clear.addEventListener("click", () => { if(answer.strokes.length) foley.play("erase"); answer.strokes = []; paintStrokes(); saveDraft(); });
    tools.append(undo, clear);

    const board = document.createElement("div");
    board.className = "rg-client-draw-board";
    board.setAttribute("role", "application");
    board.setAttribute("aria-label", "Draw in red over the picture");
    const image = document.createElement("img");
    image.className = "rg-client-draw-background";
    image.alt = "";
    image.draggable = false;
    image.src = imageSource(activity.content.backgroundImage || activity.content.promptImage, activity.content.promptAsset);
    image.addEventListener("error", () => { status.textContent = "The picture could not be loaded. Re-open the task file or tell the host."; });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("rg-client-draw-svg");
    svg.setAttribute("viewBox", "0 0 1000 1000");
    svg.setAttribute("preserveAspectRatio", "none");
    board.append(image, svg);
    drawingBoard = board;
    drawingSvg = svg;

    const svgPoint = (event) => {
      const rect = board.getBoundingClientRect();
      return {
        x: Math.round(clamp((event.clientX - rect.left - board.clientLeft) / Math.max(1, board.clientWidth) * 1000, 0, 1000) * 100) / 100,
        y: Math.round(clamp((event.clientY - rect.top - board.clientTop) / Math.max(1, board.clientHeight) * 1000, 0, 1000) * 100) / 100,
      };
    };
    board.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || !image.naturalWidth || drawingPointer!==null || (event.button != null && event.button !== 0) || answer.strokes.length >= 500) return;
      event.preventDefault();
      drawingPointer = event.pointerId;
      activePath = [svgPoint(event)];
      answer.strokes.push(activePath);
      foley.play("draw");
      try { board.setPointerCapture(event.pointerId); } catch { /* Pointer capture can be unavailable. */ }
      paintStrokes();
    });
    board.addEventListener("pointermove", (event) => {
      if (drawingPointer !== event.pointerId || !activePath) return;
      const next = svgPoint(event);
      const previous = activePath.at(-1);
      if (Math.hypot(next.x - previous.x, next.y - previous.y) < 1.5) return;
      const total = answer.strokes.reduce((sum, stroke) => sum + stroke.length, 0);
      if (total >= 40000) {
        drawingPointer = null;
        activePath = null;
        status.textContent = "This drawing reached its size limit. You can still download the strokes already drawn.";
        return;
      }
      activePath.push(next);
      paintStrokes();
    });
    const finish = (event) => {
      if (drawingPointer !== event.pointerId) return;
      drawingPointer = null;
      activePath = null;
      saveDraft();
    };
    board.addEventListener("pointerup", finish);
    board.addEventListener("pointercancel", finish);
    board.addEventListener("lostpointercapture", finish);
    work.append(tools, board);
    paintStrokes();
  }

  function paintStrokes() {
    if (!drawingSvg || !answer) return;
    drawingSvg.replaceChildren();
    answer.strokes.forEach((stroke) => {
      if (!stroke.length) return;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const d = stroke.map((point, index) => (index ? "L" : "M") + point.x + " " + point.y).join(" ") + (stroke.length===1 ? " L"+stroke[0].x+" "+stroke[0].y : "");
      path.setAttribute("d", stroke.length === 1 ? d + " l0.1 0" : d);
      drawingSvg.append(path);
    });
  }

  function renderActivity() {
    if (!activity) return;
    questionNode.textContent = activity.content.question || "";
    questionNode.hidden = !activity.content.question;
    subtitleNode.textContent = activity.content.subtitle || "";
    subtitleNode.hidden = !activity.content.subtitle;
    answer = loadAnswer(activity);
    activityRoot.hidden = false;
    if (activity.mode === "categorize-images") renderSort();
    else if (activity.mode === "compose-image") renderCompose();
    else renderDrawing();
    updateActions();
    status.textContent = "Task loaded - " + completionText();
  }

  async function openTaskFile(file) {
    if (!file) return;
    if (file.size > CLIENT_PACKET_MAX_BYTES) {
      status.textContent = "This task file is larger than 50 MB.";
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      const validation = validateClientActivity(parsed, expectedMode);
      if (!validation.ok) {
        status.textContent = validation.errors.join(" ");
        return;
      }
      activity = parsed;
      const titles = { "categorize-images": "SORT INTO THREE GROUPS", "compose-image": "PLACE IMAGES ON THE PICTURE", "draw-over-image": "DRAW OVER THE PICTURE" };
      pageTitle.textContent = titles[activity.mode];
      document.title = titles[activity.mode] + " - Ramble Gamble";
      selectedItem = -1;
      selectedPiece = -1;
      cursor = { x: 50, y: 50 };
      renderActivity();
      playerSelect.dispatchEvent(new Event("change"));
    } catch (error) {
      status.textContent = error instanceof SyntaxError ? "That file is not valid JSON." : "Could not open the task file.";
    }
  }

  function makeSubmission() {
    if (!activity || !isComplete()) return null;
    const result = createClientSubmission(activity, playerSelect.value, answer);
    return result;
  }

  function downloadSubmission() {
    const submission = makeSubmission();
    if (!submission) return;
    const blob = new Blob([JSON.stringify(submission, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rg-answer-round-" + activity.round + "-" + playerSelect.value + ".json";
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    foley.play("submit");
    status.textContent = "Answer file downloaded. Send it to the host.";
  }

  async function copySubmission() {
    const submission = makeSubmission();
    if (!submission) return;
    const text = JSON.stringify(submission, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      foley.play("confirm");
      status.textContent = "Answer JSON copied. Send it to the host.";
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = text;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.append(fallback);
      fallback.select();
      const copied = document.execCommand("copy");
      fallback.remove();
      status.textContent = copied ? "Answer JSON copied. Send it to the host." : "Copy was blocked. Use DOWNLOAD ANSWER .JSON instead.";
    }
  }

  taskFile.addEventListener("change", () => openTaskFile(taskFile.files?.[0]));
  playerSelect.addEventListener("change", () => {
    if (!activity) return;
    answer = loadAnswer(activity);
    if (activity.mode === "categorize-images") renderSort();
    else if (activity.mode === "compose-image") renderCompose();
    else renderDrawing();
    status.textContent = playerSelect.value ? "Ready - " + completionText() : "Choose your name.";
    updateActions();
  });
  saveButton.addEventListener("click", downloadSubmission);
  copyButton.addEventListener("click", copySubmission);
})();
