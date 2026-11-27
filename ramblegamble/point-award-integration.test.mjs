import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createPointStore, RG_CONTESTANTS } from './points-store.mjs';
import { resolveSlotPayouts } from './slot-game.mjs';
import { normalizeSlotGrid } from './slot-reels.mjs';
import { parsePointsCommand } from './points-commands.mjs';

const js = readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
const consoleJs = readFileSync(new URL('../rg/console/console.js',import.meta.url),'utf8');
const GRID = 'ramblegamble.slot-game-board.v1';
const POINTS = 'ramblegamble.points.v1';
function storageFixture() {
  const data = new Map([[POINTS,JSON.stringify({faroe:100,erin:200,kaz:300})]]);
  const blocked = new Set();
  const storage = {getItem:key=>data.get(key)??null,setItem(key,value){if(blocked.has(key))throw Error('quota');data.set(key,value);}};
  let tail=Promise.resolve();
  const store = createPointStore({getStorage:()=>storage,makeChannel:()=>null,locks:{request(name,fn){const next=tail.then(fn);tail=next.catch(()=>{});return next;}}});
  return {store, storage, blocked, readPointScores:store.read, writePointScores:store.write, withPointScoresLock:store.withLock};
}
function slotFixture(visible=true) {
  const f=storageFixture(), seen=[],events=[],sounds=[],cabinet=[];
  const original=Array(15).fill(null);original[0]='faroeberry';original[5]='faroeberry';
  const target=original.slice();target[10]='faroeberry';
  f.storage.setItem(GRID,JSON.stringify(original));f.store.subscribe(v=>seen.push(v));
  const context={...f, normalizeSlotGrid, resolveSlotPayouts, localStorage:f.storage, SLOT_GRID_STORAGE_KEY:GRID, slotReelGrid:original,
    playing:true, slotWinCelebration:null, performance:{now:()=>200}, reducedMotion:{matches:false},
    preview:{classList:{remove(){}}},result:{hidden:true}, drawSlotReelDisplay(){},syncSlotPlacementControls(){},
    slotCabinetFX:{stopRolling(){cabinet.push(["stop"]);},reset(){cabinet.push(["reset"]);},result(time,won,options){cabinet.push(["result",time,won,options.active, f.store.read().faroe, JSON.parse(f.storage.getItem(GRID))]);}},canShowCabinetFX:()=>visible,
    canShowSlotCelebration:()=>visible, createSlotWinAnimation:(grid,outcome,time)=>({grid,outcome,time}),
    completeSlotPresentation(){context.playing=false;},foley:{play(name){sounds.push(name);},stop(){}},
    console:{warn(){},error(){}},CustomEvent:class {constructor(type,{detail}){this.type=type;this.detail=detail;}},window:{dispatchEvent:event=>events.push(event)}};
  const save=js.slice(js.indexOf('  function saveSlotGrid('),js.indexOf('  function startSlotAction('));
  const finish=js.slice(js.indexOf('  async function finishSlotAction('),js.indexOf('\n  applyTheme();',js.indexOf('  async function finishSlotAction(')));
  runInNewContext(`${save}\n${finish}\nthis.finish=finishSlotAction`,context);
  return {...f,context,target,original,events,sounds,seen,cabinet,run:()=>context.finish({targetGrid:target,action:'place-column'},100)};
}
test('real slot finish code commits score and clears board before presentation, exactly once', async()=>{
  const f=slotFixture();await f.run();
  assert.deepEqual(f.store.read(),{faroe:4100,erin:200,kaz:300});
  assert.deepEqual(f.seen.at(-1),f.store.read());
  assert.deepEqual(JSON.parse(f.storage.getItem(GRID)),Array(15).fill(null));
  assert.equal(f.context.slotWinCelebration.animation.time,200);assert.equal(f.context.playing,true);
  assert.ok(f.sounds.includes('payout'));
  assert.deepEqual(f.cabinet,[['stop'],['result',200,true,true,4100,Array(15).fill(null)]]);
});
test('real slot finish does not clear or celebrate when point write fails',async()=>{
  const f=slotFixture();f.blocked.add(POINTS);await f.run();
  assert.deepEqual(f.store.read(),{faroe:100,erin:200,kaz:300});
  assert.deepEqual(JSON.parse(f.storage.getItem(GRID)),f.original);assert.equal(f.context.slotWinCelebration,null);assert.equal(f.context.playing,false);
  assert.equal(f.events.at(-1).detail.reason,'save-failed');assert.match(f.context.result.textContent,/Could not save points/);assert.equal(f.sounds.length,0);assert.deepEqual(f.cabinet,[["stop"],["reset"]]);
});
test('real slot finish restores point balance if board persistence fails; hidden result still commits normally',async()=>{
  const f=slotFixture();f.blocked.add(GRID);await f.run();assert.deepEqual(f.store.read(),{faroe:100,erin:200,kaz:300});
  assert.match(f.context.result.textContent,/points restored/);assert.equal(f.context.slotWinCelebration,null);
  const hidden=slotFixture(false);await hidden.run();assert.equal(hidden.store.read().faroe,4100);assert.equal(hidden.context.slotWinCelebration,null);assert.equal(hidden.context.playing,false);
});
test('real console code serializes rapid adds, sets, inspection and reset and reports failed writes',async()=>{
  const f=storageFixture(), lines=[];
  const source=consoleJs.slice(consoleJs.indexOf('async function execute('),consoleJs.indexOf('\nform.addEventListener'));
  const context={...f,RG_CONTESTANTS,parsePointsCommand,document:{documentElement:{hasAttribute:()=>false}},addLine:(text,style)=>lines.push({text,style}),formatScores:s=>JSON.stringify(s)};
  runInNewContext(`${source}\nthis.execute=execute`,context);
  await Promise.all([context.execute('points add faroe 20'),context.execute('points add faroe 30'),context.execute('points set erin 33'),context.execute('points faroe')]);
  assert.deepEqual(f.store.read(),{faroe:150,erin:33,kaz:300});assert.equal(lines.at(-1).text,'faroe: 150');
  f.blocked.add(POINTS);await context.execute('points add kaz 10');assert.equal(lines.at(-1).style,'terminal-error');assert.equal(f.store.read().kaz,300);
  f.blocked.delete(POINTS);await context.execute('points reset');assert.deepEqual(f.store.read(),{faroe:0,erin:0,kaz:0});
});

