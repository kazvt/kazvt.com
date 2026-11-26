// Directional shutter integration on the existing CanvasTexture. No screen-
// space filter: only the moving cells receive samples, not the fixed symbols,
// grid lines, cabinet or camera. The two small strip canvases are reused.
import { SLOT_REEL_COLUMNS, SLOT_REEL_ROWS } from "./slot-reels.mjs?v=directional-reels-20261126-v1";

const EXPOSURE_SAMPLES = 17;

export function createSlotLinePainter(createCanvas = () => document.createElement("canvas")) {
  const buffers = new Map();
  return function paintLines(context, lines, drawSymbol) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    const cellWidth = width / SLOT_REEL_COLUMNS;
    const cellHeight = height / SLOT_REEL_ROWS;
    for (const { axis, index, positions, line, frame, blur } of lines) {
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
      // Clip at destination cell boundaries even when a streak crosses a
      // stationary berry/star. The clipped destination was cleared by caller.
      context.save();
      context.beginPath();
      for (const position of positions) {
        context.rect((horizontal ? position : index) * cellWidth,
          (horizontal ? index : position) * cellHeight, cellWidth, cellHeight);
      }
      context.clip();
      const whole = Math.floor(frame.offset);
      const fraction = frame.offset - whole;
      if (blur * unit < 1) {
        for (let position = 0; position <= count; position++) {
          drawSymbol(context, horizontal ? position : index, horizontal ? index : position,
            line.strip[whole + position], horizontal ? -fraction * unit : 0,
            horizontal ? 0 : -fraction * unit);
        }
      } else {
        // Paint an unblurred strip once, with one extra cell at both ends
        // (plus the partial trailing cell). Then integrate shifted copies.
        // Additive premultiplied-alpha weighting on a transparent destination
        // computes the exposure average instead of repeated dark/ghost layers.
        let buffer = buffers.get(axis);
        if (!buffer) { buffer = createCanvas(); buffers.set(axis, buffer); }
        const bufferWidth = Math.ceil(horizontal ? (count + 3) * cellWidth : cellWidth);
        const bufferHeight = Math.ceil(horizontal ? cellHeight : (count + 3) * cellHeight);
        if (buffer.width !== bufferWidth) buffer.width = bufferWidth;
        if (buffer.height !== bufferHeight) buffer.height = bufferHeight;
        const stripContext = buffer.getContext("2d", { alpha: true });
        stripContext.imageSmoothingEnabled = false;
        stripContext.clearRect(0, 0, buffer.width, buffer.height);
        for (let position = -1; position <= count + 1; position++) {
          const local = position + 1;
          drawSymbol(stripContext, horizontal ? local : 0, horizontal ? 0 : local,
            line.strip[whole + position], horizontal ? -fraction * unit : 0,
            horizontal ? 0 : -fraction * unit);
        }
        context.globalCompositeOperation = "lighter";
        context.globalAlpha = 1 / EXPOSURE_SAMPLES;
        context.imageSmoothingEnabled = false;
        for (let sample = 0; sample < EXPOSURE_SAMPLES; sample++) {
          const shift = (sample / (EXPOSURE_SAMPLES - 1) - 0.5) * blur * unit;
          context.drawImage(buffer, horizontal ? -unit + shift : index * cellWidth,
            horizontal ? index * cellHeight : -unit + shift);
        }
      }
      context.restore();
    }
  };
}
