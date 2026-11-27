// The authored nameplates and cabinet bodies are separate glTF nodes. A
// separate parent matrix composes with stage-dance's child matrices, never
// edits their UVs, materials, chair or live browser-source character.
export const STAND_NODES=Object.freeze({faroe:[4,6],erin:[2,5],kaz:[3,1]});
export const STAND_DOWN=.045;
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
export function standMotion(from,down,started,reduced=false){
 const to=down?STAND_DOWN:1;
 return {from,to,down,started,duration:reduced?0:Math.round(420+450*Math.min(1,Math.abs(from-to)))};
}
export function standPose(m,time){
 const t=m.duration?clamp((time-m.started)/m.duration):1;
 if(t===1)return {height:m.to,pulse:0,done:true};
 // Anticipate, accelerate into the stage, then a short mechanical settle.
 // A reversal starts from the exact current height; no accumulated transforms.
 const delta=m.to-m.from;
 const keys=m.down?[[0,m.from],[.13,m.from+Math.min(.045,Math.abs(delta)*.055)],[.74,m.to],[.85,m.to+Math.min(.065,Math.abs(delta)*.08)],[1,m.to]]:
 [[0,m.from],[.11,Math.max(STAND_DOWN,m.from-Math.abs(delta)*.045)],[.78,m.to+Math.min(.055,Math.abs(delta)*.075)],[.9,m.to-Math.min(.026,Math.abs(delta)*.035)],[1,m.to]];
 let i=1;while(t>keys[i][0])i++;
 const [a,x]=keys[i-1],[b,y]=keys[i];
 return {height:x+(y-x)*ease((t-a)/(b-a)),pulse:Math.sin(Math.PI*t),done:false};
}
export function worldVisible(o){for(;o;o=o.parent)if(!o.visible)return false;return true;}
export function standHitAllowed({candidate,character,blocker}){
 if(!candidate)return false;
 // Only the same contestant's vacated stand footprint can override their
 // visible character. A different live character must retain its own click.
 if(character&&(!candidate.proxy||character.machine!=='contestant'||character.contestantId!==candidate.id))return false;
 return !blocker||blocker.distance>=candidate.distance-.008||blocker.owner===candidate.id;
}
export function createContestantStands(THREE,stage,associations,{foley}={}){
 const nodes=new Map();stage.traverse(o=>{const id=associations?.get(o)?.nodes;if(id!==undefined)nodes.set(id,o);});
 stage.updateMatrixWorld(true);
 const records=new Map(),owners=new Map(),resources=[];
 const v=new THREE.Vector3();
 // Validate all three pairs before changing the scene.
 const pairs=Object.entries(STAND_NODES).map(([id,ids])=>{
  const objects=ids.map(n=>nodes.get(n)),parent=objects[0]?.parent;
  if(!parent||objects.some(o=>!o||o.parent!==parent))throw Error('Unexpected stand nodes '+id);
  const inverse=parent.matrixWorld.clone().invert(),box=new THREE.Box3().makeEmpty();
  for(const root of objects)root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(inverse));});
  if(box.isEmpty()||box.max.y-box.min.y<.2)throw Error('Invalid stand bounds '+id);
  return {id,objects,parent,box};
 });
 function mesh(parent,name,geometry,material,x,y,z){const o=new THREE.Mesh(geometry,material);o.name=name;o.position.set(x,y,z);parent.add(o);resources.push(geometry);return o;}
 function material(color,extra={}){const m=new THREE.MeshBasicMaterial({color,toneMapped:false,...extra});resources.push(m);return m;}
 const purple=material(0x632baf),pink=material(0xff73c8),gold=material(0xffe58a),cream=material(0xfff7ce);
 const invisible=material(0xffffff,{colorWrite:false,depthWrite:false,side:THREE.DoubleSide});
 for(const {id,objects,parent,box} of pairs){
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),base=box.min.y;
  const carrier=new THREE.Group();carrier.name=`rg-stand-${id}-lift`;parent.add(carrier);
  for(const object of objects)carrier.add(object); // identity parent: same authored local matrices
  carrier.traverse(o=>{if(o.isMesh)owners.set(o,id);});
  const cap=new THREE.Group();cap.name=`rg-stand-${id}-return`;parent.add(cap);
  const depth=Math.max(.18,size.z+.055),width=size.x*.94,deck=base+.0448; // authored stage deck y=.3048
  // Low-profile slot, gold frame, and a readable raised chevron on each end.
  mesh(cap,'lift-base',new THREE.BoxGeometry(width,.024,depth),purple,center.x,deck+.012,center.z);
  mesh(cap,'lift-inlay',new THREE.BoxGeometry(width*.94,.009,depth*.88),pink,center.x,deck+.0285,center.z);
  for(const sign of [-1,1]){
   mesh(cap,'lift-end-light',new THREE.BoxGeometry(.036,.009,depth*.88),gold,center.x+sign*width*.43,deck+.0375,center.z);
   for(const side of [-1,1]){
    const arm=mesh(cap,'lift-up-chevron',new THREE.BoxGeometry(.095,.009,.026),cream,center.x+sign*.035,deck+.042,center.z+side*depth*.23);arm.rotation.y=sign*side*.65;
   }
  }
  const glow=material(0xffe178,{transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const ring=mesh(cap,'lift-halo',new THREE.RingGeometry(.75,1,32),glow,center.x,deck+.006,center.z);ring.rotation.x=-Math.PI/2;ring.scale.set(width*.67,depth*1.35,1);ring.visible=false;
  // Tiny physical marquee sparks are only visible during motion. They are
  // depth-tested, never hit targets and never part of the character mask.
  const sparks=Array.from({length:6},(_,i)=>{
   const spark=mesh(cap,'lift-motion-spark',new THREE.BoxGeometry(.035,.035,.035),glow,center.x,deck+.04,center.z);
   spark.visible=false;return spark;
  });
  const fx=new Set([ring,...sparks]);
  cap.traverse(o=>{if(o.isMesh)owners.set(o,id);});
  // Not rendered, but explicitly raycast when retracted or in motion. The
  // original world-space footprint remains fixed while the carrier collapses.
  const proxy=mesh(parent,`rg-stand-${id}-return-hit`,new THREE.BoxGeometry(size.x+.018,size.y,size.z+.024),invisible,center.x,center.y,center.z);proxy.visible=false;
  const record={id,carrier,cap,ring,glow,sparks,fx,deck,proxy,base,center,height:1,down:false,motion:null,parent,objects,lastPulse:0};
  cap.visible=false;records.set(id,record);
 }
 stage.updateMatrixWorld(true);
 function apply(r,height,pulse){
  r.height=height;r.lastPulse=pulse;
  r.carrier.scale.y=height;r.carrier.position.y=r.base*(1-height);
  r.carrier.visible=!(r.down&&!r.motion);
  r.cap.visible=Boolean(r.motion||r.down);
  r.ring.visible=pulse>.001;r.glow.opacity=.65*pulse;
  const size=r.proxy.geometry.parameters;
  r.ring.scale.set(size.width*.67*(1+pulse*.5),Math.max(.18,size.depth+.03)*1.35*(1+pulse*.5),1);
  r.sparks.forEach((spark,i)=>{
   const a=i*Math.PI/3;
   spark.visible=pulse>.001;
   spark.position.set(r.center.x+Math.cos(a)*size.width*(.46+.25*pulse),r.deck+.03+pulse*(.09+i%2*.09),r.center.z+Math.sin(a)*size.depth*(.6+.7*pulse));
   spark.rotation.z=pulse*2+i;spark.scale.setScalar(.6+.65*pulse);
  });
  r.parent.updateMatrixWorld(true);
 }
 const channel=(r,suffix)=>`stand-${r.id}-${suffix}`;
 function stop(r){for(const suffix of ['motor','latch','end','accent'])foley?.stop(channel(r,suffix));}
 function finish(r,audible){r.motion=null;apply(r,r.down?STAND_DOWN:1,0);foley?.stop(channel(r,'motor'));foley?.stop(channel(r,'latch'));if(audible){foley?.start(channel(r,'end'),'pocket',{volume:.8,rate:r.down?.78:1.12});foley?.start(channel(r,'accent'),'cartoonClang',{volume:.8,rate:r.down?.85:1.2});}}
 function toggle(id,time,reduced=false){
  const r=records.get(id);if(!r||!worldVisible(r.parent))return false;
  if(r.motion){const p=standPose(r.motion,time);apply(r,p.height,p.pulse);}
  stop(r);r.down=!r.down;r.motion=standMotion(r.height,r.down,time,reduced);
  if(reduced){finish(r,false);foley?.start(channel(r,'latch'),'switch',{volume:.65,maxDelay:180});return true;}
  foley?.start(channel(r,'latch'),'lever',{volume:.8,rate:r.down?.9:1.15,maxDelay:180});
  foley?.start(channel(r,'motor'),'slotRattle',{loop:true,volume:.68,rate:r.down?1.1:.85,maxDelay:180});
  apply(r,r.height,0);return true;
 }
 function update(time,active,reduced){for(const r of records.values())if(r.motion){
  if(!active){stop(r);finish(r,false);continue;}
  const p=standPose(r.motion,time);
  if(reduced||p.done){finish(r,!reduced&&time-r.motion.started-r.motion.duration<250);continue;}
  apply(r,p.height,p.pulse);
 }}
 function pick(raycaster,character,roots){
  if(!worldVisible(stage))return null;
  const candidates=[];
  for(const r of records.values()){
   const targets=[...(r.carrier.visible?r.objects:[]),...(r.cap.visible?[r.cap]:[])];
   const real=raycaster.intersectObjects(targets,true).find(h=>worldVisible(h.object)&&!r.fx.has(h.object));
   if(real)candidates.push({id:r.id,distance:real.distance,proxy:false});
   if(r.down||r.motion){const hit=raycaster.intersectObject(r.proxy,false)[0];if(hit)candidates.push({id:r.id,distance:hit.distance,proxy:true});}
  }
  if(!candidates.length)return null;
  // Only inspect room geometry if there is a plausible stand hit. Hidden
  // proxies and transparent overlays never count as physical occluders.
  const blocker=raycaster.intersectObjects(roots.filter(Boolean),true).find(h=>{
   if(!worldVisible(h.object))return false;
   const m=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;
   return m&&m.visible!==false&&m.colorWrite!==false&&m.depthWrite!==false&&!m.transparent;
  });
  const blocking=blocker&&{distance:blocker.distance,owner:owners.get(blocker.object)};
  // Closest permitted surface wins. The original footprint may precede the
  // cap during movement; both toggle exactly the same seat.
  const hit=candidates.sort((a,b)=>a.distance-b.distance).find(candidate=>standHitAllowed({candidate,character,blocker:blocking}));
  return hit?{machine:'contestant-stand',contestantId:hit.id,distance:hit.distance}:null;
 }
 function suspend(){for(const r of records.values()){stop(r);if(r.motion)finish(r,false);}}
 function dispose(){suspend();for(const r of records.values()){for(const o of r.objects)r.parent.add(o);r.parent.remove(r.carrier);r.parent.remove(r.cap);r.parent.remove(r.proxy);}for(const resource of resources)resource.dispose();records.clear();}
 return {toggle,update,pick,suspend,dispose,records};
}