test('real console remove handler clamps at zero, reports actual removal, and serializes with adds',async()=>{
  const f=storageFixture(),lines=[];
  const source=consoleJs.slice(consoleJs.indexOf('async function execute('),consoleJs.indexOf('\nform.addEventListener'));
  const context={...f,RG_CONTESTANTS,parsePointsCommand,document:{documentElement:{hasAttribute:()=>false}},addLine:(text,style)=>lines.push({text,style}),formatScores:s=>JSON.stringify(s)};
  runInNewContext(`${source}\nthis.execute=execute`,context);
  await Promise.all([context.execute('points remove faroe 25'),context.execute('points add faroe 30'),context.execute('points remove faroe 10')]);
  assert.equal(f.store.read().faroe,95);assert.equal(lines.at(-1).text,'faroe: 95 (-10)');
  await context.execute('points remove erin 999');assert.equal(f.store.read().erin,0);assert.equal(lines.at(-1).text,'erin: 0 (-200)');
  f.blocked.add(POINTS);await context.execute('points remove kaz 5');assert.equal(f.store.read().kaz,300);assert.equal(lines.at(-1).style,'terminal-error');
});
test('manual placement payout cancels stale board and preserves pre-placement board if point save fails',async()=>{
  const f=slotFixture();f.blocked.add(POINTS);
  await f.context.finish({targetGrid:f.target,baseGrid:f.original,action:'cell-place'},100);
  assert.deepEqual(JSON.parse(f.storage.getItem(GRID)),f.original);assert.equal(f.store.read().faroe,100);
  const g=slotFixture(),newer=g.original.slice();newer[2]='star';g.storage.setItem(GRID,JSON.stringify(newer));
  await g.context.finish({targetGrid:g.target,baseGrid:g.original,action:'cell-place'},100);
  assert.deepEqual(JSON.parse(g.storage.getItem(GRID)),newer);assert.equal(g.store.read().faroe,100);assert.match(g.context.result.textContent,/board changed/);
});

import {createStarStore} from './points-store.mjs';
const STARS='ramblegamble.stars.v1';
test('real console star commands save independently, serialize, floor at zero, reject overflow and respect lock',async()=>{
  const f=storageFixture(),lines=[],tasks=[];let locked=false;
  const starStore=createStarStore({getStorage:()=>f.storage,makeChannel:()=>null,locks:{request(name,fn){assert.equal(name,'ramblegamble.stars.mutation.v1');const next=(tasks.at(-1)||Promise.resolve()).catch(()=>{}).then(fn);tasks.push(next);return next;}}});
  const source=consoleJs.slice(consoleJs.indexOf('async function execute('),consoleJs.indexOf('\nform.addEventListener'));
  const context={...f,RG_CONTESTANTS,parsePointsCommand,readStarScores:starStore.read,writeStarScores:starStore.write,withStarScoresLock:starStore.withLock,document:{documentElement:{hasAttribute:()=>locked}},addLine:(text,style)=>lines.push({text,style}),formatScores:s=>JSON.stringify(s)};
  runInNewContext(`${source}\nthis.execute=execute`,context);
  assert.deepEqual(starStore.read(),{faroe:0,erin:0,kaz:0});assert.equal(f.storage.getItem(STARS),null);
  await Promise.all([context.execute('star give faroe'),context.execute('stars add faroe 4'),context.execute('stars set erin 2'),context.execute('points add kaz 6')]);
  assert.deepEqual(starStore.read(),{faroe:5,erin:2,kaz:0});assert.deepEqual(f.store.read(),{faroe:100,erin:200,kaz:306});
  await context.execute('star take faroe 30');assert.equal(lines.at(-1).text,'faroe: 0 stars (-5)');
  await context.execute('stars set kaz 9007199254740991');await context.execute('stars give kaz');assert.equal(lines.at(-1).style,'terminal-error');assert.equal(starStore.read().kaz,Number.MAX_SAFE_INTEGER);
  f.blocked.add(STARS);await context.execute('stars add erin');assert.match(lines.at(-1).text,/Could not save stars/);assert.equal(starStore.read().erin,2);f.blocked.delete(STARS);
  const pending=context.execute('stars give erin 10');locked=true;await pending;assert.match(lines.at(-1).text,/Host is locked/);assert.equal(starStore.read().erin,2);locked=false;
  await context.execute('stars reset kaz');assert.equal(starStore.read().kaz,0);assert.equal(starStore.read().erin,2);
  await context.execute('stars');assert.match(lines.at(-1).text,/Stars - .*"erin":2/);
  await context.execute('stars reset');assert.deepEqual(starStore.read(),{faroe:0,erin:0,kaz:0});assert.deepEqual(f.store.read(),{faroe:100,erin:200,kaz:306});
  await context.execute('stars give erin 4');await context.execute('points reset');assert.equal(starStore.read().erin,4);assert.deepEqual(f.store.read(),{faroe:0,erin:0,kaz:0});
});
