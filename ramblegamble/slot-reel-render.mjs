// Directional shutter integration on the existing CanvasTexture. No screen-
// space filter: only the moving cells receive samples, not the fixed symbols,
// grid lines, cabinet or camera. Reuse strip and isolated feather buffers.
import { SLOT_REEL_COLUMNS, SLOT_REEL_ROWS } from "./slot-reels.mjs?v=parked-reels-20261127-v1";

const EXPOSURE_SAMPLES = 17;

// Alpha is 0 at each exposed run boundary, 1 in the interior. Adjacent
// moving cells form one run (no artificial fade at their shared grid line).
export function slotFeatherStops(positions, count, feather) {
  const stops = [[0, 0]];
  const edge = Math.min(0.5, Math.max(0, feather)) / count;
  for (let i = 0; i < count; i++) {
    if (!positions.includes(i)) continue;
    const start = i / count;
    while (i + 1 < count && positions.includes(i + 1)) i++;
    const end = (i + 1) / count;
    stops.push([start, 0], [start + edge, 1], [end - edge, 1], [end, 0]);
  }
  stops.push([1, 0]);
  return stops;
}

export function createSlotLinePainter(createCanvas = () => document.createElement("canvas")) {
  const buffers = new Map();
  function getBuffer(key, width, height) {
    let buffer = buffers.get(key);
    if (!buffer) { buffer = createCanvas(); buffers.set(key, buffer); }
    if (buffer.width !== width) buffer.width = width;
    if (buffer.height !== height) buffer.height = height;
    return buffer;
  }
  return function paintLines(context, lines, drawSymbol) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    const cellWidth = width / SLOT_REEL_COLUMNS;
    const cellHeight = height / SLOT_REEL_ROWS;
    for (const { axis, index, positions, line, frame, blur, feather = 0 } of lines) {
      const horizontal = axis === "row";
      const count = horizontal ? SLOT_REEL_COLUMNS : SLOT_REEL_ROWS;
      const unit = horizontal ? cellWidth : cellHeight;
      if (frame.symbols) {
        // Waiting and settled reels use exact original/target art, without blur.
        for (const position of positions) {
          drawSymbol(context, horizontal ? position : index, horizontal ? index : position,
            frame.symbols[position], 0, 0);
        }
        continue;
      }
      // Isolate the feathered motion before alpha masking: destination-in on
      // the shared display would erase parked symbols and other tracks.
      const layer = feather > 0 ? getBuffer(`feather-${axis}`,
        Math.ceil(horizontal ? width : cellWidth), Math.ceil(horizontal ? cellHeight : height)) : null;
      const paint = layer ? layer.getContext("2d", { alpha: true }) : context;
      const paintIndex = layer ? 0 : index;
      if (layer) paint.clearRect(0, 0, layer.width, layer.height);
      // Keep a hard outer safety clip in addition to the inner soft mask.
      paint.save();
      paint.imageSmoothingEnabled = false;
      paint.beginPath();
      for (const position of positions) {
        paint.rect((horizontal ? position : paintIndex) * cellWidth,
          (horizontal ? paintIndex : position) * cellHeight, cellWidth, cellHeight);
      }
      paint.clip();
      const whole = Math.floor(frame.offset);
      const fraction = frame.offset - whole;
      if (blur * unit < 1) {
        for (let position = 0; position <= count; position++) {
          drawSymbol(paint, horizontal ? position : paintIndex, horizontal ? paintIndex : position,
            line.strip[whole + position], horizontal ? -fraction * unit : 0,
            horizontal ? 0 : -fraction * unit);
        }
      } else {
        // Paint an unblurred strip once, with one extra cell at both ends
        // (plus the partial trailing cell). Then integrate shifted copies.
        // Additive premultiplied-alpha weighting on a transparent destination
        // computes the exposure average instead of repeated dark/ghost layers.
        const bufferWidth = Math.ceil(horizontal ? (count + 3) * cellWidth : cellWidth);
        const bufferHeight = Math.ceil(horizontal ? cellHeight : (count + 3) * cellHeight);
        const buffer = getBuffer(axis, bufferWidth, bufferHeight);
        const stripContext = buffer.getContext("2d", { alpha: true });
        stripContext.imageSmoothingEnabled = false;
        stripContext.clearRect(0, 0, buffer.width, buffer.height);
        for (let position = -1; position <= count + 1; position++) {
          const local = position + 1;
          drawSymbol(stripContext, horizontal ? local : 0, horizontal ? 0 : local,
            line.strip[whole + position], horizontal ? -fraction * unit : 0,
            horizontal ? 0 : -fraction * unit);
        }
        paint.globalCompositeOperation = "lighter";
        paint.globalAlpha = 1 / EXPOSURE_SAMPLES;
        for (let sample = 0; sample < EXPOSURE_SAMPLES; sample++) {
          const shift = (sample / (EXPOSURE_SAMPLES - 1) - 0.5) * blur * unit;
          paint.drawImage(buffer, horizontal ? -unit + shift : paintIndex * cellWidth,
            horizontal ? paintIndex * cellHeight : -unit + shift);
        }
      }
      paint.restore();
      if (layer) {
        paint.save();
        paint.globalCompositeOperation = "destination-in";
        paint.globalAlpha = 1;
        const gradient = paint.createLinearGradient(0, 0, horizontal ? width : 0, horizontal ? 0 : height);
        for (const [at, alpha] of slotFeatherStops(positions, count, feather)) {
          gradient.addColorStop(at, `rgba(0,0,0,${alpha})`);
        }
        paint.fillStyle = gradient;
        paint.fillRect(0, 0, layer.width, layer.height);
        paint.restore();
        context.save();
        context.globalCompositeOperation = "source-over";
        context.globalAlpha = 1;
        context.imageSmoothingEnabled = false;
        context.drawImage(layer, horizontal ? 0 : index * cellWidth, horizontal ? index * cellHeight : 0,
          horizontal ? width : cellWidth, horizontal ? cellHeight : height);
        context.restore();
      }
    }
  };
}
