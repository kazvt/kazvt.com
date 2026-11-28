import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuiplashRound, createRedHandedRound, CARD_GAME_STORAGE_KEY } from './card-games.mjs';
import { readCardGames, writeCardGames } from './card-games-store.mjs?v=show-stage-20261126-v1';
import { activeCardStage, discardCardRound } from './card-stage-state.mjs';
import { activeRoomRound } from './live-trivia.mjs';
import { createRoom, acceptSubmission, playerRound, ROOM_VERSION } from './card-room-protocol.mjs';
import { generateHostIdentity } from './card-room-auth.mjs';

test('persisted exit touches only card data, invalidates trivia stamp and rejects late authenticated submissions',async()=>{
 const savedStorage=globalThis.localStorage,savedChannel=globalThis.BroadcastChannel;
 const data=new Map();const writes=[];
 globalThis.localStorage={getItem:k=>data.get(k)??null,setItem(k,v){writes.push(k);data.set(k,v);}};
 globalThis.BroadcastChannel=undefined;
 try {
  const room=createRoom((await generateHostIdentity()).publicKey);
  const points='{"faroe":123,"erin":456,"kaz":789}',stars='{"faroe":2,"erin":3,"kaz":4}';
  data.set('ramblegamble.points.v1',points);data.set('ramblegamble.stars.v1',stars);
  for(const round of [createQuiplashRound(['Prompt']),createRedHandedRound(Array.from({length:15},(_,i)=>`Card ${i}`),['Suspect'])]) {
   const decks={quiplash:['Prompt'],evidence:['Card'],suspects:['Suspect']};
   const old=writeCardGames({decks,round},{requirePersistence:true}).state;
   const packet={v:ROOM_VERSION,room:room.id,player:'faroe',token:room.tokens.faroe,type:'submit',roundId:round.id,answer:round.mode==='red-handed'?round.hands.faroe[0]:'Answer'};
   assert.equal(acceptSubmission(room,activeRoomRound(),packet).status,'accepted');
   const next=discardCardRound(readCardGames(),activeCardStage(old).key);
   const result=writeCardGames(next,{requirePersistence:true});assert.equal(result.persisted,true);
   assert.notEqual(result.state.activityRevision,old.activityRevision);assert.deepEqual(readCardGames().decks,old.decks);
   assert.equal(activeRoomRound(),null);assert.equal(playerRound(activeRoomRound(),'faroe'),null);
   assert.equal(acceptSubmission(room,activeRoomRound(),packet).status,'stale-round');
   const replacement=writeCardGames({decks,round:createQuiplashRound(['Fresh'])},{requirePersistence:true}).state;
   assert.equal(acceptSubmission(room,activeRoomRound(),packet).status,'stale-round');
   assert.equal(discardCardRound(replacement,activeCardStage(old).key),replacement);
  }
  assert.ok(writes.every(k=>k===CARD_GAME_STORAGE_KEY));assert.equal(data.get('ramblegamble.points.v1'),points);assert.equal(data.get('ramblegamble.stars.v1'),stars);
 } finally {globalThis.localStorage=savedStorage;globalThis.BroadcastChannel=savedChannel;}
});
