import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DANCE_AMPLITUDE,DANCE_INTENSITY_MIN,DANCE_INTENSITY_MAX,dancePose,cardSwing,createDanceClock,createDanceIntensitySampler,createStageDance,CARD_GROUPS,DICE_TRIANGLE_RANGES,splitIndexRanges} from './stage-dance.mjs';
import {characterCorners,characterPlaneMatrix} from './character-billboards.mjs';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const close=(a,b,e=1e-8)=>a.forEach((v,i)=>near(v,b[i],e));
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
// Minimal affine scene doubles. The data below are decoded from the real stage
// glTF (including primitive indices, node transforms and loader associations).
class M {
 constructor(a=identity){this.a=[...a];}
 set(...a){this.a=a;return this;}clone(){return new M(this.a);}copy(m){this.a=[...m.a];return this;}
 multiply(m){const a=this.a,b=m.a;this.a=Array.from({length:16},(_,i)=>{const r=i>>2,c=i%4;return a[r*4]*b[c]+a[r*4+1]*b[4+c]+a[r*4+2]*b[8+c]+a[r*4+3]*b[12+c];});return this;}
 makeTranslation(x,y,z){return this.set(1,0,0,x,0,1,0,y,0,0,1,z,0,0,0,1);}
 makeRotationAxis(v,t){const {x,y,z}=v,c=Math.cos(t),s=Math.sin(t),u=1-c;return this.set(c+x*x*u,x*y*u-z*s,x*z*u+y*s,0,y*x*u+z*s,c+y*y*u,y*z*u-x*s,0,z*x*u-y*s,z*y*u+x*s,c+z*z*u,0,0,0,0,1);}
 invert(){// All parent matrices in this fixture are rigid authored transforms.
 const a=this.a;return this.set(a[0],a[4],a[8],-a[0]*a[3]-a[4]*a[7]-a[8]*a[11],a[1],a[5],a[9],-a[1]*a[3]-a[5]*a[7]-a[9]*a[11],a[2],a[6],a[10],-a[2]*a[3]-a[6]*a[7]-a[10]*a[11],0,0,0,1);}
}
class V{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}normalize(){const d=Math.hypot(this.x,this.y,this.z);this.x/=d;this.y/=d;this.z/=d;return this;}fromBufferAttribute(p,i){[this.x,this.y,this.z]=p.values[i];return this;}applyMatrix4(m){const a=m.a,{x,y,z}=this;this.x=a[0]*x+a[1]*y+a[2]*z+a[3];this.y=a[4]*x+a[5]*y+a[6]*z+a[7];this.z=a[8]*x+a[9]*y+a[10]*z+a[11];return this;}array(){return [this.x,this.y,this.z];}}
class Box{makeEmpty(){this.min=new V(Infinity,Infinity,Infinity);this.max=new V(-Infinity,-Infinity,-Infinity);return this;}expandByPoint(v){for(const k of ['x','y','z']){this.min[k]=Math.min(this.min[k],v[k]);this.max[k]=Math.max(this.max[k],v[k]);}return this;}getCenter(v){for(const k of ['x','y','z'])v[k]=(this.min[k]+this.max[k])/2;return v;}getBoundingSphere(s){return s;}}
class G{constructor(positions,indices){this.attributes={position:{values:positions,count:positions.length}};this.setIndex(indices);}setIndex(a){this.index={array:a,count:a.length,getX:i=>a[i]};}clone(){return new G(this.attributes.position.values,[...this.index.array]);}dispose(){this.disposed=true;}}
class O{constructor(name,geo=null,base=new M()){this.name=name;this.geometry=geo;this.isMesh=!!geo;this.children=[];this.matrix=base.clone();this.matrixWorld=new M();this.base=base;this.matrixAutoUpdate=true;this.visible=true;}
 add(o){if(o.parent)o.parent.remove(o);this.children.push(o);o.parent=this;return this;}remove(o){this.children=this.children.filter(v=>v!==o);o.parent=null;return this;}
 traverse(f){f(this);for(const c of this.children)c.traverse(f);}updateMatrixWorld(){if(this.matrixAutoUpdate)this.matrix.copy(this.base);this.matrixWorld=this.parent?this.parent.matrixWorld.clone().multiply(this.matrix):this.matrix.clone();for(const c of this.children)c.updateMatrixWorld();}
 clone(){return new O(this.name,this.geometry,this.base);}}
