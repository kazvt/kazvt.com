import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MENU_KARAOKE_CUES as cues,MENU_KARAOKE_DURATION as duration} from './menu-karaoke-cues.mjs';
import {karaokeFrame,validateKaraokeCues,createMenuKaraoke,readKaraokeCalibration,validateKaraokeCalibration,KARAOKE_CALIBRATION_KEY,karaokeBounce,karaokeWordPose} from './menu-karaoke.mjs';

test('theme cue sheet has valid monotonic word timing and the entire supplied lyric in order',()=>{
 assert.equal(validateKaraokeCues(cues,duration),cues);assert.equal(cues[0].start,0);assert.equal(cues.at(-1).end,duration);assert.equal(cues.length,35);
 const lyric=cues.flatMap(c=>c.words.map(w=>w[0])).join(' ');
 const chorus='as the cards go shuffling all night long (ramble gamble) and they shout oh lillie is at the table (ramble gamble) place your bets and come and sing along (ramble gamble)';
 assert.equal(lyric,`yippee-yay, the house is gonna win again, today i got chips lets ramble ramble gamble (ramble gamble) ${chorus} oh dealer lillie (oh dealer lillie) oh dealer lillie (oh dealer lillie) though i thought i know the answer now my confidence is gone oh lucky ace (oh what a scam) oh lucky ace (oh what a scam) i walked in with royal swagger now i got a poker face cause i got chips lets ramble ramble gamble (ramble gamble) ${chorus} oh dealer lillie (oh dealer lillie) oh dealer lillie (oh dealer lillie) though i thought my hand was winning smeemo grinned and took my chips!? well i got chips lets ramble ramble gamble (ramble gamble) ${chorus} burgata babara (oh dealer lillie) bargata gatagattara (oh dealer lillie) bargata bumbumbumbumbumbumbumbum bargataba tum tagum bargata gata gatibati gatibati gatibati gatibati booom bargata booom bargata bun dum bum bum bum bargata bum bun weird bululub`);
 assert.equal(cues.flatMap(c=>c.words).length,240);
});
test('media-clock lookup selects every individual word and resets on seek, loop and instrumental',()=>{
 for(const [i,c] of cues.entries()){
  assert.equal(karaokeFrame(c.start).index,i);
  for(const [j,w] of c.words.entries()){
   assert.deepEqual(karaokeFrame(w[1]),{index:i,word:j,progress:0});
   const frame=karaokeFrame((w[1]+w[2])/2);assert.equal(frame.index,i);assert.equal(frame.word,j);assert.ok(Math.abs(frame.progress-.5)<1e-8);
  }
 }
 assert.equal(karaokeFrame(100).word,-1);assert.equal(karaokeFrame(duration).index,-1);assert.equal(karaokeFrame(0).index,0);assert.equal(karaokeFrame(NaN).index,-1);
 const malformed=structuredClone(cues);malformed[1].words[0][2]=100;assert.throws(()=>validateKaraokeCues(malformed),/Invalid word/);
});
function fixture(){
 const motion={matches:false};
 class El{constructor(){this.hidden=false;this.children=[];this.dataset={};this.textContent='';this.style={setProperty(k,v){this[k]=v;}};}getBoundingClientRect(){return {left:10,top:20,width:50,height:20};}get childElementCount(){return this.children.length;}append(n){this.children.push(n);}replaceChildren(){this.children=[];this.textContent='';}querySelector(sel){return this.map?.[sel];}}
 const root=new El(),menu=new El();root.hidden=true;root.map=Object.fromEntries(['lead','response','particles','ball'].map(k=>['.rg-karaoke-'+k,new El()]));
 const theme={paused:true,ended:false,error:null,readyState:4,currentTime:0};const doc={createElement:()=>new El()},win={matchMedia:()=>motion};const fx=createMenuKaraoke({root,menu,theme,doc,win});return {root,menu,theme,fx,motion,lead:root.map['.rg-karaoke-lead'],back:root.map['.rg-karaoke-response'],particles:root.map['.rg-karaoke-particles']};
}
test('karaoke remains hidden before actual theme playback; keeps exact progress when media time freezes; handles seeks and response grouping',()=>{
 const f=fixture();f.fx.update(true);assert.equal(f.root.hidden,true);f.theme.paused=false;f.theme.currentTime=13;f.fx.update(false);assert.equal(f.root.hidden,true);
 f.fx.update(true);assert.equal(f.root.hidden,false);assert.equal(f.menu.dataset.karaokeActive,'true');assert.equal(f.lead.children.length,7);assert.equal(f.back.children.length,2);assert.equal(f.particles.children.length,2);
 const c=cues[3];f.theme.currentTime=(c.words[1][1]+c.words[1][2])/2;f.fx.update();assert.equal(f.lead.children[1].dataset.state,'active');assert.equal(f.lead.children[1].style['--sweep'],'50.0%');f.fx.update();assert.equal(f.lead.children[1].style['--sweep'],'50.0%');
 f.theme.currentTime=c.words[0][1];f.fx.update();assert.equal(f.lead.children[0].dataset.state,'active');assert.equal(f.lead.children[1].dataset.state,'waiting');
 f.theme.currentTime=100;f.fx.update();assert.equal(f.root.dataset.section,'instrumental');assert.equal(f.back.hidden,true);f.theme.currentTime=0;f.fx.update();assert.equal(f.root.dataset.section,'instrumental');
 f.theme.paused=true;f.fx.update();assert.equal(f.root.hidden,true);f.theme.paused=false;f.theme.currentTime=13;f.fx.update();assert.equal(f.root.hidden,false);f.fx.hide();assert.equal(f.root.hidden,true);f.fx.dispose();assert.equal(f.particles.children.length,0);
});
test('the renderer is a safe optional feature and production menu uses existing audio lifecycle',()=>{
 const no=createMenuKaraoke({root:null,menu:null,theme:null,doc:{},win:{}});no.update();no.hide();no.dispose();
 const html=readFileSync(new URL('../rg/index.html',import.meta.url),'utf8'),main=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8'),marquee=readFileSync(new URL('./menu-marquee.mjs',import.meta.url),'utf8');
 assert.match(html,/id="rg-menu-karaoke"[^>]*hidden/);assert.match(html,/menu-karaoke\.css\?v=menu-karaoke/);assert.match(main,/karaokeRoot:document.getElementById\("rg-menu-karaoke"\)/);assert.match(marquee,/theme\.pause\(\);karaoke\.hide\(\)/);assert.match(marquee,/karaoke\.update\(phase==='handoff'\|\|phase==='settled'\)/);assert.match(marquee,/stopTheme\(true\);karaoke\.dispose\(\)/);
});

