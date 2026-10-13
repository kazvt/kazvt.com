import { decryptReward } from "./reward-crypto.mjs";

(() => {
  "use strict";

  const TIER_BUCKETS = [
    { id: "common", label: "Common", upperBound: 6000 },
    { id: "uncommon", label: "Uncommon", upperBound: 8200 },
    { id: "rare", label: "Rare", upperBound: 9400 },
    { id: "epic", label: "Epic", upperBound: 9850 },
    { id: "legendary", label: "Legendary", upperBound: 10000 }
  ];
  const TIER_MARKS = {
    common: "",
    uncommon: "✿",
    rare: "◆",
    epic: "✦",
    legendary: "♛"
  };
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
  const tierGlint = rewardTier.querySelector(".tier-glint");
  let animeLoad;

  function showError(message) {
    loadingState.hidden = true;
    rewardState.hidden = true;
    errorMessage.textContent = message;
    errorState.hidden = false;
  }

  function tierFromSha256(sha256) {
    if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)) return null;
    const bucket = Math.floor((Number.parseInt(sha256.slice(0, 8), 16) / 0x100000000) * 10000);
    return TIER_BUCKETS.find(tier => bucket < tier.upperBound)?.id ?? "legendary";
  }

  function validateCatalog(catalog) {
    if (!catalog || catalog.version !== 2 ||
        catalog.tierAlgorithm !== "sha256-leading-32-bit-weighted-v1" ||
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

  async function openReward() {
    const params = new URLSearchParams(location.search);
    const token = params.get("id");
    const keyText = new URLSearchParams(location.hash.slice(1)).get("key");
    if (!token || !keyText) throw new Error("The link is missing its encrypted reward data or key.");

    const response = await fetch("/assets/rewards/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("The reward list could not be loaded.");
    const catalog = await response.json();
    const allowedAssets = validateCatalog(catalog);

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
    rewardTier.dataset.tier = tier.id;
    rewardImage.dataset.tier = tier.id;
    rewardTier.setAttribute("aria-label", `${tier.label} tier award`);
    tierIcon.textContent = TIER_MARKS[tier.id];
    tierName.textContent = tier.label;
    awardNote.textContent = `One-of-one award for ${data.username}. Artwork assigned once; no repeat issuance.`;
    rewardImage.src = `/assets/rewards/${encodeURIComponent(data.file)}`;
    rewardImage.alt = `${tier.label} reward artwork: ${data.file}`;
    rewardImage.onerror = () => showError("Award image unavailable.");
    recipient.textContent = `For ${data.username}`;
    filename.textContent = data.file;
    loadingState.hidden = true;
    rewardState.hidden = false;
    animateTier(assignedTier).catch(error => {
      // The award remains readable and correctly tiered when an external animation CDN is unavailable.
      console.warn("[reward] Tier animation is unavailable:", error);
    });
  }

  openReward().catch(error => {
    console.warn("[reward] Could not open reward link:", error);
    const publicAssetError = /award list|reward list|reward tier|reward asset/i.test(String(error && error.message));
    showError(publicAssetError
      ? "The reward list could not be loaded. Refresh page in a moment."
      : "Invalid or incomplete link. Include everything after #key=.");
  });
})();