const THREE={Vector3:V,Matrix4:M,Box3:Box,Sphere:class{}};
const j=JSON.parse(readFileSync(new URL('./assets/provided/rg_stage.gltf',import.meta.url)));const buf=Buffer.from(j.buffers[0].uri.split(',')[1],'base64');
function values(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView],size=a.type==='VEC3'?3:1,b=a.componentType===5123?2:4,read=a.componentType===5126?'readFloatLE':b===2?'readUInt16LE':'readUInt32LE',o=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count},(_,k)=>{const row=Array.from({length:size},(_,l)=>buf[read](o+k*(v.byteStride||size*b)+l*b));return size===1?row[0]:row;});}
function base(n){const [x,y,z,w]=n.rotation||[0,0,0,1],t=n.translation||[0,0,0];return new M([1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),t[0],2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),t[1],2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),t[2],0,0,0,1]);}
function fixture(){const stage=new O('stage'),associations=new Map(),nodes=[],prims=[];for(const [i,n] of j.nodes.entries()){const ps=j.meshes[n.mesh]?.primitives||[],ms=ps.map((p,k)=>{const o=new O(`mesh-${i}-${k}`,new G(values(p.attributes.POSITION),values(p.indices)));associations.set(o,{meshes:n.mesh,primitives:k});if(i===0)prims[k]=o;return o;});const o=ms.length===1?ms[0]:new O(n.name);o.name=n.name;o.base=base(n);o.matrix=o.base.clone();if(ms.length>1)ms.forEach(m=>o.add(m));associations.set(o,{...associations.get(o),nodes:i});nodes[i]=o;}for(const [i,n] of j.nodes.entries())for(const c of n.children||[])nodes[i].add(nodes[c]);for(const i of j.scenes[0].nodes)stage.add(nodes[i]);stage.updateMatrixWorld();return {stage,associations,nodes,prims};}
const worldVertices=o=>o.geometry.index.array.map(i=>new V().fromBufferAttribute(o.geometry.attributes.position,i).applyMatrix4(o.matrixWorld).array());
const tris=o=>{const v=worldVertices(o),t=[];for(let i=0;i<v.length;i+=3)t.push(v.slice(i,i+3).flat().map(x=>x.toFixed(7)).join(','));return t;};
function triangleSet(root){const out=[];root.traverse(o=>{if(o.isMesh)out.push(...tris(o));});return out.sort();}
const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
test('alternating held squish, shivers, center holds and exact looping are bounded',()=>{
 for(let t=0;t<4000;t++){const p=dancePose(t);assert.ok(p.width>=.967&&p.width<=1);assert.ok(Math.abs(p.shear)<=.038);close(Object.values(p),Object.values(dancePose(t+2000)));assert.ok(Math.abs(cardSwing(t))<=Math.PI/60+1e-12);}
 for(const t of [0,900,950,1000,1900,1950,2000])assert.deepEqual(dancePose(t),{width:1,shear:0});
 assert.ok(dancePose(300).shear<-.028&&dancePose(1300).shear>.028);assert.notEqual(dancePose(300).shear,dancePose(400).shear);assert.equal(dancePose(500,0).width,1);
 assert.ok(Math.abs(dancePose(300,.25).shear)<.01);
});
test('real stage triangles partition without changing any resting geometry; all 23 intended rigs only',()=>{
 const {stage,associations,nodes,prims}=fixture(),before=triangleSet(stage),staticWorld=prims[16].matrixWorld.a.slice(),table=nodes[8].matrixWorld.a.slice();
 const rig=createStageDance(THREE,stage,associations);assert.equal(rig.count,23);stage.updateMatrixWorld();assert.deepEqual(triangleSet(stage),before);
 const cards=CARD_GROUPS.flatMap(c=>c.parts).filter(Number.isInteger);assert.equal(new Set(cards).size,cards.length);
 const source=prims[36],split=splitIndexRanges(values(j.meshes[0].primitives[36].indices),DICE_TRIANGLE_RANGES);assert.equal(split.parts.reduce((n,v)=>n+v.length,0),8*36);assert.equal(source.geometry.index.count,split.rest.length);
 const cardParts=CARD_GROUPS.map(c=>c.parts.map(p=>Number.isInteger(p)?prims[p]:nodes[0].children.find(o=>o.name===`mesh-0-11-dance-${p==='11a'?0:1}`)));
 const cardBefore=cardParts.map(g=>g.flatMap(worldVertices));const standBefore=nodes[6].matrixWorld.a.slice();
 for(let t=0;t<2000;t+=33){rig.update(t,true);stage.updateMatrixWorld();assert.deepEqual(prims[16].matrixWorld.a,staticWorld);assert.deepEqual(nodes[8].matrixWorld.a,table);
  for(const [i,g] of cardParts.entries()){const v=g.flatMap(worldVertices),old=cardBefore[i],normal=CARD_GROUPS[i].normal;for(let k=0;k<v.length;k++){near(dist(v[k],v[0]),dist(old[k],old[0]),1e-7);near(dot(sub(v[k],old[k]),normal),0,2e-5);}}
  for(const id of [1,2,3,4,5,6,9,10,11,12,13,14,15,17]){const m=nodes[id].matrixWorld.a;assert.ok(m.every(Number.isFinite));assert.equal(nodes[id].matrixAutoUpdate,false);}
 }
 rig.update(300,true);stage.updateMatrixWorld();assert.notDeepEqual(nodes[6].matrixWorld.a,standBefore);
 // Exact rest recovery (not approximate inverse integration) and teardown.
 rig.update(500,false);stage.updateMatrixWorld();assert.deepEqual(triangleSet(stage),before);rig.dispose();stage.updateMatrixWorld();assert.deepEqual(triangleSet(stage),before);
});
test('unknown model revision does not mutate the room',()=>{const {stage,associations,prims}=fixture(),before=triangleSet(stage);associations.delete(prims[5]);assert.throws(()=>createStageDance(THREE,stage,associations));assert.deepEqual(triangleSet(stage),before);});
test('DOM projection and depth plane agree exactly at every yaw and dance phase; bottom midpoint stays fixed',()=>{
 for(let t=0;t<2000;t+=11)for(const yaw of [-.209,0,.209]){const p=dancePose(t),pose={anchor:{x:2,y:3,z:-1},worldWidth:1.8*p.width,worldHeight:1.8,shear:p.shear},corners=characterCorners(pose.anchor,pose.worldWidth,pose.worldHeight,yaw,p.shear),m=new M(characterPlaneMatrix(pose,yaw));
  [[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]].forEach(([x,y],i)=>close(new V(x,y,0).applyMatrix4(m).array(),Object.values(corners[i])));close(new V(0,-.5,0).applyMatrix4(m).array(),[2,2.1,-1]);}
});
test('single absolute playback clock: silent, buffering or horror has no pose; seek, loop and track switch follow media',()=>{const c=createDanceClock();assert.ok(Number.isNaN(c.step(500,true,null)));assert.ok(Number.isNaN(c.step(500,false,{track:'general',seconds:3})));assert.ok(Number.isNaN(c.step(500,true,{track:'smeemo',seconds:3})));assert.equal(c.step(90000,true,{track:'general',seconds:.3}),300);assert.equal(c.step(999999,true,{track:'general',seconds:.3}),300);assert.equal(c.step(10,true,{track:'cards',seconds:1.2}),1200);assert.equal(c.step(11,true,{track:'cards',seconds:.05}),50);assert.deepEqual(dancePose(NaN),{width:1,shear:0});assert.equal(cardSwing(NaN),0);});

