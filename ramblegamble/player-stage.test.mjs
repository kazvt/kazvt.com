import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
test('private stage runs without a toggle, ignores saved off preferences, and resumes after tab hiding', () => {
  const html = read('../rg/player/index.html'), css = read('./player-stage.css'), script = read('./player-stage.mjs');
  assert.doesNotMatch(html, /rg-player-motion|MOTION: (?:ON|OFF)/);
  assert.doesNotMatch(css, /rg-player-motion|prefers-reduced-motion/);
  class Target extends EventTarget {}
  const document = new Target(), window = new Target(), fine = new Target();
  fine.matches = true; document.hidden = false; document.documentElement = new Target();
  const classes = new Set();
  const cursor = {style:{}, classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}};
  const page = {dataset:{},querySelector:s=>s==='.rg-player-cursor'?cursor:null};
  document.querySelector=s=>s==='body.rg-player-stage'?page:null;
  let pending = null;
  runInNewContext(script,{document,window,matchMedia:q=>{assert.match(q,/any-pointer/);return fine;},sessionStorage:{getItem(){throw Error('must not read old preferences');}},innerWidth:800,innerHeight:600,requestAnimationFrame:fn=>{pending=fn;return 1;},cancelAnimationFrame:()=>{pending=null;}});
  assert.equal(page.dataset.motion,'on');
  const move=()=>document.dispatchEvent(Object.assign(new Event('pointermove'),{pointerType:'mouse',buttons:0,clientX:100,clientY:100}));
  move();assert.ok(pending);pending();pending=null;assert.equal(classes.has('is-visible'),true);
  document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(page.dataset.motion,'off');assert.equal(classes.has('is-visible'),false);move();assert.equal(pending,null);
  document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));assert.equal(page.dataset.motion,'on');move();assert.ok(pending);pending();assert.equal(classes.has('is-visible'),true);
});
