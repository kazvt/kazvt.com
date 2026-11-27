// Streaming recorded audio, not decoded into a potentially huge AudioBuffer.
const tracks = [
  { file: 'room-bed.mp3', gain: .13 },
  { file: 'room-detail.mp3', gain: .042 },
  { file: 'audience-cheer.mp3', gain: .14, cheer: true },
  { file: 'vip-water-drips-cave-loop.ogg', gain: .28, water: true },
];
const base = new URL('./assets/sfx/foley/', import.meta.url);
export function createRoomAmbience({ createMedia = () => new Audio(), random = Math.random } = {}) {
  let entries = [], initialized = false;
  function pause(entry) {
    if (!entry.requested && entry.media.paused && entry.level === null) return;
    entry.requested = false;
    entry.generation++;
    try { entry.media.pause(); } catch {}
    entry.gain.gain.cancelScheduledValues(entry.context.currentTime);
    entry.gain.gain.value = 0;
    entry.level = null; entry.silentSince = null;
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
        // Only the VIP track passes through an occlusion filter; all other
        // ambience and the separate gameplay foley bus retain their sound.
        const filter = track.water ? context.createBiquadFilter() : null;
        if (filter) { filter.type = 'lowpass'; filter.frequency.value = 480; filter.Q.value = .1; source.connect(filter); filter.connect(gain); }
        else source.connect(gain);
        gain.connect(master);
        const entry = { media, gain, source, track, context, requested: false, blocked: false, failed: false, generation: 0, level: null, filter, cutoff: null, silentSince: null };
        media.addEventListener('error', () => { entry.failed = true; pause(entry); });
        media.addEventListener('loadedmetadata', () => {
          if (Number.isFinite(media.duration) && media.duration > 4) {
            try { media.currentTime = Math.max(0, media.duration - 4) * random(); } catch {}
          }
        }, { once: true });
        entries.push(entry);
        media.src = new URL(track.file, base).href;
      } catch { /* unavailable media API: no ambience, no gameplay impact */ }
    }
  }
  function sync({ active, context, master, level = 1, emotion = "idle", waterLevel = 0, waterCutoff = 480, retry = false }) {
    if (!active || !context || !master || context.state !== 'running') { stop(); return; }
    setup(context, master);
    for (const entry of entries) {
      if (entry.failed) continue;
      const mood = entry.track.cheer ? (emotion === "cheer" ? 1 : 0) : emotion === "suspense" ? .38 : emotion === "shock" ? .24 : emotion === "cheer" ? .75 : 1;
      const target = entry.track.gain * (entry.track.water
        ? Math.max(0, Math.min(1, Number.isFinite(waterLevel) ? waterLevel : 0))
        : mood * Math.max(0, Math.min(1, Number.isFinite(level) ? level : 1)));
      if (entry.filter) {
        const cutoff = Math.max(200,Math.min(8000,Number.isFinite(waterCutoff)?waterCutoff:480));
        if (entry.cutoff !== cutoff) {
          const p=entry.filter.frequency,t=context.currentTime;
          p.cancelScheduledValues(t); p.setTargetAtTime(cutoff,t,.13);entry.cutoff=cutoff;
        }
      }
      // After a short release the zero-gain stream really pauses. This keeps
      // the VIP silent indefinitely and avoids decoding inaudible loops.
      if (target === 0 && entry.requested) {
        entry.silentSince ??= context.currentTime;
        if (context.currentTime-entry.silentSince>=.65) { pause(entry); continue; }
      } else entry.silentSince=null;
      if (target === 0 && !entry.requested && entry.media.paused) continue;
      if (entry.level !== target) {
        const p = entry.gain.gain, t = context.currentTime;
        p.cancelScheduledValues(t);
        p.setTargetAtTime(target, t, .09);
        entry.level = target;
      }
      if (retry) entry.blocked = false;
      if (entry.requested || entry.blocked || target === 0) continue;
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
