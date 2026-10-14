import { resolveRewardAsset } from "./asset-resolver.mjs";
import { createRewardHref } from "./reward-link.mjs?v=github-static-1";
import { selectRewardEdgeDecals } from "./decal-pool.mjs?v=2";
import { minimumLoadingDelay } from "./loading-duration.mjs?v=1";
import { createWallpaperLayout, wallpaperPointsForViewport } from "./wallpaper-layout.mjs?v=6";
import "./loading-lineboil.mjs?v=5";
import "./pattern-zoom.mjs?v=3";
import {
  buildTwoRowAwardPreview,
  findAssignmentByLinkId,
  findAssignmentForLegacyPayload,
  isRewardLinkId,
  normalizeAwardUsername,
  otherAwardsFor,
  validateAndSortAssignments
} from "./assignment-registry.mjs?v=github-static-1";

(() => {
  "use strict";

  const navigationStartTime = performance.getEntriesByType("navigation")[0]?.startTime ?? performance.now();

  function waitForMinimumLoading() {
    const delay = minimumLoadingDelay(navigationStartTime, performance.now());
    return delay > 0 ? new Promise(resolve => window.setTimeout(resolve, delay)) : Promise.resolve();
  }

  // Keep the tier ID stable for hashing/palette selection; the label is display copy.
  const TIER_BUCKETS = [
    { id: "common", label: "Frequent", upperBound: 3000 },
    { id: "uncommon", label: "Uncommon", upperBound: 5000 },
    { id: "rare", label: "Rare", upperBound: 6500 },
    { id: "epic", label: "Epic", upperBound: 7700 },
    { id: "legendary", label: "Legendary", upperBound: 8600 },
    { id: "mythic", label: "Mythic", upperBound: 9250 },
    { id: "divine", label: "Divine", upperBound: 9700 },
    { id: "splus", label: "Good Shit", upperBound: 10000 }
  ];
  const TIER_MARKS = {
    common: "",
    uncommon: "✿",
    rare: "◆",
    epic: "✦",
    legendary: "♛",
    mythic: "☄",
    divine: "✧",
    splus: "★"
  };
  const DEMO_ADJECTIVES = [
    "Awesome", "Awful", "Baffled", "Bouncy", "Cosmic", "Cranky", "Cursed", "Dazzling",
    "Dizzy", "Electric", "Feral", "Fizzy", "Fluffy", "Funky", "Glorious", "Goofy",
    "Grumpy", "Haunted", "Jolly", "Lucky", "Mysterious", "Nifty", "Odd", "Radiant",
    "Sleepy", "Spooky", "Unruly", "Wobbly", "Zesty"
  ];
  const DEMO_NOUNS = [
    "Badger", "Banana", "Beetle", "Bison", "Capybara", "Cat", "Coyote", "Crow",
    "Dinosaur", "Duck", "Ferret", "Frog", "Goblin", "Hamster", "Jellyfish", "Kookaburra",
    "Lizard", "Moth", "Octopus", "Possum", "Raccoon", "Snail", "Spider", "Squid",
    "Toad", "Turnip", "Wasp", "Wombat", "Yak", "Zucchini"
  ];
  const ANIME_URL = "https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js";
  const ANIME_INTEGRITY = "sha384-oLmuahJgYYR1aWgZwdMQQ2AClE6A2eEwV2x1Z7cbIHehfkkmommQLH3wX1NDEszb";

  const loadingState = document.getElementById("loadingState");
  const rewardState = document.getElementById("rewardState");
  const errorState = document.getElementById("errorState");
  const recipient = document.getElementById("recipient");
  const filename = document.getElementById("filename");
  const rewardArtworkMotion = document.getElementById("rewardArtworkMotion");
  const rewardImage = document.getElementById("rewardImage");
  rewardArtworkMotion.addEventListener("contextmenu", event => event.preventDefault());
  const errorMessage = document.getElementById("errorMessage");
  const demoFootnote = document.querySelector(".demo-footnote");
  const rewardTier = document.getElementById("rewardTier");
  const tierIcon = document.getElementById("tierIcon");
  const tierName = document.getElementById("tierName");
  const awardNote = document.getElementById("awardNote");
  const awardCollection = document.getElementById("awardCollection");
  const awardCollectionHeading = document.getElementById("awardCollectionHeading");
  const awardCollectionGrid = document.getElementById("awardCollectionGrid");
  const awardCollectionStatus = document.getElementById("awardCollectionStatus");
  const artWallpaper = document.getElementById("artWallpaper");
  const rewardCard = document.querySelector("main.reward-card");
  const rewardDecalLayer = document.getElementById("rewardDecals");
  let animeLoad;
  let rewardCatalogPromise;
  let assignmentRegistryPromise;
  const wallpaperSlots = new Map();
  let wallpaperLayout = [];
  let wallpaperImageUrl = "";
  let wallpaperLayoutFrame = 0;
  let wallpaperResizeTimer = 0;
  let decalLayoutSeed = 1;
  let decalAssetHash = "";
  let activeAwardCollection = null;
  let awardCollectionGeneration = 0;
  const decalElements = new Map();

  function hashRewardIdentity(username, assetId) {
    const canonicalUsername = normalizeAwardUsername(username);
    const canonicalAssetId = typeof assetId === "string" ? assetId.toLowerCase() : "";
    const identity = `reward-decals-v1\u0000${canonicalUsername}\u0000${canonicalAssetId}`;
    let hash = 0x811c9dc5;
    for (let index = 0; index < identity.length; index += 1) {
      hash = Math.imul(hash ^ identity.charCodeAt(index), 0x01000193);
    }
    return (hash >>> 0) || 1;
  }

  function clearRewardDecals() {
    decalAssetHash = "";
    rewardDecalLayer.replaceChildren();
    decalElements.clear();
  }

  function layoutRewardDecals() {
    if (!rewardDecalLayer || !decalAssetHash || document.body.dataset.pageState !== "reward") return;

    const width = rewardDecalLayer.clientWidth;
    const height = rewardDecalLayer.clientHeight;
    if (!width || !height) return;

    const placements = selectRewardEdgeDecals(decalAssetHash, width, height);
    const activeSources = new Set(placements.map(({ item }) => item.src));
    for (const [src, element] of decalElements) {
      if (activeSources.has(src)) continue;
      element.remove();
      decalElements.delete(src);
    }

    placements.forEach(({ item, position }) => {
      let element = decalElements.get(item.src);
      if (!element) {
        element = document.createElement("img");
        element.className = `reward-decal ${item.className}`;
        element.alt = "";
        element.draggable = false;
        element.decoding = "async";
        element.setAttribute("aria-hidden", "true");
        element.src = item.src;
        decalElements.set(item.src, element);
      }

      element.hidden = false;
      element.style.left = `${position.x}px`;
      element.style.top = `${position.y}px`;
      element.style.setProperty("--decal-size", `${position.size}px`);
      element.style.setProperty("--decal-angle", `${position.angle.toFixed(1)}deg`);
      if (element.parentElement !== rewardDecalLayer) rewardDecalLayer.append(element);
    });
  }

  function populateArtWallpaper(imageUrl, assetHash) {
    wallpaperImageUrl = imageUrl;
    decalAssetHash = assetHash;
    wallpaperLayout = createWallpaperLayout(decalLayoutSeed);
    wallpaperSlots.clear();
    artWallpaper.replaceChildren();
    layoutArtWallpaper();
    layoutRewardDecals();
  }

  function layoutArtWallpaper() {
    if (!artWallpaper || !wallpaperImageUrl) return;

    const width = artWallpaper.clientWidth;
    const height = artWallpaper.clientHeight;
    if (!width || !height) return;

    const scale = Number.parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--reward-zoom-compensation")) || 1;
    const cells = wallpaperPointsForViewport(wallpaperLayout, width, height, scale);
    const visibleKeys = new Set();

    for (const cell of cells) {
      const key = String(cell.id);
      visibleKeys.add(key);
      let item = wallpaperSlots.get(key);
      if (!item) {
        const element = document.createElement("span");
        element.className = `wall-art-spin wall-art--${cell.styleIndex} ${cell.spinDirection}`;
        element.setAttribute("aria-hidden", "true");
        const image = document.createElement("img");
        image.className = "wall-art";
        image.alt = "";
        image.draggable = false;
        image.decoding = "async";
        element.append(image);
        item = { element, image };
        wallpaperSlots.set(key, item);
        artWallpaper.append(element);
      }

      item.element.hidden = false;
      item.element.style.left = `${cell.x.toFixed(2)}px`;
      item.element.style.top = `${cell.y.toFixed(2)}px`;
      item.element.style.setProperty("--wall-size", `${cell.size.toFixed(2)}px`);
      item.element.style.setProperty("--wall-angle-jitter", `${cell.angleJitter}deg`);
      item.element.style.setProperty("--wall-drift-x", cell.driftX);
      item.element.style.setProperty("--wall-drift-y", cell.driftY);
      if (item.image.getAttribute("src") !== wallpaperImageUrl) item.image.src = wallpaperImageUrl;
    }

    for (const [key, item] of wallpaperSlots) {
      if (visibleKeys.has(key)) continue;
      item.element.hidden = true;
      item.image.removeAttribute("src");
    }
  }

  function scheduleWallpaperLayout() {
    if (!wallpaperLayoutFrame) {
      wallpaperLayoutFrame = window.requestAnimationFrame(() => {
        wallpaperLayoutFrame = 0;
        layoutArtWallpaper();
      });
    }
    window.clearTimeout(wallpaperResizeTimer);
    wallpaperResizeTimer = window.setTimeout(() => {
      layoutRewardDecals();
      layoutUserAwardCollection();
    }, 180);
  }

  window.addEventListener("resize", scheduleWallpaperLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleWallpaperLayout, { passive: true });
  if (typeof ResizeObserver === "function" && rewardCard) {
    new ResizeObserver(scheduleWallpaperLayout).observe(rewardCard);
  }

  function usernameMention(username) {
    const mention = document.createElement("span");
    mention.className = "username-mention";
    mention.textContent = username;
    return mention;
  }

  function filenameLabel(file) {
    const extensionStart = file.lastIndexOf(".");
    return extensionStart > 0 ? file.slice(0, extensionStart) : file;
  }

  function renderFilename(file) {
    const label = filenameLabel(file);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !label) {
      filename.textContent = label;
      filename.classList.remove("filename--animated");
      return;
    }

    const graphemes = typeof Intl.Segmenter === "function"
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(label), part => part.segment)
      : Array.from(label);
    const fragment = document.createDocumentFragment();
    const accessibleLabel = document.createElement("span");
    accessibleLabel.className = "filename-sr-only";
    accessibleLabel.textContent = label;
    fragment.append(accessibleLabel);

    let word = null;
    let characterIndex = 0;
    const finishWord = () => {
      if (!word) return;
      fragment.append(word);
      word = null;
    };

    graphemes.forEach(grapheme => {
      if (/^\s+$/u.test(grapheme)) {
        finishWord();
        fragment.append(document.createTextNode(grapheme));
        characterIndex += 1;
        return;
      }

      if (!word) {
        word = document.createElement("span");
        word.className = "filename-word";
        word.setAttribute("aria-hidden", "true");
      }

      const character = document.createElement("span");
      character.className = "filename-character";
      character.setAttribute("aria-hidden", "true");
      character.style.setProperty("--char-index", characterIndex);
      character.textContent = grapheme;
      word.append(character);
      characterIndex += 1;
    });
    finishWord();

    filename.style.setProperty("--filename-wave-duration", `${Math.max(1900, 1300 + graphemes.length * 55)}ms`);
    filename.classList.add("filename--animated");
    filename.replaceChildren(fragment);
  }

  function renderUsernameCopy(username) {
    recipient.replaceChildren(
      document.createTextNode("For "),
      usernameMention(username)
    );
    awardNote.replaceChildren(
      document.createTextNode("This belongs only to "),
      usernameMention(username),
      document.createTextNode("! Nobody else has this reward but you!")
    );
  }

  function setRewardTitle(username) {
    document.title = `${username} Reward`;
  }

  function hideAwardCollection() {
    awardCollectionGeneration += 1;
    activeAwardCollection = null;
    if (!awardCollection) return;
    awardCollection.hidden = true;
    awardCollectionGrid.replaceChildren();
    awardCollectionStatus.hidden = true;
    awardCollectionStatus.replaceChildren();
  }

  function loadAssignmentRegistry(catalog) {
    if (!assignmentRegistryPromise) {
      assignmentRegistryPromise = (async () => {
        const response = await fetch("/zzz_assets/rewards/assignments.json", { cache: "no-store" });
        if (!response.ok) throw new Error("The award assignment registry could not be loaded.");
        return validateAndSortAssignments(await response.json(), catalog);
      })()
        .catch(error => {
          assignmentRegistryPromise = null;
          throw error;
        });
    }
    return assignmentRegistryPromise;
  }

  function makeAwardCollectionTile(assignment, username, currentAssetId) {
    const item = document.createElement("li");
    item.className = "award-collection-item";

    const isCurrent = assignment.assetId === currentAssetId;
    const canOpen = assignment.artworkIsCurrent && !isCurrent && Boolean(assignment.href);
    const tile = document.createElement(canOpen ? "a" : "span");
    if (canOpen) tile.href = assignment.href;
    tile.className = "award-collection-tile";
    if (assignment.tierId) tile.dataset.tier = assignment.tierId;
    if (isCurrent) {
      tile.setAttribute("role", "img");
      tile.setAttribute("aria-current", "page");
      tile.setAttribute("aria-label", `Current award: ${filenameLabel(assignment.filename)}, ${assignment.tierLabel}`);
      tile.title = "Current award";
    } else {
      const action = canOpen ? "Open" : "Award unavailable";
      const label = `${action}: ${filenameLabel(assignment.filename)}, ${assignment.tierLabel}, ${username}`;
      tile.setAttribute("aria-label", label);
      tile.title = label;
      if (!canOpen) tile.setAttribute("role", "img");
    }

    const image = document.createElement("img");
    image.src = `/zzz_assets/rewards/${encodeURIComponent(assignment.filename)}`;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      image.hidden = true;
      fallback.hidden = false;
      tile.classList.add("is-unavailable");
      tile.setAttribute("aria-label", `Artwork unavailable: ${filenameLabel(assignment.filename)}, ${assignment.tierLabel}, ${username}`);
      tile.title = "Artwork unavailable";
    }, { once: true });

    const fallback = document.createElement("span");
    fallback.className = "award-collection-fallback";
    fallback.textContent = "?";
    fallback.hidden = assignment.artworkIsCurrent;
    if (assignment.artworkIsCurrent) {
      image.src = `/zzz_assets/rewards/${encodeURIComponent(assignment.filename)}`;
    } else {
      image.hidden = true;
    }
    tile.append(image, fallback);

    item.append(tile);
    return item;
  }

  function layoutUserAwardCollection() {
    if (!activeAwardCollection || !awardCollection || awardCollection.hidden) return;

    const gridStyle = getComputedStyle(awardCollectionGrid);
    const sizeProbe = document.createElement("li");
    sizeProbe.className = "award-collection-item";
    sizeProbe.setAttribute("aria-hidden", "true");
    Object.assign(sizeProbe.style, { position: "absolute", visibility: "hidden", pointerEvents: "none" });
    awardCollectionGrid.append(sizeProbe);
    const tileSize = sizeProbe.getBoundingClientRect().width || 48;
    sizeProbe.remove();
    const gap = Number.parseFloat(gridStyle.columnGap) || 6;
    const columns = Math.max(1, Math.floor((awardCollectionGrid.clientWidth + gap) / (tileSize + gap)));
    const preview = buildTwoRowAwardPreview(activeAwardCollection.assignments, columns);
    const items = preview.visible.map(assignment =>
      makeAwardCollectionTile(assignment, activeAwardCollection.username, activeAwardCollection.currentAssetId));

    if (preview.overflowCount > 0) {
      const item = document.createElement("li");
      item.className = "award-collection-item";
      const link = document.createElement("a");
      link.className = "award-collection-tile award-collection-overflow";
      link.href = `/reward/list/?user=${encodeURIComponent(activeAwardCollection.username)}`;
      link.textContent = preview.overflowLabel;
      link.title = `Show all ${preview.overflowCount} more awards for ${activeAwardCollection.username}`;
      link.setAttribute("aria-label", `Show all ${preview.overflowCount} more awards for ${activeAwardCollection.username}`);
      item.append(link);
      items.push(item);
    }

    awardCollectionGrid.replaceChildren(...items);
  }

  function showUserAwardCollection(username, currentAssetId, catalog) {
    if (!awardCollection) return;
    const generation = ++awardCollectionGeneration;
    activeAwardCollection = { username, currentAssetId, assignments: [] };
    awardCollection.hidden = true;
    awardCollectionGrid.replaceChildren();
    awardCollectionStatus.hidden = true;
    awardCollectionStatus.replaceChildren();

    loadAssignmentRegistry(catalog).then(assignments => {
      if (generation !== awardCollectionGeneration) return;
      const otherAwards = otherAwardsFor(assignments, username, currentAssetId);
      if (otherAwards.length === 0) return;

      return Promise.all(otherAwards.map(async assignment => {
        try {
          const href = assignment.artworkIsCurrent
            ? createRewardHref(assignment.linkId, window.location.origin)
            : "";
          return { ...assignment, href };
        } catch (error) {
          console.warn("[reward] Could not prepare an individual award link:", error);
          return { ...assignment, href: "" };
        }
      })).then(linkedAwards => {
        if (generation !== awardCollectionGeneration) return;
        activeAwardCollection.assignments = linkedAwards;
        awardCollectionHeading.textContent = `Other awards for ${username} - newest first`;
        awardCollection.hidden = false;
        layoutUserAwardCollection();
      });
    }).catch(error => {
      if (generation !== awardCollectionGeneration) return;
      console.warn("[reward] Could not load the user's award collection:", error);
      awardCollection.hidden = true;
    });
  }

  function showError(message) {
    hideAwardCollection();
    document.body.dataset.pageState = "error";
    delete document.body.dataset.tier;
    document.querySelector("main.reward-card").setAttribute("aria-busy", "false");
    loadingState.hidden = true;
    rewardState.hidden = true;
    errorMessage.textContent = message;
    errorState.hidden = false;
    wallpaperImageUrl = "";
    wallpaperLayout = [];
    wallpaperSlots.clear();
    artWallpaper.replaceChildren();
    clearRewardDecals();
    if (demoFootnote) demoFootnote.hidden = true;
  }

  function showLoading() {
    hideAwardCollection();
    document.body.dataset.pageState = "loading";
    delete document.body.dataset.tier;
    document.querySelector("main.reward-card").setAttribute("aria-busy", "true");
    loadingState.hidden = false;
    rewardState.hidden = true;
    errorState.hidden = true;
    wallpaperImageUrl = "";
    wallpaperLayout = [];
    wallpaperSlots.clear();
    artWallpaper.replaceChildren();
    clearRewardDecals();
    if (demoFootnote) demoFootnote.hidden = true;
  }

  function waitForRewardImage(imageUrl) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let decoding = false;
      const image = new Image();
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        image.onload = null;
        image.onerror = null;
        callback(value);
      };
      const decodeIfReady = () => {
        if (settled || decoding || !image.complete) return;
        if (!image.naturalWidth || !image.naturalHeight) {
          finish(reject, new Error("The reward image could not be loaded."));
          return;
        }
        decoding = true;
        Promise.resolve(typeof image.decode === "function" ? image.decode() : undefined)
          .then(() => {
            if (!image.naturalWidth || !image.naturalHeight) {
              throw new Error("The reward image could not be decoded.");
            }
            rewardArtworkMotion.style.setProperty("--reward-art-ratio", `${image.naturalWidth} / ${image.naturalHeight}`);
            rewardImage.style.backgroundImage = `url("${imageUrl}")`;
            finish(resolve);
          })
          .catch(error => finish(reject, error));
      };

      image.onload = decodeIfReady;
      image.onerror = () => finish(reject, new Error("The reward image could not be loaded."));
      image.src = imageUrl;
      decodeIfReady();
    });
  }

  function tierFromSha256(sha256) {
    if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)) return null;
    const bucket = Math.floor((Number.parseInt(sha256.slice(0, 8), 16) / 0x100000000) * 10000);
    return TIER_BUCKETS.find(tier => bucket < tier.upperBound)?.id ?? "splus";
  }

  function validateCatalog(catalog) {
    if (!catalog || catalog.version !== 4 ||
        catalog.assetIdAlgorithm !== "sha256-png-bytes-v1" ||
        catalog.tierAlgorithm !== "sha256-leading-32-bit-weighted-v2" ||
        !Array.isArray(catalog.files) || !Array.isArray(catalog.tierWeights) ||
        !catalog.assets || typeof catalog.assets !== "object" || Array.isArray(catalog.assets) ||
        !catalog.assetsById || typeof catalog.assetsById !== "object" || Array.isArray(catalog.assetsById) ||
        !catalog.filenameHistory || typeof catalog.filenameHistory !== "object" || Array.isArray(catalog.filenameHistory)) {
      throw new Error("The reward list is invalid.");
    }

    const declaredWeights = catalog.tierWeights;
    const totalWeight = declaredWeights.reduce((sum, entry) => sum + (entry?.basisPoints ?? 0), 0);
    if (declaredWeights.length !== TIER_BUCKETS.length || totalWeight !== 10000 ||
        declaredWeights.some((entry, index) => {
          const tier = TIER_BUCKETS[index];
          const expectedWeight = tier.upperBound - (TIER_BUCKETS[index - 1]?.upperBound ?? 0);
          return entry?.id !== tier.id || entry?.label !== tier.label || entry?.basisPoints !== expectedWeight;
        })) {
      throw new Error("The reward tier settings are invalid.");
    }

    const seenFiles = new Set();
    for (const file of catalog.files) {
      const metadata = catalog.assets[file];
      if (typeof file !== "string" || file.length > 255 || !/^[^/\\\u0000-\u001f]+\.png$/i.test(file) ||
          seenFiles.has(file) || !metadata || typeof metadata !== "object" ||
          !/^[a-f0-9]{64}$/.test(metadata.assetId) || metadata.assetId !== metadata.sha256 ||
          !Number.isSafeInteger(metadata.width) || metadata.width < 1 ||
          !Number.isSafeInteger(metadata.height) || metadata.height < 1 ||
          metadata.tier !== tierFromSha256(metadata.assetId)) {
        throw new Error("The reward artwork identity is invalid.");
      }
      seenFiles.add(file);
      const indexed = catalog.assetsById[metadata.assetId];
      if (!indexed || indexed.filename !== file || indexed.width !== metadata.width ||
          indexed.height !== metadata.height || indexed.tier !== metadata.tier) {
        throw new Error("The reward artwork ID index is invalid.");
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

  function loadRewardCatalog() {
    if (!rewardCatalogPromise) {
      rewardCatalogPromise = fetch("/zzz_assets/rewards/manifest.json", { cache: "no-store" })
        .then(response => {
          if (!response.ok) throw new Error("The reward list could not be loaded.");
          return response.json();
        })
        .then(catalog => {
          validateCatalog(catalog);
          return { catalog, assets: catalog.assets };
        })
        .catch(error => {
          rewardCatalogPromise = null;
          throw error;
        });
    }
    return rewardCatalogPromise;
  }

  function loadAnime() {
    if (typeof window.anime === "function") return Promise.resolve(window.anime);
    if (animeLoad) return animeLoad;

    animeLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = ANIME_URL;
      script.integrity = ANIME_INTEGRITY;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.onload = () => typeof window.anime === "function"
        ? resolve(window.anime)
        : reject(new Error("Anime.js loaded without its animation API."));
      script.onerror = () => reject(new Error("Anime.js could not be loaded."));
      document.head.append(script);
    });
    return animeLoad;
  }

  const TIER_LOOP_MOTION = {
    common: { type: "scale", amount: 0.041, squishAmount: 0.041, duration: 3900 },
    uncommon: { type: "rotate", amount: 1.45, squishAmount: 0.038, duration: 4250 },
    rare: { type: "translateY", amount: 2.6, squishAmount: 0.04, duration: 3700 },
    epic: { type: "translateX", amount: 2.9, squishAmount: 0.042, duration: 4100 },
    legendary: { type: "rotateY", amount: 3.5, squishAmount: 0.045, duration: 4600 },
    mythic: { type: "squish", amount: 0.033, squishAmount: 0.033, duration: 3150 },
    divine: { type: "scale", amount: 0.052, squishAmount: 0.052, duration: 4250 },
    splus: { type: "rotateY", amount: 5.2, squishAmount: 0.06, duration: 3750 }
  };
  const ARTWORK_AXIS_HALF_CYCLE_MS = 2000;
  let tierAnimationGeneration = 0;

  function motionProperties(motion, intensity) {
    const amount = motion.amount * intensity;
    switch (motion.type) {
      case "scale":
        return { scale: [1, 1 + amount] };
      case "rotate":
        return { rotate: [`${-amount}deg`, `${amount}deg`] };
      case "translateY":
        return { translateY: [`${-amount}px`, `${amount}px`] };
      case "translateX":
        return { translateX: [`${-amount}px`, `${amount}px`] };
      case "rotateY":
        return { rotateY: [`${-amount}deg`, `${amount}deg`] };
      case "squish":
        return {
          scaleX: [1 - amount, 1 + amount],
          scaleY: [1 + amount, 1 - amount]
        };
      default:
        return {};
    }
  }

  async function animateTier(tier) {
    const generation = ++tierAnimationGeneration;
    if (typeof window.anime === "function") window.anime.remove([rewardTier, rewardArtworkMotion]);
    rewardTier.style.removeProperty("transform");
    rewardArtworkMotion.style.removeProperty("transform");
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const motion = TIER_LOOP_MOTION[tier];
    if (!motion) return;

    const anime = await loadAnime();
    if (generation !== tierAnimationGeneration || rewardTier.dataset.tier !== tier) return;
    anime.remove([rewardTier, rewardArtworkMotion]);
    const startLoop = (target, intensity, duration = motion.duration, motionType = motion.type, amount = motion.amount) => anime({
      targets: target,
      ...motionProperties({ type: motionType, amount }, intensity),
      duration: Math.max(900, Math.round(duration)),
      easing: "easeInOutSine",
      direction: "alternate",
      loop: true
    });

    // Two-second alternate legs make a four-second loop; opposing Y endpoints offset that axis by two seconds.
    startLoop(rewardArtworkMotion, 1.55, ARTWORK_AXIS_HALF_CYCLE_MS, "squish", motion.squishAmount);
    startLoop(rewardTier, 0.42);
  }

  function randomIndex(length) {
    const range = 0x100000000;
    const limit = Math.floor(range / length) * length;
    const sample = new Uint32Array(1);
    do {
      crypto.getRandomValues(sample);
    } while (sample[0] >= limit);
    return sample[0] % length;
  }

  function randomDemoName() {
    return `${DEMO_ADJECTIVES[randomIndex(DEMO_ADJECTIVES.length)]}${DEMO_NOUNS[randomIndex(DEMO_NOUNS.length)]}`;
  }

  async function openDemo() {
    showLoading();
    const { catalog, assets } = await loadRewardCatalog();
    const candidates = catalog.files.filter(file => {
      const validFilename = typeof file === "string" && file.length <= 255 &&
        file.toLowerCase().endsWith(".png") && !file.includes("/") &&
        !file.includes("\\") && !/[\u0000-\u001f]/.test(file);
      return validFilename && Object.prototype.hasOwnProperty.call(assets, file);
    });
    if (candidates.length === 0) throw new Error("The reward list contains no demo artwork.");

    const file = candidates[randomIndex(candidates.length)];
    const metadata = assets[file];
    const assignedTier = tierFromSha256(metadata?.sha256);
    if (!assignedTier || metadata.tier !== assignedTier) {
      throw new Error("The demo artwork tier is invalid.");
    }

    const tier = TIER_BUCKETS.find(entry => entry.id === assignedTier);
    const demoName = randomDemoName();
    setRewardTitle(demoName);
    decalLayoutSeed = hashRewardIdentity(demoName, metadata.assetId);
    const imageUrl = `/zzz_assets/rewards/${encodeURIComponent(file)}`;
    rewardTier.dataset.tier = tier.id;
    rewardImage.dataset.tier = tier.id;
    rewardTier.setAttribute("aria-label", `TIER: ${tier.label} demo tier`);
    tierIcon.textContent = TIER_MARKS[tier.id];
    tierName.textContent = `TIER: ${tier.label}`;
    recipient.textContent = demoName;
    awardNote.textContent = "Demo only. No award is issued or attached to this name.";
    renderFilename(file);
    rewardImage.setAttribute("aria-label", `${tier.label} demo artwork: ${file}`);
    await waitForRewardImage(imageUrl);
    await waitForMinimumLoading();

    document.body.dataset.tier = tier.id;
    document.body.dataset.pageState = "reward";
    rewardCard.setAttribute("aria-busy", "false");
    loadingState.hidden = true;
    errorState.hidden = true;
    rewardState.hidden = false;
    if (demoFootnote) demoFootnote.hidden = false;
    populateArtWallpaper(imageUrl, metadata.assetId);
    animateTier(assignedTier).catch(error => {
      console.warn("[reward-demo] Tier animation is unavailable:", error);
    });
  }

  async function openReward() {
    showLoading();
    const params = new URLSearchParams(location.search);
    const token = params.get("id");
    if (!token || params.size !== 1 || params.getAll("id").length !== 1) {
      throw new Error("The reward URL must contain one link ID.");
    }

    const { catalog, assets: allowedAssets } = await loadRewardCatalog();
    const assignments = await loadAssignmentRegistry(catalog);
    let assignment;

    if (isRewardLinkId(token)) {
      if (location.hash) throw new Error("A direct reward link does not need extra URL data.");
      assignment = findAssignmentByLinkId(assignments, token);
      if (!assignment) throw new Error("This reward link is unknown or has not been assigned.");
    } else {
      const keyParams = new URLSearchParams(location.hash.slice(1));
      const keyText = keyParams.get("key");
      if (!keyText || keyParams.size !== 1 || keyParams.getAll("key").length !== 1) {
        throw new Error("The legacy reward link is missing its key.");
      }
      const { decryptReward } = await import("./reward-crypto.mjs");
      const data = await decryptReward(token, keyText);
      if (![1, 2].includes(data.version) || typeof data.username !== "string" || !data.username.trim() ||
          data.username.length > 100) {
        throw new Error("The legacy reward details are invalid.");
      }
      const legacyAsset = resolveRewardAsset(catalog, data);
      if (!legacyAsset) throw new Error("The legacy reward artwork is invalid.");
      assignment = findAssignmentForLegacyPayload(assignments, data.username, legacyAsset.metadata.assetId);
      if (!assignment) throw new Error("This legacy link does not match a recorded reward assignment.");
    }

    const data = { version: 2, username: assignment.username, assetId: assignment.assetId };
    setRewardTitle(data.username);
    const resolvedAsset = resolveRewardAsset(catalog, data);
    const file = resolvedAsset?.filename || "";
    const metadata = file && Object.prototype.hasOwnProperty.call(allowedAssets, file)
      ? allowedAssets[file]
      : null;
    const assignedTier = tierFromSha256(metadata?.sha256);
    if (!file || !assignedTier || metadata.tier !== assignedTier) throw new Error("The reward asset record is invalid.");

    decalLayoutSeed = hashRewardIdentity(data.username, metadata.assetId);
    const tier = TIER_BUCKETS.find(entry => entry.id === assignedTier);
    rewardTier.dataset.tier = tier.id;
    rewardImage.dataset.tier = tier.id;
    rewardTier.setAttribute("aria-label", `TIER: ${tier.label} tier award`);
    tierIcon.textContent = TIER_MARKS[tier.id];
    tierName.textContent = `TIER: ${tier.label}`;
    renderUsernameCopy(data.username);
    const imageUrl = `/zzz_assets/rewards/${encodeURIComponent(file)}`;
    rewardImage.setAttribute("aria-label", `${tier.label} reward artwork: ${file}`);
    renderFilename(file);
    await waitForRewardImage(imageUrl);
    await waitForMinimumLoading();
    document.body.dataset.tier = tier.id;
    document.body.dataset.pageState = "reward";
    rewardCard.setAttribute("aria-busy", "false");
    loadingState.hidden = true;
    rewardState.hidden = false;
    populateArtWallpaper(imageUrl, metadata.assetId);
    showUserAwardCollection(data.username, metadata.assetId, catalog);
    animateTier(assignedTier).catch(error => {
      // The award remains readable and correctly tiered when an external animation CDN is unavailable.
      console.warn("[reward] Tier animation is unavailable:", error);
    });
  }

  if (document.body.hasAttribute("data-reward-demo")) {
    openDemo().catch(async error => {
      console.warn("[reward-demo] Could not open demo:", error);
      await waitForMinimumLoading();
      showError("Couldn't load a demo. Refresh the page or try again.");
    });
  } else {
    openReward().catch(async error => {
      console.warn("[reward] Could not open reward link:", error);
      await waitForMinimumLoading();
      const message = String(error && error.message);
      if (/reward image could not be (?:loaded|decoded)/i.test(message)) {
        showError("Award image unavailable.");
        return;
      }
      const publicAssetError = /assignment registry|award list|reward list|reward tier|reward asset/i.test(message);
      showError(publicAssetError
        ? "The reward list could not be loaded. Refresh page in a moment."
        : "Invalid or unrecorded reward link. Check the URL and try again.");
    });
  }
})();
