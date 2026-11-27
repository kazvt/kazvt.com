// Slow suspense on entry, normal responsive navigation on exit. The curtain
// keeps its own 4s/2.4s schedule; never arrive while it is still retracting.
export const SPOOKY_FOCUS_MS=4400;
export function isSpookyView(kind){return kind==='dice-door'||kind==='smeemo-crowd';}
export function cameraTravelDuration(kind,theatreMs=0){return Math.max(isSpookyView(kind)?SPOOKY_FOCUS_MS:520,theatreMs);}
export function suspenseEase(p){p=Math.max(0,Math.min(1,p));return p*p*p*(p*(p*6-15)+10);}
// Inward-facing close-up, never cross the crowd plane. Slight elevation retains
// surrounding spectators rather than isolating or artificially highlighting cat.
export function crowdCloseupPose(anchor,aspect,fov){
 const tan=Math.tan(fov*Math.PI/360),distance=Math.max(2.5,1.05/(tan*Math.max(.2,aspect)),.85/tan);
 return {target:{...anchor},position:{x:anchor.x-distance,y:anchor.y+.20*distance,z:anchor.z}};
}
