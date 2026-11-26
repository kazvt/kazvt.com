import { focusLimits, orbitPosition } from "./focus-orbit.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectDiceContact, collectDiceReimpacts, snapshotDiceContact, impactStyle, diceCameraDistance, FX_LIMITS, createDiceEffects, DICE_FX_PALETTE} from './dice-effects.mjs';
import {createDiceThrow, DICE_TRAY_HALF_WIDTH, DICE_TRAY_HALF_DEPTH, DICE_PHYSICS_FIXED_STEP} from './dice-roll-physics.mjs';
import {DICE_FACE_ORDER} from './dice-game-state.mjs';
const v=(x,y,z)=>({x,y,z});
const body=(id,mass,x,y,z)=>({id,mass,position:v(x,y,z)});
function contact(bi,bj,ri,rj,ni,speed=4,multiplier=0) {
  return {bi,bj,ri,rj,ni,enabled:true,multiplier,getImpactVelocityAlongNormal:()=>speed};
}
test('contact copies the physical floor point and normal regardless of body ordering',()=>{
  const floor=body(0,0,0,0,0), die=body(5,1,1,1,2);
  const c=contact(floor,die,v(1.2,0,2.3),v(.2,-1.1,.3),v(0,1,0));
  const hit=snapshotDiceContact(c,10);
  assert.deepEqual(hit.point,[1.2,0,2.3]); assert.deepEqual(hit.normal,[0,1,0]);
  const reversed=snapshotDiceContact(contact(die,floor,c.rj,c.ri,v(0,-1,0)),10);
  assert.deepEqual(reversed.point,hit.point);assert.deepEqual(reversed.normal.map(n=>n||0),hit.normal);
  assert.equal(reversed.key,hit.key); c.ri.x=99; assert.equal(hit.point[0],1.2);
});
test('wall contact and dice-dice contact use correct physical locations and separate events',()=>{
  const die=body(5,1,2,2,0), other=body(6,1,-1,2,0), wall=body(1,0,4.35,3.6,0);
  const a=contact(die,wall,v(1,0,0),v(-.12,-1,0),v(1,0,0),8);
  const b=contact(die,other,v(-1,0,0),v(1,0,0),v(-1,0,0),6);
  const m=new Map();collectDiceContact(m,a,12);collectDiceContact(m,b,12);collectDiceContact(m,b,13);
  assert.equal(m.size,3);assert.equal(m.get('12:1:5').point[0],4.2299999999999995);
  assert.equal(m.get('12:1:5').normal[0],-1);assert.equal(m.get('12:5:6').bothDice,true);
  assert.deepEqual(m.get('12:5:6').point,[.5,2,0]);
});
test('same pair and substep coalesce manifold and dual-body callbacks; quiet hits are not discarded',()=>{
  const a=body(0,0,0,0,0), b=body(5,1,0,1,0), m=new Map();
  for(const speed of [0,4,9,3])collectDiceContact(m,contact(a,b,v(speed,0,0),v(0,-1,0),v(0,1,0),speed),20);
  collectDiceContact(m,contact(a,b,v(0,0,0),v(0,-1,0),v(0,1,0),0),21);
  assert.equal(m.size,2);assert.equal(m.get('20:0:5').speed,9);assert.equal(m.get('21:0:5').speed,0);
  assert.ok(impactStyle(0).count>0);assert.ok(impactStyle(13).size>impactStyle(0).size);
  assert.equal(impactStyle(99).power,1);assert.ok(impactStyle(5,true).count>impactStyle(5).count);
});
test('ongoing contacts only emit fresh sharp impulses, never steady support or duplicate onset',()=>{
  const a=body(0,0,0,0,0),b=body(5,1,0,1,0),m=new Map(),dt=DICE_PHYSICS_FIXED_STEP;
  const c=contact(a,b,v(0,0,0),v(0,-1,0),v(0,1,0),0,12.5);
  let prev=collectDiceReimpacts(m,[c],new Map(),1,dt);assert.equal(m.size,0);
  c.multiplier=180;collectDiceContact(m,c,2);
  prev=collectDiceReimpacts(m,[c,c],prev,2,dt);assert.equal(m.size,1);
  prev=collectDiceReimpacts(m,[c],prev,3,dt);assert.equal(m.size,1);
  c.multiplier=12.5;prev=collectDiceReimpacts(m,[c],prev,4,dt);
  c.multiplier=200;prev=collectDiceReimpacts(m,[c],prev,5,dt);assert.equal(m.size,2);
  assert.ok(m.get('5:0:5').speed>0);
});
test('5000 seeded launch pairs start without die overlap or wall intersection, including reduced motion',()=>{
  let seed=7;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const radius=1.18*Math.sqrt(3);
  for(let i=0;i<5000;i++){
    const low=i%2===0;
    const launches=[-1,1].map(lane=>createDiceThrow({restPosition:[1.4*lane,1.18,0],lane,random:rng,reducedMotion:low}));
    assert.ok(launches[1].position[0]-launches[0].position[0]>radius*2);
    for(const l of launches){
      assert.ok(Math.abs(l.position[0])+radius<DICE_TRAY_HALF_WIDTH-.12);
      assert.ok(Math.abs(l.position[2])+radius<DICE_TRAY_HALF_DEPTH-.12);
      assert.ok(l.position[1]-radius>0);
      assert.ok(Math.abs(Math.hypot(...l.quaternion)-1)<1e-10);
      if(!low){assert.ok(Math.hypot(...l.angularVelocity)>=12.5-1e-10);assert.ok(l.velocity[1]<=-2);}
    }
  }
});
test('camera frames launch and tray envelope across portrait, landscape and ultrawide without touching simulation',()=>{
  const e=Math.atan(.53),sin=Math.sin(e),cos=Math.cos(e),tan=Math.tan(43*Math.PI/360);
  for(const [w,h] of [[390,844],[768,1024],[844,390],[1280,720],[1920,1080],[2560,1080]]){
    const a=w/h,d=diceCameraDistance(a);
    for(const [x,y,z] of [[4.5,0,3.1],[4.5,3.2,3.1],[4.5,5.4,1.2]])for(const sz of [-1,1]){
      const yy=y-1.65,zz=z*sz,depth=d-yy*sin-zz*cos;
      assert.ok(x/(tan*a*depth)<=.880001);assert.ok(Math.abs((yy*cos-zz*sin)/(tan*depth))<=.860001);
    }
  }
  const src=readFileSync(new URL('./dice-mode.js',import.meta.url),'utf8');
  const resize=src.slice(src.indexOf('function resizeRenderer'),src.indexOf('function cryptoRandomUnit'));
  assert.doesNotMatch(resize,/body\.position|group\.position|resizeDiceBody|group\.scale/);
  assert.match(src,/if \(rolling \|\| orbit\.moving \|\| effectsMoving\)/);
  assert.match(src,/activeRolls\.every\(\(\{ body \}\) => body\.sleepState === CANNON\.Body\.SLEEPING\)/);
  assert.match(src,/getUpwardFaceIndex\(body\.quaternion, DICE_FACE_ORDER\)/);
});

