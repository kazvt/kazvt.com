(() => {
  const body = document.body;
  const html = document.documentElement;
  const world = document.querySelector(".z-viewport");
  const gifSky = document.getElementById("gifSky");
  const audioStatus = document.getElementById("audioStatus");
  const entryNameMeasureContext = document.createElement("canvas").getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const backgroundMusicUrl = "/zoey/assets/background/zoey-galaxy-background.mp3";
  const backgroundMusicBytes = fetch(backgroundMusicUrl, { cache: "force-cache" })
    .then((response) => response.ok ? response.arrayBuffer() : null)
    .catch(() => null);

  // Submitted sender artwork and recordings stay local to this site; never synthesize them.
  const entrySlots = [
    {
      id: "kaz",
      name: "Kaz",
      avatar: "/zoey/assets/kaz/kaz-avatar.png",
      clips: [
        { src: "/zoey/assets/kaz/kaz-voice-1.wav", caption: "Kaz's voice note 1 of 3." },
        { src: "/zoey/assets/kaz/kaz-voice-2.wav", caption: "Kaz's voice note 2 of 3." },
        { src: "/zoey/assets/kaz/kaz-voice-3.wav", caption: "Kaz's voice note 3 of 3." }
      ]
    },
    {
      id: "abigail",
      name: "Abigail",
      avatar: "/zoey/assets/abigail/abigail-avatar.png",
      clips: [
        { src: "/zoey/assets/abigail/abigail-voice-1.wav", caption: "Abigail's voice note 1 of 3." },
        { src: "/zoey/assets/abigail/abigail-voice-2.wav", caption: "Abigail's voice note 2 of 3." },
        { src: "/zoey/assets/abigail/abigail-voice-3.wav", caption: "Abigail's voice note 3 of 3." }
      ]
    },
    {
      id: "letty",
      name: "Letty",
      avatar: "/zoey/assets/letty/letty-avatar.png",
      clips: [
        { src: "/zoey/assets/letty/letty-voice-1.wav", caption: "Letty's voice note 1 of 2." },
        { src: "/zoey/assets/letty/letty-voice-2.wav", caption: "Letty's voice note 2 of 2." }
      ]
    },
    {
      id: "traaansfem",
      name: "TraaansFem",
      avatar: "/zoey/assets/traaansfem/traaansfem-avatar.png",
      clips: [
        { src: "/zoey/assets/traaansfem/traaansfem-voice-1.wav", caption: "TraaansFem's voice note 1 of 2." },
        { src: "/zoey/assets/traaansfem/traaansfem-voice-2.wav", caption: "TraaansFem's voice note 2 of 2." }
      ]
    },
    {
      id: "kilda",
      name: "Kilda",
      avatar: "/zoey/assets/kilda/kilda-avatar.png",
      clips: [
        { src: "/zoey/assets/kilda/kilda-voice-1.wav", caption: "Kilda's voice note 1 of 3." },
        { src: "/zoey/assets/kilda/kilda-voice-2.wav", caption: "Kilda's voice note 2 of 3." },
        { src: "/zoey/assets/kilda/kilda-voice-3.wav", caption: "Kilda's voice note 3 of 3." }
      ]
    },
    {
      id: "froggy",
      name: "Froggy",
      avatar: "/zoey/assets/froggy/froggy-avatar.png",
      clips: [
        { src: "/zoey/assets/froggy/froggy-voice-1-centered-20261108.wav?v=20261108-11", caption: "Froggy's voice note 1 of 3." },
        { src: "/zoey/assets/froggy/froggy-voice-2-centered-20261108.wav?v=20261108-11", caption: "Froggy's voice note 2 of 3." },
        { src: "/zoey/assets/froggy/froggy-voice-3-centered-20261108.wav?v=20261108-11", caption: "Froggy's voice note 3 of 3." }
      ]
    },
    {
      id: "oceo",
      name: "Oceo",
      avatar: "/zoey/assets/oceo/oceo-avatar.png",
      clips: [
        { src: "/zoey/assets/oceo/oceo-voice-1.wav?v=20261108-04", caption: "Oceo's voice note 1 of 3." },
        { src: "/zoey/assets/oceo/oceo-voice-2.wav?v=20261108-04", caption: "Oceo's voice note 2 of 3." },
        { src: "/zoey/assets/oceo/oceo-voice-3.wav?v=20261108-04", caption: "Oceo's voice note 3 of 3." }
      ]
    },
    {
      id: "diosu",
      name: "Diosu",
      avatar: "/zoey/assets/diosu/diosu-avatar.png",
      clips: [
        { src: "/zoey/assets/diosu/diosu-voice-1-20261108-later.wav?v=20261108-03", caption: "Diosu's voice note 1 of 2." },
        { src: "/zoey/assets/diosu/diosu-voice-2-20261108-later.wav?v=20261108-03", caption: "Diosu's voice note 2 of 2." }
      ]
    },
    {
      id: "poppy",
      name: "Poppy",
      avatar: "/zoey/assets/poppy/poppy-avatar.png",
      clips: [
        { src: "/zoey/assets/poppy/poppy-voice-1-20261108-later-2.wav?v=20261108-11", caption: "Poppy's voice note 1 of 3." },
        { src: "/zoey/assets/poppy/poppy-voice-2-20261108-later-2.wav?v=20261108-11", caption: "Poppy's voice note 2 of 3." },
        { src: "/zoey/assets/poppy/poppy-voice-3.wav?v=20261108-01", caption: "Poppy's voice note 3 of 3." }
      ]
    },
    {
      id: "frosty",
      name: "Frosty",
      avatar: "",
      clips: [
        { src: "/zoey/assets/frosty/frosty-voice-1.wav", caption: "Frosty's voice note 1 of 3." },
        { src: "/zoey/assets/frosty/frosty-voice-2.wav", caption: "Frosty's voice note 2 of 3." },
        { src: "/zoey/assets/frosty/frosty-voice-3.wav", caption: "Frosty's voice note 3 of 3." }
      ]
    },
    {
      id: "rochelle",
      name: "Rochelle",
      avatar: "/zoey/assets/evo/evo-avatar.png",
      clips: [
        { src: "/zoey/assets/evo/evo-voice-1-20261106.mp3", caption: "Rochelle's voice note 1 of 3." },
        { src: "/zoey/assets/evo/evo-voice-2-20261106.mp3", caption: "Rochelle's voice note 2 of 3." },
        { src: "/zoey/assets/evo/evo-voice-3-20261106.mp3", caption: "Rochelle's voice note 3 of 3." }
      ]
    },
    {
      id: "nea-pollen",
      name: "Nea",
      avatar: "/zoey/assets/nea-pollen/nea-pollen-avatar.png",
      clips: [
        { src: "/zoey/assets/nea-pollen/nea-pollen-voice-1.wav?v=20261107-06", caption: "Nea's voice note 1 of 3." },
        { src: "/zoey/assets/nea-pollen/nea-pollen-voice-2.wav?v=20261107-06", caption: "Nea's voice note 2 of 3." },
        { src: "/zoey/assets/nea-pollen/nea-pollen-voice-3.wav?v=20261107-06", caption: "Nea's voice note 3 of 3." }
      ]
    },
    {
      id: "dom",
      name: "Dom",
      avatar: "/zoey/assets/dom/dom-avatar.png",
      clips: [
        { src: "/zoey/assets/dom/dom-voice-1.wav", caption: "Dom's voice note 1 of 3." },
        { src: "/zoey/assets/dom/dom-voice-2.wav", caption: "Dom's voice note 2 of 3." },
        { src: "/zoey/assets/dom/dom-voice-3.wav", caption: "Dom's voice note 3 of 3." }
      ]
    },
    {
      id: "serunie",
      name: "Serunie",
      avatar: "/zoey/assets/serunie/serunie-avatar.png",
      clips: [
        { src: "/zoey/assets/serunie/serunie-voice-1.wav?v=20261107-05", caption: "Serunie's voice note 1 of 3." },
        { src: "/zoey/assets/serunie/serunie-voice-2.wav?v=20261107-05", caption: "Serunie's voice note 2 of 3." },
        { src: "/zoey/assets/serunie/serunie-voice-3.wav?v=20261107-05", caption: "Serunie's voice note 3 of 3." }
      ]
    },
    {
      id: "maple",
      name: "Maple",
      avatar: "/zoey/assets/maple/maple-avatar.png",
      clips: [
        { src: "/zoey/assets/maple/maple-voice-1.wav?v=20261107-07", caption: "Maple's voice note 1 of 3." },
        { src: "/zoey/assets/maple/maple-voice-2.wav?v=20261107-07", caption: "Maple's voice note 2 of 3." },
        { src: "/zoey/assets/maple/maple-voice-3.wav?v=20261107-07", caption: "Maple's voice note 3 of 3." }
      ]
    },
    {
      id: "pato",
      name: "Pato",
      avatar: "/zoey/assets/pato/pato-avatar.png",
      clips: [
        { src: "/zoey/assets/pato/pato-voice-1-20261108-later.wav?v=20261108-08", caption: "Pato's voice note 1 of 3." },
        { src: "/zoey/assets/pato/pato-voice-2-20261108-later.wav?v=20261108-08", caption: "Pato's voice note 2 of 3." },
        { src: "/zoey/assets/pato/pato-voice-3-20261108-tail.wav?v=20261108-11", caption: "Pato's voice note 3 of 3." }
      ]
    },
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `star-${String(index + 17).padStart(2, "0")}`,
      name: "PLACEHOLDER",
      avatar: "",
      clips: []
    }))
  ];

  // One fixed, hand-baked sticker tilt per entry. These do not re-randomize
  // during resize, hover, or animation; the modest angles preserve clean gaps.
  const ENTRY_ROTATION_DEG = Object.freeze({
    kaz: -6.0, abigail: 4.2, letty: -2.1, traaansfem: 7.4,
    kilda: -5.3, froggy: 3.1, oceo: -7.8, diosu: 5.6,
    poppy: -3.7, frosty: 6.5, rochelle: -6.8, "nea-pollen": 2.6,
    dom: -4.9, serunie: 7.1, maple: -2.8, pato: 4.5,
    "star-17": -5.8, "star-18": 3.6, "star-19": -7.0, "star-20": 2.0
  });

  let audioEnabled = false;
  let audioContext = null;
  let audioMixBus = null;
  let audioResumePromise = null;
  let backgroundMusicGain = null;
  let backgroundMusicBuffer = null;
  let backgroundMusicBufferPromise = null;
  let backgroundMusicStartPromise = null;
  let backgroundMusicLoopStart = 0;
  let backgroundMusicSource = null;
  let fallbackBackgroundMusic = null;
  let backgroundMusicFallback = false;
  const voiceBufferPromises = new Map();
  let startingClip = null;
  let activeVoice = null;
  const activeMedia = new Set();
  const playingCounts = new Map();
  let gifEntries = null;
  let gifImages = [];
  let catalogPromise = null;
  const clipIndexes = new Map();

  function seeded(index, salt) {
    const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function renderEntries() {
    const fragment = document.createDocumentFragment();
    entrySlots.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "z-entry";
      card.setAttribute("role", "listitem");

      const button = document.createElement("button");
      button.className = "z-entry-button";
      button.type = "button";
      button.dataset.entryId = entry.id;
      button.setAttribute("aria-label", entry.clips.length ? `${entry.name}'s voice message.` : `${entry.name}. Message pending.`);
      button.addEventListener("click", () => {
        if (!audioEnabled) enableAudio();
        playNextClip(entry, button);
      });

      const avatar = document.createElement("span");
      avatar.className = "z-entry-avatar";
      avatar.setAttribute("aria-hidden", "true");
      if (entry.avatar) {
        const image = document.createElement("img");
        image.src = entry.avatar;
        image.alt = "";
        image.loading = "eager";
        avatar.append(image);
      } else {
        const star = document.createElement("span");
        star.className = "z-avatar-star";
        star.textContent = "*";
        avatar.append(star);
      }

      const name = document.createElement("span");
      name.className = "z-entry-name";
      name.textContent = entry.name;
      avatar.append(name);
      button.append(avatar);
      card.append(button);
      fragment.append(card);
    });
    document.getElementById("entryCanvas").replaceChildren(fragment);
    layoutEntryStickers();
  }

  function layoutEntryStickers() {
    const canvas = document.getElementById("entryCanvas");
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;

    const aspectRatio = width / height;
    const compactViewport = height < 180;
    canvas.dataset.compact = compactViewport ? "true" : "false";
    // Aspect-ratio layouts keep their proportions at browser zoom levels.
    const layoutName = aspectRatio < .9 ? "portrait" : aspectRatio >= 1.55 ? "panorama" : "wide";
    const layouts = {
      // Four columns by five rows keep the constellation compact on portrait and mid-width screens.
      portrait: [
        [2.5, 3, 21, 19.5], [26.5, 3.2, 21, 19.5], [51, 3, 21, 19.5], [75.5, 3.2, 21, 19.5],
        [2.7, 22, 21, 19.5], [26.2, 22.2, 21, 19.5], [51.3, 22, 21, 19.5], [75.2, 22.2, 21, 19.5],
        [2.5, 41, 21, 19.5], [26.5, 41.2, 21, 19.5], [51, 41, 21, 19.5], [75.5, 41.2, 21, 19.5],
        [2.7, 60, 21, 19.5], [26.2, 60.2, 21, 19.5], [51.3, 60, 21, 19.5], [75.2, 60.2, 21, 19.5],
        [2.5, 79, 21, 19.5], [26.5, 78.8, 21, 19.5], [51, 79, 21, 19.5], [75.5, 78.8, 21, 19.5]
      ],
      // Medium aspect ratios also use four columns, with a fifth row for the extra stickers.
      wide: [
        [2.5, 3, 21, 19.5], [26.5, 3.2, 21, 19.5], [51, 3, 21, 19.5], [75.5, 3.2, 21, 19.5],
        [2.7, 22, 21, 19.5], [26.2, 22.2, 21, 19.5], [51.3, 22, 21, 19.5], [75.2, 22.2, 21, 19.5],
        [2.5, 41, 21, 19.5], [26.5, 41.2, 21, 19.5], [51, 41, 21, 19.5], [75.5, 41.2, 21, 19.5],
        [2.7, 60, 21, 19.5], [26.2, 60.2, 21, 19.5], [51.3, 60, 21, 19.5], [75.2, 60.2, 21, 19.5],
        [2.5, 79, 21, 19.5], [26.5, 78.8, 21, 19.5], [51, 79, 21, 19.5], [75.5, 78.8, 21, 19.5]
      ],
      // Wide canvases gain the requested fifth column while retaining four balanced rows.
      panorama: [
        [1, 3.5, 17, 23.5], [21, 3.7, 17, 23.5], [41, 3.5, 17, 23.5], [61, 3.7, 17, 23.5], [81, 3.5, 17, 23.5],
        [1.2, 27, 17, 23.5], [20.8, 27.2, 17, 23.5], [41.2, 27, 17, 23.5], [60.8, 27.2, 17, 23.5], [81.2, 27, 17, 23.5],
        [0.95, 50.5, 17, 23.5], [21.2, 50.7, 17, 23.5], [40.8, 50.5, 17, 23.5], [61.1, 50.7, 17, 23.5], [80.9, 50.5, 17, 23.5],
        [1.15, 74, 17, 23.5], [20.9, 74.2, 17, 23.5], [41.1, 74, 17, 23.5], [60.85, 74.2, 17, 23.5], [81.1, 74, 17, 23.5]
      ]
    };
    const positions = layouts[layoutName];
    let realEntryIndex = 0;
    let placeholderIndex = 0;
    const positionIndexes = entrySlots.map((entry) => {
      if (entry.id.startsWith("star-")) {
        const index = layoutName === "panorama" ? placeholderIndex * 5 + 4 : 16 + placeholderIndex;
        placeholderIndex += 1;
        return index;
      }
      const index = layoutName === "panorama"
        ? Math.floor(realEntryIndex / 4) * 5 + realEntryIndex % 4
        : realEntryIndex;
      realEntryIndex += 1;
      return index;
    });
    const hoverScale = compactViewport ? 1.08 : 1.12;
    const riseRange = height < 180 ? 0 : 2;
    const cards = [...canvas.querySelectorAll(".z-entry")];
    canvas.dataset.crowded = cards.length >= 20 ? "true" : "false";

    // CSS transforms do not participate in layout flow, so test the fixed tilt,
    // the resting spacing, and the larger hover state against the canvas edges.
    function getBounds(cardScale, motionScale, visualScale = 1) {
      return cards.map((_, index) => {
        const [xPct, yPct, widthPct, heightPct] = positions[positionIndexes[index]];
        const scaledWidthPct = widthPct * cardScale * visualScale;
        const scaledHeightPct = heightPct * cardScale * visualScale;
        const x = (xPct + (widthPct - scaledWidthPct) / 2) * width / 100;
        const y = (yPct + (heightPct - scaledHeightPct) / 2) * height / 100;
        const cardWidth = scaledWidthPct * width / 100;
        const cardHeight = scaledHeightPct * height / 100;
        const angle = (ENTRY_ROTATION_DEG[entrySlots[index].id] || 0) * Math.PI / 180;
        const rise = (seeded(index, 12) - .5) * riseRange * motionScale;
        const boundsWidth = Math.abs(cardWidth * Math.cos(angle)) + Math.abs(cardHeight * Math.sin(angle));
        const boundsHeight = Math.abs(cardHeight * Math.cos(angle)) + Math.abs(cardWidth * Math.sin(angle));
        const centerX = x + cardWidth / 2 - Math.sin(angle) * rise;
        const centerY = y + cardHeight / 2 + Math.cos(angle) * rise;
        return {
          left: centerX - boundsWidth / 2,
          right: centerX + boundsWidth / 2,
          top: centerY - boundsHeight / 2,
          bottom: centerY + boundsHeight / 2
        };
      });
    }

    function hasSafeSpacing(bounds, checkCollisions = true) {
      const edge = Math.min(3, Math.min(width, height) * .01);
      const gap = Math.min(2, Math.min(width, height) * .004);
      return bounds.every((box, index) => {
        if (box.left < edge || box.top < edge || box.right > width - edge || box.bottom > height - edge) return false;
        if (!checkCollisions) return true;
        return bounds.slice(0, index).every((other) =>
          box.left >= other.right + gap || box.right <= other.left - gap ||
          box.top >= other.bottom + gap || box.bottom <= other.top - gap
        );
      });
    }

    function hasSafeLayout(cardScale, motionScale) {
      return hasSafeSpacing(getBounds(cardScale, motionScale), true) &&
        hasSafeSpacing(getBounds(cardScale, motionScale, hoverScale), false);
    }

    let cardScale = 1;
    let motionScale = 1;
    if (!hasSafeLayout(cardScale, motionScale)) motionScale = 0;
    if (!hasSafeLayout(cardScale, motionScale)) {
      for (let candidate = .98; candidate >= .5; candidate -= .02) {
        if (hasSafeLayout(candidate, motionScale)) {
          cardScale = candidate;
          break;
        }
      }
    }
    if (!hasSafeLayout(cardScale, motionScale)) {
      cardScale = .5;
      motionScale = 0;
    }

    cards.forEach((card, index) => {
      const [x, y, cardWidth, cardHeight] = positions[positionIndexes[index]];
      const fittedWidth = cardWidth * cardScale;
      const fittedHeight = cardHeight * cardScale;
      card.style.setProperty("--entry-x", `${(x + (cardWidth - fittedWidth) / 2).toFixed(3)}%`);
      card.style.setProperty("--entry-y", `${(y + (cardHeight - fittedHeight) / 2).toFixed(3)}%`);
      card.style.setProperty("--entry-width", `${fittedWidth.toFixed(3)}%`);
      card.style.setProperty("--entry-height", `${fittedHeight.toFixed(3)}%`);
      card.style.setProperty("--entry-tilt", `${(ENTRY_ROTATION_DEG[entrySlots[index].id] || 0).toFixed(2)}deg`);
      card.style.setProperty("--entry-hover-scale", hoverScale.toFixed(2));
      card.style.setProperty("--entry-rise", `${((seeded(index, 12) - .5) * riseRange * motionScale).toFixed(1)}px`);
    });
    // Placeholder stars used to have a 38px minimum and could spill out of
    // their sticker, overlapping nearby real avatars despite safe card bounds.
    cards.forEach((card) => {
      const avatar = card.querySelector(".z-entry-avatar");
      const star = card.querySelector(".z-avatar-star");
      const name = card.querySelector(".z-entry-name");
      if (!avatar) return;
      if (name && entryNameMeasureContext) {
        name.style.fontSize = "";
        const nameStyle = getComputedStyle(name);
        const baseSize = Number.parseFloat(nameStyle.fontSize);
        const availableWidth = Math.max(1, avatar.clientWidth - 10);
        entryNameMeasureContext.font = `${nameStyle.fontWeight} ${baseSize}px ${nameStyle.fontFamily}`;
        const measuredWidth = entryNameMeasureContext.measureText(name.textContent.trim()).width;
        if (measuredWidth > availableWidth && measuredWidth > 0) {
          const minSize = Math.min(baseSize, 7.5);
          const fittedSize = Math.max(minSize, baseSize * availableWidth / measuredWidth);
          name.style.fontSize = `${fittedSize.toFixed(2)}px`;
        }
      }
      if (star) {
        const starSize = Math.min(84, avatar.clientWidth * .22, avatar.clientHeight * .52);
        star.style.setProperty("--entry-star-size", `${Math.max(0, starSize).toFixed(2)}px`);
      }
    });
    canvas.dataset.layout = layoutName;
  }

  function layoutGifSky() {
    if (!gifImages.length || !gifEntries) return;
    const compact = window.matchMedia("(max-width: 700px)").matches;
    gifImages.forEach((image, index) => {
      image.hidden = false;
      if (body.dataset.motion !== "on") {
        image.removeAttribute("src");
        return;
      }

      const longest = Math.max(gifEntries[index].width, gifEntries[index].height) || 1;
      const base = compact ? 15 + seeded(index, 3) * 19 : 20 + seeded(index, 3) * 40;
      const scale = base / longest;
      const width = Math.max(12, gifEntries[index].width * scale);
      const height = Math.max(12, gifEntries[index].height * scale);
      const xInset = Math.min(12, width / Math.max(1, window.innerWidth) * 50);
      const yInset = Math.min(12, height / Math.max(1, window.innerHeight) * 50);
      const x = Math.max(xInset, Math.min(100 - xInset, 2 + seeded(index, 1) * 96));
      const y = Math.max(yInset, Math.min(100 - yInset, 2 + seeded(index, 2) * 96));
      image.style.left = `${x}%`;
      image.style.top = `${y}%`;
      image.style.setProperty("--z-gif-width", `${width.toFixed(1)}px`);
      image.style.setProperty("--z-gif-height", `${height.toFixed(1)}px`);
      image.style.setProperty("--z-gif-opacity", (.56 + seeded(index, 4) * .3).toFixed(2));
      image.style.setProperty("--z-gif-tilt", `${((seeded(index, 5) - .5) * 24).toFixed(1)}deg`);
      if (!image.hasAttribute("src")) image.src = image.dataset.src;
    });
  }

  async function loadGifCatalog() {
    if (gifEntries) return gifEntries;
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch("/zoey/gif-manifest.json?v=20261105-06", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("GIF list unavailable");
        return response.json();
      })
      .then((entries) => {
        if (!Array.isArray(entries) || !entries.length || entries.some((entry) => !entry.file || !Number.isFinite(entry.width) || !Number.isFinite(entry.height))) {
          throw new Error("Unexpected GIF list");
        }
        gifEntries = entries;
        const fragment = document.createDocumentFragment();
        entries.forEach((entry) => {
          const image = document.createElement("img");
          image.className = "z-float-gif";
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          image.width = entry.width;
          image.height = entry.height;
          image.loading = "lazy";
          image.decoding = "async";
          image.dataset.src = "/zoey/assets/gifs/" + entry.file;
          fragment.append(image);
          gifImages.push(image);
        });
        gifSky.append(fragment);
        gifSky.hidden = body.dataset.motion !== "on";
        layoutGifSky();
        return entries;
      })
      .catch(() => {
        catalogPromise = null;
        return null;
      });
    return catalogPromise;
  }

  function setMotion(enabled) {
    body.dataset.motion = enabled ? "on" : "off";
    html.dataset.zoeyMotion = enabled ? "on" : "off";
    gifSky.hidden = !enabled;
    if (enabled) {
      if (gifEntries) layoutGifSky();
      else void loadGifCatalog();
    } else {
      gifImages.forEach((image) => image.removeAttribute("src"));
    }
  }

  function createCrossfadedLoopBuffer(buffer) {
    const overlap = Math.min(Math.floor(buffer.sampleRate * .65), Math.floor(buffer.length / 4));
    if (overlap < 2) return { buffer, loopStart: 0 };

    // Preserve the full opening once, then let the loop repeat from just beyond
    // the crossfade where the blended tail meets the same sample sequence.
    const loopBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    const tailStart = buffer.length - overlap;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const input = buffer.getChannelData(channel);
      const output = loopBuffer.getChannelData(channel);
      output.set(input.subarray(0, tailStart), 0);
      for (let index = 0; index < overlap; index += 1) {
        const position = (index + .5) / overlap;
        const tailGain = Math.cos(position * Math.PI / 2);
        const headGain = Math.sin(position * Math.PI / 2);
        output[tailStart + index] = input[tailStart + index] * tailGain + input[index] * headGain;
      }
    }
    return { buffer: loopBuffer, loopStart: overlap / buffer.sampleRate };
  }

  function loadBackgroundMusic() {
    if (backgroundMusicBuffer) return Promise.resolve(backgroundMusicBuffer);
    if (!backgroundMusicBufferPromise) {
      backgroundMusicBufferPromise = backgroundMusicBytes
        .then((bytes) => {
          if (!bytes || !audioContext) throw new Error("Background song is unavailable");
          return audioContext.decodeAudioData(bytes.slice(0));
        })
        .then((buffer) => {
          const loop = createCrossfadedLoopBuffer(buffer);
          backgroundMusicBuffer = loop.buffer;
          backgroundMusicLoopStart = loop.loopStart;
          return backgroundMusicBuffer;
        })
        .catch((error) => {
          backgroundMusicBufferPromise = null;
          throw error;
        });
    }
    return backgroundMusicBufferPromise;
  }

  function backgroundMusicLevel() {
    return activeMedia.size ? .5 : .86;
  }

  function updateBackgroundMusicLevel() {
    const target = backgroundMusicLevel();
    if (backgroundMusicGain && audioContext) {
      const parameter = backgroundMusicGain.gain;
      const now = audioContext.currentTime;
      parameter.cancelScheduledValues(now);
      parameter.setTargetAtTime(target, now, activeMedia.size ? .12 : .38);
    }
    if (fallbackBackgroundMusic) fallbackBackgroundMusic.volume = target;
  }

  function startFallbackBackgroundMusic() {
    if (!audioEnabled) return;
    backgroundMusicFallback = true;
    fallbackBackgroundMusic ??= new Audio(backgroundMusicUrl);
    fallbackBackgroundMusic.loop = true;
    fallbackBackgroundMusic.preload = "auto";
    fallbackBackgroundMusic.volume = backgroundMusicLevel();
    try {
      const playback = fallbackBackgroundMusic.play();
      if (playback && typeof playback.then === "function") {
        playback.then(() => {
          if (audioStatus.textContent.startsWith("Background music is starting.")) {
            audioStatus.textContent = "Background music is playing. Voice messages are ready.";
          }
        }).catch(() => {
          audioStatus.textContent = "The background song could not play here, but the voice notes are still ready.";
        });
      }
    } catch {
      audioStatus.textContent = "The background song could not play here, but the voice notes are still ready.";
    }
  }

  function ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      if (!audioContext || audioContext.state === "closed") {
        audioContext = new AudioContextClass();
        audioMixBus = null;
        backgroundMusicGain = null;
        backgroundMusicBuffer = null;
        backgroundMusicBufferPromise = null;
        backgroundMusicSource = null;
        voiceBufferPromises.clear();
        audioContext.addEventListener?.("statechange", () => {
          if (!audioEnabled || audioContext?.state !== "running") return;
          updateBackgroundMusicLevel();
          const directVoiceActive = [...activeMedia].some((media) => media.path === "html");
          if (directVoiceActive) return;
          if (backgroundMusicSource) {
            fallbackBackgroundMusic?.pause();
            backgroundMusicFallback = false;
          } else {
            void startBackgroundMusic();
          }
        });
      }
      if (!audioMixBus) {
        // Music and every voice clip share one persistent output graph.
        audioMixBus = audioContext.createDynamicsCompressor();
        audioMixBus.threshold.value = -3;
        audioMixBus.knee.value = 0;
        audioMixBus.ratio.value = 20;
        audioMixBus.attack.value = 0.002;
        audioMixBus.release.value = 0.14;
        audioMixBus.connect(audioContext.destination);
      }
      return true;
    } catch {
      return false;
    }
  }

  function resumeAudioContext() {
    if (!audioContext) return Promise.resolve(false);
    if (audioContext.state === "running") return Promise.resolve(true);
    if (audioResumePromise) return audioResumePromise;

    // Call resume synchronously, while the tap/click's user activation is live.
    const context = audioContext;
    try {
      audioResumePromise = Promise.resolve(context.resume())
        .then(() => context.state === "running")
        .catch(() => false)
        .finally(() => {
          if (audioContext === context) audioResumePromise = null;
        });
    } catch {
      audioResumePromise = Promise.resolve(false).finally(() => {
        if (audioContext === context) audioResumePromise = null;
      });
    }
    return audioResumePromise;
  }

  function loadVoiceBuffer(url) {
    if (!audioContext) return Promise.reject(new Error("Audio is not ready"));
    if (!voiceBufferPromises.has(url)) {
      const context = audioContext;
      const bufferPromise = fetch(url, { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error("Voice message is unavailable");
          return response.arrayBuffer();
        })
        .then((bytes) => context.decodeAudioData(bytes.slice(0)))
        .catch((error) => {
          voiceBufferPromises.delete(url);
          throw error;
        });
      voiceBufferPromises.set(url, bufferPromise);
    }
    return voiceBufferPromises.get(url);
  }

  function startBackgroundMusic() {
    if (!audioEnabled || backgroundMusicSource) return Promise.resolve();
    if (!audioContext) {
      startFallbackBackgroundMusic();
      return Promise.resolve();
    }
    if (backgroundMusicStartPromise) return backgroundMusicStartPromise;

    const context = audioContext;
    const startPromise = (async () => {
      try {
        const buffer = await loadBackgroundMusic();
        if (!audioEnabled || audioContext !== context || context.state !== "running" || backgroundMusicSource) return;

        if (!backgroundMusicGain) {
          backgroundMusicGain = context.createGain();
          backgroundMusicGain.gain.value = 0;
          backgroundMusicGain.connect(audioMixBus || context.destination);
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = backgroundMusicLoopStart;
        source.loopEnd = buffer.duration;
        source.connect(backgroundMusicGain);
        source.onended = () => {
          source.disconnect();
          if (backgroundMusicSource === source) {
            backgroundMusicSource = null;
            if (audioEnabled && context.state === "running") void startBackgroundMusic();
          }
        };

        const now = context.currentTime;
        source.start(now);
        backgroundMusicSource = source;
        const gain = backgroundMusicGain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0, now);
        gain.linearRampToValueAtTime(backgroundMusicLevel(), now + .8);
        fallbackBackgroundMusic?.pause();
        backgroundMusicFallback = false;
        if (audioStatus.textContent.startsWith("Background music is starting.")) {
          audioStatus.textContent = "Background music is playing. Voice messages are ready.";
        }
      } catch {
        if (audioEnabled && audioContext === context) startFallbackBackgroundMusic();
      }
    })();
    const wrappedPromise = startPromise.finally(() => {
      if (backgroundMusicStartPromise === wrappedPromise) backgroundMusicStartPromise = null;
    });
    backgroundMusicStartPromise = wrappedPromise;
    return wrappedPromise;
  }

  function enableAudio() {
    audioEnabled = true;
    body.dataset.audio = "on";
    audioStatus.textContent = "Background music is starting. Voice messages are ready.";
    if (!ensureAudioContext()) {
      startFallbackBackgroundMusic();
      return;
    }
    void resumeAudioContext().then((running) => {
      if (!audioEnabled) return;
      if (running) void startBackgroundMusic();
      else startFallbackBackgroundMusic();
    });
  }

  function releaseMedia(media) {
    if (!activeMedia.delete(media)) return;
    if (activeVoice === media) activeVoice = null;
    if (startingClip === media) startingClip = null;
    media.source?.disconnect();
    media.voiceGain?.disconnect();
    const remaining = (playingCounts.get(media.owner) || 1) - 1;
    if (remaining > 0) {
      playingCounts.set(media.owner, remaining);
    } else {
      playingCounts.delete(media.owner);
      media.owner?.classList.remove("is-playing");
    }
    updateBackgroundMusicLevel();
    if (!activeMedia.size && audioEnabled && audioContext?.state === "running") {
      if (backgroundMusicSource) {
        fallbackBackgroundMusic?.pause();
        backgroundMusicFallback = false;
      } else if (backgroundMusicFallback) {
        void startBackgroundMusic();
      }
    }
  }

  function confirmClipStarted(media) {
    if (media.started || !activeMedia.has(media)) return;
    media.started = true;
    if (startingClip === media) startingClip = null;
  }

  function failClipPlayback(media, message) {
    if (audioEnabled) audioStatus.textContent = message;
    if (activeMedia.has(media)) {
      releaseMedia(media);
      return;
    }
    if (startingClip === media) {
      startingClip = null;
    }
  }

  function stopActiveVoice() {
    const media = activeVoice;
    if (startingClip?.loading) startingClip = null;
    if (!media) return;

    if (media.audio) {
      media.audio.pause();
      try { media.audio.currentTime = 0; } catch {}
    } else if (media.source) {
      media.source.onended = null;
      try { media.source.stop(); } catch {}
    }
    releaseMedia(media);
  }

  function startHtmlAudioClip(clip, entry, button, clipIndex) {
    const audio = new Audio(clip.src);
    audio.preload = "auto";
    audio.volume = .9;
    const owner = button.closest(".z-entry");
    const media = { audio, owner, path: "html", started: false };
    activeVoice = media;
    activeMedia.add(media);
    startingClip = media;
    updateBackgroundMusicLevel();
    playingCounts.set(owner, (playingCounts.get(owner) || 0) + 1);
    owner.classList.add("is-playing");
    audioStatus.textContent = clip.caption || `${entry.name}: voice note ${clipIndex + 1} of ${entry.clips.length}.`;
    audio.addEventListener("playing", () => confirmClipStarted(media), { once: true });
    audio.addEventListener("ended", () => releaseMedia(media), { once: true });
    audio.addEventListener("error", () => {
      failClipPlayback(media, "That voice note couldn't play. Please try again.");
    }, { once: true });
    try {
      const playback = audio.play();
      if (playback && typeof playback.then === "function") {
        playback.then(() => confirmClipStarted(media)).catch(() => {
          failClipPlayback(media, "The browser could not start that voice message.");
        });
      } else if (!audio.paused) {
        confirmClipStarted(media);
      }
    } catch {
      failClipPlayback(media, "The browser could not start that voice message.");
    }
  }

  async function startClipNow(entry, button) {
    if (!audioEnabled || !entry.clips.length) {
      audioStatus.textContent = !audioEnabled
        ? "Audio is not active."
        : "This message is still waiting for a recording.";
      return;
    }
    const clipIndex = clipIndexes.get(entry.id) || 0;
    const clip = entry.clips[clipIndex % entry.clips.length];
    clipIndexes.set(entry.id, (clipIndex + 1) % entry.clips.length);
    const owner = button.closest(".z-entry");
    if (!ensureAudioContext() || backgroundMusicFallback) {
      startHtmlAudioClip(clip, entry, button, clipIndex);
      return;
    }

    const loading = { owner, loading: true };
    startingClip = loading;
    audioStatus.textContent = "Loading a voice message…";
    let media = null;
    try {
      // This is a tap-triggered call on iOS, so resume is requested before any await.
      const running = await resumeAudioContext();
      if (!running) {
        if (startingClip !== loading) return;
        startFallbackBackgroundMusic();
        startingClip = null;
        startHtmlAudioClip(clip, entry, button, clipIndex);
        return;
      }
      const buffer = await loadVoiceBuffer(clip.src);
      if (startingClip !== loading) return;
      if (!audioEnabled || !button.isConnected) {
        startingClip = null;
        return;
      }

      const context = audioContext;
      const source = context.createBufferSource();
      const voiceGain = context.createGain();
      source.buffer = buffer;
      voiceGain.gain.value = .9;
      source.connect(voiceGain);
      voiceGain.connect(audioMixBus || context.destination);
      media = { source, voiceGain, owner, started: false };
      activeVoice = media;
      activeMedia.add(media);
      startingClip = media;
      updateBackgroundMusicLevel();
      playingCounts.set(owner, (playingCounts.get(owner) || 0) + 1);
      owner.classList.add("is-playing");
      audioStatus.textContent = clip.caption || `${entry.name}: voice note ${clipIndex + 1} of ${entry.clips.length}.`;
      source.onended = () => releaseMedia(media);
      source.start(context.currentTime);
      confirmClipStarted(media);
    } catch {
      if (media) {
        failClipPlayback(media, "That voice note couldn't play. Please try again.");
      } else {
        failClipPlayback(loading, "That voice note couldn't load. Please try again.");
      }
    }
  }

  function playNextClip(entry, button) {
    if (!audioEnabled || !entry.clips.length) {
      audioStatus.textContent = !audioEnabled
        ? "Audio is not active."
        : "This message is still waiting for a recording.";
      return;
    }

    stopActiveVoice();
    startClipNow(entry, button);
  }

  renderEntries();
  document.fonts?.ready?.then(() => layoutEntryStickers());
  setMotion(!reduceMotion.matches);
  reduceMotion.addEventListener?.("change", (event) => setMotion(!event.matches));

  let resizeFrame = 0;
  function scheduleResponsiveLayout() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      layoutGifSky();
      layoutEntryStickers();
    });
  }
  window.addEventListener("resize", scheduleResponsiveLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleResponsiveLayout, { passive: true });
  if ("ResizeObserver" in window) {
    const entryLayoutObserver = new ResizeObserver(scheduleResponsiveLayout);
    entryLayoutObserver.observe(document.getElementById("entryCanvas"));
  }

  const loader = document.getElementById("fakeLoader");
  const enterButton = document.getElementById("enterGalaxy");
  const skipLink = document.querySelector(".z-skip-link");
  let loaderClosing = false;

  function closeLoader() {
    if (loader.hidden || loaderClosing) return;
    loaderClosing = true;
    loader.classList.add("is-closing");
    window.setTimeout(() => {
      loader.hidden = true;
      loader.classList.remove("is-closing");
      loaderClosing = false;
      world.inert = false;
      skipLink.inert = false;
      skipLink.removeAttribute("tabindex");
      document.getElementById("pageTitle").focus({ preventScroll: true });
    }, body.dataset.motion === "on" ? 160 : 0);
  }

  function enterGalaxy() {
    if (loader.hidden || loaderClosing) return;
    enableAudio();
    closeLoader();
  }

  loader.hidden = false;
  world.inert = true;
  skipLink.inert = true;
  enterButton.focus({ preventScroll: true });
  enterButton.addEventListener("click", enterGalaxy);
  window.addEventListener("keydown", (event) => {
    if (loader.hidden || event.key !== "Tab") return;
    event.preventDefault();
    enterButton.focus({ preventScroll: true });
  });

})();