test('revised final-mix acoustic anchor estimates are represented, with full lyric and duration invariants',()=>{
 assert.equal(cues[1].words[0][1],1.81);assert.equal(cues[1].words[5][1],5.81);
 assert.equal(cues[6].words[7][1],24.78);assert.equal(cues[18].words[7][1],66.52);
 assert.ok(Math.abs((cues[18].words[7][1]-cues[6].words[7][1])-41.74)<.001);
 assert.equal(cues[27].start,157.45);assert.equal(cues[28].start,163.72);
});
test('optional browser calibration is exact-recording scoped, validated, and fails safely',()=>{
 assert.deepEqual(readKaraokeCalibration({}),cues);assert.deepEqual(readKaraokeCalibration({get localStorage(){throw Error('blocked')}}),cues);
 const revised=structuredClone(cues);revised[1].words[0][2]=4.26;revised[1].words[1][1]=4.26;
 const win={localStorage:{getItem:k=>{assert.equal(k,KARAOKE_CALIBRATION_KEY);return JSON.stringify(revised)}}};
 assert.deepEqual(readKaraokeCalibration(win),revised);assert.equal(validateKaraokeCalibration(revised),revised);
 revised[1].words[1][0]='different';assert.throws(()=>validateKaraokeCalibration(revised),/preserve/);assert.deepEqual(readKaraokeCalibration(win),cues);
 revised[1].words[1][0]=cues[1].words[1][0];revised[1].words[1][1]=-1;assert.deepEqual(readKaraokeCalibration(win),cues);
});