// A small rendering-API double exercises the real effect lifecycle and bounded
// scene graph without requiring CDN access. It is not a WebGL renderer.
class Vec {
  constructor(x=0,y=0,z=0){this.set(x,y,z);}
  set(x,y,z){Object.assign(this,{x,y,z});return this;}
  setScalar(s){return this.set(s,s,s);}
  toArray(){return [this.x,this.y,this.z];}
  clone(){return new Vec(...this.toArray());}
  multiplyScalar(s){return this.set(this.x*s,this.y*s,this.z*s);}
  addScaledVector(v,s){return this.set(this.x+v.x*s,this.y+v.y*s,this.z+v.z*s);}
  crossVectors(a,b){return this.set(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);}
  normalize(){return this.multiplyScalar(1/(Math.hypot(...this.toArray())||1));}
}
class Obj {
  constructor(){this.children=[];this.position=new Vec();this.rotation=new Vec();this.scale=new Vec(1,1,1);this.visible=true;this.quaternion={setFromUnitVectors(){}};}
  add(o){this.children.push(o);}
  updateMatrix(){this.matrix=[...this.position.toArray(),...this.scale.toArray()];}
}
class Color {set(v){this.value=v;return this;}}
class Mat {constructor(o){Object.assign(this,o);this.color=new Color();}}
class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m;}}
class Batch extends Mesh{constructor(g,m,n){super(g,m);this.capacity=n;this.instanceMatrix={};this.instanceColor={};}setMatrixAt(i,m){assert.ok(i<this.capacity);assert.ok(m.every(Number.isFinite));}setColorAt(i,c){assert.ok(i<this.capacity);assert.ok(c.value);}}
const T={Vector3:Vec,Object3D:Obj,Color,MeshBasicMaterial:Mat,Mesh,InstancedMesh:Batch,PlaneGeometry:class{},BoxGeometry:class{},CanvasTexture:class{}};
function mockCanvas(){const canvas={width:256,height:256};const noop=()=>{};const ctx=new Proxy({canvas,createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]??noop});canvas.getContext=()=>ctx;return canvas;}
test('effect lifecycle: bounded burst pool, all six exact local face transforms, persistent seal, clear and reduced motion',()=>{
  const prior=globalThis.document;globalThis.document={createElement:mockCanvas};
  try{
    const scene=new Obj(),dies=[0,1].map(i=>({group:new Obj(),body:{velocity:v(5,0,0)}}));
    dies[0].group.position.set(-1.5,1.18,0);dies[1].group.position.set(1.5,1.18,0);
    const fx=createDiceEffects(T,scene,dies),batch=scene.children.find(x=>x instanceof Batch);
    const objectCount=scene.children.length;
    for(let i=0;i<200;i++)fx.impact({point:[0,0,0],normal:[0,1,0],speed:13,bothDice:i%2===0},false);
    assert.equal(fx.update(.016,true,false),true);assert.equal(batch.count,FX_LIMITS.particles);assert.equal(scene.children.length,objectCount);
    for(const face of DICE_FACE_ORDER){
      fx.clear();fx.land(0,face,'faroeberry',false);fx.update(.016,false,false);
      const [edge,glow]=dies[0].group.children;
      assert.ok(edge.visible&&glow.visible);assert.deepEqual(edge.position.toArray(),face.normal.map(x=>x*1.222));
      assert.deepEqual(edge.rotation.toArray(),[...face.rotation]);assert.equal(glow.material.color.value,DICE_FX_PALETTE.faroeberry);
    }
    for(let i=0;i<120;i++)fx.update(1/60,false,false);
    assert.equal(fx.update(1/60,false,false),false);assert.equal(batch.count,0);assert.ok(dies[0].group.children[0].visible);
    fx.clear();assert.equal(fx.update(.016,false,false),false);assert.ok(!dies[0].group.children[0].visible);
    fx.impact({point:[0,0,0],normal:[0,1,0],speed:13},true);fx.land(1,DICE_FACE_ORDER[1],'blank',true);
    assert.equal(fx.update(.016,false,true),false);assert.equal(batch.count,0);assert.ok(dies[1].group.children[0].visible);
    assert.equal(fx.update(.016,false,false),false,'turning off reduced motion must not replay celebration');
  }finally{globalThis.document=prior;}
});

