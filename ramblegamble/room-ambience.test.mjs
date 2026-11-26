import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomAmbience } from './room-ambience.mjs';
import { FOLEY_CUES } from './game-foley.mjs';
function fixture({reject=false,deferred=false}={}) {
  const media=[], gains=[], resolutions=[];
  const createMedia=()=>{
    const m={paused:true,plays:0,pauses:0,duration:1200,handlers:{},addEventListener(n,f){this.handlers[n]=f;},play(){this.plays++;this.paused=false;if(deferred)return new Promise(r=>resolutions.push(r));return reject?Promise.reject(Error('autoplay')):Promise.resolve();},pause(){this.paused=true;this.pauses++;}};
    media.push(m);return m;
  };
  const context={state:'running',currentTime:0,createGain(){const gain={value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v}};gains.push(gain);return {gain,connect(){}};},createMediaElementSource(){return {connect(){}};}};
  const master={};const room=createRoomAmbience({createMedia,random:()=>.5});
  return {room,media,gains,resolutions,sync:(active=true,level=1,retry=false)=>room.sync({active,level,retry,context,master})};
}
test('room streams two independent local recorded loops, lazy and idempotent',()=>{
  const f=fixture(); f.sync(false);assert.equal(f.media.length,0);
  f.sync();for(let i=0;i<1000;i++)f.sync();assert.equal(f.media.length,2);assert.deepEqual(f.media.map(m=>m.plays),[1,1]);
  assert.ok(f.media.every(m=>m.loop&&m.preload==='none'&&m.src.startsWith('file:')));
  assert.match(f.media[0].src,/room-bed\.mp3$/);assert.match(f.media[1].src,/room-detail\.mp3$/);
  f.media[0].handlers.loadedmetadata();assert.equal(f.media[0].currentTime,598);
  f.sync(true,.28);assert.ok(Math.abs(f.gains[0].value-.13*.28)<1e-10);
  f.sync(false);assert.ok(f.media.every(m=>m.paused));assert.ok(f.gains.every(g=>g.value===0));
  f.sync();assert.deepEqual(f.media.map(m=>m.plays),[2,2]);assert.equal(f.media[0].currentTime,598);
});
test('autoplay rejection does not cause repeated frame retries; gesture can retry',async()=>{
  const f=fixture({reject:true});f.sync();await new Promise(r=>setImmediate(r));
  for(let i=0;i<100;i++)f.sync();assert.deepEqual(f.media.map(m=>m.plays),[1,1]);
  f.sync(true,1,true);assert.deepEqual(f.media.map(m=>m.plays),[2,2]);
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
