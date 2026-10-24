(() => {
  "use strict";

  const muteButton = document.querySelector("[data-kt-music-toggle]");
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const pitchPoolCents = [-55, -35, -18, 0, 18, 35, 55];
  const scrollPitchSteps = [0, 2, 4, 5, 7, 9, 12];
  const newVoiceLimit = 18;
  const profiles = {
    click: {
      tones: [{ type: "triangle", frequency: 690, endFrequency: 330, duration: 0.055, gain: 0.045 }],
      noise: { frequency: 2500, endFrequency: 900, duration: 0.025, gain: 0.035 },
    },
    type: {
      tones: [{ type: "square", frequency: 1180, endFrequency: 720, duration: 0.032, gain: 0.018 }],
      noise: { frequency: 3300, endFrequency: 1550, duration: 0.016, gain: 0.025 },
    },
    scroll: {
      tones: [{ type: "sine", frequency: 310, duration: 0.06, gain: 0.006 }],
      noise: { frequency: 2600, endFrequency: 760, duration: 0.115, gain: 0.024 },
    },
    hover: {
      noise: { frequency: 2850, endFrequency: 1050, duration: 0.07, gain: 0.007 },
    },
    drag: {
      tones: [{ type: "triangle", frequency: 230, endFrequency: 920, duration: 0.17, gain: 0.022 }],
      noise: { frequency: 850, endFrequency: 2400, duration: 0.12, gain: 0.01 },
    },
    paperFlip: {
      tones: [{ type: "triangle", frequency: 610, endFrequency: 285, duration: 0.13, gain: 0.016 }],
      noise: { frequency: 2100, endFrequency: 690, duration: 0.15, gain: 0.03 },
    },
    copy: {
      tones: [
        { type: "sine", frequency: 1047, endFrequency: 1319, duration: 0.09, gain: 0.024 },
        { type: "sine", frequency: 1397, endFrequency: 1760, delay: 0.055, duration: 0.115, gain: 0.02 },
      ],
    },
    memberHover: {
      tones: [{ type: "sine", frequency: 620, endFrequency: 850, duration: 0.09, gain: 0.016 }],
    },
    memberClick: {
      tones: [{ type: "triangle", frequency: 455, endFrequency: 875, duration: 0.12, gain: 0.035 }],
      noise: { frequency: 2100, endFrequency: 1250, duration: 0.027, gain: 0.016 },
    },
    guestHover: {
      tones: [{ type: "sine", frequency: 510, endFrequency: 650, duration: 0.08, gain: 0.01 }],
    },
    guestClick: {
      tones: [{ type: "triangle", frequency: 390, endFrequency: 650, duration: 0.105, gain: 0.024 }],
      noise: { frequency: 1750, endFrequency: 980, duration: 0.022, gain: 0.011 },
    },
    memberLiveHover: {
      base: "memberHover",
      tones: [
        { type: "sine", frequency: 1047, endFrequency: 1319, delay: 0.018, duration: 0.12, gain: 0.009 },
        { type: "triangle", frequency: 1319, endFrequency: 1568, delay: 0.035, duration: 0.11, gain: 0.007 },
      ],
    },
    memberLiveClick: {
      base: "memberClick",
      tones: [
        { type: "sine", frequency: 831, endFrequency: 988, delay: 0.025, duration: 0.16, gain: 0.014 },
        { type: "sine", frequency: 1109, endFrequency: 1319, delay: 0.05, duration: 0.17, gain: 0.011 },
      ],
    },
    guestLiveHover: {
      base: "guestHover",
      tones: [
        { type: "sine", frequency: 988, endFrequency: 1175, delay: 0.025, duration: 0.105, gain: 0.005 },
      ],
    },
    guestLiveClick: {
      base: "guestClick",
      tones: [
        { type: "sine", frequency: 740, endFrequency: 880, delay: 0.03, duration: 0.15, gain: 0.009 },
        { type: "sine", frequency: 988, endFrequency: 1175, delay: 0.055, duration: 0.15, gain: 0.007 },
      ],
    },
    discordJoinHover: {
      tones: [{ type: "sine", frequency: 740, endFrequency: 988, duration: 0.09, gain: 0.012 }],
      noise: { frequency: 2700, endFrequency: 1550, duration: 0.035, gain: 0.006 },
    },
    discordJoinClick: {
      base: "memberClick",
      tones: [
        { type: "sine", frequency: 784, endFrequency: 1047, delay: 0.025, duration: 0.14, gain: 0.014 },
        { type: "sine", frequency: 1175, endFrequency: 1568, delay: 0.08, duration: 0.15, gain: 0.01 },
      ],
    },
    kickLinkHover: {
      tones: [{ type: "triangle", frequency: 520, endFrequency: 780, duration: 0.085, gain: 0.012 }],
    },
    kickLinkClick: {
      base: "click",
      tones: [
        { type: "triangle", frequency: 587, endFrequency: 784, duration: 0.085, gain: 0.02 },
        { type: "sine", frequency: 1175, endFrequency: 1568, delay: 0.055, duration: 0.12, gain: 0.012 },
      ],
    },
    languageMenuHover: {
      tones: [{ type: "sine", frequency: 680, endFrequency: 820, duration: 0.075, gain: 0.008 }],
      noise: { frequency: 2400, endFrequency: 1500, duration: 0.025, gain: 0.004 },
    },
    languageMenuClick: {
      tones: [
        { type: "triangle", frequency: 620, endFrequency: 820, duration: 0.075, gain: 0.016 },
        { type: "sine", frequency: 930, endFrequency: 1175, delay: 0.045, duration: 0.09, gain: 0.01 },
      ],
    },
    languageOptionHover: {
      tones: [{ type: "sine", frequency: 580, endFrequency: 740, duration: 0.07, gain: 0.008 }],
    },
    languageEnglish: {
      base: "click",
      tones: [{ type: "sine", frequency: 784, endFrequency: 1047, delay: 0.02, duration: 0.13, gain: 0.015 }],
    },
    languageSpanish: {
      base: "click",
      tones: [
        { type: "sine", frequency: 659, endFrequency: 784, delay: 0.02, duration: 0.1, gain: 0.014 },
        { type: "sine", frequency: 988, endFrequency: 1319, delay: 0.065, duration: 0.11, gain: 0.01 },
      ],
    },
    languageArabic: {
      base: "click",
      tones: [
        { type: "triangle", frequency: 698, endFrequency: 587, delay: 0.02, duration: 0.1, gain: 0.014 },
        { type: "sine", frequency: 880, endFrequency: 1047, delay: 0.075, duration: 0.1, gain: 0.009 },
      ],
    },
    languageTurkish: {
      base: "click",
      tones: [
        { type: "triangle", frequency: 523, endFrequency: 659, delay: 0.02, duration: 0.09, gain: 0.015 },
        { type: "sine", frequency: 784, endFrequency: 988, delay: 0.06, duration: 0.12, gain: 0.01 },
      ],
    },
    languageChinese: {
      base: "click",
      tones: [
        { type: "sine", frequency: 880, endFrequency: 1175, delay: 0.02, duration: 0.1, gain: 0.014 },
        { type: "sine", frequency: 1319, endFrequency: 1568, delay: 0.07, duration: 0.12, gain: 0.01 },
      ],
    },
    languagePortuguese: {
      base: "click",
      tones: [
        { type: "sine", frequency: 587, endFrequency: 740, delay: 0.02, duration: 0.09, gain: 0.015 },
        { type: "triangle", frequency: 988, endFrequency: 1319, delay: 0.065, duration: 0.12, gain: 0.011 },
      ],
    },
  };

  let muted = muteButton?.dataset.muted === "true";
  let userActivatedAudio = false;
  let audioContext = null;
  let masterGain = null;
  let noiseBuffer = null;
  let lastTypeSoundAt = -Infinity;
  let lastScrollSoundAt = -Infinity;
  let lastGenericHoverAt = -Infinity;
  let lastSpecificHoverAt = -Infinity;
  let scrollSequenceIndex = 0;
  let scrollSequenceDirection = null;
  let recentWheelDirection = null;
  let recentWheelDirectionAt = -Infinity;
  let dragCandidate = null;
  let activeVoices = new Set();
  const pitchBags = new Map();
  const previousScrollPositions = new WeakMap();

  const rootScroller = document.scrollingElement || document.documentElement;
  previousScrollPositions.set(rootScroller, {
    x: rootScroller.scrollLeft,
    y: rootScroller.scrollTop,
  });

  function shuffle(values) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
  }

  function nextPitch(cue) {
    let bag = pitchBags.get(cue);
    if (!bag?.length) {
      bag = shuffle([...pitchPoolCents]);
      const previous = pitchBags.get(`${cue}:last`);
      if (bag.length > 1 && bag[bag.length - 1] === previous) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
      pitchBags.set(cue, bag);
    }
    const cents = bag.pop();
    pitchBags.set(`${cue}:last`, cents);
    return 2 ** (cents / 1200);
  }

  function ensureAudioContext() {
    if (audioContext || !AudioContextClass) return audioContext;

    try {
      audioContext = new AudioContextClass({ latencyHint: "interactive" });
      masterGain = audioContext.createGain();
      masterGain.gain.value = muted ? 0 : 0.58;

      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 10;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.12;
      masterGain.connect(compressor);
      compressor.connect(audioContext.destination);

      noiseBuffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * 0.24), audioContext.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = Math.random() * 2 - 1;
      }
    } catch {
      audioContext?.close().catch(() => {});
      audioContext = null;
      masterGain = null;
      noiseBuffer = null;
    }

    return audioContext;
  }

  async function resumeAudio() {
    if (muted || !userActivatedAudio) return false;
    const context = ensureAudioContext();
    if (!context) return false;
    if (context.state !== "running") {
      try { await context.resume(); } catch { return false; }
    }
    return !muted && context.state === "running";
  }

  function disconnectVoice(voice, stopNow = false) {
    if (!activeVoices.has(voice)) return;
    activeVoices.delete(voice);
    window.clearTimeout(voice.cleanupTimer);
    if (stopNow) {
      voice.sources.forEach((source) => {
        try { source.stop(); } catch {}
      });
    }
    voice.nodes.forEach((node) => {
      try { node.disconnect(); } catch {}
    });
  }

  function stopAllVoices() {
    [...activeVoices].forEach((voice) => disconnectVoice(voice, true));
  }

  function makeEnvelope(context, destination, startAt, duration, peak, nodes) {
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), startAt + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    envelope.connect(destination);
    nodes.push(envelope);
    return envelope;
  }

  function startTone(context, voice, profile, pitchFactor, startAt) {
    const oscillator = context.createOscillator();
    const envelope = makeEnvelope(context, masterGain, startAt, profile.duration, profile.gain, voice.nodes);
    oscillator.type = profile.type || "sine";
    oscillator.frequency.setValueAtTime(profile.frequency * pitchFactor, startAt);
    if (profile.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(profile.endFrequency * pitchFactor, startAt + profile.duration);
    }
    oscillator.connect(envelope);
    voice.sources.push(oscillator);
    voice.nodes.push(oscillator);
    oscillator.start(startAt);
    oscillator.stop(startAt + profile.duration + 0.01);
  }

  function startNoise(context, voice, profile, pitchFactor, startAt) {
    if (!noiseBuffer) return;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    source.playbackRate.value = pitchFactor;

    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.72;
    filter.frequency.setValueAtTime(profile.frequency * pitchFactor, startAt);
    if (profile.endFrequency) {
      filter.frequency.exponentialRampToValueAtTime(profile.endFrequency * pitchFactor, startAt + profile.duration);
    }

    const envelope = makeEnvelope(context, masterGain, startAt, profile.duration, profile.gain, voice.nodes);
    source.connect(filter);
    filter.connect(envelope);
    voice.sources.push(source);
    voice.nodes.push(source, filter);
    source.start(startAt, Math.random() * noiseBuffer.duration);
    source.stop(startAt + profile.duration + 0.01);
  }

  function cueIsLowPriority(cue) {
    return cue === "scroll" || cue === "hover" || cue.endsWith("Hover");
  }

  async function play(cue, fixedPitchFactor = null) {
    const profile = profiles[cue];
    if (!profile || muted || !userActivatedAudio) return false;
    if (!await resumeAudio()) return false;
    if (activeVoices.size >= newVoiceLimit) {
      if (cueIsLowPriority(cue)) return false;
      const quietVoice = [...activeVoices].find((voice) => cueIsLowPriority(voice.cue));
      if (!quietVoice) return false;
      disconnectVoice(quietVoice, true);
    }
    if (muted) return false;

    const context = audioContext;
    const now = context.currentTime + 0.003;
    const pitchFactor = Number.isFinite(fixedPitchFactor) ? fixedPitchFactor : nextPitch(cue);
    const voice = { cue, sources: [], nodes: [], cleanupTimer: 0 };
    const baseProfile = profile.base ? profiles[profile.base] : null;
    const tones = [...(baseProfile?.tones || []), ...(profile.tones || [])];
    const noises = [baseProfile?.noise, profile.noise].filter(Boolean);
    activeVoices.add(voice);

    try {
      tones.forEach((tone) => {
        const startAt = now + (tone.delay || 0);
        startTone(context, voice, tone, pitchFactor, startAt);
      });
      noises.forEach((noise) => startNoise(context, voice, noise, pitchFactor, now));

      const longestSound = Math.max(
        ...[...tones, ...noises]
          .map((sound) => (sound.delay || 0) + sound.duration)
      );
      voice.cleanupTimer = window.setTimeout(() => disconnectVoice(voice), (longestSound + 0.08) * 1000);
      return true;
    } catch {
      disconnectVoice(voice, true);
      return false;
    }
  }

  function directionFromDelta(deltaX, deltaY) {
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return null;
    if (Math.abs(deltaY) >= Math.abs(deltaX)) return deltaY > 0 ? "down" : "up";
    return deltaX > 0 ? "right" : "left";
  }

  function rememberScrollDirection(direction) {
    if (!direction || direction === scrollSequenceDirection) return;
    scrollSequenceDirection = direction;
    scrollSequenceIndex = 0;
  }

  function cueForEntry(target, action) {
    if (!(target instanceof Element)) return null;
    const member = target.closest(".kt-member-grid > li > .kt-member");
    const guest = target.closest(".kt-recommendation-grid > li > .kt-recommendation-link");
    const card = member || guest;
    if (!card) return null;

    const category = member ? "member" : "guest";
    const live = card.dataset.liveState === "live";
    return `${category}${live ? "Live" : ""}${action}`;
  }

  function cueForControl(target, action) {
    if (!(target instanceof Element)) return null;
    if (target.closest(".kt-discord__join")) return `discordJoin${action}`;
    if (target.closest(".kt-kick-link")) return `kickLink${action}`;

    const languageOption = target.closest(".language-option, [data-language-option]");
    if (languageOption) {
      if (action === "Hover") return "languageOptionHover";
      const value = [
        languageOption.dataset.language,
        languageOption.dataset.languageName,
        languageOption.dataset.languageCode,
      ].filter(Boolean).join(" ").toLowerCase();
      if (value.includes("spanish") || /(^|\\s)es(?:-|\\s|$)/.test(value)) return "languageSpanish";
      if (value.includes("arabic") || /(^|\\s)ar(?:-|\\s|$)/.test(value)) return "languageArabic";
      if (value.includes("turkish") || /(^|\\s)tr(?:-|\\s|$)/.test(value)) return "languageTurkish";
      if (value.includes("chinese") || value.includes("zh")) return "languageChinese";
      if (value.includes("portuguese") || value.includes("pt")) return "languagePortuguese";
      return "languageEnglish";
    }

    if (target.closest(".language-button, [data-language-toggle]")) return `languageMenu${action}`;
    return null;
  }

  function isSpecialSoundControl(target) {
    return target instanceof Element && Boolean(target.closest(
      "[data-kt-music-toggle], [data-kt-copy-input], [data-kt-copy-target], [data-kt-badge-previous], [data-kt-badge-next]"
    ));
  }

  function unlockFromGesture(event) {
    if (!event.isTrusted) return;
    userActivatedAudio = true;
    if (muted || event.target?.closest?.("[data-kt-music-toggle]")) return;
    void resumeAudio();
  }

  document.addEventListener("pointerdown", (event) => {
    unlockFromGesture(event);
    if (event.isTrusted && event.button === 0 && event.isPrimary !== false) {
      dragCandidate = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    }
    if (!event.isTrusted || event.button !== 2) return;
    void play(cueForEntry(event.target, "Click") || "click");
  }, { capture: true, passive: true });

  document.addEventListener("pointermove", (event) => {
    if (!event.isTrusted || !dragCandidate || event.pointerId !== dragCandidate.pointerId || event.buttons === 0) return;
    if (Math.hypot(event.clientX - dragCandidate.x, event.clientY - dragCandidate.y) < 8) return;
    dragCandidate = null;
    void play("drag");
  }, { capture: true, passive: true });

  function clearDragCandidate(event) {
    if (dragCandidate && event.pointerId === dragCandidate.pointerId) dragCandidate = null;
  }

  document.addEventListener("pointerup", clearDragCandidate, { capture: true, passive: true });
  document.addEventListener("pointercancel", clearDragCandidate, { capture: true, passive: true });

  document.addEventListener("pointerover", (event) => {
    if (!event.isTrusted || event.pointerType === "touch" || !(event.target instanceof Element)) return;
    const cue = cueForEntry(event.target, "Hover");
    if (cue) {
      const card = event.target.closest(".kt-member-grid > li > .kt-member, .kt-recommendation-grid > li > .kt-recommendation-link");
      if (event.relatedTarget instanceof Node && card?.contains(event.relatedTarget)) return;
      void play(cue);
      return;
    }

    const controlCue = cueForControl(event.target, "Hover");
    if (controlCue) {
      const control = event.target.closest(".kt-discord__join, .kt-kick-link, .language-button, .language-option, [data-language-option], [data-language-toggle]");
      if (event.relatedTarget instanceof Node && control?.contains(event.relatedTarget)) return;
      const now = performance.now();
      if (now - lastSpecificHoverAt < 150) return;
      lastSpecificHoverAt = now;
      void play(controlCue);
      return;
    }

    const now = performance.now();
    if (now - lastGenericHoverAt < 180) return;
    lastGenericHoverAt = now;
    void play("hover");
  }, { capture: true, passive: true });

  document.addEventListener("click", (event) => {
    if (!event.isTrusted) return;
    userActivatedAudio = true;
    const target = event.target;
    const entryCue = cueForEntry(target, "Click");
    if (entryCue) {
      void play(entryCue);
      return;
    }
    const controlCue = cueForControl(target, "Click");
    if (controlCue) {
      void play(controlCue);
      return;
    }
    if (isSpecialSoundControl(target)) return;
    void play("click");
  }, { capture: true });

  document.addEventListener("keydown", (event) => {
    unlockFromGesture(event);
    if (!event.isTrusted || event.isComposing || event.repeat) return;
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    const now = performance.now();
    if (now - lastTypeSoundAt < 45) return;
    lastTypeSoundAt = now;
    void play("type");
  }, { capture: true });

  document.addEventListener("wheel", (event) => {
    unlockFromGesture(event);
    if (!event.isTrusted) return;
    const direction = directionFromDelta(event.deltaX, event.deltaY);
    if (direction) {
      recentWheelDirection = direction;
      recentWheelDirectionAt = performance.now();
    }
  }, { capture: true, passive: true });
  document.addEventListener("touchmove", unlockFromGesture, { capture: true, passive: true });
  document.addEventListener("scroll", (event) => {
    if (!event.isTrusted) return;
    const now = performance.now();
    const scroller = event.target instanceof Element
      ? event.target
      : document.scrollingElement || document.documentElement;
    const previous = previousScrollPositions.get(scroller);
    const current = { x: scroller.scrollLeft, y: scroller.scrollTop };
    previousScrollPositions.set(scroller, current);
    const movementDirection = previous
      ? directionFromDelta(current.x - previous.x, current.y - previous.y)
      : null;
    const wheelDirection = now - recentWheelDirectionAt < 800 ? recentWheelDirection : null;
    rememberScrollDirection(movementDirection || wheelDirection);

    if (now - lastScrollSoundAt < 500) return;
    lastScrollSoundAt = now;
    if (muted || !userActivatedAudio) return;

    const semitones = scrollPitchSteps[scrollSequenceIndex];
    const pitchFactor = 2 ** (semitones / 12);
    scrollSequenceIndex = (scrollSequenceIndex + 1) % scrollPitchSteps.length;
    void play("scroll", pitchFactor);
  }, { capture: true, passive: true });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden || !audioContext) return;
    stopAllVoices();
    if (audioContext.state === "running") audioContext.suspend().catch(() => {});
  });

  window.KazvtSfx = Object.freeze({
    play(cue) {
      void play(cue);
    },
    setMuted(nextMuted) {
      const next = Boolean(nextMuted);
      const wasMuted = muted;
      muted = next;
      if (muted) {
        if (audioContext && masterGain) {
          masterGain.gain.cancelScheduledValues(audioContext.currentTime);
          masterGain.gain.setValueAtTime(0, audioContext.currentTime);
        }
        stopAllVoices();
        if (audioContext?.state === "running") audioContext.suspend().catch(() => {});
        return;
      }
      if (wasMuted && userActivatedAudio) {
        const context = ensureAudioContext();
        if (context && masterGain) {
          masterGain.gain.setValueAtTime(0.58, context.currentTime);
          if (context.state !== "running") context.resume().catch(() => {});
        }
      }
    },
  });
})();
