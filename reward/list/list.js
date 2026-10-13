import { encryptReward } from "../reward-crypto.mjs";

(() => {
  "use strict";

  const searchInput = document.getElementById("awardSearch");
  const clearButton = document.getElementById("clearSearch");
  const resultStatus = document.getElementById("resultStatus");
  const awardList = document.getElementById("awardList");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");

  function normalizeSearch(value) {
    return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
  }

  function filenameLabel(filename) {
    const extensionStart = filename.lastIndexOf(".");
    return extensionStart > 0 ? filename.slice(0, extensionStart) : filename;
  }

  function createText(tagName, className, value) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }

  function validateCatalog(catalog) {
    if (!catalog || catalog.version !== 3 || !Array.isArray(catalog.files) ||
        !catalog.assets || typeof catalog.assets !== "object" || Array.isArray(catalog.assets) ||
        catalog.tierAlgorithm !== "sha256-leading-32-bit-weighted-v2" ||
        !Array.isArray(catalog.tierWeights) ||
        catalog.tierWeights.some(entry => !entry || typeof entry.id !== "string" ||
          typeof entry.label !== "string" || !Number.isInteger(entry.basisPoints) || entry.basisPoints < 0) ||
        catalog.tierWeights.reduce((sum, entry) => sum + entry.basisPoints, 0) !== 10000) {
      throw new Error("The reward artwork catalog is invalid.");
    }
    return catalog;
  }

  function tierForHash(sha256, catalog) {
    const bucket = Math.floor((Number.parseInt(sha256.slice(0, 8), 16) / 0x100000000) * 10000);
    let upperBound = 0;
    for (const tier of catalog.tierWeights) {
      upperBound += tier.basisPoints;
      if (bucket < upperBound) return tier;
    }
    return null;
  }

  function validateAssignments(registry, catalog) {
    if (!registry || registry.version !== 1 || !Array.isArray(registry.assignments)) {
      throw new Error("The assignment registry is invalid.");
    }

    const seenAssets = new Set();
    return registry.assignments.map((record, index) => {
      if (!record || typeof record !== "object" || Array.isArray(record) ||
          typeof record.filename !== "string" || record.filename.length > 180 ||
          !/^[^/\\\u0000-\u001f]+\.png$/i.test(record.filename) ||
          typeof record.username !== "string" || !record.username.trim() ||
          record.username.length > 100 || /[\u0000-\u001f]/.test(record.username) ||
          typeof record.assetSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(record.assetSha256) ||
          typeof record.issuedAt !== "string" || record.issuedAt.length > 40 ||
          !Number.isFinite(Date.parse(record.issuedAt))) {
        throw new Error(`Assignment record ${index + 1} is invalid.`);
      }

      const assetSha256 = record.assetSha256.toLowerCase();
      if (seenAssets.has(assetSha256)) throw new Error("The assignment registry repeats artwork.");
      seenAssets.add(assetSha256);

      const tier = tierForHash(assetSha256, catalog);
      const tierId = tier?.id ?? "";
      const catalogHash = catalog.assets[record.filename]?.sha256?.toLowerCase();
      const artworkIsCurrent = catalog.files.includes(record.filename) && catalogHash === assetSha256 &&
        catalog.assets[record.filename]?.tier === tierId;

      return {
        filename: record.filename,
        username: record.username.trim(),
        assetSha256,
        issuedAt: record.issuedAt,
        tierId: tier ? tier.id : "",
        tierLabel: tier ? tier.label : "Award",
        artworkIsCurrent
      };
    });
  }

  async function loadRegistry() {
    const [registryResponse, catalogResponse] = await Promise.all([
      fetch("/zzz_assets/rewards/assignments.json", { cache: "no-cache" }),
      fetch("/zzz_assets/rewards/manifest.json", { cache: "no-cache" })
    ]);
    if (!registryResponse.ok || !catalogResponse.ok) {
      throw new Error("The public award data could not be fetched.");
    }
    const [registry, rawCatalog] = await Promise.all([
      registryResponse.json(),
      catalogResponse.json()
    ]);
    const catalog = validateCatalog(rawCatalog);
    const assignments = validateAssignments(registry, catalog);
    assignments.sort((left, right) => Date.parse(right.issuedAt) - Date.parse(left.issuedAt) ||
      left.filename.localeCompare(right.filename));
    return assignments;
  }

  function makeCard(assignment) {
    const card = document.createElement("article");
    card.className = "award-card";

    const artworkFrame = document.createElement("div");
    artworkFrame.className = "artwork-frame";
    artworkFrame.setAttribute("aria-hidden", "true");

    const info = document.createElement("div");
    info.className = "award-info";
    info.append(createText("p", "field-label", "Awarded to"));
    info.append(createText("h2", "username", assignment.username));
    info.append(createText("p", "field-label", "Artwork"));
    info.append(createText("p", "artwork-name", filenameLabel(assignment.filename)));

    const meta = document.createElement("div");
    meta.className = "award-meta";
    const badge = createText("span", "tier-badge", assignment.tierLabel);
    badge.dataset.tier = assignment.tierId;
    meta.append(badge);
    const date = document.createElement("time");
    date.className = "issue-date";
    date.dateTime = assignment.issuedAt;
    date.textContent = new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric"
    }).format(new Date(assignment.issuedAt));
    meta.append(date);
    info.append(meta);

    if (assignment.artworkIsCurrent) {
      const image = document.createElement("img");
      image.src = `/zzz_assets/rewards/${encodeURIComponent(assignment.filename)}`;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        image.remove();
        artworkFrame.append(createText("span", "artwork-fallback", "Artwork unavailable"));
      }, { once: true });
      artworkFrame.append(image);
    } else {
      artworkFrame.append(createText("span", "artwork-fallback", "Artwork no longer in catalog"));
    }

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "open-button";
    openButton.textContent = "Open award ↗";
    openButton.setAttribute("aria-label", `Open ${assignment.username}'s award`);
    openButton.disabled = !assignment.artworkIsCurrent;
    if (!assignment.artworkIsCurrent) openButton.title = "The assigned artwork is no longer in the current catalog.";
    openButton.addEventListener("click", async () => {
      if (openButton.disabled) return;
      openButton.disabled = true;
      openButton.textContent = "Opening…";
      try {
        const encrypted = await encryptReward({
          version: 1,
          username: assignment.username,
          file: assignment.filename
        });
        const destination = new URL("/reward/", window.location.origin);
        destination.searchParams.set("id", encrypted.id);
        destination.hash = `key=${encrypted.key}`;
        window.location.assign(destination.href);
      } catch (error) {
        console.error("[reward-list] Could not create a display link:", error);
        openButton.disabled = false;
        openButton.textContent = "Try opening again";
        resultStatus.textContent = "Could not open that award here. Check browser security settings and try again.";
      }
    });

    card.append(artworkFrame, info, openButton);
    const searchText = normalizeSearch(`${assignment.username} ${assignment.filename} ${filenameLabel(assignment.filename)}`);
    return { card, searchText };
  }

  function updateResults(cards) {
    const query = normalizeSearch(searchInput.value);
    let visibleCount = 0;
    for (const item of cards) {
      const visible = !query || item.searchText.includes(query);
      item.card.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    emptyState.hidden = visibleCount !== 0;
    clearButton.hidden = !searchInput.value;
    if (query && visibleCount === 0) {
      resultStatus.textContent = `No awards match “${searchInput.value.trim()}”.`;
    } else {
      resultStatus.textContent = `${visibleCount} ${visibleCount === 1 ? "award" : "awards"} found.`;
    }
  }

  async function start() {
    try {
      const assignments = await loadRegistry();
      const cards = assignments.map(makeCard);
      awardList.replaceChildren(...cards.map(item => item.card));
      awardList.setAttribute("aria-busy", "false");
      if (assignments.length === 0) {
        emptyState.hidden = false;
        emptyState.textContent = "No awards have been recorded yet.";
      }
      updateResults(cards);
      searchInput.addEventListener("input", () => updateResults(cards));
      clearButton.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.focus();
        updateResults(cards);
      });
    } catch (error) {
      console.error("[reward-list] Could not load award data:", error);
      awardList.setAttribute("aria-busy", "false");
      resultStatus.textContent = "The award index is unavailable.";
      errorState.hidden = false;
    }
  }

  start();
})();
