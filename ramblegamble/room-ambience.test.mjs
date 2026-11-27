import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomAmbience } from './room-ambience.mjs';
import { FOLEY_CUES } from './game-foley.mjs';
function fixture({reject=false,deferred=false}={}) {
  const media=[], gains=[], resolutions=[], filters=[];
  const createMedia=()=>{
    const m={paused:true,plays:0,pauses:0,duration:1200,handlers:{},addEventListener(n,f){this.handlers[n]=f;},play(){this.plays++;this.paused=false;if(deferred)return new Promise(r=>resolutions.push(r));return reject?Promise.reject(Error('autoplay')):Promise.resolve();},pause(){this.paused=true;this.pauses++;}};
    media.push(m);return m;
  };
  const context={state:'running',currentTime:0,createGain(){const gain={value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v}};gains.push(gain);return {gain,connect(){}};},createMediaElementSource(){return {connect(){}};},createBiquadFilter(){const filter={frequency:{value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v}},Q:{value:0},connect(){}};filters.push(filter);return filter;}};
  const master={};const room=createRoomAmbience({createMedia,random:()=>.5});
  return {room,media,gains,resolutions,filters,context,sync:(active=true,level=1,retry=false,emotion="idle",waterLevel=0,waterCutoff=480)=>room.sync({active,level,retry,emotion,waterLevel,waterCutoff,context,master})};
}
test('room streams two independent local recorded loops, lazy and idempotent',()=>{
  const f=fixture(); f.sync(false);assert.equal(f.media.length,0);
  f.sync();for(let i=0;i<1000;i++)f.sync();assert.equal(f.media.length,4);assert.deepEqual(f.media.map(m=>m.plays),[1,1,0,0]);
  assert.ok(f.media.every(m=>m.loop&&m.preload==='none'&&m.src.startsWith('file:')));
  assert.match(f.media[0].src,/room-bed\.mp3$/);assert.match(f.media[1].src,/room-detail\.mp3$/);
  f.media[0].handlers.loadedmetadata();assert.equal(f.media[0].currentTime,598);
  f.sync(true,.28);assert.ok(Math.abs(f.gains[0].value-.13*.28)<1e-10);
  f.sync(false);assert.ok(f.media.every(m=>m.paused));assert.ok(f.gains.every(g=>g.value===0));
  f.sync();assert.deepEqual(f.media.map(m=>m.plays),[2,2,0,0]);assert.equal(f.media[0].currentTime,598);
});
test('autoplay rejection does not cause repeated frame retries; gesture can retry',async()=>{
  const f=fixture({reject:true});f.sync();await new Promise(r=>setImmediate(r));
  for(let i=0;i<100;i++)f.sync();assert.deepEqual(f.media.map(m=>m.plays),[1,1,0,0]);
  f.sync(true,1,true);assert.deepEqual(f.media.map(m=>m.plays),[2,2,0,0]);
});
test('late start after mute or exit cannot leave ambience running',async()=>{
  const f=fixture({deferred:true});f.sync();f.room.stop();f.resolutions.forEach(r=>r());await new Promise(r=>setImmediate(r));assert.ok(f.media.every(m=>m.paused));
});
test('failed media is never repeatedly requested and the other layer survives',()=>{
  const f=fixture();f.sync();f.media[0].handlers.error();f.sync(true,1,true);assert.equal(f.media[0].plays,1);assert.ok(f.media[0].paused);assert.equal(f.media[1].plays,1);
});
test('Smeemo discovery uses only the new downloaded horror sample, no cheer or jackpot fallback',()=>{
  assert.deepEqual(FOLEY_CUES.smeemoWin.files,['smeemo-horror.mp3']);assert.equal(FOLEY_CUES.smeemoWin.fallback,undefined);assert.equal(FOLEY_CUES.smeemoWin.maxDuration,4.2);
});

test('cheer remains audible until emotion changes, suspense and shock duck the ambient recordings',()=>{const f=fixture();f.sync(true,1,false,'cheer');assert.deepEqual(f.media.map(m=>m.plays),[1,1,1,0]);assert.equal(f.gains[2].value,.14);for(let i=0;i<1000;i++)f.sync(true,1,false,'cheer');assert.deepEqual(f.media.map(m=>m.plays),[1,1,1,0]);f.sync(true,1,false,'shock');assert.equal(f.gains[2].value,0);assert.equal(f.gains[0].value,.13*.24);f.sync(false);assert.ok(f.media.every(m=>m.paused));});


test('VIP water has its own filter and gain, while all three crowd tracks become silent and pause',()=>{
 const f=fixture();f.sync(true,1,false,'cheer');f.sync(true,0,false,'cheer',.14,480);
 assert.deepEqual(f.gains.map(g=>g.value),[0,0,0,.22*.14]);assert.equal(f.filters[0].frequency.value,480);
 assert.equal(f.media[3].plays,1);assert.match(f.media[3].src,/vip-water-drips-cc0-loop\.ogg$/);
 f.context.currentTime=1;f.sync(true,0,false,'cheer',1,3400);
 assert.ok(f.media.slice(0,3).every(m=>m.paused));assert.equal(f.filters[0].frequency.value,3400);assert.equal(f.gains[3].value,.22);assert.equal(f.media[3].plays,1);
 for(let i=0;i<100;i++)f.sync(true,0,false,'cheer',1,3400);
 assert.deepEqual(f.media.map(m=>m.plays),[1,1,1,1]);
 f.sync(true,1,false,'cheer');assert.deepEqual(f.media.map(m=>m.plays),[2,2,2,1]);f.context.currentTime=2;f.sync(true,1,false,'cheer');assert.ok(f.media[3].paused);
});
test('missing water track never restores casino ambience in VIP',()=>{
 const f=fixture();f.sync(true,0,false,'cheer',1,3400);f.media[3].handlers.error();for(let i=0;i<20;i++)f.sync(true,0,true,'cheer',1,3400);
 assert.deepEqual(f.media.map(m=>m.plays),[0,0,0,1]);assert.ok(f.media.every(m=>m.paused));
});
test('pending water start cannot survive pause or a trip away from the portal',async()=>{
 const f=fixture({deferred:true});f.sync(true,0,false,'idle',1,3400);f.room.stop();f.resolutions.forEach(r=>r());await new Promise(r=>setImmediate(r));assert.ok(f.media.every(m=>m.paused));
});
