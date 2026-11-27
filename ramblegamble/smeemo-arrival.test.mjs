import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createSmeemoEncounter,createSmeemoTableSession} from './smeemo-reveal.mjs';
import {createSmeemoGame} from './card-games.mjs';
import {soundtrackFor} from './soundtrack.mjs';
const scene=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('./card-games-ui.js',import.meta.url),'utf8');
const slice=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j);};
function fixture(){
 const listeners=new Map(),queued=[],tracks=[],lights=[],writes=[];
 const encounter=createSmeemoEncounter(),smeemoTable=createSmeemoTableSession();encounter.focus();for(let i=0;i<5;i++)encounter.click();encounter.finish();
 let state={activityRevision:'old',round:{id:'prior',mode:'shop'},smeemo:null,decks:{shop:[]}};
 const ctx={encounter,smeemoTable,encounterStartPending:null,encounterReturnRevision:'old',cameraTransition:{},currentView:{kind:'card-table'},cameraDetached:false,freecam:{active:false},gameStarted:true,sceneReady:true,pauseMenuOpen:false,diceModeOpen:false,cardMusicMode:'',document:{hidden:false,querySelector:()=>null,documentElement:{hasAttribute:()=>false}},
 stinger:{step(){}},smeemoTag:{},smeemoAura:{},audience:null,cardTableModel:{},THREE:{Box3:class{max={y:1};setFromObject(){return this;}getCenter(){return {};}} ,Vector3:class{}},stageShow:{silent(...a){lights.push(a);}},cardLayer:{classList:{add(){}}},reducedMotion:{matches:false},
 menuMarquee:{muted:false},menuTheme:{muted:false},foley:{muted:false},menuPresentation:{retryTheme(){}},creditsPresentation:{sync(){}},sampleSpatialAudioZones:()=>({musicGain:1}),soundtrackFor,soundtrack:{sync:track=>tracks.push(track)},
 resetEncounter(){encounter.reset();ctx.encounterStartPending=null;ctx.encounterReturnRevision=null;},
 window:{addEventListener:(type,fn)=>listeners.set(type,fn),dispatchEvent:ev=>listeners.get(ev.type)?.(ev)},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}},
 readCardGames:()=>state,createSmeemoGame,runRoomMutation:fn=>new Promise(resolve=>queued.push(()=>{fn();resolve();})),closeHostPanel(){},adminStatus:{},liveStatus:{},console,
 sync(next){writes.push(next);state={...next,activityRevision:'new'};smeemoTable.observe({id:next.smeemo.id,status:next.smeemo.status,mode:'smeemo',opened:true});ctx.cardMusicMode='smeemo';smeemoTable.choose('smeemo');ctx.syncMusic();}};
 runInNewContext(slice(scene,'  function updateSmeemoEncounter(','  function sampleSpatialAudioZones(')+slice(scene,'  function syncMusic(','  for (const type of')+slice(ui,'  window.addEventListener("rg:start-smeemo-after-arrival"','  window.addEventListener("rg:show-card-menu"')+'\nthis.tick=updateSmeemoEncounter;',ctx);
 return {ctx,queued,tracks,lights,writes,removeListener(){listeners.delete("rg:start-smeemo-after-arrival");},arrive(){ctx.cameraTransition=null;ctx.tick(4400,true);},replaceRound(){state={...state,activityRevision:'remote'};},async commit(){queued.shift()?.();await Promise.resolve();await Promise.resolve();}};
}
test('actual arrival hook waits for the camera, starts once, and keeps the horror song before and after the room lock',async()=>{
 const f=fixture(),c=f.ctx;c.syncMusic();c.tick(4000,true);assert.equal(f.queued.length,0);assert.deepEqual(f.tracks,['smeemo']);
 f.arrive();assert.equal(f.lights.length,1);assert.equal(f.queued.length,1);assert.equal(c.encounter.phase,'table');c.syncMusic();c.tick(4416,true);assert.equal(f.queued.length,1);assert.equal(f.writes.length,0);await f.commit();assert.equal(f.writes.length,1);assert.equal(f.writes[0].round,null);assert.equal(f.writes[0].smeemo.phase,'preview');assert.equal(f.writes[0].smeemo.cards.length,9);assert.equal(c.smeemoTable.active,true);assert.equal(c.encounterStartPending,null);assert.ok(f.tracks.every(t=>t==='smeemo'));c.tick(4432,true);assert.equal(f.queued.length,0);
});
test('arrival transaction cannot overwrite a fresh console activity or start a game after departure, lock, or reset',async()=>{
 for(const cancel of [f=>f.replaceRound(),f=>{f.ctx.cameraDetached=true;},f=>{f.ctx.document.hidden=true;},f=>{f.ctx.document.documentElement.hasAttribute=()=>true;},f=>f.ctx.resetEncounter(),f=>{f.ctx.currentView.kind='overview';},f=>{f.ctx.diceModeOpen=true;}]){
  const f=fixture();f.arrive();cancel(f);await f.commit();assert.equal(f.writes.length,0);assert.equal(f.ctx.encounterStartPending,null);
 }
});

test('missing card UI cannot strand an arrival in an endless pending state',()=>{
 const f=fixture();f.removeListener();f.arrive();assert.equal(f.ctx.encounterStartPending,null);assert.equal(f.ctx.encounter.phase,'hidden');assert.equal(f.writes.length,0);
});
