// Recorded samples only. This module never generates an oscillator/noise signal.
// All assets are same-origin, installed by assets/sfx/install-foley.py.
import { createRoomAmbience } from "./room-ambience.mjs?v=show-energy-20261127-v1";
const ROOT = new URL("./assets/sfx/foley/", import.meta.url);
export const FOLEY_CUES = Object.freeze({
  switch: { files: ["switch.mp3"], fallback: ["click-1.ogg"], volume: .44 },
  cheer: { files: ["cheer.ogg"], volume: .8 },
  lever: { files: ["lever.mp3"], fallback: ["switch.mp3"], volume: .46 },
  reel: { files: ["spinner.mp3"], fallback: ["reel.mp3"], volume: .28 },
  stop: { files: ["tick-1.ogg", "tick-2.ogg"], fallback: ["switch.mp3"], volume: .42 },
  place: { files: ["card-place-1.ogg", "card-place-2.ogg"], volume: .45 },
  remove: { files: ["card-slide-1.ogg", "card-slide-2.ogg"], volume: .40 },
  payout: { files: ["chips-handle-1.ogg", "chips-handle-2.ogg"], volume: .44 },
  jackpot: { files: ["jackpot.mp3"], fallback: ["confirmation-1.ogg"], volume: .34 },
  wheel: { files: ["wheel.mp3"], volume: .30 },
  ball: { files: ["chip-lay-1.ogg", "chip-lay-2.ogg"], volume: .38 },
  shuffle: { files: ["card-shuffle.ogg"], volume: .55 },
  deal: { files: ["card-slide-1.ogg", "card-slide-2.ogg", "card-slide-3.ogg"], volume: .42 },
  flip: { files: ["card-shove-1.ogg", "card-shove-2.ogg"], fallback: ["card-place-1.ogg", "card-place-2.ogg"], volume: .44 },
  cardFan: { files: ["card-fan-1.ogg", "card-fan-2.ogg"], fallback: ["card-shuffle.ogg"], volume: .44 },
  select: { files: ["select-1.ogg", "select-2.ogg"], fallback: ["switch.mp3"], volume: .26 },
  click: { files: ["click-1.ogg", "click-2.ogg"], fallback: ["switch.mp3"], volume: .20 },
  navigate: { files: ["scroll-1.ogg", "scroll-2.ogg"], fallback: ["card-slide-1.ogg"], volume: .25 },
  open: { files: ["open-1.ogg"], fallback: ["card-fan-1.ogg", "card-slide-1.ogg"], volume: .32 },
  close: { files: ["close-1.ogg"], fallback: ["card-slide-2.ogg"], volume: .30 },
  back: { files: ["back-1.ogg"], fallback: ["card-slide-2.ogg"], volume: .30 },
  toggle: { files: ["toggle-1.ogg", "toggle-2.ogg"], fallback: ["switch.mp3"], volume: .28 },
  wildcard: { files: ["glass-1.ogg", "glass-2.ogg"], fallback: ["card-place-1.ogg"], volume: .34 },
  vote: { files: ["pluck-1.ogg"], fallback: ["chip-lay-1.ogg"], volume: .32 },
  submit: { files: ["drop-1.ogg"], fallback: ["card-place-1.ogg"], volume: .30 },
  confirm: { files: ["confirmation-1.ogg", "confirmation-2.ogg"], fallback: ["chip-lay-1.ogg"], volume: .36 },
  question: { files: ["question-1.ogg"], fallback: ["card-fan-1.ogg", "card-slide-1.ogg"], volume: .40 },
  error: { files: ["error-1.ogg", "error-2.ogg"], fallback: ["switch.mp3"], volume: .30 },
  purchase: { files: ["chips-stack-1.ogg", "chips-stack-2.ogg"], fallback: ["chips-handle-1.ogg"], volume: .48 },
  diceFace: { files: ["die-grab-1.ogg", "die-grab-2.ogg"], fallback: ["card-place-1.ogg"], volume: .30 },
  smeemoHit: { files: ["smeemo-hit.ogg"], fallback: ["chip-lay-1.ogg"], volume: .64, maxDuration: 1.1 },
  smeemoRumble: { files: ["smeemo-rumble.ogg"], fallback: ["die-throw-1.ogg"], volume: .32, maxDuration: 1.1 },
  smeemoWin: { files: ["smeemo-horror.mp3"], volume: .76, maxDuration: 4.2 },
  settlement: { files: ["settlement-cheer.ogg"], fallback: ["confirmation-2.ogg", "confirmation-1.ogg", "cheer.ogg"], volume: .67, maxDuration: 1.6 },
  portal: { files: ["maximize-1.ogg"], fallback: ["card-slide-1.ogg"], volume: .36 },
  portalExit: { files: ["minimize-1.ogg"], fallback: ["card-slide-2.ogg"], volume: .32 },
  draw: { files: ["scratch-1.ogg", "scratch-2.ogg"], fallback: ["card-slide-1.ogg"], volume: .17 },
  erase: { files: ["drop-2.ogg"], fallback: ["card-slide-2.ogg"], volume: .25 },
  diceGrab: { files: ["die-shuffle-1.ogg", "die-shuffle-2.ogg"], volume: .45 },
  diceImpact: { files: ["chips-collide-1.ogg", "chips-collide-2.ogg"], fallback: ["die-throw-1.ogg", "die-throw-2.ogg", "die-throw-3.ogg"], volume: .50 },
  pocket: { files: ["chips-collide-3.ogg", "chips-collide-4.ogg"], fallback: ["chip-lay-1.ogg"], volume: .25 },
});
const STORAGE_KEY = "ramblegamble.foley.muted.v1";
const AMBIENCE_KEY = "ramblegamble.ambience.enabled.v1";

