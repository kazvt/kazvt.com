import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createSoundtrack, soundtrackFor, SOUNDTRACK_FILES } from './soundtrack.mjs';

const mode = (view, cardMode, extra={}) => soundtrackFor({active:true,muted:false,dice:false,view,cardMode,...extra});
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function fixture({defer=false}={}) {
  const log=[],pending=[];let clock=0,created=0;
  class Media extends EventTarget {
    paused=true; readyState=4; volume=1; currentTime=0; error=null; _src='';
    set src(value){assert.ok(this.paused,'must pause before switching source');this._src=value;this.currentTime=0;this.error=null;log.push(['src',value]);}
    get src(){return this._src;}
    play(){this.paused=false;log.push(['play',this.src]);return defer ? new Promise((resolve,reject)=>pending.push({resolve,reject})) : Promise.resolve();}
    pause(){this.paused=true;log.push(['pause',this.src]);}
    removeAttribute(name){assert.equal(name,'src');this._src='';}
    load(){log.push(['load']);}
  }
  const media=new Media();
  const mixer=createSoundtrack({createMedia:()=>{created++;return media;},now:()=>clock});
  return {media,mixer,log,pending,get created(){return created;},advance(ms){clock+=ms;}};
}

test('three tracks; exact mode priority including silent games, pause, lock and mute',()=>{
  for(const v of ['overview','slot','contestants','host','contestant','hazel']) assert.equal(mode(v),'general');
  for(const v of ['roulette','trivia']) assert.equal(mode(v),'cards');
  for(const m of ['', 'menu','shop','quiplash','red-handed']) assert.equal(mode('card-table',m),'cards');
  assert.equal(mode('card-table','smeemo'),'cards','a Smeemo mode label without an armed live round is not a blanket silence state');
  assert.equal(mode('card-table','smeemo',{smeemoTable:true}),'smeemo');
  assert.equal(mode('card-table','smeemo',{smeemoTable:false}),'cards');
  assert.equal(mode('overview','smeemo'),'general');
  // The Dice doorway is selected as a base track; the spatial zone fades it
  // to silence as the camera approaches instead of cutting it off by view ID.
  assert.equal(mode('dice-door'),'general');
  for(const view of ['overview','slot','roulette','card-table','hazel']) for(const extra of [{active:false},{muted:true},{dice:true}]) assert.equal(mode(view,'menu',extra),null);
  assert.deepEqual(Object.values(SOUNDTRACK_FILES),['sonic_gammon_leel_theme.mp3','sonic_no_daifuugou_title_theme.mp3','smeemo_ambiance.mp3']);
  assert.equal(mode('smeemo-crowd','',{encounter:'smeemo'}),'smeemo');assert.equal(mode('card-table','smeemo',{encounter:'smeemo'}),'smeemo');assert.equal(mode('smeemo-crowd','',{encounter:'stinger'}),null);assert.equal(mode('smeemo-crowd','',{encounter:'smeemo',muted:true}),null);
});

test('shared songs are uninterrupted, fade in, switch on one media voice, and suspend/resume without rewinding',async()=>{
  const f=fixture();const {mixer,media,log}=f;
  mixer.sync(null);assert.equal(f.created,0);
  mixer.sync(mode('overview'));await flush();assert.equal(media.loop,true);assert.equal(media.volume,0);
  f.advance(150);mixer.sync(mode('slot'));assert.equal(media.volume,.1);
  f.advance(150);mixer.sync(mode('hazel'));assert.equal(media.volume,.2);
  assert.equal(log.filter(a=>a[0]==='play').length,1);assert.equal(f.created,1);
  media.currentTime=17;mixer.sync(null);assert.ok(media.paused);assert.equal(media.volume,0);
  mixer.sync(mode('overview'));await flush();assert.equal(media.currentTime,17);
  mixer.sync(mode('roulette'));await flush();assert.match(media.src,/sonic_no_daifuugou_title_theme\.mp3$/);assert.equal(media.currentTime,0);
  const plays=log.filter(a=>a[0]==='play').length;
  mixer.sync(mode('card-table','red-handed'));assert.equal(log.filter(a=>a[0]==='play').length,plays);
  mixer.sync(mode('card-table','smeemo',{smeemoTable:true}));await flush();assert.match(media.src,/smeemo_ambiance\.mp3$/);
  mixer.sync(mode('card-table','menu'));await flush();assert.ok(!media.paused);assert.match(media.src,/sonic_no_daifuugou_title_theme\.mp3$/);
  mixer.dispose();assert.equal(media.src,'');assert.ok(media.paused);mixer.sync('general');assert.equal(media.src,'');assert.equal(f.created,1);
});

