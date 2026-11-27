import test from 'node:test';
import assert from 'node:assert/strict';
import { cabinetPose, createStageShowState, REVEAL_MS, RETRACT_MS, LIGHT_RELEASE_MS } from './stage-show-state.mjs';
const point={x:10,y:1,z:-4};
const SMEEMO_RETURN_MS_FOR_TEST=4400;
function setup(){const events=[];return {events,s:createStageShowState({cue:x=>events.push(x)})};}
test('curtains start first, fully open and restore exact cabinet position on reveal and hide',()=>{
 const {s,events}=setup();assert.deepEqual(cabinetPose(0),{curtain:0,travel:0});assert.deepEqual(cabinetPose(1),{curtain:1,travel:1});
 assert.ok(s.cabinet(true,0));s.begin(point,0,'slot');assert.ok(!s.cabinet(true,20));
 const early=s.step(800);assert.ok(early.curtain>0);assert.equal(early.travel,0);
 for(let t=900;t<REVEAL_MS;t+=17){const f=s.step(t);assert.ok(f.curtain>=f.travel);assert.ok(f.busy);}
 const end=s.step(REVEAL_MS);assert.equal(end.travel,1);assert.equal(end.curtain,1);assert.equal(end.busy,false);assert.equal(end.phase,'reveal');
 s.step(10000);assert.equal(events.filter(x=>x==='reveal').length,1);assert.equal(s.step(10001).strength,0);
 s.cabinet(false,11000);s.hide(point,11000);const closing=s.step(12000);assert.ok(closing.curtain>closing.travel);const closed=s.step(11000+RETRACT_MS);assert.equal(closed.travel,0);assert.equal(closed.curtain,0);assert.equal(closed.strength,0);assert.equal(events.filter(x=>x==='hide').length,1);
});
test('reversing an interrupted curtain keeps the exact pose and never triggers stale reveal',()=>{
 const {s,events}=setup();s.cabinet(true,0);s.begin(point,0,'slot');const before=s.step(1630);s.cabinet(false,1630);s.hide(point,1630);const after=s.step(1630);for(const key of ['curtain','travel','strength'])assert.equal(after[key],before[key]);
 s.step(1630+RETRACT_MS);s.step(10000);assert.equal(events.filter(x=>x==='reveal').length,0);assert.equal(s.open,false);
});
test('manual light holds indefinitely and same-target click fades it away exactly once',()=>{
 const {s,events}=setup();s.toggle(point,0);assert.equal(s.step(3000).phase,'roll');assert.equal(s.step(REVEAL_MS).phase,'reveal');assert.equal(s.step(86400000).strength,1);assert.ok(s.toggle({...point,x:10.2},86400001));assert.equal(s.step(86400001).strength,1);assert.equal(s.step(86400001+LIGHT_RELEASE_MS).strength,0);assert.equal(s.owner,null);assert.equal(events.filter(x=>x==='reveal').length,1);assert.equal(events.filter(x=>x==='hide').length,0);
});
test('retarget cancels old roll, keeps darkness continuous, reveals new target only',()=>{
 const {s,events}=setup();s.toggle(point,0);const a=s.step(1200);const next={x:2,y:0,z:3};s.toggle(next,1200);assert.equal(s.step(1200).strength,a.strength);assert.equal(s.step(4000).phase,'roll');const b=s.step(5200);assert.deepEqual(b.target,next);assert.equal(b.phase,'reveal');assert.equal(events.filter(x=>x==='reveal').length,1);s.reset(true);assert.equal(s.step(100000).strength,0);assert.equal(s.step(100001).travel,1);
});
test('instant reduced motion and visibility reset do not emit late cues or leave lighting on',()=>{
 const {s,events}=setup();assert.equal(s.cabinet(true,0,true),false);assert.equal(s.step(0).travel,1);assert.equal(s.toggle(point,1,true),false);s.cabinet(false,2);s.hide(point,2);s.reset(false);const f=s.step(99999);assert.equal(f.travel,0);assert.equal(f.phase,'off');assert.equal(f.busy,false);assert.equal(events.filter(x=>x==='reveal').length,0);
});


test('clearLight hard-cuts a silent spotlight to full darkness with no transition tail',()=>{
 const {s,events}=setup();s.begin(point,0,'silent');const lit=s.step(REVEAL_MS);assert.equal(lit.strength,1);assert.equal(lit.owner,'silent');
 s.clearLight();const dark=s.step(REVEAL_MS+1);assert.equal(dark.strength,0);assert.equal(dark.phase,'off');assert.equal(dark.target,null);assert.equal(dark.owner,null);
 const later=s.step(REVEAL_MS+SMEEMO_RETURN_MS_FOR_TEST);assert.equal(later.strength,0);assert.equal(later.phase,'off');assert.equal(events.includes('reveal'),false);
});
