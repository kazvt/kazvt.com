const API = "/__reward_editor/api";
const EDITOR_TOKEN = document.querySelector('meta[name="reward-editor-token"]')?.content || "";
const $ = selector => document.querySelector(selector);
const content = $("#sectionContent");
const flash = $("#flashMessage");
const previewFrame = $("#sitePreview");
const previewLink = $("#openPreview");

let state = null;
let activeSection = "artwork";
let selectedArtwork = "";
let selectedAssignment = "";
let assignmentMode = "active";
let selectedMedia = "";
let selectedSource = "";
let sourceDraft = null;
let previewMode = "gallery";
let flashTimeout = 0;

const headings = {
  artwork: ["THE REWARD POOL", "Artwork", "Names, files, hashes, sizes, tiers, and the pool itself."],
  assignments: ["PEOPLE AND THEIR REWARDS", "Streamers", "Edit who got each reward and the reason shown on its page."],
  reservations: ["LOCAL AND PRIVATE", "Reservations", "Keep a reward aside for a username without showing it publicly."],
  media: ["THE PAGE'S IMAGE FILES", "Page assets", "Patterns, decals, and fonts used by the actual reward pages."],
  source: ["ONE SET OF COMPONENTS", "Components & files", "Edit the same source files the public reward pages use."]
};

function make(tag, className = "", text = undefined) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

function setFlash(message, isError = false) {
  window.clearTimeout(flashTimeout);
  flash.textContent = message;
  flash.hidden = !message;
  flash.classList.toggle("is-error", isError);
  if (message && !isError) flashTimeout = window.setTimeout(() => { flash.hidden = true; }, 6500);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("X-Reward-Editor-Token", EDITOR_TOKEN);
  let body = options.body;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json; charset=utf-8");
    body = JSON.stringify(options.json);
  }
  const response = await fetch(`${API}${path}`, {
    method: options.method || "GET",
    headers,
    body,
    cache: "no-store",
    credentials: "same-origin"
  });
  let data;
  try { data = await response.json(); }
  catch { data = { error: `Local editor returned HTTP ${response.status}.` }; }
  if (!response.ok) throw new Error(data.error || `Local editor returned HTTP ${response.status}.`);
  return data;
}

async function refreshState({ preserve = true, message = "" } = {}) {
  const previousArt = selectedArtwork;
  const previousAssignment = selectedAssignment;
  const previousMedia = selectedMedia;
  state = await api("/state");
  $("#artworkCount").textContent = state.artwork.length;
  $("#assignmentCount").textContent = state.assignments.length;
  $("#poolRemaining").textContent = state.pool.remaining;
  $("#connectionStatus").textContent = "Connected to the local site files";
  $("#checkoutPath").textContent = "127.0.0.1 only";
  if (preserve) {
    selectedArtwork = state.artwork.some(item => item.filename === previousArt) ? previousArt : (state.artwork[0]?.filename || "");
    selectedAssignment = state.assignments.some(item => item.linkId === previousAssignment)
      ? previousAssignment
      : (state.assignments[0]?.linkId || "");
    selectedMedia = state.mediaAssets.some(item => item.path === previousMedia) ? previousMedia : (state.mediaAssets[0]?.path || "");
  } else {
    selectedArtwork = state.artwork[0]?.filename || "";
    selectedAssignment = state.assignments[0]?.linkId || "";
    selectedMedia = state.mediaAssets[0]?.path || "";
  }
  renderSection();
  if (message) setFlash(message);
  refreshPreview();
}

function selectedArtRecord() {
  return state?.artwork.find(item => item.filename === selectedArtwork) || null;
}

function selectedAssignmentRecord() {
  return state?.assignments.find(item => item.linkId === selectedAssignment) || null;
}

function updateHeading() {
  const [eyebrow, title, subtitle] = headings[activeSection];
  $("#sectionEyebrow").textContent = eyebrow;
  $("#sectionTitle").textContent = title;
  $("#sectionSubtitle").textContent = subtitle;
  document.querySelectorAll(".nav-button[data-section]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.section === activeSection);
  });
}

function renderSection() {
  if (!state) return;
  updateHeading();
  content.replaceChildren();
  if (activeSection === "artwork") renderArtwork();
  else if (activeSection === "assignments") renderAssignments();
  else if (activeSection === "reservations") renderReservations();
  else if (activeSection === "media") renderMedia();
  else renderSourceFiles();
}

function makeButton(label, className, onClick, type = "button") {
  const button = make("button", className, label);
  button.type = type;
  button.addEventListener("click", onClick);
  return button;
}

function makeField(labelText, control, hint = "", className = "field") {
  const wrapper = make("div", className);
  const label = make("label", "", labelText);
  if (control.id) label.htmlFor = control.id;
  wrapper.append(label, control);
  if (hint) wrapper.append(make("small", "", hint));
  return wrapper;
}

function textInput(id, value, options = {}) {
  const input = make("input", `input${options.className ? ` ${options.className}` : ""}`);
  input.id = id;
  input.type = options.type || "text";
  input.value = value ?? "";
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.maxLength) input.maxLength = options.maxLength;
  if (options.readOnly) input.readOnly = true;
  return input;
}

