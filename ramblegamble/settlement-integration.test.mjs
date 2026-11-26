import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as roulette from './roulette-ball-motion.mjs';
import { DICE_FACE_ORDER, DICE_ASSET_CYCLE } from './dice-game-state.mjs';
import { getUpwardFaceIndex } from './dice-roll-physics.mjs';
const scene = readFileSync(new URL('./ramblegamble.js', import.meta.url), 'utf8');
const dice = readFileSync(new URL('./dice-mode.js', import.meta.url), 'utf8');
const section = (source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function vec(x=0,y=0,z=0){return {x,y,z,set(x,y,z){Object.assign(this,{x,y,z});}};}
function audioLog(){const events=[];return {events,foley:{play(cue){events.push(['play',cue]);},start(channel,cue){events.push(['start',channel,cue]);},stop(channel){events.push(['stop',channel]);}}};}
function rouletteFixture({missing=false,reduced=false,prompt='Question?'}={}){
 const {events,foley}=audioLog(),turnEvents=[];let locked=false,clock=100;
 const ctx={crowdClock:0,showFX:{impact(){},clearRoulette(){}},crowdState:{react(){}},roomVisible:true,...roulette,foley,gameStarted:true,pauseMenuOpen:false,diceModeOpen:false,currentView:{kind:'roulette'},document:{hidden:false,documentElement:{hasAttribute:()=>locked}},
  performance:{now:()=>clock},reducedMotion:{matches:reduced},playing:false,wheelMotion:null,wheelPivot:{rotation:{y:0}},ballPivot:{rotation:{y:0}},ballOrbitObject:missing?null:{position:vec(-13,-7,1)},
  THREE:{MathUtils:{lerp:(a,b,t)=>a+(b-a)*t}},nextHostQuestion:()=>prompt,slotResultToken:0,slotResultTimeout:0,result:{},preview:{classList:{add(){},remove(){}}},syncSlotPlacementControls(){},window:{clearTimeout(){},dispatchEvent(event){turnEvents.push(event);}},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}};
 const methods=section(scene,'  function finishTurn(', '  function showSlotPayout(')+section(scene,'  function stopRouletteSettlement(', '  function prepareRouletteBall(')+section(scene,'  function suppressElapsedWheelCue(', '  document.addEventListener("visibilitychange"');
 const tick=section(scene,'    if (wheelMotion && wheelPivot && ballPivot && ballOrbitObject','    if (leverMotion && lever)');
 runInNewContext(`${methods}\nthis.start=startWheelSpin;this.tick=(time)=>{${tick}};this.suppress=suppressElapsedWheelCue`,ctx);
 return {ctx,events,turnEvents,setClock:t=>{clock=t;},lock:()=>{locked=true;},wins:()=>events.filter(e=>e[0]==='start'&&e[2]==='settlement')};
}
test('real roulette animation celebrates exactly once, only after final pocket height, angle and radius are committed',()=>{
 for(const reduced of [false,true])for(const prompt of ['','Question?']){
  const f=rouletteFixture({reduced,prompt});const c=f.ctx;c.start();const m=c.wheelMotion,end=m.started+m.duration;
  for(let t=m.started;t<end;t+=17)c.tick(t);assert.equal(f.wins().length,0);assert.equal(c.playing,true);
  c.tick(end);assert.equal(c.wheelMotion,null);assert.equal(c.playing,false);assert.equal(c.ballPivot.rotation.y,m.ballTo);assert.equal(c.wheelPivot.rotation.y,m.wheelTo);assert.equal(c.ballOrbitObject.position.y,roulette.ROULETTE_BALL_LANDING_HEIGHT);assert.ok(Math.abs(Math.hypot(c.ballOrbitObject.position.x,c.ballOrbitObject.position.z)-roulette.ROULETTE_BALL_LANDING_RADIUS)<1e-8);
  assert.equal(f.wins().length,1);assert.equal(c.result.textContent,prompt);assert.equal(f.turnEvents.filter(e=>e.type==='rg:turn-finish').length,1);assert.ok(f.events.find(e=>e[0]==='start'&&e[2]==='ball'));
  c.tick(end+100);assert.equal(f.wins().length,1);c.start();assert.ok(f.events.slice(-4).some(e=>e[0]==='stop'&&e[1]==='roulette-settlement'));
 }
});
test('no roulette celebration for fallback, locked, paused, hidden, away or off-screen completion; visible late frame still celebrates',()=>{
 for(const type of ['missing','locked','paused','hidden','away','dice','elapsed','foreground-late']){
  const f=rouletteFixture({missing:type==='missing'});const c=f.ctx;c.start();const end=c.wheelMotion.started+c.wheelMotion.duration;
  if(type==='locked')f.lock();if(type==='paused')c.pauseMenuOpen=true;if(type==='hidden')c.document.hidden=true;if(type==='away')c.currentView.kind='slot';if(type==='dice')c.diceModeOpen=true;
  if(type==='elapsed'){f.setClock(end+100);c.suppress();}
  c.tick(end+1000);assert.equal(c.playing,false);assert.equal(f.wins().length,type==='foreground-late'?1:0,type);
 }
 const f=rouletteFixture();f.ctx.start();f.setClock(f.ctx.wheelMotion.started+100);f.ctx.suppress();f.ctx.tick(f.ctx.wheelMotion.started+f.ctx.wheelMotion.duration);assert.equal(f.wins().length,1);
});
function node(){return {dataset:{},children:[],append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},setAttribute(){}};}
function diceFixture(){
 const {events,foley}=audioLog(),landed=[];const dieStates=Array.from({length:2},()=>({assignments:Array(6).fill('blank')}));
 const activeRolls=dieStates.map((dieState,i)=>{const position=vec(i,1,0),quaternion={x:0,y:0,z:0,w:1};return {dieState,body:{position,quaternion,interpolatedPosition:position,interpolatedQuaternion:quaternion,sleepState:0},group:{position:vec(),quaternion:{set(){}}}};});
 const ctx={audienceReact(){},foley,dieStates,activeRolls,rolling:true,physicsWorld:{},CANNON:{Body:{SLEEPING:2}},rollElapsed:0,lastFaces:null,pendingImpacts:new Map(),previousImpulses:new Map(),lastImpactAt:-Infinity,effects:{land(...args){landed.push(args);},impact(){},clear(){}},reducedMotion:{matches:false},getUpwardFaceIndex,DICE_FACE_ORDER,DICE_ASSET_CYCLE,stepDicePhysics(){},performance:{now:()=>0},previousFrameTime:0,rollButton:{disabled:true},status:node(),document:{createElement:node,createTextNode:s=>s,querySelectorAll:()=>[]},graphicsLost:false,prepareDiceBodyForThrow(){}};
 runInNewContext(`${section(dice,'  function setRollResults(', '  function startRoll(')}\n${section(dice,'  function updateRoll(', '  function render(')}\nthis.tick=updateRoll;this.finish=setRollResults`,ctx);
 return {ctx,events,landed,wins:()=>events.filter(e=>e[0]==='start'&&e[2]==='settlement')};
}
test('real dice settle handler celebrates once after both bodies sleep, never while either is moving or when redisplayed',()=>{
 const f=diceFixture(),c=f.ctx;c.tick(.016);assert.equal(f.wins().length,0);c.activeRolls[0].body.sleepState=2;c.tick(.016);assert.equal(f.wins().length,0);c.activeRolls[1].body.sleepState=2;c.tick(.016);assert.equal(f.wins().length,1);assert.equal(c.rolling,false);assert.equal(c.status.dataset.state,'complete');assert.equal(f.landed.length,2);assert.equal(c.lastFaces.length,2);c.tick(.016);c.finish();assert.equal(f.wins().length,1);
});
test('dice timeout and invalid coordinates abort instead of celebrating',()=>{
 for(const invalid of ['timeout','escaped','nonfinite']){const f=diceFixture(),c=f.ctx;if(invalid==='timeout')c.rollElapsed=26;else c.activeRolls[0].body.position.x=invalid==='escaped'?100:NaN;c.tick(.016);assert.equal(f.wins().length,0);assert.equal(c.rolling,false);assert.equal(c.status.textContent,'ROLL AGAIN');}
});
