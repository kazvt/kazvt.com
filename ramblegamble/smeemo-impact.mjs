// Presentation-only: all inputs describe already committed game transitions.
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export function smeemoImpactSpec(kind, count = 0) {
  const step = clamp(Number.isFinite(count) ? Math.floor(count) : 0, 0, 9);
  const won = kind === 'win', intro = kind === 'start';
  return {
    strength: intro ? .82 : won ? 1 : .50 + .045 * step,
    duration: intro ? 1120 : won ? 1250 : 760 + 32 * step,
    rate: intro ? .80 : .90 * 2 ** ((step - 1 + (won ? 2 : 0)) / 12),
  };
}
export function smeemoImpactTransition(before, after, opened) {
  if (!after) return null;
  if (opened && before?.id !== after.id && after.draws.length === 0) return { kind: 'start', count: 0 };
  if (before?.id !== after.id || after.draws.length <= before.draws.length) return null;
  // Only append-only committed reveals, not replacement/recovery snapshots.
  if (!before.draws.every((draw, i) => draw.id === after.draws[i]?.id)) return null;
  const fresh = after.draws.slice(before.draws.length);
  return { kind: fresh.some(draw => draw.smeemo) ? 'win' : 'reveal', count: after.draws.length };
}
export function sampleSmeemoImpact(pulses, now, width, height) {
  let energy = 0;
  for (const { at, strength, duration } of pulses) {
    const age = now - at;
    if (age < 0 || age >= duration) continue;
    // Smooth attack avoids a one-frame snap; squared decay feels weighty.
    energy += strength * smooth(age / 95) * (1 - smooth((age - 95) / (duration - 95))) ** 2;
  }
  const e = clamp(energy, 0, 1);
  const t = now / 1000;
  // Continuous band-limited multi-frequency shake, never random per frame.
  const x = e * (6.5 * Math.sin(t * 2 * Math.PI * 7) + 3.5 * Math.sin(t * 2 * Math.PI * 11.3));
  const y = e * (4.0 * Math.sin(t * 2 * Math.PI * 8.1 + .9) + 2.5 * Math.sin(t * 2 * Math.PI * 12.2));
  // Uniform overscan keeps every screen edge covered, even on tiny screens.
  const scale = 1 + Math.max(.067 * e, 2 * Math.abs(x) / Math.max(1, width), 2 * Math.abs(y) / Math.max(1, height));
  return { energy: e, x, y, scale, uiX: x * .15, uiY: y * .19, uiScale: 1 + .012 * e };
}

export function createSmeemoImpact({ requestFrame, cancelFrame, now, canRun, isVisible, reduced, size, paint, clear, sound, stopSound }) {
  let frame = null, pending = null, pulses = [], live = false;
  function stop() {
    if (frame !== null) cancelFrame(frame);
    frame = null; pending = null; pulses = []; live = false;
    clear(); stopSound();
  }
  function schedule() { if (frame === null) frame = requestFrame(tick); }
  function begin(event, time) {
    const spec = smeemoImpactSpec(event.kind, event.count);
    live = true;
    audioUntil = time + (event.kind === "win" ? 4700 : 1500);
    sound(event, spec);
    if (!reduced()) pulses.push({ ...spec, at: time });
    // The visual tail is bounded even during a burst of clicks.
    pulses = pulses.slice(-10);
  }
  function tick(time) {
    frame = null;
    if (!canRun()) { stop(); return; }
    if (pending) {
      if (time > pending.deadline) { stop(); return; }
      if (!isVisible()) { schedule(); return; }
      const event = pending.event; pending = null; begin(event, time);
    }
    if (!isVisible()) { stop(); return; }
    if (reduced()) pulses = [];
    pulses = pulses.filter(p => time - p.at < p.duration);
    if (pulses.length) {
      const { width, height } = size();
      paint(sampleSmeemoImpact(pulses, time, width, height));
      schedule();
    } else {
      clear();
      // Keep observing the stage for the finite audio tail, so leaving the
      // table also cancels sound when motion is disabled or has finished.
      if (live && time < audioUntil) schedule(); else live = false;
    }
  }
  let audioUntil = 0;
  function trigger(event) {
    if (!canRun()) return;
    const time = now();
    if (event.kind === 'start') {
      stop(); pending = { event, deadline: time + 3200 }; schedule();
    } else if (isVisible()) {
      pending = null; begin(event, time); schedule();
    }
  }
  return { trigger, stop };
}
