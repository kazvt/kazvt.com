import {
  CARD_GAME_STORAGE_KEY,
  emptyCardGamesState,
  normalizeCardGamesState,
} from "./card-games.mjs?v=scene-table-20261126-v1";

const CHANNEL_NAME = "ramblegamble.card-games.v1";
let channel = null;

function getChannel() {
  if (channel) return channel;
  if (typeof BroadcastChannel === "undefined") return null;
  try { channel = new BroadcastChannel(CHANNEL_NAME); }
  catch { channel = null; }
  return channel;
}

export function readCardGames() {
  try {
    return normalizeCardGamesState(JSON.parse(globalThis.localStorage.getItem(CARD_GAME_STORAGE_KEY) || "null"));
  } catch {
    return emptyCardGamesState();
  }
}

export function writeCardGames(value, { requirePersistence = false } = {}) {
  const state = normalizeCardGamesState(value);
  let persisted = true;
  try { globalThis.localStorage.setItem(CARD_GAME_STORAGE_KEY, JSON.stringify(state)); }
  catch { persisted = false; }
  if (persisted || !requirePersistence) getChannel()?.postMessage({ type: "state", state, persisted });
  return { state, persisted };
}

export function updateCardGames(update) {
  const next = update(readCardGames());
  return writeCardGames(next);
}

export function subscribeCardGames(onChange) {
  let previous = "";
  const publish = (value) => {
    const state = normalizeCardGamesState(value);
    const serialized = JSON.stringify(state);
    if (serialized === previous) return;
    previous = serialized;
    onChange(state);
  };
  const onStorage = (event) => {
    if (event.key !== CARD_GAME_STORAGE_KEY && event.key !== null) return;
    publish(readCardGames());
  };
  const shared = getChannel();
  const onMessage = (event) => {
    if (event.data?.type === "state") publish(event.data.persisted === false ? event.data.state : readCardGames());
  };
  shared?.addEventListener("message", onMessage);
  globalThis.addEventListener?.("storage", onStorage);
  publish(readCardGames());
  return () => {
    globalThis.removeEventListener?.("storage", onStorage);
    shared?.removeEventListener("message", onMessage);
  };
}
