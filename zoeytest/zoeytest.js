(() => {
  const body = document.body;
  const html = document.documentElement;
  const world = document.querySelector(".z-viewport");
  const gifSky = document.getElementById("gifSky");
  const audioButton = document.getElementById("audioToggle");
  const audioStatus = document.getElementById("audioStatus");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
    ...Array.from({ length: 6 }, (_, index) => {
      const number = index + 3;
      return {
        id: `star-${String(number).padStart(2, "0")}`,
        name: `FRIEND ${String(number).padStart(2, "0")}`,
        avatar: "",
        clips: []
      };
    })
  ];

  let audioEnabled = false;
  let audioContext = null;
  let audioMixBus = null;
  const activeMedia = new Set();
  const playingCounts = new Map();
  let gifEntries = null;
  let gifImages = [];
  let catalogPromise = null;
  const clipIndexes = new Map();
  const lastTriggers = new WeakMap();

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
      button.setAttribute("aria-label", `${entry.name}. ${entry.clips.length ? "Hover, focus, or tap to hear a voice note." : "Their voice note is still waiting."}`);

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

    // Hand-placed percentage anchors create a responsive sticker collage, not a card grid.
    const panorama = width >= 280 && height < 360 && width / height >= 1.4;
    const portrait = !panorama && (width < 760 || width / height < 1.25);
    const layouts = {
      panorama: [
        [3, 8, 22, 42], [27, 11, 22, 40], [51, 8, 22, 42], [76, 9, 20, 40],
        [8, 50, 22, 36], [32, 53, 22, 34], [57, 50, 22, 36], [80, 53, 17, 34]
      ],
      compactPortrait: [
        [2, 6, 46, 20], [52, 7, 46, 20], [6, 28, 45, 20], [53, 30, 45, 20],
        [2, 50, 46, 20], [52, 52, 46, 20], [6, 73, 45, 19], [53, 74, 45, 19]
      ],
      portrait: [
        [2, 7, 46, 20], [52, 8, 46, 20], [6, 29, 45, 20], [53, 31, 45, 20],
        [2, 51, 46, 20], [52, 53, 46, 20], [6, 73, 45, 19], [53, 74, 45, 19]
      ],
      wide: [
        [2, 8, 29, 26], [35, 6, 29, 26], [69, 10, 29, 26],
        [7, 38, 27, 27], [37, 35, 29, 27], [72, 41, 24, 26],
        [19, 66, 27, 24], [55, 68, 29, 23]
      ]
    };
    const layoutName = panorama ? "panorama" : portrait ? "portrait" : "wide";
    const isCompactPortrait = !panorama && portrait && height < 360;
    const positions = isCompactPortrait ? layouts.compactPortrait : layouts[layoutName];
    const tiltRange = height < 140 ? 0 : height < 360 ? 3 : 5;
    const riseRange = height < 140 ? 0 : height < 360 ? 4 : 8;
    canvas.querySelectorAll(".z-entry").forEach((card, index) => {
      const [x, y, cardWidth, cardHeight] = positions[index] || positions[positions.length - 1];
      card.style.setProperty("--entry-x", `${x}%`);
      card.style.setProperty("--entry-y", `${y}%`);
      card.style.setProperty("--entry-width", `${cardWidth}%`);
      card.style.setProperty("--entry-height", `${cardHeight}%`);
      card.style.setProperty("--entry-tilt", `${((seeded(index, 11) - .5) * tiltRange).toFixed(2)}deg`);
      card.style.setProperty("--entry-rise", `${((seeded(index, 12) - .5) * riseRange).toFixed(1)}px`);
    });
    canvas.dataset.layout = isCompactPortrait ? "compact-portrait" : layoutName;
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
    catalogPromise = fetch("/zoeytest/gif-manifest.json", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("GIF list unavailable");
        return response.json();
      })
      .then((entries) => {
        if (!Array.isArray(entries) || entries.length !== 100) throw new Error("Unexpected GIF list");
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

  function updateAudioControl() {
    body.dataset.audio = audioEnabled ? "on" : "off";
    audioButton.setAttribute("aria-pressed", String(audioEnabled));
    audioButton.textContent = audioEnabled ? "SOUND ON" : "SOUND OFF";
    audioButton.setAttribute("aria-label", audioEnabled ? "Mute all voice notes" : "Enable voice notes");
  }

  function enableAudio() {
    audioEnabled = true;
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
        if (audioContext.state !== "running") void audioContext.resume().catch(() => {});
      } catch {}
    }
    updateAudioControl();
    audioStatus.textContent = "Sound is ready. Hover, focus, or tap a friend's star.";
  }

  function releaseMedia(media) {
    if (!activeMedia.delete(media)) return;
    media.source?.disconnect();
    const remaining = (playingCounts.get(media.owner) || 1) - 1;
    if (remaining > 0) {
      playingCounts.set(media.owner, remaining);
    } else {
      playingCounts.delete(media.owner);
      media.owner?.classList.remove("is-playing");
    }
  }

  function stopActiveAudio() {
    for (const media of [...activeMedia]) {
      media.audio.pause();
      media.audio.currentTime = 0;
      releaseMedia(media);
    }
  }

  function playNextClip(entry, button) {
    if (!audioEnabled || !entry.clips.length) {
      audioStatus.textContent = !audioEnabled
        ? "Tap SOUND OFF once to enable voice notes."
        : "This star is waiting for its real voice recording.";
      return;
    }
    const last = lastTriggers.get(button) || 0;
    const now = performance.now();
    if (now - last < 280) return;
    lastTriggers.set(button, now);
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
    const media = { audio, owner, source };
    activeMedia.add(media);
    playingCounts.set(owner, (playingCounts.get(owner) || 0) + 1);
    owner.classList.add("is-playing");
    audioStatus.textContent = clip.caption || `${entry.name}: voice note ${clipIndex + 1} of ${entry.clips.length}.`;
    audio.addEventListener("ended", () => {
      releaseMedia(media);
    }, { once: true });
    audio.addEventListener("error", () => {
      releaseMedia(media);
      audioStatus.textContent = "That voice note couldn't play. Please try again.";
    }, { once: true });
    audio.play().catch(() => {
      releaseMedia(media);
      audioStatus.textContent = "Tap SOUND OFF once to let the browser play voice notes.";
    });
  }

  renderEntries();
  setMotion(!reduceMotion.matches);
  audioButton.addEventListener("click", () => {
    if (audioEnabled) {
      audioEnabled = false;
      stopActiveAudio();
      updateAudioControl();
      audioStatus.textContent = "Voice notes are muted.";
    } else {
      enableAudio();
    }
  });
  reduceMotion.addEventListener?.("change", (event) => setMotion(!event.matches));

  document.getElementById("entryCanvas").addEventListener("pointerover", (event) => {
    const button = event.target.closest(".z-entry-button");
    if (!button || event.pointerType === "touch") return;
    const previous = event.relatedTarget;
    if (previous && button.contains(previous)) return;
    const entry = entrySlots.find((item) => item.id === button.dataset.entryId);
    if (entry) playNextClip(entry, button);
  });
  document.getElementById("entryCanvas").addEventListener("focusin", (event) => {
    const button = event.target.closest(".z-entry-button");
    if (!button) return;
    const entry = entrySlots.find((item) => item.id === button.dataset.entryId);
    if (entry) playNextClip(entry, button);
  });
  document.getElementById("entryCanvas").addEventListener("click", (event) => {
    const button = event.target.closest(".z-entry-button");
    if (!button) return;
    if (!audioEnabled) enableAudio();
    const entry = entrySlots.find((item) => item.id === button.dataset.entryId);
    if (entry) playNextClip(entry, button);
  });

  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      layoutGifSky();
      layoutEntryStickers();
    });
  }, { passive: true });

  const loader = document.getElementById("fakeLoader");
  const enterButton = document.getElementById("enterGalaxy");
  const skipLink = document.querySelector(".z-skip-link");
  const loaderFill = document.getElementById("loaderFill");
  const loaderBar = document.getElementById("loaderProgress");
  const loaderPercent = document.getElementById("loaderPercent");
  const loaderStatus = document.getElementById("loaderStatus");
  const loaderLines = [
    [0, "Initializing the imaginary modem."],
    [28, "Dialing Zoey's little galaxy."],
    [66, "Synchronizing the love notes."],
    [100, "Connection ready. Click to enter with sound on."]
  ];
  let loaderFrame = 0;
  let loaderStarted = 0;
  let loaderClosing = false;
  const loadDuration = 1400;

  function closeLoader() {
    if (loader.hidden || loaderClosing) return;
    loaderClosing = true;
    cancelAnimationFrame(loaderFrame);
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

  function finishFakeLoading() {
    loaderFill.style.width = "100%";
    loaderBar.setAttribute("aria-valuenow", "100");
    loaderPercent.textContent = "100%";
    loaderStatus.textContent = loaderLines[loaderLines.length - 1][1];
  }

  function animateLoader(now) {
    const progress = Math.min(100, Math.round(((now - loaderStarted) / loadDuration) * 100));
    loaderFill.style.width = `${progress}%`;
    loaderBar.setAttribute("aria-valuenow", String(progress));
    loaderPercent.textContent = `${String(progress).padStart(2, "0")}%`;
    const current = [...loaderLines].reverse().find(([at]) => progress >= at);
    if (current) loaderStatus.textContent = current[1];
    if (progress < 100) loaderFrame = requestAnimationFrame(animateLoader);
  }

  function enterGalaxy() {
    if (loader.hidden || loaderClosing) return;
    enableAudio();
    loaderStatus.textContent = "Sound is on. Welcome to the galaxy!";
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

  if (body.dataset.motion === "on") {
    loaderStarted = performance.now();
    loaderFrame = requestAnimationFrame(animateLoader);
  } else {
    finishFakeLoading();
  }
})();
