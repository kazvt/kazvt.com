import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MENU_KARAOKE_CUES as cues,MENU_KARAOKE_DURATION as duration} from './menu-karaoke-cues.mjs';
import {karaokeFrame,validateKaraokeCues,createMenuKaraoke,readKaraokeCalibration,validateKaraokeCalibration,KARAOKE_CALIBRATION_KEY,karaokeBounce,karaokeWordPose} from './menu-karaoke.mjs';

const wordsOf=cue=>cue.words.map(w=>w[0]);
const responsesOf=cue=>cue.responses.flatMap(r=>r.words.map(w=>w[0]));

test('cue sheet validates both voice tracks and retains every lyric token exactly once',()=>{
 assert.equal(validateKaraokeCues(cues,duration),cues);assert.equal(cues[0].start,0);assert.equal(cues.at(-1).end,duration);assert.equal(cues.length,35);
 const lead=cues.flatMap(wordsOf),backing=cues.flatMap(responsesOf);
 assert.equal(lead.length,190);assert.equal(backing.length,50);assert.equal(lead.length+backing.length,240);
 assert.equal(lead.join(' '),'yippee-yay, the house is gonna win again, today i got chips lets ramble ramble gamble as the cards go shuffling all night long and they shout oh lillie is at the table place your bets and come and sing along oh dealer lillie oh dealer lillie though i thought i know the answer now my confidence is gone oh lucky ace oh lucky ace i walked in with royal swagger now i got a poker face cause i got chips lets ramble ramble gamble as the cards go shuffling all night long and they shout oh lillie is at the table place your bets and come and sing along oh dealer lillie oh dealer lillie though i thought my hand was winning smeemo grinned and took my chips!? well i got chips lets ramble ramble gamble as the cards go shuffling all night long and they shout oh lillie is at the table place your bets and come and sing along burgata babara bargata gatagattara bargata bumbumbumbumbumbumbumbum bargataba tum tagum bargata gata gatibati gatibati gatibati gatibati booom bargata booom bargata bun dum bum bum bum bargata bum bun weird bululub');
 assert.equal(backing.join(' '),'ramble gamble ramble gamble ramble gamble ramble gamble oh dealer lillie oh dealer lillie oh what a scam oh what a scam ramble gamble ramble gamble ramble gamble ramble gamble ramble gamble ramble gamble ramble gamble oh dealer lillie oh dealer lillie oh dealer lillie oh dealer lillie ramble gamble ramble gamble ramble gamble ramble gamble oh dealer lillie oh dealer lillie');
});

test('media-time lookup follows both independent voices through overlap, gaps and seeks',()=>{
 for(const [i,c] of cues.entries())for(const [j,w] of c.words.entries()){
  const onset=karaokeFrame(w[1]);assert.equal(onset.index,i);assert.equal(onset.word,j);assert.equal(onset.progress,0);
  const middle=karaokeFrame((w[1]+w[2])/2);assert.equal(middle.index,i);assert.equal(middle.word,j);assert.ok(Math.abs(middle.progress-.5)<1e-8);
 }
 for(const [cueIndex,c] of cues.entries())for(const [group,r] of c.responses.entries())for(const [wordIndex,w] of r.words.entries()){
  const onset=karaokeFrame(w[1]);assert.equal(onset.responseIndex,cueIndex);assert.equal(onset.responseGroup,group);assert.equal(onset.responseWord,wordIndex);assert.equal(onset.responseProgress,0);
  const middle=karaokeFrame((w[1]+w[2])/2);assert.equal(middle.responseWord,wordIndex);assert.ok(Math.abs(middle.responseProgress-.5)<1e-8);
 }
 // Backing is already active while the next lead lyric is on screen; scat overlap is not serialized.
 assert.equal(karaokeFrame(16.4).word,6);assert.equal(karaokeFrame(16.4).responseWord,0);
 assert.equal(karaokeFrame(164.9).index,27);assert.equal(karaokeFrame(164.9).responseIndex,28);assert.equal(karaokeFrame(164.9).responseWord,0);
 assert.equal(karaokeFrame(100).word,-1);assert.equal(karaokeFrame(duration).index,-1);assert.equal(karaokeFrame(0).index,0);assert.equal(karaokeFrame(NaN).index,-1);
 const malformed=structuredClone(cues);malformed[1].words[0][2]=100;assert.throws(()=>validateKaraokeCues(malformed),/Invalid lead word/);
 const badResponse=structuredClone(cues);badResponse[3].responses[0].words[1][1]=badResponse[3].responses[0].words[0][2]-.1;assert.throws(()=>validateKaraokeCues(badResponse),/Invalid response word/);
});