function textArea(id, value, options = {}) {
  const area = make("textarea", `textarea${options.className ? ` ${options.className}` : ""}`);
  area.id = id;
  area.value = value ?? "";
  if (options.maxLength) area.maxLength = options.maxLength;
  if (options.placeholder) area.placeholder = options.placeholder;
  if (options.readOnly) area.readOnly = true;
  return area;
}

function setPreviewMode(mode) {
  previewMode = mode;
  document.querySelectorAll(".preview-tab").forEach(button => button.classList.toggle("is-active", button.dataset.preview === mode));
  const url = mode === "detail" ? "/reward/?editorPreview=1" : "/reward/list/";
  updatePreviewLink();
  const nextSrc = `${url}${url.includes("?") ? "&" : "?"}localWorkshop=${Date.now()}`;
  if (!previewFrame.src || new URL(previewFrame.src).pathname !== new URL(nextSrc, location.href).pathname || mode === "gallery") {
    previewFrame.src = nextSrc;
  } else {
    sendDetailPreview();
  }
}

function previewPayload() {
  let assignment = activeSection === "assignments"
    ? selectedAssignmentRecord() || state.editorArchivedAssignments.find(item => item.linkId === selectedAssignment) ||
      state.revokedAssignments.find(item => item.linkId === selectedAssignment)
    : null;
  if (!assignment && selectedArtwork) {
    assignment = state.assignments.find(item => item.filename === selectedArtwork) || null;
  }
  const file = assignment?.filename || selectedArtRecord()?.filename || state.artwork[0]?.filename || "";
  return {
    type: "kazvt-reward-editor-preview",
    filename: file,
    username: assignment?.username || "PREVIEW USERNAME",
    reason: assignment?.reason || ""
  };
}

function updatePreviewLink() {
  if (previewMode === "gallery") {
    previewLink.href = "/reward/list/";
    previewLink.textContent = "Open this gallery page ↗";
    return;
  }
  const payload = previewPayload();
  const assignment = activeSection === "assignments"
    ? selectedAssignmentRecord() || state.editorArchivedAssignments.find(item => item.linkId === selectedAssignment) ||
      state.revokedAssignments.find(item => item.linkId === selectedAssignment)
    : state.assignments.find(item => item.filename === payload.filename);
  if (assignment?.linkId && assignmentMode === "active") {
    previewLink.href = `/reward/?id=${encodeURIComponent(assignment.linkId)}`;
  } else {
    const query = new URLSearchParams({
      editorPreview: "1",
      previewFile: payload.filename,
      previewUser: payload.username,
      previewReason: payload.reason,
    });
    previewLink.href = `/reward/?${query}`;
  }
  previewLink.textContent = "Open this reward page ↗";
}

function sendDetailPreview() {
  if (previewMode !== "detail" || !previewFrame.contentWindow) return;
  previewFrame.contentWindow.postMessage(previewPayload(), location.origin);
}

function refreshPreview() {
  updatePreviewLink();
  if (previewMode === "detail") sendDetailPreview();
  else {
    try { previewFrame.contentWindow?.location.reload(); }
    catch { previewFrame.src = `/reward/list/?localWorkshop=${Date.now()}`; }
  }
}

window.addEventListener("message", event => {
  if (event.origin !== location.origin || event.source !== previewFrame.contentWindow) return;
  if (event.data?.type === "kazvt-reward-editor-preview-ready") sendDetailPreview();
});

document.querySelectorAll(".nav-button[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    activeSection = button.dataset.section;
    renderSection();
    updatePreviewLink();
    if (previewMode === "detail") sendDetailPreview();
  });
});

document.querySelectorAll(".preview-tab").forEach(button => button.addEventListener("click", () => setPreviewMode(button.dataset.preview)));
$("#refreshPreview").addEventListener("click", refreshPreview);

