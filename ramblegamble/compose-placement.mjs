const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function finiteCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeComposePlacements(placements, items) {
  const itemCount = Array.isArray(items) ? items.length : Number(items);
  if (!Array.isArray(placements) || !Number.isInteger(itemCount) || itemCount < 0) return [];
  return placements.flatMap((placement) => {
    if (!placement || typeof placement !== "object") return [];
    const itemIndex = Number(placement.itemIndex ?? placement.item ?? placement.typeIndex);
    const x = finiteCoordinate(placement.x);
    const y = finiteCoordinate(placement.y);
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= itemCount || x == null || y == null) return [];
    return [{ itemIndex, x: clamp(x, 0, 100), y: clamp(y, 0, 100) }];
  });
}

export function migrateLegacyComposePlacements(items) {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, itemIndex) => {
    if (!item || typeof item !== "object") return [];
    const x = finiteCoordinate(item.x);
    const y = finiteCoordinate(item.y);
    const defaultX = 8 + (itemIndex % 5) * 18;
    const defaultY = 8 + (Math.floor(itemIndex / 5) % 4) * 18;
    if (x == null || y == null || (Math.abs(x - defaultX) < 0.01 && Math.abs(y - defaultY) < 0.01)) return [];
    return [{ itemIndex, x: clamp(x, 0, 100), y: clamp(y, 0, 100) }];
  });
}

export function snapComposePlacement(pointerX, pointerY, width, height, gridSize = 0, pieceSize = 32) {
  const imageWidth = Math.max(1, finiteCoordinate(width) || 1);
  const imageHeight = Math.max(1, finiteCoordinate(height) || 1);
  const size = Math.max(1, Math.min(finiteCoordinate(pieceSize) || 32, imageWidth, imageHeight));
  const grid = Math.max(0, finiteCoordinate(gridSize) || 0);
  let left = clamp((finiteCoordinate(pointerX) ?? imageWidth / 2) - size / 2, 0, imageWidth - size);
  let top = clamp((finiteCoordinate(pointerY) ?? imageHeight / 2) - size / 2, 0, imageHeight - size);
  if (grid > 0) {
    left = clamp(Math.round(left / grid) * grid, 0, Math.floor((imageWidth - size) / grid) * grid);
    top = clamp(Math.round(top / grid) * grid, 0, Math.floor((imageHeight - size) / grid) * grid);
  }
  return { x: left / imageWidth * 100, y: top / imageHeight * 100 };
}

// Pixel bounds use every nonzero alpha value, including antialiased edges.
export function alphaBounds(rgba, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!rgba[(y * width + x) * 4 + 3]) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