test('retro marker lands on the current word and advances monotonically on the same row',()=>{
 const a={x:20,y:30},b={x:70,y:30},other={x:5,y:65};
 assert.equal(karaokeBounce(0,a,b).x,20);assert.equal(karaokeBounce(1,a,b).x,70);
 assert.equal(karaokeBounce(0,a,b).y,30);assert.ok(karaokeBounce(.6,a,b).y<20);
 let prev=20;for(let i=0;i<=100;i++){const p=karaokeBounce(i/100,a,b);assert.ok(p.x>=prev-1e-8);assert.ok(p.y<=30+1e-8);prev=p.x;}
 for(let i=0;i<=100;i++)assert.equal(karaokeBounce(i/100,a,other).x,20);
 assert.ok(karaokeWordPose(0).sx>1&&karaokeWordPose(0).sy<1);assert.ok(karaokeWordPose(.3).sy>1);assert.deepEqual(karaokeWordPose(1),{sx:1,sy:1});
});
test('retro karaoke uses only lyric rows, notes and a single ball, no chrome',()=>{
 const html=readFileSync(new URL('../rg/index.html',import.meta.url),'utf8');
 assert.match(html,/class="rg-karaoke-ball"[^>]*hidden/);assert.doesNotMatch(html,/rg-karaoke-(ribbon|deck|label|next|track|progress)/);
 const f=fixture();f.theme.paused=false;f.theme.currentTime=13;f.fx.update();assert.equal(f.particles.children.length,2);
 const w=f.lead.children[0];assert.equal(w.children[0].className,'rg-karaoke-ink');assert.equal(w.children[0].textContent,'i');
});

test('music-note bursts alternate one and two and never exceed two across playback or seeks',()=>{
 const f=fixture();f.theme.paused=false;
 const visible=()=>f.particles.children.filter(n=>Number(n.style.opacity)>0).length;
 for(const c of cues){
  for(const [j,w] of c.words.entries()){
   f.theme.currentTime=w[1]+Math.min(.15,(w[2]-w[1])/2);f.fx.update();
   assert.equal(visible(),1+j%2);assert.equal(f.particles.children.length,2);
  }
 }
 const words=cues[3].words;
 for(const j of [1,0,1,0]){f.theme.currentTime=(words[j][1]+words[j][2])/2;f.fx.update();assert.equal(visible(),1+j%2);}
 f.motion.matches=true;f.fx.update();assert.equal(visible(),0);
 f.motion.matches=false;f.fx.update();assert.equal(visible(),1);
 f.theme.currentTime=9;f.fx.update();assert.equal(visible(),0);assert.equal(f.lead.textContent,'♪ ♫');
 f.fx.hide();assert.equal(visible(),0);
});

test('opening instrumental break clears lyrics and marker until the delayed first chorus',()=>{
 const f=fixture();f.theme.paused=false;f.theme.currentTime=8;f.fx.update();assert.ok(f.lead.children.length>0);
 assert.equal(cues[1].end,8.53);assert.deepEqual(cues[2],{section:'instrumental',start:8.53,end:12.6,words:[]});
 for(const t of [8.53,9,11,12.599]){f.theme.currentTime=t;f.fx.update();assert.equal(f.root.dataset.section,'instrumental');assert.equal(f.lead.children.length,0);assert.equal(f.back.children.length,0);assert.equal(f.root.map['.rg-karaoke-ball'].hidden,true);assert.equal(karaokeFrame(t).word,-1);}
 f.theme.currentTime=12.6;f.fx.update();assert.equal(f.lead.children[0].dataset.word,'i');assert.equal(f.lead.children[0].dataset.state,'active');
 f.theme.currentTime=9;f.fx.update();assert.equal(f.lead.children.length,0);assert.equal(cues.at(-1).start,193.55);assert.equal(cues.at(-1).end,duration);
});
