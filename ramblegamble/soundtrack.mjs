// One streamed music voice for the host arcade. Foley and ambience remain independent.
export const SOUNDTRACK_FILES = Object.freeze({
  general: 'sonic_gammon_leel_theme.mp3',
  cards: 'sonic_no_daifuugou_title_theme.mp3',
  smeemo: 'smeemo_ambiance.mp3',
});
const base = new URL('./assets/music/', import.meta.url);
export function soundtrackFor({ active, muted, dice, view, cardMode, encounter, smeemoTable = false, detached = false }) {
  if (!active || muted || dice || encounter === 'stinger') return null;
  // Freecam leaves the focused game even after the middle button is released.
  // Keep the spatial VIP/Smeemo attenuation in the mixer, independent of song choice.
  if (detached) return 'general';
  const encounterTrack = encounter === 'smeemo' && ['smeemo-crowd','card-table'].includes(view);
  const activeTableGame = view === 'card-table' && cardMode === 'smeemo' && smeemoTable === true;
  if (encounterTrack || activeTableGame) return 'smeemo';
  // A selected-but-not-running/cancelled Smeemo round is not a silence mode.
  // The ordinary card-table theme remains the fallback unless the live game
  // session explicitly owns the Smeemo ambience.
  return ['roulette', 'card-table', 'trivia'].includes(view) ? 'cards' : 'general';
}

export function createSoundtrack({ createMedia = () => new Audio(), now = () => performance.now(), volume = .20 } = {}) {
  let media, track = null, wanted = null, requested = false, blocked = false, disposed = false, epoch = 0, fadeAt = null;
  const failed = new Set();
  let smeemoPosition = 0;
  let forgetSmeemoPositionOnExit = false;
  const gain = Math.max(0, Math.min(1, volume));
  // Spatial attenuation is a frame-rate-independent one-pole smoother. The
  // same media element keeps playing at zero volume, so leaving a silent zone
  // fades the current song back in without restarting or adding another voice.
  const spatialTimeConstantMs = 220;
  let spatialGain = 1;
  let spatialUpdatedAt = null;
  function updateSpatialGain(target) {
    const safeTarget = Number.isFinite(target) ? Math.max(0, Math.min(1, target)) : 0;
    const time = now();
    if (spatialUpdatedAt === null) {
      spatialUpdatedAt = time;
      spatialGain = safeTarget;
      return spatialGain;
    }
    const dt = Math.max(0, time - spatialUpdatedAt);
    spatialUpdatedAt = time;
    if (dt > 0) spatialGain += (safeTarget - spatialGain) * (1 - Math.exp(-dt / spatialTimeConstantMs));
    if (Math.abs(safeTarget - spatialGain) < .001) spatialGain = safeTarget;
    return spatialGain;
  }
  function stop() {
    epoch++; requested = false; blocked = false; fadeAt = null;
    if (media) { media.pause(); media.volume = 0; }
  }
  function onError() {
    if (!media?.error || !track) return;
    failed.add(track); stop();
    console.warn(`Ramble Gamble soundtrack unavailable: ${SOUNDTRACK_FILES[track]}`);
  }
  function initialize() {
    if (media) return true;
    try {
      media = createMedia(); media.preload = 'none'; media.loop = true; media.volume = 0;
      media.addEventListener('error', onError);
      return true;
    } catch { media = null; return false; }
  }
  function sync(next, { retry = false, spatialGain: requestedSpatialGain = 1 } = {}) {
    if (disposed) return;
    const currentSpatialGain = updateSpatialGain(requestedSpatialGain);
    next = Object.hasOwn(SOUNDTRACK_FILES, next) ? next : null;
    if (wanted !== next) {
      if (track === 'smeemo' && wanted === track && Number.isFinite(media?.currentTime)) {
        smeemoPosition = forgetSmeemoPositionOnExit ? 0 : media.currentTime;
      }
      if (track === 'smeemo') forgetSmeemoPositionOnExit = false;
      stop(); wanted = next;
    }
    if (!wanted || failed.has(wanted) || !initialize()) return;
    if (track !== wanted) {
      // The previous source is paused before the element receives another URL.
      // No crossfade or second element can make two songs audible at once.
      track = wanted;
      try {
        media.src = new URL(SOUNDTRACK_FILES[track], base).href;
        if (track === 'smeemo' && smeemoPosition > 0) media.currentTime = smeemoPosition;
      }
      catch { failed.add(track); return; }
    }
    if (retry) {
      blocked = false;
      // A browser/OS interruption may pause a previously successful element
      // without rejecting play(). Recover on the next trusted gesture only.
      if (requested && fadeAt !== null && media.paused) stop();
    }
    if (!requested && !blocked) {
      requested = true;
      const ticket = ++epoch;
      const rejected = error => {
        if (ticket !== epoch || disposed) return;
        requested = false; blocked = true; fadeAt = null; media.volume = 0;
        // A rejected autoplay can be retried on a trusted gesture. Missing or
        // undecodable recordings must not trigger a per-frame request storm.
        if (error?.name === 'NotSupportedError') failed.add(track);
      };
      try {
        Promise.resolve(media.play()).then(() => {
          if (ticket === epoch && requested && !disposed) fadeAt = now();
        }, rejected);
      } catch (error) { rejected(error); }
    }
    if (fadeAt !== null && requested) media.volume = gain * Math.max(0, Math.min(1, (now() - fadeAt) / 300)) * currentSpatialGain;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; stop();
    if (media) { media.removeEventListener('error', onError); media.removeAttribute('src'); media.load(); }
  }
  function playbackPosition(){
    return !disposed&&wanted===track&&requested&&fadeAt!==null&&media&&!media.paused&&!media.ended&&!media.seeking&&!media.muted&&media.volume>0&&media.readyState>=3&&Number.isFinite(media.currentTime)
      ? {track,seconds:media.currentTime}:null;
  }
  function resetTrackPosition(name) {
    if (name !== 'smeemo') return false;
    smeemoPosition = 0;
    if (track === 'smeemo' && wanted === 'smeemo') {
      forgetSmeemoPositionOnExit = true;
      try { if (media && Number.isFinite(media.currentTime)) media.currentTime = 0; } catch {}
    }
    return true;
  }
  return { sync, dispose, playbackPosition, resetTrackPosition };
}
