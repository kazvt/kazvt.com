// Pure presentation: no card outcome, order, scoring or storage access.
export const HORROR_FRAME_MS = 100;
export const HORROR_VIDEO = '/ramblegamble/assets/smeemo/apparitions.mp4';
export function horrorFrame(time) { return Math.floor(time / HORROR_FRAME_MS) * HORROR_FRAME_MS; }
function hash(value) {
  let h = 2166136261;
  for (const ch of String(value)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// Unique stains within a round; shuffle is independent of the hidden winner.
// Sorting makes the mapping stable across preview/deal order changes.
export function cardStains(roundId, cardIds) {
  const ids = [...cardIds].sort();
  let seed = hash(roundId);
  const pool = Array.from({length:12}, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return new Map(ids.map((id,i) => [id, pool[i % pool.length]]));
}
export function stainUrl(index) {
  return `url("/ramblegamble/assets/smeemo/stain-${String(index).padStart(2,'0')}.png")`;
}
export function horrorVisible({hidden, locked, offTable, mode, excluded}) {
  return !hidden && !locked && !offTable && mode === 'smeemo' && !excluded;
}
// One silent, lazy video, no render loop or second WebGL context. Observe only
// lifecycle attributes, never card updates. Rejected playback retains fog.
export function mountSmeemoHorror({preview, layer, header, reduced}) {
  const doc = preview.ownerDocument;
  const root = doc.createElement('div'); root.className='rg-smeemo-cinema'; root.hidden=true; root.setAttribute('aria-hidden','true');
  const video = doc.createElement('video'); video.className='rg-smeemo-apparitions'; video.muted=true; video.defaultMuted=true; video.loop=true; video.playsInline=true; video.preload='none';
  const fog = doc.createElement('div'); fog.className='rg-smeemo-fog';
  const grain = doc.createElement('div'); grain.className='rg-smeemo-grain';
  root.append(video,fog,grain); preview.append(root);
  let active=false, playing=false, suspended=false, generation=0;
  const stopVideo=()=>{generation++; playing=false; video.pause();};
  function sync() {
    const next=!suspended && horrorVisible({hidden:doc.hidden || layer.hidden,locked:doc.documentElement.hasAttribute('data-rg-host-locked'),offTable:layer.classList.contains('is-off-table'),mode:header.dataset.cardMode,excluded:['is-menu','is-dice-mode','is-freecam','is-freecam-detached'].some(c=>preview.classList.contains(c))});
    if (next!==active) { active=next; root.hidden=!active; preview.classList.toggle('is-smeemo-cinema',active); }
    if (!active || reduced.matches) { if (playing) stopVideo(); return; }
    if (playing) return;
    playing=true; const ticket=++generation;
    if (!video.getAttribute('src')) video.src=HORROR_VIDEO;
    try { Promise.resolve(video.play()).catch(()=>{if(ticket===generation)video.pause();}); } catch {video.pause();}
  }
  const observer=new MutationObserver(sync);
  observer.observe(preview,{attributes:true,attributeFilter:['class']});
  observer.observe(layer,{attributes:true,attributeFilter:['class','hidden']});
  observer.observe(header,{attributes:true,attributeFilter:['data-card-mode']});
  observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-rg-host-locked']});
  doc.addEventListener('visibilitychange',sync); reduced.addEventListener?.('change',sync);
  doc.defaultView.addEventListener('pagehide',()=>{suspended=true;sync();});
  doc.defaultView.addEventListener('pageshow',()=>{suspended=false;sync();});
  sync(); return {sync};
}