function renderArtwork() {
  const wrap = make("div", "art-layout");
  const browser = make("section", "panel-card");
  const toolbar = make("div", "toolbar");
  const search = textInput("artworkSearch", "", { placeholder: "Find artwork..." });
  search.style.maxWidth = "260px";
  const rebuild = makeButton("Rebuild catalog", "button-secondary", async () => {
    try {
      const result = await api("/rebuild-catalog", { method: "POST", json: { expectedCatalog: state.digests.catalog } });
      await refreshState({ message: result.message });
    } catch (error) { setFlash(error.message, true); }
  });
  toolbar.append(search, rebuild);
  const grid = make("div", "art-grid");
  const drawGrid = () => {
    grid.replaceChildren();
    const query = search.value.trim().toLocaleLowerCase();
    const matches = state.artwork.filter(item => item.filename.toLocaleLowerCase().includes(query));
    if (!matches.length) grid.append(make("div", "empty-state", "No reward artwork matches that search."));
    for (const item of matches) {
      const tile = make("button", `art-tile${item.filename === selectedArtwork ? " is-selected" : ""}`);
      tile.type = "button";
      const thumb = make("span", "art-thumb");
      const image = make("img");
      image.src = item.url;
      image.alt = "";
      image.loading = "lazy";
      thumb.append(image);
      const name = make("strong", "art-title", item.filename.replace(/\.(?:png|gif)$/i, ""));
      const dimensions = make("small", "art-sub", `${item.width} x ${item.height} - ${item.tier}`);
      const tags = make("span", "tag-row");
      if (item.assigned) tags.append(make("span", "tag tag--assigned", "assigned"));
      if (item.reserved) tags.append(make("span", "tag tag--reserved", "private reserve"));
      tile.append(thumb, name, dimensions, tags);
      tile.addEventListener("click", () => {
        selectedArtwork = item.filename;
        renderArtwork();
        updatePreviewLink();
        sendDetailPreview();
      });
      grid.append(tile);
    }
  };
  search.addEventListener("input", drawGrid);
  const cardTitle = make("div", "card-title-row");
  const titleGroup = make("div");
  titleGroup.append(make("h2", "", "In the pool"), make("p", "", `${state.artwork.length} files in the current catalog. GIFs stay animated and their bytes are left untouched.`));
  cardTitle.append(titleGroup, make("span", "pill", `${state.pool.total} counted`));
  browser.append(cardTitle, toolbar, grid);
  wrap.append(browser, renderArtworkInspector());
  content.append(wrap, renderTierSettings());
  drawGrid();
}

function renderArtworkInspector() {
  const card = make("section", "form-card art-inspector");
  const item = selectedArtRecord();
  if (!item) {
    card.append(make("div", "empty-state", "Choose a reward, or add a new GIF or PNG."), renderAddArtworkForm());
    return card;
  }
  const title = make("div", "card-title-row");
  const titleGroup = make("div");
  titleGroup.append(make("h2", "", "Artwork details"), make("p", "", "The filename is also the reward name shown on the site."));
  title.append(titleGroup, make("span", "pill", item.assigned ? `owned by ${item.assignedTo}` : item.reserved ? "private reserve" : "unassigned"));
  const imageWrap = make("div", "art-large");
  const image = make("img");
  image.src = item.url;
  image.alt = item.filename;
  imageWrap.append(image);
  const stats = make("div", "metadata-grid");
  for (const [label, value, extraClass] of [
    ["Dimensions", `${item.width} x ${item.height}`, ""],
    ["Tier", item.tier, ""],
    ["File type", item.filename.split(".").pop().toUpperCase(), ""],
    ["SHA-256", item.assetId, "hash-value"]
  ]) {
    const cell = make("div", "metadata-cell");
    cell.append(make("small", "", label), make("strong", extraClass, value));
    stats.append(cell);
  }

  const name = textInput("artworkName", item.filename, { maxLength: 255 });
  const rename = makeButton("Rename file and reward", "button-secondary", async () => {
    const newFilename = name.value.trim();
    if (newFilename === item.filename) return setFlash("The filename has not changed.");
    if (!window.confirm(`Rename “${item.filename}” to “${newFilename}”? Existing reward links and private reservations will be kept in sync.`)) return;
    try {
      const result = await api("/rename-artwork", { method: "POST", json: {
        filename: item.filename,
        newFilename,
        expectedCatalog: state.digests.catalog,
        expectedFile: item.digest
      } });
      selectedArtwork = result.filename;
      await refreshState({ message: result.message });
    } catch (error) { setFlash(error.message, true); }
  });
  const filePick = make("input", "input");
  filePick.type = "file";
  filePick.accept = ".png,.gif,image/png,image/gif";
  filePick.id = "replacementImage";
  const uploadHelp = make("small", "help-text", "Choose a PNG or GIF. This updates the file hash, dimensions, tier, pool, and any active assignment using it.");
  const replaceButton = makeButton("Replace artwork file", "button", async () => {
    const file = filePick.files?.[0];
    if (!file) return setFlash("Choose a PNG or GIF file first.", true);
    const filename = name.value.trim();
    if (!window.confirm(`Replace the artwork behind “${item.filename}”${item.assigned ? ` (currently assigned to ${item.assignedTo})` : ""}? The public reward will use the new file and its new hash-derived tier.`)) return;
    try {
      const query = new URLSearchParams({ filename, replace: item.filename });
      const result = await api(`/artwork?${query}`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-Expected-Catalog": state.digests.catalog,
          "X-Expected-File": item.digest
        }
      });
      selectedArtwork = result.filename;
      await refreshState({ message: result.message });
    } catch (error) { setFlash(error.message, true); }
  });
  const deleteButton = makeButton("Delete this artwork", "button-danger", async () => {
    if (!window.confirm(`Permanently remove “${item.filename}” from this checkout? A recoverable copy will be kept inside .git/reward-editor-backups.`)) return;
    try {
      const result = await api("/artwork-action", { method: "POST", json: {
        action: "delete", filename: item.filename, expectedCatalog: state.digests.catalog
      } });
      selectedArtwork = "";
      await refreshState({ message: result.message });
    } catch (error) { setFlash(error.message, true); }
  });
  deleteButton.disabled = item.assigned || item.reserved;
  if (deleteButton.disabled) deleteButton.title = "Edit the assignment or private reservation before deleting this artwork.";

  card.append(title, imageWrap, stats,
    makeField("Reward filename", name, "Keep .gif or .png. The part before the extension is displayed as the reward name."),
    make("div", "button-row"),
    makeField("Replace with", filePick, "Replacing an assigned image updates that reward link; it does not create another award."),
    uploadHelp,
    make("div", "button-row"));
  const rows = card.querySelectorAll(".button-row");
  rows[0].append(rename);
  rows[1].append(replaceButton, deleteButton);
  card.append(renderAddArtworkForm());
  return card;
}

