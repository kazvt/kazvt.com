const PIXEL_HASH_TILE_SIZE = 512;
const MAX_REWARD_PIXEL_COUNT = 24_000_000;
const TILES_PER_YIELD = 4;

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

const MAJOR_PROGRESSIONS = [
  [0, 4, 5, 3],
  [0, 5, 3, 4],
  [5, 3, 0, 4],
  [0, 3, 4, 0]
];

const MINOR_PROGRESSIONS = [
  [0, 5, 2, 6],
  [0, 3, 5, 4],
  [0, 6, 5, 6],
  [0, 5, 3, 4]
];

const ARP_PATTERNS = [
  [0, 1, 2, 3, 2, 1, 2, 3],
  [0, 2, 1, 3, 2, 0, 1, 2],
  [3, 2, 1, 0, 1, 2, 3, 2],
  [0, 1, 0, 2, 1, 2, 3, 2]
];

const CHORD_PATCHES = [
  {
    id: "soft-pad",
    label: "Soft Pad",
    layers: [{ type: "sine", detune: -5, mix: 0.58 }, { type: "triangle", detune: 5, mix: 0.42 }],
    cutoff: 1450,
    attack: 0.36,
    release: 0.48,
    level: 0.13
  },
  {
    id: "worn-keys",
    label: "Worn Keys",
    layers: [{ type: "triangle", detune: -2, mix: 0.72 }, { type: "sine", detune: 2, mix: 0.28 }],
    cutoff: 2600,
    attack: 0.018,
    release: 0.24,
    level: 0.16
  },
  {
    id: "soft-organ",
    label: "Soft Organ",
    layers: [{ type: "triangle", detune: 0, mix: 0.7 }, { type: "square", detune: 0, mix: 0.3 }],
    cutoff: 1800,
    attack: 0.055,
    release: 0.2,
    level: 0.13
  },
  {
    id: "dream-keys",
    label: "Dream Keys",
    layers: [{ type: "sine", detune: -3, mix: 0.62 }, { type: "triangle", detune: 3, mix: 0.38 }],
    cutoff: 3300,
    attack: 0.03,
    release: 0.3,
    level: 0.15
  }
];

const ARP_PATCHES = [
  {
    id: "glass-pluck",
    label: "Glass Pluck",
    layers: [{ type: "triangle", detune: -2, mix: 0.68 }, { type: "sine", detune: 2, mix: 0.32 }],
    cutoff: 3800,
    attack: 0.008,
    decay: 0.16,
    release: 0.07,
    level: 0.2
  },
  {
    id: "round-lead",
    label: "Round Lead",
    layers: [{ type: "sine", detune: 0, mix: 0.62 }, { type: "triangle", detune: 0, mix: 0.38 }],
    cutoff: 3000,
    attack: 0.012,
    decay: 0.2,
    release: 0.08,
    level: 0.18
  },
  {
    id: "bit-pluck",
    label: "Bit Pluck",
    layers: [{ type: "square", detune: 0, mix: 0.34 }, { type: "triangle", detune: 0, mix: 0.66 }],
    cutoff: 2200,
    attack: 0.004,
    decay: 0.13,
    release: 0.055,
    level: 0.15
  },
  {
    id: "soft-saw-lead",
    label: "Soft Saw Lead",
    layers: [{ type: "sawtooth", detune: -2, mix: 0.42 }, { type: "triangle", detune: 2, mix: 0.58 }],
    cutoff: 1450,
    attack: 0.014,
    decay: 0.22,
    release: 0.085,
    level: 0.14
  }
];

const textEncoder = new TextEncoder();

function concatenateBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function toHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function yieldToBrowser() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Hash every decoded RGBA pixel without allocating one enormous image buffer.
 * SHA-256 tile digests are combined with dimensions and tile coordinates so the
 * result remains stable across filenames and captures transparent pixels too.
 */
