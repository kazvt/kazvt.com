import test from 'node:test';
import assert from 'node:assert/strict';
import { createFocusOrbit, orbitPosition, focusLimits, bindFocusDrag } from './focus-orbit.mjs';
const radius=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
test('orbit clamps both axes per focus, preserves distance and resets on view change',()=>{
 for(const kind of ['overview','roulette','slot','card-table','dice-door','dice','trivia','host','contestants']){
 const orbit=createFocusOrbit();orbit.reset(kind);orbit.nudge(100,-100);const angles=orbit.step(0,true);const [yaw,pitch]=focusLimits(kind);assert.ok(Math.abs(angles.yaw-yaw)<1e-12);assert.ok(Math.abs(angles.pitch+pitch)<1e-12);const base={x:1,y:4,z:8},target={x:-1,y:2,z:3};const next=orbitPosition(base,target,angles.yaw,angles.pitch);assert.ok(Math.abs(radius(base,target)-radius(next,target))<1e-10);assert.deepEqual(orbitPosition(base,target,0,0),base);orbit.reset('overview');assert.deepEqual(orbit.step(1,true),{yaw:0,pitch:0,moving:false});}
});
test('damping is time-based, monotonic and never exceeds the cap',()=>{
 const orbit=createFocusOrbit();orbit.reset('slot');orbit.step(0);orbit.nudge(.02,-.01);let prev=0;for(let t=16;t<2000;t+=16){const a=orbit.step(t);assert.ok(a.yaw>=prev&&a.yaw<=.02+1e-12);prev=a.yaw;assert.ok(a.pitch>=-.01-1e-12&&a.pitch<=0);}assert.equal(orbit.step(2000).moving,false);
});
test('pointer drag threshold preserves ordinary clicks and suppresses click after actual drag',()=>{
 const handlers={};const surface={addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture(){}};let enabled=true;const moves=[];const drag=bindFocusDrag(surface,{enabled:()=>enabled,move:(x,y)=>moves.push([x,y])});const emit=(name,x,y,over={})=>handlers[name]({button:0,buttons:1,pointerId:1,clientX:x,clientY:y,...over});
 emit('pointerdown',10,10);emit('pointermove',13,10);emit('pointerup',13,10);assert.equal(drag.consumeClick(),false);assert.equal(moves.length,0);
 emit('pointerdown',10,10);emit('pointermove',30,25);emit('pointerup',30,25);assert.equal(drag.consumeClick(),true);assert.equal(drag.consumeClick(),false);assert.deepEqual(moves[0],[-20*.0007,15*.0007]);
 enabled=false;emit('pointerdown',10,10);emit('pointermove',40,40);assert.equal(drag.consumeClick(),false);assert.equal(moves.length,1);
});
