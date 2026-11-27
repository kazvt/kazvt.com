import test from 'node:test';
import assert from 'node:assert/strict';
import {createSmeemoEncounter,createSmeemoStinger,SMEEMO_STINGER,SMEEMO_RETURN_MS} from './smeemo-reveal.mjs';
import {createStageShowState,REVEAL_MS,LIGHT_RELEASE_MS} from './stage-show-state.mjs';
import {soundtrackFor} from './soundtrack.mjs';
import {focusArrowKey} from './focus-arrow.mjs';
import {readFileSync} from 'node:fs';

test('five intentional clicks, quiet on second, one stinger and return; retry resets',()=>{
 const e=createSmeemoEncounter();assert.equal(e.click(),null);e.focus();assert.equal(e.count,0);assert.equal(focusArrowKey({kind:'smeemo-crowd'}),'smeemo-crowd');
 assert.equal(e.click(),1);assert.equal(e.quiet,false);assert.equal(e.revealed,false);e.focus();assert.equal(e.count,1);
 assert.equal(e.click(),2);assert.equal(e.quiet,true);assert.equal(e.revealed,true);assert.equal(e.song,'smeemo');
 assert.equal(e.click(),3);assert.equal(e.click(),4);assert.equal(e.click(),5);assert.equal(e.phase,'stinger');assert.equal(e.song,null);assert.equal(e.click(),null);
 assert.equal(e.finish(),true);assert.equal(e.finish(),false);assert.equal(e.song,'smeemo');assert.equal(e.revealed,false);assert.equal(e.arrive(),true);assert.equal(e.arrive(),false);assert.equal(e.phase,'table');assert.equal(SMEEMO_RETURN_MS,4400);
 e.reset();assert.equal(e.phase,'hidden');assert.equal(e.count,0);assert.equal(e.quiet,false);assert.equal(e.song,null);assert.equal(e.finish(),false);e.focus();assert.equal(e.click(),1);
});
function fixture(){let clock=0,finishes=0,mute=false;const root={hidden:true},caption={},skip=new EventTarget();class Media extends EventTarget{paused=true;currentTime=0;play(){this.paused=false;return this.promise||Promise.resolve();}pause(){this.paused=true;}removeAttribute(k){assert.equal(k,'src');this.src='';}load(){this.currentTime=0;}}
 const video=new Media(),player=createSmeemoStinger({root,video,skip,caption,muted:()=>mute,onFinish:()=>finishes++,clock:()=>clock});return {root,caption,video,skip,player,advance(ms){clock+=ms;player.step()},mute(v){mute=v;player.step()},get finishes(){return finishes}};
}
test('video completion waits for ended; mute, skip and late events are idempotent',()=>{
 const f=fixture();f.player.start();assert.equal(f.video.src,SMEEMO_STINGER);assert.equal(f.root.hidden,false);f.video.currentTime=3;f.advance(3000);assert.equal(f.finishes,0);f.mute(true);assert.equal(f.video.muted,true);f.video.dispatchEvent(new Event('ended'));assert.equal(f.finishes,1);assert.equal(f.root.hidden,true);assert.ok(f.video.paused);f.skip.dispatchEvent(new Event('click'));assert.equal(f.finishes,1);f.player.start();f.skip.dispatchEvent(new Event('click'));assert.equal(f.finishes,2);
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
test('music routes through one existing player, video is a silent-track override, normal game unchanged',()=>{const base={active:true,muted:false,dice:false,view:'card-table',cardMode:'smeemo'};assert.equal(soundtrackFor(base),null);assert.equal(soundtrackFor({...base,encounter:'smeemo'}),'smeemo');assert.equal(soundtrackFor({...base,encounter:'stinger'}),null);assert.equal(soundtrackFor({...base,encounter:'smeemo',active:false}),null);assert.equal(soundtrackFor({...base,encounter:'smeemo',dice:true}),null);});
test('production hook checks scene occlusion, uses projected tag and arrow, preserves slow table return',()=>{const src=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');assert.match(src,/raycaster\.intersectObject\(cat,false\)/);assert.match(src,/blocker\.distance>=hit\.distance/);assert.match(src,/encounter\.finish\(\)\)\{canvas\.focus\([^;]+;transitionToView\(\{kind:"card-table"\},\{encounterReturn:true\}\)/);assert.match(src,/duration: encounterReturn \? SMEEMO_RETURN_MS/);assert.match(src,/spooky: encounterReturn \|\| isSpookyView/);assert.match(src,/revealed:encounter\.revealed,quiet:encounter\.quiet/);assert.match(src,/roomVisible&&!encounter\.quiet/);assert.match(src,/if \(document.hidden\) \{\s*floatingSky\?\.suspend\(\);\s*resetEncounter\(\)/);});
