import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudienceRenderer } from './audience-render.mjs';
import { createShowFX } from './show-fx.mjs';

// Minimal rendering doubles: verify material settings and the real update methods,
// without requiring a WebGL context or fetching the pinned Three.js module.
class Vector {
  constructor(x=0,y=0,z=0){this.set(x,y,z);}
  set(x,y,z){Object.assign(this,{x,y,z});return this;}
  copy(v){return this.set(v.x,v.y,v.z);}
  setScalar(s){return this.set(s,s,s);}
  clone(){return new Vector(this.x,this.y,this.z);}
  subVectors(a,b){return this.set(a.x-b.x,a.y-b.y,a.z-b.z);}
  length(){return Math.hypot(this.x,this.y,this.z);}
  normalize(){const l=this.length()||1;return this.set(this.x/l,this.y/l,this.z/l);}
  lerp(v,t){return this.set(this.x+(v.x-this.x)*t,this.y+(v.y-this.y)*t,this.z+(v.z-this.z)*t);}
}
class Group {
  children=[]; visible=true;
  add(o){this.children.push(o);}
  remove(o){this.children=this.children.filter(c=>c!==o);}
}
class Mesh {
  position=new Vector();rotation=new Vector();scale=new Vector();visible=true;
  constructor(geometry,material){Object.assign(this,{geometry,material});}
}
class InstancedMesh extends Mesh {
  instanceMatrix={};instanceColor={};colors=[];
  constructor(g,m,count){super(g,m);this.count=count;}
  matrices=[];
  setMatrixAt(i,m){this.matrices[i]=structuredClone(m); }
  setColorAt(i,c){this.colors[i]=c.value;}
}
class Object3D {position=new Vector();rotation=new Vector();scale=new Vector(1,1,1);quaternion={identity(){},setFromUnitVectors(){}};updateMatrix(){this.matrix={position:{...this.position},scale:{...this.scale},rotation:{...this.rotation}};}}
class Box3 {
  min=new Vector(-1,0,-1);max=new Vector(1,2,1);
  setFromObject(){return this;}
  getCenter(v){return v.set(0,1,0);}
}
class Color {setHex(v){this.value=v;return this;}multiplyScalar(v){this.value*=v;return this;}}
class Geometry {constructor(...args){this.args=args;}dispose(){}}
class Material {constructor(opts){Object.assign(this,opts);}dispose(){}}
class Texture {constructor(canvas){this.canvas=canvas;}dispose(){}}
const THREE={Group,Mesh,InstancedMesh,Object3D,Box3,Color,Vector3:Vector,CanvasTexture:Texture,MeshBasicMaterial:Material,PlaneGeometry:Geometry,BoxGeometry:Geometry,RingGeometry:Geometry,CylinderGeometry:Geometry,CircleGeometry:Geometry,FrontSide:0,DoubleSide:2,NearestFilter:1,SRGBColorSpace:'srgb',MathUtils:{lerp:(a,b,t)=>a+(b-a)*t}};

