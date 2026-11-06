(() => {
  const body = document.body;
  const html = document.documentElement;
  const world = document.querySelector(".z-viewport");
  const gifSky = document.getElementById("gifSky");
  const audioStatus = document.getElementById("audioStatus");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const CLIP_START_COOLDOWN_MS = 1000;
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
    ...Array.from({ length: 5 }, (_, index) => {
      const number = index + 3;
      return {
        id: `star-${String(number).padStart(2, "0")}`,
        name: "PLACEHOLDER",
        avatar: "",
        clips: []
      };
    }),
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
        { src: "/zoey/assets/nea-pollen/nea-pollen-voice-1.wav", caption: "Nea's voice note 1 of 3." },
        { src: "/zoey/assets/nea-pollen/nea-pollen-voice-2.wav", caption: "Nea's voice note 2 of 3." },
        { src: "/zoey/assets/nea-pollen/nea-pollen-voice-3.wav", caption: "Nea's voice note 3 of 3." }
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
        { src: "/zoey/assets/serunie/serunie-voice-1.wav", caption: "Serunie's voice note 1 of 3." },
        { src: "/zoey/assets/serunie/serunie-voice-2.wav", caption: "Serunie's voice note 2 of 3." },
        { src: "/zoey/assets/serunie/serunie-voice-3.wav", caption: "Serunie's voice note 3 of 3." }
      ]
    }
  ];

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
  let lastClipStartedAt = -Infinity;
  let pendingClipRequest = null;
  let pendingClipTimer = 0;
  let startingClip = null;
  let activeVoice = null;
  const activeMedia = new Set();
  const playingCounts = new Map();
  let gifEntries = null;
  let gifImages = [];
  let catalogPromise = null;
  const clipIndexes = new Map();
  const lastNonHoverTriggers = new WeakMap();

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
      if ("PointerEvent" in window) {
        button.addEventListener("pointerenter", (event) => {
          if (event.pointerType === "touch") return;
          playNextClip(entry, button, "hover");
        });
      } else {
        button.addEventListener("mouseenter", () => playNextClip(entry, button, "hover"));
      }
      button.addEventListener("focus", () => playNextClip(entry, button, "focus"));
      button.addEventListener("click", () => {
        if (!audioEnabled) enableAudio();
        playNextClip(entry, button, "click");
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
      button.append(avatar, name);
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
      // Three broad columns and five staggered rows keep all fourteen stickers visible.
      portrait: [
        [2, 1.5, 28, 17.5], [36, 2.5, 28, 17.5], [70, 1, 28, 17.5],
        [3, 21, 28, 17.5], [36, 22, 28, 17.5], [69, 20.5, 28, 17.5],
        [19, 40.5, 28, 17.5], [53, 41.5, 28, 17.5],
        [2, 60, 28, 17.5], [36, 61, 28, 17.5], [70, 59.5, 28, 17.5],
        [3, 79.5, 28, 17.5], [36, 80.5, 28, 17.5], [69, 79, 28, 17.5]
      ],
      // A centered two-sticker row breaks up the 3/3/2/3/3 scatter on wide screens.
      wide: [
        [3, 1.5, 28, 17], [36, 2.5, 28, 17], [69, 1, 28, 17],
        [4, 21, 28, 17], [36, 22, 28, 17], [68, 20.5, 28, 17],
        [19, 40.5, 28, 17], [53, 41.5, 28, 17],
        [2, 60, 28, 17], [36, 61, 28, 17], [70, 59.5, 28, 17],
        [3, 79.5, 28, 17], [36, 80.5, 28, 17], [69, 79, 28, 17]
      ],
      // Two rows of five and a centered row of four preserve larger art on panoramas.
      panorama: [
        [1, 1.5, 18, 28], [21, 2.5, 18, 28], [41, 1, 18, 28], [61, 2.5, 18, 28], [81, 1.5, 18, 28],
        [2, 36, 18, 28], [22, 37, 18, 28], [42, 35.5, 18, 28], [62, 37, 18, 28], [82, 36, 18, 28],
        [10, 69, 18, 28], [32, 70, 18, 28], [54, 68.5, 18, 28], [76, 70, 18, 28]
      ]
    };
    const positions = layouts[layoutName];
    const tiltRange = height < 140 ? 0
      : height < 180 ? Math.min(3, 1500 / width)
        : height < 360 ? Math.min(3, 10 / aspectRatio)
          : Math.min(5, 10 / aspectRatio);
    const riseRange = height < 180 ? 0 : 2;
    const cards = [...canvas.querySelectorAll(".z-entry")];

    // CSS transforms do not participate in layout flow, so test their painted bounds.
    // The extra inset reserves room for the hover-scale effect; ordinary sizes retain tilt.
    function getBounds(cardScale, motionScale) {
      return cards.map((_, index) => {
        const [xPct, yPct, widthPct, heightPct] = positions[index];
        const scaledWidthPct = widthPct * cardScale;
        const scaledHeightPct = heightPct * cardScale;
        const x = (xPct + (widthPct - scaledWidthPct) / 2) * width / 100;
        const y = (yPct + (heightPct - scaledHeightPct) / 2) * height / 100;
        const cardWidth = scaledWidthPct * width / 100;
        const cardHeight = scaledHeightPct * height / 100;
        const angle = (seeded(index, 11) - .5) * tiltRange * motionScale * Math.PI / 180;
        const rise = (seeded(index, 12) - .5) * riseRange * motionScale;
        const boundsWidth = Math.abs(cardWidth * Math.cos(angle)) + Math.abs(cardHeight * Math.sin(angle));
        const boundsHeight = Math.abs(cardHeight * Math.cos(angle)) + Math.abs(cardWidth * Math.sin(angle));
        const centerX = x + cardWidth / 2 - Math.sin(angle) * rise;
        const centerY = y + cardHeight / 2 + Math.cos(angle) * rise;
        const hoverPadX = compactViewport ? 0 : cardWidth * .0225;
        const hoverPadY = compactViewport ? 0 : cardHeight * .0225 + 2;
        return {
          left: centerX - boundsWidth / 2 - hoverPadX,
          right: centerX + boundsWidth / 2 + hoverPadX,
          top: centerY - boundsHeight / 2 - hoverPadY,
          bottom: centerY + boundsHeight / 2 + hoverPadY
        };
      });
    }

    function hasSafeSpacing(bounds) {
      const edge = Math.min(3, Math.min(width, height) * .01);
      const gap = Math.min(2, Math.min(width, height) * .004);
      return bounds.every((box, index) => {
        if (box.left < edge || box.top < edge || box.right > width - edge || box.bottom > height - edge) return false;
        return bounds.slice(0, index).every((other) =>
          box.left >= other.right + gap || box.right <= other.left - gap ||
          box.top >= other.bottom + gap || box.bottom <= other.top - gap
        );
      });
    }

    let cardScale = 1;
    let motionScale = 1;
    if (!hasSafeSpacing(getBounds(cardScale, motionScale))) motionScale = 0;
    if (!hasSafeSpacing(getBounds(cardScale, motionScale))) {
      for (let candidate = .96; candidate >= .64; candidate -= .04) {
        if (hasSafeSpacing(getBounds(candidate, motionScale))) {
          cardScale = candidate;
          break;
        }
      }
    }
    if (!hasSafeSpacing(getBounds(cardScale, motionScale))) {
      cardScale = .64;
      motionScale = 0;
    }

    cards.forEach((card, index) => {
      const [x, y, cardWidth, cardHeight] = positions[index];
      const fittedWidth = cardWidth * cardScale;
      const fittedHeight = cardHeight * cardScale;
      card.style.setProperty("--entry-x", `${(x + (cardWidth - fittedWidth) / 2).toFixed(3)}%`);
      card.style.setProperty("--entry-y", `${(y + (cardHeight - fittedHeight) / 2).toFixed(3)}%`);
      card.style.setProperty("--entry-width", `${fittedWidth.toFixed(3)}%`);
      card.style.setProperty("--entry-height", `${fittedHeight.toFixed(3)}%`);
      card.style.setProperty("--entry-tilt", `${((seeded(index, 11) - .5) * tiltRange * motionScale).toFixed(2)}deg`);
      card.style.setProperty("--entry-rise", `${((seeded(index, 12) - .5) * riseRange * motionScale).toFixed(1)}px`);
    });
    // Placeholder stars used to have a 38px minimum and could spill out of
    // their sticker, overlapping nearby real avatars despite safe card bounds.
    cards.forEach((card) => {
      const avatar = card.querySelector(".z-entry-avatar");
      const star = card.querySelector(".z-avatar-star");
      if (!avatar || !star) return;
      const starSize = Math.min(84, avatar.clientWidth * .22, avatar.clientHeight * .52);
      star.style.setProperty("--entry-star-size", `${Math.max(0, starSize).toFixed(2)}px`);
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
    // A queued voice may start only after the current voice has actually ended.
    schedulePendingClip();
  }

  function clearPendingClipTimer() {
    if (!pendingClipTimer) return;
    window.clearTimeout(pendingClipTimer);
    pendingClipTimer = 0;
  }

  function pendingClipIsStillActive(request) {
    if (!request.button.isConnected) return false;
    if (request.trigger === "hover") return request.button.matches(":hover");
    if (request.trigger === "focus") return document.activeElement === request.button;
    return true;
  }

  function runPendingClip() {
    if (activeVoice || startingClip || !pendingClipRequest) return;
    const remaining = lastClipStartedAt + CLIP_START_COOLDOWN_MS - performance.now();
    if (remaining > 0) {
      schedulePendingClip();
      return;
    }

    const request = pendingClipRequest;
    pendingClipRequest = null;
    if (!pendingClipIsStillActive(request)) return;
    startClipNow(request.entry, request.button, request.trigger);
  }

  function schedulePendingClip() {
    if (!pendingClipRequest || activeVoice || startingClip || pendingClipTimer) return;
    const remaining = lastClipStartedAt + CLIP_START_COOLDOWN_MS - performance.now();
    if (remaining <= 0) {
      runPendingClip();
      return;
    }
    pendingClipTimer = window.setTimeout(() => {
      pendingClipTimer = 0;
      runPendingClip();
    }, remaining);
  }

  function confirmClipStarted(media) {
    if (media.started || !activeMedia.has(media)) return;
    media.started = true;
    if (startingClip === media) startingClip = null;
    lastClipStartedAt = performance.now();
    schedulePendingClip();
  }

  function failClipPlayback(media, message) {
    if (audioEnabled) audioStatus.textContent = message;
    if (activeMedia.has(media)) {
      releaseMedia(media);
      return;
    }
    if (startingClip === media) {
      startingClip = null;
      schedulePendingClip();
    }
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

  async function startClipNow(entry, button, trigger = "click") {
    if (activeVoice || startingClip) return;
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
    const request = { entry, button, trigger };
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
      if (!audioEnabled || !pendingClipIsStillActive(request)) {
        startingClip = null;
        schedulePendingClip();
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

  function playNextClip(entry, button, trigger) {
    if (!audioEnabled || !entry.clips.length) {
      audioStatus.textContent = !audioEnabled
        ? "Audio is not active."
        : "This message is still waiting for a recording.";
      return;
    }

    const now = performance.now();
    if (trigger !== "hover") {
      const last = lastNonHoverTriggers.get(button);
      if (last !== undefined && now - last < 280) {
        if (trigger === "click" && pendingClipRequest?.button === button) {
          pendingClipRequest.trigger = "click";
        }
        return;
      }
      lastNonHoverTriggers.set(button, now);
    }

    if (activeVoice || startingClip || lastClipStartedAt + CLIP_START_COOLDOWN_MS > now) {
      pendingClipRequest = { entry, button, trigger };
      schedulePendingClip();
      return;
    }

    clearPendingClipTimer();
    pendingClipRequest = null;
    startClipNow(entry, button, trigger);
  }

  renderEntries();
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
