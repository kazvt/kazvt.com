import test from 'node:test';
import assert from 'node:assert/strict';
import { rouletteRecessCenter } from "./arcade-framing.mjs";
import {readFileSync} from 'node:fs';
import { EXTERIOR_FLOOR, MIST_CLEAR, MIST_DISTANCE, MIST_EXTENT, MIST_FADE, mistDistance, mistCoverage, isExteriorFloor, floorUvTransform, createExteriorMist, FLOOR_FRAGMENT, CLOUD_FRAGMENT } from './exterior-mist.mjs';
const model=JSON.parse(readFileSync(new URL('./assets/provided/rg_stage.gltf',import.meta.url),'utf8'));
const buffers=model.buffers.map(b=>Buffer.from(b.uri.split(',')[1],'base64'));
function accessor(i) {
 const a=model.accessors[i],v=model.bufferViews[a.bufferView],b=buffers[v.buffer],n={SCALAR:1,VEC2:2,VEC3:3}[a.type],size={5123:2,5125:4,5126:4}[a.componentType],fn={5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];
 return Array.from({length:a.count},(_,j)=>Array.from({length:n},(_,k)=>b[fn]((v.byteOffset||0)+(a.byteOffset||0)+j*(v.byteStride||size*n)+k*size)));
}
function transform(p,n){const [qx,qy,qz,w]=n.rotation;const [x,y,z]=p;const tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);return {x:x+w*tx+qy*tz-qz*ty+n.translation[0],y:y+w*ty+qz*tx-qx*tz+n.translation[1],z:z+w*tz+qx*ty-qy*tx+n.translation[2]};}
function findQuad(){const node=model.nodes[0];return model.meshes[node.mesh].primitives.map(p=>{const ids=accessor(p.indices).flat();if(ids.length!==6)return null;const points=accessor(p.attributes.POSITION),uv=accessor(p.attributes.TEXCOORD_0);return {points:ids.map(i=>transform(points[i],node)),uvs:ids.map(i=>({x:uv[i][0],y:uv[i][1]})),p};}).filter(q=>q&&isExteriorFloor(q.points));}
test('identifies exactly the authored exterior checkerboard quad, not raised floors, walls or cards',()=>{
 const matches=findQuad();assert.equal(matches.length,1);assert.equal(model.textures[model.materials[matches[0].p.material].pbrMetallicRoughness.baseColorTexture.index].name,'checkerboard.png');
 const {points,uvs}=matches[0]; const map=floorUvTransform(points,uvs);assert.ok(map);
 for(let i=0;i<6;i++)assert.ok(Math.hypot(...map(points[i].x,points[i].z).map((x,j)=>x-[uvs[i].x,uvs[i].y][j]))<.001);
 // Preserve texture density and orientation through the old boundaries.
 for(const z of [-3.59,0,14.4212])for(const x of [-1.5315,10,25.1535]){
  const a=map(x-.01,z),b=map(x,z),c=map(x+.01,z);assert.ok(Math.hypot(...a.map((v,i)=>v+c[i]-2*b[i]))<1e-10);
 }
});
test('clear playable envelope is invariant across camera positions, all outer edges transition to full mist',()=>{
 for(const x of [MIST_CLEAR.minX,0,7.15,11.811,16.764,MIST_CLEAR.maxX])for(const z of [MIST_CLEAR.minZ,-6.1,-1.93,0,MIST_CLEAR.maxZ])assert.equal(mistCoverage(x,z),0);
 for(const [x,z] of [[EXTERIOR_FLOOR.maxX,0],[12,EXTERIOR_FLOOR.maxZ],[MIST_CLEAR.minX-MIST_DISTANCE,0],[10,MIST_CLEAR.minZ-MIST_DISTANCE]]){
  for(const noise of [0,.5,1])assert.equal(mistCoverage(x,z,noise),1);
 }
 for(const noise of [0,.5,1]){let prior=0;for(let i=0;i<=100;i++){const v=mistCoverage(MIST_CLEAR.maxX+i*MIST_DISTANCE/100,0,noise);assert.ok(v>=prior-1e-12&&v<=1);prior=v;}}
 // The actual roulette diameter is ~5.2 world units: leave clearance around its entire footprint.
 const wheel=JSON.parse(readFileSync(new URL('./assets/provided/rg_roulette.gltf',import.meta.url),'utf8'));
 const rim=wheel.nodes.find(n=>n.name==='rim'), positions=wheel.accessors[wheel.meshes[rim.mesh].primitives[0].attributes.POSITION];
 const radius=Math.max(positions.max[0]-positions.min[0],positions.max[2]-positions.min[2])*.13/2+.02;
 const c=rouletteRecessCenter(radius);
 for(let i=0;i<360;i++){const angle=i*Math.PI/180;assert.equal(mistCoverage(c.x+Math.cos(angle)*radius,c.z+Math.sin(angle)*radius),0);}
 // The extended plane has no exposed edge in the visible fade range even at an extreme portrait camera.
 assert.ok(MIST_EXTENT > 200+MIST_FADE.end);
});
// Exercise the real creation path with the actual authored vertices using minimal scene adapters.
class V {constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}fromBufferAttribute(a,i){[this.x,this.y,this.z]=a.values[i];return this;}applyMatrix4(){return this;}}
class Geo {constructor(){this.attributes={};}setAttribute(n,a){this.attributes[n]=a;}setIndex(i){this.index=i;}computeBoundingSphere(){}getAttribute(n){return this.attributes[n];}dispose(){this.disposed=true;}}
class Material {constructor(o){Object.assign(this,o);}dispose(){this.disposed=true;}}
class Group {constructor(){this.children=[];this.visible=true;}add(...x){this.children.push(...x);}remove(x){this.children=this.children.filter(v=>v!==x);}}
class Mesh {constructor(geometry,material){Object.assign(this,{geometry,material,isMesh:true,visible:true});}}
class Color {constructor(v){this.v=v;}clone(){return new Color(this.v);}}
const THREE={Vector3:V,Vector2:V,BufferGeometry:Geo,Float32BufferAttribute:class{constructor(values,size){this.values=values;this.size=size;}},ShaderMaterial:Material,Group,Mesh,Color,DoubleSide:2};
test('mist lifecycle preserves texture and original geometry, supports reduced motion and is not pickable',()=>{
 const {points,uvs}=findQuad()[0];const geometry=new Geo();geometry.index={count:6,getX:i=>i};geometry.attributes={position:{values:points.map(p=>[p.x,p.y,p.z])},uv:{values:uvs.map(p=>[p.x,p.y,0])}};
 const original=new Mesh(geometry,{map:{name:'checker'},color:new Color('#fff')});const scene=new Group();const stage={visible:true,updateWorldMatrix(){},traverse(cb){cb(original);}};
 const mist=createExteriorMist({THREE,scene,stage,horizonColor:'#865fd0'});assert.ok(mist);assert.equal(original.visible,false);assert.equal(original.geometry,geometry);
 const [ground,clouds]=mist.group.children;assert.equal(ground.material.uniforms.uChecker.value,original.material.map);assert.equal(ground.material.depthWrite,true);assert.equal(clouds.material.depthWrite,false);assert.ok(ground.renderOrder<clouds.renderOrder);assert.equal(ground.material.depthTest,true);assert.equal(clouds.material.depthTest,true);assert.equal(ground.raycast(),undefined);
 mist.update(1234,false);assert.equal(ground.material.uniforms.uTime.value,1.234);mist.update(5678,true);assert.equal(clouds.material.uniforms.uTime.value,0);mist.group.visible=false;mist.update(9999,false);assert.equal(ground.material.uniforms.uTime.value,0);
 mist.dispose();assert.equal(original.visible,true);assert.equal(scene.children.length,0);assert.ok(ground.geometry.disposed&&clouds.geometry.disposed&&ground.material.disposed&&clouds.material.disposed);assert.equal(original.geometry.disposed,undefined);
});
test('scene wires mist into boot, pause, Dice visibility, animation and cleanup without scene-wide fog',()=>{
 const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');assert.match(js,/liquidPortal\.preload\(\);\s*\}\s*exteriorMist = createExteriorMist/);assert.match(js,/exteriorMist\?\.update\(time, reducedMotion.matches\)/);assert.equal((js.match(/\[stageModel, rouletteRig, slotRig, exteriorMist\?\.group, audience\?\.group, showFX\?\.group\]/g)||[]).length,2);assert.match(js,/exteriorMist\?\.dispose\(\)/);assert.doesNotMatch(js,/scene\.fog\s*=/);assert.match(FLOOR_FRAGMENT,/mix\(tile,haze,mask\)/);assert.match(CLOUD_FRAGMENT,/if\(edge<=0.0\|\|fade<=0.0\)discard/);
});
