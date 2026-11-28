import {MENU_KARAOKE_CUES} from './menu-karaoke-cues.mjs?v=karaoke-parallel-20261128-v2';

// Per-recording opt-in calibration. Lyrics/sections/voice tracks are immutable.
export const KARAOKE_CALIBRATION_KEY='rg.menu-karaoke.calibration.7485aa4feaf5557e2688b1ecf4fe448d96ec7e33d2388842096cd4d319258ec5.v4';
export function validateKaraokeCalibration(cues){
  validateKaraokeCues(cues);
  const sameWords=(a,b)=>a.length===b.length&&a.every((w,i)=>w[0]===b[i][0]);
  if(cues.length!==MENU_KARAOKE_CUES.length||cues.some((c,i)=>{
    const original=MENU_KARAOKE_CUES[i];
    return c.section!==original.section||!sameWords(c.words,original.words)||c.responses.length!==original.responses.length||c.responses.some((r,j)=>!sameWords(r.words,original.responses[j].words));
  }))throw new Error('Calibration must preserve the supplied lyrics, voices and sections');
  return cues;
}
export function readKaraokeCalibration(win){
  try{const value=win?.localStorage?.getItem(KARAOKE_CALIBRATION_KEY);if(value)return validateKaraokeCalibration(JSON.parse(value));}catch{}
  return MENU_KARAOKE_CUES;
}
const clamp=x=>Math.max(0,Math.min(1,x));
const noop=()=>({update(){},hide(){},dispose(){}});
const colors=['#ffe000','#008cff','#ff3030'];
const symbols=['♪','♫','♩','♬'];
const responsePhraseCache=new WeakMap();

export function validateKaraokeCues(cues,duration=198.288){
  if(!Array.isArray(cues)||!cues.length)throw new Error('Empty karaoke cue list');
  let previous=0;
  const validateWords=(words,start,end,label)=>{
    if(!Array.isArray(words))throw new Error('Invalid '+label+' words');
    let previousWord=start;
    for(const w of words){
      if(!Array.isArray(w)||typeof w[0]!=='string'||!w[0].trim()||!Number.isFinite(w[1])||!Number.isFinite(w[2])||w[1]<previousWord-1e-6||w[2]<=w[1]||w[1]<start-1e-6||w[2]>end+1e-6||w[2]>duration+1e-6)throw new Error('Invalid '+label+' word bounds: '+w?.[0]);
      previousWord=w[2];
    }
  };
  for(const c of cues){
    if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<previous-1e-6||c.end<=c.start||c.end>duration+.001||!Array.isArray(c.words)||!Array.isArray(c.responses))throw new Error('Invalid cue bounds');
    validateWords(c.words,c.start,c.end,'lead');
    for(const r of c.responses){
      if(!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<0||r.end<=r.start||r.end>duration+.001||!Array.isArray(r.words)||!r.words.length)throw new Error('Invalid response phrase bounds');
      validateWords(r.words,r.start,r.end,'response');
      if(r.words[0][1]<r.start-1e-6||r.words.at(-1)[2]>r.end+1e-6)throw new Error('Response words must fit their phrase bounds');
    }
    previous=c.end;
  }
  return cues;
}
function responsePhrases(cues){
  let cached=responsePhraseCache.get(cues);if(cached)return cached;
  cached=[];
  for(let cueIndex=0;cueIndex<cues.length;cueIndex++)for(let responseGroup=0;responseGroup<cues[cueIndex].responses.length;responseGroup++){
    const phrase=cues[cueIndex].responses[responseGroup];cached.push({cueIndex,responseGroup,phrase,start:phrase.start,end:phrase.end});
  }
  cached.sort((a,b)=>a.start-b.start||a.end-b.end||a.cueIndex-b.cueIndex||a.responseGroup-b.responseGroup);
  responsePhraseCache.set(cues,cached);return cached;
}
function activeResponseAt(time,cues){
  const phrases=responsePhrases(cues);let lo=0,hi=phrases.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(phrases[mid].start<=time)lo=mid+1;else hi=mid;}
  for(let i=lo-1;i>=0;i--){const p=phrases[i];if(p.start<=time&&time<p.end){
    const word=p.phrase.words.findIndex(w=>time>=w[1]&&time<w[2]);
    const progress=word<0?0:clamp((time-p.phrase.words[word][1])/(p.phrase.words[word][2]-p.phrase.words[word][1]));
    return {...p,word,progress};
  }}
  return null;
}
export function karaokeFrame(time,cues=MENU_KARAOKE_CUES){
  const empty={index:-1,word:-1,progress:0,responseIndex:-1,responseGroup:-1,responseWord:-1,responseProgress:0};
  if(!Number.isFinite(time)||time<0)return empty;
  let lo=0,hi=cues.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(cues[mid].start<=time)lo=mid+1;else hi=mid;}
  const index=lo-1,cue=cues[index],leadCue=cue&&time<cue.end?cue:null;
  const word=leadCue?leadCue.words.findIndex(w=>time>=w[1]&&time<w[2]):-1;
  const progress=word<0?0:clamp((time-leadCue.words[word][1])/(leadCue.words[word][2]-leadCue.words[word][1]));
  let response=activeResponseAt(time,cues);
  // Show the next backing phrase alongside its lead phrase before it starts.
  if(!response&&leadCue?.responses.length){
    const next=leadCue.responses.find(r=>r.start>time);
    if(next)response={cueIndex:index,responseGroup:leadCue.responses.indexOf(next),phrase:next,start:next.start,end:next.end,word:-1,progress:0};
  }
  return {index:leadCue?index:-1,word:leadCue?word:-1,progress:leadCue?progress:0,
    responseIndex:response?.cueIndex??-1,responseGroup:response?.responseGroup??-1,responseWord:response?.word??-1,responseProgress:response?.progress??0};
}