function fixture(){
 const motion={matches:false};
 class El{constructor(){this.hidden=false;this.children=[];this.dataset={};this.textContent='';this.style={setProperty(k,v){this[k]=v;}};}getBoundingClientRect(){return {left:10,top:20,width:50,height:20};}get childElementCount(){return this.children.length;}append(n){this.children.push(n);}replaceChildren(){this.children=[];this.textContent='';}querySelector(sel){return this.map?.[sel];}}
 const root=new El(),menu=new El();root.hidden=true;root.map=Object.fromEntries(['lead','response','particles','ball'].map(k=>['.rg-karaoke-'+k,new El()]));
 const theme={paused:true,ended:false,error:null,readyState:4,currentTime:0};const doc={createElement:()=>new El()},win={matchMedia:()=>motion};const fx=createMenuKaraoke({root,menu,theme,doc,win});return {root,menu,theme,fx,motion,lead:root.map['.rg-karaoke-lead'],back:root.map['.rg-karaoke-response'],particles:root.map['.rg-karaoke-particles']};
}

test('renderer displays a separate backing row, sweeps each word, and retains the existing audio lifecycle',()=>{
 const f=fixture();f.fx.update(true);assert.equal(f.root.hidden,true);f.theme.paused=false;f.theme.currentTime=13;f.fx.update(false);assert.equal(f.root.hidden,true);
 f.fx.update(true);assert.equal(f.root.hidden,false);assert.equal(f.menu.dataset.karaokeActive,'true');assert.equal(f.lead.children.length,7);assert.equal(f.back.children.length,2);assert.equal(f.particles.children.length,2);
 assert.equal(f.back.children[0].children[0].textContent,'ramble');
 f.theme.currentTime=16.4;f.fx.update();assert.equal(f.lead.children[6].dataset.state,'active');assert.equal(f.back.children[0].dataset.state,'active');assert.equal(f.back.children[0].style['--sweep'],'32.3%');
 f.theme.currentTime=100;f.fx.update();assert.equal(f.root.dataset.section,'instrumental');assert.equal(f.back.hidden,true);
 f.theme.currentTime=0;f.fx.update();assert.equal(f.root.dataset.section,'instrumental');
 f.theme.paused=true;f.fx.update();assert.equal(f.root.hidden,true);f.theme.paused=false;f.theme.currentTime=13;f.fx.update();assert.equal(f.root.hidden,false);f.fx.hide();assert.equal(f.root.hidden,true);f.fx.dispose();assert.equal(f.particles.children.length,0);
 const html=readFileSync(new URL('../rg/index.html',import.meta.url),'utf8'),main=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8'),marquee=readFileSync(new URL('./menu-marquee.mjs',import.meta.url),'utf8');
 assert.match(html,/id="rg-menu-karaoke"[^>]*hidden/);assert.match(html,/menu-karaoke\.css\?v=menu-karaoke/);assert.match(main,/karaokeRoot:document.getElementById\("rg-menu-karaoke"\)/);assert.match(marquee,/theme\.pause\(\);karaoke\.hide\(\)/);assert.match(marquee,/karaoke\.update\(phase==='handoff'\|\|phase==='settled'\)/);assert.match(marquee,/stopTheme\(true\);karaoke\.dispose\(\)/);
});

test('optional calibration is recording-scoped and cannot alter words, voice assignments, or sections',()=>{
 assert.deepEqual(readKaraokeCalibration({}),cues);assert.deepEqual(readKaraokeCalibration({get localStorage(){throw Error('blocked')}}),cues);
 const revised=structuredClone(cues);revised[1].words[0][2]=4.26;revised[1].words[1][1]=4.26;
 const win={localStorage:{getItem:k=>{assert.equal(k,KARAOKE_CALIBRATION_KEY);return JSON.stringify(revised)}}};
 assert.deepEqual(readKaraokeCalibration(win),revised);assert.equal(validateKaraokeCalibration(revised),revised);
 revised[1].responses[0]?.words[0]&&(revised[1].responses[0].words[0][0]='changed');assert.throws(()=>validateKaraokeCalibration(revised),/preserve/);assert.deepEqual(readKaraokeCalibration(win),cues);
 const moved=structuredClone(cues);moved[3].responses[0].words[0][1]+=.1;assert.equal(validateKaraokeCalibration(moved),moved);
});

