import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {creditsFrame,createShowCredits,CREDITS_DURATION,CREDITS_INTRO,CREDITS_FINALE} from './show-credits.mjs';

test('credits use a bounded, monotonic perspective scroll clock with a separate title and finale',()=>{
 for(const [h,c] of [[600,4600],[760,5000],[250,3500],[1010,6800]]){
  let prev=-1;for(let t=0;t<=199;t+=.125){const f=creditsFrame(t,h,c);assert.ok(f.offset>=prev);assert.ok(f.progress>=0&&f.progress<=1);prev=f.offset;}
  assert.equal(creditsFrame(0,h,c).phase,'intro');assert.equal(creditsFrame(CREDITS_INTRO,h,c).phase,'crawl');assert.equal(creditsFrame(CREDITS_FINALE,h,c).phase,'finale');assert.equal(creditsFrame(CREDITS_DURATION,h,c).done,true);assert.ok(creditsFrame(CREDITS_FINALE,h,c).offset>=c+h);
 }
});
function fixture(){
 class El extends EventTarget{constructor(){super();this.dataset={};this.style={};this.open=false;this.hidden=false;this.paused=true;this.currentTime=0;this.ended=false;this.error=null;this.clientHeight=600;this.offsetHeight=4600;this.textContent='';this.plays=0;this.pauses=0;}setAttribute(){}focus(){}showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent(new Event('close'));}play(){this.paused=false;this.plays++;return Promise.resolve();}pause(){this.paused=true;this.pauses++;}}
 const dialog=new El(),button=new El(),menu=new El(),audio=new El(),stage=new El(),track=new El(),pause=new El(),close=new El(),progress=new El();const elements={'audio':audio,'.rg-credits-stage':stage,'.rg-credits-track':track,'[data-credits-pause]':pause,'[data-credits-close]':close,'progress':progress};dialog.querySelector=s=>elements[s];
 const doc=new El(),win=new El();let lock=false,mute=false,seq=0,now=0;doc.documentElement={hasAttribute:()=>lock};const frames=new Map(),changes=[];win.matchMedia=()=>new El();win.MutationObserver=class{observe(){}disconnect(){}};win.requestAnimationFrame=f=>{frames.set(++seq,f);return seq;};win.cancelAnimationFrame=i=>frames.delete(i);
 const fx=createShowCredits({dialog,button,menu,doc,win,muted:()=>mute,onOpenChange:v=>changes.push(v)});
 const click=el=>el.dispatchEvent(new Event('click'));
 return{dialog,button,menu,audio,stage,track,pause,close,progress,doc,frames,changes,fx,click,step(dt=16){now+=dt;const snapshot=[...frames.values()];frames.clear();for(const f of snapshot)f(now);},lock(){lock=true;fx.sync();},mute(){mute=true;fx.sync();}};
}
test('credits exclusively open from visible menu, pause and resume from exact media time, end once and replay',()=>{
 const f=fixture();f.menu.hidden=true;f.click(f.button);assert.equal(f.dialog.open,false);f.menu.hidden=false;f.click(f.button);assert.deepEqual(f.changes,[true]);assert.equal(f.audio.loop,false);assert.equal(f.audio.volume,.2);assert.equal(f.audio.plays,1);assert.equal(f.frames.size,1);
 f.audio.currentTime=60;f.step();assert.equal(f.dialog.dataset.phase,'crawl');const offset=f.track.style.transform;f.step(200);assert.equal(f.track.style.transform,offset);f.click(f.pause);assert.equal(f.audio.paused,true);assert.equal(f.frames.size,0);f.click(f.pause);assert.equal(f.audio.currentTime,60);assert.equal(f.audio.plays,2);f.audio.currentTime=CREDITS_DURATION;f.audio.ended=true;f.step();assert.equal(f.pause.textContent,'REPLAY');assert.equal(f.dialog.dataset.phase,'finale');assert.equal(f.frames.size,0);f.audio.ended=false;f.click(f.pause);assert.equal(f.audio.currentTime,0);assert.equal(f.audio.paused,false);f.click(f.close);assert.deepEqual(f.changes,[true,false]);assert.equal(f.audio.paused,true);assert.equal(f.frames.size,0);f.fx.dispose();
});
test('hidden/suspended credits pause without losing place; lock, native close and gameplay exit stop audio',()=>{
 for(const close of [f=>f.lock(),f=>{f.menu.hidden=true;f.fx.sync();},f=>f.dialog.close()]){
  const f=fixture();f.click(f.button);f.audio.currentTime=34;f.step();f.doc.hidden=true;f.fx.sync();assert.equal(f.audio.paused,true);f.doc.hidden=false;f.fx.sync();assert.equal(f.audio.paused,false);f.fx.setPageSuspended(true);assert.equal(f.audio.paused,true);f.fx.setPageSuspended(false);assert.equal(f.audio.currentTime,34);f.mute();assert.equal(f.audio.muted,true);f.click(f.pause);close(f);assert.equal(f.dialog.open,false);assert.equal(f.audio.currentTime,0);assert.equal(f.audio.paused,true);assert.deepEqual(f.changes,[true,false]);f.fx.dispose();
 }
});
test('blocked or missing audio and stalled decoding have a finite visual-only fallback',async()=>{
 for(const error of ['reject','error','stall']){const f=fixture();if(error==='reject')f.audio.play=()=>Promise.reject(Error('blocked'));if(error==='error')f.audio.error={};f.click(f.button);await Promise.resolve();for(let i=0;i<80;i++)f.step(250);assert.equal(f.dialog.dataset.phase,'crawl');assert.ok(f.progress.value>0);f.click(f.close);assert.equal(f.frames.size,0);f.fx.dispose();}
});
test('production credits include all requested names, joke credits, domains and final recording; menu audio is suspended while dialog is open',()=>{
 const html=readFileSync(new URL('../rg/index.html',import.meta.url),'utf8'),module=readFileSync(new URL('./menu-marquee.mjs',import.meta.url),'utf8'),main=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');const crawl=html.slice(html.indexOf('class="rg-credits-track"'),html.indexOf('class="rg-credits-card'));
 assert.equal((crawl.match(/<section>/g)||[]).length,20);
 for(const phrase of ["AND THAT&#x27;S A WRAP!",'KAZ','TheLadyEternal','Transrantula','GazelDHazel','lillie_garden','kazvt.com','berry.tube/u/erin','berry.tube/u/faroe','berry.tube/u/hazel','lillie.garden','GIGGLES PROVIDED BY:','BIRD CALLS PROVIDED BY:','MODELING AND CONCEPTUALISING AND EVERYTHING YOU JUST EXPERIENCED TONIGHT:','SONGS AND WEBSITE AND GAME DESIGN:','BERRY.TUBE/GROUP','KISS YOU LILLIE BTW','CONTESTANT ART/FUGI DRAWINGS:','berry.tube/u/lore','Go commission him!','AND THANK YOU, CHAT!','BITES:','CUTES:','BEATBOXING:','INTERNET OUTAGES:','TECHNICAL DIFFICULTIES:','THE BLOODY HANDS IN THE BACK WERE FROM A REAL FOOTAGE','I&#x27;m the beatboxing puppy','I know you think it&#x27;s funny','All the people know they love me','I need some food in my tummy','EVERYONE SPAM +LILLIECUTES','SEE YOU IN RAMBLE GAMBLE 2!'])assert.ok(crawl.includes(phrase),phrase);
 assert.match(module,/!credits\?\.open/);assert.match(main,/credits:creditsDialog/);assert.match(main,/creditsPresentation\.close\(\)/);
 const bytes=readFileSync(new URL('./assets/music/ramble-gamble-theme.mp3',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'7485aa4feaf5557e2688b1ecf4fe448d96ec7e33d2388842096cd4d319258ec5');assert.equal((html.match(/ramble-gamble-theme\.mp3\?v=show-finale-20261128-v2/g)||[]).length,2);
});
