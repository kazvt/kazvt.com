import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {menuSignEnergy,paintMenuSign,createMenuMarquee} from './menu-marquee.mjs';
import {signPhase} from './sign-glow.mjs';
import {signMaskBytes,SIGN_BULB_COUNT} from './sign-glow-mask.mjs';
const bytes=()=>new Uint8ClampedArray(120*30*4);
test('menu uses the stage mask and same letter and bulb envelopes with a genuinely clear idle',()=>{
 const mask=signMaskBytes(),out=bytes();
 for(let id=1;id<=12;id++){
  const t=(id-1+.32)*2800/12,phase=signPhase(t);assert.ok(menuSignEnergy(id,phase)>.99);assert.equal(menuSignEnergy(32,phase),0);
  assert.equal(paintMenuSign(out,t),true);const i=mask.findIndex((v,i)=>i%4===0&&v===id)/4;
  const index=((Math.floor(i/128)+3)*120+(i%128)+3)*4;assert.ok(out[index+3]>=225);assert.ok(out[index]>=250);
 }
 for(let id=32;id<32+SIGN_BULB_COUNT;id++){
  const t=2800+(id-32+.75)*2200/(SIGN_BULB_COUNT+3),phase=signPhase(t);assert.ok(menuSignEnergy(id,phase)>.99);assert.equal(menuSignEnergy(1,phase),0);
  assert.equal(paintMenuSign(out,t),true);const i=mask.findIndex((v,i)=>i%4===0&&v===id)/4;
  assert.ok(out[((Math.floor(i/128)+3)*120+i%128+3)*4+3]>=240);
 }
 assert.equal(paintMenuSign(out,5000),false);assert.ok(out.every(x=>x===0));
 for(const t of [75,450,1950,3100,4400,7000]){paintMenuSign(out,t);const copy=out.slice();paintMenuSign(out,t+10000);assert.deepEqual(out,copy);}
});
function fixture({videoError=false,playResult=()=>Promise.resolve()}={}){
 class El extends EventTarget{hidden=false;dataset={};attributes={};style={};setAttribute(k,v){this.attributes[k]=v;}}
 const menu=new El();menu.hidden=true;const video=new El();Object.assign(video,{volume:1,currentTime:0,ended:false,readyState:0,networkState:videoError?3:1,paused:true,plays:0,play(){this.plays++;this.paused=false;return playResult();},pause(){this.paused=true;}});
 const plate=new El(),glow=new El(),controls=new El(),doc=new El();doc.documentElement={hasAttribute:()=>doc.locked};
 let paints=0,clears=0;glow.getContext=()=>({createImageData:()=>({data:bytes()}),putImageData(){paints++;},clearRect(){clears++;}});
 let cb=new Map(),counter=0,time=0;const win={MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame(fn){cb.set(++counter,fn);return counter;},cancelAnimationFrame(id){cb.delete(id);}};
 const fx=createMenuMarquee({menu,video,plate,glow,controls,doc,win});
 return {menu,video,plate,glow,controls,doc,fx,get pending(){return cb.size;},get paints(){return paints;},get clears(){return clears;},get phase(){return menu.dataset.marqueePhase;},open(){menu.hidden=false;fx.sync();},close(){menu.hidden=true;fx.sync();},end(){video.ended=true;video.dispatchEvent(new Event('ended'));},step(ms){for(let t=0;t<ms;t+=50){time+=Math.min(50,ms-t);const callbacks=[...cb.values()];cb.clear();for(const fn of callbacks)fn(time);}}};
}
test('intro plays once, then live light repeats without replaying the video; close and reopen resets',()=>{
 const f=fixture();assert.equal(f.phase,'closed');assert.equal(f.video.volume,.2);f.open();assert.equal(f.phase,'video');assert.equal(f.video.plays,1);assert.equal(f.plate.hidden,true);
 f.end();assert.equal(f.phase,'handoff');f.step(750);assert.equal(f.phase,'settled');assert.equal(f.video.hidden,true);assert.equal(f.plate.hidden,false);f.step(11000);assert.ok(f.paints>90);assert.equal(f.video.plays,1);assert.equal(f.pending,1);
 f.close();assert.equal(f.pending,0);assert.equal(f.phase,'closed');assert.equal(f.video.currentTime,0);f.video.ended=false;f.open();assert.equal(f.video.plays,2);f.fx.dispose();assert.equal(f.pending,0);assert.equal(f.video.paused,true);
});
test('lock, visibility and controls suspend both media and glow; stale play rejection does not affect reopened menu',async()=>{
 let reject;let count=0;const f=fixture({playResult:()=>++count===1?new Promise((_,r)=>reject=r):Promise.resolve()});f.open();f.close();f.open();reject(Error('old request'));await Promise.resolve();assert.equal(f.phase,'video');
 for(const [obj,key] of [[f.doc,'hidden'],[f.doc,'locked'],[f.controls,'open']]){obj[key]=true;f.fx.sync();assert.equal(f.pending,0);assert.equal(f.video.paused,true);obj[key]=false;f.fx.sync();assert.equal(f.video.paused,false);}
 f.end();f.step(1150);const paints=f.paints;f.doc.locked=true;f.fx.sync();f.step(1000);assert.equal(f.paints,paints);assert.equal(f.pending,0);f.doc.locked=false;f.fx.sync();f.step(200);assert.ok(f.paints>paints);f.fx.dispose();
});
test('menu animates without an optional motion control and remains animated after resync',()=>{
 const f=fixture();f.open();assert.equal(f.phase,'video');assert.equal(f.video.plays,1);f.end();f.step(1250);const paints=f.paints;f.fx.sync();f.step(500);assert.ok(f.paints>paints);assert.equal(f.pending,1);assert.equal(f.video.plays,1);f.fx.dispose();
});
test('rejected, missing and stalled media always end on the original logo and live neon',async()=>{
 for(const opts of [{videoError:true},{playResult:()=>Promise.reject(Error('blocked'))},{}]){
  const f=fixture(opts);f.open();await Promise.resolve();if(f.phase==='video')f.step(9200);assert.equal(f.phase,'fallback');f.step(2300);assert.equal(f.phase,'settled');assert.equal(f.video.hidden,true);f.step(300);assert.ok(f.paints>0);f.fx.dispose();
 }
});
test('actual markup and lifecycle wire the presentation without changing lock controls or logo artwork',()=>{
 const html=readFileSync(new URL('../rg/index.html',import.meta.url),'utf8'),js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 assert.match(html,/id="rg-marquee-plate" hidden/);assert.match(html,/assets\/provided\/sign\.png/);assert.doesNotMatch(html,/rg-menu-motion|MOTION: (?:ON|OFF)/);assert.doesNotMatch(js,/motionButton:/);assert.match(html,/data-host-lock type="button">LOCK HOST/);
 assert.match(js,/createMenuMarquee\(\{menu:pauseMenu/);assert.match(js,/menuPresentation\.dispose\(\)/);assert.equal((js.match(/menuPresentation\.sync\(\)/g)||[]).length,4);
});

test('video fades by media time and final frame crossfades without a blank or dark midpoint',()=>{
 const f=fixture();f.open();assert.equal(f.video.style.opacity,'0');
 f.step(1500);assert.equal(f.video.style.opacity,'0'); // stalled decoding doesn't consume the fade
 f.video.currentTime=.16;f.step(50);assert.equal(Number(f.video.style.opacity),.5);
 f.video.currentTime=.32;f.step(50);assert.equal(f.video.style.opacity,'1');
 f.end();assert.equal(f.phase,'handoff');assert.equal(f.plate.hidden,false);assert.equal(f.video.hidden,false);
 assert.equal(f.plate.style.opacity,'0');assert.equal(f.video.style.opacity,'1');
 f.step(350);assert.ok(Number(f.plate.style.opacity)>.5&&Number(f.plate.style.opacity)<1);assert.equal(f.video.style.opacity,'1');
 let previousPlate=Number(f.plate.style.opacity),previousVideo=Number(f.video.style.opacity);
 while(f.phase==='handoff'){
  f.step(50);if(f.phase!=='handoff')break;
  const a=Number(f.plate.style.opacity),b=Number(f.video.style.opacity);
  assert.ok(a>=previousPlate&&b<=previousVideo);assert.ok(a+b*(1-a)>.98);
  previousPlate=a;previousVideo=b;
 }
 assert.equal(f.video.hidden,true);assert.equal(f.plate.style.opacity,'');assert.equal(f.glow.style.opacity,'0');
 f.step(200);assert.ok(Number(f.glow.style.opacity)>0&&Number(f.glow.style.opacity)<1);
 f.step(400);assert.equal(f.glow.style.opacity,'1');f.step(10000);assert.equal(f.glow.style.opacity,'1');f.fx.dispose();
});
test('crossfade freezes during hidden/locked/dialog state, resumes once, and resets on reopening',()=>{
 const f=fixture();f.open();f.end();f.step(300);
 for(const [obj,key] of [[f.doc,'hidden'],[f.doc,'locked'],[f.controls,'open']]){
  const before=f.plate.style.opacity;obj[key]=true;f.fx.sync();f.step(1000);
  assert.equal(f.plate.style.opacity,before);assert.equal(f.pending,0);assert.equal(f.video.paused,true);
  obj[key]=false;f.fx.sync();f.step(100);assert.equal(f.video.plays,1);
 }
 f.close();assert.equal(f.phase,'closed');assert.equal(f.pending,0);assert.equal(f.plate.hidden,true);assert.equal(f.video.hidden,true);
 f.video.ended=false;f.open();assert.equal(f.phase,'video');assert.equal(f.video.style.opacity,'0');assert.equal(f.plate.hidden,true);assert.equal(f.video.plays,2);f.fx.dispose();
});
test('media error during handoff leaves the original logo immediately visible',()=>{
 const f=fixture();f.open();f.end();f.step(100);f.video.dispatchEvent(new Event('error'));
 assert.equal(f.phase,'settled');assert.equal(f.plate.hidden,false);assert.equal(f.plate.style.opacity,'');assert.equal(f.video.hidden,true);f.fx.dispose();
});
