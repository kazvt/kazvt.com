import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveTrivia, publicTriviaRound, publicQuestion, acceptTriviaAnswer, validTriviaAnswer, activeRoomRound, cardStamp, writeLiveTrivia, readLiveTrivia, publicMedia, MAX_TRIVIA_SNAPSHOT } from './live-trivia.mjs';
import { MODE_NAMES, resolveRoundFormat } from './trivia-data.js';
import { parsePointsCommand } from './points-commands.mjs';
import { resolveHostContextAction, resolvePointClickAction, resolveSlotContextCell } from './point-click-routing.js';
import { createRoom, acceptSubmission, playerRound, ROOM_VERSION } from './card-room-protocol.mjs';
import { generateHostIdentity } from './card-room-auth.mjs';
const cards={round:null,smeemo:null,activityRevision:''};
const content={question:'Question?',subtitle:'Context',options:[{label:'A',correct:true},{label:'B'}],items:[{label:'First',x:3,y:4},{label:'Second'}],pairs:[{left:'A',right:'B'},{left:'C',right:'D'}],categories:['X','Y'],acceptedAnswers:['private answer'],numberCode:'1123',numberValue:25,guessLimit:2,assignments:[1,0],drawing:'private drawing',placements:[{itemIndex:0,x:10,y:10}],promptImage:'https://example.test/image.png',videoUrl:'https://example.test/clip.mp4'};
function make(kind,overrides={},format={}) {return createLiveTrivia({id:'test',round:'25',difficulty:5,cards,format:{mode:kind,...format},content:{...content,...overrides}});}
const submit=(r,p,a)=>acceptTriviaAnswer(r,p,JSON.stringify(a));
const answerFor={ 'choice-text':{selected:[0]},'choice-image':{selected:[0]},'choice-image-wide':{selected:[1]},'image-grid':{selected:[1]},'short-answer':{text:'answer'},'number-grid':{guess:'1123',id:'a'},'number-stepper':{guess:'25',id:'b'},'memory-number':{guess:'25',id:'c'},'draw-over-image':{strokes:[[[0,1000],[1000,0]]]},'compose-image':{placements:[{item:0,at:[500,500]}]},'categorize-images':{groups:[0,1]},'timeline':{order:[1,0]},'match-pairs':{matches:[0,1]},'image-sequence':{text:'answer'},'text-sequence':{text:'answer'},'video':{text:'answer'} };
for(const kind of Object.keys(MODE_NAMES))test(`${kind}: private projection and validated submission`,()=>{
 const r=make(kind,{}, {reorder:true}); const p=publicTriviaRound(r,'kaz');assert.equal(p.question.kind,kind);assert.equal(p.question.subtitle,'Context');assert.ok(!('secret' in p));assert.ok(!('submissions' in p));assert.ok(!JSON.stringify(p).includes('private answer'));assert.ok(!JSON.stringify(p).includes('private drawing'));assert.ok(!('correct' in (p.question.options[0]||{})));assert.ok(!('x' in (p.question.items[0]||{})));
 const a=answerFor[kind];assert.ok(validTriviaAnswer(p.question,a));const result=submit(r,'kaz',a);assert.equal(result.status,'accepted');assert.ok(result.round.submissions.kaz);assert.equal(result.round.submissions.faroe,null);assert.equal(publicTriviaRound(result.round,'faroe').submitted,false);assert.equal(submit(result.round,'kaz',a).status,'accepted');assert.equal(submit({...r,phase:'closed'},'kaz',a).status,'closed');assert.equal(submit(r,'kaz',{...a,secret:'extra'}).status,'invalid-answer');
});
test('all 180 authored round/tier structures produce correct modes, including round 25 difficulty 5',()=>{
 for(let n=1;n<=36;n++)for(let d=1;d<=5;d++){const round=String(n).padStart(2,'0'),format=resolveRoundFormat(round,d);const r=createLiveTrivia({round,difficulty:d,format,content:{...content,options:Array.from({length:Math.max(2,format.requiredCorrectCount||0)},(_,i)=>({label:`Choice ${i}`}))},cards,id:`${round}-${d}`});assert.equal(r.question.kind,format.mode);assert.equal(r.question.difficulty,d);}
 assert.equal(resolveRoundFormat('25',5).mode,'short-answer');
});
test('sequence snapshot never sends future slides; memory image hides without revealing target',()=>{
 for(const mode of ['text-sequence','image-sequence']){const r=make(mode);assert.deepEqual(publicQuestion(r).items.map(i=>i.label),['First']);r.question.sequenceIndex=1;assert.deepEqual(publicQuestion(r).items.map(i=>i.label),['Second']);assert.equal(publicQuestion(r).sequenceIndex,0);}
 const r=make('memory-number',{imageVisible:false});assert.equal(publicQuestion(r).promptImage,'');assert.ok(r.secret.memoryImage);assert.equal('numberValue' in publicQuestion(r),false);
});
test('numeric feedback and attempt ids are private, replay-safe and bounded',()=>{
 let r=make('number-grid');const a={guess:'1111',id:'first'};let result=submit(r,'kaz',a);r=result.round;assert.deepEqual(r.attempts.kaz[0].result,['green','green','grey','grey']);assert.equal(r.submissions.kaz,null);assert.equal(publicTriviaRound(r,'faroe').attempts.length,0);assert.equal(submit(r,'kaz',a).round,r);assert.equal(submit(r,'kaz',{guess:'1112',id:'first'}).status,'invalid-answer');r=submit(r,'kaz',{guess:'9999',id:'second'}).round;assert.ok(r.submissions.kaz);assert.equal(submit(r,'kaz',{guess:'1123',id:'third'}).status,'already-submitted');
 let n=make('number-stepper');n=submit(n,'erin',{guess:'24',id:'a'}).round;assert.equal(n.attempts.erin[0].result,'higher');n=submit(n,'erin',{guess:'26',id:'b'}).round;assert.equal(n.attempts.erin[1].result,'lower');assert.equal(submit(n,'erin',{guess:'0x19',id:'c'}).status,'invalid-answer');assert.ok(submit(n,'erin',{guess:'25',id:'c'}).round.submissions.erin);
});
test('invalid selection, matching, drawing and placement cannot be persisted',()=>{
 const invalid=[['choice-text',{selected:[0,1]}],['choice-text',{selected:[2]}],['match-pairs',{matches:[0,0]}],['categorize-images',{groups:[0,-1]}],['timeline',{order:[0,0]}],['draw-over-image',{strokes:[[[1001,0]]]}],['compose-image',{placements:[{item:2,at:[1,1]}]}],['short-answer',{text:'   '}]];
 for(const [k,a] of invalid)assert.equal(submit(make(k,{}, {reorder:true}),'kaz',a).status,'invalid-answer',k);
 const multi=make('choice-text',{}, {selectionRule:'all',requiredCorrectCount:2});assert.equal(submit(multi,'kaz',{selected:[0]}).status,'invalid-answer');assert.equal(submit(multi,'kaz',{selected:[0,1]}).status,'accepted');
});
test('stored round survives reload without changing card priority; new activity supersedes it even after reset',()=>{
 const r=make('short-answer');const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};assert.ok(writeLiveTrivia(r,storage));assert.deepEqual(readLiveTrivia(storage),JSON.parse(JSON.stringify(r)));assert.equal(activeRoomRound(cards,r),r);const newCards={...cards,activityRevision:'new',round:{id:'card1',mode:'quiplash'}};assert.equal(activeRoomRound(newCards,r),newCards.round);assert.equal(activeRoomRound({...newCards,round:null,activityRevision:'reset'},r),null);assert.notEqual(cardStamp(cards),cardStamp(newCards));assert.equal(writeLiveTrivia({...r,prompt:'x'.repeat(MAX_TRIVIA_SNAPSHOT)},storage),false);assert.equal(writeLiveTrivia(r,{setItem(){throw Error('quota');}}),false);
});
test('unsafe media and missing authored question are rejected',()=>{
 for(const url of ['javascript:alert(1)','blob:https://example.test/1','data:image/svg+xml;base64,AAAA','https://user:pass@example.test/a'])assert.equal(publicMedia(url),'');assert.throws(()=>createLiveTrivia({id:'a',round:'25',difficulty:5,cards,format:{mode:'short-answer'},content:{}}),/No authored/);
});
test('console and scene routing preserve separate staff actions and roulette play',()=>{
 assert.deepEqual(parsePointsCommand('trivia 25 5'),{action:'trivia-start',round:'25',difficulty:5});assert.deepEqual(parsePointsCommand('TRIVIA 1 2'),{action:'trivia-start',round:'01',difficulty:2});for(const cmd of ['trivia 0 5','trivia 37 5','trivia 1 0','trivia 1 6','trivia 25 5 extra'])assert.equal(parsePointsCommand(cmd).action,'error');for(const cmd of ['answers','close','next','previous','hide','show'])assert.equal(parsePointsCommand(`trivia ${cmd}`).action,`trivia-${cmd}`);
 assert.equal(resolvePointClickAction({machine:'roulette',part:'center'}),'show-trivia');assert.equal(resolvePointClickAction({machine:'roulette',part:'wheel',focused:true}),'spin-wheel');assert.equal(resolveHostContextAction({machine:'roulette'}),'trivia');assert.equal(resolveHostContextAction({machine:'card-table'}),'card-games');assert.equal(resolveSlotContextCell({button:2,view:'slot',selected:'star',interaction:{machine:'slot',part:'slot-reel-display',cellIndex:4}}),4);
});
test('existing authenticated seat protocol rejects unauthorized and stale trivia without leaking answers',async()=>{
 const identity=await generateHostIdentity(),room=createRoom(identity.publicKey);let r=make('short-answer');const m={v:ROOM_VERSION,type:'submit',room:room.id,player:'kaz',token:room.tokens.kaz,roundId:r.id,answer:JSON.stringify({text:'private response'})};assert.equal(acceptSubmission(room,r,{...m,token:room.tokens.erin}).status,'unauthorized');assert.equal(acceptSubmission(room,r,{...m,roundId:'old'}).status,'stale-round');const result=acceptSubmission(room,r,m);assert.equal(result.status,'accepted');assert.equal(playerRound(result.round,'kaz').submitted,true);assert.ok(!JSON.stringify(playerRound(result.round,'erin')).includes('private response'));
});
test('rejects unsendable incomplete authored activities and nested placement metadata',()=>{
 assert.throws(()=>make('choice-text',{options:[]}),/answer choices/);
 assert.throws(()=>make('compose-image',{items:[]}),/question items/);
 assert.throws(()=>make('match-pairs',{pairs:[{left:'A',right:''}]}),/matching pairs/);
 assert.equal(submit(make('compose-image'),'kaz',{placements:[{item:0,at:[10,20],extra:'no'}]}).status,'invalid-answer');
});

