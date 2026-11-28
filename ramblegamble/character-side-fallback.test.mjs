import test from 'node:test';
import assert from 'node:assert/strict';
import {sidePortraitLayout,sideNeeded,createSidePortraits} from './character-side-fallback.mjs';
const ids=['faroe','erin','kaz','hazel','lillie-host'];
const styles=()=>{const map=new Map();return {getPropertyValue:k=>map.get(k)||'',setProperty:(k,v)=>map.set(k,v)};};
const element=()=>{const set=new Set();return {style:styles(),dataset:{},classList:{add:k=>set.add(k),remove:k=>set.delete(k),contains:k=>set.has(k),toggle(k,v){v?set.add(k):set.delete(k);}}};};
test('all cast subsets split with integer division and fit safe non-overlapping rails',()=>{
 for(const [width,height] of [[1366,668],[1920,1080],[360,640],[640,280],[240,180],[3440,1440]])for(let mask=0;mask<32;mask++){
  const entries=ids.filter((_,i)=>mask&(1<<i));const {items,left,right}=sidePortraitLayout(entries,{width,height});
  assert.equal(items.length,entries.length);assert.equal(items.filter(i=>i.side==='left').length,Math.floor(entries.length/2));
  assert.deepEqual(items.map(i=>i.entry),entries);
  for(const i of items){assert.ok(i.x>=0&&i.y>=height*.16-1e-9&&i.x+i.size<=width+1e-9&&i.y+i.size<=height*.88+1e-9);assert.ok(i.size>0);if(i.side==='left')assert.ok(i.x+i.size<=left);else assert.ok(i.x>=width-right);}
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];assert.ok(a.x+a.size<=b.x||b.x+b.size<=a.x||a.y+a.size<=b.y||b.y+b.size<=a.y);}
 }
});
test('same panels move into side rails; referee is counted, hidden host included, restore clears overrides without touching projection',()=>{
 const preview=element(),ctrl=createSidePortraits(preview,1024),entries=ids.map(id=>({id,panel:{parentElement:element(),style:{transform:'matrix3d(...)',visibility:'hidden'}}}));
 const view={width:1366,height:668};const coverage=new Map(entries.map(e=>[e,e.id==='lillie-host'?1:0]));
 const update=t=>ctrl.update(entries,e=>coverage.get(e),view,t,true);
 update(0);assert.deepEqual(entries.map(e=>e.panel.parentElement.dataset.side),['left','left','right','right',undefined]);assert.equal(entries[3].sidePortrait,true);assert.equal(entries[4].sidePortrait,false);
 coverage.set(entries[4],0);update(10);assert.equal(entries[4].sidePortrait,false);update(151);assert.equal(entries[4].sidePortrait,true);
 coverage.set(entries[0],.37);update(200);update(400);assert.equal(entries[0].sidePortrait,true);coverage.set(entries[0],.7);update(410);update(551);assert.equal(entries[0].sidePortrait,false);assert.equal(entries[0].panel.style.transform,'matrix3d(...)');assert.equal(entries[0].panel.style.visibility,'hidden');
 ctrl.update(entries,()=>0,view,600,false);assert.ok(entries.every(e=>!e.sidePortrait&&!e.panel.parentElement.classList.contains('rg-side-portrait')));assert.equal(preview.style.getPropertyValue('--rg-fugi-left'),'0px');assert.equal(preview.classList.contains('has-side-fugis'),false);
 ctrl.update(entries,()=>0,view,700,true);ctrl.clear();assert.ok(entries.every(e=>!e.sidePortrait));
});
test('hysteresis separates entering and leaving threshold; invalid coverage fails to peripheral fallback',()=>{assert.equal(sideNeeded(.35,false),false);assert.equal(sideNeeded(.35,true),true);assert.equal(sideNeeded(0),true);assert.equal(sideNeeded(1,true),false);assert.equal(sideNeeded(NaN),true);});
