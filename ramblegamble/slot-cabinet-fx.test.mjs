import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouletteSoot} from './roulette-cabinet-fx.mjs';
import { sampleCabinetPose, createSlotCabinetFX } from './slot-cabinet-fx.mjs';

// Minimal affine scene fixture; actual authored glTF bounds/projection are
// checked separately in scene-model-geometry.test.mjs. No GPU is assumed.
class V {
  constructor(x=0,y=0,z=0){this.set(x,y,z);}
  set(x,y,z){Object.assign(this,{x,y,z});return this;}
  clone(){return new V(this.x,this.y,this.z);}
  copy(v){return this.set(v.x,v.y,v.z);}
  sub(v){return this.set(this.x-v.x,this.y-v.y,this.z-v.z);}
  setScalar(s){return this.set(s,s,s);}
  applyMatrix4(m){const {a,b,c,d,e,f,g,h}=m;return this.set(a*this.x+b*this.y+e,c*this.x+d*this.y+f,g*this.z+h);}
}
class M {
  constructor(a=1,b=0,c=0,d=1,e=0,f=0,g=1,h=0){Object.assign(this,{a,b,c,d,e,f,g,h});}
  copy(m){Object.assign(this,m);return this;}
  invert(){const {a,b,c,d,e,f,g,h}=this,det=a*d-b*c;return this.copy(new M(d/det,-b/det,-c/det,a/det,(b*f-d*e)/det,(c*e-a*f)/det,1/g,-h/g));}
  multiply(m){const {a,b,c,d,e,f,g,h}=this;return this.copy(new M(a*m.a+b*m.c,a*m.b+b*m.d,c*m.a+d*m.c,c*m.b+d*m.d,a*m.e+b*m.f+e,c*m.e+d*m.f+f,g*m.g,g*m.h+h));}
}
class Group {
  constructor(){this.position=new V();this.scale=new V(1,1,1);this.rotation={y:0,z:0};this.children=[];this.visible=true;this.matrixWorld=new M();}
  add(n){n.removeFromParent();this.children.push(n);n.parent=this;}
  removeFromParent(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}}
  getObjectByName(name){return this.name===name?this:this.children.map(n=>n.getObjectByName(name)).find(Boolean);}
  updateWorldMatrix(parents,children){if(parents)this.parent?.updateWorldMatrix(true,false);const {x,y,z}=this.position,{x:sx,y:sy,z:sz}=this.scale,c=Math.cos(this.rotation.z),s=Math.sin(this.rotation.z),flip=Math.cos(this.rotation.y);const m=new M(c*sx*flip,-s*sy,s*sx*flip,c*sy,x,y,sz*flip,z);this.matrixWorld=this.parent?new M().copy(this.parent.matrixWorld).multiply(m):m;if(children)for(const child of this.children)child.updateWorldMatrix(false,true);}
  updateMatrixWorld(){this.updateWorldMatrix(false,true);}
  localToWorld(v){this.updateWorldMatrix(true,false);return v.applyMatrix4(this.matrixWorld);}
  worldToLocal(v){this.updateWorldMatrix(true,false);return v.applyMatrix4(new M().copy(this.matrixWorld).invert());}
}
class Box {
  setFromObject(obj){const points=[];const walk=n=>{if(n.box)for(const x of [n.box[0].x,n.box[1].x])for(const y of [n.box[0].y,n.box[1].y])for(const z of [n.box[0].z,n.box[1].z])points.push(n.localToWorld(new V(x,y,z)));n.children.forEach(walk);};walk(obj);this.min=new V(...['x','y','z'].map(k=>Math.min(...points.map(p=>p[k]))));this.max=new V(...['x','y','z'].map(k=>Math.max(...points.map(p=>p[k]))));return this;}
  getSize(v){return v.copy(this.max).sub(this.min);}
  getCenter(v){return v.set((this.min.x+this.max.x)/2,(this.min.y+this.max.y)/2,(this.min.z+this.max.z)/2);}
}
class Texture {dispose(){this.disposed=true;}}
class Material {constructor(o){Object.assign(this,o);}dispose(){this.disposed=true;}}
class Sprite extends Group {constructor(material){super();this.material=material;}}
const THREE={Vector3:V,Matrix4:M,Group,Box3:Box,CanvasTexture:Texture,SpriteMaterial:Material,Sprite};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function vec(a,b){for(const k of ['x','y','z'])near(a[k],b[k]);}
function fixture(){
  const saved=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},arc(){},fill(){},fillRect(){}})})};
  const rig=new Group(),model=new Group(),body=new Group(),arm=new Group();
  rig.position.set(11,1,-5);rig.rotation.y=Math.PI;model.position.set(.1,.4,.2);model.scale.set(.16,.147,.147);rig.add(model);
  body.name='machine';body.box=[new V(-6.2,-8,-7),new V(6.1,9.1,3)];model.add(body);arm.box=[new V(-9,-1,-1),new V(-6,9,1)];model.add(arm);
  rig.updateMatrixWorld();const sample=new V(3,1,-2),rest=model.localToWorld(sample.clone()),calls=[];
  let fx;try{fx=createSlotCabinetFX(THREE,rig,model,{bayWidth:5.34,foley:{start:(...args)=>calls.push(['start',...args]),stop:(...args)=>calls.push(['stop',...args])},random:()=>.5});}finally{globalThis.document=saved;}
  const smoke=rig.getObjectByName('rg-slot-soot'),carrier=rig.getObjectByName('rg-slot-cabinet-motion');
  return {fx,rig,model,sample,rest,calls,smoke,carrier,update:(t,active=true,reduced=false)=>fx.update(t,{active,reduced}),puffs:()=>smoke.children.filter(p=>p.visible)};
}
test('cabinet key poses have anticipation, different win/loss reactions, bounded spin and exact rest',()=>{
 const rest={x:0,y:0,roll:0,sx:1,sy:1};for(const kind of ['crank','press','tap','win','loss']){assert.deepEqual(sampleCabinetPose(kind,0),rest);assert.deepEqual(sampleCabinetPose(kind,1200),rest);}
 assert.ok(sampleCabinetPose('win',285).y>sampleCabinetPose('loss',220).y);
 assert.ok(sampleCabinetPose('crank',85).sy<.92);assert.ok(sampleCabinetPose('crank',170).sy>1.17);
 for(let t=0;t<4000;t+=3){const p=sampleCabinetPose('crank',t,{rolling:true,brakeAge:t%200});assert.ok(Math.abs(p.roll)<.07&&Math.abs(p.x)<.03&&p.y>=0);}
});
test('moving carrier preserves model at rest, projects cached world anchors, follows curtain travel',()=>{
 const f=fixture();vec(f.model.localToWorld(f.sample.clone()),f.rest);vec(f.fx.worldPoint(f.rest),f.rest);
 f.fx.begin(100,'crank');f.update(335);const actual=f.model.localToWorld(f.sample.clone());assert.ok(Math.abs(actual.y-f.rest.y)>.02);vec(f.fx.worldPoint(f.rest),actual);
 f.rig.position.z-=.4;f.rig.updateMatrixWorld();vec(f.fx.worldPoint(f.rest),f.model.localToWorld(f.sample.clone()));
 f.fx.reset();vec(f.model.localToWorld(f.sample.clone()),new V(f.rest.x,f.rest.y,f.rest.z-.4));assert.equal(f.puffs().length,0);
});
test('spin smoke rises and expands on both sides, caps allocation, stops on settlement and fully fades',()=>{
 const f=fixture();f.fx.begin(0,'crank');f.update(100);const initial=f.puffs();assert.equal(initial.length,3);
 const first=initial[0],start=first.position.clone(),scale=first.scale.x;
 f.update(400);assert.ok(first.position.y>start.y&&first.scale.x>scale);assert.ok(first.material.opacity>0);assert.ok(f.puffs().some(p=>p.position.x>f.carrier.position.x));assert.ok(f.puffs().some(p=>p.position.x<f.carrier.position.x));
 for(let t=420;t<2100;t+=16){f.update(t);assert.ok(f.puffs().length<=36);}
 f.fx.stopRolling();assert.deepEqual(f.calls.filter(c=>c[1]!=='slot-cartoon').map(c=>c.slice(0,2)),[['start','slot-rattle'],['start','slots'],['stop','slot-rattle'],['stop','slots']]);
 f.fx.result(2100,false);f.update(2320);assert.ok(f.puffs().length>0);f.update(4000);assert.equal(f.puffs().length,0);vec(f.model.localToWorld(f.sample.clone()),f.rest);
});
test('hide/lock/off-view cancellation, reduced motion, manual taps and stale outcomes are safe',()=>{
 const f=fixture();f.fx.begin(0,'press');f.update(180);f.update(200,false);assert.equal(f.puffs().length,0);vec(f.model.localToWorld(f.sample.clone()),f.rest);
 f.fx.result(240,true);f.update(525);assert.equal(f.puffs().length,0);vec(f.model.localToWorld(f.sample.clone()),f.rest);
 f.fx.begin(600,'press',{reduced:true});f.update(800,true,true);assert.equal(f.puffs().length,0);vec(f.model.localToWorld(f.sample.clone()),f.rest);f.fx.result(1120,true,{reduced:true});assert.equal(f.puffs().length,0);
 const n=f.calls.length;f.fx.begin(1200,'tap');f.update(1370);assert.equal(f.puffs().length,0);assert.equal(f.calls.length,n);f.fx.result(1820,false,{wasRolling:false});f.update(2000);assert.equal(f.puffs().length,0);
 f.fx.begin(2100,'press');f.update(2280);f.update(2300,true,true);assert.equal(f.puffs().length,0);vec(f.model.localToWorld(f.sample.clone()),f.rest);f.update(2340);assert.equal(f.puffs().length,0);f.fx.dispose();assert.equal(f.smoke.parent,null);assert.ok(f.smoke.children.every(p=>p.material.disposed));
});

