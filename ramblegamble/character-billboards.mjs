// Live browser sources are upright world-space standees, not camera-facing sprites.
// Keep authored +Z as the neutral facing; only a fraction of eye bearing is followed.
export const CHARACTER_YAW_WEIGHT = .4;
export const CHARACTER_YAW_LIMIT = 12 * Math.PI / 180;
// Stable high-resolution viewport for the live source; do not resize on camera motion.
export const CHARACTER_SOURCE_SIZE = 1024;
export const HOST_CHARACTER_X_OFFSET = -.18;
export const CHARACTER_WORLD_SIZE = 1.8;

export function characterYaw(dx, dz) {
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || Math.hypot(dx, dz) < 1e-8) return 0;
  return Math.max(-CHARACTER_YAW_LIMIT, Math.min(CHARACTER_YAW_LIMIT, Math.atan2(dx, dz) * CHARACTER_YAW_WEIGHT));
}

export function standingCharacterPose(bounds, host = false) {
  // Measured from rg_stage.gltf: contestant deck y=.3048; host's raised deck
  // y=.6096. The offset clears the chair's +Z face even at maximum yaw.
  const footY = host ? .6096 : .3048;
  return { worldWidth: CHARACTER_WORLD_SIZE, worldHeight: CHARACTER_WORLD_SIZE,
    anchor: { x: (bounds.min.x + bounds.max.x) / 2 + (host ? HOST_CHARACTER_X_OFFSET : 0), y: footY + CHARACTER_WORLD_SIZE / 2,
      z: bounds.max.z + (host ? .24 : .32) } };
}

export function characterCorners(anchor, width, height, yaw) {
  const x = Math.cos(yaw) * width / 2, z = -Math.sin(yaw) * width / 2, y = height / 2;
  return [[-1,1],[1,1],[1,-1],[-1,-1]].map(([s,t]) => ({x:anchor.x+s*x,y:anchor.y+t*y,z:anchor.z+s*z}));
}

export function projectCharacterQuad({anchor, worldWidth, worldHeight}, eye, project, viewport, near) {
  const dx = eye.x - anchor.x, dz = eye.z - anchor.z;
  const yaw = characterYaw(dx, dz);
  // Hide edge-on/rear-facing cutouts, not mirror the source or let a nearly
  // singular projection grow without bound when flying through a character.
  if (dx * Math.sin(yaw) + dz * Math.cos(yaw) <= .025 * Math.hypot(dx,dz)) return null;
  const projected = characterCorners(anchor, worldWidth, worldHeight, yaw).map(project);
  if (projected.some(p => ![p.x,p.y,p.z,p.depth].every(Number.isFinite) || p.depth <= near || p.z < -1 || p.z > 1)) return null;
  const corners = projected.map(p => ({x:(p.x+1)*viewport.width/2,y:(1-p.y)*viewport.height/2}));
  if (corners.every(p=>p.x<0) || corners.every(p=>p.x>viewport.width) || corners.every(p=>p.y<0) || corners.every(p=>p.y>viewport.height)) return null;
  const area = Math.abs(corners.reduce((sum,p,i)=>{const q=corners[(i+1)%4];return sum+p.x*q.y-q.x*p.y;},0))/2;
  if (!Number.isFinite(area) || area < 1) return null;
  return {corners,depth:projected.reduce((sum,p)=>sum+p.depth,0)/4,yaw};
}

export function pointInCharacterQuad(corners,x,y) {
  if (!corners?.length) return false;
  let sign=0;
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4],cross=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);
    if(Math.abs(cross)<1e-6)continue;
    if(sign&&Math.sign(cross)!==sign)return false;
    sign=Math.sign(cross);
  }
  return Boolean(sign);
}
