import { decryptReward } from "./reward-crypto.mjs";

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
  const rewardTier = document.getElementById("rewardTier");
  const tierIcon = document.getElementById("tierIcon");
  const tierName = document.getElementById("tierName");
  const awardNote = document.getElementById("awardNote");
  const artWallpaper = document.getElementById("artWallpaper");
  const tierGlint = rewardTier.querySelector(".tier-glint");
  const demoButton = document.getElementById("demoAgain");
  let animeLoad;
  let rewardCatalogPromise;
  let lastDemoFile = "";
  let lastDemoName = "";
  let wallpaperItems = [];
  let wallpaperResizeTimer = 0;

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

  function populateArtWallpaper(imageUrl) {
    const stampCount = 36;
    const stampStyles = 12;

    wallpaperItems = RETRO_DECALS.map(decal => ({
      className: `wall-art ${decal.className}`,
      src: decal.src,
      isRetroDecal: true,
      element: null
    }));

    for (let index = 0; index < stampCount; index += 1) {
      wallpaperItems.push({
        className: `wall-art wall-art--${(index % stampStyles) + 1}`,
        src: imageUrl,
        isRetroDecal: false,
        element: null
      });
    }

    artWallpaper.replaceChildren();
    layoutArtWallpaper();
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
    const retroItems = layoutItems.filter(item => item.isRetroDecal);
    const stampItems = layoutItems.filter(item => !item.isRetroDecal);
    const shuffle = items => {
      for (let index = items.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
      }
    };

    // Place every selected retro GIF first in random order, then fill remaining space with stamps.
    shuffle(retroItems);
    shuffle(stampItems);
    const placementOrder = [...retroItems, ...stampItems];

    const placed = [];
    const visibleItems = new Set();
    for (const item of placementOrder) {
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
    wallpaperResizeTimer = window.setTimeout(layoutArtWallpaper, 180);
  }

  window.addEventListener("resize", scheduleWallpaperLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleWallpaperLayout, { passive: true });

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
    loadingState.hidden = true;
    rewardState.hidden = true;
    errorMessage.textContent = message;
    errorState.hidden = false;
    if (demoButton) {
      demoButton.hidden = false;
      demoButton.disabled = false;
      demoButton.textContent = "Try again";
    }
  }

  function tierFromSha256(sha256) {
    if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)) return null;
    const bucket = Math.floor((Number.parseInt(sha256.slice(0, 8), 16) / 0x100000000) * 10000);
    return TIER_BUCKETS.find(tier => bucket < tier.upperBound)?.id ?? "splus";
  }

  function validateCatalog(catalog) {
    if (!catalog || catalog.version !== 3 ||
        catalog.tierAlgorithm !== "sha256-leading-32-bit-weighted-v2" ||
        !Array.isArray(catalog.files) || !Array.isArray(catalog.tierWeights) ||
        !catalog.assets || typeof catalog.assets !== "object" || Array.isArray(catalog.assets)) {
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

    return catalog.assets;
  }

  function loadRewardCatalog() {
    if (!rewardCatalogPromise) {
      rewardCatalogPromise = fetch("/assets/rewards/manifest.json", { cache: "no-store" })
        .then(response => {
          if (!response.ok) throw new Error("The reward list could not be loaded.");
          return response.json();
        })
        .then(catalog => ({ catalog, assets: validateCatalog(catalog) }))
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

  async function animateTier(tier) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const anime = await loadAnime();
    anime.remove([rewardTier, tierIcon, rewardImage, tierName, tierGlint]);
    const choreography = {
      common: {
        badge: { translateY: [0, -1.5, 0], scale: [1, 1.025, 1], duration: 2800 },
        icon: { scale: [1, 1.34, 0.82, 1.17, 1], duration: 1850, delay: 120 },
        artwork: { scale: [1, 1.018, 1], duration: 4600 },
        labelDuration: 5200,
        glint: { peak: 0.24, delay: 1550, duration: 2100 }
      },
      uncommon: {
        badge: { rotate: [0, -1.4, 1.4, 0], translateY: [0, -1.5, 0], duration: 2500 },
        artwork: { scale: [1, 1.022, 1], duration: 4200 },
        icon: {
          rotate: [0, -24, 14, -8, 0],
          scale: [1, 1.2, 0.92, 1.12, 1],
          translateY: [0, -3, 1, -2, 0],
          duration: 2050,
          easing: "easeOutBack"
        },
        labelDuration: 4550,
        glint: { peak: 0.38, delay: 1050, duration: 1850 }
      },
      rare: {
        badge: { translateY: [0, -3, 0], scale: [1, 1.025, 1], duration: 2350 },
        artwork: { scale: [1, 1.027, 1], duration: 3900 },
        icon: {
          rotateY: [0, 100, 200, 300, 360],
          rotate: [0, 8, -5, 4, 0],
          scale: [1, 1.12, 0.94, 1.08, 1],
          duration: 2650,
          delay: 100,
          direction: "normal"
        },
        labelDuration: 3750,
        glint: { peak: 0.58, delay: 760, duration: 1850 }
      },
      epic: {
        badge: {
          translateY: [0, -2, 0],
          rotate: [0, -1.5, 0, 1.5, 0],
          scale: [1, 1.04, 1],
          duration: 2150
        },
        artwork: { scale: [1, 1.032, 1], duration: 3600 },
        icon: {
          rotate: [0, 75, -30, 145, 360],
          scale: [1, 1.28, 0.86, 1.16, 1],
          translateY: [0, -5, 1, -3, 0],
          duration: 1950,
          delay: 150,
          easing: "easeOutBack",
          direction: "normal"
        },
        labelDuration: 3050,
        glint: { peak: 0.84, delay: 560, duration: 1650 }
      },
      legendary: {
        badge: {
          translateY: [0, -2, 1, -1, 0],
          rotate: [0, 1.2, -1, 0.6, 0],
          scale: [1, 1.035, 1],
          duration: 2800
        },
        artwork: { scale: [1, 1.038, 1], duration: 3300 },
        icon: {
          translateY: [0, -6, -1, -4, 0],
          rotate: [0, -16, 11, -7, 0],
          scale: [1, 1.32, 1.03, 1.2, 1],
          duration: 2050,
          easing: "easeOutBack"
        },
        labelDuration: 2500,
        glint: { peak: 0.98, delay: 420, duration: 1550 }
      },
      mythic: {
        badge: {
          translateY: [0, -3, 1, -2, 0],
          rotate: [0, -2, 1.5, -1, 0],
          scale: [1, 1.045, 0.99, 1.025, 1],
          duration: 2400
        },
        artwork: { scale: [1, 1.042, 1], duration: 3300 },
        icon: {
          rotate: [0, 140, -35, 230, 360],
          scale: [1, 1.3, 0.9, 1.18, 1],
          translateY: [0, -7, 1, -3, 0],
          duration: 2250,
          easing: "easeOutBack",
          direction: "normal"
        },
        labelDuration: 2450,
        glint: { peak: 1, delay: 330, duration: 1450 }
      },
      divine: {
        badge: {
          translateY: [0, -2, 0, 1, 0],
          rotate: [0, 1.2, -1.2, 0.6, 0],
          scale: [1, 1.04, 1],
          duration: 2900
        },
        artwork: { scale: [1, 1.035, 1], duration: 3000 },
        icon: {
          rotateY: [0, 90, 180, 270, 360],
          scale: [1, 1.25, 0.9, 1.18, 1],
          duration: 2700,
          direction: "normal"
        },
        labelDuration: 2200,
        glint: { peak: 1, delay: 220, duration: 1250 }
      },
      splus: {
        badge: {
          translateY: [0, -4, 0, -2, 0],
          rotate: [0, -2.5, 2, -1, 0],
          scale: [1, 1.06, 0.98, 1.035, 1],
          duration: 2000
        },
        artwork: { scale: [1, 1.05, 1], duration: 2800 },
        icon: {
          rotate: [0, 180, -60, 360],
          scale: [1, 1.42, 0.86, 1.24, 1],
          translateY: [0, -8, 2, -4, 0],
          duration: 1850,
          easing: "easeOutBack",
          direction: "normal"
        },
        labelDuration: 1950,
        glint: { peak: 1, delay: 160, duration: 1100 }
      }
    }[tier];

    function loopMotion(target, motion) {
      const { direction = "alternate", easing = "easeInOutSine", ...properties } = motion;
      anime({
        targets: target,
        ...properties,
        direction,
        easing,
        loop: true
      });
    }

    loopMotion(rewardTier, choreography.badge);
    loopMotion(tierIcon, choreography.icon);
    loopMotion(rewardImage, choreography.artwork);
    anime({
      targets: tierName,
      backgroundPosition: ["0% 50%", "100% 50%"],
      duration: choreography.labelDuration,
      direction: "alternate",
      easing: "easeInOutSine",
      loop: true
    });
    anime({
      targets: tierGlint,
      translateX: ["-250%", "600%"],
      opacity: [0, choreography.glint.peak, 0],
      delay: choreography.glint.delay,
      duration: choreography.glint.duration,
      easing: "linear",
      loop: true
    });
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
    const { catalog, assets } = await loadRewardCatalog();
    const candidates = catalog.files.filter(file => {
      const validFilename = typeof file === "string" && file.length <= 180 &&
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
    const imageUrl = `/assets/rewards/${encodeURIComponent(file)}`;
    document.body.dataset.tier = tier.id;
    rewardTier.dataset.tier = tier.id;
    rewardImage.dataset.tier = tier.id;
    rewardTier.setAttribute("aria-label", `${tier.label} demo tier`);
    tierIcon.textContent = TIER_MARKS[tier.id];
    tierName.textContent = tier.label;
    recipient.textContent = demoName;
    awardNote.textContent = "Demo only. No award is issued or attached to this name.";
    filename.textContent = filenameLabel(file);
    rewardImage.alt = `${tier.label} demo artwork: ${file}`;
    rewardImage.onerror = () => showError("A sample image could not be loaded. Try another demo.");
    rewardImage.src = imageUrl;
    populateArtWallpaper(imageUrl);

    lastDemoFile = file;
    lastDemoName = demoName;
    loadingState.hidden = true;
    errorState.hidden = true;
    rewardState.hidden = false;
    if (demoButton) {
      demoButton.hidden = false;
      demoButton.textContent = "Roll another demo";
    }
    animateTier(assignedTier).catch(error => {
      console.warn("[reward-demo] Tier animation is unavailable:", error);
    });
  }

  async function openReward() {
    const params = new URLSearchParams(location.search);
    const token = params.get("id");
    const keyText = new URLSearchParams(location.hash.slice(1)).get("key");
    if (!token || !keyText) throw new Error("The link is missing its encrypted reward data or key.");

    const { assets: allowedAssets } = await loadRewardCatalog();

    const data = await decryptReward(token, keyText);
    const validFilename = typeof data.file === "string" && data.file.length <= 180 &&
      data.file.toLowerCase().endsWith(".png") && !data.file.includes("/") &&
      !data.file.includes("\\") && !/[\u0000-\u001f]/.test(data.file);
    const metadata = validFilename && Object.prototype.hasOwnProperty.call(allowedAssets, data.file)
      ? allowedAssets[data.file]
      : null;
    const assignedTier = tierFromSha256(metadata?.sha256);
    if (data.version !== 1 || typeof data.username !== "string" || !data.username.trim() ||
        data.username.length > 100) {
      throw new Error("The reward details are invalid.");
    }
    if (!assignedTier || metadata.tier !== assignedTier) throw new Error("The reward asset record is invalid.");

    const tier = TIER_BUCKETS.find(entry => entry.id === assignedTier);
    document.body.dataset.tier = tier.id;
    rewardTier.dataset.tier = tier.id;
    rewardImage.dataset.tier = tier.id;
    rewardTier.setAttribute("aria-label", `${tier.label} tier award`);
    tierIcon.textContent = TIER_MARKS[tier.id];
    tierName.textContent = tier.label;
    renderUsernameCopy(data.username);
    const imageUrl = `/assets/rewards/${encodeURIComponent(data.file)}`;
    rewardImage.src = imageUrl;
    populateArtWallpaper(imageUrl);
    rewardImage.alt = `${tier.label} reward artwork: ${data.file}`;
    rewardImage.onerror = () => showError("Award image unavailable.");
    filename.textContent = filenameLabel(data.file);
    loadingState.hidden = true;
    rewardState.hidden = false;
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
      const publicAssetError = /award list|reward list|reward tier|reward asset/i.test(String(error && error.message));
      showError(publicAssetError
        ? "The reward list could not be loaded. Refresh page in a moment."
        : "Invalid or incomplete link. Include everything after #key=.");
    });
  }
})();
