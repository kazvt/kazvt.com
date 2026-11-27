// One streamed music voice for the host arcade. Foley and ambience remain independent.
export const SOUNDTRACK_FILES = Object.freeze({
  general: 'sonic_gammon_leel_theme.mp3',
  cards: 'sonic_no_daifuugou_title_theme.mp3',
  smeemo: 'smeemo_theme.mp3',
});
const base = new URL('./assets/music/', import.meta.url);
export function soundtrackFor({ active, muted, dice, view, cardMode, encounter }) {
  if (!active || muted || dice || view === 'dice-door' || encounter === 'stinger') return null;
  if (encounter === 'smeemo') return 'smeemo';
  if (view === 'card-table' && cardMode === 'smeemo') return null;
  return ['roulette', 'card-table', 'trivia'].includes(view) ? 'cards' : 'general';
}

export function createSoundtrack({ createMedia = () => new Audio(), now = () => performance.now(), volume = .20 } = {}) {
  let media, track = null, wanted = null, requested = false, blocked = false, disposed = false, epoch = 0, fadeAt = null;
  const failed = new Set();
  const gain = Math.max(0, Math.min(1, volume));
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
  function sync(next, { retry = false } = {}) {
    if (disposed) return;
    next = Object.hasOwn(SOUNDTRACK_FILES, next) ? next : null;
    if (wanted !== next) { stop(); wanted = next; }
    if (!wanted || failed.has(wanted) || !initialize()) return;
    if (track !== wanted) {
      // The previous source is paused before the element receives another URL.
      // No crossfade or second element can make two songs audible at once.
      track = wanted;
      try { media.src = new URL(SOUNDTRACK_FILES[track], base).href; }
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
    if (fadeAt !== null && requested) media.volume = gain * Math.max(0, Math.min(1, (now() - fadeAt) / 300));
  }
  function dispose() {
    if (disposed) return;
    disposed = true; stop();
    if (media) { media.removeEventListener('error', onError); media.removeAttribute('src'); media.load(); }
  }
  function playbackPosition(){
    return !disposed&&wanted===track&&requested&&fadeAt!==null&&media&&!media.paused&&Number.isFinite(media.currentTime)
      ? {track,seconds:media.currentTime}:null;
  }
  return { sync, dispose, playbackPosition };
}