const spriteCache = new Map();
function decodeSprite(source, cors) {
  return new Promise(resolve => {
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    if (cors) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image.naturalWidth && image.naturalHeight ? image : null);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

// Keep original media untouched. Read in tiles to avoid a huge RGBA allocation.
// A cross-origin server that refuses CORS still gets the ordinary image fallback.
export function loadComposeSprite(source) {
  if (!source) return Promise.resolve(null);
  if (spriteCache.has(source)) return spriteCache.get(source);
  const task = (async () => {
    const image = await decodeSprite(source, true) || await decodeSprite(source, false);
    if (!image) return null;
    const width = image.naturalWidth, height = image.naturalHeight;
    const full = { x: 0, y: 0, width, height };
    try {
      const canvas = document.createElement('canvas');
      const tile = 512;
      canvas.width = Math.min(tile, width); canvas.height = Math.min(tile, height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let left = width, top = height, right = 0, bottom = 0;
      // Extremely large assets are intentionally rendered untrimmed instead of
      // blocking the UI with an unbounded pixel scan.
      if (!ctx || width * height > 32_000_000) return { image, bounds: full, trimmed: false };
      for (let y = 0; y < height; y += tile) for (let x = 0; x < width; x += tile) {
        const w = Math.min(tile, width - x), h = Math.min(tile, height - y);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
        const b = alphaBounds(ctx.getImageData(0, 0, w, h).data, w, h);
        if (b) {
          left = Math.min(left, x + b.x); top = Math.min(top, y + b.y);
          right = Math.max(right, x + b.x + b.width); bottom = Math.max(bottom, y + b.y + b.height);
        }
      }
      return right > left && bottom > top ? { image, bounds: { x: left, y: top, width: right - left, height: bottom - top }, trimmed: true } : null;
    } catch { return { image, bounds: full, trimmed: false }; }
  })().catch(() => null);
  spriteCache.set(source, task);
  if (spriteCache.size > 64) spriteCache.delete(spriteCache.keys().next().value);
  return task;
}

export function composePieceSize(width, height, pieceSize = 32) {
  return Math.max(1, Math.min(pieceSize, width, height));
}

export function composeVisibleSize(sprite, size) {
  const b = sprite?.bounds;
  if (!b) return { width: size, height: size };
  const scale = size / Math.max(b.width, b.height);
  return { width: b.width * scale, height: b.height * scale };
}

// Offline/authoring files store the square envelope's top-left (percent).
// Live answers store its center (per mille). Neither wire format needs to change.
export function composeMarkerBox(sprite, x, y, width, height, pieceSize = 32) {
  const size = composePieceSize(width, height, pieceSize);
  const visible = composeVisibleSize(sprite, size);
  return {
    left: x + (size - visible.width) / 2 / width * 100,
    top: y + (size - visible.height) / 2 / height * 100,
    width: visible.width / width * 100,
    height: visible.height / height * 100,
  };
}

export function composePointerPercent(clientX, clientY, rect) {
  return { x: clamp((clientX - rect.left) / Math.max(1, rect.width) * 100, 0, 100), y: clamp((clientY - rect.top) / Math.max(1, rect.height) * 100, 0, 100) };
}

export function composeLiveCenter(x, y, width, height, gridSize = 0, pieceSize = 32) {
  const p = snapComposePlacement(x, y, width, height, gridSize, pieceSize);
  const size = composePieceSize(width, height, pieceSize);
  return [Math.round(p.x * 10 + size / 2 / width * 1000), Math.round(p.y * 10 + size / 2 / height * 1000)];
}

export function drawComposeSprite(ctx, sprite, x, y, size, scaleX = 1, scaleY = 1) {
  if (!sprite) return false;
  const b = sprite.bounds, v = composeVisibleSize(sprite, size);
  const w = v.width * scaleX, h = v.height * scaleY;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite.image, b.x, b.y, b.width, b.height, x - w / 2, y - h / 2, w, h);
  return true;
}

// Real DOM hitbox is the cropped rectangle, not the original padded PNG.
// Reuse the mounted canvas on pointer movement; never rescan pixels per click.
const markerSprites = new WeakMap();
export function paintComposeMarker(node, sprite, label, x, y, width, height, pieceSize = 32) {
  const box = composeMarkerBox(sprite, x, y, width, height, pieceSize);
  for (const key of ['left', 'top', 'width', 'height']) node.style[key] = box[key] + '%';
  if (markerSprites.has(node) && markerSprites.get(node) === sprite) {
    if (!sprite && node.textContent !== label) node.textContent = label;
    return;
  }
  markerSprites.set(node, sprite);
  if (!sprite) { node.textContent = label; return; }
  const canvas = document.createElement('canvas');
  const b = sprite.bounds;
  const scale = Math.min(1, 512 / Math.max(b.width, b.height));
  canvas.width = Math.max(1, Math.round(b.width * scale)); canvas.height = Math.max(1, Math.round(b.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) { node.textContent = label; return; }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite.image, b.x, b.y, b.width, b.height, 0, 0, canvas.width, canvas.height);
  canvas.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;pointer-events:none';
  canvas.setAttribute('aria-hidden', 'true');
  node.replaceChildren(canvas);
}
