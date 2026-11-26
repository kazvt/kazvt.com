export const RG_CONTESTANTS = Object.freeze(["faroe", "erin", "kaz"]);
const STORAGE_KEY = "ramblegamble.points.v1";
const LOCK_NAME = "ramblegamble.points.mutation.v1";

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

// The existing localStorage key is the source of truth. Events are only
// invalidation signals: delayed messages must never restore an old balance.
export function createPointStore({
  getStorage = () => globalThis.localStorage,
  makeChannel = () => new BroadcastChannel(STORAGE_KEY),
  target = globalThis.window,
  document = globalThis.document,
  locks = globalThis.navigator?.locks,
} = {}) {
  let channel = null, channelAttempted = false;
  const listeners = new Set();
  let lastKnown = emptyScores();

  function getChannel() {
    if (!channelAttempted) {
      channelAttempted = true;
      try { channel = makeChannel(); } catch { /* storage events suffice */ }
    }
    return channel;
  }

  function load() {
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEY);
    return normalizePointScores(JSON.parse(raw ?? "{}"));
  }

  function read({ strict = false } = {}) {
    try { lastKnown = load(); }
    catch (error) {
      if (strict) throw new Error("Could not read saved points; no changes made.", { cause: error });
    }
    return { ...lastKnown };
  }

  function write(value) {
    const scores = normalizePointScores(value);
    try { getStorage().setItem(STORAGE_KEY, JSON.stringify(scores)); }
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
      try { onChange(scores); } catch (error) { console.error("Ramble Gamble points subscriber failed:", error); }
    };
    const onStorage = event => { if (event.key === STORAGE_KEY || event.key === null) refresh(); };
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
    return locks?.request ? locks.request(LOCK_NAME, action) : Promise.resolve().then(action);
  }
  return { read, write, subscribe, withLock };
}

const store = createPointStore();
export const readPointScores = store.read;
export const writePointScores = store.write;
export const subscribePointScores = store.subscribe;
export const withPointScoresLock = store.withLock;