test('ambient amplitude is 35% of previous squash and shear, with identical card swing and beat timing',()=>{
 assert.equal(DANCE_AMPLITUDE,.35);
 const ease=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
 for(const strength of [.25,.38,.56,.65,.78,.8,.9,1])for(let time=0;time<2000;time+=7){
  const phase=.11,t=((time/2000+phase)%1+1)%1,side=t<.5?-1:1,p=(t%.5)*2;
  const envelope=ease(p/.22)*(1-ease((p-.64)/.22));
  const shake=p>.22&&p<.64?Math.sin((p-.22)/.42*Math.PI*4)*Math.sin((p-.22)/.42*Math.PI):0;
  const pose=dancePose(time,strength,phase);near(1-pose.width,.35*strength*envelope*(.085+.008*shake));near(pose.shear,.35*side*strength*envelope*(.095+.012*shake));
  near(cardSwing(time,phase),Math.sin((time/2000+phase)*Math.PI*2)*Math.PI/60);
 }
});


test('per-object intensity sampler is seeded, cached, unique and bounded for every ambient prop family',()=>{
 const seed=0x51a7c0de,first=createDanceIntensitySampler(seed),second=createDanceIntensitySampler(seed);
 const keys=['contestant-stand:faroe','contestant-stand:erin','contestant-stand:kaz',
  'tall-chair:12','tall-chair:11','tall-chair:10','desk-chair:9','desk-chair:13','desk-chair:14','desk-chair:15',
  ...Array.from({length:9},(_,i)=>`card:${i+1}`),...Array.from({length:3},(_,i)=>`dice-stack:${i+1}`),
  'ramble-gamble-sign','billboard:faroe','billboard:erin','billboard:kaz','billboard:lillie-host','billboard:hazel','crowd-cat:smeemo'];
 const values=keys.map(first);
 assert.equal(values.length,keys.length);assert.equal(new Set(values).size,keys.length,'each object receives a distinct multiplier');
 for(const value of values)assert.ok(value>=DANCE_INTENSITY_MIN&&value<=DANCE_INTENSITY_MAX);
 assert.equal(DANCE_INTENSITY_MIN,.5);assert.equal(DANCE_INTENSITY_MAX,1.5);
 assert.deepEqual(keys.map(first),values,'a multiplier is cached and never rerolled per frame');
 assert.deepEqual(keys.map(second),values,'the same seed and stable keys reproduce the same assignment');
 assert.notDeepEqual(keys.map(createDanceIntensitySampler(seed+1)),values,'a new scene seed produces a fresh random cast');
 assert.throws(()=>first(''),/stable object key/);
});

