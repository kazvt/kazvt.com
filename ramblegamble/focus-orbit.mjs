// A small presentation orbit, not a free camera. Angles are radians.
export function focusLimits(kind) {
  return kind === "overview" ? [0, 0] : kind === "slot" ? [.024, .017]
    : kind === "dice-door" || kind === "trivia" ? [.032, .022] : [.045, .032];
}
const clamp = (v, max) => Math.max(-max, Math.min(max, Number.isFinite(v) ? v : 0));
export function createFocusOrbit() {
  let kind = "overview", yaw = 0, pitch = 0, goalYaw = 0, goalPitch = 0, previous = null;
  return {
    reset(next) { kind = next; yaw = pitch = goalYaw = goalPitch = 0; previous = null; },
    nudge(dx, dy) { const [x,y] = focusLimits(kind); goalYaw = clamp(goalYaw + dx, x); goalPitch = clamp(goalPitch + dy, y); },
    step(time, reduced = false) {
      const dt = previous === null ? 0 : Math.max(0, Math.min(.05, (time - previous) / 1000));
      previous = time;
      const weight = reduced ? 1 : 1 - Math.exp(-dt * 9);
      yaw += (goalYaw - yaw) * weight; pitch += (goalPitch - pitch) * weight;
      if (Math.abs(goalYaw-yaw) < .00002) yaw=goalYaw;
      if (Math.abs(goalPitch-pitch) < .00002) pitch=goalPitch;
      return {yaw, pitch, moving: yaw !== goalYaw || pitch !== goalPitch};
    },
  };
}
// Reconstruct from an immutable authored offset every frame. No dolly or roll.
export function orbitPosition(base, target, yaw, pitch) {
  if (yaw === 0 && pitch === 0) return {x:base.x,y:base.y,z:base.z};
  const x = base.x-target.x, y = base.y-target.y, z = base.z-target.z;
  const radius = Math.hypot(x,y,z);
  if (!radius) return {...base};
  const azimuth = Math.atan2(x,z) + yaw;
  const elevation = Math.max(-Math.PI/2+.01, Math.min(Math.PI/2-.01, Math.asin(y/radius) + pitch));
  const horizontal = radius * Math.cos(elevation);
  return {x:target.x+Math.sin(azimuth)*horizontal, y:target.y+Math.sin(elevation)*radius, z:target.z+Math.cos(azimuth)*horizontal};
}
// Shared drag recognizer: normal clicks still activate objects; moving 6px starts orbit.
export function bindFocusDrag(surface, {enabled, move, onMove = () => {}}) {
  let drag = null, suppress = false;
  surface.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.isPrimary === false || !enabled(event)) return;
    suppress = false;
    drag = { id:event.pointerId, x:event.clientX, y:event.clientY, active:false };
  });
  surface.addEventListener("pointermove", event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!enabled(event) || !(event.buttons & 1)) { drag=null; return; }
    const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
    if (!drag.active && Math.hypot(dx,dy)<6) return;
    if (!drag.active) { drag.active=true; suppress=true; try { surface.setPointerCapture(event.pointerId); } catch {} }
    drag.x=event.clientX; drag.y=event.clientY;
    move(-dx*.0007,dy*.0007); onMove();
  });
  const end = event => { if(drag?.id===event.pointerId){ drag=null; } };
  for(const type of ["pointerup","pointercancel","lostpointercapture"]) surface.addEventListener(type,end);
  surface.addEventListener("pointerleave", () => { if (!drag?.active) drag=null; });
  return { consumeClick() { const value=suppress; suppress=false; return value; }, reset(){drag=null;suppress=false;} };
}
