(() => {
  "use strict";

  const muteButton = document.querySelector("[data-kt-music-toggle]");
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const pitchPoolCents = [-55, -35, -18, 0, 18, 35, 55];
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
      tones: [{ type: "sine", frequency: 390, endFrequency: 540, duration: 0.09, gain: 0.009 }],
      noise: { frequency: 1450, endFrequency: 610, duration: 0.085, gain: 0.019 },
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
  };

  let muted = muteButton?.dataset.muted === "true";
  let userActivatedAudio = false;
  let audioContext = null;
  let masterGain = null;
  let noiseBuffer = null;
  let lastTypeSoundAt = -Infinity;
  let lastScrollSoundAt = -Infinity;
  let activeVoices = new Set();
  const pitchBags = new Map();

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
    return cue === "scroll" || cue.endsWith("Hover");
  }

  async function play(cue) {
    const profile = profiles[cue];
    if (!profile || muted || !userActivatedAudio) return;
    if (!await resumeAudio()) return;
    if (activeVoices.size >= newVoiceLimit) {
      if (cueIsLowPriority(cue)) return;
      const quietVoice = [...activeVoices].find((voice) => cueIsLowPriority(voice.cue));
      if (!quietVoice) return;
      disconnectVoice(quietVoice, true);
    }
    if (muted) return;

    const context = audioContext;
    const now = context.currentTime + 0.003;
    const pitchFactor = nextPitch(cue);
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
    } catch {
      disconnectVoice(voice, true);
    }
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
    if (!event.isTrusted || event.button !== 2) return;
    void play(cueForEntry(event.target, "Click") || "click");
  }, { capture: true, passive: true });

  document.addEventListener("pointerover", (event) => {
    if (!event.isTrusted || event.pointerType === "touch" || !(event.target instanceof Element)) return;
    const cue = cueForEntry(event.target, "Hover");
    if (!cue) return;
    const card = event.target.closest(".kt-member-grid > li > .kt-member, .kt-recommendation-grid > li > .kt-recommendation-link");
    if (event.relatedTarget instanceof Node && card?.contains(event.relatedTarget)) return;
    void play(cue);
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

  document.addEventListener("wheel", unlockFromGesture, { capture: true, passive: true });
  document.addEventListener("touchmove", unlockFromGesture, { capture: true, passive: true });
  document.addEventListener("scroll", (event) => {
    if (!event.isTrusted) return;
    const now = performance.now();
    if (now - lastScrollSoundAt < 500) return;
    lastScrollSoundAt = now;
    void play("scroll");
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