test('retro marker lands on the current word and advances monotonically on the same row',()=>{
 const a={x:20,y:30},b={x:70,y:30},other={x:5,y:65};
 assert.equal(karaokeBounce(0,a,b).x,20);assert.equal(karaokeBounce(1,a,b).x,70);assert.equal(karaokeBounce(0,a,b).y,30);assert.ok(karaokeBounce(.6,a,b).y<20);
 let prev=20;for(let i=0;i<=100;i++){const p=karaokeBounce(i/100,a,b);assert.ok(p.x>=prev-1e-8);assert.ok(p.y<=30+1e-8);prev=p.x;}
 for(let i=0;i<=100;i++)assert.equal(karaokeBounce(i/100,a,other).x,20);
 assert.ok(karaokeWordPose(0).sx>1&&karaokeWordPose(0).sy<1);assert.ok(karaokeWordPose(.3).sy>1);assert.deepEqual(karaokeWordPose(1),{sx:1,sy:1});
});

test('karaoke remains a minimal two-row overlay and preserves accessibility behavior',()=>{
 const html=readFileSync(new URL('../rg/index.html',import.meta.url),'utf8');assert.match(html,/class="rg-karaoke-ball"[^>]*hidden/);assert.doesNotMatch(html,/rg-karaoke-(ribbon|deck|label|next|track|progress)/);
 const css=readFileSync(new URL('./menu-karaoke.css',import.meta.url),'utf8');assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/@media\(forced-colors:active\)/);
 const f=fixture();f.theme.paused=false;f.theme.currentTime=16.4;f.fx.update();assert.equal(f.lead.children[6].dataset.state,'active');assert.equal(f.back.children[0].children[0].className,'rg-karaoke-ink');f.motion.matches=true;f.fx.update();assert.equal(f.particles.children.every(n=>Number(n.style.opacity)===0),true);f.fx.dispose();
});

test('opening break stays lyric-free and both tracks re-enter correctly after arbitrary seeks',()=>{
 const f=fixture();f.theme.paused=false;f.theme.currentTime=8;f.fx.update();assert.ok(f.lead.children.length>0);
 assert.equal(cues[1].end,8.18);assert.deepEqual(cues[2],{section:'instrumental',start:8.18,end:12.4,words:[],responses:[]});
 for(const t of [8.18,9,11,12.399]){f.theme.currentTime=t;f.fx.update();assert.equal(f.root.dataset.section,'instrumental');assert.equal(f.lead.children.length,0);assert.equal(f.back.children.length,0);assert.equal(f.root.map['.rg-karaoke-ball'].hidden,true);assert.equal(karaokeFrame(t).word,-1);}
 f.theme.currentTime=12.4;f.fx.update();assert.equal(f.lead.children[0].dataset.word,'i');assert.equal(f.lead.children[0].dataset.state,'active');
 f.theme.currentTime=164.9;f.fx.update();assert.equal(f.root.dataset.section,'chorus');assert.equal(f.lead.children.length,8);assert.equal(f.back.children.length,3);
 f.theme.currentTime=9;f.fx.update();assert.equal(f.lead.children.length,0);assert.equal(cues.at(-1).start,192.15);assert.equal(cues.at(-1).end,duration);
});

test('music-note bursts stay bounded and media seeks update the selected voice without duplicate timers',()=>{
 const f=fixture();f.theme.paused=false;const visible=()=>f.particles.children.filter(n=>Number(n.style.opacity)>0).length;
 for(const c of cues)for(const [j,w] of c.words.entries()){f.theme.currentTime=w[1]+Math.min(.15,(w[2]-w[1])/2);f.fx.update();assert.ok(f.lead.children.length===c.words.length);assert.equal(f.particles.children.length,2);assert.ok(visible()<=2);}
 for(const time of [16.4,20.8,164.9,43.9]){f.theme.currentTime=time;f.fx.update();assert.ok(f.back.children.length>0);assert.equal(f.particles.children.length,2);}
 f.fx.hide();assert.equal(visible(),0);f.fx.dispose();
});
