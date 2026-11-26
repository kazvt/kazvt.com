import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const js = readFileSync(new URL('./ramblegamble.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../rg/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./ramblegamble.css', import.meta.url), 'utf8');

import { createScoreHud } from './show-ui-fx.mjs';
function element(tag) { return { tag, children: [], style:{setProperty(){}},setAttribute(){}, append(...nodes) { this.children.push(...nodes); }, replaceChildren() { this.children = []; } }; }
test('shared score renderer uses original berry avatars, accessible names and exact numeric scores in order', () => {
  const pointsHud=element('aside'); const before=globalThis.document;globalThis.document={createElement:element};
  try { const render=createScoreHud(pointsHud,{names:['faroe','erin','kaz'],assetPath:'/ramblegamble/assets/berries/'});
    render({faroe:0,erin:12,kaz:32000});assert.equal(pointsHud.hidden,false);assert.equal(pointsHud.children[0].textContent,'faroe: 0, erin: 12, kaz: 32000');
    assert.deepEqual(pointsHud.children.slice(1).map(({children:[img,value]})=>[img.alt,img.src,value.textContent]),[['Faroe','/ramblegamble/assets/berries/faroeberry.png','0'],['Erin','/ramblegamble/assets/berries/erinberry.png','12'],['Kaz','/ramblegamble/assets/berries/kazberry.png','32000']]);
    for(const {children:[img]} of pointsHud.children.slice(1))assert.equal(readFileSync(new URL('..'+img.src,import.meta.url)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    const original=pointsHud.children[1];render({faroe:0,erin:0,kaz:0});assert.equal(pointsHud.hidden,true);assert.equal(pointsHud.children.length,4);assert.equal(pointsHud.children[1],original);assert.equal(original.children[1].textContent,'0');
  } finally {globalThis.document=before;}
});

test('Dice has an accessible name but no visible title and moves the single score strip into its header', () => {
  assert.match(html, /id="rg-dice-dialog" aria-label="Dice"/);
  assert.doesNotMatch(html, /id="rg-dice-title"/);
  assert.equal([...html.matchAll(/id="rg-points-hud"/g)].length, 1);
  assert.match(js, /if \(open\) diceHeader\.prepend\(pointsHud\);\s+else preview\.insertBefore\(pointsHud, result\);/);
  assert.match(css, /\.rg-dice-header \.rg-points-hud\s*\{\s*position: static;/);
  assert.match(css, /\.rg-dice-header \.rg-dice-return\s*\{\s*margin-left: auto;/);
});
