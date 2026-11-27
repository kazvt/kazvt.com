import test from 'node:test';
import assert from 'node:assert/strict';
import {createSmeemoEncounter,createSmeemoStinger,createSmeemoTableSession,SMEEMO_STINGER,SMEEMO_RETURN_MS} from './smeemo-reveal.mjs';
import {createStageShowState,REVEAL_MS,LIGHT_RELEASE_MS} from './stage-show-state.mjs';
import {soundtrackFor} from './soundtrack.mjs';
import {focusArrowKey} from './focus-arrow.mjs';
import {readFileSync} from 'node:fs';

test('five intentional clicks, quiet on second, one stinger and return; retry resets',()=>{
 const e=createSmeemoEncounter();assert.equal(e.click(),null);e.focus();assert.equal(e.count,0);assert.equal(focusArrowKey({kind:'smeemo-crowd'}),'smeemo-crowd');
 assert.equal(e.click(),1);assert.equal(e.song,'smeemo');assert.equal(e.quiet,false);assert.equal(e.revealed,false);e.focus();assert.equal(e.count,1);
 assert.equal(e.click(),2);assert.equal(e.quiet,true);assert.equal(e.revealed,true);assert.equal(e.song,'smeemo');
 assert.equal(e.click(),3);assert.equal(e.click(),4);assert.equal(e.click(),5);assert.equal(e.phase,'stinger');assert.equal(e.song,null);assert.equal(e.click(),null);
 assert.equal(e.finish(),true);assert.equal(e.finish(),false);assert.equal(e.song,'smeemo');assert.equal(e.revealed,false);assert.equal(e.arrive(),true);assert.equal(e.arrive(),false);assert.equal(e.phase,'table');assert.equal(e.song,null);assert.equal(SMEEMO_RETURN_MS,4400);
 e.reset();assert.equal(e.phase,'hidden');assert.equal(e.count,0);assert.equal(e.quiet,false);assert.equal(e.song,null);assert.equal(e.finish(),false);e.focus();assert.equal(e.click(),1);
});
function fixture(){let clock=0,finishes=0,mute=false;const root={hidden:true},caption={};class Media extends EventTarget{paused=true;currentTime=0;play(){this.paused=false;return this.promise||Promise.resolve();}pause(){this.paused=true;}removeAttribute(k){assert.equal(k,'src');this.src='';}load(){this.currentTime=0;}}
 const video=new Media(),player=createSmeemoStinger({root,video,caption,muted:()=>mute,onFinish:()=>finishes++,clock:()=>clock});return {root,caption,video,player,advance(ms){clock+=ms;player.step()},mute(v){mute=v;player.step()},get finishes(){return finishes}};
}
test('video completion waits for ended; mute and late events are idempotent',()=>{
 const f=fixture();f.player.start();assert.equal(f.video.src,SMEEMO_STINGER);assert.equal(f.root.hidden,false);f.video.currentTime=3;f.advance(3000);assert.equal(f.finishes,0);f.mute(true);assert.equal(f.video.muted,true);f.video.dispatchEvent(new Event('ended'));assert.equal(f.finishes,1);assert.equal(f.root.hidden,true);assert.ok(f.video.paused);f.video.dispatchEvent(new Event('ended'));assert.equal(f.finishes,1);f.player.start();f.video.dispatchEvent(new Event('ended'));assert.equal(f.finishes,2);
});
test('missing file and stalled playback recover once; cancelled playback never navigates',async()=>{
 const f=fixture();f.player.start();f.video.dispatchEvent(new Event('error'));assert.equal(f.video.hidden,true);f.advance(900);f.video.dispatchEvent(new Event('error'));f.advance(600);assert.equal(f.finishes,1);f.player.start();f.advance(12001);assert.equal(f.video.hidden,true);f.advance(1500);assert.equal(f.finishes,2);
 f.player.start();f.player.cancel();f.video.dispatchEvent(new Event('ended'));assert.equal(f.finishes,2);f.video.promise=Promise.reject(new Error('blocked'));f.player.start();await Promise.resolve();assert.equal(f.video.hidden,true);f.advance(1500);assert.equal(f.finishes,3);
});
test('silent rotating spotlight emits no roll/reveal/hide sounds; slot celebration still has both applause events',()=>{
 const events=[],s=createStageShowState({cue:c=>events.push(c)}),cat={x:1,y:2,z:3},table={x:5,y:1,z:6};s.begin(cat,0,'silent');assert.equal(s.step(1200).owner,'silent');assert.equal(s.step(REVEAL_MS).strength,1);s.dismiss(REVEAL_MS+10);s.step(REVEAL_MS+10+LIGHT_RELEASE_MS);s.begin(table,6000,'silent');assert.deepEqual(s.step(10000).target,table);assert.equal(events.filter(e=>e!=='stop-roll').length,0);
 s.toggle(cat,11000);s.step(15000);s.toggle(cat,15010);s.step(17000);assert.equal(events.filter(e=>e==='reveal').length,1);assert.equal(events.filter(e=>e==='hide').length,0);
 s.begin(table,18000,'slot');s.step(22000);s.hide(table,25000);assert.equal(events.filter(e=>e==='reveal').length,2);assert.equal(events.filter(e=>e==='hide').length,1);
});
test('music routes through one existing player; encounter music is temporary and table music requires an active Smeemo round',()=>{
 const base={active:true,muted:false,dice:false,view:'card-table',cardMode:'smeemo'};
 assert.equal(soundtrackFor(base),'cards','a table mode label without an active Smeemo session uses the normal card theme');
 assert.equal(soundtrackFor({...base,smeemoTable:true}),'smeemo');
 assert.equal(soundtrackFor({...base,cardMode:'menu',smeemoTable:true}),'cards');
 assert.equal(soundtrackFor({...base,cardMode:'',smeemoTable:true}),'cards');
 assert.equal(soundtrackFor({...base,encounter:'smeemo'}),'smeemo');
 assert.equal(soundtrackFor({...base,encounter:'stinger'}),null);
 assert.equal(soundtrackFor({...base,encounter:'smeemo',active:false}),null);
 assert.equal(soundtrackFor({...base,encounter:'smeemo',dice:true}),null);
});
test('production hook checks scene occlusion, uses projected tag and arrow, preserves slow return and starts a fresh round only on arrival',()=>{
 const src=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 assert.match(src,/raycaster\.intersectObject\(cat,false\)/);assert.match(src,/blocker\.distance>=hit\.distance/);
 assert.match(src,/if\(encounter\.finish\(\)\)\{encounterReturnRevision=readCardGames\(\)\.activityRevision;cardMusicMode="";canvas\.focus\([^;]+;transitionToView\(\{kind:"card-table"\},\{encounterReturn:true\}\)/);
 assert.match(src,/encounter\.arrive\(\)\)\{[\s\S]*?rg:start-smeemo-after-arrival/);
 assert.match(src,/duration: encounterReturn \? SMEEMO_RETURN_MS/);assert.match(src,/spooky: encounterReturn \|\| isSpookyView/);
 assert.match(src,/revealed:encounter\.revealed,quiet:encounter\.quiet/);assert.match(src,/roomVisible&&!encounter\.quiet/);
 assert.match(src,/smeemoTable\.cancel\(\)/);assert.match(src,/soundtrack\.resetTrackPosition\("smeemo"\)/);
 const ui=readFileSync(new URL('./card-games-ui.js',import.meta.url),'utf8');assert.match(ui,/mode:activeSmeemo\?"smeemo":null/);
 assert.match(src,/if \(document.hidden\) \{\s*floatingSky\?\.suspend\(\);\s*resetEncounter\(\)/);
});

test('table session requires an explicitly opened Smeemo round and survives camera navigation only while that round remains active',()=>{
 const e=createSmeemoTableSession();assert.equal(e.active,false);
 e.observe({id:'restored',status:'playing',mode:'smeemo',opened:false});e.choose('smeemo');assert.equal(e.active,false,'restored/dismissed rounds do not arm ambience');
 e.observe({id:'new-a',status:'playing',mode:'smeemo',opened:true});assert.equal(e.active,false,'round opening is not enough until the Smeemo mode owns the table');
 e.choose('smeemo');assert.equal(e.active,true);
 e.observe({id:'new-a',status:'playing',mode:'smeemo',opened:false});assert.equal(e.active,true,'ordinary camera departure does not cancel the live round');
 e.choose('menu');assert.equal(e.active,false,'opening the table menu cancels the Smeemo audio session');
 e.choose('smeemo');assert.equal(e.active,false,'reselecting Smeemo cannot revive a cancelled round with the same ID');
 e.observe({id:'new-b',status:'playing',mode:'smeemo',opened:true});e.choose('smeemo');assert.equal(e.active,true);
 e.observe({id:'new-b',status:'complete',mode:'smeemo',opened:false});assert.equal(e.active,false);
 e.observe({id:null,status:null,mode:null,opened:false});assert.equal(e.active,false);
});

test('explicit cancellation prevents a stale or repeated open event from restarting the same Smeemo ambience',()=>{
 const e=createSmeemoTableSession();e.observe({id:'round-a',status:'playing',mode:'smeemo',opened:true});e.choose('smeemo');assert.equal(e.active,true);
 e.cancel();assert.equal(e.active,false);e.observe({id:'round-a',status:'playing',mode:'smeemo',opened:true});e.choose('smeemo');assert.equal(e.active,false);
 e.observe({id:'round-b',status:'playing',mode:'smeemo',opened:true});e.choose('smeemo');assert.equal(e.active,true);
});

test('stinger suppresses duplicate caption on successful playback and reveals fallback only on failure',()=>{
 const f=fixture();f.player.start();assert.equal(f.caption.hidden,true);f.video.dispatchEvent(new Event('error'));assert.equal(f.caption.hidden,false);assert.equal(f.caption.textContent,'SMEEMO • 5/5');f.advance(1500);assert.equal(f.finishes,1);
});

test('preload is silent and invisible on first encounter click; start reuses buffered source and cancellation clears it',()=>{
 const f=fixture();let loads=0;const load=f.video.load.bind(f.video);f.video.load=()=>{loads++;load();};f.player.prepare();assert.equal(f.root.hidden,true);assert.equal(f.video.src,SMEEMO_STINGER);assert.equal(f.video.paused,true);assert.equal(loads,1);f.player.prepare();assert.equal(loads,1);f.player.start();assert.equal(loads,1);assert.equal(f.root.hidden,false);f.player.cancel();assert.equal(f.video.src,'');assert.equal(loads,2);assert.equal(f.finishes,0);
});

test('spectators are absent only at stages 3, 4, 5, with Smeemo still revealed and return restoring the crowd quietly',()=>{
 const e=createSmeemoEncounter();assert.equal(e.hideCrowd,false);e.focus();assert.equal(e.hideCrowd,false);
 for(let i=1;i<=5;i++){assert.equal(e.click(),i);assert.equal(e.hideCrowd,i>=3);assert.equal(e.revealed,i>=2);}
 assert.equal(e.finish(),true);assert.equal(e.hideCrowd,false);assert.equal(e.quiet,true);e.arrive();assert.equal(e.hideCrowd,false);assert.equal(e.quiet,true);e.reset();assert.equal(e.quiet,false);
 for(let stop=1;stop<=5;stop++){e.focus();for(let i=0;i<stop;i++)e.click();e.reset();assert.equal(e.hideCrowd,false);assert.equal(e.count,0);}
});
test('native alpha WebM is selected, both overlay and video have transparent CSS backing',()=>{
 assert.match(SMEEMO_STINGER,/smeemo-explosive-alpha\.webm$/);
 const css=readFileSync(new URL('./ramblegamble.css',import.meta.url),'utf8');
 for(const match of css.matchAll(/\.rg-smeemo-stinger(?: video)?\s*\{([^}]+)\}/g)){
  const backgrounds=[...match[1].matchAll(/background(?:-color)?:\s*([^;]+)/g)];for(const b of backgrounds)assert.equal(b[1],'transparent');
 }
 assert.match(css,/\.rg-smeemo-stinger\s*\{[^}]*background:transparent/);
 assert.match(css,/\.rg-smeemo-stinger video\s*\{[^}]*object-fit:fill;[^}]*background:transparent/);
 assert.doesNotMatch(css,/\.rg-smeemo-stinger video\s*\{[^}]*object-fit:contain/);
 const src=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 assert.match(src,/hideCrowd:encounter\.hideCrowd/);assert.match(src,/if\(encounter\.quiet\)silenceCrowd\(\);\s*encounter\.reset/);
 assert.match(src,/function reactCrowd\(emotion\)\{if\(!encounter\.quiet\)/);
});