test('one per-object intensity multiplier scales both squash and shear, while card swing remains rotation-only',()=>{
 const base=dancePose(300,.8,0,1),low=dancePose(300,.8,0,.5),high=dancePose(300,.8,0,1.5);
 for(const pose of [low,base,high]){assert.ok(pose.width<1);assert.ok(Math.abs(pose.shear)>0);}
 near((1-low.width)/(1-base.width),.5);near((1-high.width)/(1-base.width),1.5);
 near(low.shear/base.shear,.5);near(high.shear/base.shear,1.5);
 near(cardSwing(250,0,.5)/cardSwing(250),.5);near(cardSwing(250,0,1.5)/cardSwing(250),1.5);
 assert.deepEqual(dancePose(300,.8,0,NaN),base,'invalid optional multipliers safely fall back to neutral scaling');
});

test('the same sampler feeds stage rigs, Fugi billboards and focused Smeemo without changing the shared music clock',()=>{
 const {stage,associations}=fixture(),sampler=createDanceIntensitySampler(0x10293847),rig=createStageDance(THREE,stage,associations,sampler);
 const all=[...rig.intensityMultipliers,...['faroe','erin','kaz','lillie-host','hazel'].map(id=>sampler(`billboard:${id}`)),sampler('crowd-cat:smeemo')];
 assert.equal(rig.intensityKeys.length,23);assert.equal(new Set(all).size,all.length);
 assert.ok(all.every(v=>v>=.5&&v<=1.5));
 const src=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 assert.match(src,/const danceIntensity=createDanceIntensitySampler\(\)/);
 assert.match(src,/createStageDance\(THREE,stageModel,stageGltf\.parser\.associations,danceIntensity\)/);
 assert.match(src,/danceIntensity\(`billboard:\$\{billboard\.id\}`\)/);
 assert.match(src,/catIntensity:danceIntensity\("crowd-cat:smeemo"\)/);
 const frame=src.slice(src.indexOf('function animate(time)'));
 assert.doesNotMatch(frame,/Math\.random/,'randomness is assigned at setup, never sampled during animation frames');
 rig.dispose();
});

