(() => {
  "use strict";

  const audio = document.getElementById("radio-audio");
  const mediaSession = navigator.mediaSession || null;
  const canvas = document.getElementById("radio-visualizer");
  const screen = document.querySelector(".visualizer-bezel");
  const fallback = document.getElementById("visualizer-fallback");
  const fadeLayer = document.getElementById("visualizer-fade");

  // Temporarily excluded MilkDrop presets live here. Remove an entry to let
  // that visual return to the automatic rotation.
  const DISABLED_VISUALIZER_PRESETS = [];
  const TRACK_EDGE_FADE_SECONDS = 2;
  const playButton = document.getElementById("play-toggle");
  const muteButton = document.getElementById("mute-toggle");
  const theatreButton = document.getElementById("visualizer-fullscreen");
  const loopButton = document.getElementById("loop-toggle");
  const shuffleButton = document.getElementById("shuffle-toggle");
  const visualsButton = document.getElementById("visualizer-toggle");
  const playerMessage = document.getElementById("player-message");
  const seek = document.getElementById("track-seek");
  const volume = document.getElementById("track-volume");
  const volumeValue = document.getElementById("volume-value");
  const currentTime = document.getElementById("time-current");
  const totalTime = document.getElementById("time-total");
  const paletteSelect = document.getElementById("palette-select");
  const trackSelect = document.getElementById("track-select");
  const playlistList = document.getElementById("track-list");
  const playlistCount = document.getElementById("playlist-count");
  const playlistPanel = document.querySelector(".player-side");
  const trackArtist = document.getElementById("track-artist");
  const trackTitle = document.getElementById("track-title");
  const currentTrackTags = document.getElementById("current-track-tags");
  const trackTagFilter = document.getElementById("track-tag-filter");
  const tagLabels = {
    instrumental: "Instrumental",
    "masayoshi-takanaka": "Masayoshi Takanaka",
    cover: "Cover",
    rock: "Rock",
    "city-pop": "City Pop",
    disco: "Disco",
    funk: "Funk",
    samba: "Samba",
    vgm: "VGM",
    christmas: "Christmas",
    anime: "Anime",
    ost: "OST",
    soundtrack: "Soundtrack",
    "deep-house": "Deep House",
    "new-age": "New Age",
    techno: "Techno",
    house: "House",
    remix: "Remix",
    vocal: "Vocal",
    healing: "Healing",
    "kayo-kyoku": "Kayōkyoku",
    japanese: "Japanese",
    shomyo: "Shōmyō",
    walearic: "Walearic",
    "image-album": "Image Album",
    experimental: "Experimental",
    electronic: "Electronic",
    ambient: "Ambient",
    jazz: "Jazz",
    downtempo: "Downtempo",
    exotica: "Exotica",
    "chamber-music": "Chamber Music",
    classical: "Classical",
    boogie: "Boogie",
    aor: "AOR",
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const theatreStorageKey = "kazvt-radio-theatre";

  let audioContext = null;
  let audioContextResumePromise = null;
  let mediaSource = null;
  let normalizationGain = null;
  let normalizationPeakGuard = null;
  let mediaSourceConnected = false;
  let visualizer = null;
  let presetMap = {};
  let presetKeys = [];
  let currentPresetKey = "";
  let frameHandle = 0;
  let cycleHandle = 0;
  let playbackIntent = 0;
  let playbackPending = false;
  let presetBag = [];
  let trackHasPlayed = false;
  let trackTransitionBlackout = false;
  let shuffleEnabled = false;
  let shuffleBag = [];
  let trackHistory = trackSelect ? [trackSelect.selectedIndex] : [];
  let trackHistoryPosition = trackHistory.length - 1;
  let visualsPaused = reducedMotion.matches;
  let resizeObserver = null;
  let marqueeResizeObserver = null;
  let marqueeFrame = 0;
  let hudHideHandle = 0;
  const hudIdleDelay = 3000;

  function setTheme(theme, persist = true) {
    if (!/^p(?:[1-9]|1[0-6])$/.test(theme)) return;
    document.body.dataset.theme = theme;
    document.documentElement.dataset.theme = theme;
    if (paletteSelect) paletteSelect.value = theme;
    const themeColor = getComputedStyle(document.body).getPropertyValue("--bg").trim();
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColor && themeMeta) themeMeta.content = themeColor;
    if (persist) {
      try { localStorage.setItem("kazvt-theme", theme); } catch {}
    }
  }

  function formatTime(value) {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const seconds = Math.floor(value);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function setMessage(message) {
    playerMessage.textContent = message;
  }

  function updatePageTitle(option = trackSelect.options[trackSelect.selectedIndex]) {
    if (!option) {
      document.title = "KAZVT radio";
      return;
    }
    const title = option.textContent.trim();
    const artist = (option.dataset.artist || "Unknown artist").trim();
    document.title = `${title} - ${artist} | KAZVT radio`;
  }

  function updateMediaSessionMetadata() {
    const option = trackSelect.options[trackSelect.selectedIndex];
    if (!option) return;
    updatePageTitle(option);
    if (!mediaSession || typeof window.MediaMetadata !== "function") return;
    try {
      mediaSession.metadata = new window.MediaMetadata({
        title: option.textContent.trim(),
        artist: option.dataset.artist || "Unknown artist",
        album: "KAZVT Radio",
      });
    } catch {
      // Metadata is optional; playback controls should still work without it.
    }
  }

  function updateMediaSessionPlaybackState() {
    if (!mediaSession) return;
    try {
      mediaSession.playbackState = !audio.paused && !audio.ended ? "playing" : "paused";
    } catch {
      // Some browsers expose Media Session but not playbackState.
    }
  }

  function setMarqueeText(container, value) {
    if (!container) return;
    let text = container.querySelector(".marquee-text");
    if (!text) {
      text = document.createElement("span");
      text.className = "marquee-text";
      container.replaceChildren(text);
    }
    text.textContent = value;
    text.removeAttribute("data-marquee");
    container.classList.remove("is-overflowing");
    scheduleMarqueeUpdate();
  }

  function syncMarquee(container) {
    const text = container.querySelector(".marquee-text");
    if (!text) return;
    text.removeAttribute("data-marquee");
    container.classList.remove("is-overflowing");
    const textWidth = text.scrollWidth;
    const viewportWidth = container.clientWidth;
    if (textWidth <= viewportWidth + 1) {
      text.style.removeProperty("--marquee-distance");
      text.style.removeProperty("--marquee-duration");
      return;
    }
    const distance = textWidth + 28;
    text.dataset.marquee = text.textContent;
    text.style.setProperty("--marquee-distance", `${distance}px`);
    text.style.setProperty("--marquee-duration", `${Math.max(9, Math.min(24, distance / 22))}s`);
    container.classList.add("is-overflowing");
  }

  function scheduleMarqueeUpdate() {
    if (marqueeFrame) return;
    marqueeFrame = window.requestAnimationFrame(() => {
      marqueeFrame = 0;
      document.querySelectorAll(".marquee-window").forEach(syncMarquee);
    });
  }

  function updateRangeFill(input) {
    if (!input) return;
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const value = Number(input.value) || 0;
    const percent = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
    input.style.setProperty("--range-progress", `${percent}%`);
    if (input === seek) {
      input.closest(".seek-slider")?.style.setProperty("--seek-progress", `${percent}%`);
    }
    if (input === volume) {
      input.closest(".volume-slider")?.style.setProperty("--volume-progress", `${percent}%`);
      input.setAttribute("aria-valuetext", `${Math.round(percent)} percent`);
    }
  }

  function updateRangeFills() {
    updateRangeFill(seek);
    updateRangeFill(volume);
  }

  function getOptionTags(option) {
    return (option?.dataset.tags || "").split(/\s+/).filter(Boolean);
  }

  function getTagLabel(tag) {
    return tagLabels[tag] || tag.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function populateTagFilter() {
    if (!trackTagFilter || !trackSelect) return;
    const currentTag = trackTagFilter.value;
    const tags = new Set(Array.from(trackSelect.options).flatMap(getOptionTags));
    trackTagFilter.replaceChildren(new Option("ALL TRACKS", ""));
    [...tags].sort((a, b) => getTagLabel(a).localeCompare(getTagLabel(b)))
      .forEach((tag) => trackTagFilter.add(new Option(getTagLabel(tag).toUpperCase(), tag)));
    trackTagFilter.value = tags.has(currentTag) ? currentTag : "";
  }

  function renderCurrentTrackTags(index = trackSelect.selectedIndex) {
    if (!currentTrackTags) return;
    const tags = getOptionTags(trackSelect.options[index]);
    currentTrackTags.replaceChildren();
    tags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "track-tag-chip";
      chip.textContent = getTagLabel(tag);
      currentTrackTags.append(chip);
    });
    currentTrackTags.setAttribute("aria-label", tags.length
      ? `Current track tags: ${tags.map(getTagLabel).join(", ")}`
      : "Current track has no tags");
  }

  function updatePlaylistSelection(index = trackSelect.selectedIndex, scrollIntoView = false) {
    const rows = playlistList.querySelectorAll(".playlist-track");
    let selectedRow = null;
    rows.forEach((row) => {
      const isCurrent = Number(row.dataset.trackIndex) === index;
      row.classList.toggle("is-current", isCurrent);
      if (isCurrent) {
        row.setAttribute("aria-current", "true");
        selectedRow = row;
      } else {
        row.removeAttribute("aria-current");
      }
    });
    if (scrollIntoView) selectedRow?.scrollIntoView({ block: "nearest" });
    renderCurrentTrackTags(index);
    scheduleMarqueeUpdate();
  }

  function renderPlaylist() {
    if (!trackSelect || !playlistList) return;
    playlistList.replaceChildren();
    const selectedTag = trackTagFilter?.value || "";
    let visibleCount = 0;
    Array.from(trackSelect.options).forEach((option, index) => {
      const tags = getOptionTags(option);
      if (selectedTag && !tags.includes(selectedTag)) return;
      const title = option.textContent.trim();
      const artist = option.dataset.artist || "Unknown artist";
      const row = document.createElement("button");
      row.type = "button";
      row.className = "playlist-track";
      row.dataset.trackIndex = String(index);
      row.dataset.tags = tags.join(" ");
      const number = document.createElement("span");
      number.className = "playlist-index";
      visibleCount += 1;
      number.textContent = String(visibleCount).padStart(2, "0");

      const copy = document.createElement("span");
      copy.className = "playlist-track-copy";

      const titleWindow = document.createElement("span");
      titleWindow.className = "playlist-track-name playlist-title marquee-window";
      const titleText = document.createElement("span");
      titleText.className = "marquee-text";
      titleText.textContent = title;
      titleWindow.append(titleText);

      const artistLine = document.createElement("span");
      artistLine.className = "playlist-track-artist";
      artistLine.textContent = artist;
      copy.append(titleWindow, artistLine);
      row.append(number, copy);
      row.addEventListener("click", () => loadTrack(index));
      playlistList.append(row);
    });

    const totalCount = trackSelect.options.length;
    if (!visibleCount) {
      const empty = document.createElement("p");
      empty.className = "playlist-empty";
      empty.textContent = "NO TRACKS MATCH THIS TAG";
      playlistList.append(empty);
    }
    if (playlistCount) {
      playlistCount.textContent = selectedTag
        ? `${visibleCount} / ${totalCount} TRACKS`
        : `${totalCount} TRACK${totalCount === 1 ? "" : "S"}`;
    }
    updatePlaylistSelection(trackSelect.selectedIndex);
    scheduleMarqueeUpdate();
    if ("ResizeObserver" in window && playlistPanel) {
      marqueeResizeObserver ??= new ResizeObserver(scheduleMarqueeUpdate);
      marqueeResizeObserver.observe(playlistPanel);
    }
  }

  function setButtonIcon(button, icon, active = false) {
    if (!button) return;
    button.dataset.icon = icon;
    button.classList.toggle("is-on", active);
  }

  function showFallback(message) {
    fallback.querySelector("p").textContent = message;
    screen.classList.remove("is-live");
    screen.classList.add("is-fallback");
    updateVisualizerFade();
  }

  function reportVisualizerFailure(error) {
    const isPlaying = !audio.paused && !audio.ended;
    showFallback(isPlaying
      ? "AUDIO IS ON / VISUALS UNAVAILABLE"
      : "VISUALS UNAVAILABLE / PRESS TO RETRY");
    setMessage(isPlaying
      ? "Music is playing. Use the visuals control to retry the picture."
      : "The visualiser could not start. Use the visuals control to retry.");
    if (error) console.warn("Radio visualiser unavailable:", error);
  }

  function handleVisualizerFailure(error) {
    const failedVisualizer = visualizer;
    visualizer = null;
    stopRendering();
    window.clearInterval(cycleHandle);
    cycleHandle = 0;
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    try { failedVisualizer?.disconnectAudio?.(mediaSource); } catch {}
    reportVisualizerFailure(error);
    syncPresetShuffle();
  }

  function getVisualizerBlackoutOpacity() {
    if (!visualizer || visualsPaused) return 0;
    if (trackTransitionBlackout) return 1;
    if (!trackHasPlayed) return 0;

    const elapsed = Math.max(0, Number(audio.currentTime) || 0);
    const fadeInVisibility = Math.min(1, elapsed / TRACK_EDGE_FADE_SECONDS);
    const duration = Number(audio.duration);
    const fadeOutVisibility = Number.isFinite(duration) && duration > 0
      ? Math.max(0, Math.min(1, (duration - elapsed) / TRACK_EDGE_FADE_SECONDS))
      : 1;
    return 1 - Math.min(fadeInVisibility, fadeOutVisibility);
  }

  function updateVisualizerFade() {
    if (fadeLayer) fadeLayer.style.opacity = String(getVisualizerBlackoutOpacity());
  }

  function getVisualizerSize() {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
    const cssWidth = rect.width || 960;
    const cssHeight = rect.height || 520;
    return {
      width: Math.max(1, Math.round(cssWidth * pixelRatio)),
      height: Math.max(1, Math.round(cssHeight * pixelRatio)),
    };
  }

  function fitVisualizer() {
    const { width, height } = getVisualizerSize();
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    if (visualizer && width > 0 && height > 0) {
      // Butterchurn renders to an internal canvas and copies it 1:1 into this
      // canvas. Keep both backing buffers the same size; CSS-only sizing leaves
      // the original 960x520 bitmap larger, exposing an unpainted black region.
      try {
        visualizer.setRendererSize(width, height, { pixelRatio: 1, textureRatio: 0.85 });
      } catch (error) {
        handleVisualizerFailure(error);
      }
    }
  }

  function populatePresets() {
    const pack = window.butterchurnPresetsMinimal;
    if (!pack || typeof pack.getPresets !== "function") throw new Error("The visual preset pack did not load.");
    const allPresets = { ...pack.getPresets() };
    const extraPack = window.butterchurnPresetsExtra;
    if (extraPack && typeof extraPack.getPresets === "function") {
      Object.assign(allPresets, extraPack.getPresets());
    } else {
      console.warn("The Butterchurn Extra preset pack did not load; using the minimal pack only.");
    }
    const disabledPresets = new Set(DISABLED_VISUALIZER_PRESETS);
    presetMap = Object.fromEntries(Object.entries(allPresets).filter(([key]) => !disabledPresets.has(key)));
    const missingDisabledPresets = DISABLED_VISUALIZER_PRESETS.filter((key) => !(key in allPresets));
    if (missingDisabledPresets.length) {
      console.warn("Disabled radio visualiser presets were not found in the loaded pack:", missingDisabledPresets);
    }
    presetKeys = Object.keys(presetMap).sort((a, b) => a.localeCompare(b));
    if (!presetKeys.length) throw new Error("The visual preset pack contains no presets.");
    currentPresetKey = presetKeys[Math.floor(Math.random() * presetKeys.length)];
    presetBag = [];
  }

  function handleAudioContextStateChange(context) {
    if (context !== audioContext) return;
    if (context.state === "running") {
      if (!audio.paused && !visualsPaused && !document.hidden) {
        if (visualizer) startRendering();
        else retryVisualizer();
      }
    } else {
      stopRendering();
    }
    syncPresetShuffle();
  }

  function ensureAudioContext() {
    let context = audioContext;
    if (!context || context.state === "closed") {
      if (mediaSource) throw new Error("The existing audio route cannot be restarted by this browser.");
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("This browser does not support Web Audio.");
      context = new AudioContextConstructor();
      audioContext = context;
      const onStateChange = () => handleAudioContextStateChange(context);
      if (typeof context.addEventListener === "function") context.addEventListener("statechange", onStateChange);
      else context.onstatechange = onStateChange;
    }

    // Keep loudness matching in the audio path itself, independently of the
    // visualiser. A WebGL failure must not bypass this processing path or
    // silence the media element.
    try {
      if (!mediaSource) mediaSource = context.createMediaElementSource(audio);
      if (!normalizationGain) normalizationGain = context.createGain();
      if (!mediaSourceConnected) {
        try {
          normalizationPeakGuard = context.createDynamicsCompressor();
          normalizationPeakGuard.knee.value = 0;
          normalizationPeakGuard.ratio.value = 20;
          normalizationPeakGuard.attack.value = 0.003;
          normalizationPeakGuard.release.value = 0.12;
          normalizationGain.connect(normalizationPeakGuard);
          normalizationPeakGuard.connect(context.destination);
        } catch {
          // Gain-only normalization is still useful on older or partial Web
          // Audio implementations that do not provide a compressor node.
          try { normalizationGain.disconnect(); } catch {}
          normalizationPeakGuard = null;
          normalizationGain.connect(context.destination);
        }
        mediaSource.connect(normalizationGain);
        mediaSourceConnected = true;
      }
      applyTrackNormalization();
    } catch (error) {
      // If a browser rejects GainNode routing, preserve ordinary playback as a
      // fallback. Normalisation will be skipped, but the track remains audible.
      if (mediaSource && !mediaSourceConnected) {
        try {
          mediaSource.connect(context.destination);
          mediaSourceConnected = true;
          return context;
        } catch {}
      }
      throw error;
    }
    return context;
  }

  /*
   * Loudness mode measures integrated LUFS offline, then applies the measured
   * track gain. The built-in peak guard engages only when that gain would make
   * peaks excessive; peak/off modes remain gain-only.
   */
  function applyTrackNormalization(option = trackSelect.options[trackSelect.selectedIndex]) {
    if (!normalizationGain || !audioContext || audioContext.state === "closed") return;
    const now = audioContext.currentTime;
    const mode = option?.dataset.normalizationMode || trackSelect.dataset.normalizationDefaultMode || "loudness";
    const measuredPeak = Number(option?.dataset.truePeakDbtp);
    const peakCeiling = Number(option?.dataset.normalizationTruePeakCeilingDbtp
      ?? trackSelect.dataset.normalizationTruePeakCeilingDbtp ?? -1.5);
    const maximumGain = Math.max(0, Number(option?.dataset.normalizationMaximumGainDb
      ?? trackSelect.dataset.normalizationMaximumGainDb ?? 12));
    const peakGuardMargin = Math.max(0, Number(option?.dataset.normalizationPeakGuardMarginDb
      ?? trackSelect.dataset.normalizationPeakGuardMarginDb ?? 1.5));
    let appliedGainDb = 0;
    let usePeakGuard = false;

    if (mode === "loudness" && Number.isFinite(measuredPeak)
      && Number.isFinite(peakCeiling) && Number.isFinite(maximumGain)) {
      const measuredLufs = Number(option.dataset.integratedLufs);
      const targetLufs = Number(option.dataset.normalizationTargetLufs
        ?? trackSelect.dataset.normalizationTargetLufs ?? -16);
      if (Number.isFinite(measuredLufs) && Number.isFinite(targetLufs)) {
        const requestedGainDb = targetLufs - measuredLufs;
        if (normalizationPeakGuard) {
          appliedGainDb = Math.min(requestedGainDb, maximumGain);
          usePeakGuard = true;
        } else {
          // Without a compressor, preserve the measured ceiling with gain-only
          // playback rather than letting a quiet transient clip the output.
          appliedGainDb = Math.min(requestedGainDb, peakCeiling - measuredPeak, maximumGain);
        }
      }
    } else if (mode === "peak" && Number.isFinite(measuredPeak)
      && Number.isFinite(peakCeiling) && Number.isFinite(maximumGain)) {
      appliedGainDb = Math.min(peakCeiling - measuredPeak, maximumGain);
    }

    const nextGain = 10 ** (appliedGainDb / 20);
    normalizationGain.gain.cancelScheduledValues(now);
    normalizationGain.gain.setTargetAtTime(nextGain, now, 0.025);

    if (normalizationPeakGuard) {
      const guardThreshold = Math.max(-100, Math.min(0, peakCeiling - peakGuardMargin));
      normalizationPeakGuard.threshold.cancelScheduledValues(now);
      normalizationPeakGuard.threshold.setTargetAtTime(guardThreshold, now, 0.025);
      normalizationPeakGuard.ratio.cancelScheduledValues(now);
      normalizationPeakGuard.ratio.setTargetAtTime(usePeakGuard ? 20 : 1, now, 0.025);
    }
  }

  function resumeAudioContext() {
    const context = audioContext;
    if (!context || context.state === "running") return Promise.resolve();
    if (context.state === "closed") return Promise.reject(new Error("The audio context is closed."));
    if (audioContextResumePromise) return audioContextResumePromise;
    let request;
    try {
      request = context.resume();
    } catch (error) {
      return Promise.reject(error);
    }
    const resumePromise = Promise.resolve(request);
    audioContextResumePromise = resumePromise;
    resumePromise.then(
      () => { if (audioContextResumePromise === resumePromise) audioContextResumePromise = null; },
      () => { if (audioContextResumePromise === resumePromise) audioContextResumePromise = null; },
    );
    return resumePromise;
  }

  function initVisualizer() {
    if (visualizer) return true;
    // The browser UMD build exposes a module namespace whose API is under
    // `default`; tolerate direct exports too so the pinned library can be
    // swapped for either supported build shape without a page-level rewrite.
    const butterchurnApi = window.butterchurn?.default ?? window.butterchurn;
    if (!butterchurnApi || typeof butterchurnApi.createVisualizer !== "function") {
      throw new Error("The MilkDrop engine did not load.");
    }
    if (!presetKeys.length) populatePresets();

    const context = ensureAudioContext();
    fitVisualizer();
    const { width, height } = getVisualizerSize();
    let candidate = null;
    try {
      candidate = butterchurnApi.createVisualizer(context, canvas, {
        width,
        height,
        pixelRatio: 1,
        textureRatio: 0.85,
      });
      if (!candidate) throw new Error("This browser could not start the WebGL visualiser.");

      // A media element may only be routed through one MediaElementAudioSourceNode.
      // ensureAudioContext() keeps its single output route alive on visualiser retries.
      candidate.connectAudio(mediaSource);
      candidate.loadPreset(presetMap[currentPresetKey], 0);
    } catch (error) {
      visualizer = null;
      try { candidate?.disconnectAudio?.(mediaSource); } catch {}
      // If setup failed before the one-time media source was created, discard
      // the unused context so a later user gesture can start cleanly.
      if (!mediaSource && audioContext === context) {
        audioContext = null;
        audioContextResumePromise = null;
        mediaSourceConnected = false;
        context.close().catch(() => {});
      }
      throw error;
    }
    visualizer = candidate;
    screen.classList.add("is-live");
    screen.classList.remove("is-fallback");
    fallback.querySelector("p").textContent = "PRESS TO PLAY";
    fitVisualizer();

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(fitVisualizer);
      resizeObserver.observe(screen);
    } else {
      window.addEventListener("resize", fitVisualizer, { passive: true });
    }
    return true;
  }

  function renderFrame() {
    frameHandle = 0;
    if (!visualizer || visualsPaused || audio.paused || document.hidden) return;
    if (audioContext && audioContext.state !== "running") return;
    updateVisualizerFade();
    try {
      visualizer.render();
    } catch (error) {
      handleVisualizerFailure(error);
      return;
    }
    frameHandle = window.requestAnimationFrame(renderFrame);
  }

  function startRendering() {
    if (visualsPaused || document.hidden || !visualizer || audio.paused || frameHandle) return;
    if (audioContext && audioContext.state !== "running") {
      const context = audioContext;
      resumeAudioContext().then(() => {
        if (context === audioContext && context.state === "running") startRendering();
      }).catch((error) => {
        if (context !== audioContext || document.hidden || audio.paused || visualsPaused) return;
        showFallback("AUDIO IS ON / VISUALS ARE UNAVAILABLE HERE");
        setMessage("Audio is playing, but the visualiser could not resume. Try the visuals control again.");
        console.warn("Radio audio context could not resume:", error);
      });
      return;
    }
    screen.classList.add("is-live");
    screen.classList.remove("is-fallback");
    frameHandle = window.requestAnimationFrame(renderFrame);
  }

  function stopRendering() {
    if (frameHandle) window.cancelAnimationFrame(frameHandle);
    frameHandle = 0;
  }

  function pickPreset(key, blend = 1.5) {
    if (!presetMap[key]) return;
    const previousPresetKey = currentPresetKey;
    currentPresetKey = key;
    if (visualizer) {
      try {
        visualizer.loadPreset(presetMap[key], blend);
      } catch (error) {
        currentPresetKey = previousPresetKey;
        console.warn("Radio visualiser could not load a preset:", error);
      }
    }
  }

  function refillPresetBag() {
    presetBag = presetKeys.filter((key) => key !== currentPresetKey);
    for (let index = presetBag.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [presetBag[index], presetBag[swapIndex]] = [presetBag[swapIndex], presetBag[index]];
    }
  }

  function randomPreset() {
    if (presetKeys.length < 2) return;
    if (!presetBag.length) refillPresetBag();
    const nextPreset = presetBag.pop();
    if (nextPreset) pickPreset(nextPreset, 2.2);
  }

  function syncPresetShuffle() {
    window.clearInterval(cycleHandle);
    cycleHandle = 0;
    if (visualizer && !visualsPaused && !audio.paused && !document.hidden
      && (!audioContext || audioContext.state === "running")) {
      cycleHandle = window.setInterval(randomPreset, 10000);
    }
  }

  function theatreModeIsOn() {
    return document.documentElement.classList.contains("radio-theatre");
  }

  function hasKeyboardFocusedHudControl() {
    const active = document.activeElement;
    return active instanceof Element && active.closest(".radio-hud") && active.matches(":focus-visible");
  }

  function scheduleHudHide() {
    window.clearTimeout(hudHideHandle);
    hudHideHandle = 0;
    if (!theatreModeIsOn() || document.hidden || hasKeyboardFocusedHudControl()) return;
    hudHideHandle = window.setTimeout(() => {
      hudHideHandle = 0;
      if (theatreModeIsOn() && !document.hidden && !hasKeyboardFocusedHudControl()) {
        document.documentElement.classList.add("radio-hud-hidden");
      }
    }, hudIdleDelay);
  }

  function revealTheatreHud() {
    if (!theatreModeIsOn()) return;
    window.clearTimeout(hudHideHandle);
    hudHideHandle = 0;
    document.documentElement.classList.remove("radio-hud-hidden");
    scheduleHudHide();
  }

  function updateTransport() {
    const playing = !audio.paused && !audio.ended;
    updateMediaSessionPlaybackState();
    setButtonIcon(playButton, playing ? "pause" : "play", playing);
    if (playing) {
      trackHasPlayed = true;
      trackTransitionBlackout = false;
      updateVisualizerFade();
      if (visualsPaused) {
        showFallback("VISUALS PAUSED / MUSIC PLAYING");
      } else if (screen.classList.contains("is-fallback")) {
        // Keep the fallback reason set by the failed start attempt.
      } else {
        screen.classList.add("is-live");
        screen.classList.remove("is-fallback");
        startRendering();
      }
      syncPresetShuffle();
    } else {
      updateVisualizerFade();
      if (visualsPaused) showFallback("VISUALS PAUSED");
      else if (screen.classList.contains("is-fallback")) {
        // Keep the fallback reason set by the failed start attempt.
      }
      stopRendering();
      syncPresetShuffle();
    }
  }

  function togglePlay() {
    if (!audio.paused || playbackPending) {
      playbackIntent += 1;
      playbackPending = false;
      audio.pause();
      return;
    }

    const intent = ++playbackIntent;
    playbackPending = true;

    try {
      if (!visualizer && !visualsPaused) initVisualizer();
      if (audioContext && audioContext.state !== "running") {
        resumeAudioContext().catch((error) => {
          if (intent === playbackIntent && !audio.paused) {
            reportVisualizerFailure(error);
          }
        });
      }
      if (visualsPaused) showFallback("VISUALS PAUSED / MUSIC PLAYING");
      else if (visualizer) {
        screen.classList.add("is-live");
        screen.classList.remove("is-fallback");
      }
      setMessage("You're tuned in. Enjoy the transmission.");
    } catch (error) {
      reportVisualizerFailure(error);
    }

    let playRequest;
    try {
      playRequest = audio.play();
    } catch (error) {
      handlePlayFailure(error, intent);
      return;
    }
    Promise.resolve(playRequest).then(() => {
      if (intent === playbackIntent) playbackPending = false;
    }).catch((error) => handlePlayFailure(error, intent));
  }

  function handlePlayFailure(error, intent) {
    // Track switches and pauses invalidate outstanding play() promises. Some
    // browsers reject the old promise only after the next track has started.
    if (intent !== playbackIntent || !audio.paused) return;
    playbackPending = false;
    trackTransitionBlackout = false;
    updateVisualizerFade();
    setMessage("The track could not start. Check the audio file connection and try again.");
    if (visualizer && !visualsPaused) showFallback("PRESS TO PLAY");
    updateTransport();
  }

  function updateMuteButton() {
    if (!muteButton) return;
    muteButton.classList.toggle("is-muted", audio.muted);
    muteButton.setAttribute("aria-pressed", String(audio.muted));
    muteButton.setAttribute("aria-label", audio.muted ? "Unmute audio" : "Mute audio");
  }

  function toggleMute() {
    audio.muted = !audio.muted;
    updateMuteButton();
    setMessage(audio.muted ? "Radio muted. Press M or UNMUTE to bring it back." : "Sound is back on.");
  }

  function refillShuffleBag() {
    shuffleBag = [];
    for (let index = 0; index < trackSelect.options.length; index += 1) {
      if (index !== trackSelect.selectedIndex) shuffleBag.push(index);
    }
    for (let index = shuffleBag.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffleBag[index], shuffleBag[swapIndex]] = [shuffleBag[swapIndex], shuffleBag[index]];
    }
  }

  function takeShuffledTrack() {
    if (!shuffleBag.length) refillShuffleBag();
    return shuffleBag.length ? shuffleBag.pop() : trackSelect.selectedIndex;
  }

  function rememberTrack(index) {
    if (trackHistory[trackHistoryPosition] === index) {
      shuffleBag = shuffleBag.filter((candidate) => candidate !== index);
      return;
    }
    trackHistory = trackHistory.slice(0, trackHistoryPosition + 1);
    trackHistory.push(index);
    if (trackHistory.length > 100) trackHistory = trackHistory.slice(-100);
    trackHistoryPosition = trackHistory.length - 1;
    shuffleBag = shuffleBag.filter((candidate) => candidate !== index);
  }

  function loadTrack(index, startPlaying = true, recordHistory = true) {
    const option = trackSelect.options[index];
    if (!option) return;
    playbackIntent += 1;
    playbackPending = false;
    if (recordHistory) rememberTrack(index);
    trackSelect.selectedIndex = index;
    applyTrackNormalization(option);
    const title = option.textContent.trim();
    updateMediaSessionMetadata();
    setMarqueeText(trackTitle, title);
    trackArtist.textContent = option.dataset.artist || "Unknown artist";
    updatePlaylistSelection(index, true);
    trackHasPlayed = false;
    trackTransitionBlackout = Boolean(startPlaying);
    updateVisualizerFade();
    if (visualizer && trackTransitionBlackout && currentPresetKey && presetMap[currentPresetKey]) {
      try {
        visualizer.loadPreset(presetMap[currentPresetKey], 0);
      } catch (error) {
        console.warn("Radio visualiser preset could not be reset for the new track:", error);
      }
    }
    audio.pause();
    audio.src = option.value;
    audio.load();
    seek.value = "0";
    seek.max = "100";
    currentTime.textContent = "0:00";
    totalTime.textContent = "--:--";
    updateRangeFill(seek);
    if (startPlaying) togglePlay();
    else setMessage(`Ready to play: ${title}`);
  }

  function changeTrack(step) {
    const count = trackSelect.options.length;
    if (!count) return;
    if (step < 0) {
      if (trackHistoryPosition > 0) {
        trackHistoryPosition -= 1;
        loadTrack(trackHistory[trackHistoryPosition], true, false);
        return;
      }
      loadTrack((trackSelect.selectedIndex - 1 + count) % count);
      return;
    }
    if (trackHistoryPosition < trackHistory.length - 1) {
      trackHistoryPosition += 1;
      loadTrack(trackHistory[trackHistoryPosition], true, false);
      return;
    }
    const nextIndex = shuffleEnabled
      ? takeShuffledTrack()
      : (trackSelect.selectedIndex + 1) % count;
    loadTrack(nextIndex);
  }

  function setupMediaSession() {
    if (!mediaSession || typeof mediaSession.setActionHandler !== "function") return;
    const actions = {
      play: () => { if (audio.paused && !playbackPending) togglePlay(); },
      pause: () => {
        if (!audio.paused || playbackPending) {
          playbackIntent += 1;
          playbackPending = false;
          audio.pause();
        }
      },
      previoustrack: () => changeTrack(-1),
      nexttrack: () => changeTrack(1),
    };
    for (const [action, handler] of Object.entries(actions)) {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Action support varies by browser and operating system.
      }
    }
    updateMediaSessionMetadata();
    updateMediaSessionPlaybackState();
  }

  function updateShuffleButton() {
    setButtonIcon(shuffleButton, "shuffle", shuffleEnabled);
  }

  function toggleShuffle() {
    shuffleEnabled = !shuffleEnabled;
    shuffleBag = [];
    if (shuffleEnabled) refillShuffleBag();
    updateShuffleButton();
    setMessage(shuffleEnabled
      ? "Shuffle is on. Tracks will not repeat until the playlist has cycled."
      : "Shuffle is off. Tracks play in playlist order.");
  }

  function setTheatreMode(enabled, persist = true) {
    document.documentElement.classList.toggle("radio-theatre", enabled);
    setButtonIcon(theatreButton, "select", enabled);
    if (enabled) revealTheatreHud();
    else {
      window.clearTimeout(hudHideHandle);
      hudHideHandle = 0;
      document.documentElement.classList.remove("radio-hud-hidden");
    }
    if (persist) {
      try { localStorage.setItem(theatreStorageKey, enabled ? "on" : "off"); } catch {}
    }
  }

  function toggleTheatreMode() {
    setTheatreMode(!document.documentElement.classList.contains("radio-theatre"));
  }

  function retryVisualizer() {
    try {
      if (!visualizer) initVisualizer();
      if (audioContext && audioContext.state !== "running") {
        resumeAudioContext().catch((error) => reportVisualizerFailure(error));
      }
      if (audio.paused) showFallback("PRESS TO PLAY");
      else {
        screen.classList.add("is-live");
        screen.classList.remove("is-fallback");
        startRendering();
      }
      syncPresetShuffle();
    } catch (error) {
      reportVisualizerFailure(error);
    }
  }

  playButton.addEventListener("click", togglePlay);
  screen.addEventListener("click", togglePlay);
  muteButton?.addEventListener("click", toggleMute);
  theatreButton?.addEventListener("click", toggleTheatreMode);
  shuffleButton?.addEventListener("click", toggleShuffle);
  document.getElementById("track-prev").addEventListener("click", () => changeTrack(-1));
  document.getElementById("track-next").addEventListener("click", () => changeTrack(1));
  trackSelect.addEventListener("change", () => loadTrack(trackSelect.selectedIndex));
  trackTagFilter?.addEventListener("change", renderPlaylist);
  loopButton.addEventListener("click", () => {
    audio.loop = !audio.loop;
    setButtonIcon(loopButton, "refresh", audio.loop);
  });
  visualsButton?.addEventListener("click", () => {
    const canPauseHealthyVisuals = visualizer && !visualsPaused && !screen.classList.contains("is-fallback");
    if (canPauseHealthyVisuals) {
      visualsPaused = true;
      setButtonIcon(visualsButton, "treestatus", true);
      stopRendering();
      showFallback(audio.paused ? "VISUALS PAUSED" : "VISUALS PAUSED / MUSIC PLAYING");
      syncPresetShuffle();
    } else {
      visualsPaused = false;
      setButtonIcon(visualsButton, "treestatus", false);
      retryVisualizer();
    }
  });

  seek.addEventListener("input", () => {
    updateRangeFill(seek);
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(seek.value);
      currentTime.textContent = formatTime(audio.currentTime);
      updateVisualizerFade();
    }
  });
  volume.addEventListener("input", () => {
    updateRangeFill(volume);
    audio.volume = Number(volume.value);
    if (audio.volume > 0 && audio.muted) audio.muted = false;
    volumeValue.textContent = `${Math.round(audio.volume * 100)}%`;
    updateMuteButton();
  });
  audio.volume = Number(volume.value);
  updateRangeFills();
  populateTagFilter();
  renderPlaylist();
  updatePageTitle();
  window.addEventListener("resize", scheduleMarqueeUpdate, { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(scheduleMarqueeUpdate);
  setTheatreMode(document.documentElement.classList.contains("radio-theatre"), false);
  setButtonIcon(loopButton, "refresh", audio.loop);
  updateShuffleButton();
  setButtonIcon(visualsButton, "treestatus", visualsPaused);
  updateMuteButton();
  setupMediaSession();
  audio.addEventListener("timeupdate", () => {
    updateVisualizerFade();
    currentTime.textContent = formatTime(audio.currentTime);
    if (!seek.matches(":active")) {
      seek.value = String(audio.currentTime || 0);
      updateRangeFill(seek);
    }
  });
  audio.addEventListener("loadedmetadata", () => {
    seek.max = String(Number.isFinite(audio.duration) ? audio.duration : 100);
    if (!seek.matches(":active")) seek.value = String(audio.currentTime || 0);
    updateRangeFill(seek);
    totalTime.textContent = formatTime(audio.duration);
    updateVisualizerFade();
  });
  audio.addEventListener("seeked", updateVisualizerFade);
  audio.addEventListener("play", () => {
    playbackPending = false;
    updateTransport();
  });
  audio.addEventListener("pause", () => {
    if (audio.paused) playbackPending = false;
    updateTransport();
  });
  audio.addEventListener("ended", () => {
    const hasMoreTracks = trackSelect.selectedIndex < trackSelect.options.length - 1;
    const canShuffleForward = shuffleEnabled && trackSelect.options.length > 1;
    if (!audio.loop && (hasMoreTracks || canShuffleForward)) changeTrack(1);
    else updateTransport();
  });
  audio.addEventListener("volumechange", updateMuteButton);
  audio.addEventListener("error", () => {
    // A source switch can abort the previous request. It is not a failure of
    // the newly selected track and should not leave its transition blacked out.
    if (!audio.error || audio.error.code === 1) return;
    trackTransitionBlackout = false;
    updateVisualizerFade();
    setMessage("The local track could not be loaded. Please try again in a moment.");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopRendering();
      window.clearTimeout(hudHideHandle);
      hudHideHandle = 0;
      syncPresetShuffle();
    } else {
      revealTheatreHud();
      if (!audio.paused && !visualsPaused) {
        if (visualizer) startRendering();
        else retryVisualizer();
      }
      syncPresetShuffle();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "kazvt-theme" && event.newValue) setTheme(event.newValue, false);
    if (event.key === theatreStorageKey) setTheatreMode(event.newValue === "on", false);
  });
  paletteSelect?.addEventListener("change", () => setTheme(paletteSelect.value));

  function isControlTarget(target) {
    return target instanceof Element && Boolean(target.closest("input, textarea, select, button, a, summary, [contenteditable='true']"));
  }

  document.addEventListener("keydown", (event) => {
    if (theatreModeIsOn()) {
      const nativeControlIsActive = event.target instanceof Element && event.target.closest("select, input, textarea, [contenteditable='true']");
      if (event.key === "Escape" && !nativeControlIsActive) {
        event.preventDefault();
        setTheatreMode(false);
        return;
      }
      revealTheatreHud();
    }
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "MediaPlayPause") {
      event.preventDefault();
      togglePlay();
      return;
    }
    if (event.key === "MediaPlay") {
      if (audio.paused) { event.preventDefault(); togglePlay(); }
      return;
    }
    if (event.key === "MediaPause") {
      if (!audio.paused) { event.preventDefault(); togglePlay(); }
      return;
    }
    if (isControlTarget(event.target)) return;

    const key = event.key.toLowerCase();
    if (event.code === "Space" || event.key === " ") {
      if (event.repeat) return;
      event.preventDefault();
      togglePlay();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (!Number.isFinite(audio.duration)) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const seconds = event.shiftKey ? 15 : 5;
      audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + direction * seconds));
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? 1 : -1;
      const amount = event.shiftKey ? 0.1 : 0.05;
      const nextVolume = Math.max(0, Math.min(1, Number(volume.value) + direction * amount));
      volume.value = String(nextVolume);
      updateRangeFill(volume);
      audio.volume = nextVolume;
      if (nextVolume > 0) audio.muted = false;
      volumeValue.textContent = `${Math.round(nextVolume * 100)}%`;
      updateMuteButton();
    } else if (key === "m" && !event.repeat) {
      toggleMute();
    } else if (key === "f" && !event.repeat) {
      toggleTheatreMode();
    } else if (key === "s" && !event.repeat) {
      toggleShuffle();
    } else if (key === "n" && !event.repeat) {
      changeTrack(1);
    } else if ((key === "p" || key === "b") && !event.repeat) {
      changeTrack(-1);
    }
  });

  document.addEventListener("pointermove", revealTheatreHud, { passive: true });
  document.addEventListener("pointerdown", revealTheatreHud, { passive: true });
  document.addEventListener("wheel", revealTheatreHud, { passive: true });
  document.addEventListener("focusin", revealTheatreHud);
  document.addEventListener("focusout", () => window.setTimeout(scheduleHudHide, 0));

  if (reducedMotion.matches) {
    setButtonIcon(visualsButton, "treestatus", true);
    showFallback("VISUALS PAUSED / TAP VISUALS: ON TO ENABLE");
  }

  setTheme(document.body.dataset.theme || "p16", false);
  try {
    populatePresets();
  } catch (error) {
    setMessage("Audio is ready; the visual preset library could not be loaded.");
    console.warn("Radio visual presets unavailable:", error);
  }
})();