export async function hashRewardPixels(image, {
  documentRef = globalThis.document,
  cryptoRef = globalThis.crypto,
  onProgress = null
} = {}) {
  const width = Number(image?.naturalWidth || image?.width);
  const height = Number(image?.naturalHeight || image?.height);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error("Reward artwork has invalid pixel dimensions.");
  }
  if (width * height > MAX_REWARD_PIXEL_COUNT) {
    throw new Error("Reward artwork is too large to fingerprint efficiently.");
  }
  if (!documentRef?.createElement || typeof cryptoRef?.subtle?.digest !== "function") {
    throw new Error("Pixel fingerprinting is unavailable in this browser.");
  }

  const canvas = documentRef.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("A canvas could not be created for the reward artwork.");

  const tileDigests = [];
  const columns = Math.ceil(width / PIXEL_HASH_TILE_SIZE);
  const rows = Math.ceil(height / PIXEL_HASH_TILE_SIZE);
  const tileCount = columns * rows;
  let completed = 0;

  for (let top = 0; top < height; top += PIXEL_HASH_TILE_SIZE) {
    for (let left = 0; left < width; left += PIXEL_HASH_TILE_SIZE) {
      const tileWidth = Math.min(PIXEL_HASH_TILE_SIZE, width - left);
      const tileHeight = Math.min(PIXEL_HASH_TILE_SIZE, height - top);
      canvas.width = tileWidth;
      canvas.height = tileHeight;
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, tileWidth, tileHeight);
      context.drawImage(image, left, top, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);

      const pixels = context.getImageData(0, 0, tileWidth, tileHeight).data;
      const tileHeader = textEncoder.encode(`${left},${top},${tileWidth},${tileHeight}\u0000`);
      const tileInput = concatenateBytes([tileHeader, pixels]);
      const digest = await cryptoRef.subtle.digest("SHA-256", tileInput);
      tileDigests.push(new Uint8Array(digest));

      completed += 1;
      if (typeof onProgress === "function") onProgress(completed, tileCount);
      if (completed % TILES_PER_YIELD === 0 && completed < tileCount) await yieldToBrowser();
    }
  }

  const rootHeader = textEncoder.encode(
    `kazvt.reward-pixels.sha256.v1\u0000${width}x${height}\u0000${PIXEL_HASH_TILE_SIZE}\u0000${tileCount}\u0000`
  );
  const rootDigest = await cryptoRef.subtle.digest("SHA-256", concatenateBytes([rootHeader, ...tileDigests]));
  return toHex(new Uint8Array(rootDigest));
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function selectIndex(random, length) {
  return Math.min(length - 1, Math.floor(random() * length));
}

export function deriveRewardMusicPlan(pixelHash) {
  if (typeof pixelHash !== "string" || !/^[a-f0-9]{64}$/i.test(pixelHash)) {
    throw new TypeError("A SHA-256 reward-pixel hash is required.");
  }

  const normalizedHash = pixelHash.toLowerCase();
  const keyVariant = Number.parseInt(normalizedHash.slice(0, 8), 16) % 24;
  const pitchClass = keyVariant % 12;
  const mode = keyVariant < 12 ? "major" : "minor";
  const scale = mode === "major" ? MAJOR_SCALE : MINOR_SCALE;
  const seed = Number.parseInt(normalizedHash.slice(8, 16), 16) || 0x9e3779b9;
  const random = createSeededRandom(seed);
  const progressionPool = mode === "major" ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;

  return {
    keyName: `${NOTE_NAMES[pitchClass]} ${mode}`,
    pitchClass,
    mode,
    scale: [...scale],
    bpm: 78 + Math.floor(random() * 25),
    progression: [...progressionPool[selectIndex(random, progressionPool.length)]],
    arpPattern: [...ARP_PATTERNS[selectIndex(random, ARP_PATTERNS.length)]],
    chordPatch: CHORD_PATCHES[selectIndex(random, CHORD_PATCHES.length)],
    arpPatch: ARP_PATCHES[selectIndex(random, ARP_PATCHES.length)]
  };
}

function midiFrequency(note) {
  return 440 * (2 ** ((note - 69) / 12));
}

function scaleSemitone(degree, scale) {
  const octave = Math.floor(degree / scale.length);
  return scale[degree % scale.length] + octave * 12;
}