// Stand tests use the same decoded original glTF and stage-dance fixture as
// above; the lift parent is an independently composed affine transform.
import {createContestantStands,standPose,standMotion,STAND_DOWN,STAND_NODES,standHitAllowed} from './contestant-stands.mjs';
V.prototype.set=function(x,y,z){Object.assign(this,{x,y,z});return this;};
V.prototype.setScalar=function(v){return this.set(v,v,v);};
Box.prototype.isEmpty=function(){return this.min.x>this.max.x||this.min.y>this.max.y||this.min.z>this.max.z;};
Box.prototype.getSize=function(v){return v.set(this.max.x-this.min.x,this.max.y-this.min.y,this.max.z-this.min.z);};
class LiftGroup extends O{
 constructor(){super('group');this.position=new V();this.scale=new V(1,1,1);this.rotation={};}
 updateMatrixWorld(){const p=this.position,s=this.scale;this.base=new M([s.x,0,0,p.x,0,s.y,0,p.y,0,0,s.z,p.z,0,0,0,1]);super.updateMatrixWorld();}
}
class LiftMesh extends LiftGroup{constructor(geometry,material){super();this.geometry=geometry;this.material=material;this.isMesh=true;}}
class LiftGeometry{constructor(width,height,depth){this.parameters={width,height,depth};}dispose(){this.disposed=true;}}
class LiftMaterial{constructor(options){Object.assign(this,options);}dispose(){this.disposed=true;}}
const liftTHREE={...THREE,Group:LiftGroup,Mesh:LiftMesh,MeshBasicMaterial:LiftMaterial,BoxGeometry:LiftGeometry,RingGeometry:LiftGeometry,DoubleSide:2};
function liftVertices(root){const out=[];root.traverse(o=>{if(o.isMesh)out.push(...worldVertices(o));});return out;}
function standFixture(){const f=fixture(),sounds=[],foley={start:(...a)=>sounds.push(['start',...a]),stop:(...a)=>sounds.push(['stop',...a])};const dance=createStageDance(THREE,f.stage,f.associations,createDanceIntensitySampler(42));const before=Object.fromEntries(Object.entries(STAND_NODES).map(([id,ns])=>[id,ns.flatMap(n=>liftVertices(f.nodes[n]))]));const lifts=createContestantStands(liftTHREE,f.stage,f.associations,{foley});return {...f,dance,lifts,sounds,before};}
test('all three original stands and nameplates collapse around their true floor base; original transforms and untouched chairs are retained',()=>{
 const f=standFixture();const r=f.lifts.records.get('kaz'),other=f.lifts.records.get('erin');
 const vertices=id=>STAND_NODES[id].flatMap(n=>liftVertices(f.nodes[n]));
 const chairBefore=liftVertices(f.nodes[10]);
 for(const id of Object.keys(STAND_NODES))assert.deepEqual(vertices(id),f.before[id]);
 assert.equal(r.carrier.visible,true);assert.equal(r.cap.visible,false);
 assert.ok(f.lifts.toggle('kaz',100));f.lifts.update(500,true,false);assert.ok(r.height<1&&r.height>STAND_DOWN);assert.ok(r.cap.visible&&r.ring.visible);
 const yMin=Math.min(...f.before.kaz.map(p=>p[1]));
 for(const [i,p] of vertices('kaz').entries()){const q=f.before.kaz[i];near(p[0],q[0]);near(p[2],q[2]);near(p[1],yMin+(q[1]-yMin)*r.height);}
 f.lifts.update(1100,true,false);assert.equal(r.height,STAND_DOWN);assert.equal(r.carrier.visible,false);assert.equal(r.cap.visible,true);assert.equal(r.ring.visible,false);assert.ok(r.sparks.every(s=>!s.visible));
 assert.ok(Math.max(...vertices('kaz').map(p=>p[1]))<.309);assert.equal(other.height,1);assert.deepEqual(vertices('erin'),f.before.erin);assert.deepEqual(liftVertices(f.nodes[10]),chairBefore);
 f.lifts.toggle('kaz',1200);f.lifts.update(2200,true,false);assert.equal(r.carrier.visible,true);assert.equal(r.cap.visible,false);assert.deepEqual(vertices('kaz'),f.before.kaz);
 f.lifts.dispose();f.dance.dispose();assert.equal(f.nodes[3].parent,f.nodes[7]);assert.equal(f.nodes[1].parent,f.nodes[7]);
});
test('stand parent composes with the unchanged beat-synced child deformation and reverses without discontinuity',()=>{
 const f=standFixture(),r=f.lifts.records.get('faroe');f.dance.update(300,true);f.stage.updateMatrixWorld();const before=STAND_NODES.faroe.flatMap(n=>liftVertices(f.nodes[n]));
 f.lifts.toggle('faroe',0);f.lifts.update(400,true,false);const mid=r.height,ys=STAND_NODES.faroe.flatMap(n=>liftVertices(f.nodes[n]));const bottom=Math.min(...f.before.faroe.map(v=>v[1]));
 for(let i=0;i<ys.length;i++)close(ys[i],[before[i][0],bottom+(before[i][1]-bottom)*mid,before[i][2]]);
 f.lifts.toggle('faroe',400);near(r.height,mid);f.lifts.update(1400,true,false);assert.equal(r.height,1);const restored=STAND_NODES.faroe.flatMap(n=>liftVertices(f.nodes[n]));restored.forEach((p,i)=>close(p,before[i]));
 f.dance.update(0,false);f.stage.updateMatrixWorld();assert.deepEqual(STAND_NODES.faroe.flatMap(n=>liftVertices(f.nodes[n])),f.before.faroe);
});
test('lift motion is bounded, settles exactly, accepts rapid reversals and has immediate reduced-motion endpoints',()=>{
 for(const down of [true,false])for(const from of [STAND_DOWN,.2,.5,1,1.05]){const m=standMotion(from,down,100);let last=standPose(m,100);near(last.height,from);for(let t=101;t<=100+m.duration;t++){const p=standPose(m,t);assert.ok(p.height>=STAND_DOWN-1e-9&&p.height<=1.11);assert.ok(Math.abs(p.height-last.height)<.02);last=p;}assert.deepEqual(last,{height:down?STAND_DOWN:1,pulse:0,done:true});assert.equal(standPose(standMotion(from,down,0,true),0).done,true);}
 const f=standFixture();const r=f.lifts.records.get('erin');f.lifts.toggle('erin',0,true);assert.equal(r.height,STAND_DOWN);assert.equal(r.motion,null);assert.equal(r.carrier.visible,false);assert.equal(f.sounds.filter(s=>s[0]==='start'&&s[2]==='slotRattle').length,0);
 f.lifts.toggle('erin',100);f.lifts.suspend();assert.equal(r.height,1);assert.equal(r.motion,null);assert.equal(f.sounds.filter(s=>s[0]==='start'&&s[2]==='pocket').length,0);assert.ok(f.sounds.some(s=>s[0]==='stop'&&s[1]==='stand-erin-motor'));
});
test('return footprints preserve other characters and reject hidden/occluded stands, but same-seat clicks restore them',()=>{
 const f=standFixture(),r=f.lifts.records.get('kaz'),other=f.lifts.records.get('erin');
 const candidate={id:'kaz',distance:2,proxy:true};assert.equal(standHitAllowed({candidate,character:{machine:'contestant',contestantId:'kaz'}}),true);assert.equal(standHitAllowed({candidate,character:{machine:'contestant',contestantId:'erin'}}),false);assert.equal(standHitAllowed({candidate,character:{machine:'host'}}),false);assert.equal(standHitAllowed({candidate,blocker:{distance:1,owner:'erin'}}),false);assert.equal(standHitAllowed({candidate,blocker:{distance:1,owner:'kaz'}}),true);assert.equal(standHitAllowed({candidate:{...candidate,proxy:false},character:{machine:'contestant',contestantId:'kaz'}}),false);
 let blocker=[],target=r.objects[1],hitProxy=false;
 const ray={intersectObjects:(objects)=>objects[0]===f.stage?blocker:objects.includes(target)?[{object:target,distance:2}]:[],intersectObject:o=>o===r.proxy&&hitProxy?[{object:o,distance:2}]:[]};
 assert.equal(f.lifts.pick(ray,null,[f.stage]).contestantId,'kaz');f.lifts.toggle('kaz',0,true);assert.equal(f.lifts.pick(ray,null,[f.stage]),null);hitProxy=true;assert.equal(f.lifts.pick(ray,{machine:'contestant',contestantId:'kaz'},[f.stage]).contestantId,'kaz');assert.equal(f.lifts.pick(ray,{machine:'contestant',contestantId:'erin'},[f.stage]),null);
 target=other.objects[1];target.material={};blocker=[{object:target,distance:1}];assert.equal(f.lifts.pick(ray,{machine:'contestant',contestantId:'kaz'},[f.stage]),null);
 f.stage.visible=false;assert.equal(f.lifts.pick(ray,null,[f.stage]),null);assert.equal(f.lifts.toggle('kaz',10),false);
});
