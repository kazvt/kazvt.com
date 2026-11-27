import test from 'node:test';
import assert from 'node:assert/strict';
import {signMaskBytes,SIGN_BULB_COUNT} from './sign-glow-mask.mjs';
import {signPhase,createSignGlow} from './sign-glow.mjs';
import {installStageLighting} from './stage-show.mjs';

test('exact ten-second cycle with consecutive disjoint letter and bulb phases and five seconds of idle',()=>{
 for(let t=0;t<10000;t++){
  const p=signPhase(t);assert.deepEqual(p,signPhase(t+10000));
  if(t<2800){assert.ok(p.letter>=0&&p.letter<12);assert.equal(p.bulb,-100);}
  else if(t<5000){assert.equal(p.letter,-100);assert.ok(p.bulb>=0&&p.bulb<SIGN_BULB_COUNT+3);}
  else assert.deepEqual(p,{letter:-100,bulb:-100});
  assert.deepEqual(signPhase(t,true),{letter:-100,bulb:-100});
 }
});
test('mask labels all twelve glyphs and only the visible authored bulbs in clockwise order',()=>{
 const bytes=signMaskBytes();assert.equal(bytes.length,128*32*4);assert.equal(SIGN_BULB_COUNT,39);
 const pixels=Array.from({length:4096},(_,i)=>bytes[i*4]);
 assert.equal(pixels.filter(v=>v>0&&v<13).length,901);assert.equal(pixels.filter(v=>v>=32).length,100);
 for(let i=0;i<12;i++)assert.ok(pixels.includes(i+1));
 let prior=-1;
 for(let i=0;i<SIGN_BULB_COUNT;i++){
  const coords=pixels.flatMap((v,j)=>v===32+i?[[j%128,Math.floor(j/128)]]:[]);assert.ok(coords.length>=1&&coords.length<=4);
  const [x,y]=coords[0];assert.ok(y===3||y===4||y===18||y===19);const order=y<10?x:256-x;assert.ok(order>prior);prior=order;
 }
 assert.ok(pixels.slice(128*24).every(v=>v===0));assert.ok(pixels.every((v,i)=>!v||i%128<114));
});
test('sign shader coexists with theatrical lighting and does not upload or change base texture on frame updates',()=>{
 class Texture{constructor(bytes,w,h){Object.assign(this,{bytes,w,h});}dispose(){this.disposed=true;}}
 const THREE={DataTexture:Texture,RGBAFormat:1,NearestFilter:1};
 const material=(width,height)=>({isMeshBasicMaterial:true,map:{image:{width,height},version:17},onBeforeCompile(){},customProgramCacheKey(){return 'base';}});
 const sign=material(128,32),other=material(64,64),root={traverse(fn){fn({isMesh:true,material:sign});fn({isMesh:true,material:other});}};
 const fx=createSignGlow(THREE,root);installStageLighting(THREE,[root],{rgShow:{value:0}});
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <opaque_fragment>'};
 sign.onBeforeCompile(shader);assert.match(shader.fragmentShader,/rgSignLight\(vMapUv,outgoingLight\)/);assert.match(shader.fragmentShader,/outgoingLight\*=mix/);assert.ok(shader.fragmentShader.indexOf('outgoingLight=rgSignLight')<shader.fragmentShader.indexOf('outgoingLight*=mix'));
 assert.match(sign.customProgramCacheKey(),/rg-sign-glow-v1.*rg-theatre-v1/);assert.doesNotMatch(other.customProgramCacheKey(),/rg-sign-glow/);
 const mask=shader.uniforms.rgSignMask.value;assert.equal(mask.w,128);assert.equal(mask.h,32);assert.equal(mask.flipY,false);
 fx.update(0,true,false);for(let t=100;t<=5000;t+=100)fx.update(t,true,false);assert.equal(shader.uniforms.rgSignLetter.value,-100);assert.equal(shader.uniforms.rgSignBulb.value,-100);
 fx.update(5200,true,true);assert.equal(shader.uniforms.rgSignLetter.value,-100);fx.update(5300,false,false);assert.equal(shader.uniforms.rgSignBulb.value,-100);assert.equal(sign.map.version,17);fx.dispose();assert.equal(mask.disposed,true);
});