function renderAddArtworkForm() {
  const section = make("section", "panel-card stack");
  const heading = make("div", "card-title-row");
  const group = make("div");
  group.append(make("h2", "", "Add reward artwork"), make("p", "", "Drop in a PNG or GIF and the catalog fields are calculated for you."));
  heading.append(group);
  const file = make("input", "input");
  file.type = "file";
  file.accept = ".png,.gif,image/png,image/gif";
  file.id = "newArtworkFile";
  const name = textInput("newArtworkName", "", { placeholder: "Reward name.gif" });
  file.addEventListener("change", () => {
    if (file.files?.[0] && !name.value) name.value = file.files[0].name;
  });
  const add = makeButton("Add it to the reward pool", "button", async () => {
    const selected = file.files?.[0];
    if (!selected) return setFlash("Choose a PNG or GIF file first.", true);
    if (!name.value.trim()) return setFlash("Give the new reward a filename.", true);
    try {
      const query = new URLSearchParams({ filename: name.value.trim() });
      const result = await api(`/artwork?${query}`, {
        method: "POST",
        body: selected,
        headers: { "Content-Type": selected.type || "application/octet-stream", "X-Expected-Catalog": state.digests.catalog }
      });
      selectedArtwork = result.filename;
      await refreshState({ message: result.message });
    } catch (error) { setFlash(error.message, true); }
  });
  section.append(heading,
    makeField("File", file, "Animated GIFs are copied byte-for-byte."),
    makeField("Name and extension", name),
    add);
  return section;
}

function renderTierSettings() {
  const details = make("details", "panel-card");
  const summary = make("summary", "", "Tier labels and odds");
  const help = make("p", "help-text", "Odds are measured in basis points and must total 10,000. Saving recalculates each image tier from its SHA-256 hash.");
  const rows = make("div", "weight-list");
  const inputs = [];
  state.catalog.tierWeights.forEach(tier => {
    const row = make("div", "weight-row");
    const label = textInput(`tier-label-${tier.id}`, tier.label, { maxLength: 60 });
    const weight = textInput(`tier-weight-${tier.id}`, String(tier.basisPoints), { type: "number" });
    weight.min = "0";
    weight.max = "10000";
    weight.step = "1";
    inputs.push({ id: tier.id, label, weight });
    row.append(makeField(`${tier.id} label`, label), makeField("Basis points", weight));
    rows.append(row);
  });
  const sum = make("p", "sum-readout", "Total: 10,000");
  const updateSum = () => {
    const total = inputs.reduce((acc, item) => acc + (Number.parseInt(item.weight.value, 10) || 0), 0);
    sum.textContent = `Total: ${total.toLocaleString()} / 10,000`;
    sum.style.color = total === 10000 ? "var(--cyan)" : "var(--gold)";
  };
  inputs.forEach(item => item.weight.addEventListener("input", updateSum));
  const save = makeButton("Save tier settings", "button-secondary", async () => {
    const tierWeights = inputs.map(item => ({
      id: item.id,
      label: item.label.value,
      basisPoints: Number.parseInt(item.weight.value, 10)
    }));
    try {
      const result = await api("/tier-weights", { method: "POST", json: { tierWeights, expectedCatalog: state.digests.catalog } });
      await refreshState({ message: result.message });
    } catch (error) { setFlash(error.message, true); }
  });
  details.append(summary, help, rows, sum, save);
  return details;
}

