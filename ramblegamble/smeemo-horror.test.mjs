import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {cardStains,stainUrl,horrorFrame,horrorVisible,horrorRenderScale,HORROR_VIDEO} from './smeemo-horror.mjs';
import {createLightningStrike} from './smeemo-lightning.mjs';
import {createSmeemoImpact} from './smeemo-impact.mjs';
import {SMEEMO_STINGER} from './smeemo-reveal.mjs';
const local = path=>new URL('.'+path.replace('/ramblegamble',''),import.meta.url);
test('nine stains are unique and stable over shuffle, reveal and repeated reads; rounds vary',()=>{
 const ids=Array.from({length:9},(_,i)=>`card-${i}`),perms=new Set();
 for(let i=0;i<500;i++){
  const map=cardStains(`round-${i}`,ids);assert.equal(new Set(map.values()).size,9);assert.deepEqual(map,cardStains(`round-${i}`,[...ids].reverse()));
  assert.ok([...map.values()].every(n=>n>=0&&n<12));perms.add([...map.values()].join(','));
 }
 assert.ok(perms.size>490);
});
test('all referenced media are local and available; 100ms frame helper and visibility gate',()=>{
 for(let i=0;i<12;i++)assert.ok(existsSync(local(stainUrl(i).slice(5,-2))));
 assert.ok(existsSync(local(HORROR_VIDEO)));assert.ok(existsSync(local(SMEEMO_STINGER)));
 for(let i=0;i<1000;i++)assert.equal(horrorFrame(i),Math.floor(i/100)*100);
 const base={hidden:false,locked:false,offTable:false,mode:'smeemo',excluded:false};assert.ok(horrorVisible(base));
 for(const key of ['hidden','locked','offTable','excluded'])assert.equal(horrorVisible({...base,[key]:true}),false);
 assert.equal(horrorVisible({...base,mode:'shop'}),false);
});
test('production lightning palette stays red and quantized painting cannot exceed 10fps',()=>{
 for(let i=0;i<12;i++){
  const strike=createLightningStrike({kind:'reveal',count:i},0,{x:.5,y:.8},()=>.4,i);
  for(const color of Object.values(strike.palette)){const [r,g,b]=color.slice(1).match(/../g).map(x=>parseInt(x,16));assert.ok(r>g&&r>b);}
 }
 let time=0,callback,paints=[];const c=createSmeemoImpact({frameMs:100,requestFrame:fn=>{callback=fn;return 1},cancelFrame(){callback=null},now:()=>time,canRun:()=>true,isVisible:()=>true,reduced:()=>false,size:()=>({width:1280,height:720}),paint:()=>paints.push(time),clear(){},sound(){},stopSound(){}});
 c.trigger({kind:'win',count:5});for(time=10;time<1300;time+=10){const fn=callback;callback=null;fn?.(time);}
 assert.ok(paints.length>=10);assert.ok(paints.every((v,i)=>i===0||Math.floor(v/100)>Math.floor(paints[i-1]/100)));c.stop();
});
test('card motion durations and stagger are on the tenth-second grid',()=>{
 const css=readFileSync(new URL('./card-games.css',import.meta.url),'utf8');const ui=readFileSync(new URL('./card-games-ui.js',import.meta.url),'utf8');
 for(const name of ['arrive','stack','deal','flip-down','turn','win-turn','wave-a','wave-b'])assert.match(css,new RegExp('@keyframes rg-smeemo-'+name+' \\{[^\\n]*animation-timing-function:steps'));
 assert.match(ui,/bindCardTilt\(button,100\)/);assert.match(ui,/cardStains\(game.id, game.cards.map\(c=>c.id\)\)/);
});

test('Scramble resolution budget scales only WebGL pixels and restores normal DPR on exit',()=>{
 for(const [w,h,dpr] of [[1280,720,1],[1920,1080,1.6],[3440,1440,2],[3840,2160,3],[390,844,3],[800,600,.8]]){
  const normal=horrorRenderScale(w,h,dpr,false),active=horrorRenderScale(w,h,dpr,true);
  assert.equal(normal,Math.min(dpr,1.6));assert.ok(active<=1&&active<=normal);assert.ok(w*h*active*active<=1600000.00001);
  assert.equal(horrorRenderScale(w,h,dpr,false),normal);
 }
 const css=readFileSync(new URL('./card-games.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.rg-preview\.is-smeemo-cinema >[^{}]+\{[^}]*filter:/);
 assert.match(css,/\.rg-smeemo-fog::before \{[^}]*inset:-10%/);assert.doesNotMatch(css,/\.rg-smeemo-fog::after\s*\{/);
});
