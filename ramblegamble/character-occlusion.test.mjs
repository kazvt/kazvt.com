import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacterOcclusion,maskSize,maskBounds,maskPixel,isDepthOccluder,CHARACTER_BITS} from './character-occlusion.mjs';

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
 assert.deepEqual(maskSize(1920,1080),[960,540]);assert.deepEqual(maskSize(480,800),[480,800]);assert.deepEqual(maskSize(1,0),[1,1]);assert.equal(CHARACTER_BITS.reduce((a,b)=>a+b),240);
 const p=new Uint8Array(2*2*4);p[0]=16;p[12]=32;assert.equal(maskPixel(p,2,2,16,0,1),true);assert.equal(maskPixel(p,2,2,32,1,0),true);assert.equal(maskPixel(p,2,2,32,-1,0),false);
 assert.deepEqual(maskBounds([{x:-10,y:-5},{x:20,y:12}],8,6,{width:16,height:12}),{left:0,top:0,right:8,bottom:6});
 for(const key of ['visible','colorWrite','depthTest','depthWrite'])assert.equal(isDepthOccluder({[key]:false}),false);assert.equal(isDepthOccluder({transparent:true}),false);assert.equal(isDepthOccluder({alphaTest:.5}),true);
});
test('independent character masks, cached occlusion, geometry changes and fail-closed readback',()=>{
 const old=globalThis.document;const canvases=[];globalThis.document={createElement(){const c={getContext(){return {createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(image){c.data=image.data;}};},toDataURL(){return 'data:image/png;base64,mask';}};canvases.push(c);return c;}};
 try{const f=makeFixture(),{renderer,entries,camera,view,root,opaque}=f;const mask=createCharacterOcclusion(THREE,renderer,[root],entries);
 mask.update(entries,view,camera);assert.equal(renderer.reads,1);assert.equal(renderer.rendered.children.length,3);assert.equal(renderer.rendered.children[0].material.alphaTest,.5);assert.equal(renderer.rendered.children[0].material.colorWrite,false);assert.equal(renderer.target,f.originalTarget);assert.equal(renderer.alpha,.7);assert.equal(renderer.color,123);assert.equal(renderer.autoClear,true);
 assert.equal(mask.contains(entries[0],1,2),false);assert.equal(mask.contains(entries[0],6,2),true);assert.equal(mask.contains(entries[1],1,2),true);assert.equal(canvases[0].data[3],0);assert.equal(canvases[0].data[4*6+3],255);assert.equal(entries[0].panel.parentElement.style.maskSize,'8px 6px');
 mask.update(entries,view,camera);assert.equal(renderer.reads,1);opaque.geometry.attributes.position.version++;mask.update(entries,view,camera);assert.equal(renderer.reads,2);
 opaque.material.map.version++;mask.update(entries,view,camera);assert.equal(renderer.reads,3);mask.update([entries[1]],view,camera);assert.equal(entries[0].panel.style.visibility,'hidden');assert.equal(mask.contains(entries[0],6,2),false);
 renderer.empty=true;mask.invalidate();mask.update(entries,view,camera);assert.equal(entries[1].panel.style.visibility,'hidden');assert.equal(mask.contains(entries[1],1,2),false);
 renderer.fail=true;mask.invalidate();assert.throws(()=>mask.update(entries,view,camera),/read failed/);assert.equal(renderer.target,f.originalTarget);assert.equal(renderer.alpha,.7);assert.equal(renderer.autoClear,true);mask.dispose();
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
