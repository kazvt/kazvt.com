import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePointClickCursor } from './point-click-routing.js';

const css=readFileSync(new URL('./ramblegamble.css',import.meta.url),'utf8');
const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../rg/index.html',import.meta.url),'utf8');
const modes=[['default','idle',10,8,'default'],['hover','interact',11,5,'pointer'],['left','left',8,15,'w-resize'],['right','right',23,15,'e-resize'],['back','back',16,23,'s-resize']];

test('all five routing states have local 32px PNGs, pixel hotspots and native fallbacks',()=>{
  assert.deepEqual([resolvePointClickCursor(),resolvePointClickCursor({actionable:true}),...['left','right','back'].map(zone=>resolvePointClickCursor({zone}))],modes.map(([mode])=>mode));
  for(const [mode,file,x,y,fallback] of modes){
    const path=`assets/cursors/pixelarticons/${file}.png`;
    const declaration=`#rg-canvas[data-rg-cursor="${mode}"] { cursor: url("${path}") ${x} ${y}, ${fallback}; }`;
    assert.ok(css.includes(declaration));
    const png=readFileSync(new URL(`./${path}`,import.meta.url));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),32);
    assert.equal(png.readUInt32BE(20),32);
    assert.equal(png[25],6); // RGBA, transparent background
    assert.ok(x>=0&&x<32&&y>=0&&y<32);
  }
});

test('native scene cursor has no pointer-intercepting overlay, animated GIF or asynchronous image swaps',()=>{
  assert.doesNotMatch(js,/gameCursorImage|CURSOR_ASSETS|has-game-cursor|direction-right\.gif/);
  assert.doesNotMatch(css,/\.rg-game-cursor|has-game-cursor/);
  assert.doesNotMatch(html,/id="rg-game-cursor/);
  assert.match(js,/setGameCursor\(resolvePointClickCursor\(\{ zone, actionable \}\)\)/);
  assert.match(js,/canvas\.dataset\.rgCursor = mode/);
  assert.match(js,/delete canvas\.dataset\.rgCursor/);
});

test('cursor clears on entry to a camera transition and on pointer cancellation or leaving',()=>{
  assert.match(js,/function transitionToView\([^\n]+\{\s+hideGameCursor\(\)/);
  assert.match(js,/canvas\.addEventListener\("pointerenter", rememberPointer\)/);
  assert.match(js,/canvas\.addEventListener\("pointercancel", \(\) => \{[^}]*hideGameCursor\(\)/);
  assert.match(js,/canvas\.addEventListener\("pointerleave", \(\) => \{[^}]*hideGameCursor\(\)/);
  assert.match(js,/window\.addEventListener\("blur", \(\) => \{[^}]*hideGameCursor\(\)/);
  assert.match(js,/event\.pointerType === "touch"/);
  assert.match(js,/document\.documentElement\.hasAttribute\("data-rg-host-locked"\)/);
});

test('forced colors use native cursors and trivia canvas advertises only its back action',()=>{
  const forced=css.slice(css.indexOf('@media (forced-colors: active)'));
  for(const [mode,,,,fallback] of modes)assert.ok(forced.includes(`#rg-canvas[data-rg-cursor="${mode}"] { cursor: ${fallback}; }`));
  assert.match(js,/if \(!cameraDetached && currentView\.kind === "trivia"\) \{\s+const backBand[^;]+;\s+setGameCursor\(event\.clientY >= rect\.bottom - backBand \? "back" : "default"\);\s+return;/);
});
