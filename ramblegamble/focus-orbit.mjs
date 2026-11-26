// A small presentation orbit, not a free camera. Angles are radians.
export function focusLimits(kind) {
  return kind === "overview" ? [0, 0] : kind === "slot" ? [.048, .034]
    : kind === "dice-door" || kind === "trivia" ? [.064, .044] : [.090, .064];
}
const clamp = (v, max) => Math.max(-max, Math.min(max, Number.isFinite(v) ? v : 0));
export function createFocusOrbit() {
  let kind = "overview", yaw = 0, pitch = 0, goalYaw = 0, goalPitch = 0, previous = null;
  return {
    reset(next) { kind = next; yaw = pitch = goalYaw = goalPitch = 0; previous = null; },
    follow(x, y) { const [maxX,maxY] = focusLimits(kind); goalYaw = clamp(x, 1)*maxX || 0; goalPitch = clamp(y, 1)*maxY || 0; },
    hold() { goalYaw = yaw; goalPitch = pitch; },
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
// Normalized screen-space input: absolute target, not accumulated mouse deltas.
export function focusPointerTarget(rect, x, y) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0) || ![rect.left,rect.top,x,y,rect.width,rect.height].every(Number.isFinite)) return null;
  return [clamp(2*(x-rect.left)/rect.width-1, 1), clamp(1-2*(y-rect.top)/rect.height, 1)];
}
// Shared drag recognizer: normal clicks still activate objects; moving 6px starts orbit.
export function bindFocusDrag(surface, {enabled, move, onMove = () => {}, hoverSurface = surface,
  follow = null, hoverEnabled = enabled, hold = () => {}, onHover = () => {}}) {
  let drag = null, suppress = false, hovering = false, frozen = false;
  function clearHover() {
    if (!hovering) return;
    hovering = frozen = false;
    follow?.(0,0); onHover();
  }
  function freezeHover() {
    if (!hovering || frozen) return;
    frozen = true;
    hold(); onHover();
  }
  function stopFollowing() { freezeHover(); hovering = frozen = false; }
  surface.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.isPrimary === false || !enabled(event)) return;
    freezeHover();
    suppress = false;
    drag = { id:event.pointerId, x:event.clientX, y:event.clientY, active:false };
  });
  surface.addEventListener("pointermove", event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!enabled(event) || !(event.buttons & 1)) { drag=null; return; }
    const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
    if (!drag.active && Math.hypot(dx,dy)<6) return;
    if (!drag.active) { stopFollowing(); drag.active=true; suppress=true; try { surface.setPointerCapture(event.pointerId); } catch {} }
    drag.x=event.clientX; drag.y=event.clientY;
    move(-dx*.0007,dy*.0007); onMove();
  });
  const end = event => { if(drag?.id===event.pointerId){ drag=null; } };
  for(const type of ["pointerup","pointercancel","lostpointercapture"]) surface.addEventListener(type,end);
  surface.addEventListener("pointerleave", () => { if (!drag?.active) drag=null; });
  if (follow) {
    // Hover uses the stable viewport, while drag/click stay on the original hit target.
    hoverSurface.addEventListener("pointermove", event => {
      if (event.isPrimary === false || !["mouse","pen"].includes(event.pointerType) || event.buttons || drag) return;
      if (!hoverEnabled(event)) { freezeHover(); return; }
      const target = focusPointerTarget(hoverSurface.getBoundingClientRect(), event.clientX, event.clientY);
      if (!target) return;
      hovering = true; frozen = false; follow(...target); onHover();
    });
    hoverSurface.addEventListener("pointerover", event => {
      if (event.isPrimary !== false && ["mouse","pen"].includes(event.pointerType) && !hoverEnabled(event)) freezeHover();
    });
    hoverSurface.addEventListener("pointerleave", clearHover);
    hoverSurface.addEventListener("pointercancel", clearHover);
    // A DOM overlay button must not slide out from under the pointer during a press.
    hoverSurface.addEventListener("pointerdown", freezeHover, {capture:true});
  }
  return { consumeClick() { const value=suppress; suppress=false; return value; }, clearHover, stopFollowing,
    reset(){drag=null;suppress=false;hovering=frozen=false;} };
}
