import { normalizeMatchItem } from "./trivia-match-media.mjs?v=match-number-20261127-v1";
import { audienceReact } from "./audience-state.mjs?v=show-energy-20261127-v1";
import { showBurst } from "./show-ui-fx.mjs?v=show-energy-20261127-v1";
// Console uses the private read-only renderer without installing audio listeners.
const foley = globalThis.location?.pathname?.replace(/\/$/, '') === '/rg/console'
 ? {play(){}} : (await import('./game-foley.mjs?v=sky-soot-20261127-v1')).foley;
import { composeLiveCenter, composePieceSize, drawComposeSprite, loadComposeSprite } from './compose-placement.mjs?v=compose-alpha-center-20261128-v1';
import { CHOICE_MODES, publicMedia, validTriviaAnswer, MAX_TRIVIA_ANSWER, answerSummary, NUMERIC_MODES, numericProgress } from './live-trivia.mjs?v=live-match-20261128-v1';
const node=(tag,cls='',text='')=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
const button=(text,fn)=>{const b=node('button','rg-live-button',text);b.type='button';b.addEventListener('click',fn);return b;};
function image(src,alt='') {const url=publicMedia(src);if(!url)return null;const e=node('img','rg-live-image');e.alt=alt;e.referrerPolicy='no-referrer';e.draggable=false;e.src=url;return e;}
function itemView(item,index) {const e=node('span','rg-live-item');const im=image(item?.image,item?.label||`Option ${index+1}`);if(im)e.append(im);if(item?.label||!im)e.append(node('span','',item?.label||`#${index+1}`));return e;}
// An empty alt is intentional: the icon is the question, its name is the answer.
// The control itself has an anonymous accessible identifier. Failed loads stay
// visually blank with a neutral frame; no URL, label or broken-image text.
export function matchItemView(item,index,resolveMedia=publicMedia) {
 const safe=normalizeMatchItem(item,resolveMedia);
 if(!safe.icon)return itemView(safe,index);
 const e=node('span','rg-live-item rg-match-icon');e.setAttribute('role','img');e.setAttribute('aria-label',`Icon ${index+1}`);
 const im=image(safe.image,'');
 if(im){im.addEventListener('error',()=>{im.remove();e.classList.add('rg-match-unavailable');},{once:true});e.append(im);}else e.classList.add('rg-match-unavailable');
 return e;
}
function artboard(parent,q,answer=null,interactive=false,showTypes=false,onChange=null) {
 const board=node('div','rg-live-artboard'); const bg=image(q.backgroundImage||q.promptImage,'Question image'); if(bg)board.append(bg);const canvas=node('canvas');canvas.width=600;canvas.height=q.imageAspect==='square'?600:q.imageAspect==='11 / 3'?164:400;const setRatio=(w,h)=>{board.style.aspectRatio=`${w}/${h}`;board.style.setProperty("--rg-art-ratio",String(w/h));};setRatio(canvas.width,canvas.height);canvas.setAttribute('aria-label',q.kind==='draw-over-image'?'Drawing area':'Placement area');board.append(canvas);parent.append(board);
 const ctx=canvas.getContext('2d');const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isInteger(n)&&n>=0&&n<=1000);
 const strokes=Array.isArray(answer?.strokes)?answer.strokes.slice(0,80).filter(s=>Array.isArray(s)&&s.length>0&&s.length<=500&&s.every(validPoint)):[], placements=Array.isArray(answer?.placements)?answer.placements.slice(0,64).filter(p=>p&&Number.isInteger(p.item)&&p.item>=0&&p.item<q.items.length&&validPoint(p.at)):[];let selected=0,active=null,activePointer=null;const pieces=q.items.map(()=>null);let hover=null;
 q.items.forEach((item,i)=>{if(q.kind==='compose-image')loadComposeSprite(publicMedia(item.image)).then(sprite=>{pieces[i]=sprite;redraw();});});
 const metrics=()=>({w:bg?.naturalWidth||canvas.width,h:bg?.naturalHeight||canvas.height});
 function paintPlacement(p,opacity=1){const {w,h}=metrics(),x=p.at[0]*canvas.width/1000,y=p.at[1]*canvas.height/1000,size=composePieceSize(w,h),sx=canvas.width/w,sy=canvas.height/h;ctx.save();ctx.globalAlpha=opacity;if(!drawComposeSprite(ctx,pieces[p.item],x,y,size,sx,sy)){ctx.fillStyle='#742c9c';ctx.fillRect(x-size*sx/2,y-size*sy/2,size*sx,size*sy);ctx.fillStyle='white';ctx.font='15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(p.item+1),x,y);}ctx.restore();}
 function redraw(){if(!ctx)return;const sx=canvas.width/1000,sy=canvas.height/1000;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#cf304c';ctx.fillStyle='#cf304c';for(const s of strokes){ctx.beginPath();ctx.moveTo(s[0][0]*sx,s[0][1]*sy);for(const p of s.slice(1))ctx.lineTo(p[0]*sx,p[1]*sy);if(s.length===1){ctx.arc(s[0][0]*sx,s[0][1]*sy,2,0,Math.PI*2);ctx.fill();}else ctx.stroke();}for(const p of placements)paintPlacement(p);if(hover&&placements.length<64)paintPlacement({item:selected,at:hover},.56);}
 function placementAt(e){const r=canvas.getBoundingClientRect(),{w,h}=metrics();return composeLiveCenter((e.clientX-r.left)/Math.max(1,r.width)*w,(e.clientY-r.top)/Math.max(1,r.height)*h,w,h,q.gridSize);}

 if(bg){const resize=()=>{if(!bg.naturalWidth||!bg.naturalHeight)return;const scale=Math.min(600/bg.naturalWidth,600/bg.naturalHeight);canvas.width=Math.max(1,Math.round(bg.naturalWidth*scale));canvas.height=Math.max(1,Math.round(bg.naturalHeight*scale));setRatio(bg.naturalWidth,bg.naturalHeight);redraw();};bg.addEventListener('load',resize);if(bg.complete)resize();}
 const read=()=>q.kind==='compose-image'?{placements}:{strokes};
 const changed=()=>{redraw();onChange?.(read());};
 function coord(e){const r=canvas.getBoundingClientRect();return [Math.round(Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000))),Math.round(Math.max(0,Math.min(1000,(e.clientY-r.top)/r.height*1000)))];}
 if(q.kind==='compose-image' && showTypes){
  const palette=node('section','rg-live-compose-palette');
  const heading=node('h2','rg-live-compose-heading','OBJECT TYPES');
  const tray=node('div','rg-live-compose-types');tray.setAttribute('role','group');tray.setAttribute('aria-label','Object types');
  palette.append(heading,tray);
  q.items.forEach((item,i)=>{
   const label=item.label?.trim()||`Object ${i+1}`;
   const tile=interactive?button('',()=>{selected=i;[...tray.children].forEach((c,j)=>c.setAttribute('aria-pressed',String(i===j)));redraw();}):node('div');
   tile.classList.add('rg-live-compose-type');
   if(interactive){tile.setAttribute('aria-label',label);tile.setAttribute('aria-pressed',String(i===0));}
   const thumbnail=image(item.image,label);if(thumbnail){thumbnail.alt='';thumbnail.addEventListener('error',()=>thumbnail.remove(),{once:true});tile.append(thumbnail);}
   tile.append(node('span','',label));tray.append(tile);
  });
  if(!q.items.length)tray.append(node('span','rg-live-compose-empty','No object types configured.'));
  parent.insertBefore(palette,board);
 }
 if(interactive){canvas.style.touchAction='none';if(q.kind==='compose-image'){canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||(bg&&!bg.naturalWidth)||!q.items.length)return;hover=placementAt(e);redraw();});canvas.addEventListener('pointerleave',()=>{hover=null;redraw();});canvas.addEventListener('pointercancel',()=>{hover=null;redraw();});canvas.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false||(bg&&!bg.naturalWidth)||placements.length>=64||!q.items.length)return;const at=placementAt(e);hover=null;placements.push({item:selected,at});foley.play("place");changed();});}else{canvas.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false||(bg&&!bg.naturalWidth)||activePointer!==null||strokes.length>=80||strokes.reduce((a,s)=>a+s.length,0)>=1400)return;activePointer=e.pointerId;active=[coord(e)];strokes.push(active);foley.play("draw");canvas.setPointerCapture?.(e.pointerId);changed();});canvas.addEventListener('pointermove',e=>{if(!active||e.pointerId!==activePointer||active.length>=500||strokes.reduce((a,s)=>a+s.length,0)>=1400)return;const p=coord(e),last=active.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])>=4){active.push(p);changed();}});for(const t of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(t,e=>{if(e.pointerId===activePointer){active=null;activePointer=null;onChange?.(read());}});}parent.append(button('Undo',()=>{active=null;activePointer=null;if((q.kind==='compose-image'?placements:strokes).pop())foley.play('erase');changed();}),button('Clear',()=>{active=null;activePointer=null;if(placements.length||strokes.length)foley.play("erase");placements.length=strokes.length=0;changed();}));}
 // Read-only spectator updates keep the same image and canvas mounted.
 read.setAnswer=a=>{strokes.splice(0,strokes.length,...(a?.strokes||[]));placements.splice(0,placements.length,...(a?.placements||[]));redraw();};
 redraw();return read;
}
// Shared renderer: public audience gets only public data; an optional host-only
// grading callback enables the local controls without transmitting answer keys.
export function renderLiveQuestion(root,q,{interactive=false,attempts=[],onSubmit=null,disabled=false,initialAnswer=null,onDraft=null,hostCheck=null}={}) {
 root.replaceChildren();root.classList.remove?.('rg-live-wrong','rg-live-correct');root.onkeydown=root.oninput=root.onchange=root.onclick=root.onpointerup=null;root.dataset.kind=q.kind;root.classList.remove?.('rg-question-dealt');void root.offsetWidth;root.classList.add('rg-question-dealt');
 const title=node('h1','rg-live-question',q.prompt);if(q.prompt)root.append(title);
 if(q.subtitle)root.append(node('p','rg-live-subtitle',q.subtitle));
 const art=['draw-over-image','compose-image'].includes(q.kind);const prompt=!art&&q.imageVisible!==false?image(q.promptImage,'Question image'):null;if(prompt){prompt.classList.add('rg-live-prompt-image');root.append(prompt);}
 if(q.kind==='video'&&publicMedia(q.videoUrl)){const v=node('video','rg-live-video');v.src=q.videoUrl;v.controls=true;v.preload='metadata';v.playsInline=true;root.append(v);}
 const body=node('div','rg-live-body');root.append(body);let read=()=>({text:''}),clearHostFeedback=()=>{};
 const grid=node('div','rg-live-grid');
 const addText=(numeric=false)=>{if(!interactive)return;const input=node('input','rg-live-input');input.type='text';input.value=String((numeric?initialAnswer?.guess:initialAnswer?.text)||'');input.maxLength=numeric?80:800;input.placeholder=numeric?'Number':hostCheck?'Enter the answer given':'Your answer';input.autocomplete='off';input.setAttribute('aria-label',input.placeholder);if(numeric)input.inputMode=q.kind==='number-grid'?'numeric':'decimal';if(q.kind==='number-grid'){input.maxLength=4;input.pattern='[0-9]{4}';}body.append(input);read=()=>numeric?{guess:input.value.trim()}:{text:input.value.trim()};};
 if(CHOICE_MODES.includes(q.kind)){grid.dataset.count=String(q.options.length);grid.style.setProperty("--rg-columns",String(q.columns||((q.kind!=="choice-text")?(q.options.length>=10?5:3):q.options.length>10?3:2)));const picks=new Set((Array.isArray(initialAnswer?.selected)?initialAnswer.selected:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<q.options.length));q.options.forEach((o,i)=>{const b=interactive?button('',()=>{if(hostCheck)clearHostFeedback();if(q.multiple){if(picks.has(i))picks.delete(i);else if(!q.requiredCount||picks.size<q.requiredCount)picks.add(i);}else{picks.clear();picks.add(i);}Array.from(grid.children).forEach((el,j)=>el.setAttribute('aria-pressed',String(picks.has(j))));}):node('div','rg-live-tile');b.classList.add('rg-live-tile');if(interactive){b.setAttribute('aria-label',o.label||`Image option ${i+1}`);b.setAttribute('aria-pressed',String(picks.has(i)));} else if(picks.has(i))b.classList.add('rg-live-saved-choice');b.append(itemView(o,i));grid.append(b);});body.append(grid);read=()=>({selected:[...picks]});}
 else if(q.kind==='number-grid'){const rows=node('div','rg-live-number-grid');for(let i=0;i<q.guessLimit;i++){const attempt=attempts[i];for(let j=0;j<4;j++){const c=node('span','rg-live-digit',attempt?.guess?.[j]||'');if(attempt)c.dataset.result=attempt.result[j];rows.append(c);}}body.append(rows);addText(true);}
 else if(['number-stepper','memory-number'].includes(q.kind)){if(attempts.length){const last=attempts.at(-1);body.append(node('p','rg-live-feedback',`${last.guess} — ${last.result.toUpperCase()}`));}addText(true);}
 else if(q.kind==='match-pairs'||q.kind==='categorize-images'){const matching=q.kind==='match-pairs';const items=matching?q.left:q.items, choices=matching?q.right:q.categories;const fields=[];grid.style.setProperty("--rg-columns",String(items.length>8?4:3));body.append(grid);items.forEach((item,i)=>{const box=node('div','rg-live-tile');box.append(matching?matchItemView(item,i):itemView(item,i));if(interactive){const select=node('select','rg-live-input');select.setAttribute('aria-label',matching?`Match item ${i+1}`:item.label||`Item ${i+1}`);const blank=node('option','','Choose…');blank.value='';select.append(blank);choices.forEach((v,j)=>{const o=node('option','',v);o.value=String(j);select.append(o);});const draft=(matching?initialAnswer?.matches:initialAnswer?.groups)?.[i];if(Number.isInteger(draft)&&draft>=0&&draft<choices.length)select.value=String(draft);box.append(select);fields.push(select);}else if(initialAnswer){const pick=(matching?initialAnswer.matches:initialAnswer.groups)?.[i];if(Number.isInteger(pick)&&choices[pick]!==undefined)box.append(node('span','rg-live-saved-label',choices[pick]));}grid.append(box);});if(!interactive&&!initialAnswer){const right=node('div','rg-live-grid');right.style.setProperty('--rg-columns',String(choices.length>8?4:3));choices.forEach(v=>right.append(node('div','rg-live-tile',v)));body.append(right);}read=()=>({[matching?'matches':'groups']:fields.map(s=>s.value===''?-1:Number(s.value))});
  if(interactive&&matching){
   // Keep native selects mounted, and use original choice indices even when options disappear.
   function refreshChoices(){
    const used=new Set();let repaired=false;
    for(const field of fields){
     if(field.value==='')continue;
     if(used.has(field.value)){field.value='';repaired=true;}
     else used.add(field.value);
    }
    for(const field of fields){
     const own=field.value;
     const available=['',...choices.map((_,j)=>String(j)).filter(v=>v===own||!used.has(v))];
     if(available.length===field.options.length&&available.every((v,j)=>v===field.options[j].value))continue;
     field.replaceChildren(...available.map(v=>{const option=node('option','',v===''?'Choose…':choices[Number(v)]);option.value=v;return option;}));
     field.value=own;
    }
    return repaired;
   }
   // Target listeners run before the root's existing draft-save listeners.
   for(const field of fields){field.addEventListener('input',refreshChoices);field.addEventListener('change',refreshChoices);}
   if(refreshChoices())onDraft?.(read()); // Repair duplicate selections restored from older clients.
  }
 }
 else if(q.kind==='timeline'&&q.reorder){const order=Array.isArray(initialAnswer?.order)&&initialAnswer.order.length===q.items.length&&new Set(initialAnswer.order).size===q.items.length&&initialAnswer.order.every(i=>Number.isInteger(i)&&i>=0&&i<q.items.length)?[...initialAnswer.order]:q.items.map((_,i)=>i);body.append(grid);function draw(){grid.replaceChildren();order.forEach((i,pos)=>{const box=node('div','rg-live-tile');box.append(itemView(q.items[i],i));if(interactive){const up=button('↑',()=>{[order[pos-1],order[pos]]=[order[pos],order[pos-1]];draw();}),down=button('↓',()=>{[order[pos+1],order[pos]]=[order[pos],order[pos+1]];draw();});up.disabled=pos===0;down.disabled=pos===order.length-1;up.setAttribute('aria-label','Move up');down.setAttribute('aria-label','Move down');box.append(up,down);}grid.append(box);});}draw();read=()=>({order});}
 else if(art){read=artboard(body,q,initialAnswer,interactive,true,onDraft);}
 else if(['image-sequence','text-sequence','timeline'].includes(q.kind)){const items=q.kind==='timeline'?q.items:q.items.slice(q.sequenceIndex,q.sequenceIndex+1);if(q.kind!=='timeline'){grid.classList.add('rg-live-sequence');grid.style.setProperty('--rg-columns','1');}items.forEach((item,i)=>grid.append(itemView(item,i)));body.append(grid);addText();}
 else addText();
 if(!interactive&&initialAnswer?.text)body.append(node('p','rg-live-feedback',initialAnswer.text));
 if(interactive){
  const feedback=node('p','rg-live-feedback');feedback.setAttribute('role','status');let shakeTimer=0;
  const clearFeedback=()=>{clearTimeout(shakeTimer);root.classList.remove?.('rg-live-wrong','rg-live-correct');feedback.textContent='';delete feedback.dataset.state;};
  clearHostFeedback=clearFeedback;
  const showGrade=result=>{clearFeedback();feedback.textContent=result.text;feedback.dataset.state=result.state;if(result.state==='wrong'){void root.offsetWidth;root.classList.add('rg-live-wrong');foley.play('error');audienceReact('shock');shakeTimer=setTimeout(()=>{if(feedback.parentNode===root)root.classList.remove?.('rg-live-wrong');},360);}else if(result.state==='correct'){root.classList.add('rg-live-correct');foley.play('confirm');showBurst(root,{color:'#78f5ad',count:20});audienceReact('cheer');}};
  const submit=button(hostCheck?'CHECK ANSWER':q.kind==='number-grid'||q.kind==='number-stepper'||q.kind==='memory-number'?'Guess':'Submit',()=>{
   const answer=read();if(hostCheck){showGrade(hostCheck(answer));return;}
   if(['number-grid','number-stepper','memory-number'].includes(q.kind))answer.id=crypto.randomUUID();const raw=JSON.stringify(answer);if(!validTriviaAnswer(q,answer)||raw.length>MAX_TRIVIA_ANSWER){feedback.textContent='Complete your answer first.';foley.play('error');return;}onSubmit?.(raw);
  });submit.disabled=disabled;root.append(submit,feedback);
  const save=()=>{onDraft?.(read());};
  root.oninput=root.onchange=()=>{if(hostCheck)clearFeedback();save();};
  root.onclick=root.onpointerup=save;
  root.onkeydown=e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'&&!e.isComposing&&!e.repeat){e.preventDefault();submit.click();}};
 }

 return read;
}
// Only host pages call this with the private round; no projection contains other seats' answers.
export function renderTriviaResponses(root,round){
 root.replaceChildren();if(!round)return;
 for(const p of ['kaz','faroe','erin']){
  const row=node('div','rg-live-response');const summary=answerSummary(round,p);
   const raw=round.submissions[p],q=round.question;
   const matching=q.kind==='match-pairs',draft=matching&&!raw?round.drafts?.[p]:null;
  row.append(node('strong','',p.toUpperCase()));
  if(NUMERIC_MODES.includes(q.kind)){
    const progress=numericProgress(round,p);
    row.append(node('span','rg-numeric-status',`${progress.status} · ${progress.attempts.length}/${progress.limit} guesses`));
    if(q.kind==='number-grid'){
      const history=node('div','rg-live-number-grid rg-host-number-history');
      for(const attempt of progress.attempts){for(let i=0;i<4;i++){const digit=node('span','rg-live-digit',attempt.guess[i]);digit.dataset.result=attempt.result[i];digit.setAttribute('aria-label',`${attempt.guess[i]} ${attempt.result[i]}`);history.append(digit);}}
      if(progress.attempts.length)row.append(history);
    }else if(progress.attempts.length){const history=node('ol','rg-host-number-attempts');for(const attempt of progress.attempts)history.append(node('li','',`${attempt.guess} — ${attempt.result}`));row.append(history);}
   }else if(draft){row.append(node('span','',`${draft.matches.filter(i=>i>=0).length}/${q.left.length} assigned · ${round.phase==='submissions'?'In progress':'Closed'}`));}
   else row.append(node('span','',summary==='—'?(round.phase==='submissions'?'Waiting':'No answer'):summary));
   if(raw||draft){try{
    const a=raw?JSON.parse(raw):draft;
   if(['draw-over-image','compose-image'].includes(q.kind))artboard(row,q,a);
   else if(a.selected||a.order||a.groups||a.matches){
    const grid=node('div','rg-live-grid');
    const items=a.selected?q.options:a.matches?q.left:q.items;
    const ids=a.selected||a.order||items.map((_,i)=>i);
    // Text summaries already cover all-text answers; show actual selected or mapped images too.
    if(matching||ids.some(i=>a.matches?normalizeMatchItem(items[i],publicMedia).icon:items[i]?.image)){
     ids.forEach(i=>{const item=node('div','rg-live-tile');item.append(a.matches?matchItemView(items[i],i):itemView(items[i],i));if(a.groups)item.append(node('span','',q.categories[a.groups[i]]));if(a.matches)item.append(node('span','',q.right[a.matches[i]]??'Unassigned'));grid.append(item);});row.append(grid);
    }
   }
  }catch{}}
  root.append(row);
 }
}

