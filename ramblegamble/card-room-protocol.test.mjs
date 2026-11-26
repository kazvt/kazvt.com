import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, playerRound, acceptSubmission, encodePacket, decodePacket, validRoom } from './card-room-protocol.mjs';
import { createQuiplashRound, createRedHandedRound, normalizeCardGamesState } from './card-games.mjs';
const message = (room, round, player, answer) => ({v:1,room:room.id,token:room.tokens[player],type:'submit',player,roundId:round.id,answer});
test('private player snapshots omit other hands, answers, votes and decks',()=>{
 const round=createRedHandedRound(Array.from({length:20},(_,i)=>`card ${i}`),['prompt']);
 const view=playerRound(round,'kaz'); assert.deepEqual(view.hand,round.hands.kaz); assert.equal(view.hand.length,5); assert.deepEqual(Object.keys(view).sort(),['hand','id','mode','phase','prompt','submitted']); assert.equal(playerRound(round,'unknown'),null);
});
test('three authenticated remote players are independently accepted and anonymously revealed only at three',()=>{
 const room=createRoom(); let round=createQuiplashRound(['Question']); assert.ok(validRoom(room)); assert.equal(new Set(Object.values(room.tokens)).size,3);
 for(const [i,p] of ['kaz','faroe','erin'].entries()) {const m=message(room,round,p,`answer ${p}`); const result=acceptSubmission(room,round,m); assert.equal(result.status,'accepted'); round=result.round; assert.equal(round.phase,i===2?'voting':'submissions'); assert.equal(round.responses.length,i===2?3:0); assert.equal(acceptSubmission(room,round,m).round,round);}
 assert.deepEqual(round.responses.map(r=>r.text).sort(),['answer erin','answer faroe','answer kaz']); assert.ok(round.responses.every(r=>!('player'in r))); assert.equal(playerRound(round,'kaz').submitted,true);
});
test('rejects invalid identity, other room, wrong token, stale round and malformed text without changes',()=>{
 const room=createRoom(), round=createQuiplashRound(['Question']), m=message(room,round,'kaz','A');
 for(const bad of [{...m,player:'faroe'},{...m,token:'x'},{...m,room:createRoom().id},{...m,roundId:'old'},{...m,answer:''},{...m,answer:'x'.repeat(801)},{...m,answer:{}},null]) assert.equal(acceptSubmission(room,round,bad).round,round);
 const other=createQuiplashRound(['Question']); assert.notEqual(other.id,round.id); assert.equal(acceptSubmission(room,other,m).status,'stale-round');
});
test('red handed checks hand membership and does not overwrite accepted submission',()=>{
 const room=createRoom(); let round=createRedHandedRound(Array.from({length:15},(_,i)=>`card ${i}`),['prompt']);
 assert.equal(acceptSubmission(room,round,message(room,round,'kaz','not in hand')).status,'invalid-answer');
 const answer=round.hands.kaz[0]; round=acceptSubmission(room,round,message(room,round,'kaz',answer)).round;
 assert.equal(acceptSubmission(room,round,message(room,round,'kaz',round.hands.kaz[1])).status,'already-submitted');
 assert.equal(round.submissions.kaz,answer); assert.equal(normalizeCardGamesState({round}).round.id,round.id);
});
test('manual packet roundtrip preserves unicode and rejects malformed or excessive payload',()=>{
 const room=createRoom(),round=createQuiplashRound(['prompt']); const m=message(room,round,'erin','🍓 مرحبا 日本語 \n answer'); assert.deepEqual(decodePacket(encodePacket(m)),m); assert.equal(decodePacket('!!!'),null); assert.equal(decodePacket('a'.repeat(60001)),null); assert.equal(acceptSubmission(room,round,decodePacket(encodePacket(m))).status,'accepted');
});
