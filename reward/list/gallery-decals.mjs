import { REWARD_DECAL_POOL } from "../decal-pool.mjs";
import { layoutSideEdgeDecals } from "../decal-layout.mjs";

export const GALLERY_DECAL_COUNT = 24;

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGalleryDecalSeed(cryptoProvider = globalThis.crypto) {
  const buffer = new Uint32Array(1);
  try {
    if (typeof cryptoProvider?.getRandomValues === "function") {
      cryptoProvider.getRandomValues(buffer);
      return buffer[0] || 1;
    }
  } catch {
    // Decorative variation does not require cryptographic randomness.
  }
  return (Math.floor(Math.random() * 4294967296) >>> 0) || 1;
}

export function selectGalleryEdgeDecals(width, height, seed, count = GALLERY_DECAL_COUNT) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff ||
      !Number.isInteger(count) || count <= 0 || count > REWARD_DECAL_POOL.length) {
    return [];
  }

  const positions = layoutSideEdgeDecals(width, height, count, seed);
  if (positions.length !== count) return [];

  const random = createSeededRandom(seed ^ 0x9e3779b9);
  const available = [...REWARD_DECAL_POOL];
  return positions.map(position => {
    const eligible = available.filter(item => !item.side || item.side === position.side);
    if (eligible.length === 0) return null;

    const selected = eligible[Math.floor(random() * eligible.length)];
    available.splice(available.indexOf(selected), 1);
    return { item: selected, position };
  }).filter(Boolean);
}
