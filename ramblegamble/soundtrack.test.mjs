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
    paused=true; volume=1; currentTime=0; error=null; _src='';
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
  assert.equal(mode('card-table','smeemo'),null);
  assert.equal(mode('overview','smeemo'),'general');
  assert.equal(mode('dice-door'),null);
  for(const view of ['overview','slot','roulette','card-table','hazel']) for(const extra of [{active:false},{muted:true},{dice:true}]) assert.equal(mode(view,'menu',extra),null);
  assert.deepEqual(Object.values(SOUNDTRACK_FILES),['sonic_gammon_leel_theme.mp3','sonic_no_daifuugou_title_theme.mp3','smeemo_theme.mp3']);
  assert.equal(mode('smeemo-crowd','',{encounter:'smeemo'}),'smeemo');assert.equal(mode('card-table','smeemo',{encounter:'smeemo'}),'smeemo');assert.equal(mode('smeemo-crowd','',{encounter:'stinger'}),null);assert.equal(mode('smeemo-crowd','',{encounter:'smeemo',muted:true}),null);
});

test('Smeemo theme uses a fresh same-origin URL after installation',async()=>{
  const f=fixture();f.mixer.sync('smeemo');await flush();
  assert.match(f.media.src,/assets\/music\/smeemo_theme\.mp3\?v=smeemo-theme-20261127-v2$/);
  f.mixer.dispose();
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
  mixer.sync(mode('card-table','smeemo'));assert.ok(media.paused);assert.equal(media.volume,0);
  mixer.sync(mode('card-table','menu'));await flush();assert.ok(!media.paused);
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
test('actual main scene card mode events switch music even without camera movement; pending Dice changes do not leak music',()=>{
  const calls=[],handlers={};const context={pendingTrivia:false,pendingCardGameMode:'',cardMusicMode:'',sceneReady:true,diceModeOpen:false,gameStarted:true,pauseMenuOpen:false,cameraDetached:false,currentView:{kind:'card-table'},result:{hidden:false},crowdState:{react(){}},crowdClock:0,Event,window:{dispatchEvent:e=>calls.push(e.type),addEventListener:(name,fn)=>handlers[name]=fn},syncMusic:()=>calls.push(mode(context.currentView.kind,context.cardMusicMode,{dice:context.diceModeOpen})),transitionToView:view=>{context.currentView=view;context.syncMusic();}};
  runInNewContext(section('  function activateCardGameMode(mode) {','  goButton.addEventListener'),context);
  const activate=m=>handlers['rg:card-game-active']({detail:{mode:m}});
  activate('menu');assert.equal(calls.at(-1),'cards');activate('smeemo');assert.equal(calls.at(-1),null);activate('shop');assert.equal(calls.at(-1),'cards');
  handlers['rg:close-card-games']();assert.equal(calls.at(-1),'general');
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
