import test from 'node:test';
import assert from 'node:assert/strict';
import { createSmeemoImpact, sampleSmeemoImpact, smeemoImpactSpec, smeemoImpactTransition } from './smeemo-impact.mjs';

test('motion bounded, continuous and exactly settles, no exposed screen edges',()=>{
  const p=[{at:100,...smeemoImpactSpec('start')},{at:240,...smeemoImpactSpec('reveal',5)},{at:315,...smeemoImpactSpec('win',9)}];
  for(const [w,h] of [[320,240],[390,740],[1366,668],[1920,1080]]){
    let previous=sampleSmeemoImpact(p,0,w,h);
    for(let t=1;t<=1600;t++){
      const s=sampleSmeemoImpact(p,t,w,h);
      assert.ok(s.energy>=0&&s.energy<=1);assert.ok(Math.abs(s.x)<=10&&Math.abs(s.y)<=6.5);
      assert.ok((s.scale-1)*w/2+1e-9>=Math.abs(s.x));assert.ok((s.scale-1)*h/2+1e-9>=Math.abs(s.y));
      assert.ok(s.uiScale<=1.012 && Math.abs(s.uiX)<=1.5 && Math.abs(s.uiY)<=1.235);
      assert.ok(Math.abs(previous.x-s.x)<1&&Math.abs(previous.y-s.y)<1);previous=s;
    }
    assert.equal(previous.scale,1);assert.equal(previous.uiScale,1);assert.equal(previous.energy,0);
  }
});
test('pitch rises each reveal and winning accent is higher than normal reveal',()=>{
  let prior=smeemoImpactSpec('start').rate;
  for(let count=1;count<=9;count++){const spec=smeemoImpactSpec('reveal',count);assert.ok(spec.rate>prior);prior=spec.rate;assert.ok(smeemoImpactSpec('win',count).rate>spec.rate);}
  assert.ok(smeemoImpactSpec('win',9).rate*1.12<2);
});
test('transitions reject phase-only, duplicate, replaced, and already-restored rounds',()=>{
  const a={id:'1',draws:[]}, b={id:'1',draws:[{id:'a',smeemo:false}]}, c={id:'1',draws:[...b.draws,{id:'b',smeemo:true}]};
  assert.deepEqual(smeemoImpactTransition(null,a,true),{kind:'start',count:0});
  assert.equal(smeemoImpactTransition(a,a,true),null);assert.equal(smeemoImpactTransition(null,a,false),null);
  assert.deepEqual(smeemoImpactTransition(a,b,false),{kind:'reveal',count:1});assert.deepEqual(smeemoImpactTransition(b,c,false),{kind:'win',count:2});
  assert.equal(smeemoImpactTransition(c,b,false),null);assert.equal(smeemoImpactTransition(b,{...c,draws:[{id:'z'},...c.draws]},false),null);
  assert.equal(smeemoImpactTransition(null,c,true),null);
});
function fixture(){let t=0,visible=false,allowed=true,reduced=false,id=0,queue=new Map(),sounds=[],paints=[],clears=0,stops=0;
  const controller=createSmeemoImpact({requestFrame:f=>{queue.set(++id,f);return id},cancelFrame:i=>queue.delete(i),now:()=>t,canRun:()=>allowed,isVisible:()=>visible,reduced:()=>reduced,size:()=>({width:1366,height:668}),paint:s=>paints.push(s),clear:()=>clears++,sound:(e,s)=>sounds.push([e,s]),stopSound:()=>stops++});
  return {controller,sounds,paints,get clears(){return clears},get stops(){return stops},get pending(){return queue.size},visible:v=>visible=v,allowed:v=>allowed=v,reduced:v=>reduced=v,step:(n=16)=>{t+=n;const work=[...queue.values()];queue.clear();for(const f of work)f(t);}};
}
test('start waits for table, each rapid reveal restarts sound and stays in one RAF loop',()=>{
  const f=fixture();f.controller.trigger({kind:'start',count:0});f.step(500);assert.equal(f.sounds.length,0);
  f.visible(true);f.step();assert.equal(f.sounds.length,1);f.step(100);assert.ok(f.paints.at(-1).energy>0);
  for(let count=1;count<=8;count++){f.controller.trigger({kind:'reveal',count});assert.equal(f.pending,1);f.step(25);assert.ok(f.paints.at(-1).energy<=1);}
  assert.equal(f.sounds.length,9);f.step(5100);assert.equal(f.pending,0);assert.ok(f.clears>0);
});
test('offtable, hide, lock and reduced motion clean up, never replay on re-entry',()=>{
  const f=fixture();f.controller.trigger({kind:'start',count:0});f.step(3300);assert.equal(f.sounds.length,0);assert.equal(f.pending,0);
  f.visible(true);f.controller.trigger({kind:'start',count:0});f.step();f.step(150);f.visible(false);f.step();assert.equal(f.pending,0);assert.ok(f.stops>0);
  f.visible(true);f.reduced(true);f.paints.length=0;f.controller.trigger({kind:'win',count:3});f.step();assert.equal(f.paints.length,0);assert.equal(f.sounds.at(-1)[0].kind,'win');
  f.allowed(false);f.step();assert.equal(f.pending,0);f.allowed(true);f.step();assert.equal(f.sounds.length,2);
  f.controller.trigger({kind:'reveal',count:4});f.controller.stop();assert.equal(f.pending,0);
});
test('each visible accepted event produces a distinct bounded strike, and reduced-motion/exit remove it',()=>{
 const f=fixture();f.visible(true);f.controller.trigger({kind:'start',count:0});f.step(140);
 const first=f.paints.at(-1).lightning[0].strike;assert.equal(first.trunk.length,33);
 for(let count=1;count<=8;count++){
  f.controller.trigger({kind:'reveal',count});f.step(25);
  const strikes=f.paints.at(-1).lightning;assert.ok(strikes.length<=3);assert.equal(strikes.at(-1).strike.accent,.30);assert.notDeepEqual(strikes.at(-1).strike.trunk,first.trunk);
 }
 f.reduced(true);f.step();assert.ok(f.clears>0);f.visible(false);f.step();assert.equal(f.pending,0);
});
test('rapid restart cannot bypass the bright-accent gate; later strike regains full accent',()=>{
 const f=fixture();f.visible(true);f.controller.trigger({kind:'start',count:0});f.step(10);assert.equal(f.paints.at(-1).lightning[0].strike.accent,1);
 f.controller.stop();f.controller.trigger({kind:'start',count:0});f.step(10);assert.equal(f.paints.at(-1).lightning[0].strike.accent,.30);
 f.step(410);f.controller.trigger({kind:'reveal',count:1});f.step(10);assert.equal(f.paints.at(-1).lightning.at(-1).strike.accent,1);
});
