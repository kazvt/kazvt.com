import {MENU_KARAOKE_CUES} from './menu-karaoke-cues.mjs?v=curtain-karaoke-20261128-v1';

// Per-recording opt-in calibration. Never read a correction for a different
// mix or accept changed lyric text/sections. Storage may be blocked in private mode.
export const KARAOKE_CALIBRATION_KEY='rg.menu-karaoke.calibration.7485aa4feaf5557e2688b1ecf4fe448d96ec7e33d2388842096cd4d319258ec5.v2';
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
const colors = ['#ffe68c','#ff8ee4','#93f8dc','#bda4ff','#ffd2ad'];
const symbols = ['✿','✦','❀','♦','✧','♡','✿','♣'];
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
export function createMenuKaraoke({root,menu,theme,doc=document,win=window,cues}) {
  if(!root) return noop();
  cues??=readKaraokeCalibration(win);
  try{validateKaraokeCues(cues);}catch(error){console.warn("Menu karaoke cues unavailable",error);root.hidden=true;return noop();}
  const lead=root.querySelector('.rg-karaoke-lead'),back=root.querySelector('.rg-karaoke-response'),next=root.querySelector('.rg-karaoke-next'),particles=root.querySelector('.rg-karaoke-particles'),bar=root.querySelector('.rg-karaoke-progress'),label=root.querySelector('.rg-karaoke-label');
  if(!lead||!back||!next||!particles||!bar||!label){root.hidden=true;return noop();}
  let index=-2, nodes=[],last=NaN,lastWord=-2,visible=false,anchorX=0,anchorY=0;
  const mot=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const fx=Array.from({length:24},(_,i)=>{const n=doc.createElement('span');n.textContent=symbols[i%symbols.length];n.style.color=colors[i%colors.length];particles.append(n);return n;});
  function hide(){if(visible){root.hidden=true;menu.dataset.karaokeActive='false';visible=false;}index=-2;last=NaN;lastWord=-2;}
  function populate(cue,i){
    lead.replaceChildren();back.replaceChildren();nodes=[];lastWord=-2;
    root.dataset.section=cue.section;
    root.style.setProperty('--rg-karaoke-hue',colors[i%colors.length]);
    label.textContent=cue.section==='instrumental'?'♪  INSTRUMENTAL  ♪':cue.section==='scat'?'✦  SCAT FINALE  ✦':'✿  RAMBLE GAMBLE  •  SING ALONG  ✿';
    let response=false;
    if(!cue.words.length){lead.textContent='♫';}
    for(const [word] of cue.words){
      if(word.startsWith('('))response=true;
      const n=doc.createElement('span');n.className='rg-karaoke-word';n.textContent=word;n.dataset.word=word;
      n.style.setProperty('--sweep','0%');n.style.setProperty('--word-hue',response?['#8ef7d8','#a7d7ff','#ffe5a0'][nodes.length%3]:colors[(i+nodes.length)%colors.length]);(response?back:lead).append(n);nodes.push(n);
      if(word.endsWith(')'))response=false;
    }
    back.hidden=!back.childElementCount;
    const upcoming=cues.slice(i+1).find(c=>c.words.length);
    next.textContent=upcoming?upcoming.words.map(w=>w[0]).join(' '):'';
    // The instrumental uses a small centered note instead of displaying lyrics early.
    next.hidden=!upcoming||cue.section==='instrumental';
  }
  function update(allowed=true){
    if(!allowed||theme.paused||theme.ended||theme.error||theme.readyState<2||!Number.isFinite(theme.currentTime)){hide();return;}
    const t=theme.currentTime;
    if(!visible){visible=true;root.hidden=false;menu.dataset.karaokeActive='true';}
    const state=karaokeFrame(t,cues);
    if(state.index<0){if(index!==-1){index=-1;lead.replaceChildren();back.replaceChildren();back.hidden=true;next.hidden=true;label.textContent='♪  RAMBLE GAMBLE  ♪';bar.style.transform='scaleX(0)';for(const n of fx)n.style.opacity='0';}return;}
    const cue=cues[state.index],changed=state.index!==index;
    if(changed){index=state.index;populate(cue,index);}
    if(!changed&&t===last)return;
    last=t;
    // No independent elapsed clock. Native looping, buffering, rate changes and
    // seeks automatically update the lyric and all visual effect phases.
    const progress=clamp((t-cue.start)/(cue.end-cue.start));
    bar.style.transform=`scaleX(${progress})`;
    const wordChanged=state.word!==lastWord||changed;
    if(wordChanged){
      for(let j=0;j<nodes.length;j++){
        const w=cue.words[j],n=nodes[j];n.dataset.state=t>=w[2]?'done':j===state.word?'active':'waiting';
        n.style.setProperty('--sweep',t>=w[2]?'100%':'0%');n.style.setProperty('--hop','0px');
      }
      lastWord=state.word;
      if(state.word>=0&&nodes[state.word].getBoundingClientRect&&root.getBoundingClientRect){
        const r=root.getBoundingClientRect(),w=nodes[state.word].getBoundingClientRect();
        anchorX=w.left+w.width/2-r.left-r.width/2;anchorY=w.top+w.height/2-r.top-r.height/2;
      }else{anchorX=0;anchorY=0;}
    }
    if(state.word>=0){const n=nodes[state.word];n.style.setProperty('--sweep',`${(state.progress*100).toFixed(1)}%`);n.style.setProperty('--hop',mot?.matches?'0px':`${(-Math.sin(Math.PI*clamp(state.progress*2))*3).toFixed(2)}px`);}
    // Bounded reusable sprites. Phase driven by audio, no per-frame allocation or timers.
    const beat=t/ (60/92),frac=beat-Math.floor(beat);
    root.style.setProperty('--beat-glow',String(.35+.25*Math.sin(Math.PI*frac)));
    if(!mot?.matches){
      const local=state.word>=0?t-cue.words[state.word][1]:t-cue.start;
      for(let j=0;j<fx.length;j++){
        const n=fx[j],phase=(local*(.9+(j%4)*.1)+j*.137)%1;
        const side=j%2===0?-1:1,spread=12+(j%6)*6;
        const burst=j<10&&state.word>=0;
        const age=clamp(local/.72),angle=j*2.39996,radius=17+age*(22+j%4*9);
        const x=burst?`${anchorX+Math.cos(angle)*radius}px`:`${side*(14+phase*spread)}vw`;
        const y=burst?anchorY-18+Math.sin(angle)*radius*.55-14*age:6-27*phase+Math.sin(j*2.1)*9;
        n.style.transform=`translate(${x},${y}px) rotate(${side*(phase*110+j*11)}deg) scale(${.65+.45*Math.sin(Math.PI*phase)})`;
        n.style.opacity=String(burst?Math.sin(Math.PI*age)*.75:Math.sin(Math.PI*phase)*(.34+(j%3)*.16));
      }
    }
  }
  function dispose(){hide();particles.replaceChildren();lead.replaceChildren();back.replaceChildren();}
  return {update,hide,dispose};
}
