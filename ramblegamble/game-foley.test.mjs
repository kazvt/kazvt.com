import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoley, FOLEY_CUES, installControlFoley } from './game-foley.mjs';

function fixture({ fetchFile, hidden = () => false } = {}) {
  const started = [], stopped = [];
  let clock = 0;
  const parameter = () => ({ value: 0, cancelScheduledValues() {}, setTargetAtTime() {} });
  class Context {
    state = 'running'; currentTime = 0; destination = {};
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    createDynamicsCompressor() { return { threshold: parameter(), ratio: parameter(), connect() {} }; }
    async decodeAudioData(data) { return data; }
    createBufferSource() { return { playbackRate:{value:1,setValueAtTime(value){this.value=value},linearRampToValueAtTime(value,time){this.ramp=[value,time]}}, connect() {}, disconnect() {}, start(...args) { this.startArgs=args; started.push(this); }, stop() { stopped.push(this); this.onended?.(); } }; }
  }
  const mixer = createFoley({ AudioContext: Context, now: () => clock, random: () => 0, isHidden: hidden,
    fetchFile: fetchFile || (async url => ({ ok: true, arrayBuffer: async () => url.pathname })), });
  return { mixer, started, stopped, advance: n => { clock += n; } };
}
test('recorded cue variation and loop stopping', async () => {
  const {mixer, started, stopped} = fixture();
  assert.equal(await mixer.play('flip'), true);
  assert.equal(await mixer.play('flip'), true);
  assert.notEqual(started[0].buffer, started[1].buffer);
  assert.equal(await mixer.start('slots', 'reel', {loop: true}), true);
  assert.equal(started[2].loop, true);
  mixer.stop('slots');
  assert.equal(stopped[0], started[2]);
});
test('pending audio cannot start after its channel stopped', async () => {
  const {mixer, started} = fixture();
  const pending = mixer.start('roulette', 'wheel', {loop: true});
  mixer.stop('roulette');
  assert.equal(await pending, false);
  assert.equal(started.length, 0);
});
test('delayed, muted, hidden and missing recordings never interrupt gameplay', async () => {
  const {mixer, started, advance} = fixture();
  const late = mixer.play('stop');
  advance(500);
  assert.equal(await late, false);
  const pending = mixer.play('flip');
  mixer.setMuted(true);
  assert.equal(await pending, false);
  assert.equal(await mixer.play('payout'), false);
  assert.equal(started.length, 0);
  assert.equal(await fixture({hidden: () => true}).mixer.play('flip'), false);
  assert.equal(await fixture({fetchFile: async () => ({ok: false, status: 404})}).mixer.play('flip'), false);
});
test('stopAll invalidates pending one-shots and stops active loops', async () => {
  const {mixer, started, stopped} = fixture();
  await mixer.start('slots','reel',{loop:true});
  const pending = mixer.play('payout');
  mixer.stopAll();
  assert.equal(await pending, false);
  assert.equal(started.length, 1);
  assert.equal(stopped.length, 1);
});
test('every cue references local recorded file types only', () => {
  assert.ok(Object.values(FOLEY_CUES).every(cue => cue.files.length && cue.files.every(file => /^[a-z0-9-]+\.(ogg|mp3)$/.test(file))));
});


