import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createSmeemoEncounter,createSmeemoTableSession,SMEEMO_HITS_KEY} from './smeemo-reveal.mjs';
const source=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i);return source.slice(i,j);};
function memory(initial){let value=initial;return {getItem(k){assert.equal(k,SMEEMO_HITS_KEY);return value;},setItem(k,v){assert.equal(k,SMEEMO_HITS_KEY);value=v;}};}
function fixture(){
 const storage=memory(),encounter=createSmeemoEncounter({storage}),smeemoTable=createSmeemoTableSession(),listeners=new Map(),tags=new Map(),calls=[];
 const c={encounter,smeemoTable,encounterStartPending:null,encounterReturnRevision:null,currentView:{kind:'smeemo-crowd'},gameStarted:true,pauseMenuOpen:false,diceModeOpen:false,cameraDetached:false,cameraTransition:null,freecam:{active:false},document:{hidden:false,documentElement:{hasAttribute:()=>false},querySelector:()=>null},
 smeemoCount:{textContent:'0/5'},smeemoTag:{addEventListener:(k,f)=>tags.set(k,f)},smeemoAura:{},preview:{dataset:{},removeAttribute(){delete this.dataset.smeemoStep;}},
 soundtrack:{resetTrackPosition:()=>calls.push('trackReset')},silenceCrowd:()=>calls.push('quiet'),stinger:{cancel:()=>calls.push('cancel'),prepare:()=>calls.push('prepare')},foley:{stop:()=>{},setRoomAmbience:()=>{},stopAll:()=>{}},stageShow:{dismiss:()=>{},silent:()=>{}},crowdCatAnchor:()=>({}),performance:{now:()=>0},syncMusic:()=>{},window:{addEventListener:(k,f)=>listeners.set(k,f)}};
 runInNewContext(slice('  function resetEncounter(','  function updateSmeemoEncounter(')+slice('  window.addEventListener("rg:smeemo-round-state"','  window.addEventListener("rg:card-game-active"')+'\nthis.focus=focusEncounter;this.leave=resetEncounter;',c);
 return {c,encounter,storage,calls,round:detail=>listeners.get('rg:smeemo-round-state')({detail}),right(button=2){let prevented=false;tags.get('contextmenu')({button,preventDefault(){prevented=true;}});return prevented;}};
}
test('hits survive departure and same-tab reload, while hidden effects stay off',()=>{
 const storage=memory(),e=createSmeemoEncounter({storage});e.focus();e.click();e.click();e.click();e.suspend();assert.equal(e.count,3);assert.equal(e.phase,'hidden');assert.equal(e.song,null);assert.equal(e.quiet,false);assert.equal(e.hideCrowd,false);assert.equal(e.revealed,false);assert.equal(e.click(),null);
 const restored=createSmeemoEncounter({storage});assert.equal(restored.count,3);assert.equal(restored.phase,'hidden');restored.focus();assert.equal(restored.hideCrowd,true);assert.equal(restored.song,'smeemo');assert.equal(restored.click(),4);restored.suspend();restored.focus();assert.equal(restored.click(),5);assert.equal(restored.click(),null);
});
test('cancelled five-hit encounter can retry without exceeding five; a committed game consumes hits but preserves quiet table phase',()=>{
 const e=createSmeemoEncounter();e.focus();for(let i=0;i<5;i++)e.click();e.suspend();e.focus();assert.equal(e.count,5);assert.equal(e.click(),5);assert.equal(e.finish(),true);assert.equal(e.arrive(),true);e.clearProgress();assert.equal(e.count,0);assert.equal(e.phase,'table');assert.equal(e.quiet,true);e.suspend();e.focus();assert.equal(e.click(),1);
});
test('malformed or inaccessible browser storage safely falls back to in-memory progress',()=>{
 for(const value of ['-1','6','2.5','02','NaN','',null])assert.equal(createSmeemoEncounter({storage:memory(value)}).count,0);
 const e=createSmeemoEncounter({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});e.focus();assert.equal(e.click(),1);e.suspend();e.focus();assert.equal(e.click(),2);e.reset();assert.equal(e.count,0);
});
test('actual scene departure/focus restores HUD and effects; right-click clears saved hits without leaving the view',()=>{
 const f=fixture(),{c,encounter:e}=f;c.focus();e.click();e.click();e.click();c.leave();assert.equal(e.count,3);assert.equal(c.smeemoTag.hidden,true);assert.equal(c.preview.dataset.smeemoStep,undefined);c.focus();assert.equal(c.smeemoCount.textContent,'3/5');assert.equal(c.preview.dataset.smeemoStep,'3');assert.ok(f.calls.includes('prepare'));assert.equal(f.right(0),false);assert.equal(e.count,3);assert.equal(f.right(),true);assert.equal(e.count,0);assert.equal(e.phase,'focused');assert.equal(c.preview.dataset.smeemoStep,'0');assert.equal(c.smeemoCount.textContent,'0/5');assert.equal(f.storage.getItem(SMEEMO_HITS_KEY),'0');assert.equal(e.click(),1);
 c.document.hidden=true;assert.equal(f.right(),false);assert.equal(e.count,1);
});
test('new playing scramble consumes hits, not old updates, results, failed starts or other rounds',()=>{
 const f=fixture(),{c,encounter:e}=f;c.focus();e.click();e.click();c.leave();
 for(const detail of [{id:'a',mode:'smeemo',status:'playing',opened:false},{id:'a',mode:'smeemo',status:'complete',opened:true},{id:'b',mode:'quiplash',status:'playing',opened:true},{id:null,mode:'smeemo',status:'playing',opened:true}]){f.round(detail);assert.equal(e.count,2);}
 f.round({id:'fresh',mode:'smeemo',status:'playing',opened:true});assert.equal(e.count,0);assert.equal(f.storage.getItem(SMEEMO_HITS_KEY),'0');
 c.focus();e.click();f.round({id:'fresh',mode:'smeemo',status:'playing',opened:false});assert.equal(e.count,1);
});
test('round-start event during automatic arrival preserves ticket and table music',()=>{
 const f=fixture(),{c,encounter:e}=f;c.focus();for(let i=0;i<5;i++)e.click();e.finish();e.arrive();const ticket={};c.encounterStartPending=ticket;c.encounterReturnRevision='old';f.round({id:'new',mode:'smeemo',status:'playing',opened:true});assert.equal(e.count,0);assert.equal(e.phase,'table');assert.equal(e.quiet,true);assert.equal(c.encounterStartPending,ticket);assert.equal(c.encounterReturnRevision,'old');c.smeemoTable.choose('smeemo');assert.equal(c.smeemoTable.active,true);
});
test('canvas context menu uses the existing depth-aware cat picker before slot and host routing',()=>{
 const code=slice('  canvas.addEventListener("contextmenu",','  // The animation clock');assert.match(code,/getSceneInteractionAt\(event\.clientX,event\.clientY\);\s*if\(interaction\?\.machine==="smeemo-crowd"\)\{resetSmeemoHits\(event\);return;\}/);
 assert.ok(code.indexOf('resetSmeemoHits(event)')<code.indexOf('resolveSlotContextCell'));
});