test('stale play success and rejection cannot alter newer soundtrack or unmute a silent mode',async()=>{
  const f=fixture({defer:true});const {mixer,media,pending}=f;
  mixer.sync('general');mixer.sync('cards');pending[0].reject(new Error('old abort'));await flush();
  pending[1].resolve();await flush();f.advance(300);mixer.sync('cards');assert.equal(media.volume,.2);
  mixer.sync('general');mixer.sync(null);pending[2].resolve();await flush();f.advance(1000);mixer.sync(null);assert.equal(media.volume,0);assert.ok(media.paused);
  mixer.sync('cards');mixer.dispose();pending[3].resolve();await flush();assert.equal(media.volume,0);assert.ok(media.paused);
});

test('autoplay rejection is retried only on user input; missing recording is not hammered or replaced',async()=>{
  const f=fixture({defer:true});const {mixer,media,pending}=f;
  mixer.sync('general');pending[0].reject(Object.assign(new Error('gesture'),{name:'NotAllowedError'}));await flush();
  for(let i=0;i<600;i++)mixer.sync('general');assert.equal(pending.length,1);
  mixer.sync('general',{retry:true});assert.equal(pending.length,2);pending[1].reject(Object.assign(new Error('missing'),{name:'NotSupportedError'}));await flush();
  for(let i=0;i<600;i++)mixer.sync('general',{retry:true});assert.equal(pending.length,2);
  mixer.sync('cards');pending[2].resolve();await flush();f.advance(300);mixer.sync('cards');assert.equal(media.volume,.2);
  media.error={code:3};media.dispatchEvent(new Event('error'));assert.ok(media.paused);assert.equal(media.volume,0);
  mixer.sync('cards',{retry:true});assert.equal(pending.length,3);
});

