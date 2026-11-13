(() => {
  "use strict";

  const audio = document.getElementById("radio-audio");
  const canvas = document.getElementById("radio-visualizer");
  const screen = document.querySelector(".visualizer-bezel");
  const fallback = document.getElementById("visualizer-fallback");
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
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const theatreStorageKey = "kazvt-radio-theatre";

  let audioContext = null;
  let mediaSource = null;
  let visualizer = null;
  let presetMap = {};
  let presetKeys = [];
  let currentPresetKey = "";
  let frameHandle = 0;
  let cycleHandle = 0;
  let presetBag = [];
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
  }

  function updateRangeFills() {
    updateRangeFill(seek);
    updateRangeFill(volume);
  }

  function updatePlaylistSelection(index = trackSelect.selectedIndex, scrollIntoView = false) {
    const rows = playlistList.querySelectorAll(".playlist-track");
    rows.forEach((row, rowIndex) => row.classList.toggle("is-current", rowIndex === index));
    if (scrollIntoView) rows[index]?.scrollIntoView({ block: "nearest" });
    scheduleMarqueeUpdate();
  }

  function renderPlaylist() {
    if (!trackSelect || !playlistList) return;
    playlistList.replaceChildren();
    Array.from(trackSelect.options).forEach((option, index) => {
      const title = option.textContent.trim();
      const artist = option.dataset.artist || "Unknown artist";
      const row = document.createElement("button");
      row.type = "button";
      row.className = "playlist-track";
      const number = document.createElement("span");
      number.className = "playlist-index";
      number.textContent = String(index + 1).padStart(2, "0");

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

    const count = trackSelect.options.length;
    if (playlistCount) playlistCount.textContent = `${count} TRACK${count === 1 ? "" : "S"}`;
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
      visualizer.setRendererSize(width, height, { pixelRatio: 1, textureRatio: 0.85 });
    }
  }

  function populatePresets() {
    const pack = window.butterchurnPresetsMinimal;
    if (!pack || typeof pack.getPresets !== "function") throw new Error("The visual preset pack did not load.");
    presetMap = pack.getPresets();
    presetKeys = Object.keys(presetMap).sort((a, b) => a.localeCompare(b));
    if (!presetKeys.length) throw new Error("The visual preset pack contains no presets.");
    currentPresetKey = presetKeys[Math.floor(Math.random() * presetKeys.length)];
    presetBag = [];
  }

  function initVisualizer() {
    if (visualizer) return true;
    if (mediaSource) throw new Error("The visualiser is unavailable; the audio route is still active.");
    // The browser UMD build exposes a module namespace whose API is under
    // `default`; tolerate direct exports too so the pinned library can be
    // swapped for either supported build shape without a page-level rewrite.
    const butterchurnApi = window.butterchurn?.default ?? window.butterchurn;
    if (!butterchurnApi || typeof butterchurnApi.createVisualizer !== "function") {
      throw new Error("The MilkDrop engine did not load.");
    }
    if (!presetKeys.length) populatePresets();

    fitVisualizer();
    const { width, height } = getVisualizerSize();
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    visualizer = butterchurnApi.createVisualizer(audioContext, canvas, {
      width,
      height,
      pixelRatio: 1,
      textureRatio: 0.85,
    });
    if (!visualizer) throw new Error("This browser could not start the WebGL visualiser.");

    try {
      mediaSource = audioContext.createMediaElementSource(audio);
    } catch (error) {
      visualizer = null;
      audioContext.close().catch(() => {});
      audioContext = null;
      throw error;
    }
    // Butterchurn taps this source for analysis but does not send its audible
    // branch to the speakers; keep normal playback connected in parallel.
    mediaSource.connect(audioContext.destination);
    try {
      visualizer.connectAudio(mediaSource);
    } catch (error) {
      visualizer = null;
      throw error;
    }
    visualizer.loadPreset(presetMap[currentPresetKey], 0);
    screen.classList.add("is-live");
    screen.classList.remove("is-fallback");
    fallback.querySelector("p").textContent = "PRESS TO RESUME";
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
    visualizer.render();
    frameHandle = window.requestAnimationFrame(renderFrame);
  }

  function startRendering() {
    if (!visualsPaused && !document.hidden && visualizer && !frameHandle) {
      frameHandle = window.requestAnimationFrame(renderFrame);
    }
  }

  function stopRendering() {
    if (frameHandle) window.cancelAnimationFrame(frameHandle);
    frameHandle = 0;
  }

  function pickPreset(key, blend = 1.5) {
    if (!presetMap[key]) return;
    currentPresetKey = key;
    if (visualizer) visualizer.loadPreset(presetMap[key], blend);
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
    if (visualizer && !visualsPaused && !audio.paused && !document.hidden) {
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
    setButtonIcon(playButton, playing ? "pause" : "play", playing);
    if (playing) {
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
      if (visualsPaused) showFallback("VISUALS PAUSED");
      else if (screen.classList.contains("is-fallback")) {
        // Keep the fallback reason set by the failed start attempt.
      }
      stopRendering();
      syncPresetShuffle();
    }
  }

  function togglePlay() {
    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      if (!visualizer && !visualsPaused) initVisualizer();
      if (audioContext && audioContext.state === "suspended") audioContext.resume().catch(() => {});
      if (visualsPaused) showFallback("VISUALS PAUSED / MUSIC PLAYING");
      else if (visualizer) {
        screen.classList.add("is-live");
        screen.classList.remove("is-fallback");
      }
      setMessage("You're tuned in. Enjoy the transmission.");
    } catch (error) {
      if (audioContext && !mediaSource) {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
      showFallback("AUDIO IS ON / VISUALS ARE UNAVAILABLE HERE");
      setMessage("Audio will play, but this browser could not start the WebGL visualiser.");
      console.warn("Radio visualiser unavailable:", error);
    }

    const playRequest = audio.play();
    if (playRequest && typeof playRequest.catch === "function") {
      playRequest.catch(() => {
        setMessage("The track could not start. Check the audio file connection and try again.");
        if (visualizer && !visualsPaused) showFallback("PRESS TO RESUME");
        updateTransport();
      });
    }
  }

  function updateMuteButton() {
    if (!muteButton) return;
    setButtonIcon(muteButton, "speaker", audio.muted);
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
    if (recordHistory) rememberTrack(index);
    trackSelect.selectedIndex = index;
    const title = option.textContent.trim();
    setMarqueeText(trackTitle, title);
    trackArtist.textContent = option.dataset.artist || "Unknown artist";
    updatePlaylistSelection(index, true);
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

  playButton.addEventListener("click", togglePlay);
  screen.addEventListener("click", togglePlay);
  muteButton?.addEventListener("click", toggleMute);
  theatreButton?.addEventListener("click", toggleTheatreMode);
  shuffleButton?.addEventListener("click", toggleShuffle);
  document.getElementById("track-prev").addEventListener("click", () => changeTrack(-1));
  document.getElementById("track-next").addEventListener("click", () => changeTrack(1));
  trackSelect.addEventListener("change", () => loadTrack(trackSelect.selectedIndex));
  loopButton.addEventListener("click", () => {
    audio.loop = !audio.loop;
    setButtonIcon(loopButton, "refresh", audio.loop);
  });
  visualsButton?.addEventListener("click", () => {
    visualsPaused = !visualsPaused;
    setButtonIcon(visualsButton, "treestatus", visualsPaused);
    if (visualsPaused) {
      stopRendering();
      showFallback(audio.paused ? "VISUALS PAUSED" : "VISUALS PAUSED / MUSIC PLAYING");
      syncPresetShuffle();
    } else {
      try {
        if (!visualizer) initVisualizer();
        if (audioContext && audioContext.state === "suspended") audioContext.resume().catch(() => {});
        if (audio.paused) showFallback("PRESS TO RESUME");
        else {
          screen.classList.add("is-live");
          screen.classList.remove("is-fallback");
          startRendering();
        }
        syncPresetShuffle();
      } catch (error) {
        if (audioContext && !mediaSource) {
          audioContext.close().catch(() => {});
          audioContext = null;
        }
        showFallback("AUDIO IS ON / VISUALS ARE UNAVAILABLE HERE");
        console.warn("Radio visualiser unavailable:", error);
      }
    }
  });

  seek.addEventListener("input", () => {
    updateRangeFill(seek);
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(seek.value);
      currentTime.textContent = formatTime(audio.currentTime);
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
  renderPlaylist();
  window.addEventListener("resize", scheduleMarqueeUpdate, { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(scheduleMarqueeUpdate);
  setTheatreMode(document.documentElement.classList.contains("radio-theatre"), false);
  setButtonIcon(loopButton, "refresh", audio.loop);
  updateShuffleButton();
  setButtonIcon(visualsButton, "treestatus", visualsPaused);
  updateMuteButton();
  audio.addEventListener("timeupdate", () => {
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
  });
  audio.addEventListener("play", updateTransport);
  audio.addEventListener("pause", updateTransport);
  audio.addEventListener("ended", () => {
    const hasMoreTracks = trackSelect.selectedIndex < trackSelect.options.length - 1;
    const canShuffleForward = shuffleEnabled && trackSelect.options.length > 1;
    if (!audio.loop && (hasMoreTracks || canShuffleForward)) changeTrack(1);
    else updateTransport();
  });
  audio.addEventListener("volumechange", updateMuteButton);
  audio.addEventListener("error", () => setMessage("The local track could not be loaded. Please try again in a moment."));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopRendering();
      window.clearTimeout(hudHideHandle);
      hudHideHandle = 0;
      syncPresetShuffle();
    } else {
      revealTheatreHud();
      if (!audio.paused && !visualsPaused) startRendering();
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
    } else if (key === "p" && !event.repeat) {
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
