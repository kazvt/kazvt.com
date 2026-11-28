import { EXTERIOR_FLOOR, MIST_CLEAR } from './exterior-mist.mjs';

// A finite square belt outside BOTH the playable mist opening and authored floor.
// Keep even the widest tilted arm outside the floor, not just its root.
export const HANDS_FPS=5;
export const HANDS_VARIANTS=6;
export const HANDS_PER_SIDE=24;
export const HANDS_ROWS=2;
export const HANDS_RING=Object.freeze({x:(MIST_CLEAR.minX+MIST_CLEAR.maxX)/2,z:(MIST_CLEAR.minZ+MIST_CLEAR.maxZ)/2,inner:20.8,outer:28});
export const HANDS_COUNT=4*HANDS_PER_SIDE*HANDS_ROWS;
export const EXTERIOR_AUDIO=Object.freeze({
  minX:Math.min(EXTERIOR_FLOOR.minX,MIST_CLEAR.minX),maxX:Math.max(EXTERIOR_FLOOR.maxX,MIST_CLEAR.maxX),
  minZ:Math.min(EXTERIOR_FLOOR.minZ,MIST_CLEAR.minZ),maxZ:Math.max(EXTERIOR_FLOOR.maxZ,MIST_CLEAR.maxZ),
  minY:EXTERIOR_FLOOR.y,maxY:7.16,start:8,end:24,
});
const clamp01=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp01(t);return t*t*(3-2*t);};
const hash=n=>{const f=Math.sin(n*127.1+311.7)*43758.5453123;return f-Math.floor(f);};
export function exteriorDistance(position){
  if(!position||![position.x,position.y,position.z].every(Number.isFinite))return 0;
  const b=EXTERIOR_AUDIO;
  return Math.hypot(Math.max(b.minX-position.x,0,position.x-b.maxX),Math.max(b.minY-position.y,0,position.y-b.maxY),Math.max(b.minZ-position.z,0,position.z-b.maxZ));
}
export function sampleExteriorAmbience(position, enabled=true, out={}){
  const t=enabled?smooth((exteriorDistance(position)-EXTERIOR_AUDIO.start)/(EXTERIOR_AUDIO.end-EXTERIOR_AUDIO.start)):0;
  out.room=1-t;out.water=t;return out;
}
export function handSeeds(){
  return Array.from({length:HANDS_COUNT},(_,i)=>{
    const r=k=>hash(i*19+k), row=Math.floor(i/(4*HANDS_PER_SIDE)), side=Math.floor(i/HANDS_PER_SIDE)%4, slot=i%HANDS_PER_SIDE;
    const radius=HANDS_RING.inner+(HANDS_RING.outer-HANDS_RING.inner)*(row+.14+.72*r(1))/HANDS_ROWS;
    const along=radius*(-1+2*(slot+.18+.64*r(2))/HANDS_PER_SIDE);
    const [dx,dz]=[[along,-radius],[radius,along],[-along,radius],[-radius,-along]][side];
    return {x:HANDS_RING.x+dx,z:HANDS_RING.z+dz,variant:(i+Math.floor(r(3)*HANDS_VARIANTS))%HANDS_VARIANTS,
      height:2.1+1.3*r(4),width:.84+.32*r(5),phase:r(6),period:2.5+2.9*r(7),lean:(r(8)-.5)*.27,
      yaw:r(9)*Math.PI*2,tone:.77+.23*r(10),depth:.2+.32*r(11)};
  });
}
export function sampleHandPose(seed,frame,eye,out={}){
  const t=frame/HANDS_FPS, p=2*Math.PI*(t/seed.period+seed.phase);
  // Short desperate reach, longer sinking interval, irregular side-to-side struggle.
  const lift=Math.pow(.5+.5*Math.sin(p),1.8);
  out.x=seed.x;out.z=seed.z;
  out.y=EXTERIOR_FLOOR.y-seed.depth-.65+1.08*lift;
  out.height=seed.height*(.88+.12*lift);out.width=out.height*.5*seed.width;
  out.roll=seed.lean+.19*Math.sin(p*2+.7)+.08*Math.sin(p*3);
  const dx=(eye?.x??seed.x)-seed.x,dz=(eye?.z??seed.z)-seed.z;
  const horizontal=Math.hypot(dx,dz);
  // Upright camera-facing cutouts remain readable from both sides, including freecam.
  out.yaw=horizontal>.02?Math.atan2(dx,dz):seed.yaw;
  out.pitch=-Math.max(-.18,Math.min(.32,Math.atan2((eye?.y??out.y)-out.y-out.height*.55,Math.max(horizontal,.1))*.32));
  return out;
}
export function createExteriorHands(THREE,scene){
  const group=new THREE.Group();group.name='rg-exterior-hands';group.visible=false;scene.add(group);
  const seeds=handSeeds(),batches=[],pose=new THREE.Object3D(),sample={},color=new THREE.Color();
  let ready=false,disposed=false,lastFrame=null;
  // A single same-origin, offline-prepared photographic atlas. Missing art fails closed.
  const map=new THREE.TextureLoader().load(new URL('./assets/exterior-hands/hands-clean-v2.png',import.meta.url).href,
    texture=>{if(!disposed){const image=texture.image;ready=image?.width===48*HANDS_VARIANTS&&image?.height===96;if(!ready)console.warn('Exterior hand atlas has incorrect dimensions; reinstall the sourced asset.');}},undefined,()=>{if(disposed)return;ready=false;group.visible=false;console.warn('Exterior hand atlas missing; run assets/exterior-hands/install-hands.py before deployment.');});
  map.magFilter=THREE.NearestFilter;map.minFilter=THREE.NearestFilter;map.generateMipmaps=false;map.colorSpace=THREE.SRGBColorSpace;
  // Alpha hashing gives 90% coverage on opaque skin, preserves the wrist fade,
  // and writes real per-fragment depth. Unlike blended instancing, the order of
  // atlas batches cannot make a distant arm or mist sheet overpaint a near arm.
  const material=new THREE.MeshBasicMaterial({map,opacity:.9,transparent:false,alphaHash:true,alphaTest:.055,depthTest:true,depthWrite:true,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,fog:false});
  for(let variant=0;variant<HANDS_VARIANTS;variant++){
    const members=seeds.filter(seed=>seed.variant===variant),geometry=new THREE.PlaneGeometry(1,1);
    geometry.translate(0,.5,0); // pivot at the submerged wrist, not the center
    const uv=geometry.getAttribute('uv');
    // Atlas = six 48x96 tiles; use half-texel inset to avoid neighboring tile bleed.
    for(let i=0;i<uv.count;i++){uv.setX(i,(variant*48+.5+uv.getX(i)*47)/(48*HANDS_VARIANTS));uv.setY(i,(.5+uv.getY(i)*95)/96);}
    const mesh=new THREE.InstancedMesh(geometry,material,members.length);
    mesh.name=`rg-exterior-hand-${variant}`;mesh.frustumCulled=false;mesh.visible=false;mesh.raycast=()=>{};
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for(let i=0;i<members.length;i++){const tone=members[i].tone;mesh.setColorAt(i,color.setRGB(tone,tone*.94,tone*.99));}
    mesh.instanceColor.needsUpdate=true;
    group.add(mesh);batches.push({mesh,members});
  }
  function update(time,active,reduced,eye){
    group.visible=!!(active&&ready&&!disposed);
    if(!group.visible){lastFrame=null;for(const {mesh} of batches)mesh.visible=false;return;}
    const frame=reduced?0:Math.floor(time*HANDS_FPS/1000);
    // When reduced motion is requested, retain static arms, reorient only when camera changes.
    const cameraKey=reduced&&eye?`${eye.x.toFixed(2)},${eye.y.toFixed(2)},${eye.z.toFixed(2)}`:'';
    const key=`${frame}/${cameraKey}`;if(key===lastFrame)return;lastFrame=key;
    for(const {mesh,members} of batches){
      for(let i=0;i<members.length;i++){
        sampleHandPose(members[i],frame,eye,sample);
        pose.position.set(sample.x,sample.y,sample.z);pose.rotation.set(sample.pitch,sample.yaw,sample.roll,'YXZ');pose.scale.set(sample.width,sample.height,1);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.visible=true;
    }
  }
  return {group,update,dispose(){if(disposed)return;disposed=true;group.visible=false;scene.remove(group);for(const {mesh} of batches){mesh.geometry.dispose();mesh.dispose();}material.dispose();map.dispose();}};
}