import {validTriviaDraft,acceptTriviaDraft,writeLiveTriviaDraft,LIVE_TRIVIA_KEY,LIVE_TRIVIA_DRAFT_KEY,MAX_TRIVIA_ANSWER} from './live-trivia.mjs';
test('partial drafts support empty/undo and unassigned sort items; do not count as submissions',()=>{
 const cases=[['draw-over-image',{strokes:[[[0,1000],[1000,0]]]}, {strokes:[]}],['compose-image',{placements:[{item:0,at:[42,79]}]},{placements:[]}],['categorize-images',{groups:[-1,1]},{groups:[-1,-1]}]];
 for(const [kind,a,empty] of cases){let r=make(kind);for(const draft of [a,empty]){assert.ok(validTriviaDraft(r.question,draft));const res=acceptTriviaDraft(r,'kaz',JSON.stringify(draft));assert.equal(res.status,'accepted');r=res.round;assert.deepEqual(r.drafts.kaz,draft);assert.equal(r.submissions.kaz,null);assert.equal(publicTriviaRound(r,'faroe').savedDraft,null);assert.deepEqual(publicTriviaRound(r,'kaz').savedDraft,draft);assert.equal(acceptTriviaDraft(r,'kaz',JSON.stringify(draft)).round,r);}assert.equal(acceptTriviaDraft(r,'kaz',JSON.stringify({...a,secret:'bad'})).status,'invalid-answer');assert.equal(acceptTriviaDraft({...r,phase:'closed'},'kaz',JSON.stringify(a)).status,'closed');}
 assert.equal(acceptTriviaDraft(make('number-grid'),'kaz','{"guess":"0000"}').status,'invalid-answer');
});
test('draft sidecar is bounded, excludes media and final submissions win over stale drafts',()=>{
 const vals=new Map(),storage={getItem:k=>vals.get(k),setItem:(k,v)=>vals.set(k,v)};
 let r=make('draw-over-image',{promptImage:'data:image/png;base64,'+'A'.repeat(100000)});assert.ok(writeLiveTrivia(r,storage));const question=vals.get(LIVE_TRIVIA_KEY);const a={strokes:[[[123,456],[200,300]]]};
 for(const p of ['kaz','faroe','erin']){r=acceptTriviaDraft(readLiveTrivia(storage),p,JSON.stringify(a)).round;assert.ok(writeLiveTriviaDraft(r,storage));assert.equal(vals.get(LIVE_TRIVIA_KEY),question);}
 assert.ok(vals.get(LIVE_TRIVIA_DRAFT_KEY).length<1000);assert.deepEqual(readLiveTrivia(storage).drafts.faroe,a);
 const final={strokes:[[[3,4]]]};r=submit(readLiveTrivia(storage),'kaz',final).round;assert.ok(writeLiveTrivia(r,storage));assert.equal(readLiveTrivia(storage).drafts.kaz,undefined);assert.deepEqual(readLiveTrivia(storage).drafts.erin,a);assert.equal(acceptTriviaDraft(readLiveTrivia(storage),'kaz',JSON.stringify(a)).status,'closed');
 assert.ok(writeLiveTrivia({...make('draw-over-image'),id:'next'},storage));assert.deepEqual(readLiveTrivia(storage).drafts,{});assert.equal(writeLiveTriviaDraft(r,storage),false);assert.equal(acceptTriviaDraft(readLiveTrivia(storage),'kaz','x'.repeat(MAX_TRIVIA_ANSWER+1)).status,'invalid-answer');
});
test('strict draft validation rejects forged nested fields, invalid points and out-of-range groups',()=>{
 assert.equal(validTriviaDraft(make('draw-over-image').question,{strokes:[[[1.5,2]]]}),false);
 assert.equal(validTriviaDraft(make('compose-image').question,{placements:[{item:0,at:[1,2],extra:true}]}),false);
 assert.equal(validTriviaDraft(make('categorize-images').question,{groups:[-2,0]}),false);
 assert.equal(validTriviaDraft(make('categorize-images').question,{groups:[0]}),false);
 assert.equal(validTriviaDraft(make('draw-over-image').question,{strokes:Array.from({length:81},()=>[[0,0]])}),false);
});

