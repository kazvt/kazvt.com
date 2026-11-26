import test from 'node:test';
import assert from 'node:assert/strict';
import {createStageShow,installStageLighting} from './stage-show.mjs';
import {curtainLayout} from './stage-curtain.mjs';
class V {constructor(x=0,y=0,z=0){this.set(x,y,z)}set(x,y,z){Object.assign(this,{x,y,z});return this}clone(){return new V(this.x,this.y,this.z)}copy(v){return this.set(v.x,v.y,v.z)}add(v){return this.set(this.x+v.x,this.y+v.y,this.z+v.z)}sub(v){return this.set(this.x-v.x,this.y-v.y,this.z-v.z)}multiplyScalar(s){return this.set(this.x*s,this.y*s,this.z*s)}length(){return Math.hypot(this.x,this.y,this.z)}normalize(){return this.multiplyScalar(1/this.length())}setScalar(s){return this.set(s,s,s)}}
class Obj {constructor(){this.position=new V();this.rotation=new V();this.scale=new V(1,1,1);this.quaternion={setFromUnitVectors(){}};this.children=[];this.visible=true;this.matrix={};}add(o){this.children.push(o)}remove(o){this.children=this.children.filter(x=>x!==o)}traverse(f){f(this);for(const c of this.children)c.traverse(f)}updateMatrixWorld(){}updateMatrix(){this.matrix={p:this.position.clone()}}}
class Geo {constructor(w,h,n=1,m=1){const count=(n+1)*(m+1);this.attributes={position:{count,values:[],setXYZ(i,...v){this.values[i]=v}},uv:{count,getX:i=>(i%(n+1))/n,getY:i=>Math.floor(i/(n+1))/m,setXY(){}}}}setAttribute(k,a){this.attributes[k]=a}computeBoundingSphere(){}dispose(){this.disposed=true}}
class Mat {constructor(o){Object.assign(this,o);this.isMeshBasicMaterial=true;}onBeforeCompile(){}customProgramCacheKey(){return 'original'}dispose(){this.disposed=true}}
class Mesh extends Obj {constructor(g,m){super();this.isMesh=true;this.geometry=g;this.material=m;}}
class Instanced extends Mesh {constructor(g,m,n){super(g,m);this.isInstancedMesh=true;this.count=n;this.instanceMatrix={};this.matrices=[];this.colors=[]}setColorAt(i,c){this.colors[i]=c}setMatrixAt(i,m){this.matrices[i]=m}dispose(){this.disposed=true}}
class Box {setFromObject(){this.min=new V(10.564,0,-6.075);this.max=new V(13.058,2.52,-4.6135);return this}getCenter(v){return v.copy(this.min).add(this.max).multiplyScalar(.5)}getSize(v){return v.copy(this.max).sub(this.min)}}
const THREE={Group:Obj,Object3D:Obj,Vector3:V,Box3:Box,MeshBasicMaterial:Mat,Mesh,PlaneGeometry:Geo,BoxGeometry:Geo,ConeGeometry:Geo,InstancedMesh:Instanced,Color:class{},BufferAttribute:class{constructor(a,n){this.array=a;this.itemSize=n}},TextureLoader:class{load(url){return {url,dispose(){this.disposed=true}}}},DoubleSide:2};
test('production stage renderer moves the original rig, updates curtains and bounds its particle pool; reset and dispose clear everything',()=>{
 const scene=new Obj(),slotRig=new Obj(),slotsModel=new Mesh(new Geo(),new Mat({})),events=[];slotRig.position.set(11.811,0,-5);slotRig.add(slotsModel);scene.add(slotRig);
 const retract=curtainLayout(new Box().setFromObject()).retract,parked=-5-retract;
 const show=createStageShow(THREE,scene,{slotRig,slotsModel,roots:[slotsModel],foley:{start:(...x)=>events.push(x),stop:x=>events.push(['stop',x])}});
 assert.equal(slotsModel.visible,false);assert.equal(slotRig.position.z,parked);assert.equal(show.curtains.length,2);
 show.slot(true,0);show.update(500,true,true);assert.ok(slotsModel.visible);assert.equal(slotRig.position.z,parked);show.update(4000,true,true);assert.equal(slotRig.position.z,-5);assert.equal(show.busy,false);
 show.update(4250,true,true);const confetti=show.group.children.find(x=>x.isInstancedMesh);assert.ok(confetti.visible);assert.equal(confetti.matrices.length,180);assert.ok(confetti.matrices.every(m=>Number.isFinite(m.p.x)&&Number.isFinite(m.p.y)&&Number.isFinite(m.p.z)));
 assert.equal(events.filter(x=>x[0]==='stage-hit').length,1);show.update(10000,true,true);assert.equal(confetti.visible,false);assert.equal(show.brightnessAt(new V(50,0,0)),1);
 show.slot(false,11000);show.update(11500,true,false);assert.ok(slotRig.position.z<-5&&slotRig.position.z>parked);show.update(13400,true,false);assert.equal(slotRig.position.z,parked);assert.equal(slotsModel.visible,false);
 show.toggle({x:0,y:0,z:0},14000);show.update(15000,true,false);assert.ok(show.brightnessAt(new V(100,0,0))<1);show.update(15001,false,false);assert.equal(show.brightnessAt(new V()),1);assert.equal(show.group.visible,false);show.dispose();assert.ok(!scene.children.includes(show.group));assert.ok(confetti.disposed);
});
test('material shader hooks share live uniforms and preserve original idle shader output path',()=>{
 const m=new Mat({}),root=new Obj();root.add(new Mesh(new Geo(),m));root.add(new Mesh(new Geo(),m));const uniforms={rgShow:{value:1},rgLamp:{value:[]},rgAim:{value:[]}};
 const clear=installStageLighting(THREE,[root],uniforms);const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <opaque_fragment>'};m.onBeforeCompile(shader,{});assert.equal(shader.uniforms.rgShow,uniforms.rgShow);assert.equal((shader.vertexShader.match(/varying vec3 rgWorld/g)||[]).length,1);assert.match(shader.fragmentShader,/if\(rgShow>0.0001\)/);assert.match(shader.fragmentShader,/#include <opaque_fragment>/);assert.match(m.customProgramCacheKey(),/rg-theatre-v1/);clear();assert.equal(uniforms.rgShow.value,0);
});

test('reduced-motion open and close repeatedly restore the correct cloth vertices, including after inactivity',()=>{
 const scene=new Obj(),slotRig=new Obj(),slotsModel=new Mesh(new Geo(),new Mat({}));scene.add(slotRig);slotRig.add(slotsModel);
 const show=createStageShow(THREE,scene,{slotRig,slotsModel,roots:[slotsModel],foley:{start(){},stop(){}},reduced:()=>true});
 const x=()=>show.curtains[0].geometry.attributes.position.values[84][0];const closed=x();
 show.update(0,true,false);for(let i=0;i<5;i++){show.slot(true,i*100+1);show.update(i*100+2,true,true);assert.ok(slotsModel.visible);assert.ok(x()<closed-1);show.slot(false,i*100+3);show.update(i*100+4,true,false);assert.equal(x(),closed);assert.equal(slotsModel.visible,false);}
});