function renderAssignments() {
  const layout = make("div", "two-column");
  const listCard = make("section", "panel-card");
  const top = make("div", "card-title-row");
  const group = make("div");
  group.append(make("h2", "", assignmentMode === "active" ? "Active rewards" : assignmentMode === "editor" ? "Removed here" : "Revoked rewards"),
    make("p", "", "Every active reward has its own username and optional public FOR note."));
  top.append(group, makeButton("+ New award", "button", () => {
    assignmentMode = "active";
    selectedAssignment = "";
    renderAssignments();
    updatePreviewLink();
    sendDetailPreview();
  }));
  const modes = make("div", "preview-tabs");
  for (const [mode, label] of [["active", "Active"], ["editor", "Removed here"], ["revoked", "Revoked"]]) {
    const button = makeButton(label, `preview-tab${assignmentMode === mode ? " is-active" : ""}`, () => {
      assignmentMode = mode;
      selectedAssignment = "";
      renderAssignments();
      updatePreviewLink();
      sendDetailPreview();
    });
    modes.append(button);
  }
  const query = textInput("assignmentSearch", "", { placeholder: "Find a streamer, reward, or reason..." });
  const rows = make("div", "table-list");
  const sourceRecords = assignmentMode === "active" ? state.assignments
    : assignmentMode === "editor" ? state.editorArchivedAssignments
      : state.revokedAssignments;
  const drawRows = () => {
    rows.replaceChildren();
    const q = query.value.trim().toLocaleLowerCase();
    const sorted = [...sourceRecords].sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
    const matching = sorted.filter(item => `${item.username} ${item.filename} ${item.reason || ""} ${item.platform || ""}`.toLocaleLowerCase().includes(q));
    if (!matching.length) rows.append(make("div", "empty-state", assignmentMode === "active" ? "No active rewards match." : "Nothing to show here yet."));
    for (const item of matching) {
      const row = make("button", `list-row${item.linkId === selectedAssignment ? " is-selected" : ""}`);
      row.type = "button";
      row.append(make("strong", "list-main", item.username || "(no username)"),
        make("span", "list-secondary", item.filename || "(missing artwork)"),
        make("span", "list-meta", item.reason || item.platform || "no note"));
      row.addEventListener("click", () => {
        selectedAssignment = item.linkId || "";
        renderAssignments();
        updatePreviewLink();
        sendDetailPreview();
      });
      rows.append(row);
    }
  };
  query.addEventListener("input", drawRows);
  listCard.append(top, modes, query, rows);
  const inspector = renderAssignmentInspector();
  layout.append(listCard, inspector);
  content.append(layout);
  drawRows();
}

function makeArtworkSelect(selectedId, includeAssigned = true) {
  const select = make("select", "select");
  select.id = "assignmentArtwork";
  for (const item of state.artwork) {
    if (!includeAssigned && item.assigned) continue;
    const option = make("option", "", `${item.filename} - ${item.tier}${item.assigned ? ` - assigned to ${item.assignedTo}` : item.reserved ? " - reserved" : ""}`);
    option.value = item.assetId;
    option.selected = item.assetId === selectedId;
    select.append(option);
  }
  return select;
}