test('draft-only notifications update host stage locally and from another tab without publishing full question',async t=>{
 const {subscribeLiveTrivia,TRIVIA_DRAFT_CHANGE,TRIVIA_CHANGE}=await import('./live-trivia.mjs');const target=new EventTarget(),vals=new Map();const storage={getItem:k=>vals.get(k),setItem:(k,v)=>vals.set(k,v)};
 const env={localStorage:storage,addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target),dispatchEvent:target.dispatchEvent.bind(target)};
 for(const [k,v] of Object.entries(env)){const original=Object.getOwnPropertyDescriptor(globalThis,k);Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});t.after(()=>original?Object.defineProperty(globalThis,k,original):delete globalThis[k]);}
 const stage=[],network=[];const unsub=subscribeLiveTrivia(r=>stage.push(r));const unsubNet=subscribeLiveTrivia(r=>network.push(r),{drafts:false});t.after(()=>{unsub();unsubNet();});
 const r=make('draw-over-image');assert.ok(writeLiveTrivia(r));assert.equal(stage.length,1);assert.equal(network.length,1);
 const next=acceptTriviaDraft(r,'erin','{"strokes":[[[9,10]]]}').round;assert.ok(writeLiveTriviaDraft(next));assert.equal(stage.length,2);assert.equal(network.length,1);assert.deepEqual(stage.at(-1).drafts.erin,{strokes:[[[9,10]]]});
 const event=new Event('storage');Object.defineProperty(event,'key',{value:LIVE_TRIVIA_DRAFT_KEY});target.dispatchEvent(event);assert.equal(stage.length,3);assert.equal(network.length,1);
 const final=submit(readLiveTrivia(),'erin',{strokes:[[[9,10]]]}).round;assert.ok(writeLiveTrivia(final));assert.equal(stage.length,4);assert.equal(network.length,2);assert.equal(stage.at(-1).drafts.erin,undefined);
});