export const SPECTATOR_MODES=Object.freeze(['number-grid','number-stepper','memory-number','draw-over-image','compose-image','categorize-images','match-pairs']);
const SPECTATOR_PLAYERS=['faroe','erin','kaz'];
function seatAnswer(round,p){
 const raw=round.submissions?.[p];if(raw){try{return JSON.parse(raw);}catch{return null;}}
 return round.drafts?.[p]||null;
}
// Audience-only, deliberately receives the private host round rather than the
// player projection. No answer keys, private links, or grading controls appear.
const SPECTATOR_COLORS={faroe:'#72f3ae',erin:'#c5a0ff',kaz:'#ffe567'};
function spectatorBerry(p){const im=node('img');im.src=`/ramblegamble/assets/berries/${p}berry.png`;im.alt='';im.draggable=false;return im;}
function pulse(el,cls){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}
// A separate persistent presentation per seat. No transport or scoring state is
// owned by these views; switching perspective never replays old submissions.
function createSpectatorPanel(deck,q,p,choose){
 const numeric=NUMERIC_MODES.includes(q.kind),art=['compose-image','draw-over-image'].includes(q.kind);
 const panel=node('section','rg-spectator-panel');panel.dataset.seat=p;panel.style.setProperty('--rg-seat-color',SPECTATOR_COLORS[p]);panel.setAttribute('aria-label',p.toUpperCase());
 const heading=button('',()=>choose(p));heading.className='rg-spectator-panel-heading';heading.setAttribute('aria-label',`Focus ${p.toUpperCase()}`);heading.append(spectatorBerry(p),node('span','',p.toUpperCase()));
 const content=node('div','rg-spectator-content'),status=node('div','rg-spectator-status');status.setAttribute('role','status');panel.append(heading,content,status);deck.append(panel);
 let drawArt=null,palette=null;
 if(art){drawArt=artboard(content,q,null,false,q.kind==='compose-image'&&p===SPECTATOR_PLAYERS[0]);palette=content.querySelector('.rg-live-compose-palette');}
 const cells=[],history=node('div','rg-spectator-guess-history'),hero=node('div','rg-spectator-guess-hero');
 if(q.kind==='number-grid'){
  const grid=node('div','rg-live-number-grid rg-spectator-grid');grid.style.setProperty('--rg-guess-rows',String(q.guessLimit));
  for(let i=0;i<q.guessLimit*4;i++){const c=node('span','rg-live-digit');grid.append(c);cells.push(c);}content.append(grid);
 }else if(numeric){content.append(hero,history);}
 const groups=[],tiles=[];
 if(q.kind==='categorize-images'){
  const buckets=node('div','rg-spectator-groups');
  for(const label of [...q.categories,'']){const section=node('section','rg-spectator-group');const title=node('h2','rg-spectator-group-title',label||'—');const list=node('div','rg-spectator-group-items');section.append(title,list);buckets.append(section);groups.push(list);}
  content.append(buckets);
  q.items.forEach((item,i)=>{const tile=node('div','rg-spectator-object');tile.append(itemView(item,i));tiles.push(tile);groups.at(-1).append(tile);});
 }
  const matchTiles=[];
  if(q.kind==='match-pairs'){
   const grid=node('div','rg-spectator-matches');
   grid.style.setProperty('--rg-match-columns',String(q.left.length>8?4:q.left.length>4?3:2));
   for(const [i,item] of q.left.entries()){
    const tile=node('div','rg-spectator-match-tile'),label=node('span','rg-spectator-match-label','Unassigned');
    tile.append(matchItemView(item,i),label);grid.append(tile);matchTiles.push({tile,label});
   }
   content.append(grid);
  }
  let lastKey=null,lastAttempts=[],lastAnswer=null,lastSubmitted=false,wasSolved=false;
 function update(round,visible,animate){
  const answer=seatAnswer(round,p),attempts=round.attempts?.[p]||[],submitted=!!round.submissions?.[p];
  const key=JSON.stringify([answer,attempts,submitted,round.phase]);if(key===lastKey)return false;
  const live=visible&&animate&&lastKey!==null;lastKey=key;
  const last=attempts.at(-1),previous=lastAttempts.at(-1),newGuess=live&&last&&last.id!==previous?.id;
  if(q.kind==='number-grid'){
   cells.forEach((cell,i)=>{const a=attempts[Math.floor(i/4)],digit=a?.guess?.[i%4]||'',result=a?.result?.[i%4]||'';const changed=cell.textContent!==digit||cell.dataset.result!==result;cell.textContent=digit;if(result){cell.dataset.result=result;cell.setAttribute('aria-label',`${digit} ${result}`);}else{delete cell.dataset.result;cell.setAttribute('aria-label','Empty');}if(changed&&digit&&live){cell.style.setProperty('--rg-tile-delay',`${(i%4)*75}ms`);pulse(cell,'rg-spectator-tile-pop');}});
  }else if(numeric){
   hero.replaceChildren();hero.dataset.result=last?.result||'';
   hero.append(node('span','rg-spectator-guess-value',last?.guess||'—'),node('span','rg-spectator-guess-direction',last?.result==='higher'?'↑':last?.result==='lower'?'↓':last?.result==='correct'?'✓':''));
   if(last&&['higher','lower','correct'].includes(last.result))hero.append(node('span','rg-spectator-guess-word',last.result.toUpperCase()));
   history.replaceChildren();for(const a of attempts.slice(-8,-1)){const token=node('span','rg-spectator-guess-token',`${a.guess} ${a.result==='higher'?'↑':a.result==='lower'?'↓':a.result==='correct'?'✓':''}`);token.dataset.result=a.result;history.append(token);}
   if(newGuess)pulse(hero,'rg-spectator-tile-pop');
  }else if(art){drawArt.setAnswer(answer);if(live&&q.kind==='compose-image'&&(answer?.placements?.length||0)>(lastAnswer?.placements?.length||0))pulse(content,'rg-spectator-placement-pop');}
  else if(groups.length){tiles.forEach((tile,i)=>{const idx=answer?.groups?.[i];const target=groups[Number.isInteger(idx)&&idx>=0&&idx<q.categories.length?idx:groups.length-1];if(tile.parentNode!==target){target.append(tile);if(live)pulse(tile,'rg-spectator-object-pop');}});}
   let assigned=0;
   if(matchTiles.length){matchTiles.forEach(({tile,label},i)=>{
    const pick=answer?.matches?.[i],valid=Number.isInteger(pick)&&pick>=0&&pick<q.right.length;
    if(valid)assigned++;
    const value=valid?q.right[pick]:'Unassigned';
    const changed=label.textContent!==value||tile.dataset.assigned!==String(valid);
    if(changed){label.textContent=value;tile.dataset.assigned=String(valid);if(live)pulse(tile,'rg-spectator-object-pop');}
   });}
   const progress=numeric?numericProgress(round,p):null;
   status.textContent=progress?(progress.solved?'SOLVED':submitted?'NO GUESSES LEFT':`${attempts.length} / ${progress.limit}`):submitted?'SUBMITTED':round.phase!=='submissions'?'CLOSED':'';
   if(matchTiles.length)status.textContent=`${assigned}/${matchTiles.length} assigned${submitted?' · SUBMITTED':round.phase!=='submissions'?' · CLOSED':''}`;
  status.dataset.state=progress?.solved?'solved':submitted?'done':'';panel.dataset.state=status.dataset.state;
  const solved=!!progress?.solved,celebrate=live&&solved&&!wasSolved;
  if(celebrate){pulse(panel,'rg-spectator-panel-win');showBurst(content,{color:SPECTATOR_COLORS[p],count:24});}
  if(live&&!numeric&&submitted&&!lastSubmitted){pulse(status,'rg-spectator-tile-pop');showBurst(content,{color:SPECTATOR_COLORS[p],count:16});}
  lastAnswer=answer;lastSubmitted=submitted;lastAttempts=attempts;wasSolved=solved;return celebrate;
 }
 return {panel,palette,update};
}
export function createTriviaSpectator(root,q,{seat=q.kind==='match-pairs'?'all':'faroe',manualChoice=false}={}){
 root.replaceChildren();root.classList.remove('rg-live-wrong','rg-live-correct','rg-spectator-all');root.onkeydown=root.oninput=root.onchange=root.onclick=root.onpointerup=null;
 root.dataset.kind=q.kind;root.classList.remove('rg-question-dealt');void root.offsetWidth;root.classList.add('rg-spectator','rg-question-dealt');
 if(q.prompt)root.append(node('h1','rg-live-question',q.prompt));
 if(q.subtitle)root.append(node('p','rg-live-subtitle',q.subtitle));
 const nav=node('nav','rg-spectator-seats');nav.setAttribute('aria-label','Contestant perspective');
 const numeric=NUMERIC_MODES.includes(q.kind),art=['compose-image','draw-over-image'].includes(q.kind);
 let current=null,selected=[...SPECTATOR_PLAYERS,'all'].includes(seat)?seat:'faroe',manual=manualChoice||selected==='all',lastSeat='';
 const seats=new Map();
 function choose(p){manual=true;selected=p;paint();}
 for(const p of SPECTATOR_PLAYERS){const b=button('',()=>choose(p));b.className='rg-spectator-seat';b.setAttribute('aria-label',p.toUpperCase());
  const marker=node('span','rg-spectator-marker');marker.setAttribute('aria-hidden','true');b.append(spectatorBerry(p),marker);nav.append(b);seats.set(p,{b,marker});}
 const all=button('ALL',()=>choose('all'));all.className='rg-spectator-seat rg-spectator-all-button';all.setAttribute('aria-label','ALL');nav.append(all);
 root.append(nav);const body=node('div','rg-live-body rg-spectator-body');root.append(body);
 const prompt=!art&&q.imageVisible!==false?image(q.promptImage,'Question image'):null;if(prompt){prompt.classList.add('rg-spectator-prompt');body.append(prompt);}
 const deck=node('div','rg-spectator-deck');body.append(deck);
 const panels=new Map(SPECTATOR_PLAYERS.map(p=>[p,createSpectatorPanel(deck,q,p,choose)]));
 // One shared object legend for both the individual and combined views.
 const palette=panels.get(SPECTATOR_PLAYERS[0]).palette;if(palette)body.insertBefore(palette,deck);
 function hasActivity(p){return !!current?.submissions?.[p]||!!current?.drafts?.[p]||!!current?.attempts?.[p]?.length;}
 function paint(){
  if(!current)return;
  if(!manual){
   if(numeric&&q.kind!=='number-grid'&&SPECTATOR_PLAYERS.includes(current.lastPlayer))selected=current.lastPlayer;
   else if(!hasActivity(selected))selected=SPECTATOR_PLAYERS.find(hasActivity)||selected;
  }
  const combined=selected==='all',switched=lastSeat!==selected;lastSeat=selected;
  root.classList.toggle('rg-spectator-all',combined);all.setAttribute('aria-pressed',String(combined));
  for(const [p,{b,marker}] of seats){const progress=numeric?numericProgress(current,p):null;
   const state=progress?.solved?'solved':current.submissions?.[p]?'done':hasActivity(p)?'working':'waiting';b.dataset.state=state;b.setAttribute('aria-pressed',String(p===selected));b.title=`${p.toUpperCase()} · ${state}`;b.setAttribute('aria-description',state);marker.textContent=state==='solved'||state==='done'?'✓':state==='working'?'●':'';}
  const stageVisible=!root.closest('[hidden],.is-freecam')&&!document.hidden&&!document.documentElement.hasAttribute('data-rg-host-locked');
  let celebrated=false;
  for(const [p,view] of panels){const visible=combined||p===selected;view.panel.hidden=!visible;if(switched&&visible)pulse(view.panel,'rg-spectator-slide');
   celebrated=view.update(current,visible,stageVisible)||celebrated;}
  if(celebrated){audienceReact('cheer');foley.play('confirm');}
 }
 return {update(round){current=round;paint();},selection(){return {seat:selected,manualChoice:manual};}};
}
