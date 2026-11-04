(() => {
  const body = document.body;
  const html = document.documentElement;
  const world = document.querySelector(".z-viewport");
  const gifSky = document.getElementById("gifSky");
  const audioButton = document.getElementById("audioToggle");
  const audioStatus = document.getElementById("audioStatus");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Real sender names, artwork, and voice files belong here once the people submit them.
  // Never substitute generated portraits or synthesized voices for those contributions.
  const entrySlots = Array.from({ length: 8 }, (_, index) => ({
    id: `star-${String(index + 1).padStart(2, "0")}`,
    name: `FRIEND ${String(index + 1).padStart(2, "0")}`,
    note: "A little voice from your orbit",
    avatar: "",
    clips: []
  }));

  let audioEnabled = false;
  let audioContext = null;
  let activeMedia = null;
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
    entrySlots.forEach((entry, index) => {
      const card = document.createElement("article");
      card.className = "z-entry";
      card.setAttribute("role", "listitem");
      card.style.setProperty("--entry-tilt", `${(seeded(index, 11) - .5) * 1.2}deg`);
      card.style.setProperty("--entry-rise", `${Math.round((seeded(index, 12) - .5) * 4)}px`);

      const button = document.createElement("button");
      button.className = "z-entry-button";
      button.type = "button";
      button.dataset.entryId = entry.id;
      button.setAttribute("aria-label", `${entry.name}. ${entry.clips.length ? "Hover, focus, or tap to hear a voice note." : "Voice recordings have not been added yet."}`);

      const avatar = document.createElement("span");
      avatar.className = "z-entry-avatar";
      avatar.setAttribute("aria-hidden", "true");
      if (entry.avatar) {
        const image = document.createElement("img");
        image.src = entry.avatar;
        image.alt = "";
        image.loading = "lazy";
        avatar.append(image);
      } else {
        const star = document.createElement("span");
        star.className = "z-avatar-star";
        star.textContent = "*";
        avatar.append(star);
      }

      const copy = document.createElement("span");
      copy.className = "z-entry-copy";
      const id = document.createElement("span");
      id.className = "z-entry-id";
      id.textContent = `STAR-MAIL // ${String(index + 1).padStart(2, "0")}`;
      const name = document.createElement("span");
      name.className = "z-entry-name";
      name.textContent = entry.name;
      const note = document.createElement("span");
      note.className = "z-entry-note";
      note.textContent = entry.note;
      const state = document.createElement("span");
      state.className = "z-entry-state";
      state.textContent = entry.clips.length ? "PLAY A LITTLE LOVE NOTE" : "VOICE NOTE WAITING";
      copy.append(id, name, note, state);

      const play = document.createElement("span");
      play.className = "z-entry-play";
      play.setAttribute("aria-hidden", "true");
      play.textContent = entry.clips.length ? ">>" : "*";
      button.append(avatar, copy, play);
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

    // Stable, art-directed anchors make a loose collage without letting stickers collide.
    const panorama = width >= 900 && height < 360 && width / height >= 1.4;
    const portrait = !panorama && (width < 760 || width / height < 1.25);
    const layouts = {
      panorama: [
        [1, 2, 23, 45], [25, 7, 22, 43], [50, 0, 22, 46], [76, 5, 22, 44],
        [2, 53, 22, 43], [27, 53, 22, 43], [52, 55, 21, 42], [77, 53, 21, 44]
      ],
      portrait: [
        [2, 1, 45, 21], [52, 4, 46, 20], [8, 26, 41, 22], [53, 27, 44, 21],
        [1, 51, 47, 20], [54, 51, 44, 22], [7, 76, 43, 21], [53, 76, 45, 21]
      ],
      wide: [
        [2, 3, 29, 26], [35, 0, 29, 28], [68, 7, 29, 26],
        [9, 36, 27, 28], [40, 36, 30, 28], [74, 39, 23, 26],
        [2, 72, 29, 25], [37, 70, 29, 27]
      ]
    };
    const layoutName = panorama ? "panorama" : portrait ? "portrait" : "wide";
    const positions = layouts[layoutName];
    canvas.querySelectorAll(".z-entry").forEach((card, index) => {
      const [x, y, cardWidth, cardHeight] = positions[index] || positions[positions.length - 1];
      card.style.setProperty("--entry-x", `${x}%`);
      card.style.setProperty("--entry-y", `${y}%`);
      card.style.setProperty("--entry-width", `${cardWidth}%`);
      card.style.setProperty("--entry-height", `${cardHeight}%`);
    });
    canvas.dataset.layout = layoutName;
    canvas.dataset.density = height < 290 ? "packed" : height < 430 || width < 520 ? "tight" : "normal";
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
      audioContext ??= new AudioContextClass();
      if (audioContext.state !== "running") void audioContext.resume().catch(() => {});
    }
    updateAudioControl();
    audioStatus.textContent = "Sound is ready. Hover, focus, or tap a friend's star.";
  }

  function stopActiveAudio() {
    if (!activeMedia) return;
    const owner = activeMedia.owner;
    activeMedia.audio.pause();
    activeMedia.audio.currentTime = 0;
    activeMedia.source?.disconnect();
    owner?.classList.remove("is-playing");
    activeMedia = null;
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

    stopActiveAudio();
    const audio = new Audio(clip.src);
    audio.preload = "auto";
    audio.volume = .9;
    let source = null;
    if (audioContext && audioContext.state === "running") {
      try {
        source = audioContext.createMediaElementSource(audio);
        source.connect(audioContext.destination);
      } catch {}
    }
    const owner = button.closest(".z-entry");
    activeMedia = { audio, owner, source };
    owner.classList.add("is-playing");
    audioStatus.textContent = clip.caption || `${entry.name}: voice note ${clipIndex + 1} of ${entry.clips.length}.`;
    audio.addEventListener("ended", () => {
      source?.disconnect();
      owner.classList.remove("is-playing");
      if (activeMedia?.audio === audio) activeMedia = null;
    }, { once: true });
    audio.addEventListener("error", () => {
      source?.disconnect();
      owner.classList.remove("is-playing");
      if (activeMedia?.audio === audio) activeMedia = null;
      audioStatus.textContent = "That voice note couldn't play. Please try again.";
    }, { once: true });
    audio.play().catch(() => {
      owner.classList.remove("is-playing");
      if (activeMedia?.audio === audio) activeMedia = null;
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
  const skip = document.getElementById("skipLoader");
  const loaderFill = document.getElementById("loaderFill");
  const loaderBar = document.getElementById("loaderProgress");
  const loaderPercent = document.getElementById("loaderPercent");
  const loaderStatus = document.getElementById("loaderStatus");
  const loaderLines = [
    [0, "Finding the friend-shaped constellations."],
    [32, "Tuning the tiny love-radio."],
    [68, "Polishing a few pixel hearts."],
    [100, "Ready when you are."]
  ];
  let loaderFrame = 0;
  let loaderTimer = 0;
  let loaderStarted = 0;
  let loaderClosing = false;
  const loadDuration = 920;

  function closeLoader() {
    if (loader.hidden || loaderClosing) return;
    loaderClosing = true;
    cancelAnimationFrame(loaderFrame);
    clearTimeout(loaderTimer);
    loader.classList.add("is-closing");
    window.setTimeout(() => {
      loader.hidden = true;
      loader.classList.remove("is-closing");
      loaderClosing = false;
      world.inert = false;
      document.getElementById("pageTitle").focus({ preventScroll: true });
    }, body.dataset.motion === "on" ? 160 : 0);
  }

  function animateLoader(now) {
    const progress = Math.min(100, Math.round(((now - loaderStarted) / loadDuration) * 100));
    loaderFill.style.width = `${progress}%`;
    loaderBar.setAttribute("aria-valuenow", String(progress));
    loaderPercent.textContent = `${String(progress).padStart(2, "0")}%`;
    const current = [...loaderLines].reverse().find(([at]) => progress >= at);
    if (current) loaderStatus.textContent = current[1];
    if (progress < 100) loaderFrame = requestAnimationFrame(animateLoader);
    else loaderTimer = window.setTimeout(closeLoader, 100);
  }

  let alreadySeen = false;
  try {
    alreadySeen = sessionStorage.getItem("zoeytest-loader-seen") === "yes";
    if (!alreadySeen) sessionStorage.setItem("zoeytest-loader-seen", "yes");
  } catch {}
  if (!alreadySeen && body.dataset.motion === "on") {
    loader.hidden = false;
    world.inert = true;
    skip.focus({ preventScroll: true });
    loaderStarted = performance.now();
    loaderFrame = requestAnimationFrame(animateLoader);
    skip.addEventListener("click", closeLoader);
    document.querySelector(".z-skip-link").addEventListener("click", (event) => {
      if (!loader.hidden) { event.preventDefault(); closeLoader(); }
    });
    window.addEventListener("keydown", (event) => {
      if (loader.hidden) return;
      if (event.key === "Escape") closeLoader();
      else if (event.key === "Tab") { event.preventDefault(); skip.focus({ preventScroll: true }); }
    });
  } else {
    world.inert = false;
  }
})();