export function createFoley({
  AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext,
  fetchFile = globalThis.fetch?.bind(globalThis),
  now = () => globalThis.performance.now(),
  random = Math.random,
  storage = undefined,
  createMedia = undefined,
  isHidden = () => Boolean(globalThis.document?.hidden || globalThis.document?.documentElement?.hasAttribute?.("data-rg-host-locked")),
} = {}) {
  let context = null, master = null, muted = false, epoch = 0, requestCount = 0;
  const buffers = new Map(), channels = new Map(), voices = new Set(), previous = new Map();
  let ambienceEnabled = true, roomActive = false, roomLevel = 1, roomEmotion = "idle";
  const room = createRoomAmbience({ createMedia, random });
  try { muted = storage?.getItem(STORAGE_KEY) === "1"; ambienceEnabled = storage?.getItem(AMBIENCE_KEY) !== "0"; } catch {}
  function syncRoom(retry = false) {
    room.sync({ active: roomActive && ambienceEnabled && !muted && !isHidden(), context, master,
      emotion: roomEmotion, level: roomLevel * (channels.get("smeemo-win")?.voice ? .22 : 1), retry });
  }
  function setRoomAmbience(active, level = 1, emotion = "idle") { roomActive = Boolean(active); roomLevel = level; roomEmotion = emotion; syncRoom(); }
  function setAmbienceEnabled(value) {
    ambienceEnabled = Boolean(value);
    try { storage?.setItem(AMBIENCE_KEY, ambienceEnabled ? "1" : "0"); } catch {}
    syncRoom(true);
  }
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
      if (context.state !== "running") Promise.resolve(context.resume()).then(() => syncRoom(true)).catch(() => {});
      syncRoom(true);
      for (const file of new Set(Object.values(FOLEY_CUES).flatMap(cue => [...cue.files, ...(cue.fallback || [])]))) load(file);
    } catch { context = null; master = null; }
  }
  function load(file) {
    if (!context) return Promise.resolve(null);
    if (!buffers.has(file)) {
      buffers.set(file, Promise.resolve().then(() => fetchFile(new URL(file === "cheer.ogg" ? "../cheer.ogg" : file, ROOT))).then(response => {
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
    room.stop();
    for (const channel of [...channels.keys()]) stop(channel);
    for (const voice of [...voices]) stopVoice(voice);
  }
  function setMuted(value) {
    muted = Boolean(value);
    if (muted) stopAll();
    try { storage?.setItem(STORAGE_KEY, muted ? "1" : "0"); } catch {}
    if (!muted) unlock();
  }
  function play(name, { loop = false, volume = 1, channel = null, maxDelay = 350, rate = 1, endRate = rate } = {}) {
    const cue = FOLEY_CUES[name];
    if (cue) requestCount++;
    if (!cue || muted || isHidden()) return Promise.resolve(false);
    if (!context) unlock();
    if (!context) return Promise.resolve(false);
    if (channel) stop(channel);
    const entry = { voice: null };
    if (channel) channels.set(channel, entry);
    const requestedAt = now(), generation = epoch;
    const file = choose(name, cue.files);
    const candidates = [file, ...cue.files.filter(other => other !== file), ...(cue.fallback || [])];
    async function firstAvailable() {
      for (const candidate of candidates) {
        if (epoch !== generation || (channel && channels.get(channel) !== entry)) return null;
        const buffer = await load(candidate);
        if (buffer) return buffer;
      }
      return null;
    }
    return firstAvailable().then(buffer => {
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
      // Resampling the recording changes pitch; no generated oscillator.
      const safeRate = value => Math.max(.5, Math.min(2, Number.isFinite(value) ? value : 1));
      const from = safeRate(rate), to = safeRate(endRate);
      if (source.playbackRate) {
        source.playbackRate.value = from;
        if (from !== to) {
          source.playbackRate.setValueAtTime(from, context.currentTime);
          source.playbackRate.linearRampToValueAtTime(to, context.currentTime + Math.min(.30, (buffer.duration || .4) / Math.max(from, to) * .65));
        }
      }
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
      // The local celebration edit is already faded. Bound the duration of a
      // longer fallback (such as the full applause recording) as well.
      if (!loop && Number.isFinite(cue.maxDuration) && buffer.duration / Math.min(from, to) > cue.maxDuration) {
        gain.gain.setTargetAtTime(0, context.currentTime + Math.max(0, cue.maxDuration - .35), .07);
        // start(duration) counts source seconds, not elapsed playback seconds.
        if (from === 1 && to === 1) source.start(0, 0, cue.maxDuration);
        else { source.start(); source.stop(context.currentTime + cue.maxDuration); }
      } else source.start();
      return true;
    }).catch(() => false).finally(() => {
      if (channel && channels.get(channel) === entry && !entry.voice) channels.delete(channel);
    });
  }
  return { unlock, play, setRoomAmbience, setAmbienceEnabled, get ambienceEnabled() { return ambienceEnabled; }, start: (channel, name, options = {}) => play(name, { ...options, channel }), stop, stopAll, setMuted, get muted() { return muted; }, get requestCount() { return requestCount; } };
}

let browserStorage;
try { browserStorage = globalThis.localStorage; } catch {}
export const foley = createFoley({ storage: browserStorage });
if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  const control = document.getElementById("rg-foley-enabled");
  if (control) {
    control.checked = !foley.muted;
    control.addEventListener("change", () => foley.setMuted(!control.checked));
  }
  const ambienceControl = document.getElementById("rg-ambience-enabled");
  if (ambienceControl) {
    ambienceControl.checked = foley.ambienceEnabled;
    ambienceControl.addEventListener("change", () => foley.setAmbienceEnabled(ambienceControl.checked));
  }
  // Preload on the first trusted interaction; later actions resume after a browser suspension.
  for (const type of ["pointerdown", "keydown", "click"]) document.addEventListener(type, event => {
    if (event.isTrusted) foley.unlock();
  }, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden) foley.stopAll(); });
  if (typeof MutationObserver !== "undefined" && document.documentElement) {
    new MutationObserver(() => { if (document.documentElement.hasAttribute("data-rg-host-locked")) foley.stopAll(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-rg-host-locked"] });
  }
  globalThis.addEventListener?.("pagehide", foley.stopAll);
  globalThis.addEventListener?.("storage", event => {
    if (event.key === AMBIENCE_KEY && foley.ambienceEnabled !== (event.newValue !== "0")) {
      foley.setAmbienceEnabled(event.newValue !== "0");
      if (ambienceControl) ambienceControl.checked = foley.ambienceEnabled;
    }
    if (event.key === STORAGE_KEY && foley.muted !== (event.newValue === "1")) {
      foley.setMuted(event.newValue === "1");
      const control = document.getElementById("rg-foley-enabled");
      if (control) control.checked = !foley.muted;
    }
  });
}

// Ordinary UI controls receive quiet feedback; explicit gameplay cues take precedence.
// Capture keeps the pre-handler state even when a render replaces the clicked node.
export function installControlFoley(root, mixer, defer = fn => setTimeout(fn, 0)) {
  const pending = new WeakMap();
  root.addEventListener("click", event => {
    if (!event.isTrusted || event.button !== 0) return;
    const control = event.target?.closest?.('button, input[type="button"], input[type="submit"], summary, a[href]');
    if (!control || control.disabled || control.closest('[inert], [hidden]') || control.getAttribute('aria-disabled') === 'true' || control.dataset?.foley === 'off') return;
    pending.set(event, { count: mixer.requestCount, cue: control.dataset?.foley || (control.hasAttribute('aria-pressed') ? 'select' : 'click') });
    // Runs after synchronous handlers even if they stop propagation or replace the UI.
    defer(() => {
      const item = pending.get(event);
      if (item && mixer.requestCount === item.count) mixer.play(item.cue);
    });
  }, { capture: true });
  root.addEventListener("change", event => {
    if (!event.isTrusted || event.target?.disabled || ['rg-foley-enabled', 'rg-ambience-enabled'].includes(event.target?.id)) return;
    if (event.target?.matches?.('select, input[type="radio"], input[type="checkbox"]') && event.target.dataset?.foley !== "off") mixer.play(event.target.type === 'checkbox' ? 'toggle' : 'select');
  });
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') installControlFoley(document, foley);
