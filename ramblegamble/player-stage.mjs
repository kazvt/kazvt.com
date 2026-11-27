// Presentation-only. No invitation access, transport, game events or answer data.
const page = document.querySelector('body.rg-player-stage');
const cursor = page?.querySelector('.rg-player-cursor');
if (page && cursor) {
  const fine = matchMedia('(any-hover: hover) and (any-pointer: fine)');
  let frame = 0, point = null;
  function clearCursor() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; point = null; cursor.classList.remove('is-visible');
  }
  function sync() {
    page.dataset.motion = document.hidden ? 'off' : 'on';
    clearCursor();
  }
  function paint() {
    frame = 0;
    if (!point || page.dataset.motion !== 'on' || !fine.matches) return clearCursor();
    cursor.style.transform = `translate3d(${point.x - 12}px,${point.y - 12}px,0)`;
    cursor.classList.add('is-visible');
  }
  document.addEventListener('pointermove', event => {
    // A small halo only on empty scenery. Native cursor and all precision
    // game/input interactions remain untouched; no perpetual RAF or trail.
    if (page.dataset.motion !== 'on' || !fine.matches || event.pointerType !== 'mouse' || event.buttons || event.target?.closest?.('main,button,a,input,textarea,select,canvas')) return clearCursor();
    if (event.clientX < 12 || event.clientY < 12 || event.clientX > innerWidth - 12 || event.clientY > innerHeight - 12) return clearCursor();
    point = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });
  for (const event of ['pointerdown','pointercancel','scroll']) document.addEventListener(event, clearCursor, { passive: true, capture: true });
  document.documentElement.addEventListener('pointerleave', clearCursor);
  window.addEventListener('blur', clearCursor);
  window.addEventListener('resize', clearCursor);
  window.addEventListener('pagehide', clearCursor);
  window.addEventListener('pageshow', sync);
  document.addEventListener('visibilitychange', sync);
  fine.addEventListener('change', clearCursor);
  sync();
}
