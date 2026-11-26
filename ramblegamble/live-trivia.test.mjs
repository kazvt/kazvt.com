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
 for(let n=1;n<=36;n++)for(let d=1;d<=5;d++){const round=String(n).padStart(2,'0'),format=resolveRoundFormat(round,d);const r=createLiveTrivia({round,difficulty:d,format,content,cards,id:`${round}-${d}`});assert.equal(r.question.kind,format.mode);assert.equal(r.question.difficulty,d);}
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
