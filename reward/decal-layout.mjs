function createSeededRandom(seed) {
  let state = Number.isFinite(seed) ? seed >>> 0 : 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function layoutSideEdgeDecals(width, height, count, seed) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 ||
      !Number.isInteger(count) || count <= 0) {
    return [];
  }

  const random = createSeededRandom(seed);
  const slotsPerSide = Math.ceil(count / 2);
  const padding = Math.min(8, Math.max(2, height * 0.015));
  const usableHeight = Math.max(0, height - padding * 2);
  const preferredSize = Math.max(24, Math.min(76, Math.min(width, height) * 0.16));
  const spacingLimit = usableHeight / (1 + 1.55 * slotsPerSide);
  const size = Math.max(1, Math.min(
    preferredSize,
    width * 0.45,
    spacingLimit
  ));
  const slotHeight = Math.max(0, (usableHeight - size) / slotsPerSide);
  const maxJitter = Math.max(0, Math.min(slotHeight * 0.12, (slotHeight - size * 1.5) * 0.4));
  const firstSide = random() < 0.5 ? 0 : 1;
  const slotsUsed = [0, 0];

  return Array.from({ length: count }, (_, index) => {
    const side = (index + firstSide) % 2;
    const slot = slotsUsed[side]++;
    const jitter = (random() * 2 - 1) * maxJitter;
    return {
      x: side === 0 ? 0 : width,
      y: padding + size / 2 + (slot + 0.5) * slotHeight + jitter,
      size,
      angle: random() * 26 - 13,
      side: side === 0 ? "left" : "right"
    };
  });
}
