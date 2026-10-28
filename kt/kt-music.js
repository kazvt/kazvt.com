(() => {
  "use strict";

  const button = document.querySelector("[data-kt-music-toggle]");
  if (!button) return;
  const buttonLabel = button.querySelector("[data-kt-music-toggle-label]");
  const buttonStateLabel = button.querySelector("[data-kt-music-state]");

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const preferenceKey = "kazvt-kt-pad-preference-v1";
  const preferenceLifetime = 24 * 60 * 60 * 1000;
  const fadeSeconds = 3.2;
  const padAttackSeconds = 4.8;
  const rootSemitone = Math.floor(Math.random() * 12);
  // A major triad spread across two octaves: root, third, fifth and their
  // octave doublings. The voicing changes on each fresh page load.
  const chordIntervals = [0, 4, 7, 12, 16, 19, 24];
  // Four bars into each 8-bar register, bloom a quieter high fifth, major
  // seventh, and root octave; release them just before the next register shift.
  const chordLiftIntervals = [31, 35, 36];
  const chordLiftGain = 0.0038;
  const chordLiftFadeDuration = 4.2;
  // The pad has no audible beat, so count a quiet 4/4 pulse at 60 BPM.
  // Every 8 bars (32 seconds), cycle root -> -7 -> root -> +5 -> root.
  const beatsPerBar = 4;
  const tempoBpm = 60;
  const barDuration = (60 / tempoBpm) * beatsPerBar;
  const registerChangeInterval = 8 * barDuration;
  const registerGlideDuration = 0.75;
  const registerPitchCycle = [-7, 0, 5, 0];
  const registerScheduleLookahead = 10 * 60;

  let context = null;
  let padFilter = null;
  let master = null;
  let oscillators = [];
  let chordLiftVoices = [];
  let playing = false;
  let muted = false;
  let preferenceExpiresAt = 0;
  let preferenceTimer = 0;
  let generation = 0;
  let registerScheduleTimer = 0;
  let registerCycleStart = 0;
  let scheduledRegisterChanges = 0;
  let scheduledChordSegments = 0;

  function localizedMessage(key, fallback) {
    return window.KazvtI18n?.t?.(key) || fallback;
  }

  function syncAudioSignal() {
    button.dataset.audioPlaying = String(!muted && playing && context?.state === "running");
  }

  function setButtonState() {
    const action = muted
      ? localizedMessage("kt.music_unmute", "UNMUTE")
      : localizedMessage("kt.music_mute", "MUTE");
    const state = muted
      ? localizedMessage("kt.music_state_muted", "SOUND OFF")
      : localizedMessage("kt.music_state_on", "SOUND ON");
    const accessibleAction = muted
      ? localizedMessage("kt.music_unmute_aria", "Unmute all site audio")
      : localizedMessage("kt.music_mute_aria", "Mute all site audio");

    if (buttonLabel) buttonLabel.textContent = action;
    if (buttonStateLabel) buttonStateLabel.textContent = state;
    button.dataset.muted = String(muted);
    syncAudioSignal();
    window.KazvtSfx?.setMuted(muted);
    button.setAttribute("aria-label", accessibleAction);
    button.title = accessibleAction;
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

  function scheduleRegisterChange(when, fromSemitones, toSemitones) {
    const startFactor = 2 ** (fromSemitones / 12);
    const endFactor = 2 ** (toSemitones / 12);
    oscillators.forEach(({ oscillator, frequency }) => {
      oscillator.frequency.setValueAtTime(frequency * startFactor, when);
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * endFactor,
        when + registerGlideDuration
      );
    });
  }

  function scheduleChordLift(segmentStart) {
    const liftAt = segmentStart + registerChangeInterval / 2;
    const segmentEnd = segmentStart + registerChangeInterval;
    const liftOutAt = segmentEnd - chordLiftFadeDuration;

    chordLiftVoices.forEach((voice) => {
      voice.gain.setValueAtTime(0.0001, liftAt);
      voice.gain.linearRampToValueAtTime(chordLiftGain, liftAt + chordLiftFadeDuration);
      voice.gain.setValueAtTime(chordLiftGain, liftOutAt);
      voice.gain.linearRampToValueAtTime(0.0001, segmentEnd);
    });
  }

  function extendRegisterSchedule(throughTime) {
    while (registerCycleStart + (scheduledRegisterChanges + 1) * registerChangeInterval <= throughTime) {
      const changeAt = registerCycleStart + (scheduledRegisterChanges + 1) * registerChangeInterval;
      const targetSemitones = registerPitchCycle[scheduledRegisterChanges % registerPitchCycle.length];
      const currentSemitones = scheduledRegisterChanges === 0
        ? 0
        : registerPitchCycle[(scheduledRegisterChanges - 1) % registerPitchCycle.length];
      scheduleRegisterChange(changeAt, currentSemitones, targetSemitones);
      scheduledRegisterChanges += 1;
    }

    while (registerCycleStart + scheduledChordSegments * registerChangeInterval + registerChangeInterval / 2 <= throughTime) {
      const segmentStart = registerCycleStart + scheduledChordSegments * registerChangeInterval;
      scheduleChordLift(segmentStart);
      scheduledChordSegments += 1;
    }
  }

  function startRegisterCycle(startTime) {
    window.clearInterval(registerScheduleTimer);
    registerCycleStart = startTime;
    scheduledRegisterChanges = 0;
    scheduledChordSegments = 0;
    extendRegisterSchedule(startTime + registerScheduleLookahead);
    registerScheduleTimer = window.setInterval(() => {
      if (!playing || !context || context.state !== "running") return;
      extendRegisterSchedule(context.currentTime + registerScheduleLookahead);
    }, 30_000);
  }

  function ensureAudioGraph() {
    if (context) return true;
    if (!AudioContextClass) return false;

    try {
      context = new AudioContextClass({ latencyHint: "playback" });
      context.addEventListener("statechange", syncAudioSignal);
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      // Keep the chord body intact while gently tucking away the brightest lift notes.
      filter.frequency.value = 1400;
      filter.Q.value = 0.5;
      padFilter = filter;

      master = context.createGain();
      master.gain.value = 0.0001;

      const direct = context.createGain();
      direct.gain.value = 0.82;

      // Keep the existing restrained dual-tap chorus for gentle stereo width.
      // The pad itself stays dry: its softer, more distant character comes from
      // the oscillator timbre, slower envelopes, and lower voice levels.
      const chorusWet = context.createGain();
      chorusWet.gain.value = 0.13;
      chorusWet.connect(master);
      [
        { delaySeconds: 0.014, rateHz: 0.16, depthSeconds: 0.0024, pan: -0.74 },
        { delaySeconds: 0.021, rateHz: 0.21, depthSeconds: 0.003, pan: 0.74 }
      ].forEach(({ delaySeconds, rateHz, depthSeconds, pan }) => {
        const delay = context.createDelay(0.05);
        delay.delayTime.value = delaySeconds;
        const lfo = context.createOscillator();
        lfo.frequency.value = rateHz;
        const depth = context.createGain();
        depth.gain.value = depthSeconds;
        lfo.connect(depth);
        depth.connect(delay.delayTime);

        const tap = context.createGain();
        tap.gain.value = 0.5;
        const panner = context.createStereoPanner?.();
        if (panner) {
          panner.pan.value = pan;
          tap.connect(panner);
          panner.connect(chorusWet);
        } else {
          tap.connect(chorusWet);
        }

        filter.connect(delay);
        delay.connect(tap);
        lfo.start();
      });

      filter.connect(direct);
      direct.connect(master);
      master.connect(context.destination);
      return true;
    } catch {
      context?.close().catch(() => {});
      context = null;
      padFilter = null;
      master = null;
      chordLiftVoices = [];
      return false;
    }
  }

  function startChord() {
    const now = context.currentTime;
    const midiRoot = 48 + rootSemitone;
    const voices = [];
    const liftVoices = [];
    const chordTones = [
      ...chordIntervals.map((interval) => ({ interval, lift: false })),
      ...chordLiftIntervals.map((interval) => ({ interval, lift: true }))
    ];

    chordTones.forEach(({ interval, lift }, noteIndex) => {
      const frequency = 440 * (2 ** ((midiRoot + interval - 69) / 12));
      (lift ? [-2, 2] : [-3, 3]).forEach((detune, layerIndex) => {
        const oscillator = context.createOscillator();
        const voice = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.detune.value = detune;
        voice.gain.setValueAtTime(0.0001, now);
        if (!lift) voice.gain.linearRampToValueAtTime(0.0135, now + padAttackSeconds);

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
        voices.push({ oscillator, voice, frequency });
        if (lift) liftVoices.push(voice);
      });
    });

    oscillators = voices;
    chordLiftVoices = liftVoices;
    startRegisterCycle(now);
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.linearRampToValueAtTime(0.125, now + fadeSeconds);
    playing = true;
    syncAudioSignal();
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
    window.clearInterval(registerScheduleTimer);
    registerScheduleTimer = 0;
    if (!context || !master) return;
    if (!playing) {
      if (context.state === "running") context.suspend().catch(() => {});
      syncAudioSignal();
      return;
    }
    playing = false;
    syncAudioSignal();
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
    if (expired && wasMuted) {
      window.KazvtSfx?.play("click");
      return;
    }
    muted = !muted;
    setButtonState();
    rememberChoice();
    if (muted) stopMusic();
    else {
      void startMusic();
      window.KazvtSfx?.play("click");
    }
  });

  window.addEventListener("kazvt:i18nready", setButtonState);
  window.addEventListener("kazvt:languagechange", setButtonState);

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