function renderAssignmentInspector() {
  const card = make("section", "form-card");
  const archivedRecord = assignmentMode === "editor"
    ? state.editorArchivedAssignments.find(item => item.linkId === selectedAssignment)
    : assignmentMode === "revoked" ? state.revokedAssignments.find(item => item.linkId === selectedAssignment) : null;
  const activeRecord = assignmentMode === "active" ? selectedAssignmentRecord() : null;
  const item = activeRecord || archivedRecord;
  const creating = assignmentMode === "active" && !item;
  if (assignmentMode === "revoked") {
    const title = make("div", "card-title-row");
    title.append(make("div", "", ""));
    card.append(make("h2", "", item ? item.username : "Chat-revoked awards"), make("p", "help-text", "Chat revocations are kept as an audit trail. They are read-only here; use a new assignment if you want to award again."));
    if (item) renderAssignmentSummary(card, item, "This assignment was revoked by a chat command.");
    else card.append(make("div", "empty-state", "Select a revoked record to inspect it."));
    return card;
  }
  if (assignmentMode === "editor" && !item) {
    card.append(make("h2", "", "Locally removed rewards"), make("p", "help-text", "These links are inactive, but their original event IDs remain archived so a retried chat command cannot issue them again."), make("div", "empty-state", "Select a removed reward to restore it."));
    return card;
  }
  if (assignmentMode === "editor" && item) {
    card.append(make("div", "warning", "This reward is not in the public gallery. Restoring it reactivates its original reward URL."));
  }
  const title = make("div", "card-title-row");
  const titleText = make("div");
  titleText.append(make("h2", "", creating ? "Give a reward" : "Edit assignment"), make("p", "", "One reward, one streamer, one optional reason."));
  title.append(titleText, make("span", `pill ${creating ? "pill--public" : ""}`, "shown on site"));
  const username = textInput("assignmentUsername", item?.username || "", { placeholder: "Username", maxLength: 100 });
  const platform = make("select", "select");
  platform.id = "assignmentPlatform";
  for (const value of ["", "twitch", "kick", "youtube", "stream-game"]) {
    const option = make("option", "", value || "not specified");
    option.value = value;
    option.selected = (item?.platform || "") === value;
    platform.append(option);
  }
  if (item?.platform && !["twitch", "kick", "youtube", "stream-game"].includes(item.platform)) {
    const option = make("option", "", item.platform);
    option.value = item.platform;
    option.selected = true;
    platform.append(option);
  }
  const userId = textInput("assignmentUserId", item?.userId || "", { maxLength: 128 });
  const reason = textArea("assignmentReason", item?.reason || "", { maxLength: 180, placeholder: "won tic tac toe" });
  const assetSelect = makeArtworkSelect(item?.assetId || "", true);
  const linkId = textInput("assignmentLinkId", item?.linkId || "", { maxLength: 36 });
  const issuedAt = textInput("assignmentIssuedAt", item?.issuedAt || "", { placeholder: "2026-10-22T12:00:00.000Z" });
  const fields = make("div", "form-grid");
  fields.append(
    makeField("Streamer username", username),
    makeField("Platform", platform),
    makeField("Platform user ID", userId, "Optional for manual names. This ID is public in the assignment registry."),
    makeField("Reward artwork", assetSelect, "Reserved art can only be assigned to one of its matching aliases."),
    makeField("FOR note", reason, "Public on the individual reward page and in the gallery. Up to 180 characters.", "field field--wide"),
    makeField("Reward URL ID", linkId, "Changing this breaks the old URL. Leave it alone unless that is intended."),
    makeField("Issued at", issuedAt, "ISO date and time. This is public.")
  );
  const publicWarning = make("p", "warning", "Username, platform ID, reward name, date, and FOR note are published in assignments.json. Do not put private details in the note.");
  const actions = make("div", "form-actions");
  const save = makeButton(creating ? "Create assignment locally" : "Save assignment locally", "button", async () => {
    const payload = {
      action: creating ? "create" : "update",
      expectedAssignments: state.digests.assignments,
      linkId: item?.linkId,
      assignment: {
        username: username.value,
        platform: platform.value,
        userId: userId.value,
        assetId: assetSelect.value,
        reason: reason.value,
        linkId: linkId.value,
        issuedAt: issuedAt.value
      }
    };
    try {
      const result = await api("/assignments", { method: "POST", json: payload });
      const url = result.href ? ` - ${new URL(result.href, location.origin).href}` : "";
      await refreshState({ message: `${result.message}${url}` });
      if (creating) assignmentMode = "active";
    } catch (error) { setFlash(error.message, true); }
  });
  actions.append(save);
  if (item && assignmentMode === "active") {
    actions.append(makeButton("Remove from public gallery", "button-danger", async () => {
      if (!window.confirm(`Remove ${item.username}'s “${item.filename}” reward from the public gallery? Its link will stop working. The record and issuance hash will be kept in the local-editor archive.`)) return;
      try {
        const result = await api("/assignments", { method: "POST", json: {
          action: "archive", linkId: item.linkId, expectedAssignments: state.digests.assignments
        } });
        assignmentMode = "editor";
        selectedAssignment = item.linkId;
        await refreshState({ message: result.message });
      } catch (error) { setFlash(error.message, true); }
    }));
  }
  if (item && assignmentMode === "editor") {
    actions.append(makeButton("Restore this reward", "button-secondary", async () => {
      if (!window.confirm(`Restore ${item.username}'s reward to the public gallery?`)) return;
      try {
        const result = await api("/assignments", { method: "POST", json: {
          action: "restore", linkId: item.linkId, expectedAssignments: state.digests.assignments
        } });
        assignmentMode = "active";
        selectedAssignment = item.linkId;
        await refreshState({ message: result.message });
      } catch (error) { setFlash(error.message, true); }
    }));
  }
  card.append(title, publicWarning, fields, actions);
  if (item && item.linkId) {
    const href = make("a", "preview-open", `Open reward URL: ${item.linkId} ↗`);
    href.href = `/reward/?id=${encodeURIComponent(item.linkId)}`;
    href.target = "_blank";
    href.rel = "noreferrer";
    card.append(href);
  }
  return card;
}

function renderAssignmentSummary(container, item, note) {
  const image = make("img");
  const art = state.artwork.find(entry => entry.filename === item.filename);
  image.src = art?.url || `/zzz_assets/rewards/${encodeURIComponent(item.filename || "")}`;
  image.alt = "";
  image.style.cssText = "display:block;max-width:100%;max-height:240px;margin:14px auto;object-fit:contain";
  container.append(make("p", "warning", note), image);
  for (const [label, value] of [["Reward", item.filename], ["Username", item.username], ["Reason", item.reason || "none"], ["Issued", item.issuedAt], ["Link ID", item.linkId]]) {
    const line = make("p", "help-text", `${label}: ${value || "-"}`);
    container.append(line);
  }
}

