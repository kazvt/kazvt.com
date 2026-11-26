import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoley, FOLEY_CUES } from './game-foley.mjs';

function fixture({ fetchFile, hidden = () => false } = {}) {
  const started = [], stopped = [];
  let clock = 0;
  const parameter = () => ({ value: 0, cancelScheduledValues() {}, setTargetAtTime() {} });
  class Context {
    state = 'running'; currentTime = 0; destination = {};
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    createDynamicsCompressor() { return { threshold: parameter(), ratio: parameter(), connect() {} }; }
    async decodeAudioData(data) { return data; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() { started.push(this); }, stop() { stopped.push(this); this.onended?.(); } }; }
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
