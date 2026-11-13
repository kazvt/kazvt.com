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
  const cycleButton = document.getElementById("preset-cycle");
  const visualsButton = document.getElementById("visualizer-toggle");
  const playStatus = document.getElementById("air-status");
  const screenState = document.getElementById("screen-state");
  const playerMessage = document.getElementById("player-message");
  const seek = document.getElementById("track-seek");
  const volume = document.getElementById("track-volume");
  const volumeValue = document.getElementById("volume-value");
  const currentTime = document.getElementById("time-current");
  const totalTime = document.getElementById("time-total");
  const presetSelect = document.getElementById("preset-select");
  const presetName = document.getElementById("preset-name");
  const paletteSelect = document.getElementById("palette-select");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const theatreStorageKey = "kazvt-radio-theatre";

  let audioContext = null;
  let mediaSource = null;
  let visualizer = null;
  let presetMap = {};
  let presetKeys = [];
  let currentPresetKey = "";
  const defaultPresetKey = "Geiss - Cauldron - painterly 2 (saturation remix)";
  const crampedLegacyPresetKey = "Zylot - Paint Spill (Music Reactive Paint Mix)";
  let frameHandle = 0;
  let cycleHandle = 0;
  let autoCycle = false;
  let visualsPaused = reducedMotion.matches;
  let resizeObserver = null;

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

  function setButtonIcon(button, icon, title, active = false) {
    if (!button) return;
    button.dataset.icon = icon;
    button.title = title;
    button.classList.toggle("is-on", active);
  }

  function showFallback(message, state) {
    fallback.querySelector("p").textContent = message;
    screen.classList.remove("is-live");
    screen.classList.add("is-fallback");
    screenState.textContent = state;
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
    presetSelect.replaceChildren();
    presetKeys.forEach((key, index) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = `${String(index + 1).padStart(2, "0")} / ${key}`;
      presetSelect.append(option);
    });
    if (presetKeys.length) {
      const wanted = (() => { try { return localStorage.getItem("kazvt-radio-preset"); } catch { return null; } })();
      const migratedPreset = wanted === crampedLegacyPresetKey && presetKeys.includes(defaultPresetKey) ? defaultPresetKey : null;
      currentPresetKey = migratedPreset || (presetKeys.includes(wanted) ? wanted : (presetKeys.includes(defaultPresetKey) ? defaultPresetKey : presetKeys[0]));
      if (migratedPreset) {
        try { localStorage.setItem("kazvt-radio-preset", migratedPreset); } catch {}
      }
      presetSelect.value = currentPresetKey;
      presetName.textContent = currentPresetKey;
    }
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
    fallback.querySelector("p").textContent = "PRESS PLAY TO WAKE THE PICTURE";
    screenState.textContent = "VISUAL SIGNAL";
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
    presetSelect.value = key;
    presetName.textContent = key;
    try { localStorage.setItem("kazvt-radio-preset", key); } catch {}
    if (visualizer) visualizer.loadPreset(presetMap[key], blend);
  }

  function cyclePreset(step) {
    if (!presetKeys.length) return;
    const oldIndex = Math.max(0, presetKeys.indexOf(currentPresetKey));
    const nextIndex = (oldIndex + step + presetKeys.length) % presetKeys.length;
    pickPreset(presetKeys[nextIndex]);
  }

  function randomPreset() {
    if (!presetKeys.length) return;
    if (presetKeys.length < 2) return pickPreset(presetKeys[0]);
    let choice = currentPresetKey;
    while (choice === currentPresetKey) choice = presetKeys[Math.floor(Math.random() * presetKeys.length)];
    pickPreset(choice);
  }

  function syncAutoCycle() {
    window.clearInterval(cycleHandle);
    cycleHandle = 0;
    if (autoCycle && !visualsPaused && !audio.paused && !document.hidden) {
      cycleHandle = window.setInterval(randomPreset, 26000);
    }
  }

  function updateTransport() {
    const playing = !audio.paused && !audio.ended;
    playButton.textContent = playing ? "PAUSE" : "PLAY";
    playStatus.textContent = playing ? "ON AIR" : "STANDING BY";
    document.querySelector(".radio-air-status").classList.toggle("is-playing", playing);
    document.querySelector(".screen-rec").classList.toggle("is-playing", playing);
    if (playing) {
      if (visualsPaused) {
        showFallback("VISUALS PAUSED / THE MUSIC KEEPS PLAYING", "VISUALS PAUSED");
      } else if (screen.classList.contains("is-fallback")) {
        // Keep the fallback reason set by the failed start attempt.
      } else {
        screen.classList.add("is-live");
        screen.classList.remove("is-fallback");
        screenState.textContent = "VISUAL SIGNAL";
        startRendering();
      }
      syncAutoCycle();
    } else {
      if (audio.ended) screenState.textContent = "END OF SIDE A";
      else if (visualsPaused) showFallback("VISUALS PAUSED", "VISUALS PAUSED");
      else if (screen.classList.contains("is-fallback")) {
        // Keep the fallback reason set by the failed start attempt.
      }
      else if (visualizer) screenState.textContent = "READY";
      stopRendering();
      syncAutoCycle();
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
      if (visualsPaused) showFallback("VISUALS PAUSED / THE MUSIC KEEPS PLAYING", "VISUALS PAUSED");
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
      showFallback("AUDIO IS ON / VISUALS ARE UNAVAILABLE HERE", "AUDIO ONLY");
      setMessage("Audio will play, but this browser could not start the WebGL visualiser.");
      console.warn("Radio visualiser unavailable:", error);
    }

    const playRequest = audio.play();
    if (playRequest && typeof playRequest.catch === "function") {
      playRequest.catch(() => {
        setMessage("The track could not start. Check the audio file connection and try again.");
        if (visualizer && !visualsPaused) showFallback("PRESS PLAY TO WAKE THE PICTURE", "READY");
        updateTransport();
      });
    }
  }

  function updateMuteButton() {
    if (!muteButton) return;
    muteButton.textContent = audio.muted ? "UNMUTE" : "MUTE";
    muteButton.classList.toggle("is-on", audio.muted);
  }

  function toggleMute() {
    audio.muted = !audio.muted;
    updateMuteButton();
    setMessage(audio.muted ? "Radio muted. Press M or UNMUTE to bring it back." : "Sound is back on.");
  }

  function restartTrack() {
    audio.currentTime = 0;
    setMessage(audio.paused ? "Back to the beginning of the tape." : "Rewinding to the start…");
  }

  function isFullscreen() {
    return document.fullscreenElement === screen || document.webkitFullscreenElement === screen;
  }

  async function toggleFullscreen() {
    try {
      if (isFullscreen()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else {
        const request = screen.requestFullscreen || screen.webkitRequestFullscreen;
        if (!request) {
          setMessage("Full screen is not available in this browser.");
          return;
        }
        await request.call(screen);
      }
    } catch {
      setMessage("The browser could not open the full-screen visualizer.");
    }
  }

  playButton.addEventListener("click", togglePlay);
  screen.addEventListener("click", togglePlay);
  muteButton?.addEventListener("click", toggleMute);
  fullscreenButton?.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.textContent = isFullscreen() ? "EXIT FULL SCREEN" : "FULL SCREEN";
  });
  document.addEventListener("webkitfullscreenchange", () => {
    fullscreenButton.textContent = isFullscreen() ? "EXIT FULL SCREEN" : "FULL SCREEN";
  });
  document.getElementById("restart-track").addEventListener("click", restartTrack);
  document.getElementById("loop-toggle").addEventListener("click", (event) => {
    audio.loop = !audio.loop;
    event.currentTarget.textContent = `REPEAT: ${audio.loop ? "ON" : "OFF"}`;
    event.currentTarget.classList.toggle("is-on", audio.loop);
  });
  document.getElementById("preset-prev").addEventListener("click", () => cyclePreset(-1));
  document.getElementById("preset-next").addEventListener("click", () => cyclePreset(1));
  document.getElementById("preset-random").addEventListener("click", randomPreset);
  document.getElementById("preset-cycle").addEventListener("click", (event) => {
    autoCycle = !autoCycle;
    event.currentTarget.textContent = `AUTO-TUNE: ${autoCycle ? "ON" : "OFF"}`;
    event.currentTarget.classList.toggle("is-on", autoCycle);
    syncAutoCycle();
  });
  document.getElementById("preset-select").addEventListener("change", (event) => pickPreset(event.currentTarget.value));

  document.getElementById("visualizer-toggle")?.addEventListener("click", (event) => {
    visualsPaused = !visualsPaused;
    event.currentTarget.textContent = visualsPaused ? "VISUALS: OFF" : "VISUALS: ON";
    event.currentTarget.classList.toggle("is-on", visualsPaused);
    if (visualsPaused) {
      stopRendering();
      showFallback(audio.paused ? "VISUALS PAUSED" : "VISUALS PAUSED / THE MUSIC KEEPS PLAYING", "VISUALS PAUSED");
      syncAutoCycle();
    } else {
      try {
        if (!visualizer) initVisualizer();
        if (audioContext && audioContext.state === "suspended") audioContext.resume().catch(() => {});
        if (audio.paused) showFallback("PRESS PLAY TO WAKE THE PICTURE", "READY");
        else {
          screen.classList.add("is-live");
          screen.classList.remove("is-fallback");
          screenState.textContent = "VISUAL SIGNAL";
          startRendering();
        }
        syncAutoCycle();
      } catch (error) {
        if (audioContext && !mediaSource) {
          audioContext.close().catch(() => {});
          audioContext = null;
        }
        showFallback("AUDIO IS ON / VISUALS ARE UNAVAILABLE HERE", "AUDIO ONLY");
        console.warn("Radio visualiser unavailable:", error);
      }
    }
  });

  seek.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(seek.value);
      currentTime.textContent = formatTime(audio.currentTime);
    }
  });
  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    if (audio.volume > 0 && audio.muted) audio.muted = false;
    volumeValue.textContent = `${Math.round(audio.volume * 100)}%`;
    updateMuteButton();
  });
  audio.volume = Number(volume.value);
  updateMuteButton();
  audio.addEventListener("timeupdate", () => {
    currentTime.textContent = formatTime(audio.currentTime);
    if (!seek.matches(":active")) seek.value = String(audio.currentTime || 0);
  });
  audio.addEventListener("loadedmetadata", () => {
    seek.max = String(Number.isFinite(audio.duration) ? audio.duration : 100);
    totalTime.textContent = formatTime(audio.duration);
  });
  audio.addEventListener("play", updateTransport);
  audio.addEventListener("pause", updateTransport);
  audio.addEventListener("ended", updateTransport);
  audio.addEventListener("volumechange", updateMuteButton);
  audio.addEventListener("error", () => setMessage("The local track could not be loaded. Please try again in a moment."));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopRendering();
      syncAutoCycle();
    } else {
      if (!audio.paused && !visualsPaused) startRendering();
      syncAutoCycle();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "kazvt-theme" && event.newValue) setTheme(event.newValue, false);
  });
  paletteSelect?.addEventListener("change", () => setTheme(paletteSelect.value));

  function isControlTarget(target) {
    return target instanceof Element && Boolean(target.closest("input, textarea, select, button, a, summary, [contenteditable='true']"));
  }

  document.addEventListener("keydown", (event) => {
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
      audio.volume = nextVolume;
      if (nextVolume > 0) audio.muted = false;
      volumeValue.textContent = `${Math.round(nextVolume * 100)}%`;
      updateMuteButton();
    } else if (key === "m" && !event.repeat) {
      toggleMute();
    } else if (key === "f" && !event.repeat) {
      toggleFullscreen();
    } else if (key === "r" && !event.repeat) {
      restartTrack();
    } else if (key === "n" && !event.repeat) {
      cyclePreset(1);
    } else if (key === "p" && !event.repeat) {
      cyclePreset(-1);
    }
  });

  if (reducedMotion.matches) {
    const visualToggle = document.getElementById("visualizer-toggle");
    if (visualToggle) {
      visualToggle.textContent = "VISUALS: OFF";
      visualToggle.classList.add("is-on");
    }
    showFallback("VISUALS PAUSED / TAP VISUALS: ON TO ENABLE", "VISUALS PAUSED");
  }

  setTheme(document.body.dataset.theme || "p16", false);
  try {
    populatePresets();
  } catch (error) {
    presetSelect.replaceChildren();
    const option = document.createElement("option");
    option.textContent = "Visual modes unavailable";
    presetSelect.append(option);
    setMessage("Audio is ready; the visual preset library could not be loaded.");
    console.warn("Radio visual presets unavailable:", error);
  }
})();