function renderReservations() {
  const stack = make("div", "stack");
  const warning = make("div", "warning warning--private");
  warning.append(make("strong", "", "Private file - not published."), document.createTextNode(" These aliases and reserved filenames stay in reward/api/reservations.local.txt on this computer. They are deliberately absent from the public gallery and pool count."));
  const card = make("section", "form-card stack");
  const title = make("div", "card-title-row");
  const titleGroup = make("div");
  titleGroup.append(make("h2", "", "Who gets first dibs?"), make("p", "", "Add one rule per line. Aliases ignore capitalization."));
  title.append(titleGroup, make("span", "pill pill--private", "local only"));
  const rules = textArea("reservationRules", state.reservationText, { className: "", placeholder: "alias, alias-0000 -> Reward name.gif" });
  rules.style.minHeight = "260px";
  rules.style.fontFamily = 'Consolas, "Courier New", monospace';
  rules.spellcheck = false;
  const examples = make("div", "help-text");
  examples.textContent = "Examples: lillie_garden, lillie-garden -> ♿♿♿♿♿.png   |   viewer, viewer-0000 => \"E:/sites/kazvt.com-1/zzz_assets/rewards/Reward.gif\"   |   handle = Reward.gif. Commas, semicolons, or | separate aliases. ->, =>, =, : and → all work.";
  const buttons = make("div", "button-row");
  const save = makeButton("Validate and save privately", "button", async () => {
    try {
      const result = await api("/reservations", { method: "POST", json: {
        text: rules.value,
        expectedReservations: state.digests.reservations
      } });
      await refreshState({ message: `${result.message} ${result.count} rules saved.` });
    } catch (error) { setFlash(error.message, true); }
  });
  const clear = makeButton("Clear text", "button-secondary", () => {
    if (window.confirm("Clear the editor text? This does not save until you choose Validate and save privately.")) rules.value = "";
  });
  buttons.append(save, clear);
  card.append(title, makeField("Reservation rules", rules), examples, buttons);
  const reminder = make("p", "help-text", "A reservation only gives the matching name priority when you issue !reward. It does not assign anything on its own. Keep a private backup of these rules; Git will not carry this local file to another computer.");
  stack.append(warning, card, reminder);
  content.append(stack);
}

function renderMedia() {
  const layout = make("div", "media-browser");
  const listCard = make("section", "panel-card");
  const listHeader = make("div", "card-title-row");
  listHeader.append(make("div", "", ""), make("span", "pill", `${state.mediaAssets.length} files`));
  const search = textInput("mediaSearch", "", { placeholder: "Find a decal, pattern, or font..." });
  const list = make("div", "media-list");
  const draw = () => {
    list.replaceChildren();
    const q = search.value.trim().toLocaleLowerCase();
    const matches = state.mediaAssets.filter(item => item.path.toLocaleLowerCase().includes(q));
    if (!matches.length) list.append(make("div", "empty-state", "No page assets match."));
    for (const asset of matches) {
      const button = make("button", `media-item${asset.path === selectedMedia ? " is-selected" : ""}`, asset.path);
      button.type = "button";
      button.addEventListener("click", () => { selectedMedia = asset.path; renderMedia(); });
      list.append(button);
    }
  };
  search.addEventListener("input", draw);
  listCard.append(listHeader, search, list);
  const inspector = renderMediaInspector();
  layout.append(listCard, inspector);
  content.append(layout, make("p", "help-text", "These are the real files from the reward folders. Adding a new image does not automatically put it in rotation - update the relevant reward component in Components & files when needed."));
  draw();
}

function renderMediaInspector() {
  const card = make("section", "form-card stack");
  const asset = state.mediaAssets.find(item => item.path === selectedMedia);
  const title = make("div", "card-title-row");
  const group = make("div");
  group.append(make("h2", "", asset ? "Edit page asset" : "Add page asset"), make("p", "", "Patterns, edge decals, animation GIFs, and reward fonts."));
  title.append(group);
  const preview = make("div", "media-preview");
  if (asset?.kind === "image") {
    const image = make("img");
    image.src = asset.url;
    image.alt = asset.path;
    preview.append(image);
  } else if (asset) {
    const text = make("span", "", PathLeaf(asset.path));
    text.style.color = "var(--gold)";
    preview.append(text);
  } else {
    preview.append(make("span", "help-text", "Choose a file to preview it."));
  }
  const file = make("input", "input");
  file.type = "file";
  file.id = "mediaUpload";
  const folder = make("select", "select");
  folder.id = "mediaFolder";
  for (const value of ["reward/patterns", "reward/retro", "reward/retro/decal-pool", "reward/list/gifcities", "zzz_assets/fonts"]) {
    const option = make("option", "", value);
    option.value = value;
    folder.append(option);
  }
  const assetDetails = asset ? make("p", "help-text", `File: ${asset.path} - ${asset.kind}`) : make("p", "help-text", "Pick a destination folder for the new asset.");
  const actions = make("div", "button-row");
  actions.append(makeButton(asset ? "Replace file" : "Add file", "button", async () => {
    const chosen = file.files?.[0];
    if (!chosen) return setFlash("Choose a file first.", true);
    try {
      let result;
      if (asset) {
        const query = new URLSearchParams({ path: asset.path });
        result = await api(`/page-asset?${query}`, {
          method: "POST", body: chosen,
          headers: { "Content-Type": chosen.type || "application/octet-stream", "X-Expected-File": asset.digest }
        });
      } else {
        const query = new URLSearchParams({ directory: folder.value, filename: chosen.name });
        result = await api(`/add-page-asset?${query}`, {
          method: "POST", body: chosen,
          headers: { "Content-Type": chosen.type || "application/octet-stream", "X-Expected-File": "" }
        });
        selectedMedia = result.path;
      }
      await refreshState({ message: result.message });
    } catch (error) { setFlash(error.message, true); }
  }));
  if (asset) actions.append(makeButton("Delete file", "button-danger", async () => {
    if (!window.confirm(`Delete ${asset.path}? A recoverable copy will remain in the local Git metadata folder. Check its references first.`)) return;
    try {
      const result = await api("/delete-page-asset", { method: "POST", json: { path: asset.path, expectedFile: asset.digest } });
      selectedMedia = "";
      await refreshState({ message: result.message });
    } catch (error) { setFlash(error.message, true); }
  }));
  card.append(title, preview, assetDetails, makeField("Choose replacement or new media", file, "Supported: PNG, GIF, WebP, JPEG, SVG, WOFF, WOFF2, TTF, OTF."));
  if (!asset) card.append(makeField("Add to folder", folder));
  card.append(actions);
  return card;
}

