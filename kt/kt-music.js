(() => {
  "use strict";

  const button = document.querySelector("[data-kt-music-toggle]");
  if (!button) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const preferenceKey = "kazvt-kt-pad-preference-v1";
  const preferenceLifetime = 24 * 60 * 60 * 1000;
  const fadeSeconds = 3.2;
  const rootSemitone = Math.floor(Math.random() * 12);
  // A major triad spread across two octaves: root, third, fifth and their
  // octave doublings. The voicing changes on each fresh page load.
  const chordIntervals = [0, 4, 7, 12, 16, 19, 24];

  let context = null;
  let padFilter = null;
  let master = null;
  let oscillators = [];
  let playing = false;
  let muted = false;
  let preferenceExpiresAt = 0;
  let preferenceTimer = 0;
  let generation = 0;

  function setButtonState() {
    button.textContent = muted ? "Unmute" : "Mute";
    button.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    button.setAttribute("aria-pressed", String(muted));
  }

  function removeStoredPreference() {
    try { localStorage.removeItem(preferenceKey); } catch {}
  }

  function readStoredPreference() {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || "null");
      const expiresAt = Number(saved?.expiresAt);
      if (typeof saved?.muted === "boolean" && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        preferenceExpiresAt = expiresAt;
        return saved.muted;
      }
    } catch {}
    removeStoredPreference();
    return false;
  }

  function expirePreference() {
    if (!preferenceExpiresAt || Date.now() < preferenceExpiresAt) return false;
    window.clearTimeout(preferenceTimer);
    preferenceTimer = 0;
    preferenceExpiresAt = 0;
    removeStoredPreference();
    if (muted) {
      muted = false;
      setButtonState();
      void startMusic();
    }
    return true;
  }

  function schedulePreferenceExpiry() {
    window.clearTimeout(preferenceTimer);
    if (!preferenceExpiresAt) return;
    const delay = Math.max(0, preferenceExpiresAt - Date.now());
    preferenceTimer = window.setTimeout(() => {
      if (!expirePreference()) schedulePreferenceExpiry();
    }, delay);
  }

  function rememberChoice() {
    preferenceExpiresAt = Date.now() + preferenceLifetime;
    try {
      localStorage.setItem(preferenceKey, JSON.stringify({ muted, expiresAt: preferenceExpiresAt }));
    } catch {}
    schedulePreferenceExpiry();
  }

  function createReverbImpulse(audioContext) {
    const duration = 2.25;
    const length = Math.floor(audioContext.sampleRate * duration);
    const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const tail = 1 - index / length;
        data[index] = (Math.random() * 2 - 1) * tail ** 2.8;
      }
    }
    return impulse;
  }

  function ensureAudioGraph() {
    if (context) return true;
    if (!AudioContextClass) return false;

    try {
      context = new AudioContextClass({ latencyHint: "playback" });
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1650;
      filter.Q.value = 0.5;
      padFilter = filter;

      master = context.createGain();
      master.gain.value = 0.0001;

      const dry = context.createGain();
      dry.gain.value = 0.82;
      const convolver = context.createConvolver();
      convolver.buffer = createReverbImpulse(context);
      const wet = context.createGain();
      wet.gain.value = 0.2;

      filter.connect(dry);
      dry.connect(master);
      filter.connect(convolver);
      convolver.connect(wet);
      wet.connect(master);
      master.connect(context.destination);
      return true;
    } catch {
      context?.close().catch(() => {});
      context = null;
      padFilter = null;
      master = null;
      return false;
    }
  }

  function startChord() {
    const now = context.currentTime;
    const midiRoot = 48 + rootSemitone;
    const voices = [];

    chordIntervals.forEach((interval, noteIndex) => {
      const frequency = 440 * (2 ** ((midiRoot + interval - 69) / 12));
      [-5, 5].forEach((detune, layerIndex) => {
        const oscillator = context.createOscillator();
        const voice = context.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.value = frequency;
        oscillator.detune.value = detune;
        voice.gain.setValueAtTime(0.0001, now);
        voice.gain.linearRampToValueAtTime(0.018, now + fadeSeconds);

        if (context.createStereoPanner) {
          const panner = context.createStereoPanner();
          panner.pan.value = (noteIndex % 2 ? 1 : -1) * (layerIndex ? 0.42 : 0.24);
          oscillator.connect(voice);
          voice.connect(panner);
          panner.connect(padFilter);
        } else {
          oscillator.connect(voice);
          voice.connect(padFilter);
        }

        oscillator.start(now);
        voices.push({ oscillator, voice });
      });
    });

    oscillators = voices;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.linearRampToValueAtTime(0.25, now + fadeSeconds);
    playing = true;
  }

  async function startMusic() {
    if (muted || playing) return;
    if (!ensureAudioGraph()) return;

    try {
      await context.resume();
      if (muted) {
        if (context.state === "running") context.suspend().catch(() => {});
        return;
      }
      if (context.state !== "running" || playing) return;
      startChord();
    } catch {}
  }

  function stopMusic() {
    if (!context || !master) return;
    if (!playing) {
      if (context.state === "running") context.suspend().catch(() => {});
      return;
    }
    playing = false;
    const stopGeneration = ++generation;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds);
    oscillators.forEach(({ oscillator, voice }) => {
      voice.gain.cancelScheduledValues(now);
      voice.gain.setValueAtTime(Math.max(0.0001, voice.gain.value), now);
      voice.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds - 0.1);
      try { oscillator.stop(now + fadeSeconds); } catch {}
    });
    window.setTimeout(() => {
      if (muted && generation === stopGeneration && context?.state === "running") {
        oscillators = [];
        context.suspend().catch(() => {});
      }
    }, (fadeSeconds + 0.15) * 1000);
  }

  button.addEventListener("click", () => {
    const wasMuted = muted;
    const expired = expirePreference();
    // If the old button said Unmute, the expiry itself has fulfilled that click.
    if (expired && wasMuted) return;
    muted = !muted;
    setButtonState();
    rememberChoice();
    if (muted) stopMusic();
    else void startMusic();
  });

  function unlockFromInteraction(event) {
    if (muted || event.target?.closest?.("[data-kt-music-toggle]")) return;
    void startMusic();
  }

  document.addEventListener("pointerdown", unlockFromInteraction, { passive: true });
  document.addEventListener("keydown", unlockFromInteraction);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !muted && !playing) void startMusic();
  });

  muted = readStoredPreference();
  setButtonState();
  schedulePreferenceExpiry();
  if (!muted) void startMusic();
})();
