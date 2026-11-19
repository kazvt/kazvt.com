export const RG_CONTESTANTS = Object.freeze(["faroe", "erin", "kaz"]);

const STORAGE_KEY = "ramblegamble.points.v1";
const CHANNEL_NAME = "ramblegamble.points.v1";

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

export function readPointScores() {
  try {
    return normalizePointScores(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return emptyScores();
  }
}

export function writePointScores(value) {
  const scores = normalizePointScores(value);
  let persisted = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch {
    persisted = false;
  }
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: "scores", scores });
    channel.close();
  } catch {
    // The storage event is the fallback for browsers without BroadcastChannel.
  }
  return { scores, persisted };
}

export function subscribePointScores(onChange) {
  let previous = "";
  const publish = (value) => {
    const scores = normalizePointScores(value);
    const serialized = JSON.stringify(scores);
    if (serialized === previous) return;
    previous = serialized;
    onChange(scores);
  };
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try { publish(JSON.parse(event.newValue || "{}")); }
    catch { publish(emptyScores()); }
  };
  let channel = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", (event) => {
      if (event.data?.type === "scores") publish(event.data.scores);
    });
  } catch {
    channel = null;
  }
  window.addEventListener("storage", onStorage);
  publish(readPointScores());
  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}