function PathLeaf(path) { return path.split("/").pop() || path; }

function renderSourceFiles() {
  const layout = make("div", "source-layout");
  const listCard = make("section", "panel-card");
  const search = textInput("sourceSearch", "", { placeholder: "Filter source files..." });
  const list = make("div", "source-picker");
  const draw = () => {
    list.replaceChildren();
    const q = search.value.trim().toLocaleLowerCase();
    const matches = state.sourceFiles.filter(item => item.path.toLocaleLowerCase().includes(q));
    for (const source of matches) {
      const button = make("button", `source-item${source.path === selectedSource ? " is-selected" : ""}${source.generated ? " is-generated" : ""}`, `${source.path}${source.generated ? " - generated" : ""}`);
      button.type = "button";
      button.addEventListener("click", async () => {
        if (sourceDraft?.dirty && !window.confirm("Discard unsaved source edits?")) return;
        selectedSource = source.path;
        await loadSourceFile(source.path);
        renderSourceFiles();
      });
      list.append(button);
    }
  };
  search.addEventListener("input", draw);
  listCard.append(make("h2", "", "Reward source"), make("p", "help-text", "Text files that actually power the public reward pages."), search, list);
  const editor = make("section", "form-card source-editor");
  if (!sourceDraft) {
    editor.append(make("div", "empty-state", "Choose a file to edit. Generated files are marked read-only; edit the shared source template instead."));
  } else {
    const header = make("div", "source-title");
    const title = make("strong", "", sourceDraft.path);
    const status = make("span", "source-status", sourceDraft.readOnly ? "generated preview - read only" : sourceDraft.dirty ? "unsaved local edits" : "loaded from checkout");
    header.append(title, status);
    const editorNote = make("p", "help-text", sourceDraft.generated ? "This is generated by scripts/build-reward-pages.mjs. Edit _includes/reward/head-assets.html or body.html instead." : "Saving writes this exact file. The editor does not commit or push it.");
    const area = textArea("sourceText", sourceDraft.text, { className: "textarea--code", readOnly: sourceDraft.readOnly });
    area.spellcheck = false;
    area.addEventListener("input", () => {
      sourceDraft.dirty = area.value !== sourceDraft.originalText;
      status.textContent = sourceDraft.dirty ? "unsaved local edits" : "loaded from checkout";
    });
    area.addEventListener("keydown", event => {
      if (event.key === "Tab" && !sourceDraft.readOnly) {
        event.preventDefault();
        area.setRangeText("  ", area.selectionStart, area.selectionEnd, "end");
        area.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const actions = make("div", "source-actions");
    const save = makeButton("Save source file", "button", async () => {
      if (!sourceDraft || sourceDraft.readOnly) return;
      try {
        const result = await api("/source-file", { method: "POST", json: {
          path: sourceDraft.path,
          text: area.value,
          expectedDigest: sourceDraft.digest
        } });
        sourceDraft = { ...sourceDraft, text: area.value, originalText: area.value, dirty: false };
        await refreshState({ message: result.message + (result.rebuiltRewardPages ? " Generated pages were rebuilt." : "") });
        await loadSourceFile(sourceDraft.path);
        renderSourceFiles();
      } catch (error) { setFlash(error.message, true); }
    });
    save.disabled = sourceDraft.readOnly || !sourceDraft.dirty;
    actions.append(save);
    if (sourceDraft.generated) actions.append(makeButton("Rebuild generated pages", "button-secondary", async () => {
      try {
        const result = await api("/rebuild-pages", { method: "POST", json: {} });
        await refreshState({ message: result.message });
        await loadSourceFile(sourceDraft.path);
        renderSourceFiles();
      } catch (error) { setFlash(error.message, true); }
    }));
    editor.append(header, editorNote, area, actions);
  }
  layout.append(listCard, editor);
  content.append(layout);
  draw();
}

async function loadSourceFile(path) {
  try {
    sourceDraft = await api(`/file?path=${encodeURIComponent(path)}`);
    sourceDraft.originalText = sourceDraft.text;
    sourceDraft.dirty = false;
  } catch (error) {
    sourceDraft = null;
    setFlash(error.message, true);
  }
}

for (const [mode, label] of [["gallery", "Gallery"], ["detail", "Individual"]]) {
  if (mode === "gallery") previewLink.textContent = `Open this ${label.toLocaleLowerCase()} page ↗`;
}

refreshState({ preserve: false }).then(() => setPreviewMode("gallery")).catch(error => {
  $("#connectionStatus").textContent = "Could not connect to the local editor server";
  setFlash(error.message, true);
});
