import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCartoonCueTrack,SLOT_CARTOON_CUES,ROULETTE_CARTOON_CUES} from './cartoon-cues.mjs';
import {cameraTravelDuration,suspenseEase,isSpookyView} from './spooky-camera.mjs';
import {FOLEY_CUES} from './game-foley.mjs';
function fixture(){const calls=[];const track=createCartoonCueTrack({start:(...a)=>calls.push(['start',...a]),stop:(...a)=>calls.push(['stop',...a])},'test');return {calls,track};}
test('cartoon accents are finite, synchronized, quiet and never retrigger on the same frame',()=>{
 for(const [sequence,scale] of [[SLOT_CARTOON_CUES.crank,1],[SLOT_CARTOON_CUES.press,1],[SLOT_CARTOON_CUES.win,1],[SLOT_CARTOON_CUES.loss,1],[ROULETTE_CARTOON_CUES,3900]]){
  const {calls,track}=fixture();track.begin(100,sequence,scale);
  for(const [at,name,volume] of sequence){const now=100+at*scale;track.update(now+1);track.update(now+1);assert.deepEqual(calls.at(-1),['start','test',name,{volume,maxDelay:125}]);assert.ok(FOLEY_CUES[name].volume*volume<=.14);}
  track.update(10000);assert.equal(calls.length,sequence.length);track.clear();assert.deepEqual(calls.at(-1),['stop','test']);
 }
});
test('late frames do not replay missed accents; reset and new spins cancel the old channel',()=>{
 const {calls,track}=fixture();track.begin(0,SLOT_CARTOON_CUES.crank);track.update(600);assert.equal(calls.length,0);track.update(740);assert.equal(calls.length,1);track.update(750,false);track.update(960);assert.equal(calls.length,2);track.begin(1000,SLOT_CARTOON_CUES.crank);track.begin(1050,SLOT_CARTOON_CUES.press);track.update(1230);assert.equal(calls.at(-1)[2],'cartoonTwang');track.clear();track.update(1350);assert.equal(calls.at(-1)[0],'stop');
});
test('scary arrivals are slower than every ordinary navigation including curtain transitions',()=>{
 for(const kind of ['dice-door','smeemo-crowd']){assert.ok(isSpookyView(kind));assert.equal(cameraTravelDuration(kind),4400);assert.equal(cameraTravelDuration(kind,2400),4400);}
 for(const kind of ['overview','slot','roulette','cards','trivia','hazel','contestant']){assert.ok(!isSpookyView(kind));assert.equal(cameraTravelDuration(kind),520);assert.equal(cameraTravelDuration(kind,4000),4000);}
 let previous=0;for(let i=0;i<=100;i++){const value=suspenseEase(i/100);assert.ok(value>=previous&&value<=1);previous=value;}assert.equal(previous,1);assert.ok(suspenseEase(.1)<.01);assert.ok(suspenseEase(.9)>.99);
});
test('all game foley imports use the same mixer cache key',()=>{
 for(const file of ['ramblegamble.js','dice-mode.js','trivia-ui.js','card-games-ui.js','trivia-live-view.mjs','card-room-player.mjs','trivia-client-page.js'])assert.match(readFileSync(new URL(file,import.meta.url),'utf8'),/game-foley\.mjs\?v=cartoon-machines-20261127-v1/);
});
