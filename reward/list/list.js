import { createRewardHref } from "../reward-link.mjs?v=github-static-2";
import { fetchAssignmentRegistry } from "../assignment-source.mjs";
import { normalizeAwardUsername, validateAndSortAssignments } from "../assignment-registry.mjs?v=award-reason-20261020-v1";
import { formatPoolCount } from "./pool-count.mjs?v=uppercase-count-words-1";
import { createMixedGlyphs } from "./mixed-glyphs.mjs?v=gallery-glyph-collage-20261020-v4";
import "../pattern-zoom.mjs?v=2";
import "../background-context.mjs?v=1";

(() => {
  "use strict";

  const searchInput = document.getElementById("awardSearch");
  const clearButton = document.getElementById("clearSearch");
  const resultStatus = document.getElementById("resultStatus");
  const awardList = document.getElementById("awardList");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");
  const pageTitle = document.getElementById("pageTitle");
  const poolMeter = document.getElementById("poolMeter");
  const poolMeterFill = document.getElementById("poolMeterFill");
  const poolMeterCount = document.getElementById("poolMeterCount");
  const poolMeterEmptyCount = document.getElementById("poolMeterEmptyCount");
  const poolStatus = document.getElementById("poolStatus");
  const searchGlyphOverlay = document.getElementById("searchGlyphOverlay");
  const searchLabel = document.getElementById("search-label");
  const usernameParam = new URLSearchParams(window.location.search).get("user");
  const userFilterRequested = usernameParam !== null;
  const requestedUsername = usernameParam?.trim() ?? "";
  const userFilterValid = !userFilterRequested || (requestedUsername.length > 0 &&
    requestedUsername.length <= 100 && !/[\u0000-\u001f]/.test(requestedUsername));

  function normalizeSearch(value) {
    return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
  }

  function displayUsername(username) {
    return username.toUpperCase();
  }

  function mixedTextFragment(text) {
    const fragment = document.createDocumentFragment();
    let currentWord = null;
    for (const { glyph, fontClass } of createMixedGlyphs(text)) {
      if (!fontClass) {
        currentWord = null;
        fragment.append(document.createTextNode(glyph));
        continue;
      }
      if (!currentWord) {
        currentWord = document.createElement("span");
        currentWord.className = "mixed-page-word";
        fragment.append(currentWord);
      }
      const glyphElement = document.createElement("span");
      glyphElement.className = `mixed-page-glyph ${fontClass}`;
      glyphElement.textContent = glyph;
      currentWord.append(glyphElement);
    }
    return fragment;
  }

  function renderMixedText(element, text) {
    element.replaceChildren(mixedTextFragment(text));
  }

  function shouldSkipTextNode(node) {
    const parent = node.parentElement;
    return !parent || !/\S/u.test(node.nodeValue ?? "") ||
      parent.closest(".mixed-page-glyph, .tier-font-text, script, style, noscript, textarea, select, option, [contenteditable]:not([contenteditable='false']), [data-no-glyph-collage]") !== null;
  }

  function mixTextNode(node) {
    if (shouldSkipTextNode(node)) return;
    node.replaceWith(mixedTextFragment(node.nodeValue));
  }

  function mixTextIn(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      mixTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE && root.closest(".mixed-page-glyph")) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) mixTextNode(node);
  }

  const pageGlyphObserver = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "characterData") mixTextNode(record.target);
      for (const node of record.addedNodes) mixTextIn(node);
    }
  });
  pageGlyphObserver.observe(document.body, { childList: true, characterData: true, subtree: true });
  mixTextIn(document.body);

  function updateSearchGlyphOverlay() {
    const isPlaceholder = searchInput.value.length === 0;
    searchGlyphOverlay.classList.toggle("is-placeholder", isPlaceholder);
    renderMixedText(searchGlyphOverlay, isPlaceholder ? searchInput.placeholder : searchInput.value);
  }

  updateSearchGlyphOverlay();
  searchInput.addEventListener("input", updateSearchGlyphOverlay);
  searchInput.addEventListener("blur", updateSearchGlyphOverlay);

  function filenameLabel(filename) {
    const extensionStart = filename.lastIndexOf(".");
    const label = extensionStart > 0 ? filename.slice(0, extensionStart) : filename;
    return label.replace(/--[a-f0-9]{64}$/i, "");
  }

  function createText(tagName, className, value) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }

  function validateCatalog(catalog) {
    if (!catalog || catalog.version !== 4 || catalog.assetIdAlgorithm !== "sha256-image-bytes-v1" ||
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
      if (typeof filename !== "string" || filename.length > 255 || !/^[^/\\\u0000-\u001f]+\.(?:png|gif)$/i.test(filename) ||
          !asset || !/^[a-f0-9]{64}$/.test(asset.assetId) || asset.assetId !== asset.sha256 ||
          !Number.isSafeInteger(asset.width) || asset.width < 1 ||
          !Number.isSafeInteger(asset.height) || asset.height < 1 ||
          asset.tier !== expectedTier || !indexed || indexed.filename !== filename ||
          indexed.width !== asset.width || indexed.height !== asset.height || indexed.tier !== asset.tier) {
        throw new Error("The reward artwork content index is invalid.");
      }
    }
    for (const [filename, assetId] of Object.entries(catalog.filenameHistory)) {
      if (!/^[^/\\\u0000-\u001f]+\.(?:png|gif)$/i.test(filename) ||
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
    const [registry, catalogResponse, poolResponse] = await Promise.all([
      fetchAssignmentRegistry(),
      fetch("/zzz_assets/rewards/manifest.json", { cache: "no-cache" }),
      fetch("/zzz_assets/rewards/pool.json", { cache: "no-cache" })
    ]);
    if (!catalogResponse.ok || !poolResponse.ok) {
      throw new Error("The reward pool data could not be fetched.");
    }
    const rawCatalog = await catalogResponse.json();
    const catalog = validateCatalog(rawCatalog);
    const pool = await poolResponse.json();
    if (!pool || pool.version !== 1 || !Number.isSafeInteger(pool.remaining) ||
        !Number.isSafeInteger(pool.total) || pool.remaining < 0 || pool.total < 0 ||
        pool.remaining > pool.total) {
      throw new Error("The public reward pool count is invalid.");
    }
    return {
      assignments: validateAndSortAssignments(registry, catalog),
      pool
    };
  }

  function renderPoolStatus(pool) {
    const { remaining, total } = pool;
    const max = Math.max(total, 1);
    poolMeter.setAttribute("aria-valuemax", String(max));
    poolMeter.setAttribute("aria-valuenow", String(remaining));
    poolMeter.setAttribute("aria-valuetext", `${remaining} of ${total} unique rewards remain`);
    poolMeter.classList.toggle("is-empty", remaining === 0);
    poolMeter.classList.remove("is-unavailable");
    const countLabel = formatPoolCount(remaining);
    renderMixedText(poolMeterEmptyCount, countLabel);
    renderMixedText(poolMeterCount, countLabel);
    const fillPercent = total ? (remaining / total) * 100 : 0;
    const countWidth = Math.ceil(poolMeterCount.getBoundingClientRect().width + 12);
    poolMeterFill.style.width = remaining > 0
      ? `max(${fillPercent}%, ${countWidth}px)`
      : "0%";
    poolStatus.textContent = `${remaining} unique ${remaining === 1 ? "reward" : "rewards"} left.`;
  }

  async function makeCard(assignment) {
    const card = document.createElement("article");
    card.className = "award-card";
    card.dataset.tier = assignment.tierId;

    const artworkFrame = document.createElement("div");
    artworkFrame.className = "artwork-frame";
    artworkFrame.dataset.tier = assignment.tierId;
    artworkFrame.setAttribute("aria-hidden", "true");

    const info = document.createElement("div");
    info.className = "award-info";
    const shownUsername = displayUsername(assignment.username);
    info.append(createText("h2", "username username-display", shownUsername));
    info.append(createText("p", "artwork-name tier-font-text", filenameLabel(assignment.filename)));

    const meta = document.createElement("div");
    meta.className = "award-meta";
    const badge = createText("span", "tier-badge", `TIER: ${assignment.tierLabel}`);
    badge.dataset.tier = assignment.tierId;
    meta.append(badge);
    info.append(meta);

    if (assignment.reason) {
      const reason = document.createElement("p");
      reason.className = "award-reason-card";
      reason.title = `Awarded for: ${assignment.reason}`;
      const label = createText("span", "reward-reason-label", "FOR:");
      const note = createText("span", "award-reason-text tier-font-text", assignment.reason);
      reason.append(label, note);
      info.append(reason);
    }

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
        throw new Error("The assigned reward does not have an active direct link.");
      }
      openLink = document.createElement("a");
      openLink.href = createRewardHref(assignment.linkId, window.location.origin);
      openLink.textContent = "Open ↗";
      openLink.setAttribute("aria-label", `Open ${shownUsername}'s reward`);
    } catch (error) {
      console.warn("[reward-list] Could not prepare an individual reward link:", error);
      openLink = createText("span", "open-button is-unavailable", assignment.artworkIsCurrent
        ? "Reward link unavailable"
        : "Reward unavailable");
      openLink.setAttribute("aria-disabled", "true");
      openLink.setAttribute("role", "img");
      openLink.setAttribute("aria-label", `${shownUsername}'s reward cannot be opened`);
      openLink.title = "This reward has no UUID link or its artwork is no longer in the current catalog.";
    }
    openLink.classList.add("open-button");

    card.append(artworkFrame, info, openLink);
    const searchText = normalizeSearch(
      `${assignment.username} ${assignment.platform} ${assignment.userId} ${assignment.filename} ${filenameLabel(assignment.filename)} ${assignment.reason}`
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
    let title = "Rewards";
    if (userFilterRequested) {
      if (userFilterValid) {
        title = `${displayUsername(requestedUsername)} Rewards`;
      } else {
        title = "Reward lookup";
      }
      searchLabel.textContent = "Search this collection";
      searchInput.placeholder = "Search artwork…";
      updateSearchGlyphOverlay();
    }
    pageTitle.setAttribute("aria-label", title);
    renderMixedText(pageTitle, title);
    document.title = `${title} — kazvt`;

    try {
      const { assignments: allAssignments, pool } = await loadRegistry();
      renderPoolStatus(pool);
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
        if (userFilterRequested && userFilterValid) {
          emptyState.replaceChildren(
            document.createTextNode("No rewards for "),
            createText("span", "username-display", displayUsername(requestedUsername)),
            document.createTextNode(".")
          );
        } else {
          emptyState.textContent = userFilterRequested ? "Invalid username." : "No rewards yet.";
        }
      }
      updateResults(cards);
      searchInput.addEventListener("input", () => updateResults(cards));
      clearButton.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.focus();
        updateSearchGlyphOverlay();
        updateResults(cards);
      });
    } catch (error) {
      console.error("[reward-list] Could not load reward data:", error);
      poolMeter.classList.add("is-unavailable");
      poolMeter.setAttribute("aria-valuetext", "Reward pool unavailable");
      poolStatus.textContent = "The reward pool is unavailable.";
      awardList.setAttribute("aria-busy", "false");
      resultStatus.textContent = "The reward index is unavailable.";
      errorState.hidden = false;
    }
  }

  start();
})();
