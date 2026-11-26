// Temporary, camera-only flight. Y is world up; no simulation state is touched.
export const FREECAM_SPEED = 5; // world units / second
export const FREECAM_LOOK = .0025; // radians / mouse pixel
const PITCH_LIMIT = Math.PI / 2 - .01;
const clamp = (v, max) => Math.max(-max, Math.min(max, v));
const wrap = v => Math.atan2(Math.sin(v), Math.cos(v));
const movementCodes = new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE']);

export function createFlight(position, direction) {
  const pos = { ...position };
  let yaw = Math.atan2(-direction.x, -direction.z);
  let pitch = clamp(Math.atan2(direction.y, Math.hypot(direction.x, direction.z)), PITCH_LIMIT);
  return {
    look(dx, dy) {
      if (Number.isFinite(dx)) yaw = wrap(yaw - dx * FREECAM_LOOK);
      if (Number.isFinite(dy)) pitch = clamp(pitch - dy * FREECAM_LOOK, PITCH_LIMIT);
    },
    move(keys, seconds) {
      const dt = Number.isFinite(seconds) ? Math.max(0, Math.min(.05, seconds)) : 0;
      const f = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
      const r = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
      const u = Number(keys.has('KeyE')) - Number(keys.has('KeyQ'));
      const scale = FREECAM_SPEED * dt / (Math.hypot(f, r, u) || 1);
      pos.x += (-Math.sin(yaw) * f + Math.cos(yaw) * r) * scale;
      pos.z += (-Math.cos(yaw) * f - Math.sin(yaw) * r) * scale;
      pos.y += u * scale;
    },
    pose() {
      const cos = Math.cos(pitch);
      return { position: { ...pos }, direction: {x:-Math.sin(yaw)*cos, y:Math.sin(pitch), z:-Math.cos(yaw)*cos} };
    },
  };
}

// Bind in capture phase: the game's existing shortcuts/clicks must never see
// input intended for flight, including auto-repeat after releasing the mouse.
export function bindHoldFreecam({ surface, viewport, eligible, readPose, writePose, onStart, onStop,
  win = window, doc = document }) {
  let flight = null, lastTime = null, locked = false, pending = false, lastMouse = null;
  const keys = new Set(), swallowed = new Set(), blockedButtons = new Set();
  const consume = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  const inside = e => viewport.contains(e.target);
  const editable = e => e.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
  const code = e => e.code || (e.key?.length === 1 ? 'Key' + e.key.toUpperCase() : e.key);
  function releaseLock() {
    if (doc.pointerLockElement === surface) { try { doc.exitPointerLock(); } catch {} }
  }
  function stop() {
    if (!flight) { releaseLock(); return; }
    flight = null; lastTime = null; lastMouse = null; locked = false; keys.clear();
    releaseLock(); onStop();
  }
  function lockFailed() { pending = false; } // bounded drag fallback remains active
  function requestLock() {
    if (pending || !surface.requestPointerLock || doc.pointerLockElement) return;
    pending = true;
    try {
      const result = surface.requestPointerLock();
      if (result?.catch) result.catch(lockFailed);
    } catch { lockFailed(); }
  }
  function begin(e) {
    const initial = readPose();
    flight = createFlight(initial.position, initial.direction);
    lastTime = null; lastMouse = [e.clientX,e.clientY]; keys.clear();
    onStart();
    surface.focus({preventScroll:true});
    requestLock(); // synchronous, from the actual mouse activation
  }
  win.addEventListener('mousedown', e => {
    if (flight) { blockedButtons.add(e.button); consume(e); return; }
    blockedButtons.delete(e.button);
    if (e.button !== 1 || e.buttons !== 4 || !inside(e) || editable(e) || !eligible()) return;
    blockedButtons.add(1); consume(e); begin(e);
  }, true);
  win.addEventListener('mouseup', e => {
    if (!flight) { if (blockedButtons.has(e.button)) consume(e); return; }
    blockedButtons.add(e.button); consume(e);
    if (e.button === 1 || !(e.buttons & 4)) stop();
  }, true);
  // pointerdown precedes mousedown; suppress secondary button actions during
  // flight, but don't cancel the middle pointerdown that creates activation.
  win.addEventListener('pointerdown', e => {
    if (!flight) { blockedButtons.delete(e.button); return; }
    blockedButtons.add(e.button); consume(e);
  }, true);
  win.addEventListener('pointerup', e => {
    if (flight && e.pointerType === 'mouse' && !(e.buttons & 4)) { blockedButtons.add(e.button); stop(); }
    // Do not cancel pointerup: the compatible mouseup must still be delivered.
    if (flight || blockedButtons.has(e.button)) e.stopImmediatePropagation();
  }, true);
  for (const type of ['click','auxclick','contextmenu']) win.addEventListener(type,e => {
    // Keyboard-generated clicks have detail 0; outside flight leave them alone.
    if (flight || (blockedButtons.has(e.button) && (type !== 'click' || e.detail !== 0))) consume(e);
  }, true);
  win.addEventListener('mousemove', e => {
    if (!flight) return;
    if (!(e.buttons & 4) || !eligible()) { stop(); return; }
    let dx,dy;
    if (locked) { dx=e.movementX; dy=e.movementY; }
    else { dx=e.clientX-lastMouse[0]; dy=e.clientY-lastMouse[1]; }
    lastMouse=[e.clientX,e.clientY];
    flight.look(dx,dy); writePose(flight.pose()); consume(e);
  }, true);
  win.addEventListener('keydown', e => {
    const key = code(e);
    if (!flight) {
      if (swallowed.has(key) && e.repeat) consume(e);
      else swallowed.delete(key);
      return;
    }
    if (key) swallowed.add(key);
    consume(e);
    if (e.key === 'Escape') { stop(); return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && movementCodes.has(key)) keys.add(key);
  }, true);
  win.addEventListener('keyup', e => {
    const key = code(e); keys.delete(key);
    const had = swallowed.delete(key);
    if (flight || had) consume(e);
  }, true);
  doc.addEventListener('pointerlockchange', () => {
    pending=false;
    if (doc.pointerLockElement === surface) {
      if (!flight || !eligible()) { stop(); return; }
      locked=true;
    } else if (locked) stop(); // Esc / browser revoked lock
  });
  doc.addEventListener('pointerlockerror', lockFailed);
  win.addEventListener('blur', stop);
  win.addEventListener('pagehide', stop);
  win.addEventListener('pointercancel', stop, true);
  win.addEventListener('mouseout', e => { if (flight && !locked && !e.relatedTarget) stop(); }, true);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(); });
  doc.addEventListener('focusin', e => { if (flight && e.target !== surface) stop(); });
  return {
    get active() { return flight !== null; },
    stop,
    step(time) {
      if (!flight) return;
      if (!eligible()) { stop(); return; }
      const dt = lastTime === null ? 0 : (time-lastTime)/1000;
      lastTime=time; flight.move(keys,dt); writePose(flight.pose());
    },
  };
}
