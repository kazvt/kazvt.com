import { createRewardHref } from "../reward-link.mjs?v=github-static-2";
import { fetchAssignmentRegistry } from "../assignment-source.mjs";
import { normalizeAwardUsername, validateAndSortAssignments } from "../assignment-registry.mjs?v=github-static-2";
import "../pattern-zoom.mjs?v=2";

(() => {
  "use strict";

  const searchInput = document.getElementById("awardSearch");
  const clearButton = document.getElementById("clearSearch");
  const resultStatus = document.getElementById("resultStatus");
  const awardList = document.getElementById("awardList");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");
  const pageTitle = document.getElementById("pageTitle");
  const poolStatus = document.getElementById("poolStatus");
  const searchLabel = document.getElementById("search-label");
  const usernameParam = new URLSearchParams(window.location.search).get("user");
  const userFilterRequested = usernameParam !== null;
  const requestedUsername = usernameParam?.trim() ?? "";
  const userFilterValid = !userFilterRequested || (requestedUsername.length > 0 &&
    requestedUsername.length <= 100 && !/[\u0000-\u001f]/.test(requestedUsername));

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
    if (!catalog || catalog.version !== 4 || catalog.assetIdAlgorithm !== "sha256-png-bytes-v1" ||
        !Array.isArray(catalog.files) ||
        !catalog.assets || typeof catalog.assets !== "object" || Array.isArray(catalog.assets) ||
        !catalog.assetsById || typeof catalog.assetsById !== "object" || Array.isArray(catalog.assetsById) ||
        !catalog.filenameHistory || typeof catalog.filenameHistory !== "object" || Array.isArray(catalog.filenameHistory) ||
        catalog.tierAlgorithm !== "sha256-leading-32-bit-weighted-v2" ||
        !Array.isArray(catalog.tierWeights) ||
        catalog.tierWeights.some(entry => !entry || typeof entry.id !== "string" ||
          typeof entry.label !== "string" || !Number.isInteger(entry.basisPoints) || entry.basisPoints < 0) ||
        catalog.tierWeights.reduce((sum, entry) => sum + entry.basisPoints, 0) !== 10000) {
      throw new Error("The reward artwork catalog is invalid.");
    }
    for (const filename of catalog.files) {
      const asset = catalog.assets[filename];
      const indexed = asset && catalog.assetsById[asset.assetId];
      const expectedTier = asset && /^[a-f0-9]{64}$/.test(asset.assetId)
        ? tierForHash(asset.assetId, catalog)?.id
        : null;
      if (typeof filename !== "string" || filename.length > 255 || !/^[^/\\\u0000-\u001f]+\.png$/i.test(filename) ||
          !asset || !/^[a-f0-9]{64}$/.test(asset.assetId) || asset.assetId !== asset.sha256 ||
          !Number.isSafeInteger(asset.width) || asset.width < 1 ||
          !Number.isSafeInteger(asset.height) || asset.height < 1 ||
          asset.tier !== expectedTier || !indexed || indexed.filename !== filename ||
          indexed.width !== asset.width || indexed.height !== asset.height || indexed.tier !== asset.tier) {
        throw new Error("The reward artwork content index is invalid.");
      }
    }
    for (const [filename, assetId] of Object.entries(catalog.filenameHistory)) {
      if (!/^[^/\\\u0000-\u001f]+\.png$/i.test(filename) ||
          (assetId !== null && !/^[a-f0-9]{64}$/.test(assetId))) {
        throw new Error("The reward filename history is invalid.");
      }
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

  async function loadRegistry() {
    const [registry, catalogResponse] = await Promise.all([
      fetchAssignmentRegistry(),
      fetch("/zzz_assets/rewards/manifest.json", { cache: "no-cache" })
    ]);
    if (!catalogResponse.ok) {
      throw new Error("The public award data could not be fetched.");
    }
    const rawCatalog = await catalogResponse.json();
    const catalog = validateCatalog(rawCatalog);
    return {
      assignments: validateAndSortAssignments(registry, catalog),
      catalog
    };
  }

  function countUniqueRewardsLeft(catalog, assignments) {
    const availableAssetIds = new Set(catalog.files
      .map(filename => catalog.assets[filename]?.assetId)
      .filter(assetId => typeof assetId === "string" && /^[a-f0-9]{64}$/i.test(assetId)));
    for (const assignment of assignments) {
      if (assignment.artworkIsCurrent) availableAssetIds.delete(assignment.assetId);
    }
    return availableAssetIds.size;
  }

  async function makeCard(assignment) {
    const card = document.createElement("article");
    card.className = "award-card";

    const artworkFrame = document.createElement("div");
    artworkFrame.className = "artwork-frame";
    artworkFrame.setAttribute("aria-hidden", "true");

    const info = document.createElement("div");
    info.className = "award-info";
    info.append(createText("h2", "username", assignment.username));
    info.append(createText("p", "artwork-name", filenameLabel(assignment.filename)));

    const meta = document.createElement("div");
    meta.className = "award-meta";
    const badge = createText("span", "tier-badge", `TIER: ${assignment.tierLabel}`);
    badge.dataset.tier = assignment.tierId;
    meta.append(badge);
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

    let openLink;
    try {
      if (!assignment.artworkIsCurrent || !assignment.linkId) {
        throw new Error("The assigned award does not have an active direct link.");
      }
      openLink = document.createElement("a");
      openLink.href = createRewardHref(assignment.linkId, window.location.origin);
      openLink.textContent = "Open ↗";
      openLink.setAttribute("aria-label", `Open ${assignment.username}'s award`);
    } catch (error) {
      console.warn("[reward-list] Could not prepare an individual award link:", error);
      openLink = createText("span", "open-button is-unavailable", assignment.artworkIsCurrent
        ? "Award link unavailable"
        : "Award unavailable");
      openLink.setAttribute("aria-disabled", "true");
      openLink.setAttribute("role", "img");
      openLink.setAttribute("aria-label", `${assignment.username}'s award cannot be opened`);
      openLink.title = "This award has no UUID link or its artwork is no longer in the current catalog.";
    }
    openLink.classList.add("open-button");

    card.append(artworkFrame, info, openLink);
    const searchText = normalizeSearch(
      `${assignment.username} ${assignment.platform} ${assignment.userId} ${assignment.filename} ${filenameLabel(assignment.filename)}`
    );
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
      resultStatus.textContent = `No matches for “${searchInput.value.trim()}”.`;
    } else {
      resultStatus.textContent = `${visibleCount} ${visibleCount === 1 ? "result" : "results"}`;
    }
  }

  async function start() {
    if (userFilterRequested) {
      pageTitle.textContent = userFilterValid ? `Awards for ${requestedUsername}` : "Award lookup";
      document.title = userFilterValid ? `Awards for ${requestedUsername} — kazvt` : "Award lookup — kazvt";
      searchLabel.textContent = "Search this collection";
      searchInput.placeholder = "Search artwork…";
    }

    try {
      const { assignments: allAssignments, catalog } = await loadRegistry();
      const poolCount = countUniqueRewardsLeft(catalog, allAssignments);
      poolStatus.textContent = `Pool: ${poolCount} unique ${poolCount === 1 ? "reward" : "rewards"} left`;
      const assignments = userFilterRequested
        ? userFilterValid
          ? allAssignments.filter(record => normalizeAwardUsername(record.username) ===
            normalizeAwardUsername(requestedUsername))
          : []
        : allAssignments;
      const cards = await Promise.all(assignments.map(makeCard));
      awardList.replaceChildren(...cards.map(item => item.card));
      awardList.setAttribute("aria-busy", "false");
      if (assignments.length === 0) {
        emptyState.hidden = false;
        emptyState.textContent = userFilterRequested
          ? userFilterValid
            ? `No awards for ${requestedUsername}.`
            : "Invalid username."
          : "No awards yet.";
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
      poolStatus.textContent = "Pool: unavailable";
      awardList.setAttribute("aria-busy", "false");
      resultStatus.textContent = "The award index is unavailable.";
      errorState.hidden = false;
    }
  }

  start();
})();
