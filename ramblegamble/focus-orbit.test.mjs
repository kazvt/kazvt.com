import test from 'node:test';
import assert from 'node:assert/strict';
import { createFocusOrbit, orbitPosition, focusLimits, bindFocusDrag, focusPointerTarget } from './focus-orbit.mjs';
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

test('cursor mapping uses actual viewport center and clamps to exactly twice the previous angular ranges',()=>{
 const rect={left:100,top:50,width:800,height:400};
 assert.deepEqual(focusPointerTarget(rect,500,250),[0,0]);
 assert.deepEqual(focusPointerTarget(rect,900,50),[1,1]);
 assert.deepEqual(focusPointerTarget(rect,-100,999),[-1,-1]);
 assert.equal(focusPointerTarget({...rect,width:0},500,250),null);
 assert.equal(focusPointerTarget(rect,NaN,250),null);
 const orbit=createFocusOrbit();
 for(const [kind,old] of Object.entries({overview:[0,0],slot:[.024,.017],'dice-door':[.032,.022],trivia:[.032,.022],dice:[.045,.032],roulette:[.045,.032],'card-table':[.045,.032],contestant:[.045,.032]})){
  orbit.reset(kind);assert.deepEqual(focusLimits(kind),old.map(v=>2*v));
  for(let i=0;i<100;i++)orbit.follow(.5,-.25);
  const a=orbit.step(0,true);assert.equal(a.yaw,old[0]);assert.equal(a.pitch,-old[1]/2 || 0);
  orbit.follow(10,-10);const b=orbit.step(1,true);assert.equal(b.yaw,old[0]*2);assert.equal(b.pitch,-old[1]*2 || 0);
 }
});
function inputSurface(){const callbacks={};return {addEventListener(name,fn){(callbacks[name]??=[]).push(fn);},getBoundingClientRect(){return {left:0,top:0,width:800,height:400};},setPointerCapture(){},emit(name,over={}){const event={pointerId:1,isPrimary:true,pointerType:'mouse',buttons:0,button:0,clientX:800,clientY:0,target:{},...over};for(const fn of callbacks[name]||[])fn(event);}};}
test('passive mouse/pen motion, recenter, control freeze and reduced motion do not create clicks or drift',()=>{
 const surface=inputSurface(),orbit=createFocusOrbit();orbit.reset('dice');let allowed=true;const binding=bindFocusDrag(surface,{enabled:()=>true,hoverEnabled:()=>allowed,follow:(x,y)=>orbit.follow(x,y),hold:()=>orbit.hold(),move:(x,y)=>orbit.nudge(x,y)});
 surface.emit('pointermove',{pointerType:'touch'});assert.equal(orbit.step(0,true).yaw,0);
 surface.emit('pointermove',{isPrimary:false});assert.equal(orbit.step(1,true).yaw,0);
 surface.emit('pointermove');assert.deepEqual(orbit.step(2,true),{yaw:.09,pitch:.064,moving:false});assert.equal(binding.consumeClick(),false);
 surface.emit('pointermove',{pointerType:'pen',clientX:0,clientY:400});assert.deepEqual(orbit.step(3,true),{yaw:-.09,pitch:-.064,moving:false});
 surface.emit('pointermove',{clientX:800,clientY:0});const inFlight=orbit.step(19);
 allowed=false;surface.emit('pointerover');assert.deepEqual(orbit.step(100,true),{...inFlight,moving:false});
 surface.emit('pointermove',{clientX:400,clientY:200});assert.equal(orbit.step(101,true).yaw,inFlight.yaw);
 surface.emit('pointerleave');assert.deepEqual(orbit.step(102,true),{yaw:0,pitch:0,moving:false});
 surface.emit('pointermove');assert.equal(orbit.step(103,true).yaw,0);
 allowed=true;surface.emit('pointermove');orbit.step(104,true);binding.clearHover();assert.equal(orbit.step(105,true).yaw,0);
});
test('hover-to-click preserves click; actual drag disowns hover and retains manual target; keyboard can take over',()=>{
 const surface=inputSurface(),orbit=createFocusOrbit();orbit.reset('roulette');const binding=bindFocusDrag(surface,{enabled:()=>true,follow:(x,y)=>orbit.follow(x,y),hold:()=>orbit.hold(),move:(x,y)=>orbit.nudge(x,y)});
 surface.emit('pointermove',{clientX:600,clientY:200});orbit.step(0,true);
 surface.emit('pointerdown',{buttons:1,clientX:600,clientY:200});surface.emit('pointerup',{clientX:600,clientY:200});assert.equal(binding.consumeClick(),false);
 surface.emit('pointerleave');assert.equal(orbit.step(1,true).yaw,0);
 surface.emit('pointermove',{clientX:400,clientY:200});orbit.step(2,true);
 surface.emit('pointerdown',{buttons:1,clientX:400,clientY:200});surface.emit('pointermove',{buttons:1,clientX:450,clientY:210});surface.emit('pointerup',{clientX:450,clientY:210});assert.equal(binding.consumeClick(),true);assert.equal(binding.consumeClick(),false);
 const manual=orbit.step(3,true);surface.emit('pointerleave');assert.deepEqual(orbit.step(4,true),manual);
 surface.emit('pointermove',{clientX:400,clientY:200});orbit.step(5,true);binding.stopFollowing();orbit.nudge(.012,0);surface.emit('pointerleave');assert.equal(orbit.step(6,true).yaw,.012);
});
test('settling at 30, 60 and 120Hz has the same frame-rate independent exponential response',()=>{
 const values=[30,60,120].map(hz=>{const orbit=createFocusOrbit();orbit.reset('roulette');orbit.step(0);orbit.follow(1,-1);for(let i=1;i<=hz/2;i++)orbit.step(i*1000/hz);return orbit.step(500);});
 for(const value of values){assert.ok(Math.abs(value.yaw-values[0].yaw)<1e-12);assert.ok(Math.abs(value.pitch-values[0].pitch)<1e-12);}
});
