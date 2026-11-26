// Recorded samples only. This module never generates an oscillator/noise signal.
// All assets are same-origin, installed by assets/sfx/install-foley.py.
const ROOT = new URL("./assets/sfx/foley/", import.meta.url);
export const FOLEY_CUES = Object.freeze({
  switch: { files: ["switch.mp3"], volume: .44 },
  lever: { files: ["lever.mp3"], volume: .46 },
  reel: { files: ["reel.mp3"], volume: .25 },
  stop: { files: ["switch.mp3"], volume: .42 },
  place: { files: ["card-place-1.ogg", "card-place-2.ogg"], volume: .45 },
  remove: { files: ["card-slide-1.ogg", "card-slide-2.ogg"], volume: .40 },
  payout: { files: ["chips-handle-1.ogg", "chips-handle-2.ogg"], volume: .44 },
  wheel: { files: ["wheel.mp3"], volume: .30 },
  ball: { files: ["chip-lay-1.ogg", "chip-lay-2.ogg"], volume: .38 },
  shuffle: { files: ["card-shuffle.ogg"], volume: .55 },
  deal: { files: ["card-slide-1.ogg", "card-slide-2.ogg", "card-slide-3.ogg"], volume: .42 },
  flip: { files: ["card-place-1.ogg", "card-place-2.ogg"], volume: .44 },
  diceGrab: { files: ["die-shuffle-1.ogg", "die-shuffle-2.ogg"], volume: .45 },
  diceImpact: { files: ["die-throw-1.ogg", "die-throw-2.ogg", "die-throw-3.ogg"], volume: .50 },
});
const STORAGE_KEY = "ramblegamble.foley.muted.v1";

export function createFoley({
  AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext,
  fetchFile = globalThis.fetch?.bind(globalThis),
  now = () => globalThis.performance.now(),
  random = Math.random,
  storage = undefined,
  isHidden = () => Boolean(globalThis.document?.hidden),
} = {}) {
  let context = null, master = null, muted = false, epoch = 0;
  const buffers = new Map(), channels = new Map(), voices = new Set(), previous = new Map();
  try { muted = storage?.getItem(STORAGE_KEY) === "1"; } catch {}
  function unlock() {
    if (!AudioContext || !fetchFile || muted || isHidden()) return;
    try {
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = .75;
        // A limiter provides headroom for staggered stops / dice impacts.
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -9;
        limiter.ratio.value = 8;
        master.connect(limiter);
        limiter.connect(context.destination);
      }
      if (context.state !== "running") Promise.resolve(context.resume()).catch(() => {});
      for (const file of new Set(Object.values(FOLEY_CUES).flatMap(cue => cue.files))) load(file);
    } catch { context = null; master = null; }
  }
  function load(file) {
    if (!context) return Promise.resolve(null);
    if (!buffers.has(file)) {
      buffers.set(file, Promise.resolve().then(() => fetchFile(new URL(file, ROOT))).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      }).then(data => context.decodeAudioData(data)).catch(() => null));
    }
    return buffers.get(file);
  }
  function choose(name, files) {
    const last = previous.get(name);
    const choices = files.length > 1 ? files.filter(file => file !== last) : files;
    const file = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
    previous.set(name, file);
    return file;
  }
  function stopVoice(voice) {
    if (!voice || !voices.has(voice)) return;
    voices.delete(voice);
    try {
      const t = context.currentTime;
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setTargetAtTime(0, t, .014);
      voice.source.stop(t + .06);
    } catch {}
  }
  function stop(channel) {
    const entry = channels.get(channel);
    channels.delete(channel);
    if (entry?.voice) stopVoice(entry.voice);
  }
  function stopAll() {
    epoch++;
    for (const channel of [...channels.keys()]) stop(channel);
    for (const voice of [...voices]) stopVoice(voice);
  }
  function setMuted(value) {
    muted = Boolean(value);
    if (muted) stopAll();
    try { storage?.setItem(STORAGE_KEY, muted ? "1" : "0"); } catch {}
    if (!muted) unlock();
  }
  function play(name, { loop = false, volume = 1, channel = null, maxDelay = 350 } = {}) {
    const cue = FOLEY_CUES[name];
    if (!cue || muted || isHidden()) return Promise.resolve(false);
    if (!context) unlock();
    if (!context) return Promise.resolve(false);
    if (channel) stop(channel);
    const entry = { voice: null };
    if (channel) channels.set(channel, entry);
    const requestedAt = now(), generation = epoch;
    const file = choose(name, cue.files);
    return load(file).then(buffer => {
      if (!buffer || muted || isHidden() || epoch !== generation || context.state !== "running"
          || (channel && channels.get(channel) !== entry) || now() - requestedAt > maxDelay) return false;
      // Bounded polyphony. Drop the oldest non-loop voice instead of stacking clicks.
      if (voices.size >= 12) {
        const oldest = [...voices].find(voice => !voice.source.loop);
        if (!oldest) return false;
        stopVoice(oldest);
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = loop;
      gain.gain.value = Math.max(0, Math.min(1, cue.volume * volume));
      source.connect(gain); gain.connect(master);
      const voice = { source, gain };
      entry.voice = voice;
      voices.add(voice);
      source.onended = () => {
        voices.delete(voice);
        if (channel && channels.get(channel) === entry) channels.delete(channel);
        try { source.disconnect(); gain.disconnect(); } catch {}
      };
      source.start();
      return true;
    }).catch(() => false).finally(() => {
      if (channel && channels.get(channel) === entry && !entry.voice) channels.delete(channel);
    });
  }
  return { unlock, play, start: (channel, name, options = {}) => play(name, { ...options, channel }), stop, stopAll, setMuted, get muted() { return muted; } };
}

let browserStorage;
try { browserStorage = globalThis.localStorage; } catch {}
export const foley = createFoley({ storage: browserStorage });
if (typeof document !== "undefined") {
  const control = document.getElementById("rg-foley-enabled");
  if (control) {
    control.checked = !foley.muted;
    control.addEventListener("change", () => foley.setMuted(!control.checked));
  }
  // Preload on the first trusted interaction; later actions resume after a browser suspension.
  for (const type of ["pointerdown", "keydown", "click"]) document.addEventListener(type, event => {
    if (event.isTrusted) foley.unlock();
  }, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden) foley.stopAll(); });
  globalThis.addEventListener?.("pagehide", foley.stopAll);
  globalThis.addEventListener?.("storage", event => {
    if (event.key === STORAGE_KEY && foley.muted !== (event.newValue === "1")) {
      foley.setMuted(event.newValue === "1");
      const control = document.getElementById("rg-foley-enabled");
      if (control) control.checked = !foley.muted;
    }
  });
}
