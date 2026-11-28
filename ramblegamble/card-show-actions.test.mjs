import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCardShowAction } from './card-show-actions.mjs';
import { CARD_GAME_PLAYERS, createQuiplashRound, createRedHandedRound, normalizeCardGamesState, submitRoundAnswer, visibleCardResponses, revealCardAnswers, closeCardSubmissions, recordAudienceVote, revealAudienceResults } from './card-games.mjs';
import { playerRound, createRoom, acceptSubmission, ROOM_VERSION } from './card-room-protocol.mjs';
import { generateHostIdentity } from './card-room-auth.mjs';
import { parsePointsCommand } from './points-commands.mjs';
const room=createRoom((await generateHostIdentity()).publicKey);
for(const mode of ['quiplash','red-handed']) test(`${mode}: authenticated all-seat answers held until explicit reveal; no leaked queue`,()=>{
 let round=mode==='quiplash'?createQuiplashRound(['prompt']):createRedHandedRound(Array.from({length:15},(_,i)=>`Evidence ${i}`),['prompt']);
 const received={};
 for(const player of CARD_GAME_PLAYERS){const answer=mode==='quiplash'?`unique-${player}`:round.hands[player][0]; received[player]=answer; const msg={v:ROOM_VERSION,type:'submit',room:room.id,player,token:room.tokens[player],roundId:round.id,answer}; const result=acceptSubmission(room,round,msg);assert.equal(result.status,'accepted');round=result.round;assert.equal(acceptSubmission(room,round,msg).status,'accepted');}
 assert.equal(round.phase,'reveal');assert.equal(round.revealedCount,0);assert.equal(visibleCardResponses(round).length,0);
 const order=round.responses.map(r=>r.id);
 assert.equal(recordAudienceVote(round,order[0]),round);assert.equal(revealAudienceResults(round),round);
 for(let i=1;i<=3;i++){round=revealCardAnswers(round);round=normalizeCardGamesState({round}).round;assert.equal(round.revealedCount,i);assert.equal(visibleCardResponses(round).length,i);assert.deepEqual(round.responses.map(r=>r.id),order);
 for(const player of CARD_GAME_PLAYERS){const snap=playerRound(round,player);assert.equal(snap.savedAnswer,received[player]);assert.equal(snap.submitted,true);assert.ok(!Object.hasOwn(snap,'responses'));assert.ok(!Object.hasOwn(snap,'votes'));assert.ok(!Object.hasOwn(snap,'hand'));}}
 assert.equal(round.phase,'voting');round=recordAudienceVote(round,order[1]);round=revealAudienceResults(round);assert.deepEqual(round.winnerIds,[order[1]]);
});
test('host can close early, reveal all, and reject late submissions, with legacy voting preserved',()=>{
 let round=createQuiplashRound(['prompt']);assert.equal(closeCardSubmissions(round),round);round=submitRoundAnswer(round,'kaz','only');round=closeCardSubmissions(round);assert.equal(round.phase,'reveal');assert.equal(round.responses.length,1);assert.equal(submitRoundAnswer(round,'faroe','late'),round);const all=revealCardAnswers(round,true);assert.equal(all.phase,'voting');assert.equal(all.revealedCount,1);
 const legacy=normalizeCardGamesState({round:{...all,revealedCount:undefined}}).round;assert.equal(visibleCardResponses(legacy).length,1);
});
test('shared console/HUD actions guard round and mode, allow custom prompts, and preserve saved decks',()=>{
 const state=normalizeCardGamesState({decks:{quiplash:['Saved'],evidence:['Card'],suspects:['Saved suspect']}});
 const started=applyCardShowAction(state,'start',{mode:'quiplash',prompt:'Custom question?'});assert.equal(started.round.prompt,'Custom question?');assert.deepEqual(started.decks,state.decks);
 assert.throws(()=>applyCardShowAction(started,'reveal',{roundId:'old'}));assert.throws(()=>applyCardShowAction(started,'reveal',{mode:'red-handed'}));assert.throws(()=>applyCardShowAction(started,'reveal'));
 assert.throws(()=>applyCardShowAction(started,'show'));
 const red=applyCardShowAction(started,'start',{mode:'red-handed',prompt:'Another prompt'});assert.equal(red.round.prompt,'Another prompt');for(const player of CARD_GAME_PLAYERS)assert.equal(red.round.hands[player].length,5);
});
test('console supports explicit actions without treating prompt words as commands',()=>{
 assert.deepEqual(parsePointsCommand('berryblast start A prompt with  spaces'),{action:'card-start',mode:'quiplash',prompt:'A prompt with  spaces'});
 assert.deepEqual(parsePointsCommand('redhanded start'),{action:'card-start',mode:'red-handed',prompt:''});
 for(const action of ['close','reveal','all','results']) assert.deepEqual(parsePointsCommand('cards '+action),{action:'card-'+action});
 for(const command of ['cards show','redhanded show','berryblast show','smeemo resume']) assert.equal(parsePointsCommand(command).action,'error');
 assert.deepEqual(parsePointsCommand('cards reveal next'),{action:'card-reveal'});assert.deepEqual(parsePointsCommand('cards reveal all'),{action:'card-all'});assert.deepEqual(parsePointsCommand('cards vote 2'),{action:'card-vote',responseId:'answer-2'});assert.equal(parsePointsCommand('cards vote 4').action,'error');
});

test('deduct exactly one vote while voting, clamp at zero, preserve results and reject stale or invalid actions',()=>{
 for(const mode of ['quiplash','red-handed']){
  let round=mode==='quiplash'?createQuiplashRound(['prompt']):createRedHandedRound(Array.from({length:15},(_,i)=>`Evidence ${i}`),['prompt']);
  for(const player of CARD_GAME_PLAYERS)round=submitRoundAnswer(round,player,mode==='quiplash'?player:round.hands[player][0]);
  round=revealCardAnswers(round,true);const [a,b]=round.responses.map(r=>r.id);let state=normalizeCardGamesState({round});
  const action=(name,id=a,roundId=round.id)=>applyCardShowAction(state,name,{roundId,responseId:id});
  assert.equal(action('unvote'),state);state=action('vote');state=action('vote');state=action('vote',b);state=action('unvote');assert.equal(state.round.votes[a],1);assert.equal(state.round.votes[b],1);
  state=action('unvote');assert.equal(state.round.votes[a],0);assert.equal(action('unvote'),state);assert.throws(()=>action('unvote','unknown'));assert.throws(()=>action('unvote',a,'old-round'));
  assert.equal(recordAudienceVote(state.round,b,-100).votes[b],0);assert.equal(recordAudienceVote(state.round,b,1.5),state.round);assert.equal(recordAudienceVote(state.round,b,Number.MAX_SAFE_INTEGER),state.round);
  state=action('results');assert.deepEqual(state.round.winnerIds,[b]);assert.throws(()=>action('unvote',b));
 }
});