function chordMidiNotes(plan, degree) {
  const root = 48 + plan.pitchClass + scaleSemitone(degree, plan.scale);
  return [0, 2, 4, 6].map(interval => root + scaleSemitone(interval, plan.scale));
}

function scheduleVoice(context, trackGain, patch, midiNote, startTime, duration, pluck) {
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(patch.cutoff, startTime);
  filter.Q.setValueAtTime(0.55, startTime);

  const envelope = context.createGain();
  const attack = Math.min(patch.attack, duration * 0.35);
  const release = Math.min(patch.release, duration * 0.35);
  const peak = patch.level;
  const releaseStart = Math.max(startTime + attack, startTime + duration - release);
  envelope.gain.setValueAtTime(0, startTime);
  envelope.gain.linearRampToValueAtTime(peak, startTime + attack);

  if (pluck) {
    const decayEnd = Math.min(releaseStart, startTime + attack + patch.decay);
    envelope.gain.linearRampToValueAtTime(peak * 0.28, decayEnd);
    envelope.gain.setValueAtTime(peak * 0.28, releaseStart);
  } else {
    envelope.gain.setValueAtTime(peak, releaseStart);
  }
  envelope.gain.linearRampToValueAtTime(0, startTime + duration);
  filter.connect(envelope).connect(trackGain);

  for (const layer of patch.layers) {
    const oscillator = context.createOscillator();
    const layerGain = context.createGain();
    oscillator.type = layer.type;
    oscillator.frequency.setValueAtTime(midiFrequency(midiNote), startTime);
    oscillator.detune.setValueAtTime(layer.detune, startTime);
    layerGain.gain.setValueAtTime(layer.mix, startTime);
    oscillator.connect(layerGain).connect(filter);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.015);
  }
}

