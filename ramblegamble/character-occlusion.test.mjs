import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacterOcclusion,maskSize,maskBounds,maskPixel,unionMaskBounds,visibilityClip,isDepthOccluder,CHARACTER_BITS} from './character-occlusion.mjs';

// Rendering doubles exercise the real mask extraction/compositing lifecycle.
// They intentionally do not claim to validate GPU rasterization or blending.
class V {set(x,y,z){Object.assign(this,{x,y,z});return this;}copy(v){return this.set(v.x,v.y,v.z);}}
class Matrix {elements=Array.from({length:16},(_,i)=>+(i%5===0));copy(m){this.elements=[...m.elements];return this;}}
class Scene {children=[];visible=true;add(x){this.children.push(x);x.parent=this;}traverse(fn){fn(this);for(const x of this.children)x.traverse(fn);}}
class Mesh extends Scene {isMesh=true;matrix=new Matrix();matrixWorld=new Matrix();position=new V();rotation={};scale=new V();constructor(geometry,material){super();Object.assign(this,{geometry,material});}}
class Material {constructor(opts){Object.assign(this,opts);}dispose(){this.disposed=true;}}
class Geometry {attributes={position:{version:0}};dispose(){this.disposed=true;}}
class Target {setSize(w,h){Object.assign(this,{w,h});}dispose(){this.disposed=true;}}
class Color {value=0;}
const THREE={Scene,Mesh,MeshBasicMaterial:Material,ShaderMaterial:Material,PlaneGeometry:Geometry,WebGLRenderTarget:Target,Color,FrontSide:0,NearestFilter:1,AdditiveBlending:2};
const entry=()=>({anchor:{x:0,y:1,z:0},worldWidth:1,worldHeight:1,projectedQuad:{yaw:0,corners:[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}]},panel:{style:{},parentElement:{style:{}}}});
const makeFixture=()=>{
 const root=new Scene(),opaque=new Mesh(new Geometry(),{alphaTest:.5,map:{version:0},depthWrite:true,depthTest:true});root.add(opaque);const transparent=new Mesh(new Geometry(),{transparent:true});root.add(transparent);
 const originalTarget={original:true};const renderer={target:originalTarget,alpha:.7,color:123,autoClear:true,reads:0,getRenderTarget(){return this.target;},setRenderTarget(t){this.target=t;},getClearAlpha(){return this.alpha;},getClearColor(c){c.value=this.color;},setClearColor(c,a){this.color=typeof c==='number'?c:c.value;this.alpha=a;},clear(){},render(scene){this.rendered=scene;},readRenderTargetPixels(t,x,y,w,h,pixels){this.reads++;if(this.fail)throw Error('read failed');if(this.empty)return;for(let i=0;i<w*h;i++)pixels[i*4]=32+(i%w>=w/2?16:0);}};
 const entries=[entry(),entry()];const camera={matrixWorld:new Matrix(),projectionMatrix:new Matrix()};return {root,opaque,transparent,renderer,originalTarget,entries,camera,view:{width:8,height:6}};
};
test('bounded mask resolution, bottom-up bit decoding and clipped bounds',()=>{
 assert.deepEqual(maskSize(1920,1080),[1920,1080]);assert.deepEqual(maskSize(1366,668,1.6),[1920,939]);assert.deepEqual(maskSize(3840,2160),[1920,1080]);assert.deepEqual(maskSize(480,800),[480,800]);assert.deepEqual(maskSize(1,0),[1,1]);assert.equal(CHARACTER_BITS.reduce((a,b)=>a+b),248);
 const p=new Uint8Array(2*2*4);p[0]=16;p[12]=32;assert.equal(maskPixel(p,2,2,16,0,1),true);assert.equal(maskPixel(p,2,2,32,1,0),true);assert.equal(maskPixel(p,2,2,32,-1,0),false);
 assert.deepEqual(maskBounds([{x:-10,y:-5},{x:20,y:12}],8,6,{width:16,height:12}),{left:0,top:0,right:8,bottom:6});
 for(const key of ['visible','colorWrite','depthTest','depthWrite'])assert.equal(isDepthOccluder({[key]:false}),false);assert.equal(isDepthOccluder({transparent:true}),false);assert.equal(isDepthOccluder({alphaTest:.5}),true);
});
test('independent character masks, cached occlusion, geometry changes and fail-closed readback',()=>{
 const old=globalThis.document;globalThis.document={createElement(){throw Error('No image masks should be created');}};
 try{const f=makeFixture(),{renderer,entries,camera,view,root,opaque}=f;const mask=createCharacterOcclusion(THREE,renderer,[root],entries);
 mask.update(entries,view,camera);assert.equal(renderer.reads,1);assert.equal(renderer.rendered.children.length,3);assert.equal(renderer.rendered.children[0].material.alphaTest,.5);assert.equal(renderer.rendered.children[0].material.colorWrite,false);assert.equal(renderer.target,f.originalTarget);assert.equal(renderer.alpha,.7);assert.equal(renderer.color,123);assert.equal(renderer.autoClear,true);
 assert.equal(mask.contains(entries[0],1,2),false);assert.equal(mask.contains(entries[0],6,2),true);assert.equal(mask.contains(entries[1],1,2),true);assert.equal(entries[0].panel.parentElement.style.clipPath,'path("M4 0H8V6H4Z")');assert.equal(entries[1].panel.parentElement.style.clipPath,'none');assert.equal(entries[0].panel.parentElement.style.maskImage,undefined);
 mask.update(entries,view,camera);assert.equal(renderer.reads,1);opaque.geometry.attributes.position.version++;mask.update(entries,view,camera);assert.equal(renderer.reads,2);
 opaque.material.map.version++;mask.update(entries,view,camera);assert.equal(renderer.reads,3);mask.update([entries[1]],view,camera);assert.equal(entries[0].panel.style.visibility,'hidden');assert.equal(mask.contains(entries[0],6,2),false);
 renderer.empty=true;mask.invalidate();mask.update(entries,view,camera);assert.equal(entries[1].panel.style.visibility,'hidden');assert.equal(mask.contains(entries[1],1,2),false);
 renderer.fail=true;mask.invalidate();assert.throws(()=>mask.update(entries,view,camera),/read failed/);assert.equal(renderer.target,f.originalTarget);assert.equal(renderer.alpha,.7);assert.equal(renderer.autoClear,true);assert.equal(mask.contains(entries[1],1,2),false);mask.dispose();
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('geometric clips merge rows, preserve unobstructed projected edges and handle holes',()=>{
 const view={width:10,height:8},corners=[{x:1,y:1},{x:9,y:1},{x:8,y:7},{x:2,y:7}],bounds=maskBounds(corners,10,8,view);
 assert.deepEqual(unionMaskBounds([bounds,{left:0,right:2,top:0,bottom:3}]),{left:0,right:9,top:0,bottom:7});
 const full=(x,y)=>y>=1&&y<7&&x+.5>=1+(y+.5-1)/6&&x+.5<9-(y+.5-1)/6;
 assert.deepEqual(visibilityClip(corners,bounds,10,8,view,full),{visible:true,path:'none'});
 const cut=visibilityClip(corners,bounds,10,8,view,(x,y)=>full(x,y)&&!(x>=4&&x<6&&y>=2&&y<5));
 assert.ok(cut.visible);assert.match(cut.path,/^path\("M/);assert.notEqual(cut.path,'none');
 assert.deepEqual(visibilityClip(corners,bounds,10,8,view,()=>false),{visible:false,path:'none'});
});
test('cropped readback uses correct lower-left GPU origin and hit-test coordinates after moving',()=>{
 const {renderer,entries,root,camera}=makeFixture();const e=entries[0],view={width:100,height:80};
 const mask=createCharacterOcclusion(THREE,renderer,[root],[e]);const reads=[];
 renderer.readRenderTargetPixels=(target,x,y,w,h,pixels)=>{reads.push([x,y,w,h]);for(let i=0;i<w*h;i++)pixels[i*4]=16;};
 for(const [left,top] of [[13,17],[29,42],[0,1]]){
  e.projectedQuad.corners=[{x:left,y:top},{x:left+16,y:top},{x:left+16,y:top+9},{x:left,y:top+9}];
  camera.matrixWorld.elements[12]=left;mask.update([e],view,camera);
  assert.deepEqual(reads.at(-1),[left,80-top-9,16,9]);assert.ok(mask.contains(e,left+5,top+5));assert.equal(mask.contains(e,left+16,top+5),false);assert.equal(e.panel.parentElement.style.clipPath,'none');
 }
 mask.dispose();
});

test('unobstructed moving panels do not churn clip styles or create mask resources',()=>{
 const {renderer,entries,root,camera}=makeFixture(),actor=entries[0],view={width:40,height:30};
 let writes=0,clip;actor.panel.parentElement.style={set clipPath(v){writes++;clip=v;},get clipPath(){return clip;}};
 renderer.readRenderTargetPixels=(target,x,y,w,h,pixels)=>{renderer.reads++;for(let i=0;i<w*h;i++)pixels[i*4]=16;};
 const mask=createCharacterOcclusion(THREE,renderer,[root],[actor]);
 for(let i=0;i<25;i++){const left=i%8,top=i%5;actor.projectedQuad.corners=[{x:left,y:top},{x:left+10,y:top},{x:left+10,y:top+9},{x:left,y:top+9}];camera.matrixWorld.elements[12]=i;mask.update([actor],view,camera);assert.equal(actor.panel.style.visibility,'visible');}
 assert.equal(renderer.reads,25);assert.equal(writes,1);assert.equal(clip,'none');mask.dispose();
});

test('a selection bounce updates the depth plane even with an unchanged camera and immutable base pose',()=>{
 const {renderer,entries,root,camera,view}=makeFixture(),actor=entries[0];const mask=createCharacterOcclusion(THREE,renderer,[root],[actor]);
 mask.update([actor],view,camera);const mesh=renderer.rendered.children.at(-1);assert.equal(mesh.scale.y,1);assert.equal(mesh.position.y,1);
 actor.renderPose={anchor:{x:0,y:1.1,z:0},worldHeight:1.2,worldWidth:1/1.2};mask.update([actor],view,camera);
 assert.equal(renderer.reads,2);assert.equal(mesh.scale.y,1.2);assert.equal(mesh.position.y,1.1);assert.equal(actor.anchor.y,1);assert.equal(actor.worldHeight,1);
 mask.update([actor],view,camera);assert.equal(renderer.reads,2);delete actor.renderPose;mask.update([actor],view,camera);assert.equal(renderer.reads,3);assert.equal(mesh.scale.y,1);mask.dispose();
});

test('five independently addressable live planes retain the existing four bit values and never saturate',()=>{
 const {root,renderer,camera,view}=makeFixture();const entries=Array.from({length:5},entry);
 assert.deepEqual(CHARACTER_BITS.slice(0,4),[16,32,64,128]);
 assert.equal(new Set(CHARACTER_BITS).size,5);assert.ok(CHARACTER_BITS.every(b=>(b&(b-1))===0));
 // Every possible overlap combination, including all five on the same pixel.
 for(let subset=0;subset<32;subset++){
  const sum=CHARACTER_BITS.reduce((s,b,i)=>s+((subset>>i&1)?b:0),0);
  const pixels=Uint8Array.of(sum,0,0,255);
  for(let i=0;i<5;i++)assert.equal(maskPixel(pixels,1,1,CHARACTER_BITS[i],0,0),Boolean(subset>>i&1));
 }
 renderer.readRenderTargetPixels=(t,x,y,w,h,pixels)=>{for(let i=0;i<w*h;i++)pixels[i*4]=240+(i%w>=w/2?8:0);};
 const masks=createCharacterOcclusion(THREE,renderer,[root],entries);masks.update(entries,view,camera);
 const guest=entries[4];assert.equal(guest.panel.style.visibility,'visible');assert.equal(masks.contains(guest,1,2),false);assert.equal(masks.contains(guest,6,2),true);
 assert.equal(guest.panel.parentElement.style.clipPath,'path("M4 0H8V6H4Z")');
 for(const e of entries.slice(0,4)){assert.equal(masks.contains(e,1,2),true);assert.equal(e.panel.parentElement.style.clipPath,'none');}
 assert.equal(renderer.rendered.children.at(-1).material.uniforms.value.value,8/255);
 masks.update(entries.slice(0,4),view,camera);assert.equal(guest.panel.style.visibility,'hidden');assert.equal(masks.contains(guest,6,2),false);masks.dispose();
});

test('fallback coverage measures offscreen and depth-hidden area, remains cached and resets when culled',()=>{
 const {renderer,entries,root,camera}=makeFixture();const e=entries[0],view={width:100,height:80};
 e.projectedQuad.corners=[{x:-10,y:0},{x:10,y:0},{x:10,y:20},{x:-10,y:20}];
 renderer.readRenderTargetPixels=(t,x,y,w,h,p)=>{renderer.reads++;for(let i=0;i<w*h;i++)p[i*4]=16;};
 const mask=createCharacterOcclusion(THREE,renderer,[root],[e]);
 mask.update([e],view,camera);assert.equal(mask.coverage(e),.5);
 mask.update([e],view,camera);assert.equal(mask.coverage(e),.5);assert.equal(renderer.reads,1);
 renderer.readRenderTargetPixels=(t,x,y,w,h,p)=>{for(let i=0;i<w*h;i++)p[i*4]=i%2?16:0;};
 camera.matrixWorld.elements[12]=1;mask.update([e],view,camera);assert.equal(mask.coverage(e),.25);
 mask.update([],view,camera);assert.equal(mask.coverage(e),0);mask.dispose();
});
