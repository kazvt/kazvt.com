(() => {
  const body = document.body;
  const html = document.documentElement;
  const world = document.querySelector(".z-viewport");
  const gifSky = document.getElementById("gifSky");
  const audioStatus = document.getElementById("audioStatus");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const CLIP_START_COOLDOWN_MS = 1000;
  const backgroundMusicUrl = "/zoeytest/assets/background/zoey-galaxy-background.mp3";
  const backgroundMusicBytes = fetch(backgroundMusicUrl, { cache: "force-cache" })
    .then((response) => response.ok ? response.arrayBuffer() : null)
    .catch(() => null);

  // Submitted sender artwork and recordings stay local to this site; never synthesize them.
  const entrySlots = [
    {
      id: "kaz",
      name: "Kaz",
      avatar: "/zoeytest/assets/kaz/kaz-avatar.png",
      clips: [
        { src: "/zoeytest/assets/kaz/kaz-voice-1.wav", caption: "Kaz's voice note 1 of 3." },
        { src: "/zoeytest/assets/kaz/kaz-voice-2.wav", caption: "Kaz's voice note 2 of 3." },
        { src: "/zoeytest/assets/kaz/kaz-voice-3.wav", caption: "Kaz's voice note 3 of 3." }
      ]
    },
    {
      id: "abigail",
      name: "Abigail",
      avatar: "/zoeytest/assets/abigail/abigail-avatar.png",
      clips: [
        { src: "/zoeytest/assets/abigail/abigail-voice-1.wav", caption: "Abigail's voice note 1 of 3." },
        { src: "/zoeytest/assets/abigail/abigail-voice-2.wav", caption: "Abigail's voice note 2 of 3." },
        { src: "/zoeytest/assets/abigail/abigail-voice-3.wav", caption: "Abigail's voice note 3 of 3." }
      ]
    },
    {
      id: "letty",
      name: "Letty",
      avatar: "/zoeytest/assets/letty/letty-avatar.png",
      clips: [
        { src: "/zoeytest/assets/letty/letty-voice-1.wav", caption: "Letty's voice note 1 of 2." },
        { src: "/zoeytest/assets/letty/letty-voice-2.wav", caption: "Letty's voice note 2 of 2." }
      ]
    },
    {
      id: "traaansfem",
      name: "TraaansFem",
      avatar: "/zoeytest/assets/traaansfem/traaansfem-avatar.png",
      clips: [
        { src: "/zoeytest/assets/traaansfem/traaansfem-voice-1.wav", caption: "TraaansFem's voice note 1 of 2." },
        { src: "/zoeytest/assets/traaansfem/traaansfem-voice-2.wav", caption: "TraaansFem's voice note 2 of 2." }
      ]
    },
    ...Array.from({ length: 5 }, (_, index) => {
      const number = index + 3;
      return {
        id: `star-${String(number).padStart(2, "0")}`,
        name: `FRIEND ${String(number).padStart(2, "0")}`,
        avatar: "",
        clips: []
      };
    }),
    {
      id: "frosty",
      name: "Frosty",
      avatar: "",
      clips: [
        { src: "/zoeytest/assets/frosty/frosty-voice-1.wav", caption: "Frosty's voice note 1 of 3." },
        { src: "/zoeytest/assets/frosty/frosty-voice-2.wav", caption: "Frosty's voice note 2 of 3." },
        { src: "/zoeytest/assets/frosty/frosty-voice-3.wav", caption: "Frosty's voice note 3 of 3." }
      ]
    }
  ];

  let audioEnabled = false;
  let audioContext = null;
  let audioMixBus = null;
  let backgroundMusicGain = null;
  let backgroundMusicBuffer = null;
  let backgroundMusicBufferPromise = null;
  let backgroundMusicLoopStart = 0;
  let backgroundMusicSource = null;
  let fallbackBackgroundMusic = null;
  let lastClipStartedAt = -Infinity;
  let pendingClipRequest = null;
  let pendingClipTimer = 0;
  let startingClip = null;
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
      // Three broad columns and four loose rows give portrait screens room for larger art.
      portrait: [
        [2, 3, 28, 20], [36, 4.5, 28, 20], [70, 3.5, 28, 20],
        [5, 27, 28, 20], [36, 28.5, 28, 20], [67, 26.5, 28, 20],
        [18, 51, 28, 20], [54, 52.5, 28, 20],
        [5, 77, 28, 20], [67, 76, 28, 20]
      ],
      // Four compact, staggered rows use taller stickers without card collisions.
      wide: [
        [3, 3, 28, 20], [36, 4.5, 28, 20], [69, 2.5, 28, 20],
        [5, 28, 28, 20], [36, 29.5, 28, 20], [67, 27, 28, 20],
        [3, 53, 28, 20], [36, 54.5, 28, 20],
        [20, 78, 28, 20], [52, 77, 28, 20]
      ],
      // Two loose five-sticker rows give the character art substantially more height.
      panorama: [
        [2.5, 4, 16, 40], [21, 5.5, 16, 40], [39.5, 2.5, 16, 40], [58, 6, 16, 40], [76.5, 3.5, 16, 40],
        [7, 54, 16, 40], [26, 55.5, 16, 40], [45, 52.5, 16, 40], [64, 56, 16, 40], [81, 53.5, 16, 40]
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
    catalogPromise = fetch("/zoeytest/gif-manifest.json?v=20261105-06", { cache: "force-cache" })
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
          image.dataset.src = "/zoeytest/assets/gifs/" + entry.file;
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
    fallbackBackgroundMusic ??= new Audio(backgroundMusicUrl);
    fallbackBackgroundMusic.loop = true;
    fallbackBackgroundMusic.preload = "auto";
    fallbackBackgroundMusic.volume = backgroundMusicLevel();
    fallbackBackgroundMusic.play().then(() => {
      if (audioStatus.textContent.startsWith("Background music is starting.")) {
        audioStatus.textContent = "Background music is playing. Voice messages are ready.";
      }
    }).catch(() => {
      audioStatus.textContent = "The background song could not play here, but the voice notes are still ready.";
    });
  }

  async function startBackgroundMusic() {
    if (!audioEnabled || backgroundMusicSource) return;
    if (!audioContext) {
      startFallbackBackgroundMusic();
      return;
    }

    try {
      const buffer = await loadBackgroundMusic();
      if (!audioEnabled || !audioContext) return;

      backgroundMusicGain ??= audioContext.createGain();
      backgroundMusicGain.gain.value = 0;
      backgroundMusicGain.connect(audioMixBus || audioContext.destination);

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = backgroundMusicLoopStart;
      source.loopEnd = buffer.duration;
      source.connect(backgroundMusicGain);
      source.onended = () => {
        source.disconnect();
        if (backgroundMusicSource === source) backgroundMusicSource = null;
      };

      const now = audioContext.currentTime;
      source.start(now);
      backgroundMusicSource = source;
      const gain = backgroundMusicGain.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(0, now);
      gain.linearRampToValueAtTime(backgroundMusicLevel(), now + .8);
      fallbackBackgroundMusic?.pause();
      if (audioStatus.textContent.startsWith("Background music is starting.")) {
        audioStatus.textContent = "Background music is playing. Voice messages are ready.";
      }
    } catch {
      if (audioEnabled) startFallbackBackgroundMusic();
    }
  }

  function enableAudio() {
    audioEnabled = true;
    let contextReady = false;
    if (window.AudioContext || window.webkitAudioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      try {
        audioContext ??= new AudioContextClass();
        if (!audioMixBus) {
          // Voice notes can overlap; catch only stacked peaks on the shared output.
          audioMixBus = audioContext.createDynamicsCompressor();
          audioMixBus.threshold.value = -3;
          audioMixBus.knee.value = 0;
          audioMixBus.ratio.value = 20;
          audioMixBus.attack.value = 0.002;
          audioMixBus.release.value = 0.14;
          audioMixBus.connect(audioContext.destination);
        }
        contextReady = true;
        const resumed = audioContext.state === "running" ? Promise.resolve() : audioContext.resume();
        resumed.then(() => {
          if (audioEnabled) void startBackgroundMusic();
        }).catch(() => {
          if (audioEnabled) startFallbackBackgroundMusic();
        });
      } catch { contextReady = false; }
    }
    if (!contextReady) startFallbackBackgroundMusic();
    body.dataset.audio = "on";
    audioStatus.textContent = "Background music is starting. Voice messages are ready.";
  }

  function releaseMedia(media) {
    if (!activeMedia.delete(media)) return;
    if (startingClip === media) {
      startingClip = null;
      schedulePendingClip();
    }
    media.source?.disconnect();
    const remaining = (playingCounts.get(media.owner) || 1) - 1;
    if (remaining > 0) {
      playingCounts.set(media.owner, remaining);
    } else {
      playingCounts.delete(media.owner);
      media.owner?.classList.remove("is-playing");
    }
    updateBackgroundMusicLevel();
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
    if (startingClip || !pendingClipRequest) return;
    const remaining = lastClipStartedAt + CLIP_START_COOLDOWN_MS - performance.now();
    if (remaining > 0) {
      schedulePendingClip();
      return;
    }

    const request = pendingClipRequest;
    pendingClipRequest = null;
    if (!pendingClipIsStillActive(request)) return;
    startClipNow(request.entry, request.button);
  }

  function schedulePendingClip() {
    if (!pendingClipRequest || startingClip || pendingClipTimer) return;
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
    if (!activeMedia.has(media)) return;
    if (audioEnabled) audioStatus.textContent = message;
    releaseMedia(media);
  }

  function startClipNow(entry, button) {
    if (startingClip) return;
    if (!audioEnabled || !entry.clips.length) {
      audioStatus.textContent = !audioEnabled
        ? "Audio is not active."
        : "This message is still waiting for a recording.";
      return;
    }
    const clipIndex = clipIndexes.get(entry.id) || 0;
    const clip = entry.clips[clipIndex % entry.clips.length];
    clipIndexes.set(entry.id, (clipIndex + 1) % entry.clips.length);

    const audio = new Audio(clip.src);
    audio.preload = "auto";
    audio.volume = .9;
    let source = null;
    if (audioContext && audioContext.state === "running") {
      try {
        source = audioContext.createMediaElementSource(audio);
        source.connect(audioMixBus || audioContext.destination);
      } catch {}
    }
    const owner = button.closest(".z-entry");
    const media = { audio, owner, source, started: false };
    activeMedia.add(media);
    startingClip = media;
    updateBackgroundMusicLevel();
    playingCounts.set(owner, (playingCounts.get(owner) || 0) + 1);
    owner.classList.add("is-playing");
    audioStatus.textContent = clip.caption || `${entry.name}: voice note ${clipIndex + 1} of ${entry.clips.length}.`;
    audio.addEventListener("playing", () => confirmClipStarted(media), { once: true });
    audio.addEventListener("ended", () => {
      releaseMedia(media);
    }, { once: true });
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

    if (startingClip || lastClipStartedAt + CLIP_START_COOLDOWN_MS > now) {
      pendingClipRequest = { entry, button, trigger };
      schedulePendingClip();
      return;
    }

    clearPendingClipTimer();
    pendingClipRequest = null;
    startClipNow(entry, button);
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