test('matching URL-in-label and explicit media fields produce icon-only projections, including saved legacy rounds',()=>{
 const url='https://lillie.garden/quizz_pieces/answer_name.png';
 const r=make('match-pairs',{pairs:[{left:url,right:'Answer A'},{left:'Private filename',leftImage:'https://example.test/other.webp',right:'Answer B'},{left:'Text item',right:'Answer C'}]});
 const projected=publicTriviaRound(r,'kaz');
 assert.deepEqual(projected.question.left,[{label:'',image:url,icon:true},{label:'',image:'https://example.test/other.webp',icon:true},{label:'Text item',image:''}]);
 assert.ok(!JSON.stringify(projected).includes('Private filename'));assert.ok(!('secret' in projected));
 const legacy={...r,question:{...r.question,left:[{label:url,image:''},...r.question.left.slice(1)]}};
 assert.deepEqual(publicQuestion(legacy).left[0],{label:'',image:url,icon:true});
 const a=submit(legacy,'kaz',{matches:[0,1,2]}).round;
 assert.ok(!JSON.stringify(a.submissions).includes(url));
 assert.throws(()=>make('match-pairs',{pairs:[{left:'javascript:alert(1)',right:'Never show'}]}),/matching pairs/);
});

test('numeric accepted-answer legacy target grades higher/lower/exact, and explicit zero stays zero',()=>{
 for(const [target,contentOverride] of [[42,{numberValue:0,acceptedAnswers:['42']}],[-12.5,{numberValue:-12.5}],[0,{numberValue:0,numberTargetSet:true,acceptedAnswers:['99']}],[0,{numberValue:0,acceptedAnswers:[],numberCode:""}]] ){
  for(const kind of ['number-stepper','memory-number']){
   let r=make(kind,contentOverride);assert.equal(r.secret.numberValue,target);assert.ok(!('numberValue' in publicQuestion(r)));
   for(const [i,[guess,result]] of [[String(target-1),'higher'],[String(target+1),'lower'],[String(target),'correct']].entries()){
    const next=submit(r,'faroe',{guess,id:`try-${i}`});assert.equal(next.status,'accepted');r=next.round;assert.equal(r.attempts.faroe.at(-1).result,result);
    assert.equal(publicTriviaRound(r,'faroe').attempts.at(-1).result,result);assert.deepEqual(publicTriviaRound(r,'erin').attempts,[]);
   }
   assert.ok(r.submissions.faroe);assert.equal(r.submissions.erin,null);
  }
 }
 assert.throws(()=>make('number-stepper',{numberValue:null,acceptedAnswers:[]}),/target number/);
});

