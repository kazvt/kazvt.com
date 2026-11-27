import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFlight, bindHoldFreecam, FREECAM_SPEED, FREECAM_LOOK } from './hold-freecam.mjs';
const start={x:1,y:2,z:3}, forward={x:0,y:0,z:-1};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const keys=(...names)=>new Set(names.map(n=>'Key'+n));
test('flight moves relative to yaw, with Q/E independent of pitch and no roll',()=>{
 const flight=createFlight(start,forward);
 flight.move(keys('W'),.04);near(flight.pose().position.z,3-.04*FREECAM_SPEED);
 flight.move(keys('D'),.04);near(flight.pose().position.x,1+.04*FREECAM_SPEED);
 flight.look(Math.PI/2/FREECAM_LOOK, -Math.PI/4/FREECAM_LOOK);
 const before=flight.pose();near(before.direction.x,Math.SQRT1_2);near(before.direction.y,Math.SQRT1_2);
 flight.move(keys('W'),.04);near(flight.pose().position.x,before.position.x+.04*FREECAM_SPEED);near(flight.pose().position.y,before.position.y);
 flight.move(keys('Q'),.04);near(flight.pose().position.y,before.position.y-.04*FREECAM_SPEED);
 flight.move(keys('E'),.04);near(flight.pose().position.y,before.position.y);
 flight.look(0,-1e8);assert.ok(flight.pose().direction.y<1&&flight.pose().direction.y>.999);
 flight.look(0,1e8);assert.ok(flight.pose().direction.y> -1&&flight.pose().direction.y<-.999);
});
test('3-axis movement is frame-rate independent, normalized and safe on a stalled frame',()=>{
 for(const hz of [30,60,120,144]){
  const flight=createFlight(start,forward);for(let i=0;i<hz;i++)flight.move(keys('W','D','E'),1/hz);
  const p=flight.pose().position;near(Math.hypot(p.x-start.x,p.y-start.y,p.z-start.z),FREECAM_SPEED);
  near(p.x-start.x,p.y-start.y);near(p.x-start.x,start.z-p.z);
 }
 const f=createFlight(start,forward);f.move(keys('W','S','A','D','Q','E'),5);assert.deepEqual(f.pose().position,start);
 f.move(keys('W'),1e6);near(f.pose().position.z,3-.05*FREECAM_SPEED);
 f.move(keys('D'),NaN);f.look(NaN,Infinity);near(f.pose().position.x,1);
});
function fixture({failure=false,legacy=false,missing=false}={}) {
 let eligible=true,starts=0,stops=0,requests=0,exits=0,lastPose;
 function emitter(){const handlers={};return {addEventListener(t,f){(handlers[t]??=[]).push(f);},emit(t,extra={}){const e={button:1,buttons:4,pointerType:'mouse',target:surface,clientX:100,clientY:100,detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const h of handlers[t]||[]){h(e);if(e.stopped)break;}return e;}};}
 const win=emitter(),doc=emitter(),surface={focus(){},closest(){return null;}},viewport={contains:t=>t===surface||t===editor},editor={closest:()=>true};doc.pointerLockElement=null;
 doc.exitPointerLock=()=>{exits++;doc.pointerLockElement=null;};
 if(!missing)surface.requestPointerLock=()=>{requests++;if(failure)throw Error('denied');if(!legacy)return Promise.resolve();};
 const controller=bindHoldFreecam({surface,viewport,win,doc,eligible:()=>eligible,readPose:()=>({position:start,direction:forward}),writePose:p=>lastPose=p,onStart:()=>starts++,onStop:()=>stops++});
 return {win,doc,surface,editor,controller,disable:()=>eligible=false,stats:()=>({starts,stops,requests,exits,lastPose}),grant(){doc.pointerLockElement=surface;doc.emit('pointerlockchange');},key(k,extra={}){return win.emit('keydown',{key:k.toLowerCase(),code:'Key'+k,...extra});}};
}
test('middle hold captures flight keys and clicks; release returns control once and suppresses held repeats',()=>{
 const f=fixture();const {win,controller}=f;
 assert.equal(win.emit('mousedown').prevented,true);assert.equal(controller.active,true);f.grant();
 assert.equal(f.key('D').prevented,true);assert.equal(f.key('S').stopped,true);controller.step(0);controller.step(40);assert.ok(f.stats().lastPose.position.x>1);
 win.emit('mousedown',{button:0,buttons:5});assert.equal(win.emit('click',{button:0,buttons:4}).prevented,true);
 win.emit('mouseup',{button:1,buttons:1});assert.equal(controller.active,false);assert.equal(f.stats().stops,1);assert.equal(f.stats().exits,1);
 assert.equal(win.emit('click',{button:0,buttons:0}).prevented,true);assert.equal(win.emit('auxclick',{button:1,buttons:0}).prevented,true);
 assert.equal(f.key('D',{repeat:true}).prevented,true);assert.equal(f.key('S',{repeat:true}).stopped,true);
 win.emit('keyup',{code:'KeyD',key:'d'});assert.equal(f.key('D').prevented,undefined);
 win.emit('mousedown',{button:0,buttons:1});assert.equal(win.emit('click',{button:0,buttons:0}).prevented,undefined);
 controller.stop();assert.equal(f.stats().stops,1);
});
test('pending lock after release is immediately exited; never resurrect flight',()=>{
 const f=fixture({legacy:true});f.win.emit('mousedown');f.win.emit('mouseup',{buttons:0});f.grant();assert.equal(f.controller.active,false);assert.equal(f.stats().stops,1);assert.equal(f.stats().exits,1);
});
test('pointer lock failure or absence retains bounded mouse-look until release',()=>{
 for(const options of [{failure:true},{missing:true},{legacy:true}]){
 const f=fixture(options);f.win.emit('mousedown');f.doc.emit('pointerlockerror');f.win.emit('mousemove',{clientX:140,clientY:70});const p=f.stats().lastPose;assert.ok(p.direction.x>0&&p.direction.y>0);
 f.win.emit('mousemove',{buttons:0});assert.equal(f.controller.active,false);assert.equal(f.stats().stops,1);
 }
});
test('escape, lock loss, blur, hidden, pagehide, cancel, focus loss and blocked game state all exit',()=>{
 for(const end of [f=>f.win.emit('keydown',{key:'Escape',code:'Escape'}),f=>{f.doc.pointerLockElement=null;f.doc.emit('pointerlockchange');},f=>f.win.emit('blur'),f=>{f.doc.hidden=true;f.doc.emit('visibilitychange');},f=>f.win.emit('pagehide'),f=>f.win.emit('pointercancel'),f=>f.doc.emit('focusin',{target:f.editor}),f=>{f.disable();f.controller.step(0);},f=>f.win.emit('pointerup',{buttons:0})]){
  const f=fixture();f.win.emit('mousedown');f.grant();f.key('W');end(f);assert.equal(f.controller.active,false);assert.equal(f.stats().stops,1);const prior=f.stats().lastPose;f.controller.step(100);assert.equal(f.stats().lastPose,prior);
 }
});
test('normal controls, editable fields, other buttons and inactive room are not intercepted',()=>{
 const f=fixture();for(const extra of [{button:0,buttons:1},{button:2,buttons:2},{button:1,buttons:5},{target:f.editor},{target:{}}]){assert.equal(f.win.emit('mousedown',extra).prevented,undefined);assert.equal(f.controller.active,false);}
 f.disable();assert.equal(f.win.emit('mousedown').prevented,undefined);assert.equal(f.stats().starts,0);
});
test('room animation, resize, view transition, Dice and pause preserve the independent flight controller',()=>{
 const src=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 assert.match(src,/freecam\.step\(time\);\s+if \(!freecam.active\) updateCameraTransition/);
 assert.match(src,/const canOrbit = \(\) => !freecam.active/);
 assert.match(src,/if \(!sceneReady \|\| freecam\?\.active \|\| cameraDetached\) return;/);
 assert.match(src,/function transitionToView[^\n]+\n[^\n]+\n\s+const fromExterior = [^\n]+\n\s+freecam\?\.stop\(\)/);
 assert.match(src,/function showPauseMenu\(\) \{\s+if \(pauseMenuOpen\) return;\s+freecam\?\.stop\(\)/);
 assert.match(src,/if \(open\) \{ freecam\?\.stop\(\); resetEncounter\(\); stageShow\?\.reset\(currentView.kind==="slot"\); \}\s+diceModeOpen = open/);
 assert.match(src,/if \(!cardLayer \|\| freecam\?\.active \|\| cameraDetached\) return;/);
 assert.match(src,/if \(freecam\?\.active \|\| cameraDetached \|\| !slotControlLayer/);
});

import { runInNewContext } from 'node:vm';
test('production room wiring snapshots camera direction, suspends orbit and retains the released world pose on resize without changing activity',()=>{
 const src=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 const extract=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
 let callbacks,applied,position,lookAt,projection=0,draws=0,resize=0;const music=[];
 const currentView={kind:'card-table',look:0},classes=new Set();
 const ctx={resetEncounter(){},syncMusic(retry){music.push({detached:ctx.cameraDetached,retry});},stageShow:{busy:false},freecam:null,cameraDetached:false,gameStarted:true,sceneReady:true,pauseMenuOpen:false,diceModeOpen:false,document:{hidden:false,querySelector:()=>null,documentElement:{hasAttribute:()=>false}},
  camera:{position:{x:7,y:4,z:6,set(...v){position=v;}},aspect:1.2,getWorldDirection:()=>forward,lookAt:t=>lookAt=t.values,updateMatrixWorld(){},updateProjectionMatrix(){projection++;}},
  THREE:{Vector3:class{}},cameraTarget:{set(...v){this.values=v;}},canvas:{},preview:{clientWidth:1200,clientHeight:600,classList:{add:(...ks)=>ks.forEach(k=>classes.add(k)),remove:k=>classes.delete(k),contains:k=>classes.has(k)}},
  currentView,cameraTransition:{},focusDrag:{reset(){}},focusOrbit:{reset(){}},lastScenePointer:{},slotHoverCell:4,slotHoverLine:{},drawSlotReelDisplay(){draws++;},hideGameCursor(){},
  getCameraPoseForView:(view,aspect)=>({view,aspect}),applyCameraPose:p=>applied=p,
  updateCardTableProjection(){},updateSlotPlacementControlProjection(){},updateBillboardProjection(){},
  horrorRenderScale:()=>1,renderer:{getPixelRatio:()=>1,setPixelRatio(){},setSize(){resize++;}},window:{devicePixelRatio:1,addEventListener(){}},
  bindHoldFreecam:opts=>{callbacks=opts;return {active:false,stop(){}};}};
 runInNewContext(extract('  const canFreecam =','  const canOrbit =')+extract('  let lastHorrorScaleMode =','  function getCameraPoseForView(')+'\nthis.fit=fitCamera;',ctx);
 assert.equal(callbacks.eligible(),true);ctx.stageShow.busy=true;assert.equal(callbacks.eligible(),false);ctx.stageShow.busy=false;
 assert.deepEqual({...callbacks.readPose().position},{x:7,y:4,z:6});
 assert.equal(callbacks.readPose().direction,forward);
 ctx.freecam.active=true;callbacks.onStart();assert.equal(ctx.cameraTransition,null);assert.equal(ctx.slotHoverCell,-1);assert.equal(ctx.slotHoverLine,null);assert.equal(draws,1);assert.ok(classes.has('is-freecam'));
 callbacks.writePose({position:{x:5,y:9,z:8},direction:{x:0,y:0,z:-1}});assert.deepEqual(position,[5,9,8]);assert.deepEqual(lookAt,[5,9,7]);
 ctx.fit();assert.equal(ctx.camera.aspect,2);assert.equal(projection,1);assert.equal(resize,1);assert.equal(applied,undefined);
 ctx.freecam.active=false;callbacks.onStop();assert.equal(applied,undefined);assert.equal(ctx.cameraDetached,true);assert.ok(!classes.has('is-freecam'));assert.ok(classes.has('is-freecam-detached'));assert.equal(ctx.currentView,currentView);ctx.fit();assert.equal(applied,undefined);assert.deepEqual(position,[5,9,8]);assert.deepEqual(lookAt,[5,9,7]);
 assert.deepEqual(music,[{detached:true,retry:true},{detached:true,retry:undefined}]);
 ctx.diceModeOpen=true;assert.equal(callbacks.eligible(),false);
});
