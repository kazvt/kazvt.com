// A host-only saved snapshot; player projections are explicitly allowlisted.
import { withRoomSubmissionLock } from './card-room-election.mjs';
import { readCardGames } from './card-games-store.mjs?v=show-stage-20261126-v1';
import { MODE_NAMES } from './trivia-data.js?v=compose-repeat-grid-20261124-v1';
import { scoreFourDigitGuess, compareNumberGuess, normalizeGuessLimit } from './trivia-game.mjs?v=changeable-number-feedback-20261124-v1';
export const LIVE_TRIVIA_KEY = 'rg-live-trivia-v1';
export const TRIVIA_REQUEST_KEY = 'rg-trivia-request-v1';
export const TRIVIA_REPLY_KEY = 'rg-trivia-reply-v1';
export const TRIVIA_CHANGE = 'rg:live-trivia-changed';
export const MAX_TRIVIA_ANSWER = 24000;
export const MAX_TRIVIA_SNAPSHOT = 1400000;
export const CHOICE_MODES = ['choice-text','choice-image','choice-image-wide','image-grid'];
const PLAYERS = ['kaz','faroe','erin'];
const text = (v,n=5000) => typeof v === 'string' ? v.slice(0,n) : '';
const list = v => Array.isArray(v) ? v.slice(0,24) : [];
export const newTriviaId = () => `trivia-${crypto.randomUUID()}`;
export function cardStamp(cards) { return JSON.stringify([cards?.activityRevision||"",cards?.smeemo?.id||cards?.smeemo?.mode||"",cards?.round?.id||cards?.round?.mode||""]); }
export function readLiveTrivia(storage = globalThis.localStorage) {
  try { const r = JSON.parse(storage.getItem(LIVE_TRIVIA_KEY)); return r?.mode === 'trivia' && typeof r.id === 'string' && r.question && r.submissions && r.attempts ? r : null; } catch { return null; }
}
export function writeLiveTrivia(round, storage = globalThis.localStorage) {
  try { const serialized=JSON.stringify(round); if(serialized.length > MAX_TRIVIA_SNAPSHOT) return false; storage.setItem(LIVE_TRIVIA_KEY,serialized); } catch { return false; }
  globalThis.dispatchEvent?.(new Event(TRIVIA_CHANGE)); return true;
}
export function subscribeLiveTrivia(fn) {
  const notify=()=>fn(readLiveTrivia()); const storage=e=>{if(e.key===LIVE_TRIVIA_KEY||e.key===null) notify();};
  globalThis.addEventListener?.(TRIVIA_CHANGE,notify);globalThis.addEventListener?.('storage',storage);return()=>{globalThis.removeEventListener?.(TRIVIA_CHANGE,notify);globalThis.removeEventListener?.('storage',storage);};
}
export function activeRoomRound(cards = readCardGames(), trivia = readLiveTrivia()) {
  return trivia && trivia.cardStamp === cardStamp(cards) ? trivia : cards.smeemo ? null : cards.round;
}
// Public media must be portable: no blob URLs, private database keys or SVG data.
export function publicMedia(value) {
  if(typeof value!=='string'||value.length>MAX_TRIVIA_SNAPSHOT) return '';
  if(/^data:image\/(?:png|jpe?g|webp|gif|avif|bmp);base64,[a-z0-9+/]+=*$/i.test(value))return value;
  try { const u=new URL(value); if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)return u.href; }catch{} return '';
}
export function createLiveTrivia({round,difficulty,format,content,cards,id=newTriviaId()}) {
  if(!Object.hasOwn(MODE_NAMES,format.mode))throw Error('Unknown question format.');
  const mode=format.mode;
  const media=v=>publicMedia(v);
  const option=o=>({label:text(o?.label,1000),image:media(o?.image)});
  const items=["timeline","categorize-images","compose-image","image-sequence","text-sequence"].includes(mode)?list(content.items).map(option):[];
  // Do not transmit authored solution order, matching indices or positions.
  const shuffleIndexes=n=>{const a=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
  const pairs=(mode==="match-pairs"?list(content.pairs):[]).filter(p=>p?.left||p?.leftImage||p?.right);
  const rightOrder=shuffleIndexes(pairs.length);
  const itemOrder=mode==='timeline'&&format.reorder?shuffleIndexes(items.length):items.map((_,i)=>i);
  const q={round:String(round),difficulty,kind:mode,prompt:text(content.question),subtitle:text(content.subtitle,3000),
    promptImage:media(content.promptImage),backgroundImage:media(content.backgroundImage),videoUrl:mode==='video'&&/^https?:/i.test(media(content.videoUrl))?media(content.videoUrl):'',
    options:CHOICE_MODES.includes(mode)?list(content.options).map((o,i,a)=>option(format.blankOption&&i===a.length-1&&!o?.label&&!o?.image?{label:"BLANK"}:o)):[],
    items:itemOrder.map(i=>items[i]),categories:mode==="categorize-images"?list(content.categories).map(v=>text(v,300)):[],
    left:pairs.map(p=>({label:text(p.left,1000),image:media(p.leftImage)})),right:rightOrder.map(i=>text(pairs[i].right,1000)),
    multiple:format.selectionRule==='all',requiredCount:format.selectionRule==='all'?Math.max(0,Math.min(24,Number(format.requiredCorrectCount)||0)):0,
    reorder:mode==='timeline'&&Boolean(format.reorder),guessLimit:normalizeGuessLimit(content.guessLimit),imageVisible:content.imageVisible!==false,
    sequenceIndex:0,gridSize:Math.max(0,Math.min(128,Number(format.gridSize)||0)),imageAspect:text(format.imageAspect,30),columns:Math.max(0,Math.min(6,Number(format.columns)||0))};
  if(mode==='memory-number'&&!q.imageVisible)q.promptImage='';
  if(CHOICE_MODES.includes(mode) && (!q.options.some(o=>o.label||o.image) || q.requiredCount>q.options.length))throw Error('Add enough answer choices first.');
  if(['timeline','categorize-images','compose-image','image-sequence','text-sequence'].includes(mode) && !q.items.some(o=>o.label||o.image))throw Error('Add the question items first.');
  if(mode==='categorize-images'&&!q.categories.some(v=>v.trim()))throw Error('Add category names first.');
  if(mode==='match-pairs'&&(!q.left.length||q.right.some(v=>!v.trim())||q.left.some(v=>!v.label&&!v.image)))throw Error('Complete the matching pairs first.');

  if(!q.prompt&&!q.subtitle&&!q.promptImage&&!q.backgroundImage&&!q.videoUrl&&!list(content.options).some(o=>o?.label||o?.image)&&!q.items.some(o=>o.label||o.image)&&!q.left.length&&!(mode==="memory-number"&&media(content.promptImage))&&!(mode==="number-grid"&&/^\d{4}$/.test(text(content.numberCode,4))))throw Error('No authored question for that round/difficulty.');
  const secret={correct:list(content.options).flatMap((o,i)=>o?.correct?[i]:[]),accepted:list(content.acceptedAnswers).map(v=>text(v)),numberCode:text(content.numberCode,4),numberValue:Number(content.numberValue),rightOrder,itemOrder,memoryImage:mode==="memory-number"?media(content.promptImage):""};
  if(mode==='number-grid'&&!/^\d{4}$/.test(secret.numberCode))throw Error('Set the four-digit secret first.');
  if(['number-stepper','memory-number'].includes(mode)&&!Number.isFinite(secret.numberValue))throw Error('Set the target number first.');
  const result={id,mode:'trivia',phase:'submissions',prompt:q.prompt,question:q,secret,cardStamp:cardStamp(cards),submissions:Object.fromEntries(PLAYERS.map(p=>[p,null])),attempts:Object.fromEntries(PLAYERS.map(p=>[p,[]]))};
  if(JSON.stringify(result).length>MAX_TRIVIA_SNAPSHOT-160000)throw Error('Question media is too large for the live room; use smaller images or hosted URLs.');
  return result;
}
export function publicQuestion(round) {
  const q=round.question;
  if(["image-sequence","text-sequence"].includes(q.kind))return {...q,items:q.items.slice(q.sequenceIndex,q.sequenceIndex+1),sequenceIndex:0};
  return q;
}
export function publicTriviaRound(round,player) {
  return {id:round.id,mode:'trivia',phase:round.phase,prompt:round.prompt,question:publicQuestion(round),submitted:Boolean(round.submissions[player]),savedAnswer:round.submissions[player]||null,attempts:round.attempts[player]||[]};
}
const index=(x,n)=>Number.isInteger(x)&&x>=0&&x<n;
const unique=(a,n)=>Array.isArray(a)&&a.length<=n&&a.every(v=>index(v,n))&&new Set(a).size===a.length;
const xy=p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isInteger(n)&&n>=0&&n<=1000);
export function validTriviaAnswer(q,a) {
  if(!a||typeof a!=='object'||Array.isArray(a))return false;
  const k=q.kind;
  if(CHOICE_MODES.includes(k))return unique(a.selected,q.options.length)&&a.selected.length>0&&(q.multiple?(q.requiredCount===0||a.selected.length===q.requiredCount):a.selected.length===1);
  if(k==='number-grid')return typeof a.guess==='string'&&/^\d{4}$/.test(a.guess)&&typeof a.id==='string'&&/^[a-z0-9-]{1,64}$/i.test(a.id);
  if(k==='number-stepper'||k==='memory-number')return typeof a.guess==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(a.guess.trim())&&a.guess.length<=80&&Number.isFinite(Number(a.guess))&&typeof a.id==='string'&&/^[a-z0-9-]{1,64}$/i.test(a.id);
  if(k==='timeline'&&q.reorder)return unique(a.order,q.items.length)&&a.order.length===q.items.length&&q.items.length>0;
  if(k==='match-pairs')return unique(a.matches,q.right.length)&&a.matches.length===q.left.length&&q.left.length>0;
  if(k==='categorize-images')return Array.isArray(a.groups)&&a.groups.length===q.items.length&&a.groups.length>0&&a.groups.every(v=>index(v,q.categories.length));
  if(k==='compose-image')return Array.isArray(a.placements)&&a.placements.length>0&&a.placements.length<=64&&a.placements.every(p=>p && Object.keys(p).every(k=>k==="item"||k==="at")&&index(p.item,q.items.length)&&xy(p.at));
  if(k==='draw-over-image')return Array.isArray(a.strokes)&&a.strokes.length>0&&a.strokes.length<=80&&a.strokes.reduce((n,s)=>n+(Array.isArray(s)?s.length:0),0)<=1400&&a.strokes.every(s=>Array.isArray(s)&&s.length>0&&s.length<=500&&s.every(xy));
  return typeof a.text==='string'&&a.text.trim().length>0&&a.text.length<=800;
}
export function acceptTriviaAnswer(round,player,raw) {
  if(!PLAYERS.includes(player)||typeof raw!=='string'||raw.length>MAX_TRIVIA_ANSWER)return {round,status:'invalid-answer'};
  let a;try{a=JSON.parse(raw);}catch{return {round,status:'invalid-answer'};}
  if(!validTriviaAnswer(round.question,a))return {round,status:'invalid-answer'};
  const allowed=CHOICE_MODES.includes(round.question.kind)?["selected"]:round.question.kind==="timeline"&&round.question.reorder?["order"]:round.question.kind==="match-pairs"?["matches"]:round.question.kind==="categorize-images"?["groups"]:round.question.kind==="compose-image"?["placements"]:round.question.kind==="draw-over-image"?["strokes"]:["number-grid","number-stepper","memory-number"].includes(round.question.kind)?["guess","id"]:["text"];
  if(Object.keys(a).some(k=>!allowed.includes(k)))return {round,status:"invalid-answer"};
  const old=round.submissions[player],attempts=round.attempts[player]||[];
  if(a.id&&attempts.some(x=>x.id===a.id))return {round,status:attempts.some(x=>x.id===a.id&&x.guess===a.guess)?'accepted':'invalid-answer'};
  if(old)return {round,status:old===raw?'accepted':'already-submitted'};
  if(round.phase!=='submissions')return {round,status:'closed'};
  if(['number-grid','number-stepper','memory-number'].includes(round.question.kind)) {
    const grid=round.question.kind==='number-grid';const result=grid?scoreFourDigitGuess(round.secret.numberCode,a.guess):compareNumberGuess(round.secret.numberValue,a.guess);
    if(!result)return {round,status:'invalid-answer'};
    const nextAttempts=[...attempts,{id:a.id,guess:a.guess,result}];const done=grid?result.every(x=>x==='green')||nextAttempts.length>=round.question.guessLimit:result==='correct'||nextAttempts.length>=100;
    return {round:{...round,attempts:{...round.attempts,[player]:nextAttempts},submissions:{...round.submissions,[player]:done?raw:null}},status:'accepted'};
  }
  return {round:{...round,submissions:{...round.submissions,[player]:raw}},status:'accepted'};
}
export const NUMERIC_MODES = Object.freeze(['number-grid','number-stepper','memory-number']);
export function numericProgress(round,player) {
  const q=round.question, attempts=round.attempts[player]||[];
  const last=attempts.at(-1), grid=q.kind==='number-grid';
  const solved=grid?Array.isArray(last?.result)&&last.result.length===4&&last.result.every(x=>x==='green'):last?.result==='correct';
  const limit=grid?q.guessLimit:100;
  const status=solved?'Solved':round.submissions[player]?'No guesses left':round.phase!=='submissions'?'Closed':attempts.length?'In progress':'Waiting';
  return {attempts,limit,solved,status};
}
export function answerSummary(round,player) {
  const q=round.question,raw=round.submissions[player],attempts=round.attempts[player]||[];
  if(attempts.length)return attempts.map(x=>`${x.guess} (${Array.isArray(x.result)?x.result.join('/') : x.result})`).join(' · ');
  if(!raw)return '—';let a;try{a=JSON.parse(raw);}catch{return '—';}
  const labels=(values,items)=>values.map(i=>items[i]?.label||`#${i+1}`).join(', ');
  if(a.selected)return labels(a.selected,q.options);
  if(a.order)return labels(a.order,q.items);
  if(a.matches)return a.matches.map((i,j)=>`${q.left[j]?.label||`#${j+1}`} → ${q.right[i]}`).join('; ');
  if(a.groups)return a.groups.map((i,j)=>`${q.items[j]?.label||`#${j+1}`} → ${q.categories[i]}`).join('; ');
  if(a.placements)return `${a.placements.length} placements`;
  if(a.strokes)return `${a.strokes.length} drawing strokes`;
  return a.text||'—';
}
export async function updateTrivia(action) { return withRoomSubmissionLock(()=>{const current=readLiveTrivia();const next=action(current);if(!next||!writeLiveTrivia(next))throw Error('Could not save live trivia.');return next;}); }