test('all three crowd panels blend at 70 percent opacity without writing transparent depth',()=>{
  const old=globalThis.document;
  const ctx=new Proxy({}, {get:(o,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{
    const audience=createAudienceRenderer(THREE,new Group());
    assert.equal(audience.group.children.length,3);
    for(const t of [0,167,1000])for(const mood of ['idle','cheer','suspense','shock']){
      audience.update(t,mood);
      for(const m of audience.group.children){
        assert.equal(m.material.opacity,.7);
        assert.equal(m.material.transparent,true);
        assert.equal(m.material.depthWrite,false);
        assert.equal(m.material.side,THREE.FrontSide);
        assert.ok(m.material.alphaTest>0&&m.material.alphaTest<.7);
        assert.equal(m.material.map.magFilter,THREE.NearestFilter);
      }
    }
  }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('VIP oval squares removed while portal embers and roulette effects remain',()=>{
  const fx=createShowFX(THREE,new Group(),{wheel:{},door:{wallX:1,minY:0,maxY:2,minZ:0,maxZ:1}});
  for(const kind of ['overview','dice-door','slot'])for(const reduced of [false,true]){
    fx.update(250,{view:{kind},reduced});
    assert.equal(fx.group.children.some(m=>m instanceof InstancedMesh&&m.count===36),false);
    assert.equal(fx.group.children.find(m=>m.name==='rg-vip-embers').visible,!reduced);
  }
});

test('roulette launch, actual-pocket impact, delayed two-wave confetti and cleanup',()=>{
 const pivot={position:new Vector(0,.4,0)},ballPos=new Vector(.8,.3,-.5),ball={getWorldPosition(v){return v.copy(ballPos);}};
 const fx=createShowFX(THREE,new Group(),{wheel:{},wheelPivot:pivot,ball,door:{wallX:1,minY:0,maxY:2,minZ:0,maxZ:1}});
 const find=n=>fx.group.children.find(m=>m instanceof InstancedMesh&&m.count===n);
 const confetti=find(216),orbit=find(32),sparks=find(24);const view={kind:'roulette'};
 fx.update(100,{view,spinning:true});fx.update(450,{view,spinning:true});assert.equal(orbit.visible,true);assert.equal(confetti.visible,false);assert.notEqual(pivot.position.y,.4);
 fx.impact(450);fx.update(500,{view,spinning:true});assert.equal(sparks.visible,true);assert.equal(confetti.visible,false);
 fx.impact(600,true);fx.update(800,{view});assert.equal(confetti.visible,true);assert.equal(pivot.position.y,.4);assert.ok(confetti.matrices[0].scale.x>0);assert.equal(confetti.matrices[144].scale.x,0);assert.ok(confetti.matrices[0].position.y<1.5);
 fx.update(1300,{view});assert.ok(confetti.matrices[144].scale.x>0);for(const m of confetti.matrices)for(const v of [...Object.values(m.position),...Object.values(m.scale),...Object.values(m.rotation)])assert.ok(Number.isFinite(v));
 fx.update(4000,{view});assert.equal(confetti.visible,false);assert.equal(orbit.visible,false);
 fx.impact(4100,true);fx.update(4200,{view,reduced:true});assert.equal(confetti.visible,false);fx.impact(4300,true);fx.update(4400,{view});assert.equal(confetti.visible,true);fx.update(4500,{view:{kind:'overview'}});assert.equal(confetti.visible,false);assert.equal(pivot.position.y,.4);
});


test('portal embers are bounded, depth-tested, animated, and disabled with the room or reduced motion',()=>{
 const fx=createShowFX(THREE,new Group(),{wheel:{},door:{wallX:1,minY:0,maxY:2,minZ:0,maxZ:1}});
 const ember=fx.group.children.find(m=>m.name==='rg-vip-embers');assert.equal(ember.count,84);assert.equal(ember.visible,false);
 fx.update(0,{view:{kind:'overview'}});assert.equal(ember.visible,true);assert.equal(ember.material.depthTest,true);assert.equal(ember.material.depthWrite,false);
 const first=structuredClone(ember.matrices);fx.update(100,{view:{kind:'overview'}});assert.notDeepEqual(ember.matrices,first);
 assert.ok(ember.matrices.every(m=>m.position.x<1&&m.scale.x>=0));
 fx.update(200,{active:false});assert.equal(ember.visible,false);fx.update(2000,{reduced:true});assert.equal(ember.visible,false);
 fx.update(2100,{});assert.equal(ember.visible,true);
});

import {createRoomLightTrim} from './room-light-trim.mjs';
test('architecture trim uses one bounded depth-tested instance pool and honors reduced motion',()=>{
 const group=new Group(),door={wallX:16.764,minY:0,maxY:2.032,minZ:-2.4384,maxZ:-1.4224};const {mesh,update}=createRoomLightTrim(THREE,group,door);
 assert.equal(mesh.count,102);assert.equal(group.children.length,1);assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.visible,false);
 update(0,true,false,{kind:'hazel'});const first=mesh.colors.slice();update(500,true,false,{kind:'hazel'});assert.notDeepEqual(mesh.colors,first);
 update(800,true,true,{kind:'dice-door'});const still=mesh.colors.slice();update(12000,true,true,{kind:'dice-door'});assert.deepEqual(mesh.colors,still);
 for(const {position:p} of mesh.matrices.slice(76))assert.ok(p.z+.026<door.minZ||p.z-.026>door.maxZ||p.y-.013>door.maxY);
 update(13000,false,false,{});assert.equal(mesh.visible,false);
});
