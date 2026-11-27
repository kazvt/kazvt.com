import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {SKY_TILE,skyHeight,skyTarget,stepSkyHeight,tileVariant,skyStride,skyTiles,tileRotation,SKY_FRAGMENT,createFloatingSky} from './floating-sky.mjs';

test('hard overhead clearance, monotone smooth knee, lag and return to floor',()=>{
 let last=22.5;
 for(let y=-30;y<=150;y+=.025){const h=skyHeight(y),target=skyTarget(y);assert.equal(h,Math.max(22.5,y+3));assert.ok(h>=22.5&&h-y>=3-1e-12);assert.ok(target>=h&&target>=last);last=target;}
 assert.equal(skyHeight(NaN),22.5);assert.equal(skyTarget(14.5),22.5);assert.equal(skyTarget(18.5),24.5);assert.equal(skyTarget(100),106);
 // Approaches before the hard limit; acceleration is gradual at the knee.
 assert.ok(skyTarget(14.501)-22.5<.000001);
 assert.ok(Math.abs((skyTarget(18.501)-skyTarget(18.499))/.002-1)<.001);
 let h=22.5;for(let i=0;i<60;i++){h=stepSkyHeight(h,18,1/60);assert.ok(h>=22.5&&h<=skyTarget(18));}assert.ok(h>23&&h<skyTarget(18));
 let peak=stepSkyHeight(h,100,0);assert.equal(peak,103); // teleport: hard limit always wins
 let falling=stepSkyHeight(peak,0,1/60);assert.ok(falling<peak&&falling>22.5);
 for(let i=0;i<600;i++)falling=stepSkyHeight(falling,0,1/60);assert.equal(falling,22.5);
 for(const fps of [30,60,120]){let n=22.5;for(let i=0;i<fps;i++)n=stepSkyHeight(n,18,1/fps);assert.ok(Math.abs(n-h)<1e-9);}
 for(let i=0;i<10000;i++){const y=Math.sin(i*.013)*50+i*.003;h=stepSkyHeight(h,y,(i%9)/60);assert.ok(h>=skyHeight(y));}
 assert.equal(stepSkyHeight(NaN,NaN,NaN),22.5);
});
test('adjacent tiles show different baked casts, including negative coordinates',()=>{
 for(let x=-20;x<=20;x++)for(let z=-20;z<=20;z++){const v=tileVariant(x,z);assert.ok(v===0||v===1);assert.notEqual(v,tileVariant(x+1,z));assert.notEqual(v,tileVariant(x,z+1));}
 assert.match(SKY_FRAGMENT,/float row=\(1\.-uVariant\+p.y\)\*\.5/);
});
test('bounded stationary tile grid has complete coverage through all cell seams and negative world coordinates',()=>{
 let samples=0;
 for(const x of [-2000,-65,-skyStride/2-.0001,-skyStride/2+.0001,-1,0,skyStride/2-.0001,skyStride/2+.0001,121,2000])for(const z of [-1000,-31,-.001,0,16,1000]){
  const tiles=skyTiles(x,z);assert.ok(tiles.length<=49&&tiles.length>0);const keys=new Set(tiles.map(t=>`${t.ix},${t.iz}`));assert.equal(keys.size,tiles.length);
  for(let a=0;a<Math.PI*2;a+=.21)for(const r of [0,1,10,30,55,75.99]){const px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;assert.ok(tiles.some(t=>Math.abs(px-t.x)<=18&&Math.abs(pz-t.z)<=18));samples++;}
  for(const t of tiles){assert.equal(t.x,t.ix*skyStride);assert.equal(t.z,t.iz*skyStride);assert.equal(t.angle,tileRotation(t.ix,t.iz));assert.equal(t.variant,tileVariant(t.ix,t.iz));assert.ok([0,Math.PI/2,Math.PI,3*Math.PI/2].includes(t.angle));}
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
class Video{constructor(){this.paused=true;this.readyState=0;this.videoWidth=1536;this.videoHeight=1536;this.loads=0;this.requests=0;this.plays=0;this.pauses=0;this.listeners={};}set src(v){this.url=v;this.requests++;}get src(){return this.url;}setAttribute(){}removeAttribute(k){if(k==='src')delete this.url;}addEventListener(k,f){this.listeners[k]=f;}removeEventListener(k){delete this.listeners[k];}play(){this.plays++;if(this.reject)return Promise.reject(Error('blocked'));this.paused=false;return this.promise||Promise.resolve();}pause(){this.pauses++;this.paused=true;}load(){this.loads++;}}
const T={Vector2:Vec,Group,VideoTexture:class extends Resource{constructor(v){super();this.video=v;}},ShaderMaterial:Resource,PlaneGeometry:Geo,Mesh,Matrix4:class{multiplyMatrices(){}},Frustum,Box3:Box,FrontSide:0,NoColorSpace:'',LinearFilter:1};
const tick=()=>Promise.resolve();
function fixture(){Frustum.visible=false;const scene=new Group(),video=new Video(),listeners={},doc={createElement(){return video;},addEventListener(k,f){listeners[k]=f;},removeEventListener(k){delete listeners[k];}},camera={position:new Vec(0,1,0),updateMatrixWorld(){},projectionMatrix:{},matrixWorldInverse:{}};return {scene,video,listeners,camera,sky:createFloatingSky({THREE:T,scene,document:doc,src:'local.mp4'})};}
test('one lazy media request and decoder, cull only visible quads, height tracks camera without changing world anchors',async()=>{
 const {sky,video,camera,scene}=fixture();assert.equal(video.requests,0);assert.equal(video.preload,'none');assert.equal(video.muted,true);assert.equal(video.loop,true);assert.equal(sky.group.children.length,49);
 sky.update(camera,false);sky.update(camera,true);assert.equal(video.requests,0);
 Frustum.visible=true;sky.update(camera,true);await tick();assert.equal(video.requests,1);assert.equal(video.plays,1);assert.equal(sky.group.visible,false);
 video.readyState=2;sky.update(camera,true);assert.equal(sky.group.visible,true);const active=sky.group.children.filter(m=>m.visible);assert.ok(active.length>0&&active.length<49);assert.ok(active.every(m=>m.position.y===22.5&&m.material.uniforms.uVideo.value===active[0].material.uniforms.uVideo.value&&m.geometry===active[0].geometry));assert.equal(active[0].geometry.tilt,Math.PI/2);assert.equal(active[0].material.depthWrite,false);assert.equal(active[0].material.depthTest,true);assert.equal(active[0].raycast(),undefined);
 const before=active.map(m=>[m.position.x,m.position.z,m.rotation.y]);assert.equal(new Set(active.map(m=>m.material)).size,2);camera.position.y=30;sky.update(camera,true,1000);assert.ok(active.every(m=>m.position.y>=33));assert.deepEqual(active.map(m=>[m.position.x,m.position.z,m.rotation.y]),before);const top=active[0].position.y;camera.position.y=0;sky.update(camera,true,1016);assert.ok(active.every(m=>m.position.y>22.5&&m.position.y<top));for(let i=1;i<600;i++)sky.update(camera,true,1016+i*16);assert.ok(active.every(m=>m.position.y===22.5));
 Frustum.visible=false;sky.update(camera,true);assert.ok(video.paused);assert.equal(sky.group.visible,false);Frustum.visible=true;sky.update(camera,true);await tick();assert.equal(video.requests,1);assert.equal(video.plays,2);sky.suspend();assert.ok(video.paused);sky.dispose();assert.equal(scene.children.length,0);assert.equal(video.loads,1);assert.ok(active[0].geometry.disposed&&active.every(m=>m.material.disposed)&&active[0].material.uniforms.uVideo.value.disposed);
});
test('blocked autoplay retries only on gesture/return, missing video never becomes an opaque panel',async()=>{
 const {sky,video,camera,listeners}=fixture();Frustum.visible=true;video.reject=true;sky.update(camera,true);await tick();sky.update(camera,true);assert.equal(video.plays,1);video.reject=false;listeners.pointerdown();await tick();assert.equal(video.plays,2);video.readyState=2;sky.update(camera,true);assert.ok(sky.group.visible);video.listeners.error();assert.equal(sky.group.visible,false);assert.ok(video.paused);sky.update(camera,true);assert.equal(video.requests,1);assert.equal(video.plays,2);sky.dispose();assert.equal(Object.keys(listeners).length,0);
});
test('old single-cast video dimensions cannot display with the new atlas shader',async()=>{
 const {sky,video,camera}=fixture();Frustum.visible=true;sky.update(camera,true);await tick();video.readyState=2;video.videoWidth=2048;video.videoHeight=1024;sky.update(camera,true);assert.equal(sky.group.visible,false);assert.ok(video.paused);sky.dispose();
});
test('stale play completion cannot revive hidden media',async()=>{
 const {sky,video,camera}=fixture();Frustum.visible=true;let resolve;video.promise=new Promise(r=>resolve=r);sky.update(camera,true);sky.suspend();resolve();await tick();assert.ok(video.paused);assert.equal(sky.group.visible,false);sky.dispose();
});
test('sky integration preserves legacy Dice-only sky and pauses at menu lock hidden disposal boundaries',()=>{
 const source=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');assert.match(source,/createSkybox\(\);\s*try \{ floatingSky = createFloatingSky/);assert.match(source,/floatingSky\?\.update\(camera, roomVisible && !diceModeOpen, time\)/);assert.match(source,/if \(!visible\) floatingSky\?\.suspend\(\)/);assert.match(source,/if \(document.hidden\) \{\s*floatingSky\?\.suspend\(\)/);assert.match(source,/floatingSky\?\.dispose\(\)/);assert.match(source,/if \(open\) \{\s*floatingSky\?\.suspend\(\)/);assert.match(SKY_FRAGMENT,/smoothstep\(0\.,\.12,edge\)/);assert.match(SKY_FRAGMENT,/if\(a<\.007\)discard/);assert.ok(statSync(new URL('./assets/sky/floating-sky-matte.mp4',import.meta.url)).size>10000);assert.ok(statSync(new URL('./assets/sky/floating-sky-alpha.webm',import.meta.url)).size>10000);
});
