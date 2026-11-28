import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HANDS_COUNT,HANDS_RING,HANDS_FPS,HANDS_VARIANTS,handSeeds,sampleHandPose,sampleExteriorAmbience,exteriorDistance,EXTERIOR_AUDIO,createExteriorHands} from './exterior-hands.mjs';
import {EXTERIOR_FLOOR,MIST_CLEAR} from './exterior-mist.mjs';

test('exterior hands form deterministic two-row square perimeter, never intruding into either floor opening',()=>{
  const seeds=handSeeds();assert.equal(seeds.length,HANDS_COUNT);assert.deepEqual(seeds,handSeeds());assert.equal(new Set(seeds.map(s=>s.variant)).size,HANDS_VARIANTS);
  for(const s of seeds){
    const r=Math.max(Math.abs(s.x-HANDS_RING.x),Math.abs(s.z-HANDS_RING.z));assert.ok(r>=HANDS_RING.inner&&r<=HANDS_RING.outer);
    for(let f=0;f<120;f++)for(const eye of [{x:0,y:3,z:0},{x:70,y:100,z:-70},{x:-50,y:-30,z:50}]){
      const p=sampleHandPose(s,f,eye);const envelope=p.width/2+p.height*(Math.abs(Math.sin(p.roll))+Math.abs(Math.sin(p.pitch)));
      for(const b of [EXTERIOR_FLOOR,MIST_CLEAR])assert.ok(p.x+envelope<b.minX||p.x-envelope>b.maxX||p.z+envelope<b.minZ||p.z-envelope>b.maxZ,`arm ${s.x},${s.z} frame ${f} overlaps floor`);
      assert.ok(p.y<EXTERIOR_FLOOR.y+.3);assert.ok(Object.values(p).every(Number.isFinite));
    }
  }
  for(let i=0;i<8;i++)assert.equal(seeds.slice(i*24,(i+1)*24).length,24);
});
test('5fps pose advances, arm yaw faces both sides and reaches above fog',()=>{
  const s=handSeeds()[0],a=sampleHandPose(s,0,{x:s.x,y:1,z:s.z+10}),b=sampleHandPose(s,0,{x:s.x,y:1,z:s.z-10});
  assert.equal(HANDS_FPS,5);assert.ok(Math.abs(Math.abs(a.yaw-b.yaw)-Math.PI)<1e-8);assert.notEqual(a.y,sampleHandPose(s,1).y);
  const tops=Array.from({length:50},(_,f)=>{const p=sampleHandPose(s,f);return p.y+p.height});assert.ok(Math.max(...tops)>1.2);assert.ok(Math.max(...tops)-Math.min(...tops)>.8);
});
test('exterior sound is complementary, smooth, reversible, three-dimensional and ignores authored cameras',()=>{
  const b=EXTERIOR_AUDIO,inside={x:0,y:2,z:0};assert.deepEqual(sampleExteriorAmbience(inside),{room:1,water:0});assert.equal(exteriorDistance(inside),0);
  let prev=1;const out={};for(let d=0;d<=40;d+=.25){const p={x:b.maxX+d,y:2,z:0};assert.equal(sampleExteriorAmbience(p,true,out),out);assert.ok(out.room<=prev+1e-12);assert.equal(out.room+out.water,1);prev=out.room;}
  assert.deepEqual(out,{room:0,water:1});assert.deepEqual(sampleExteriorAmbience({x:0,y:b.maxY+16,z:0}),{room:.5,water:.5});assert.deepEqual(sampleExteriorAmbience({x:100,y:100,z:100},false),{room:1,water:0});assert.deepEqual(sampleExteriorAmbience(null),{room:1,water:0});assert.deepEqual(sampleExteriorAmbience(inside),{room:1,water:0});
});
function fake(){
 let loaded,failed;const vec=()=>({set(...values){this.values=values;}});class Group{children=[];add(o){this.children.push(o);}remove(o){this.children=this.children.filter(x=>x!==o);}}
 class TextureLoader{load(url,ok,_progress,err){loaded=ok;failed=err;return {url,dispose(){this.disposed=true;}};}}
 class Geometry{uv={count:4,getX:i=>i%2,getY:i=>Math.floor(i/2),setX(){},setY(){}};getAttribute(){return this.uv;}translate(){}dispose(){this.disposed=true;}}
 class Mesh{calls=0;instanceMatrix={setUsage(){}};instanceColor={};constructor(geometry,material,count){Object.assign(this,{geometry,material,count});}setColorAt(){}setMatrixAt(){this.calls++;}dispose(){this.disposed=true;}}
 class Material{constructor(options){Object.assign(this,options);}dispose(){this.disposed=true;}}
 class Obj{position=vec();rotation=vec();scale=vec();updateMatrix(){this.matrix={};}}
 class Color{setRGB(){return this;}}
 return {THREE:{Group,TextureLoader,PlaneGeometry:Geometry,InstancedMesh:Mesh,MeshBasicMaterial:Material,Object3D:Obj,Color,DoubleSide:2,NearestFilter:3,DynamicDrawUsage:4,SRGBColorSpace:5},scene:new Group(),load:(width=288,height=96)=>loaded({image:{width,height}}),fail:()=>failed()};
}
test('six double-sided batches, no draw before atlas ready, 5fps writes, reduced motion, lifecycle',()=>{
 const f=fake(),h=createExteriorHands(f.THREE,f.scene),eye={x:0,y:3,z:0},meshes=h.group.children;const total=()=>meshes.reduce((n,m)=>n+m.calls,0);
 assert.equal(meshes.length,6);assert.equal(meshes.reduce((n,m)=>n+m.count,0),192);h.update(0,true,false,eye);assert.equal(h.group.visible,false);assert.equal(total(),0);
 f.load();h.update(0,true,false,eye);assert.equal(total(),192);assert.equal(h.group.visible,true);for(const m of meshes){assert.equal(m.material.side,2);assert.equal(m.material.forceSinglePass,true);assert.equal(m.material.depthWrite,true);assert.equal(m.material.depthTest,true);assert.equal(m.material.opacity,.8);assert.equal(m.material.alphaHash,true);assert.equal(m.material.transparent,false);assert.equal(m.renderOrder,undefined);assert.equal(m.raycast(),undefined);}
 h.update(199,true,false,eye);assert.equal(total(),192);h.update(200,true,false,eye);assert.equal(total(),384);h.update(1000,true,true,eye);assert.equal(total(),576);h.update(2000,true,true,eye);assert.equal(total(),576);
 h.update(2000,false,false,eye);assert.equal(h.group.visible,false);assert.ok(meshes.every(m=>!m.visible));h.dispose();assert.equal(f.scene.children.length,0);assert.ok(meshes.every(m=>m.disposed&&m.geometry.disposed));f.load();h.update(3000,true,false,eye);assert.equal(h.group.visible,false);
});
test('malformed and missing atlas fail closed without generated replacements',()=>{
 const f=fake(),h=createExteriorHands(f.THREE,f.scene);f.load(1,1);h.update(0,true,false,{x:0,y:0,z:0});assert.equal(h.group.visible,false);f.fail();h.update(100,true,false);assert.equal(h.group.visible,false);h.dispose();
});
test('runtime wiring preserves authored music, combines exterior with VIP ambience, removes skip',()=>{
 const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8'),html=readFileSync(new URL('../rg/index.html',import.meta.url),'utf8'),reveal=readFileSync(new URL('./smeemo-reveal.mjs',import.meta.url),'utf8');
 assert.match(js,/Math\.min\(spatialAudioState\.musicGain, spatialAudioState\.exteriorMix\.room\)/);assert.match(js,/Math\.max\(mix\.water,zones\.exteriorMix\.water\)/);assert.match(js,/exteriorHands\?\.update\(crowdClock,roomVisible&&!diceModeOpen/);assert.doesNotMatch(html,/id="[^"]*smeemo[^\"]*skip/);assert.doesNotMatch(reveal,/skipButton/);
});

// A new pathname, not only a query parameter, prevents reuse of the old atlas.
test('clean atlas has a distinct deployed pathname and refreshed module chain',()=>{
 const f=fake(),h=createExteriorHands(f.THREE,f.scene);
 const url=new URL(h.group.children[0].material.map.url);
 assert.ok(url.pathname.endsWith('/assets/exterior-hands/hands-clean-v2.png'));
 const png=readFileSync(url);
 assert.equal(png.readUInt32BE(16),288);assert.equal(png.readUInt32BE(20),96);
 const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 const gate=readFileSync(new URL('./host-access.mjs',import.meta.url),'utf8');
 assert.match(js,/exterior-hands\.mjs\?v=clean-hands-opacity-20261128-v3/);
 assert.match(gate,/ramblegamble\.js\?v=slot-selection-20261128-v1/);
 for(const path of ['../rg/index.html','../rg/console/index.html'])assert.match(readFileSync(new URL(path,import.meta.url),'utf8'),/host-access\.mjs\?v=slot-selection-20261128-v1/);
 h.dispose();
});
