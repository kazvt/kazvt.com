import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesAck,pendingReceipt,validRequestId} from './card-room-delivery.mjs';
const pending={roundId:'round',requestId:'new-request',answer:'{"guess":"1234","id":"new-attempt"}'};
test('late ACK cannot settle the next guess or a different round',()=>{
 assert.equal(matchesAck(pending,{roundId:'round',requestId:'old-request'}),false);
 assert.equal(matchesAck(pending,{roundId:'old',requestId:pending.requestId}),false);
 assert.equal(matchesAck(pending,{roundId:'round'}),false);
 assert.equal(matchesAck(pending,{roundId:'round',requestId:pending.requestId}),true);
 assert.equal(validRequestId('x'.repeat(65)),false);
});
test('authoritative receipt distinguishes exact numeric attempt, another seat-tab answer, and closure',()=>{
 const round={id:'round',mode:'trivia',phase:'submissions',attempts:[{id:'old-attempt',guess:'1234'}]};
 assert.equal(pendingReceipt(pending,round),null);
 assert.equal(pendingReceipt(pending,{...round,attempts:[{id:'new-attempt',guess:'4321'}]}),null);
 assert.equal(pendingReceipt(pending,{...round,attempts:[{id:'new-attempt',guess:'1234'}]}),'accepted');
 assert.equal(pendingReceipt(pending,{...round,submitted:true,savedAnswer:'other'}),'already-submitted');
 assert.equal(pendingReceipt(pending,{...round,phase:'closed'}),'closed');
 assert.equal(pendingReceipt(pending,{...round,id:'old',submitted:true}),null);
});
