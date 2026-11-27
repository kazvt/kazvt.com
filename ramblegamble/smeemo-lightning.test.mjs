import test from 'node:test';
import assert from 'node:assert/strict';
import {createLightningStrike,sampleLightningStrike,paintLightning,createLightningLayer} from './smeemo-lightning.mjs';
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('each strike is a connected branching bolt with varied silhouettes, color, sparks and bounded endpoints',()=>{
 const random=rng(91),seen=new Set();let prior;
 for(let i=0;i<1000;i++){
  const kind=i%10===0?'start':i%10===9?'win':'reveal';
  const strike=createLightningStrike({kind,count:i%10},12,{x:(i%20)/19,y:(i%11)/10},random,i);
  assert.equal(strike.trunk.length,33);assert.equal(strike.trunk.at(-1),strike.hit);
  assert.ok(strike.hit.x>=.08&&strike.hit.x<=.92&&strike.hit.y>=.59&&strike.hit.y<=.94);
  assert.ok(strike.forks.length>=7&&strike.forks.length<=11);
  assert.ok(strike.sparks.length>=22&&strike.sparks.length<=40);
  assert.ok(strike.forks.every(f=>f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
  assert.notDeepEqual(strike.palette,prior);prior=strike.palette;
  seen.add(JSON.stringify(strike.trunk));
 }
 assert.equal(seen.size,1000);
});
test('travel, glow and core form a single bounded rise and decay, no recurrent flashes',()=>{
 for(const kind of ['start','reveal','win']){
  const s=createLightningStrike({kind,count:5},100,{x:.5,y:.85},rng(12),1);
  assert.equal(sampleLightningStrike(s,99),null);assert.equal(sampleLightningStrike(s,100+s.duration),null);
  let progress=0,previous={core:0,glow:0},falling={core:false,glow:false};
  for(let t=100;t<100+s.duration;t++){
   const sample=sampleLightningStrike(s,t);assert.ok(sample.progress>=progress);progress=sample.progress;
   for(const k of ['core','glow']){
    assert.ok(sample[k]>=0&&sample[k]<=1);
    if(sample[k]<previous[k]-1e-8)falling[k]=true;
    if(falling[k])assert.ok(sample[k]<=previous[k]+1e-8);
   }
   previous=sample;
  }
  assert.ok(previous.glow<.001);assert.equal(progress,1);
 }
});
function fakeContext(){const calls=[];const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get(o,k){return k in o?o[k]:(...args)=>calls.push([k,...args]);},set(o,k,v){assert.ok(typeof v!=='number'||Number.isFinite(v));if(k==='globalAlpha')assert.ok(v>=0&&v<=1);o[k]=v;return true;}});return {ctx,calls};}
test('renderer draws finite connected paths, sparks and impact ellipse across viewport sizes',()=>{
 const s=createLightningStrike({kind:'win',count:9},0,{x:.65,y:.8},rng(1),2);
 for(const [w,h] of [[320,240],[390,844],[1366,768],[3440,1440],[7680,4320]]){
  const {ctx,calls}=fakeContext();paintLightning(ctx,w,h,[sampleLightningStrike(s,200)]);
  assert.ok(calls.some(([op])=>op==='ellipse'));assert.ok(calls.filter(([op])=>op==='stroke').length>30);
  assert.ok(calls.every(([, ...args])=>args.every(a=>typeof a!=='number'||Number.isFinite(a))));
  assert.equal(calls.filter(([op])=>op==='save').length,calls.filter(([op])=>op==='restore').length);
 }
});
test('one inert reusable canvas; resolution is capped and clear is idempotent',()=>{
 const {ctx,calls}=fakeContext();const attributes={};const canvas={getContext:()=>ctx,setAttribute:(k,v)=>attributes[k]=v};let children=[];
 const layer=createLightningLayer({ownerDocument:{createElement:()=>canvas},append:c=>children.push(c)});
 assert.equal(children.length,1);assert.equal(attributes['aria-hidden'],'true');assert.equal(canvas.hidden,true);
 const s=createLightningStrike({kind:'start',count:0},0,{x:.5,y:.85},rng(1));
 layer.paint([sampleLightningStrike(s,200)],7680,4320);assert.equal(canvas.hidden,false);assert.ok(canvas.width*canvas.height<=902000);
 layer.clear();assert.equal(canvas.hidden,true);const size=calls.length;layer.clear();assert.equal(calls.length,size);
});
test('unavailable canvas context is a harmless visual-only degradation',()=>{
 const canvas={getContext:()=>{throw new Error('context unavailable');},setAttribute(){}};
 const layer=createLightningLayer({ownerDocument:{createElement:()=>canvas},append(){}});
 const s=createLightningStrike({kind:'start',count:0},0,{x:.5,y:.85},rng(1));
 assert.doesNotThrow(()=>layer.paint([sampleLightningStrike(s,200)],1200,800));assert.equal(canvas.hidden,true);assert.doesNotThrow(()=>layer.clear());
});
