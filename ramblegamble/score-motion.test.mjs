import test from 'node:test';
import assert from 'node:assert/strict';
import {balanceDuration,balanceFrame,balanceLayout,balanceParticles,SCORE_FORMAT} from './score-motion.mjs';
import {characterRenderPose} from './character-selection.mjs';
import {sampleTrim,TRIM_PATHS} from './room-light-trim.mjs';

test('balance animation stays integral, monotonic, safe and exactly reaches committed target',()=>{
 for(const [a,b] of [[0,1],[179900,1021000],[1021000,0],[0,Number.MAX_SAFE_INTEGER],[Number.MAX_SAFE_INTEGER,0],[Number.MAX_SAFE_INTEGER-1,Number.MAX_SAFE_INTEGER]]){
  for(const kind of ['points','stars']){
   const duration=balanceDuration(b-a,kind);let previous=a;
   assert.ok(duration>0&&duration<=1050);
   for(let elapsed=0;elapsed<=duration;elapsed+=5){const n=balanceFrame(a,b,elapsed,duration);assert.ok(Number.isSafeInteger(n));assert.ok(n>=Math.min(a,b)&&n<=Math.max(a,b));assert.ok(b>=a?n>=previous:n<=previous);previous=n;}
   assert.equal(balanceFrame(a,b,duration,duration),b);
   assert.equal(balanceFrame(a,b,0,0),b);
  }
 }
});
test('inline layout budgets both icon and exact numeric widths on narrow and wide lanes',()=>{
 for(const width of [68,94,108,140,162,184,240,360,442])for(const n of [0,1,999,1000,1021000,Number.MAX_SAFE_INTEGER])for(const stars of [0,3,Number.MAX_SAFE_INTEGER]){
  const f=balanceLayout(width,n,stars);assert.ok(f.font>0&&f.font<=16);assert.equal(f.p,SCORE_FORMAT.format(n).length);assert.equal(f.s,SCORE_FORMAT.format(stars).length);
  assert.ok((f.p+f.s)*f.font*.62+14+2*f.icon+3*f.gap+5<=width+.1);
 }
});
test('bounded particle counts and distinct star choreography',()=>{for(const n of [1,5,10000,Number.MAX_SAFE_INTEGER]){assert.ok(balanceParticles('stars',n)<=9);assert.ok(balanceParticles('points',-n)<=8);}assert.ok(balanceDuration(1,'stars')>balanceDuration(1,'points'));});
test('idle and score reactions preserve feet when stationary, lift only on positive award, preserve seated and reduced pose',()=>{
 const entry={id:'faroe',anchor:{x:1,y:2,z:3},worldHeight:1.8,worldWidth:1.8};
 const foot=entry.anchor.y-entry.worldHeight/2;
 for(const delta of [-1,0,1])for(let t=0;t<800;t+=7){const p=characterRenderPose(entry,Infinity,false,{time:t,reactAge:t,delta});assert.ok(Math.abs(p.worldWidth*p.worldHeight-3.24)<1e-9);assert.ok(p.anchor.y-p.worldHeight/2>=foot-1e-9);assert.ok(p.anchor.y-p.worldHeight/2<=foot+.058);if(delta<=0)assert.ok(Math.abs(p.anchor.y-p.worldHeight/2-foot)<1e-9);assert.deepEqual(characterRenderPose(entry,0,true,{time:t,reactAge:t,delta}),characterRenderPose(entry,Infinity));assert.deepEqual(characterRenderPose({...entry,seated:true},0,false,{time:t,reactAge:t,delta}),characterRenderPose(entry,Infinity));}
});
test('architectural lighting is bounded, continuous, stronger only in focus and static for reduced motion',()=>{
 assert.equal(TRIM_PATHS.reduce((n,p)=>n+p.count,0),76);
 for(let t=0;t<14000;t+=35)for(let i=0;i<30;i++){const x=sampleTrim(i,30,t),y=sampleTrim(i,30,t,true);assert.ok(x>=.24&&x<=.71);assert.ok(y>=.24&&y<=.92);assert.equal(sampleTrim(i,30,t,true,true),.38);}
});
