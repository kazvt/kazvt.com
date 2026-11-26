import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageChannel, Worker } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { openLocalHost, connectLocal, wrapLocalPort } from './card-room-local.mjs';
import { channelBinding, generateHostIdentity, nonce, transcript, signHost, verifyHost, proveSeat, verifySeat } from './card-room-auth.mjs';
import { createRoom, ROOM_VERSION, decodePacket } from './card-room-protocol.mjs';
import { mountCardRoom } from './card-room-host.mjs';
import { createQuiplashRound } from './card-games.mjs';
const workerSource=readFileSync(new URL('./card-room-local-worker.js',import.meta.url),'utf8');
function broker(t){
  // Real separate worker thread and real transferred MessagePorts. Only the
  // browser's SharedWorker constructor is adapted to Node's worker API.
  const worker=new Worker(`const {parentPort,MessageChannel}=require('node:worker_threads');global.self=globalThis;${workerSource}\nparentPort.on('message',port=>self.onconnect({ports:[port]}));`,{eval:true});
  const ports=[];t.after(async()=>{for(const p of ports)p.close();await worker.terminate();});
  return class SharedWorker {constructor(){const pair=new MessageChannel();this.port=pair.port1;ports.push(this.port);worker.postMessage(pair.port2,[pair.port2]);}};
}
const until=async pred=>{for(let i=0;i<250;i++){if(pred())return;await new Promise(r=>setTimeout(r,5));}assert.fail('Timed out');};
const listen=(conn,pred=()=>true)=>new Promise(resolve=>conn.on('data',message=>{if(pred(message))resolve(message);}));
const roomId='rg-'+'a'.repeat(32);

test('real transferred local ports are isolated by room and session, authenticate, and carry large Unicode payloads',async t=>{
  const env={SharedWorker:broker(t)},hosts=[];const host=openLocalHost(roomId,c=>hosts.push(c),env);t.after(()=>host.close());await until(()=>host.ready);
  assert.equal(await connectLocal('rg-'+'b'.repeat(32),{env}),null);
  const c1=await connectLocal(roomId,{env}),c2=await connectLocal(roomId,{env});assert.ok(c1&&c2);t.after(()=>{c1.close();c2.close();});await until(()=>hosts.length===2);
  const h1=hosts.find(c=>c.localChannelId===c1.localChannelId),h2=hosts.find(c=>c.localChannelId===c2.localChannelId);
  assert.ok(h1&&h2);assert.deepEqual(channelBinding(c1,false),channelBinding(h1,true));assert.notDeepEqual(channelBinding(c1,false),channelBinding(c2,false));
  const identity=await generateHostIdentity(),fields={room:roomId,player:'kaz',clientNonce:nonce(),hostNonce:nonce()},token=nonce();
  const text=transcript(fields,channelBinding(h1,true)),other=transcript(fields,channelBinding(h2,true));
  const signature=await signHost(identity,text),proof=await proveSeat(token,text);
  assert.ok(await verifyHost(identity.publicKey,text,signature));assert.equal(await verifyHost(identity.publicKey,other,signature),false);assert.ok(await verifySeat(token,text,proof));assert.equal(await verifySeat(token,other,proof),false);
  let leaked=false;h2.on('data',()=>{leaked=true;});const large={prompt:'🐱'.repeat(250000),media:'a'.repeat(500000)};const received=listen(h1);c1.send(large);assert.deepEqual(await received,large);assert.equal(leaked,false);assert.throws(()=>c1.send({x:'a'.repeat(1500000)}),/large/);
  const back=listen(c1);h1.send({ok:true});assert.deepEqual(await back,{ok:true});c1.close();await until(()=>!h1.open);assert.ok(c2.open);
  host.close();await until(()=>!c2.open);
});
test('reader handoff replaces stale registration; abort and missing SharedWorker fall back safely',async t=>{
  const env={SharedWorker:broker(t)},first=openLocalHost(roomId,()=>{},env);t.after(()=>first.close());await until(()=>first.ready);
  const next=openLocalHost(roomId,()=>{},env);t.after(()=>next.close());await until(()=>next.ready&&first.closed);
  const c=await connectLocal(roomId,{env});assert.ok(c);c.close();const ctrl=new AbortController();ctrl.abort();assert.equal(await connectLocal(roomId,{env,signal:ctrl.signal}),null);assert.equal(await connectLocal(roomId,{env:{}}),null);
  first.close();const again=await connectLocal(roomId,{env});assert.ok(again);again.close();next.close();
});
test('malformed port frame closes without delivering data',async t=>{
 const pair=new MessageChannel(),conn=wrapLocalPort(pair.port1,crypto.randomUUID());t.after(()=>{conn.close();pair.port2.close();});let data=false;conn.on('data',()=>{data=true;});pair.port2.postMessage({type:'data',value:'{invalid'});await until(()=>!conn.open);assert.equal(data,false);
});
class Element {children=[];events={};value='';append(...nodes){this.children.push(...nodes);}replaceChildren(){this.children=[];}addEventListener(type,fn){this.events[type]=fn;}}

test('actual elected host accepts a local private answer even when the public PeerJS service fails',async t=>{
 const SharedWorker=broker(t),values=new Map(),selectors=Object.fromEntries(['status','links','start','stop','packet','import','rotate'].map(k=>[`[data-room-${k}]`,new Element()]));
 const locks={request(name,options,fn){return Promise.resolve().then(typeof options==='function'?options:fn);}};
 const env={SharedWorker,document:{createElement:()=>new Element()},navigator:{locks},location:{href:'https://example.test/rg/'},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},addEventListener(){},removeEventListener(){}};
 let round=createQuiplashRound(['Private question']),peers=[];
 class Peer extends EventEmitter {constructor(){super();peers.push(this);}destroy(){this.destroyed=true;this.emit('close');}}
 const identity=await generateHostIdentity();const host=mountCardRoom({querySelector:s=>selectors[s]},{env,identityLoader:async()=>identity,peerLoader:async()=>Peer,getRound:()=>round,commitRound:r=>{round=r;return true;}});t.after(()=>host.dispose());
 await host.ready;selectors['[data-room-start]'].events.click();await until(()=>selectors['[data-room-status]'].textContent.includes('local ready')&&peers.length>0);
 const row=selectors['[data-room-links]'].children.find(row=>row.children[0].textContent.startsWith('KAZ'));const invite=decodePacket(new URL(row.children[0].href).hash.slice(1));
 const c=await connectLocal(invite.room,{env});assert.ok(c);t.after(()=>c.close());
 const challenge=listen(c,m=>m.type==='challenge');c.send({v:ROOM_VERSION,type:'hello',room:invite.room,player:invite.player,clientNonce:nonce()});const ch=await challenge;const text=transcript(ch,channelBinding(c,false));assert.ok(await verifyHost(invite.hostKey,text,ch.signature));const ready=listen(c,m=>m.type==='round');c.send({v:ROOM_VERSION,type:'proof',proof:await proveSeat(invite.token,text)});assert.equal((await ready).round.prompt,'Private question');
 peers[0].emit('error',{type:'network'});await until(()=>peers[0].destroyed);assert.equal(c.open,true);assert.match(selectors['[data-room-status]'].textContent,/1\/3 connected/);
 const ack=listen(c,m=>m.type==='ack');c.send({v:ROOM_VERSION,type:'submit',roundId:round.id,requestId:'local-test',answer:'Secret answer'});assert.equal((await ack).status,'accepted');assert.equal(round.submissions.kaz,'Secret answer');
 selectors['[data-room-stop]'].events.click();await until(()=>!c.open);
});
