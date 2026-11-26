// Presentation-only spatial audio and particles, based on the actual doorway.
const clamp01 = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t = clamp01(n); return t*t*(3-2*t); };
export const VIP_ZONE = Object.freeze({ silentDistance: 3.65, fadeDistance: 6.2, outsideDrip: .14, outsideCutoff: 480, insideCutoff: 3400 });

export function portalDistance(position, door) {
  if (!position || ![position.x,position.y,position.z].every(Number.isFinite)) return Infinity;
  // Distance to the aperture, not the infinite wall or the room's center.
  const y = Math.max(door.minY, Math.min(door.maxY, position.y));
  const z = Math.max(door.minZ, Math.min(door.maxZ, position.z));
  return Math.hypot(position.x-door.wallX, position.y-y, position.z-z);
}

export function sampleVipAmbience(position, door, { inside = false, focused = false } = {}) {
  if (inside) return { room: 0, water: 1, cutoff: VIP_ZONE.insideCutoff };
  const d = focused ? Math.min(portalDistance(position,door), VIP_ZONE.silentDistance) : portalDistance(position,door);
  const room = smooth((d-VIP_ZONE.silentDistance)/(VIP_ZONE.fadeDistance-VIP_ZONE.silentDistance));
  return { room, water: VIP_ZONE.outsideDrip*(1-room), cutoff: VIP_ZONE.outsideCutoff };
}

export const PORTAL_PARTICLE_COUNT = 84;
// Fixed staggered phases and independent deterministic seeds: no per-frame RNG,
// allocations or accumulated simulation state. Wrap happens at zero scale.
const hash = n => { const v=Math.sin(n*127.1+311.7)*43758.5453123; return v-Math.floor(v); };
export function portalParticleSeed(index) {
  const r = k => hash(index*13+k);
  return { phase:(index+.5)/PORTAL_PARTICLE_COUNT, life:2.1+r(1)*2.8,
    y:.08+r(2)*.84,z:.13+r(3)*.74,travel:.35+r(4)*1.25,
    drift:(r(5)-.5)*.62,rise:.14+r(6)*.68,size:.018+r(7)*.032,
    twist:r(8)*Math.PI*2,spin:(r(9)-.5)*3, palette:Math.floor(r(10)*5) };
}
export function samplePortalParticle(seed, seconds, door, out={}) {
  const p=((seconds/seed.life+seed.phase)%1+1)%1;
  const envelope=smooth(p/.13)*smooth((1-p)/.32);
  const curl=Math.sin(p*Math.PI*2+seed.twist)*.11*Math.sin(Math.PI*p);
  out.x=door.wallX-.095-seed.travel*p;
  out.y=door.minY+(door.maxY-door.minY)*seed.y+seed.rise*p+curl;
  out.z=door.minZ+(door.maxZ-door.minZ)*seed.z+seed.drift*p+curl;
  out.size=seed.size*envelope*(1-.4*p);
  out.rx=seed.twist+p*seed.spin;out.ry=seed.twist*.7+p*seed.spin*.8;out.rz=seed.twist*.4-p*seed.spin;
  return out;
}

export function createPortalParticles(THREE, group, door) {
  const palette=[0x211027,0x3c1c59,0x68419a,0x9568c9,0xb596dc];
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({
    color:0xffffff,transparent:true,opacity:.76,depthWrite:false,depthTest:true,
    side:THREE.FrontSide,toneMapped:false,fog:false,
  }),PORTAL_PARTICLE_COUNT);
  mesh.name='rg-vip-embers';mesh.frustumCulled=false;mesh.visible=false;
  const seeds=Array.from({length:PORTAL_PARTICLE_COUNT},(_,i)=>portalParticleSeed(i));
  const color=new THREE.Color(), pose=new THREE.Object3D(), sample={};
  for(let i=0;i<seeds.length;i++)mesh.setColorAt(i,color.setHex(palette[seeds[i].palette]));
  mesh.instanceColor.needsUpdate=true;group.add(mesh);
  let clock=0,last=null;
  function update(time,active,reduced) {
    mesh.visible=active&&!reduced;
    if(!mesh.visible){last=null;return;}
    if(last!==null)clock+=Math.max(0,Math.min(.1,(time-last)/1000));
    last=time;
    for(let i=0;i<seeds.length;i++){
      samplePortalParticle(seeds[i],clock,door,sample);
      pose.position.set(sample.x,sample.y,sample.z);pose.rotation.set(sample.rx,sample.ry,sample.rz);
      pose.scale.set(sample.size*.7,sample.size*1.4,sample.size);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
  }
  return {mesh,update}; // owning show-FX group disposes geometry/material/instances
}
