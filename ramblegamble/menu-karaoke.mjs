import {MENU_KARAOKE_CUES} from './menu-karaoke-cues.mjs?v=karaoke-break-20261128-v1';

// Per-recording opt-in calibration. Never read a correction for a different
// mix or accept changed lyric text/sections. Storage may be blocked in private mode.
export const KARAOKE_CALIBRATION_KEY='rg.menu-karaoke.calibration.7485aa4feaf5557e2688b1ecf4fe448d96ec7e33d2388842096cd4d319258ec5.v3';
export function validateKaraokeCalibration(cues){
  validateKaraokeCues(cues);
  if(cues.length!==MENU_KARAOKE_CUES.length||cues.some((c,i)=>c.section!==MENU_KARAOKE_CUES[i].section||c.words.length!==MENU_KARAOKE_CUES[i].words.length||c.words.some((w,j)=>w[0]!==MENU_KARAOKE_CUES[i].words[j][0])))throw new Error('Calibration must preserve the supplied lyrics and sections');
  return cues;
}
export function readKaraokeCalibration(win){
  try{const value=win?.localStorage?.getItem(KARAOKE_CALIBRATION_KEY);if(value)return validateKaraokeCalibration(JSON.parse(value));}catch{}
  return MENU_KARAOKE_CUES;
}
const clamp = x => Math.max(0, Math.min(1, x));
const noop=()=>({update(){},hide(){},dispose(){}});
const colors = ['#ffe000','#008cff','#ff3030'];
const symbols = ['♪','♫','♩','♬'];
export function validateKaraokeCues(cues, duration=198.288) {
  if (!Array.isArray(cues) || !cues.length) throw new Error('Empty karaoke cue list');
  let previous=0;
  for (const c of cues) {
    if (!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<previous-1e-6||c.end<=c.start||c.end>duration+.001||!Array.isArray(c.words)) throw new Error('Invalid cue bounds');
    let end=c.start;
    for (const w of c.words) {
      if (!Array.isArray(w)||typeof w[0]!=='string'||!w[0].trim()||!Number.isFinite(w[1])||!Number.isFinite(w[2])||w[1]<end-1e-6||w[2]<=w[1]||w[2]>c.end+1e-6) throw new Error('Invalid word bounds: '+w?.[0]);
      end=w[2];
    }
    previous=c.end;
  }
  return cues;
}
export function karaokeFrame(time,cues=MENU_KARAOKE_CUES) {
  if(!Number.isFinite(time)||time<0)return {index:-1,word:-1,progress:0};
  // Binary search is also correct after arbitrary seek, loop wrap or tab resume.
  let lo=0,hi=cues.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(cues[mid].start<=time)lo=mid+1;else hi=mid;}
  const index=lo-1,cue=cues[index];
  if(!cue||time>=cue.end)return {index:-1,word:-1,progress:0};
  const word=cue.words.findIndex(w=>time>=w[1]&&time<w[2]);
  const progress=word<0?0:clamp((time-cue.words[word][1])/(cue.words[word][2]-cue.words[word][1]));
  return {index,word,progress};
}
// Land on each word onset and travel toward the next word on the same visual
// row. On a line break relaunch above the new row rather than crossing text.
export function karaokeBounce(progress,from,to,amplitude=12){
  const p=clamp(progress),u=clamp((p-.16)/.84),sameRow=to&&Math.abs(to.y-from.y)<3;
  const travel=sameRow?u*u*(3-2*u):0;
  return {x:from.x+(sameRow?to.x-from.x:0)*travel,y:from.y-Math.sin(Math.PI*u)*amplitude,
    sx:1+.28*Math.max(0,1-p/.14),sy:1-.32*Math.max(0,1-p/.14)};
}
export function karaokeWordPose(progress){
  const p=clamp(progress),hit=Math.max(0,1-p/.16),stretch=Math.sin(Math.PI*clamp((p-.10)/.38));
  return {sx:1+.17*hit-.045*stretch,sy:1-.21*hit+.12*stretch};
}
export function createMenuKaraoke({root,menu,theme,doc=document,win=window,cues}) {
  if(!root) return noop();
  cues??=readKaraokeCalibration(win);
  try{validateKaraokeCues(cues);}catch(error){console.warn('Menu karaoke cues unavailable',error);root.hidden=true;return noop();}
  const lead=root.querySelector('.rg-karaoke-lead'),back=root.querySelector('.rg-karaoke-response'),particles=root.querySelector('.rg-karaoke-particles'),ball=root.querySelector('.rg-karaoke-ball');
  if(!lead||!back||!particles||!ball){root.hidden=true;return noop();}
  let index=-2,nodes=[],anchors=[],last=NaN,lastWord=-2,visible=false,dirty=true,wasReduced=false,disposed=false;
  const mot=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const fx=Array.from({length:8},(_,i)=>{const n=doc.createElement('span');n.textContent=symbols[i%symbols.length];n.style.color=colors[i%colors.length];particles.append(n);return n;});
  const clearFX=()=>{ball.hidden=true;for(const n of fx)n.style.opacity='0';};
  const invalidate=()=>{dirty=true;};
  // Only inner ink squashes; stable outer word boxes are measured on cue
  // changes and resizes, never on an ordinary animation frame.
  const observer=typeof win.ResizeObserver==='function'?new win.ResizeObserver(invalidate):null;
  observer?.observe(root);observer?.observe(lead);observer?.observe(back);
  win.addEventListener?.('resize',invalidate);
  function measure(){
    const r=root.getBoundingClientRect?.();
    anchors=r?nodes.map(n=>{const w=n.getBoundingClientRect?.();return w?{x:w.left+w.width/2-r.left,y:w.top-r.top-3,h:w.height,w:w.width}:null;}):[];
    dirty=false;
  }
  function hide(){if(visible){root.hidden=true;menu.dataset.karaokeActive='false';visible=false;}index=-2;last=NaN;lastWord=-2;dirty=true;clearFX();}
  function populate(cue){
    lead.replaceChildren();back.replaceChildren();nodes=[];lastWord=-2;dirty=true;clearFX();
    root.dataset.section=cue.section;
    let response=false;
    if(!cue.words.length){lead.textContent='♪ ♫ ♪';}
    for(const [word] of cue.words){
      if(word.startsWith('('))response=true;
      const n=doc.createElement('span'),ink=doc.createElement('span');n.className='rg-karaoke-word';n.dataset.word=word;
      ink.className='rg-karaoke-ink';ink.textContent=word;ink.dataset.word=word;n.append(ink);
      n.style.setProperty('--sweep','0%');(response?back:lead).append(n);nodes.push(n);
      if(word.endsWith(')'))response=false;
    }
    back.hidden=!back.childElementCount;
  }
  function update(allowed=true){
    if(disposed)return;
    if(!allowed||theme.paused||theme.ended||theme.error||theme.readyState<2||!Number.isFinite(theme.currentTime)){hide();return;}
    const t=theme.currentTime,reduced=Boolean(mot?.matches);
    if(!visible){visible=true;root.hidden=false;menu.dataset.karaokeActive='true';dirty=true;}
    const state=karaokeFrame(t,cues);
    if(state.index<0){if(index!==-1){index=-1;lastWord=-2;last=NaN;lead.replaceChildren();back.replaceChildren();back.hidden=true;clearFX();}return;}
    const cue=cues[state.index],changed=state.index!==index;
    if(changed){index=state.index;populate(cue);}
    if(!changed&&!dirty&&t===last&&reduced===wasReduced)return;
    if(dirty)measure();
    last=t;wasReduced=reduced;
    if(state.word!==lastWord||changed||state.word<0){
      for(let j=0;j<nodes.length;j++){
        const w=cue.words[j],n=nodes[j];n.dataset.state=t>=w[2]?'done':j===state.word?'active':'waiting';
        n.style.setProperty('--sweep',t>=w[2]?'100%':'0%');n.style.setProperty('--sx','1');n.style.setProperty('--sy','1');
      }
      lastWord=state.word;
    }
    if(state.word<0){clearFX();return;}
    const n=nodes[state.word],p=state.progress,pose=reduced?{sx:1,sy:1}:karaokeWordPose(p);
    const a=anchors[state.word],b=anchors[state.word+1];
    // Cap lateral overshoot by glyph height so even a very long scat token
    // cannot expand over neighbouring words. Keep the strong vertical squash.
    if(a?.w>0)pose.sx=Math.min(pose.sx,1+a.h*.14/a.w);
    n.style.setProperty('--sweep',`${(p*100).toFixed(1)}%`);n.style.setProperty('--sx',pose.sx.toFixed(4));n.style.setProperty('--sy',pose.sy.toFixed(4));
    if(reduced||!a){clearFX();return;}
    const hop=karaokeBounce(p,a,b,Math.min(11,a.h*.27));
    ball.hidden=false;ball.style.transform=`translate3d(${hop.x}px,${hop.y}px,0) translate(-50%,-100%) scale(${hop.sx},${hop.sy})`;
    // Bounded reusable music glyphs; phase follows actual media playback.
    const age=clamp((t-cue.words[state.word][1])/.5);
    for(let j=0;j<fx.length;j++){
      const side=j%2===0?-1:1,spread=13+(j%4)*9,x=a.x+side*(8+age*spread),y=Math.max(14,a.y-4-age*(6+(j%3)*5));
      fx[j].style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-100%) rotate(${side*(12+age*32)}deg) scale(${.7+.3*Math.sin(Math.PI*age)})`;
      fx[j].style.opacity=String(Math.sin(Math.PI*age)*.96);
    }
  }
  function dispose(){hide();disposed=true;observer?.disconnect();win.removeEventListener?.('resize',invalidate);particles.replaceChildren();lead.replaceChildren();back.replaceChildren();}
  return {update,hide,dispose};
}