/** Create a user-started, low-node-count two-track synth loop for one reward. */
export function createRewardMusicPlayer(plan, {
  onStateChange = () => {},
  audioContextConstructor = globalThis.AudioContext || globalThis.webkitAudioContext,
  documentRef = globalThis.document,
  initialVolume = 0.42
} = {}) {
  let context = null;
  let masterGain = null;
  let chordGain = null;
  let arpGain = null;
  let compressor = null;
  let timer = 0;
  let suspendTimer = 0;
  let isPlaying = false;
  let stepIndex = 0;
  let nextStepTime = 0;
  let volume = Math.min(0.8, Math.max(0, initialVolume));
  let chordEnabled = true;
  let arpEnabled = true;
  let destroyed = false;

  const beatSeconds = 60 / plan.bpm;
  const stepSeconds = beatSeconds / 2;
  const stepsPerBar = 8;
  const lookAheadSeconds = 0.13;
  const schedulerIntervalMs = 25;

  function notify() {
    onStateChange({
      playing: isPlaying,
      chordsEnabled: chordEnabled,
      arpEnabled,
      volume
    });
  }

  function ensureAudioGraph() {
    if (context) return;
    if (typeof audioContextConstructor !== "function") {
      throw new Error("Web Audio is not supported by this browser.");
    }

    context = new audioContextConstructor({ latencyHint: "interactive" });
    masterGain = context.createGain();
    chordGain = context.createGain();
    arpGain = context.createGain();
    compressor = context.createDynamicsCompressor();
    chordGain.gain.value = chordEnabled ? 0.78 : 0;
    arpGain.gain.value = arpEnabled ? 0.58 : 0;
    masterGain.gain.value = 0;
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;
    chordGain.connect(masterGain);
    arpGain.connect(masterGain);
    masterGain.connect(compressor).connect(context.destination);
    documentRef?.addEventListener?.("visibilitychange", handleVisibilityChange);
  }

  function scheduleChord(degree, time) {
    const notes = chordMidiNotes(plan, degree);
    const barDuration = beatSeconds * 4;
    for (const note of notes) {
      scheduleVoice(context, chordGain, plan.chordPatch, note, time, barDuration, false);
    }
  }

  function scheduleArp(degree, step, time) {
    const notes = chordMidiNotes(plan, degree);
    const noteIndex = plan.arpPattern[step % plan.arpPattern.length];
    const note = notes[noteIndex] + 12;
    scheduleVoice(context, arpGain, plan.arpPatch, note, time, stepSeconds * 0.88, true);
  }

  function scheduleStep(time, index) {
    const bar = Math.floor(index / stepsPerBar) % plan.progression.length;
    const stepInBar = index % stepsPerBar;
    const degree = plan.progression[bar];
    if (chordEnabled && stepInBar === 0) scheduleChord(degree, time);
    if (arpEnabled) scheduleArp(degree, stepInBar, time);
  }

  function scheduler() {
    if (!isPlaying || !context || context.state !== "running") return;
    const horizon = context.currentTime + lookAheadSeconds;
    while (nextStepTime < horizon) {
      scheduleStep(nextStepTime, stepIndex);
      stepIndex = (stepIndex + 1) % (stepsPerBar * plan.progression.length);
      nextStepTime += stepSeconds;
    }
    timer = globalThis.setTimeout(scheduler, schedulerIntervalMs);
  }

  function beginScheduling() {
    if (!isPlaying || !context || context.state !== "running") return;
    nextStepTime = context.currentTime + 0.04;
    scheduler();
  }

  function handleVisibilityChange() {
    if (!context || !isPlaying) return;
    if (documentRef.hidden) {
      globalThis.clearTimeout(timer);
      timer = 0;
      context.suspend().catch(() => {});
      return;
    }

    context.resume().then(() => {
      if (isPlaying) beginScheduling();
    }).catch(() => {
      isPlaying = false;
      notify();
    });
  }

  function start() {
    if (destroyed) throw new Error("The reward music player was closed.");
    if (isPlaying) return Promise.resolve();
    ensureAudioGraph();
    globalThis.clearTimeout(suspendTimer);
    isPlaying = true;
    stepIndex = 0;
    const now = context.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(volume, now + 0.06);

    // Call resume synchronously from the click handler to satisfy autoplay policy.
    const resumePromise = context.state === "running" ? Promise.resolve() : context.resume();
    notify();
    return resumePromise.then(() => {
      if (isPlaying) beginScheduling();
    }).catch(error => {
      isPlaying = false;
      notify();
      throw error;
    });
  }

  function stop() {
    if (!isPlaying) return;
    isPlaying = false;
    globalThis.clearTimeout(timer);
    timer = 0;
    stepIndex = 0;
    notify();

    if (!context || context.state === "closed") return;
    const now = context.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(0, now, 0.025);
    globalThis.clearTimeout(suspendTimer);
    suspendTimer = globalThis.setTimeout(() => {
      if (!isPlaying && context?.state === "running") context.suspend().catch(() => {});
    }, 120);
  }

  function setTrackEnabled(track, enabled) {
    if (track === "chords") chordEnabled = Boolean(enabled);
    else if (track === "arp") arpEnabled = Boolean(enabled);
    else throw new TypeError("Unknown reward music track.");

    if (context) {
      const now = context.currentTime;
      const gain = track === "chords" ? chordGain : arpGain;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(enabled ? (track === "chords" ? 0.78 : 0.58) : 0, now, 0.025);
    }
    notify();
  }

  function setVolume(nextVolume) {
    volume = Math.min(0.8, Math.max(0, Number(nextVolume) || 0));
    if (context) {
      const now = context.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(isPlaying ? volume : 0, now, 0.025);
    }
    notify();
  }

  function destroy() {
    stop();
    destroyed = true;
    globalThis.clearTimeout(suspendTimer);
    documentRef?.removeEventListener?.("visibilitychange", handleVisibilityChange);
    if (context && context.state !== "closed") context.close().catch(() => {});
    context = null;
  }

  return {
    start,
    stop,
    destroy,
    setTrackEnabled,
    setVolume,
    get isPlaying() { return isPlaying; },
    get trackState() { return { chords: chordEnabled, arp: arpEnabled }; }
  };
}
