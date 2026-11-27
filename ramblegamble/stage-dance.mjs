// A four-beat, pose-to-pose rubber-hose dance. Nothing integrates position or
// Euler rotation over time: every frame derives from the original transform.
export const DANCE_CYCLE_MS=2000;
export const DANCE_AMPLITUDE=.35; // ambient squash, shear and held shivers only
export const DANCE_INTENSITY_MIN=.8;
export const DANCE_INTENSITY_MAX=1.2;
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const ease=n=>{const t=clamp(n);return t*t*(3-2*t);};

// One pseudo-random intensity is assigned per stable object key at scene setup.
// The page seed changes the cast on reload; cached per-key values never jitter
// frame-to-frame, and collision retries guarantee distinct multipliers.
function hashDanceKey(key,seed,attempt=0){
  const text=`${key}\u0000${attempt}`;let h=(0x811c9dc5^(seed>>>0))>>>0;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}
  h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
  return h>>>0;
}
export function createDanceIntensitySampler(seed=Math.floor(Math.random()*0x100000000)){
  const values=new Map(),used=new Set(),baseSeed=seed>>>0;
  return key=>{
    if(key===undefined||key===null||String(key).trim()==='')throw new TypeError('Dance intensity requires a stable object key');
    const id=String(key);if(values.has(id))return values.get(id);
    let hash,attempt=0;do{hash=hashDanceKey(id,baseSeed,attempt++);}while(used.has(hash));
    used.add(hash);const value=DANCE_INTENSITY_MIN+(hash/0xffffffff)*(DANCE_INTENSITY_MAX-DANCE_INTENSITY_MIN);
    values.set(id,value);return value;
  };
}
export function dancePose(time, strength=1, phase=0, intensityMultiplier=1){
  if(!Number.isFinite(time)||!strength)return {width:1,shear:0};
  const t=((time/DANCE_CYCLE_MS+phase)%1+1)%1, side=t<.5?-1:1, p=(t% .5)*2;
  // Attack, held lean with two tiny shivers, return, genuine neutral hold.
  const envelope=ease(p/.22)*(1-ease((p-.64)/.22));
  if(envelope===0)return {width:1,shear:0};
  const shake=p>.22&&p<.64?Math.sin((p-.22)/.42*Math.PI*4)*Math.sin((p-.22)/.42*Math.PI):0;
  const intensity=Number.isFinite(intensityMultiplier)?clamp(intensityMultiplier,DANCE_INTENSITY_MIN,DANCE_INTENSITY_MAX):1;
  const amount=DANCE_AMPLITUDE*strength*intensity*envelope;
  return {width:1-amount*(.085+.008*shake),shear:side*amount*(.095+.012*shake)};
}
export function cardSwing(time,phase=0,intensityMultiplier=1){
  if(!Number.isFinite(time))return 0;
  const intensity=Number.isFinite(intensityMultiplier)?clamp(intensityMultiplier,DANCE_INTENSITY_MIN,DANCE_INTENSITY_MAX):1;
  return Math.sin((time/DANCE_CYCLE_MS+phase)*Math.PI*2)*Math.PI/60*intensity;
}
// A single absolute musical clock. No wall-time fallback, no phase drift.
// The two original recordings are not supplied: BPM and downbeat are configurable
// estimates, not measured beat maps. The horror ambience is deliberately excluded.
export const DANCE_TRACKS=Object.freeze({general:Object.freeze({bpm:120,downbeat:0}),cards:Object.freeze({bpm:120,downbeat:0})});
export function createDanceClock(){return {step(_time,active,media){
  if(!active||!media||!Object.hasOwn(DANCE_TRACKS,media.track)||!Number.isFinite(media.seconds)||media.seconds<0)return NaN;
  const {bpm,downbeat}=DANCE_TRACKS[media.track];
  return (media.seconds-downbeat)*1000*bpm/120;
}};}
// Authored rg_stage.gltf mesh 0: paired front/back card primitives, plus two
// cards sharing primitive 11. Dice are 8 disconnected 12-triangle cubes in
// primitive 36, grouped into three stacks so their seams stay together.
export const CARD_GROUPS=Object.freeze([
  {parts:[0,1],normal:[-.18651,.35151,.91742]}, {parts:[2,3],normal:[0,0,1]},
  {parts:[4,5],normal:[0,0,1]}, {parts:[6,7],normal:[0,0,1]}, {parts:[8,9],normal:[0,0,1]},
  {parts:[10,'11a'],normal:[-.06508,.20642,.9763]}, {parts:['11b'],normal:[-.31417,.34407,.88482]},
  {parts:[12,13],normal:[-.64224,.34104,.68646]}, {parts:[14,15],normal:[-.9778,.05032,.20339]},
]);
export const DICE_TRIANGLE_RANGES=Object.freeze([[60,108],[108,132],[132,156]]);
export function splitIndexRanges(indices,ranges){
  const used=new Set(),parts=ranges.map(([a,b])=>{if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<=a||b*3>indices.length)throw Error('Invalid stage triangle range');const part=[];for(let i=a*3;i<b*3;i++){if(used.has(i))throw Error('Overlapping stage triangles');used.add(i);part.push(indices[i]);}return part;});
  return {parts,rest:Array.from(indices).filter((_,i)=>!used.has(i))};
}
// Use the parser's original glTF associations, not potentially renamed mesh
// names or shared material IDs. Fail closed on an unfamiliar asset revision.
export function createStageDance(THREE,stage,associations,intensityFor=createDanceIntensitySampler()){
  const primitives=new Map(),nodes=new Map();
  stage.traverse(o=>{const a=associations?.get(o);if(a?.nodes!==undefined)nodes.set(a.nodes,o);if(o.isMesh&&a?.meshes===0)primitives.set(a.primitives,o);});
  if(primitives.size!==37||primitives.get(11)?.geometry.index?.count!==18||primitives.get(36)?.geometry.index?.count!==468||Array.from({length:17},(_,i)=>i+1).some(i=>!nodes.has(i)))throw Error('Stage dance requires the authored stage mesh');
  for(const p of CARD_GROUPS.flatMap(c=>c.parts).filter(Number.isInteger))if(primitives.get(p)?.geometry.index?.count!==6)throw Error('Unexpected card primitive');
  stage.updateMatrixWorld(true);
  const records=[],splits=[];
  function bounds(objects){const box=new THREE.Box3().makeEmpty(),v=new THREE.Vector3();for(const root of objects)root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,ix=o.geometry.index;for(let i=0;i<(ix?.count??p.count);i++)box.expandByPoint(v.fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(o.matrixWorld));});return box;}
  function geometryPart(source,indices){const g=source.geometry.clone();g.setIndex(indices);const p=g.attributes.position,box=new THREE.Box3().makeEmpty(),v=new THREE.Vector3();for(const i of indices)box.expandByPoint(v.fromBufferAttribute(p,i));g.boundingBox=box;g.boundingSphere=box.getBoundingSphere(new THREE.Sphere());return g;}
  function split(source,ranges){const original=source.geometry,{parts,rest}=splitIndexRanges(original.index.array,ranges);const meshes=parts.map((indices,i)=>{const m=source.clone(false);m.name=source.name+'-dance-'+i;m.geometry=geometryPart(source,indices);return m;});const remaining=rest.length?geometryPart(source,rest):null;
    splits.push({source,original,meshes,remaining,visible:source.visible});return meshes;}
  const [a,b]=split(primitives.get(11),[[0,2],[2,6]]);primitives.set('11a',a);primitives.set('11b',b);
  const dice=split(primitives.get(36),DICE_TRIANGLE_RANGES);
  // All splits are prepared before mutating the scene; original triangles and
  // UVs are retained. The source with no remaining faces is detached.
  for(const s of splits){const parent=s.source.parent;for(const m of s.meshes)parent.add(m);if(s.remaining)s.source.geometry=s.remaining;else parent.remove(s.source);s.parent=parent;}
  stage.updateMatrixWorld(true);
  function add(objects,strength,key,normal=null){const box=bounds(objects),pivot=box.getCenter(new THREE.Vector3());if(!normal)pivot.y=box.min.y;
    const intensityMultiplier=intensityFor(key);
    if(!Number.isFinite(intensityMultiplier)||intensityMultiplier<DANCE_INTENSITY_MIN||intensityMultiplier>DANCE_INTENSITY_MAX)throw Error(`Invalid dance intensity for ${key}`);
    records.push({key,objects:objects.map(o=>({o,base:o.matrix.clone(),world:o.matrixWorld.clone(),parentInverse:o.parent.matrixWorld.clone().invert(),auto:o.matrixAutoUpdate})),pivot,strength,intensityMultiplier,axis:normal?new THREE.Vector3(...normal).normalize():null});}
  // Faroe, Erin, Kaz: move each stand and its extruded letters in lockstep.
  [[4,6,'contestant-stand:faroe'],[2,5,'contestant-stand:erin'],[3,1,'contestant-stand:kaz']].forEach(([a,b,key])=>add([nodes.get(a),nodes.get(b)],1,key));
  // Actual tall chairs, plus four individual chairs around the middle table.
  [12,11,10].forEach(id=>add([nodes.get(id)],.8,`tall-chair:${id}`));
  [9,13,14,15].forEach(id=>add([nodes.get(id)],.65,`desk-chair:${id}`));
  // Cards keep their dedicated face-on swing (no squash/shear), with only a
  // small per-card amplitude variation so the whole prop field is not uniform.
  CARD_GROUPS.forEach((c,i)=>add(c.parts.map(p=>primitives.get(p)),1,`card:${i+1}`,c.normal));
  dice.forEach((m,i)=>add([m],.56,`dice-stack:${i+1}`));
  add([nodes.get(17)],.25,'ramble-gamble-sign');
  const d=new THREE.Matrix4(),to=new THREE.Matrix4(),from=new THREE.Matrix4(),worldDelta=new THREE.Matrix4();let dancing=false,lastTime=null;
  function update(time,active=true){if((!active&&!dancing)||(active&&dancing&&time===lastTime))return;dancing=active;lastTime=time;
    for(const r of records){const {pivot}=r; if(r.axis)d.makeRotationAxis(r.axis,active?cardSwing(time,0,r.intensityMultiplier):0);else{const p=active?dancePose(time,r.strength,0,r.intensityMultiplier):{width:1,shear:0};d.set(p.width,p.shear,0,0,0,1,0,0,0,0,1,0,0,0,0,1);}
      worldDelta.copy(to.makeTranslation(pivot.x,pivot.y,pivot.z)).multiply(d).multiply(from.makeTranslation(-pivot.x,-pivot.y,-pivot.z));
      for(const {o,base,world,parentInverse,auto} of r.objects){if(active){o.matrixAutoUpdate=false;o.matrix.copy(parentInverse).multiply(worldDelta).multiply(world);}else{o.matrix.copy(base);o.matrixAutoUpdate=auto;}o.matrixWorldNeedsUpdate=true;}
    }
  }
  return {update,dispose(){update(0,false);for(const s of splits){for(const m of s.meshes){s.parent.remove(m);m.geometry.dispose();}if(s.remaining){s.source.geometry=s.original;s.remaining.dispose();}else s.parent.add(s.source);}},count:records.length,get intensityMultipliers(){return records.map(r=>r.intensityMultiplier);},get intensityKeys(){return records.map(r=>r.key);}};
}