const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
const section=(from,to)=>js.slice(js.indexOf(from),js.indexOf(to,js.indexOf(from)));
test('actual main scene card mode events switch music only for an armed Smeemo round; cancellation returns to ordinary music',()=>{
  const calls=[],handlers={};let armed=false;
  const context={smeemoTable:{get active(){return armed;},choose(m){if(m!=='smeemo')armed=false;},observe(e){if(e.opened&&e.mode==='smeemo'&&e.status==='playing')armed=true;if(e.mode!=='smeemo'||e.status!=='playing')armed=false;},cancel(){armed=false;}},soundtrack:{resetTrackPosition(name){calls.push(`reset:${name}`);}},pendingTrivia:false,pendingCardGameMode:'',cardMusicMode:'',sceneReady:true,diceModeOpen:false,gameStarted:true,pauseMenuOpen:false,cameraDetached:false,currentView:{kind:'card-table'},result:{hidden:false},crowdState:{react(){}},crowdClock:0,Event,window:{dispatchEvent:e=>calls.push(e.type),addEventListener:(name,fn)=>handlers[name]=fn},syncMusic:()=>calls.push(mode(context.currentView.kind,context.cardMusicMode,{dice:context.diceModeOpen,smeemoTable:context.smeemoTable.active})),transitionToView:view=>{context.currentView=view;context.syncMusic();}};
  runInNewContext(section('  function activateCardGameMode(mode) {','  goButton.addEventListener'),context);
  const activate=m=>handlers['rg:card-game-active']({detail:{mode:m}});
  activate('menu');assert.equal(calls.at(-1),'cards');activate('smeemo');assert.equal(calls.at(-1),'cards','selection alone cannot arm a stale Smeemo session');
  handlers['rg:smeemo-round-state']({detail:{id:'new-round',status:'playing',mode:'smeemo',opened:true}});activate('smeemo');assert.equal(calls.at(-1),'smeemo');
  handlers['rg:close-card-games']();assert.equal(calls.at(-1),'general');assert.equal(armed,false);assert.ok(calls.includes('reset:smeemo'),'closing an active Smeemo round clears its saved position');
  context.currentView={kind:'card-table'};handlers['rg:smeemo-round-state']({detail:{id:'another-round',status:'playing',mode:'smeemo',opened:true}});activate('smeemo');assert.equal(calls.at(-1),'smeemo');
  activate('shop');assert.equal(calls.at(-1),'cards');assert.ok(calls.filter(x=>x==='reset:smeemo').length>=2,'switching to another game also clears the Smeemo session');
  context.diceModeOpen=true;activate('smeemo');assert.equal(context.pendingCardGameMode,'smeemo');assert.equal(calls.at(-1),'rg:close-dice-mode');
});
test('host lifecycle stops music before intro, resumes only after intro is paused, and cleans up independently of Foley',()=>{
  const menu=section('  function showPauseMenu() {','  function activateTriviaMode()');
  assert.ok(menu.indexOf('syncMusic();')<menu.indexOf('menuPresentation.sync();'));
  assert.ok(menu.lastIndexOf('menuPresentation.sync();')<menu.lastIndexOf('syncMusic(true);'));
  assert.match(js,/diceModeOpen = open;\s*if \(open\) syncMusic\(\);/);
  assert.match(js,/document\.addEventListener\("visibilitychange", \(\) => \{\s*syncMusic\(\);/);
  assert.match(js,/soundtrack\.dispose\(\)/);
  assert.match(js,/muted: foley\.muted, dice: diceModeOpen/);
});

test('a browser-paused successful soundtrack resumes on a gesture without a second voice or source change',async()=>{
 const f=fixture();f.mixer.sync('general');await flush();f.advance(300);f.mixer.sync('general');f.media.currentTime=27;f.media.pause();
 for(let i=0;i<120;i++)f.mixer.sync('general');assert.equal(f.log.filter(a=>a[0]==='play').length,1);
 f.mixer.sync('general',{retry:true});await flush();f.advance(300);f.mixer.sync('general');assert.equal(f.media.volume,.2);assert.equal(f.media.currentTime,27);assert.equal(f.created,1);assert.equal(f.log.filter(a=>a[0]==='src').length,1);assert.equal(f.log.filter(a=>a[0]==='play').length,2);
});

test('Smeemo ambience is one resumable track and never a dancing clock',async()=>{
 const f=fixture(),{mixer,media}=f;
 mixer.sync('smeemo');await flush();f.advance(300);mixer.sync('smeemo');media.currentTime=14.25;
 mixer.sync('general');await flush();assert.equal(media.currentTime,0);assert.equal(f.created,1);
 mixer.sync('smeemo');await flush();assert.equal(media.currentTime,14.25);assert.match(media.src,/smeemo_ambiance\.mp3$/);
 mixer.sync(null);assert.ok(media.paused);assert.equal(mixer.playbackPosition(),null);
 mixer.sync('smeemo');await flush();assert.equal(media.currentTime,14.25);
});
test('a cancelled Smeemo session forgets its saved position instead of resuming an old encounter',async()=>{
 const f=fixture(),{mixer,media}=f;
 mixer.sync('smeemo');await flush();f.advance(300);mixer.sync('smeemo');media.currentTime=19.75;
 mixer.sync('cards');await flush();assert.equal(media.currentTime,0);
 mixer.resetTrackPosition('smeemo');
 mixer.sync('smeemo');await flush();assert.equal(media.currentTime,0,'cancelled Smeemo starts fresh, not at the previous session offset');
 media.currentTime=12.5;mixer.resetTrackPosition('smeemo');assert.equal(media.currentTime,0,'reset while playing also returns the active source to its beginning');
 mixer.sync('cards');await flush();mixer.sync('smeemo');await flush();assert.equal(media.currentTime,0);
});
test('dance clock is unavailable until audible playback, and on buffering, pause, mute or seeking',async()=>{
 const f=fixture(),{mixer,media}=f;mixer.sync('general');assert.equal(mixer.playbackPosition(),null);await flush();assert.equal(mixer.playbackPosition(),null);f.advance(300);mixer.sync('general');media.currentTime=2.5;assert.deepEqual(mixer.playbackPosition(),{track:'general',seconds:2.5});
 for(const [k,v] of [['readyState',2],['paused',true],['muted',true],['seeking',true],['ended',true]]){const old=media[k];media[k]=v;assert.equal(mixer.playbackPosition(),null,k);media[k]=old;}
});
test('table horror has strict camera and mode priority',()=>{
 assert.equal(mode('card-table','smeemo',{smeemoTable:true}),'smeemo');
 for(const cardMode of ['','menu','shop','red-handed','quiplash'])assert.equal(mode('card-table',cardMode,{smeemoTable:true}),'cards');
 for(const view of ['overview','slot','roulette','trivia','dice-door'])assert.notEqual(mode(view,'smeemo',{smeemoTable:true}),'smeemo');
 for(const extra of [{muted:true},{active:false},{dice:true},{detached:true},{encounter:'stinger'}])assert.notEqual(mode('card-table','smeemo',{smeemoTable:true,...extra}),'smeemo');
 assert.equal(mode('card-table','smeemo',{smeemoTable:false}),'cards');
});


test('spatial zone gain fades down and back up without restarting or rewinding the single music voice',async()=>{
  const f=fixture(),{mixer,media,log}=f;
  mixer.sync('general',{spatialGain:1});await flush();
  f.advance(300);mixer.sync('general',{spatialGain:1});assert.equal(media.volume,.2);
  media.currentTime=23.5;
  f.advance(100);mixer.sync('general',{spatialGain:0});
  assert.ok(media.volume<.2&&media.volume>0,'entering a silent area fades rather than cuts');
  f.advance(3000);mixer.sync('general',{spatialGain:0});
  assert.equal(media.volume,0);assert.equal(mixer.playbackPosition(),null);
  assert.equal(media.paused,false,'spatially silent playback retains the same media clock');
  assert.equal(media.currentTime,23.5);
  f.advance(16);mixer.sync('general',{spatialGain:1});
  assert.ok(media.volume>0&&media.volume<.2,'leaving a silent area fades back in');
  f.advance(3000);mixer.sync('general',{spatialGain:1});
  assert.equal(media.volume,.2);assert.equal(media.currentTime,23.5);
  assert.equal(log.filter(a=>a[0]==='play').length,1);
  assert.equal(log.filter(a=>a[0]==='src').length,1);
});

test('Smeemo encounter music intentionally bypasses spatial scene attenuation',()=>{
  assert.equal(mode('smeemo-crowd','',{encounter:'smeemo'}),'smeemo');
  assert.equal(mode('card-table','',{encounter:'smeemo'}),'smeemo');
});

test('main animation samples spatial audio after freecam movement every frame',()=>{
  const frame=section('  function animate(time) {','  function dispose()');
  assert.ok(frame.indexOf('freecam.step(time)')<frame.indexOf('sampleSpatialAudioZones()'));
  assert.ok(frame.includes('syncVipAmbience(roomVisible,emotion,audioZones)'));
  assert.ok(frame.includes('syncMusic(false,audioZones)'));
  assert.match(js,/soundtrack\.sync\(nextTrack, \{ retry, spatialGain: nextTrack === "smeemo" \? 1 : zones\.musicGain \}\)/);
});


test('spatial fade smoothing is time-based and effectively identical at 30 and 60 FPS',async()=>{
  async function run(fps){
    const f=fixture(),{mixer,media}=f;
    mixer.sync('general',{spatialGain:1});await flush();
    f.advance(300);mixer.sync('general',{spatialGain:1});
    const frames=Math.round(.7*fps),step=700/frames;
    for(let i=0;i<frames;i++){f.advance(step);mixer.sync('general',{spatialGain:0});}
    return media.volume;
  }
  const thirty=await run(30),sixty=await run(60);
  assert.ok(Math.abs(thirty-sixty)<1e-9,`${thirty} vs ${sixty}`);
});
