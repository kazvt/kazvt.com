// Streaming recorded audio, not decoded into a potentially huge AudioBuffer.
const tracks = [
  { file: 'room-bed.mp3', gain: .13 },
  { file: 'room-detail.mp3', gain: .042 },
];
const base = new URL('./assets/sfx/foley/', import.meta.url);
export function createRoomAmbience({ createMedia = () => new Audio(), random = Math.random } = {}) {
  let entries = [], initialized = false;
  function pause(entry) {
    if (!entry.requested && entry.media.paused) return;
    entry.requested = false;
    entry.generation++;
    try { entry.media.pause(); } catch {}
    entry.gain.gain.cancelScheduledValues(entry.context.currentTime);
    entry.gain.gain.value = 0;
    entry.level = null;
  }
  function stop() { entries.forEach(pause); }
  function setup(context, master) {
    if (initialized) return;
    initialized = true;
    for (const track of tracks) {
      try {
        const media = createMedia();
        media.preload = 'none'; media.loop = true;
        const gain = context.createGain(); gain.gain.value = 0;
        const source = context.createMediaElementSource(media);
        source.connect(gain); gain.connect(master);
        const entry = { media, gain, source, track, context, requested: false, blocked: false, failed: false, generation: 0, level: null };
        media.addEventListener('error', () => { entry.failed = true; pause(entry); });
        media.addEventListener('loadedmetadata', () => {
          if (Number.isFinite(media.duration) && media.duration > 10) {
            try { media.currentTime = Math.max(0, media.duration - 4) * random(); } catch {}
          }
        }, { once: true });
        entries.push(entry);
        media.src = new URL(track.file, base).href;
      } catch { /* unavailable media API: no ambience, no gameplay impact */ }
    }
  }
  function sync({ active, context, master, level = 1, retry = false }) {
    if (!active || !context || !master || context.state !== 'running') { stop(); return; }
    setup(context, master);
    for (const entry of entries) {
      if (entry.failed) continue;
      const target = entry.track.gain * Math.max(0, Math.min(1, Number.isFinite(level) ? level : 1));
      if (entry.level !== target) {
        const p = entry.gain.gain, t = context.currentTime;
        p.cancelScheduledValues(t);
        p.setTargetAtTime(target, t, .18);
        entry.level = target;
      }
      if (retry) entry.blocked = false;
      if (entry.requested || entry.blocked) continue;
      entry.requested = true;
      const generation = ++entry.generation;
      try {
        Promise.resolve(entry.media.play()).then(() => {
          if (generation !== entry.generation && !entry.requested) entry.media.pause();
        }).catch(() => {
          if (generation === entry.generation) { entry.requested = false; entry.blocked = true; }
        });
      } catch { entry.requested = false; entry.blocked = true; }
    }
  }
  return { sync, stop };
}