// Land on each word onset and travel toward the next word on the same visual row.
export function karaokeBounce(progress,from,to,amplitude=12){
  const p=clamp(progress),u=clamp((p-.16)/.84),sameRow=to&&Math.abs(to.y-from.y)<3,travel=sameRow?u*u*(3-2*u):0;
  return {x:from.x+(sameRow?to.x-from.x:0)*travel,y:from.y-Math.sin(Math.PI*u)*amplitude,sx:1+.28*Math.max(0,1-p/.14),sy:1-.32*Math.max(0,1-p/.14)};
}
export function karaokeWordPose(progress){
  const p=clamp(progress),hit=Math.max(0,1-p/.16),stretch=Math.sin(Math.PI*clamp((p-.10)/.38));
  return {sx:1+.17*hit-.045*stretch,sy:1-.21*hit+.12*stretch};
}

export function createMenuKaraoke({root,menu,theme,doc=document,win=window,cues}){
  if(!root)return noop();cues??=readKaraokeCalibration(win);
  try{validateKaraokeCues(cues);}catch(error){console.warn('Menu karaoke cues unavailable',error);root.hidden=true;return noop();}
  const lead=root.querySelector('.rg-karaoke-lead'),back=root.querySelector('.rg-karaoke-response'),particles=root.querySelector('.rg-karaoke-particles'),ball=root.querySelector('.rg-karaoke-ball');
  if(!lead||!back||!particles||!ball){root.hidden=true;return noop();}
  let leadIndex=-2,responseKey='',leadNodes=[],backNodes=[],leadAnchors=[],backAnchors=[],last=NaN,visible=false,dirty=true,wasReduced=false,disposed=false;
  const mot=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const fx=Array.from({length:2},(_,i)=>{const n=doc.createElement('span');n.textContent=symbols[i%symbols.length];n.style.color=colors[i%colors.length];particles.append(n);return n;});
  const clearFX=()=>{ball.hidden=true;for(const n of fx)n.style.opacity='0';};
  const invalidate=()=>{dirty=true;};
  const observer=typeof win.ResizeObserver==='function'?new win.ResizeObserver(invalidate):null;
  observer?.observe(root);observer?.observe(lead);observer?.observe(back);win.addEventListener?.('resize',invalidate);
  function measure(){
    const r=root.getBoundingClientRect?.();
    const get=nodes=>r?nodes.map(n=>{const w=n.getBoundingClientRect?.();return w?{x:w.left+w.width/2-r.left,y:w.top-r.top-3,h:w.height,w:w.width}:null;}):[];
    leadAnchors=get(leadNodes);backAnchors=get(backNodes);dirty=false;
  }
  function makeWord(word,row,nodes){
    const n=doc.createElement('span'),ink=doc.createElement('span');n.className='rg-karaoke-word';n.dataset.word=word;
    const display=word.replace(/^[([{]+/,'').replace(/[)\]}]+$/,'');
    ink.className='rg-karaoke-ink';ink.textContent=display;ink.dataset.word=display;n.append(ink);n.style.setProperty('--sweep','0%');row.append(n);nodes.push(n);
  }
  function populateLead(cue){
    lead.replaceChildren();leadNodes=[];
    if(cue?.words.length)for(const [word] of cue.words)makeWord(word,lead,leadNodes);
    else if(cue?.section==='instrumental')lead.textContent='♪ ♫';
    dirty=true;
  }
  function populateResponse(response){
    back.replaceChildren();backNodes=[];
    if(response?.phrase?.words)for(const [word] of response.phrase.words)makeWord(word,back,backNodes);
    back.hidden=!backNodes.length;dirty=true;
  }
  function hide(){if(visible){root.hidden=true;menu.dataset.karaokeActive='false';visible=false;}leadIndex=-2;responseKey='';last=NaN;dirty=true;clearFX();}
  function applyTrack(nodes,anchors,words,wordIndex,progress,t,reduced){
    for(let j=0;j<nodes.length;j++){
      const w=words[j],n=nodes[j],active=j===wordIndex;
      n.dataset.state=t>=w[2]?'done':active?'active':'waiting';
      n.style.setProperty('--sweep',active?`${(progress*100).toFixed(1)}%`:t>=w[2]?'100%':'0%');
      n.style.setProperty('--sx','1');n.style.setProperty('--sy','1');
    }
    if(wordIndex<0||wordIndex>=words.length||wordIndex>=nodes.length)return null;
    const n=nodes[wordIndex],a=anchors[wordIndex],b=anchors[wordIndex+1],pose=reduced?{sx:1,sy:1}:karaokeWordPose(progress);
    if(a?.w>0)pose.sx=Math.min(pose.sx,1+a.h*.14/a.w);
    n.style.setProperty('--sx',pose.sx.toFixed(4));n.style.setProperty('--sy',pose.sy.toFixed(4));
    return {n,a,b,progress,start:words[wordIndex][1],index:wordIndex};
  }
  function update(allowed=true){
    if(disposed)return;
    if(!allowed||theme.paused||theme.ended||theme.error||theme.readyState<2||!Number.isFinite(theme.currentTime)){hide();return;}
    const t=theme.currentTime,reduced=Boolean(mot?.matches),state=karaokeFrame(t,cues);
    const cue=state.index>=0?cues[state.index]:null;
    const responseCue=state.responseIndex>=0?cues[state.responseIndex]:null;
    const response=responseCue?.responses[state.responseGroup]??null;
    if(!cue&&!response){
      if(leadIndex!==-1||responseKey){leadIndex=-1;responseKey='';lead.replaceChildren();back.replaceChildren();back.hidden=true;clearFX();dirty=true;}
      root.dataset.section='instrumental';return;
    }
    if(!visible){visible=true;root.hidden=false;menu.dataset.karaokeActive='true';dirty=true;}
    root.dataset.section=cue?.section??responseCue?.section??'instrumental';
    if(state.index!==leadIndex){leadIndex=state.index;populateLead(cue);}
    const nextResponseKey=response?`${state.responseIndex}:${state.responseGroup}`:'';
    if(nextResponseKey!==responseKey){responseKey=nextResponseKey;populateResponse(response);}
    if(!dirty&&t===last&&reduced===wasReduced)return;
    if(dirty)measure();last=t;wasReduced=reduced;
    const leadActive=cue&&state.word>=0?applyTrack(leadNodes,leadAnchors,cue.words,state.word,state.progress,t,reduced):null;
    const responseActive=response&&state.responseWord>=0?applyTrack(backNodes,backAnchors,response.words,state.responseWord,state.responseProgress,t,reduced):null;
    // One marker follows the lead; during lead gaps it lands on the backing vocal.
    const active=leadActive??responseActive;
    if(!active){clearFX();return;}
    const {a,b,progress:p,index,start}=active;
    if(reduced||!a){clearFX();return;}
    const hop=karaokeBounce(p,a,b,Math.min(11,a.h*.27));ball.hidden=false;
    ball.style.transform=`translate3d(${hop.x}px,${hop.y}px,0) translate(-50%,-100%) scale(${hop.sx},${hop.sy})`;
    const age=clamp((t-start)/.5),count=1+(index%2);
    for(let j=0;j<fx.length;j++){
      if(j>=count){fx[j].style.opacity='0';continue;}
      const side=(j+(count===1?leadIndex:0))%2===0?-1:1,spread=13+(j%4)*9,x=a.x+side*(8+age*spread),y=Math.max(14,a.y-4-age*(6+(j%3)*5));
      fx[j].textContent=symbols[(index+j)%symbols.length];fx[j].style.color=colors[(index+j)%colors.length];
      fx[j].style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-100%) rotate(${side*(12+age*32)}deg) scale(${.7+.3*Math.sin(Math.PI*age)})`;
      fx[j].style.opacity=String(Math.sin(Math.PI*age)*.96);
    }
  }
  function dispose(){hide();disposed=true;observer?.disconnect();win.removeEventListener?.('resize',invalidate);particles.replaceChildren();lead.replaceChildren();back.replaceChildren();}
  return {update,hide,dispose};
}
