import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSlotMarquee,keyMarqueeMatte,marqueeOpacity,SLOT_MARQUEE_FACE,SLOT_MARQUEE_INDEX,SLOT_MARQUEE_RECT,SLOT_MARQUEE_CROP} from './slot-marquee.mjs';
import {createStageShowState,RETRACT_MS} from './stage-show-state.mjs';
function fixture({play=()=>Promise.resolve()}={}){
 let time=0,draws=0,uploads=0;
 class Video extends EventTarget{constructor(){super();this.paused=true;this.currentTime=0;this.readyState=0;this.videoWidth=1152;this.videoHeight=576;this.plays=0;this.ended=false;}getAttribute(){return this.src;}removeAttribute(){delete this.src;}load(){}play(){this.paused=false;this.plays++;return play();}pause(){this.paused=true;}}
 const video=new Video();const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){draws++;},clearRect(){}};
 const doc={createElement:n=>n==='video'?video:{getContext:()=>ctx}};
 class Resource{constructor(o){Object.assign(this,o);}dispose(){this.disposed=true;}}
 class Texture extends Resource{set needsUpdate(v){if(v)uploads++;}}
 class Geometry extends Resource{setAttribute(){}setIndex(){}computeVertexNormals(){}}
 class Mesh{constructor(geometry,material){Object.assign(this,{geometry,material});}removeFromParent(){this.removed=true;}}
 const THREE={CanvasTexture:Texture,BufferGeometry:Geometry,Float32BufferAttribute:class{},MeshBasicMaterial:Resource,Mesh};
 const model={add(m){this.mesh=m;}};const fx=createSlotMarquee(THREE,model,{doc});
 return {fx,video,model,get draws(){return draws;},get uploads(){return uploads;},get opacity(){return fx.mesh.material.opacity;},step(ms,active=true,wanted=true,advance=true){for(let i=0;i<ms;i+=20){const dt=Math.min(20,ms-i);time+=dt;if(advance&&!video.paused&&video.readyState>=2&&!video.ended)video.currentTime+=dt/1000;fx.update(time,active,wanted);}}};
}
test('fade waits for decoded frames; close fades to untouched logo, then pauses; reopen restarts',()=>{
 const f=fixture();f.step(2000);assert.equal(f.opacity,0);assert.equal(f.video.plays,1);assert.equal(f.video.muted,true);assert.equal(f.video.volume,0);
 f.video.readyState=4;f.step(250);assert.ok(f.opacity>0&&f.opacity<1);f.step(700);assert.equal(f.opacity,1);assert.ok(f.fx.mesh.visible);
 f.step(250,true,false);assert.ok(f.opacity>0&&f.opacity<1);assert.equal(f.video.paused,false);const before=f.opacity;f.step(100,true,true);assert.ok(f.opacity>before);assert.equal(f.video.plays,1);
 f.step(750,true,false);assert.equal(f.opacity,0);assert.equal(f.video.paused,true);assert.equal(f.fx.mesh.visible,false);f.step(20);assert.equal(f.video.plays,2);assert.equal(f.video.currentTime,0);f.fx.dispose();assert.ok(f.fx.mesh.removed);assert.ok(f.fx.mesh.material.disposed);
});
test('settled video keeps neon active without replay and idle frames avoid texture uploads',()=>{
 const f=fixture();f.video.readyState=4;f.step(900);f.video.ended=true;f.video.paused=true;f.video.currentTime=4.5;f.step(1000);const n=f.uploads;f.step(1000);assert.ok(f.uploads>n);assert.equal(f.video.plays,1);f.step(4000);const idle=f.uploads;f.step(1500);assert.equal(f.uploads,idle);f.step(3200);assert.ok(f.uploads>idle);f.fx.suspend();assert.equal(f.opacity,0);const stopped=f.uploads;f.step(2000,false,true);assert.equal(f.uploads,stopped);
});
test('wrong dimensions, stalled video, rejected playback and hidden transitions fall back safely',async()=>{
 const f=fixture();f.video.readyState=4;f.video.videoWidth=500;f.step(1000);assert.equal(f.opacity,0);assert.ok(f.video.paused);
 const s=fixture();s.video.readyState=4;s.step(800);assert.equal(s.opacity,1);s.step(3300,true,true,false);assert.equal(s.opacity,0);assert.ok(s.video.paused);
 const b=fixture({play:()=>Promise.reject(Error('blocked'))});b.step(20);await Promise.resolve();b.step(100);assert.equal(b.opacity,0);assert.ok(b.video.paused);
 const p=fixture();p.video.readyState=4;p.step(800);p.step(20,false,true);assert.equal(p.opacity,0);assert.ok(p.video.paused);p.step(20);assert.equal(p.video.plays,2);
});
test('matte removal preserves bright sign and original alpha; smooth fades are bounded',()=>{
 const data=new Uint8ClampedArray([20,18,40,255,23,20,43,255,255,243,180,255,120,110,240,128]);keyMarqueeMatte(data);assert.deepEqual([...data].filter((_,i)=>i%4===3),[0,0,255,128]);
 assert.equal(marqueeOpacity(-1),0);assert.equal(marqueeOpacity(1.5),1);assert.equal(marqueeOpacity(.5),.5);
});
test('overlay matches the authored front triangles exactly and remains above the reel texture',()=>{
 const gltf=JSON.parse(readFileSync(new URL('./assets/provided/rg_slots.gltf',import.meta.url),'utf8'));
 const prim=gltf.meshes[gltf.nodes.find(n=>n.name==='machine').mesh].primitives[0];const buffer=Buffer.from(gltf.buffers[0].uri.split(',')[1],'base64');
 function read(id,n){const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],size=a.componentType===5126?4:2;return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>buffer[a.componentType===5126?'readFloatLE':'readUInt16LE']((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||size*n)+j*size)));}
 const pos=read(prim.attributes.POSITION,3),uv=read(prim.attributes.TEXCOORD_0,2),ids=read(prim.indices,1).flat();const tris=[];for(let i=0;i<ids.length;i+=3)tris.push(ids.slice(i,i+3));
 const points=Array.from({length:4},(_,i)=>SLOT_MARQUEE_FACE.slice(i*3,i*3+3));const expectedUV=[[0,0],[0,.5],[.625,0],[.625,.5]];
 for(let i=0;i<6;i+=3){const tri=SLOT_MARQUEE_INDEX.slice(i,i+3);assert.ok(tris.some(t=>tri.every(j=>t.some(k=>points[j].every((v,l)=>Math.abs(v-pos[k][l])<1e-5)&&expectedUV[j].every((v,l)=>Math.abs(v-uv[k][l])<1e-6)))));}
 const [x,y,w,h]=SLOT_MARQUEE_RECT;assert.ok(x>0&&x+w<80&&y>0&&y+h<16);const [sx,sy,sw,sh]=SLOT_MARQUEE_CROP;assert.ok(sx+sw<=1152&&sy+sh<=576);
 const state=createStageShowState();state.reset(true);state.cabinet(false,0);assert.ok(state.step(650).travel>0);assert.equal(state.step(RETRACT_MS).travel,0);
});
