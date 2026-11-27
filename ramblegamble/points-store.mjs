export const RG_CONTESTANTS = Object.freeze(["faroe", "erin", "kaz"]);
const POINTS_KEY = "ramblegamble.points.v1";
const STARS_KEY = "ramblegamble.stars.v1";
const POINTS_LOCK = "ramblegamble.points.mutation.v1";
const STARS_LOCK = "ramblegamble.stars.mutation.v1";

function emptyScores() {
  return Object.fromEntries(RG_CONTESTANTS.map((name) => [name, 0]));
}

export function normalizePointScores(value) {
  const scores = emptyScores();
  if (!value || typeof value !== "object" || Array.isArray(value)) return scores;
  for (const name of RG_CONTESTANTS) {
    const count = Number(value[name]);
    scores[name] = Number.isSafeInteger(count) && count >= 0 ? count : 0;
  }
  return scores;
}

// New star saves use numeric JSON values only. Unlike legacy point saves,
// there is no historical string format to coerce; malformed values must not
// become phantom awards (e.g. true -> 1 or [5] -> 5).
export function normalizeStarScores(value) {
  const scores = emptyScores();
  if (!value || typeof value !== "object" || Array.isArray(value)) return scores;
  for (const name of RG_CONTESTANTS) {
    const count = value[name];
    scores[name] = Number.isSafeInteger(count) && count >= 0 ? count : 0;
  }
  return scores;
}

// Each localStorage key is the source of truth. Events are only
// invalidation signals: delayed messages must never restore an old balance.
export function createPointStore({
  currency = "points",
  getStorage = () => globalThis.localStorage,
  makeChannel = key => new BroadcastChannel(key),
  target = globalThis.window,
  document = globalThis.document,
  locks = globalThis.navigator?.locks,
} = {}) {
  if (currency !== "points" && currency !== "stars") throw new TypeError("Unknown score currency");
  const storageKey = currency === "stars" ? STARS_KEY : POINTS_KEY;
  const lockName = currency === "stars" ? STARS_LOCK : POINTS_LOCK;
  const normalize = currency === "stars" ? normalizeStarScores : normalizePointScores;
  let channel = null, channelAttempted = false;
  const listeners = new Set();
  let lastKnown = emptyScores();

  function getChannel() {
    if (!channelAttempted) {
      channelAttempted = true;
      try { channel = makeChannel(storageKey); } catch { /* storage events suffice */ }
    }
    return channel;
  }

  function load() {
    const storage = getStorage();
    const raw = storage.getItem(storageKey);
    return normalize(JSON.parse(raw ?? "{}"));
  }

  function read({ strict = false } = {}) {
    try { lastKnown = load(); }
    catch (error) {
      if (strict) throw new Error(`Could not read saved ${currency}; no changes made.`, { cause: error });
    }
    return { ...lastKnown };
  }

  function write(value) {
    const scores = normalize(value);
    try { getStorage().setItem(storageKey, JSON.stringify(scores)); }
    catch { return { scores: read(), persisted: false }; }
    lastKnown = scores;
    // Neither storage events nor the sending BroadcastChannel notify this
    // document. Notify its subscribers immediately after persistence.
    for (const notify of [...listeners]) notify();
    try { getChannel()?.postMessage({ type: "scores", scores }); } catch { /* storage event is independent */ }
    return { scores: { ...scores }, persisted: true };
  }

  function subscribe(onChange) {
    let previous = null;
    const refresh = () => {
      const scores = read();
      const serialized = JSON.stringify(scores);
      if (serialized === previous) return;
      previous = serialized;
      // One broken view must not interrupt a committed award or other views.
      try { onChange(scores); } catch (error) { console.error(`Ramble Gamble ${currency} subscriber failed:`, error); }
    };
    const onStorage = event => { if (event.key === storageKey || event.key === null) refresh(); };
    const onMessage = event => { if (event.data?.type === "scores") refresh(); };
    const onVisible = () => { if (!document?.hidden) refresh(); };
    const bus = getChannel();
    listeners.add(refresh);
    bus?.addEventListener("message", onMessage);
    target?.addEventListener("storage", onStorage);
    target?.addEventListener("focus", refresh);
    target?.addEventListener("pageshow", refresh);
    document?.addEventListener("visibilitychange", onVisible);
    refresh();
    return () => {
      listeners.delete(refresh);
      bus?.removeEventListener("message", onMessage);
      target?.removeEventListener("storage", onStorage);
      target?.removeEventListener("focus", refresh);
      target?.removeEventListener("pageshow", refresh);
      document?.removeEventListener("visibilitychange", onVisible);
    };
  }

  // All production writers use this lock around their entire synchronous
  // read/modify/write, including the shop's compensating rollback. Older
  // browsers without Web Locks retain single-tab support only.
  function withLock(action) {
    return locks?.request ? locks.request(lockName, action) : Promise.resolve().then(action);
  }
  return { read, write, subscribe, withLock };
}

const store = createPointStore();
export const readPointScores = store.read;
export const writePointScores = store.write;
export const subscribePointScores = store.subscribe;
export const withPointScoresLock = store.withLock;

// Stars are a separate balance, not the wildcard on the slot board. Keeping
// independent keys/locks also lets old point-only saves load unchanged.
export function createStarStore(options = {}) {
  return createPointStore({ ...options, currency: "stars" });
}
const starStore = createStarStore();
export const readStarScores = starStore.read;
export const writeStarScores = starStore.write;
export const subscribeStarScores = starStore.subscribe;
export const withStarScoresLock = starStore.withLock;