test('doubled dice orbit keeps the full launch and tray envelope in the viewport',()=>{
  const target={x:0,y:1.65,z:0}, e=Math.atan(.53), tan=Math.tan(43*Math.PI/360), [yawCap,pitchCap]=focusLimits('dice');
  for(const [w,h] of [[320,640],[390,844],[768,1024],[844,390],[1280,720],[1920,1080],[2560,1080]]){
    const a=w/h,d=diceCameraDistance(a),base={x:0,y:target.y+d*Math.sin(e),z:d*Math.cos(e)};
    for(const yaw of [-yawCap,0,yawCap])for(const pitch of [-pitchCap,0,pitchCap]){
      const position=orbitPosition(base,target,yaw,pitch);
      const dir=[position.x/d,(position.y-target.y)/d,position.z/d],right=[Math.cos(yaw),0,-Math.sin(yaw)],up=[-Math.sin(yaw)*Math.sin(e+pitch),Math.cos(e+pitch),-Math.cos(yaw)*Math.sin(e+pitch)];
      const dot=(x,y)=>x.reduce((sum,n,i)=>sum+n*y[i],0);
      for(const [x,y,z] of [[4.5,0,3.1],[4.5,3.2,3.1],[4.5,5.4,1.2]])for(const sx of [-1,1])for(const sz of [-1,1]){
        const p=[x*sx,y-target.y,z*sz],depth=d-dot(p,dir);
        assert.ok(depth>.1&&Math.abs(dot(p,right)/(tan*a*depth))<1&&Math.abs(dot(p,up)/(tan*depth))<1,`${w}x${h}, yaw ${yaw}, pitch ${pitch}`);
      }
    }
  }
});
