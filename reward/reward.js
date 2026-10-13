import { decryptReward } from "./reward-crypto.mjs";
import { resolveRewardAsset } from "./asset-resolver.mjs";

(() => {
  "use strict";

  // Keep the tier ID stable for hashing/palette selection; the label is display copy.
  const TIER_BUCKETS = [
    { id: "common", label: "Frequent", upperBound: 3000 },
    { id: "uncommon", label: "Uncommon", upperBound: 5000 },
    { id: "rare", label: "Rare", upperBound: 6500 },
    { id: "epic", label: "Epic", upperBound: 7700 },
    { id: "legendary", label: "Legendary", upperBound: 8600 },
    { id: "mythic", label: "Mythic", upperBound: 9250 },
    { id: "divine", label: "Divine", upperBound: 9700 },
    { id: "splus", label: "S+", upperBound: 10000 }
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
  const rewardImage = document.getElementById("rewardImage");
  const errorMessage = document.getElementById("errorMessage");
  const demoFootnote = document.querySelector(".demo-footnote");
  const rewardTier = document.getElementById("rewardTier");
  const tierIcon = document.getElementById("tierIcon");
  const tierName = document.getElementById("tierName");
  const awardNote = document.getElementById("awardNote");
  const artWallpaper = document.getElementById("artWallpaper");
  const demoButton = document.getElementById("demoAgain");
  const rewardCard = document.querySelector("main.reward-card");
  const rewardDecalLayer = document.getElementById("rewardDecals");
  let animeLoad;
  let rewardCatalogPromise;
  let lastDemoFile = "";
  let lastDemoName = "";
  let wallpaperItems = [];
  let wallpaperResizeTimer = 0;
  const decalLayoutSeed = Math.floor(Math.random() * 0xffffffff) || 1;
  const decalElements = new Map();

  const RETRO_DECALS = [
    { className: "wall-art--treasure", src: "/reward/retro/treasure-chest.gif" },
    { className: "wall-art--treasure-two", src: "/reward/retro/treasure-chest-2.gif" },
    { className: "wall-art--winner", src: "/reward/retro/winner-trophy.gif" },
    { className: "wall-art--coin", src: "/reward/retro/coin.gif" },
    { className: "wall-art--wow", src: "/reward/retro/wow.gif" },
    { className: "wall-art--genie", src: "/reward/retro/genie.gif" },
    { className: "wall-art--dance", src: "/reward/retro/dance.gif" },
    { className: "wall-art--dance", src: "/reward/retro/dancegif_bgless.gif" }
  ];

  function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pointOnPerimeter(distance, width, height) {
    const perimeter = 2 * (width + height);
    let offset = ((distance % perimeter) + perimeter) % perimeter;
    if (offset < width) return { x: offset, y: 0 };
    offset -= width;
    if (offset < height) return { x: width, y: offset };
    offset -= height;
    if (offset < width) return { x: width - offset, y: height };
    offset -= width;
    return { x: 0, y: height - offset };
  }

  function layoutRewardDecals() {
    if (!rewardDecalLayer || document.body.dataset.pageState !== "reward") return;

    const width = rewardDecalLayer.clientWidth;
    const height = rewardDecalLayer.clientHeight;
    if (!width || !height || RETRO_DECALS.length === 0) return;

    const random = createSeededRandom(decalLayoutSeed);
    const items = [...RETRO_DECALS];
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }

    const perimeter = 2 * (width + height);
    const step = perimeter / items.length;
    const size = Math.max(24, Math.min(76, Math.min(width, height) * 0.16, step / 1.9));
    const maximumJitter = Math.max(0, Math.min(step * 0.18, (step - size * 1.9) * 0.45));
    const start = random() * step;

    items.forEach((item, index) => {
      const jitter = (random() * 2 - 1) * maximumJitter;
      const point = pointOnPerimeter(start + (index + 0.5) * step + jitter, width, height);
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
      element.style.left = `${point.x}px`;
      element.style.top = `${point.y}px`;
      element.style.setProperty("--decal-size", `${size}px`);
      element.style.setProperty("--decal-angle", `${(random() * 26 - 13).toFixed(1)}deg`);
      if (element.parentElement !== rewardDecalLayer) rewardDecalLayer.append(element);
    });
  }

  function populateArtWallpaper(imageUrl) {
    const stampCount = 36;
    const stampStyles = 12;

    wallpaperItems = [];
    for (let index = 0; index < stampCount; index += 1) {
      wallpaperItems.push({
        className: `wall-art wall-art--${(index % stampStyles) + 1}`,
        src: imageUrl,
        element: null
      });
    }

    artWallpaper.replaceChildren();
    layoutArtWallpaper();
    layoutRewardDecals();
  }

  function layoutArtWallpaper() {
    if (!artWallpaper || wallpaperItems.length === 0) return;

    const width = artWallpaper.clientWidth;
    const height = artWallpaper.clientHeight;
    if (!width || !height) return;

    const baseSize = Math.max(44, Math.min(92, width * 0.085, height * 0.125));
    const gap = Math.max(6, Math.min(10, baseSize * 0.11));
    const targetRadius = baseSize * Math.SQRT1_2 + 14;
    const targetDistance = targetRadius * 2 + gap;
    const inset = targetRadius + gap / 2 + 2;
    const availableArea = Math.max(0, width - inset * 2) * Math.max(0, height - inset * 2);
    const targetCount = Math.min(
      wallpaperItems.length,
      Math.max(1, Math.floor(availableArea / (targetDistance ** 2 * 0.9)))
    );
    const layoutItems = wallpaperItems.slice(0, targetCount);

    const placed = [];
    const visibleItems = new Set();
    for (const item of layoutItems) {
      const size = Math.max(36, baseSize * (0.9 + Math.random() * 0.22));
      // The circle encloses the rotated square image, plus its glow and gentle wobble.
      const radius = size * Math.SQRT1_2 + 14;
      const itemGap = Math.max(6, Math.min(10, size * 0.11));
      const minX = radius + 3;
      const maxX = width - radius - 3;
      const minY = radius + 3;
      const maxY = height - radius - 3;
      if (maxX <= minX || maxY <= minY) continue;

      let point = null;
      for (let attempt = 0; attempt < 800; attempt += 1) {
        const candidate = {
          x: minX + Math.random() * (maxX - minX),
          y: minY + Math.random() * (maxY - minY),
          radius
        };
        const clear = placed.every(other => {
          const dx = candidate.x - other.x;
          const dy = candidate.y - other.y;
          const clearance = candidate.radius + other.radius + Math.max(itemGap, other.gap);
          return dx * dx + dy * dy >= clearance * clearance;
        });
        if (clear) {
          point = candidate;
          break;
        }
      }
      if (!point) continue;

      point.gap = itemGap;
      placed.push(point);
      visibleItems.add(item);
      if (!item.element) {
        item.element = document.createElement("img");
        item.element.className = item.className;
        item.element.alt = "";
        item.element.draggable = false;
        item.element.decoding = "async";
        item.element.setAttribute("aria-hidden", "true");
      }

      item.element.hidden = false;
      item.element.style.left = `${point.x}px`;
      item.element.style.top = `${point.y}px`;
      item.element.style.setProperty("--wall-size", `${size}px`);
      item.element.style.setProperty("--wall-angle-jitter", `${(Math.random() * 16 - 8).toFixed(1)}deg`);
      item.element.style.setProperty("--wall-drift-x", `${(Math.random() * 6 - 3).toFixed(1)}px`);
      item.element.style.setProperty("--wall-drift-y", `${(Math.random() * 6 - 3).toFixed(1)}px`);
      if (item.element.getAttribute("src") !== item.src) item.element.src = item.src;
      if (!item.element.isConnected) artWallpaper.append(item.element);
    }

    wallpaperItems.forEach(item => {
      if (visibleItems.has(item)) return;
      if (item.element) {
        item.element.hidden = true;
        item.element.removeAttribute("src");
      }
    });
  }

  function scheduleWallpaperLayout() {
    window.clearTimeout(wallpaperResizeTimer);
    wallpaperResizeTimer = window.setTimeout(() => {
      layoutArtWallpaper();
      layoutRewardDecals();
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

  function renderUsernameCopy(username) {
    recipient.replaceChildren(
      document.createTextNode("For "),
      usernameMention(username)
    );
    awardNote.replaceChildren(
      document.createTextNode("This artwork belongs only to "),
      usernameMention(username),
      document.createTextNode(". No other award receives the same artwork.")
    );
  }

  function showError(message) {
    document.body.dataset.pageState = "error";
    delete document.body.dataset.tier;
    document.querySelector("main.reward-card").setAttribute("aria-busy", "false");
    loadingState.hidden = true;
    rewardState.hidden = true;
    errorMessage.textContent = message;
    errorState.hidden = false;
    wallpaperItems = [];
    artWallpaper.replaceChildren();
    if (demoFootnote) demoFootnote.hidden = true;
    if (demoButton) {
      demoButton.hidden = false;
      demoButton.disabled = false;
      demoButton.textContent = "Try again";
    }
  }

  function showLoading() {
    document.body.dataset.pageState = "loading";
    delete document.body.dataset.tier;
    document.querySelector("main.reward-card").setAttribute("aria-busy", "true");
    loadingState.hidden = false;
    rewardState.hidden = true;
    errorState.hidden = true;
    wallpaperItems = [];
    artWallpaper.replaceChildren();
    if (demoFootnote) demoFootnote.hidden = true;
    if (demoButton) demoButton.hidden = true;
  }

  function waitForRewardImage(imageUrl) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let decoding = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        rewardImage.onload = null;
        rewardImage.onerror = null;
        callback(value);
      };
      const decodeIfReady = () => {
        if (settled || decoding || !rewardImage.complete) return;
        if (!rewardImage.naturalWidth || !rewardImage.naturalHeight) {
          finish(reject, new Error("The reward image could not be loaded."));
          return;
        }
        decoding = true;
        Promise.resolve(typeof rewardImage.decode === "function" ? rewardImage.decode() : undefined)
          .then(() => {
            if (!rewardImage.naturalWidth || !rewardImage.naturalHeight) {
              throw new Error("The reward image could not be decoded.");
            }
            finish(resolve);
          })
          .catch(error => finish(reject, error));
      };

      rewardImage.onload = decodeIfReady;
      rewardImage.onerror = () => finish(reject, new Error("The reward image could not be loaded."));
      rewardImage.src = imageUrl;
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
    common: { type: "scale", amount: 0.035, duration: 4800 },
    uncommon: { type: "rotate", amount: 1.25, duration: 5200 },
    rare: { type: "translateY", amount: 2.2, duration: 4500 },
    epic: { type: "translateX", amount: 2.5, duration: 5000 },
    legendary: { type: "rotateY", amount: 3, duration: 5600 },
    mythic: { type: "squish", amount: 0.028, duration: 3800 },
    divine: { type: "scale", amount: 0.045, duration: 5200 },
    splus: { type: "rotateY", amount: 4.5, duration: 4600 }
  };
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
    if (typeof window.anime === "function") window.anime.remove([rewardTier, rewardImage]);
    rewardTier.style.removeProperty("transform");
    rewardImage.style.removeProperty("transform");
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const motion = TIER_LOOP_MOTION[tier];
    if (!motion) return;

    const anime = await loadAnime();
    if (generation !== tierAnimationGeneration || rewardTier.dataset.tier !== tier) return;
    anime.remove([rewardTier, rewardImage]);
    const startLoop = (target, intensity) => anime({
      targets: target,
      ...motionProperties(motion, intensity),
      duration: motion.duration,
      easing: "easeInOutSine",
      direction: "alternate",
      loop: true
    });

    // Each tier has one fixed motion. Ping-pong easing makes both ends of the loop settle smoothly.
    startLoop(rewardImage, 1);
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
    let name;
    do {
      name = `${DEMO_ADJECTIVES[randomIndex(DEMO_ADJECTIVES.length)]}${DEMO_NOUNS[randomIndex(DEMO_NOUNS.length)]}`;
    } while (name === lastDemoName);
    return name;
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

    const freshCandidates = candidates.length > 1
      ? candidates.filter(file => file !== lastDemoFile)
      : candidates;
    const file = freshCandidates[randomIndex(freshCandidates.length)];
    const metadata = assets[file];
    const assignedTier = tierFromSha256(metadata?.sha256);
    if (!assignedTier || metadata.tier !== assignedTier) {
      throw new Error("The demo artwork tier is invalid.");
    }

    const tier = TIER_BUCKETS.find(entry => entry.id === assignedTier);
    const demoName = randomDemoName();
    const imageUrl = `/zzz_assets/rewards/${encodeURIComponent(file)}`;
    rewardTier.dataset.tier = tier.id;
    rewardImage.dataset.tier = tier.id;
    rewardTier.setAttribute("aria-label", `${tier.label} demo tier`);
    tierIcon.textContent = TIER_MARKS[tier.id];
    tierName.textContent = tier.label;
    recipient.textContent = demoName;
    awardNote.textContent = "Demo only. No award is issued or attached to this name.";
    filename.textContent = filenameLabel(file);
    rewardImage.alt = `${tier.label} demo artwork: ${file}`;
    await waitForRewardImage(imageUrl);

    lastDemoFile = file;
    lastDemoName = demoName;
    document.body.dataset.tier = tier.id;
    document.body.dataset.pageState = "reward";
    rewardCard.setAttribute("aria-busy", "false");
    loadingState.hidden = true;
    errorState.hidden = true;
    rewardState.hidden = false;
    if (demoFootnote) demoFootnote.hidden = false;
    if (demoButton) {
      demoButton.hidden = false;
      demoButton.textContent = "Roll another demo";
    }
    populateArtWallpaper(imageUrl);
    animateTier(assignedTier).catch(error => {
      console.warn("[reward-demo] Tier animation is unavailable:", error);
    });
  }

  async function openReward() {
    showLoading();
    const params = new URLSearchParams(location.search);
    const token = params.get("id");
    const keyText = new URLSearchParams(location.hash.slice(1)).get("key");
    if (!token || !keyText) throw new Error("The link is missing its encrypted reward data or key.");

    const { catalog, assets: allowedAssets } = await loadRewardCatalog();

    const data = await decryptReward(token, keyText);
    const resolvedAsset = resolveRewardAsset(catalog, data);
    const file = resolvedAsset?.filename || "";
    const metadata = file && Object.prototype.hasOwnProperty.call(allowedAssets, file)
      ? allowedAssets[file]
      : null;
    const assignedTier = tierFromSha256(metadata?.sha256);
    if (![1, 2].includes(data.version) || typeof data.username !== "string" || !data.username.trim() ||
        data.username.length > 100) {
      throw new Error("The reward details are invalid.");
    }
    if (!file || !assignedTier || metadata.tier !== assignedTier) throw new Error("The reward asset record is invalid.");

    const tier = TIER_BUCKETS.find(entry => entry.id === assignedTier);
    rewardTier.dataset.tier = tier.id;
    rewardImage.dataset.tier = tier.id;
    rewardTier.setAttribute("aria-label", `${tier.label} tier award`);
    tierIcon.textContent = TIER_MARKS[tier.id];
    tierName.textContent = tier.label;
    renderUsernameCopy(data.username);
    const imageUrl = `/zzz_assets/rewards/${encodeURIComponent(file)}`;
    rewardImage.alt = `${tier.label} reward artwork: ${file}`;
    filename.textContent = filenameLabel(file);
    await waitForRewardImage(imageUrl);
    document.body.dataset.tier = tier.id;
    document.body.dataset.pageState = "reward";
    rewardCard.setAttribute("aria-busy", "false");
    loadingState.hidden = true;
    rewardState.hidden = false;
    populateArtWallpaper(imageUrl);
    animateTier(assignedTier).catch(error => {
      // The award remains readable and correctly tiered when an external animation CDN is unavailable.
      console.warn("[reward] Tier animation is unavailable:", error);
    });
  }

  if (demoButton) {
    demoButton.addEventListener("click", () => {
      demoButton.disabled = true;
      demoButton.textContent = "Rolling…";
      openDemo().catch(error => {
        console.warn("[reward-demo] Could not roll a demo:", error);
        showError("Couldn't load a demo. Check the connection and try again.");
      }).finally(() => {
        demoButton.disabled = false;
      });
    });
    openDemo().catch(error => {
      console.warn("[reward-demo] Could not open demo:", error);
      showError("Couldn't load a demo. Refresh the page or try again.");
    });
  } else {
    openReward().catch(error => {
      console.warn("[reward] Could not open reward link:", error);
      const message = String(error && error.message);
      if (/reward image could not be (?:loaded|decoded)/i.test(message)) {
        showError("Award image unavailable.");
        return;
      }
      const publicAssetError = /award list|reward list|reward tier|reward asset/i.test(message);
      showError(publicAssetError
        ? "The reward list could not be loaded. Refresh page in a moment."
        : "Invalid or incomplete link. Include everything after #key=.");
    });
  }
})();