test('crank has a narrow tall windup and three distinct airborne arcs with decreasing height',()=>{
 const pose=t=>sampleCabinetPose('crank',t);
 assert.ok(pose(170).sx<.83&&pose(170).sy>1.17);
 assert.ok(pose(285).y>.13&&pose(285).y>pose(600).y&&pose(600).y>pose(830).y);
 for(const t of [410,730,960]){assert.equal(pose(t).y,0);assert.ok(pose(t).sy<1&&pose(t).sx>1);}
});
test('crank landing emits a bounded additional soot burst without restarting recorded audio',()=>{
 const f=fixture();f.fx.begin(0,'crank');f.update(400);const before=f.puffs().length;f.update(410);
 assert.equal(f.puffs().length,before+5);f.update(420);assert.equal(f.puffs().length,before+5);
 assert.equal(f.calls.filter(c=>c[1]!=='slot-cartoon').length,2);assert.ok(f.calls.some(c=>c[1]==='slot-cartoon'&&c[2]==='cartoonClang'));f.fx.reset();assert.equal(f.puffs().length,0);
});

test('roulette soot reuses bounded non-interactive sprites, rises outside rim, drains and disposes',()=>{
 const f=fixture(),saved=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({beginPath(){},arc(){},fill(){},fillRect(){}})})};let fx;
 try{fx=createRouletteSoot(THREE,f.rig,f.carrier,{width:2,height:.8,depth:2},()=>.5);}finally{globalThis.document=saved;}
 const group=f.rig.getObjectByName('rg-roulette-soot'),active=()=>group.children.filter(x=>x.visible);assert.equal(group.children.length,28);assert.equal(active().length,0);
 fx.begin(0);fx.update(0,true);const first=active()[0],y=first.position.y,size=first.scale.x;fx.update(150,true);assert.ok(first.position.y>y&&first.scale.x>size&&first.material.opacity>0);assert.equal(first.raycast(),undefined);
 for(let t=165;t<=3900;t+=15){fx.update(t,true);assert.ok(active().length<=28);}
 assert.ok(active().length>0);fx.update(4100,false);assert.ok(active().length>0);fx.update(5300,false);assert.equal(active().length,0);fx.begin(6000);fx.update(6000,true);fx.clear();assert.equal(active().length,0);fx.dispose();assert.equal(group.parent,null);assert.ok(group.children.every(x=>x.material.disposed));
});