test('arcade spinner is preferred, ratchet is used only if new sample is unavailable', async () => {
  const primary = fixture();
  assert.equal(await primary.mixer.start('slots','reel',{loop:true}),true);
  assert.match(primary.started[0].buffer,/spinner\.mp3$/);
  const fallback = fixture({fetchFile:async url=>({ok:!url.pathname.endsWith('/spinner.mp3'),arrayBuffer:async()=>url.pathname})});
  assert.equal(await fallback.mixer.start('slots','reel',{loop:true}),true);
  assert.match(fallback.started[0].buffer,/reel\.mp3$/);
  fallback.mixer.stop('slots');
  assert.equal(fallback.stopped.length,1);
});
test('missing primary variant tries other variants before fallback',async()=>{
  const f=fixture({fetchFile:async url=>({ok:!url.pathname.endsWith('/select-1.ogg'),arrayBuffer:async()=>url.pathname})});
  await f.mixer.play('select');
  assert.match(f.started[0].buffer,/select-2\.ogg$/);
});
test('late fallback cannot resurrect cancelled spin',async()=>{
  let resolve;
  const f=fixture({fetchFile:async url=>url.pathname.endsWith('/spinner.mp3')?new Promise(r=>{resolve=r;}):({ok:true,arrayBuffer:async()=>url.pathname})});
  const pending=f.mixer.start('slots','reel',{loop:true});
  await Promise.resolve();
  f.mixer.stop('slots');resolve({ok:false});
  assert.equal(await pending,false);
  assert.equal(f.started.length,0);
});
test('ordinary controls use semantic cue and explicit action suppresses extra click',()=>{
  const events={}, tasks=[], played=[];
  const mixer={requestCount:0,play(cue){this.requestCount++;played.push(cue);}};
  installControlFoley({addEventListener(type,cb){events[type]=cb;}},mixer,cb=>tasks.push(cb));
  const control={disabled:false,dataset:{foley:'back'},closest:()=>null,getAttribute:()=>null,hasAttribute:()=>false};
  const ev={isTrusted:true,button:0,target:{closest:()=>control}};
  events.click(ev);tasks.shift()();assert.deepEqual(played,['back']);
  events.click(ev);mixer.play('flip');tasks.shift()();assert.deepEqual(played,['back','flip']);
  control.disabled=true;events.click(ev);assert.equal(tasks.length,0);
  control.disabled=false;control.dataset.foley='off';events.click(ev);assert.equal(tasks.length,0);
  events.click({...ev,isTrusted:false});assert.equal(tasks.length,0);
});
test('voice cap does not discard active spin loop',async()=>{
  const f=fixture();await f.mixer.start('slots','reel',{loop:true});
  for(let i=0;i<20;i++)await f.mixer.play('click');
  assert.equal(f.started.length,21);assert.equal(f.stopped.length,9);assert.ok(!f.stopped.includes(f.started[0]));
});
test('applause uses existing bundled file rather than installer directory',async()=>{
  const f=fixture();await f.mixer.play('cheer');assert.match(f.started[0].buffer,/assets\/sfx\/cheer\.ogg$/);
});

test('settlement uses the bundled edited recording and is cancellable before decode',async()=>{
 const f=fixture();const pending=f.mixer.start('dice-settlement','settlement');f.mixer.stop('dice-settlement');assert.equal(await pending,false);assert.equal(f.started.length,0);
 assert.equal(await f.mixer.start('dice-settlement','settlement'),true);assert.match(f.started[0].buffer,/settlement-cheer\.ogg$/);assert.deepEqual(f.started[0].startArgs,[]);
 f.mixer.stop('dice-settlement');assert.equal(f.stopped.length,1);
});
test('settlement can use original bundled applause if the edited clip is missing, but caps its duration',async()=>{
 const f=fixture({fetchFile:async url=>({ok:url.pathname.endsWith('/sfx/cheer.ogg'),arrayBuffer:async()=>({duration:8.6,path:url.pathname})})});
 assert.equal(await f.mixer.start('roulette-settlement','settlement'),true);assert.match(f.started[0].buffer.path,/sfx\/cheer\.ogg$/);assert.deepEqual(f.started[0].startArgs,[0,0,1.6]);
});

test('Smeemo recorded hit sweeps upward and replaces stale requests',async()=>{
 const f=fixture();const first=f.mixer.start('smeemo-hit','smeemoHit',{rate:.8,endRate:.9});const second=f.mixer.start('smeemo-hit','smeemoHit',{rate:1.25,endRate:1.4});
 assert.equal(await first,false);assert.equal(await second,true);assert.equal(f.started.length,1);assert.equal(f.started[0].playbackRate.value,1.25);assert.equal(f.started[0].playbackRate.ramp[0],1.4);assert.match(f.started[0].buffer,/smeemo-hit\.ogg$/);
 f.mixer.stop('smeemo-hit');assert.equal(f.stopped.length,1);
});