test('matching live drafts mirror partial, changed, cleared and duplicate choices; final answers stay one-to-one',()=>{
 let r=make('match-pairs');assert.equal(publicTriviaRound(r,'kaz').liveDrafts,true);
 for(const matches of [[0,-1],[1,-1],[1,1],[-1,-1]]){
  const a={matches};const res=acceptTriviaDraft(r,'kaz',JSON.stringify(a));assert.equal(res.status,'accepted');r=res.round;
  assert.deepEqual(publicTriviaRound(r,'kaz').savedDraft,a);assert.equal(publicTriviaRound(r,'erin').savedDraft,null);assert.equal(r.submissions.kaz,null);
 }
 for(const a of [{matches:[0]},{matches:[0,2]},{matches:[-2,0]},{matches:[0,0.5]},{matches:[0,null]},{matches:[0,-1],extra:1}])assert.equal(validTriviaDraft(r.question,a),false);
 assert.equal(submit(r,'kaz',{matches:[0,0]}).status,'invalid-answer');
 assert.equal(submit(r,'kaz',{matches:[0,-1]}).status,'invalid-answer');
 const final=submit(r,'kaz',{matches:[1,0]});assert.equal(final.status,'accepted');assert.equal(final.round.drafts.kaz,undefined);
 assert.equal(acceptTriviaDraft(final.round,'kaz','{"matches":[0,-1]}').status,'closed');
 assert.equal(acceptTriviaDraft({...r,phase:'closed'},'erin','{"matches":[0,-1]}').status,'closed');
});
test('matching drafts survive host reload and remain isolated to their round and seat',()=>{
 const vals=new Map(),storage={getItem:k=>vals.get(k),setItem:(k,v)=>vals.set(k,v)};
 let r=make('match-pairs');assert.ok(writeLiveTrivia(r,storage));const initial=vals.get(LIVE_TRIVIA_KEY);
 for(const [p,matches] of [['kaz',[0,-1]],['erin',[1,0]],['faroe',[-1,1]]]){
  r=acceptTriviaDraft(readLiveTrivia(storage),p,JSON.stringify({matches})).round;assert.ok(writeLiveTriviaDraft(r,storage));
 }
 assert.equal(vals.get(LIVE_TRIVIA_KEY),initial);assert.deepEqual(readLiveTrivia(storage).drafts.erin,{matches:[1,0]});
 assert.ok(writeLiveTrivia({...make('match-pairs'),id:'new'},storage));assert.deepEqual(readLiveTrivia(storage).drafts,{});assert.equal(writeLiveTriviaDraft(r,storage),false);
});
