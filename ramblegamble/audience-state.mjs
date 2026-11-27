// Host-selected emotions persist until another request; only minimum dwell is timed.
export const AUDIENCE_KEY = 'ramblegamble.audience.mode.v1';
export const AUDIENCE_MIN = Object.freeze({idle:1200, cheer:4200, suspense:2300, shock:3000});
export const AUDIENCE_MODES = Object.freeze(['auto', ...Object.keys(AUDIENCE_MIN)]);
export function validAudienceMode(mode) { return AUDIENCE_MODES.includes(mode); }
export function readAudienceMode(storage) {
  try { storage ??= globalThis.localStorage; const mode=storage.getItem(AUDIENCE_KEY); return validAudienceMode(mode)?mode:'auto'; } catch { return 'auto'; }
}
export function writeAudienceMode(mode, storage) {
  if(!validAudienceMode(mode)) return false;
  try { storage ??= globalThis.localStorage; storage.setItem(AUDIENCE_KEY,mode); return true; } catch { return false; }
}
export function createAudienceState(now=0, mode='auto') {
  let active='idle', since=now, auto='idle', manual=validAudienceMode(mode)?mode:'auto';
  // The initial view need not wait before playing the first requested emotion.
  since -= AUDIENCE_MIN.idle;
  const desired=()=>manual==='auto'?auto:manual;
  function step(time) {
    const next=desired();
    if(next!==active && time-since>=AUDIENCE_MIN[active]) { active=next; since=time; }
    return active;
  }
  // Horror overrides minimum cheer dwell and discards stale cheer intent.
  // An explicit later reaction can still request a fresh celebration.
  function silence(time) { auto='idle'; if(manual==='cheer')manual='auto'; active='idle'; since=time; return active; }
  return { step, silence, setMode(mode,time) { if(validAudienceMode(mode)) manual=mode; return step(time); }, react(emotion,time) { if(Object.hasOwn(AUDIENCE_MIN,emotion))auto=emotion; return step(time); }, get mode(){return manual;}, get active(){return active;}, get pending(){return desired();} };
}
export function audienceReact(emotion) {
  if(typeof window!=='undefined' && Object.hasOwn(AUDIENCE_MIN,emotion)) window.dispatchEvent(new CustomEvent('rg:audience-reaction',{detail:{emotion}}));
}
