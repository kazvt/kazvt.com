import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {SKY_TILE,skyHeight,skyStride,skyTiles,tileRotation,SKY_FRAGMENT,createFloatingSky} from './floating-sky.mjs';

test('overhead height is exact, monotone, never passes camera, and returns to authored floor',()=>{
 for(let y=-30;y<=150;y+=.025){const h=skyHeight(y);assert.equal(h,Math.max(5,y+3));assert.ok(h>=5&&h-y>=3-1e-12);}
 assert.equal(skyHeight(NaN),5);assert.equal(skyHeight(1),5);assert.equal(skyHeight(100),103);assert.equal(skyHeight(1),5);
});
test('bounded stationary tile grid has complete coverage through all cell seams and negative world coordinates',()=>{
 let samples=0;
 for(const x of [-2000,-65,-skyStride/2-.0001,-skyStride/2+.0001,-1,0,skyStride/2-.0001,skyStride/2+.0001,121,2000])for(const z of [-1000,-31,-.001,0,16,1000]){
  const tiles=skyTiles(x,z);assert.ok(tiles.length<=49&&tiles.length>0);const keys=new Set(tiles.map(t=>`${t.ix},${t.iz}`));assert.equal(keys.size,tiles.length);
  for(let a=0;a<Math.PI*2;a+=.21)for(const r of [0,1,10,30,55,75.99]){const px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;assert.ok(tiles.some(t=>Math.abs(px-t.x)<=18&&Math.abs(pz-t.z)<=18));samples++;}
  for(const t of tiles){assert.equal(t.x,t.ix*skyStride);assert.equal(t.z,t.iz*skyStride);assert.equal(t.angle,tileRotation(t.ix,t.iz));assert.ok([0,Math.PI/2,Math.PI,3*Math.PI/2].includes(t.angle));}
 }
 assert.ok(samples>10000);assert.deepEqual(skyTiles(NaN,0),[]);
});
class Vec {constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){Object.assign(this,{x,y,z});return this;}}
class Group{constructor(){this.children=[];}add(m){this.children.push(m);}remove(m){this.children=this.children.filter(x=>x!==m);}}
class Resource{constructor(opts){Object.assign(this,opts);}dispose(){this.disposed=true;}}
class Geo extends Resource{rotateX(x){this.tilt=x;}}
class Mesh {constructor(g,m){this.geometry=g;this.material=m;this.position=new Vec();this.rotation={};}}
class Box{constructor(){this.min=new Vec();this.max=new Vec();}}
class Frustum{setFromProjectionMatrix(){}intersectsBox(b){return Frustum.visible&&b.min.x<=Frustum.target&&b.max.x>=Frustum.target;}}
Frustum.visible=false;Frustum.target=0;
class Video{constructor(){this.paused=true;this.readyState=0;this.loads=0;this.requests=0;this.plays=0;this.pauses=0;this.listeners={};}set src(v){this.url=v;this.requests++;}get src(){return this.url;}setAttribute(){}removeAttribute(k){if(k==='src')delete this.url;}addEventListener(k,f){this.listeners[k]=f;}removeEventListener(k){delete this.listeners[k];}play(){this.plays++;if(this.reject)return Promise.reject(Error('blocked'));this.paused=false;return this.promise||Promise.resolve();}pause(){this.pauses++;this.paused=true;}load(){this.loads++;}}
const T={Vector2:Vec,Group,VideoTexture:class extends Resource{constructor(v){super();this.video=v;}},ShaderMaterial:Resource,PlaneGeometry:Geo,Mesh,Matrix4:class{multiplyMatrices(){}},Frustum,Box3:Box,FrontSide:0,NoColorSpace:'',LinearFilter:1};
const tick=()=>Promise.resolve();
function fixture(){Frustum.visible=false;const scene=new Group(),video=new Video(),listeners={},doc={createElement(){return video;},addEventListener(k,f){listeners[k]=f;},removeEventListener(k){delete listeners[k];}},camera={position:new Vec(0,1,0),updateMatrixWorld(){},projectionMatrix:{},matrixWorldInverse:{}};return {scene,video,listeners,camera,sky:createFloatingSky({THREE:T,scene,document:doc,src:'local.mp4'})};}
test('one lazy media request and decoder, cull only visible quads, height tracks camera without changing world anchors',async()=>{
 const {sky,video,camera,scene}=fixture();assert.equal(video.requests,0);assert.equal(video.preload,'none');assert.equal(video.muted,true);assert.equal(video.loop,true);assert.equal(sky.group.children.length,49);
 sky.update(camera,false);sky.update(camera,true);assert.equal(video.requests,0);
 Frustum.visible=true;sky.update(camera,true);await tick();assert.equal(video.requests,1);assert.equal(video.plays,1);assert.equal(sky.group.visible,false);
 video.readyState=2;sky.update(camera,true);assert.equal(sky.group.visible,true);const active=sky.group.children.filter(m=>m.visible);assert.ok(active.length>0&&active.length<49);assert.ok(active.every(m=>m.position.y===5&&m.material===active[0].material&&m.geometry===active[0].geometry));assert.equal(active[0].geometry.tilt,Math.PI/2);assert.equal(active[0].material.depthWrite,false);assert.equal(active[0].material.depthTest,true);assert.equal(active[0].raycast(),undefined);
 const before=active.map(m=>[m.position.x,m.position.z,m.rotation.y]);camera.position.y=22;sky.update(camera,true);assert.ok(active.every(m=>m.position.y===25));assert.deepEqual(active.map(m=>[m.position.x,m.position.z,m.rotation.y]),before);camera.position.y=0;sky.update(camera,true);assert.ok(active.every(m=>m.position.y===5));
 Frustum.visible=false;sky.update(camera,true);assert.ok(video.paused);assert.equal(sky.group.visible,false);Frustum.visible=true;sky.update(camera,true);await tick();assert.equal(video.requests,1);assert.equal(video.plays,2);sky.suspend();assert.ok(video.paused);sky.dispose();assert.equal(scene.children.length,0);assert.equal(video.loads,1);assert.ok(active[0].geometry.disposed&&active[0].material.disposed&&active[0].material.uniforms.uVideo.value.disposed);
});
test('blocked autoplay retries only on gesture/return, missing video never becomes an opaque panel',async()=>{
 const {sky,video,camera,listeners}=fixture();Frustum.visible=true;video.reject=true;sky.update(camera,true);await tick();sky.update(camera,true);assert.equal(video.plays,1);video.reject=false;listeners.pointerdown();await tick();assert.equal(video.plays,2);video.readyState=2;sky.update(camera,true);assert.ok(sky.group.visible);video.listeners.error();assert.equal(sky.group.visible,false);assert.ok(video.paused);sky.update(camera,true);assert.equal(video.requests,1);assert.equal(video.plays,2);sky.dispose();assert.equal(Object.keys(listeners).length,0);
});
test('stale play completion cannot revive hidden media',async()=>{
 const {sky,video,camera}=fixture();Frustum.visible=true;let resolve;video.promise=new Promise(r=>resolve=r);sky.update(camera,true);sky.suspend();resolve();await tick();assert.ok(video.paused);assert.equal(sky.group.visible,false);sky.dispose();
});
test('sky integration preserves legacy Dice-only sky and pauses at menu lock hidden disposal boundaries',()=>{
 const source=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');assert.match(source,/createSkybox\(\);\s*try \{ floatingSky = createFloatingSky/);assert.match(source,/floatingSky\?\.update\(camera, roomVisible && !diceModeOpen\)/);assert.match(source,/if \(!visible\) floatingSky\?\.suspend\(\)/);assert.match(source,/if \(document.hidden\) \{\s*floatingSky\?\.suspend\(\)/);assert.match(source,/floatingSky\?\.dispose\(\)/);assert.match(source,/if \(open\) \{\s*floatingSky\?\.suspend\(\)/);assert.match(SKY_FRAGMENT,/smoothstep\(0\.,\.12,edge\)/);assert.match(SKY_FRAGMENT,/if\(a<\.007\)discard/);assert.ok(statSync(new URL('./assets/sky/floating-sky-matte.mp4',import.meta.url)).size>10000);assert.ok(statSync(new URL('./assets/sky/floating-sky-alpha.webm',import.meta.url)).size>10000);
});
