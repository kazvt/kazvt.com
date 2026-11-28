import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, playerRound, acceptSubmission, encodePacket, decodePacket, validRoom, ROOM_VERSION } from './card-room-protocol.mjs';
import { createQuiplashRound, createRedHandedRound, normalizeCardGamesState } from './card-games.mjs';
import { generateHostIdentity } from "./card-room-auth.mjs";
const hostKey=(await generateHostIdentity()).publicKey;
const message = (room, round, player, answer) => ({v:ROOM_VERSION,room:room.id,token:room.tokens[player],type:'submit',player,roundId:round.id,answer});
test('private player snapshots omit other hands, answers, votes and decks',()=>{
 const round=createRedHandedRound(Array.from({length:20},(_,i)=>`card ${i}`),['prompt']);
 const view=playerRound(round,'kaz'); assert.deepEqual(view.hand,round.hands.kaz); assert.equal(view.hand.length,5); assert.deepEqual(Object.keys(view).sort(),['answerRevision','hand','id','mode','phase','prompt','savedAnswer','submitted']); assert.equal(playerRound(round,'unknown'),null);
});
test('three authenticated remote players are accepted privately, then wait for the host',()=>{
 const room=createRoom(hostKey); let round=createQuiplashRound(['Question']); assert.ok(validRoom(room)); assert.equal(new Set(Object.values(room.tokens)).size,3);
 for(const [i,p] of ['kaz','faroe','erin'].entries()) {const m=message(room,round,p,`answer ${p}`); const result=acceptSubmission(room,round,m); assert.equal(result.status,'accepted'); round=result.round; assert.equal(round.phase,i===2?'reveal':'submissions'); assert.equal(round.responses.length,i===2?3:0); assert.equal(acceptSubmission(room,round,m).round,round);}
 assert.deepEqual(round.responses.map(r=>r.text).sort(),['answer erin','answer faroe','answer kaz']); assert.ok(round.responses.every(r=>!('player'in r))); assert.equal(playerRound(round,'kaz').submitted,true);
});
test('rejects invalid identity, other room, wrong token, stale round and malformed text without changes',()=>{
 const room=createRoom(hostKey), round=createQuiplashRound(['Question']), m=message(room,round,'kaz','A');
 for(const bad of [{...m,player:'faroe'},{...m,token:'x'},{...m,room:createRoom(hostKey).id},{...m,roundId:'old'},{...m,answer:''},{...m,answer:'x'.repeat(801)},{...m,answer:{}},null]) assert.equal(acceptSubmission(room,round,bad).round,round);
 const other=createQuiplashRound(['Question']); assert.notEqual(other.id,round.id); assert.equal(acceptSubmission(room,other,m).status,'stale-round');
});
test('red handed checks hand membership and does not overwrite accepted submission',()=>{
 const room=createRoom(hostKey); let round=createRedHandedRound(Array.from({length:15},(_,i)=>`card ${i}`),['prompt']);
 assert.equal(acceptSubmission(room,round,message(room,round,'kaz','not in hand')).status,'invalid-answer');
 const answer=round.hands.kaz[0]; round=acceptSubmission(room,round,message(room,round,'kaz',answer)).round;
 assert.equal(acceptSubmission(room,round,message(room,round,'kaz',round.hands.kaz[1])).status,'already-submitted');
 assert.equal(round.submissions.kaz,answer); assert.equal(normalizeCardGamesState({round}).round.id,round.id);
});
test('manual packet roundtrip preserves unicode and rejects malformed or excessive payload',()=>{
 const room=createRoom(hostKey),round=createQuiplashRound(['prompt']); const m=message(room,round,'erin','🍓 مرحبا 日本語 \n answer'); assert.deepEqual(decodePacket(encodePacket(m)),m); assert.equal(decodePacket('!!!'),null); assert.equal(decodePacket('a'.repeat(60001)),null); assert.equal(acceptSubmission(room,round,decodePacket(encodePacket(m))).status,'accepted');
});

test('revision-aware edits replace only the current seat answer until automatic or manual close', async()=>{
 const {closeCardSubmissions}=await import('./card-games.mjs');
 for(const mode of ['quiplash','red-handed']){
  const room=createRoom(hostKey);let round=mode==='quiplash'?createQuiplashRound(['prompt']):createRedHandedRound(Array.from({length:20},(_,i)=>`card ${i}`),['prompt']);
  const a=mode==='quiplash'?'first':round.hands.kaz[0], b=mode==='quiplash'?'second':round.hands.kaz[1];
  const submit=(answer,baseRevision,player='kaz')=>acceptSubmission(room,round,{...message(room,round,player,answer),baseRevision});
  assert.equal(playerRound(round,'kaz').answerRevision,0);
  let result=submit(a,0);assert.equal(result.status,'accepted');round=result.round;
  assert.equal(playerRound(round,'kaz').answerRevision,1);assert.equal(playerRound(round,'faroe').answerRevision,0);
  if(mode==='red-handed')assert.equal(submit('not in hand',1).status,'invalid-answer');
  result=submit(b,1);assert.equal(result.status,'accepted');round=result.round;
  assert.equal(round.submissions.kaz,b);assert.equal(playerRound(round,'kaz').answerRevision,2);assert.equal(round.responses.length,0);
  assert.equal(submit(a,0).status,'answer-changed');assert.equal(submit(a,0).round,round);assert.equal(submit(b,1).round,round);
  round=normalizeCardGamesState({round}).round;assert.equal(playerRound(round,'kaz').answerRevision,2);
  result=submit(a,2);round=result.round;assert.equal(round.submissions.kaz,a);assert.equal(submit(b,1).status,'answer-changed'); // ABA protection
  const partial=round;round=closeCardSubmissions(round);assert.equal(submit(b,3).status,'closed');assert.equal(round.responses[0].text,a);
  round=partial;for(const player of ['faroe','erin']){result=submit(mode==='quiplash'?`answer ${player}`:round.hands[player][0],0,player);assert.equal(result.status,'accepted');round=result.round;}
  assert.equal(round.phase,'reveal');assert.equal(submit(b,3).status,'closed');assert.ok(round.responses.some(r=>r.text===a));assert.ok(round.responses.every(r=>!('player' in r)));
 }
});
