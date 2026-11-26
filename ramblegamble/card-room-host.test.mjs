import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mountCardRoom } from './card-room-host.mjs';
import { createQuiplashRound, createRedHandedRound } from './card-games.mjs';
import { decodePacket, encodePacket, ROOM_VERSION } from './card-room-protocol.mjs';
import { ROOM_KEY, ENABLED_KEY, READER_LOCK, electReader } from './card-room-election.mjs';
class Element {
  constructor(){this.children=[];this.dataset={};this.events={};this.value='';}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(){this.children=[]}
  addEventListener(event,fn){this.events[event]=fn}
}
import { generateHostIdentity, nonce, transcript, proveSeat, verifyHost, channelBinding } from './card-room-auth.mjs';
const fp=n=>Array(32).fill(n).join(':');
class Connection extends EventEmitter {
  peerConnection={localDescription:{sdp:`a=fingerprint:sha-256 ${fp('ab')}\r\n`},remoteDescription:{sdp:`a=fingerprint:sha-256 ${fp('cd')}\r\n`}};
  open=true; sent=[];
  send(data){this.sent.push(data)}
  close(){if(this.open){this.open=false;this.emit('close')}}
}
const flush = async () => { for(let i=0;i<5;i++) await new Promise(resolve=>setImmediate(resolve)); };
const until=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('Timed out');};
// Simulates exclusive Web Locks with FIFO queue and queued cancellation.
class Locks {
  queues=new Map(); held=new Set();
  request(name,options,fn){
    if(typeof options==='function'){fn=options;options={};}
    return new Promise((resolve,reject)=>{
      const queue=this.queues.get(name)||[];this.queues.set(name,queue);
      const item={fn,resolve,reject,signal:options.signal};
      item.abort=()=>{const i=queue.indexOf(item);if(i>=0){queue.splice(i,1);reject(new DOMException('aborted','AbortError'));}};
      if(item.signal?.aborted){reject(new DOMException('aborted','AbortError'));return;}
      queue.push(item);item.signal?.addEventListener('abort',item.abort,{once:true});this.pump(name);
    });
  }
  pump(name){if(this.held.has(name))return;const item=this.queues.get(name)?.shift();if(!item)return;this.held.add(name);item.signal?.removeEventListener('abort',item.abort);Promise.resolve().then(item.fn).then(item.resolve,item.reject).finally(()=>{this.held.delete(name);this.pump(name)});}
}
function harness(){
 const locks=new Locks(), values=new Map(), tabs=[], peers=[];
 const identity=generateHostIdentity();
 let round=createRedHandedRound(Array.from({length:15},(_,i)=>`evidence ${i}`),['prompt']);
 class Peer extends EventEmitter {constructor(id){super();this.id=id;this.destroyed=false;peers.push(this);}destroy(){this.destroyed=true;this.emit('close');}}
 function tab(role,legacy=null,withLocks=true){
  const selectors=Object.fromEntries(['status','links','start','stop','packet','import','rotate'].map(k=>[`[data-room-${k}]`,new Element()]));
  const bus=new EventEmitter();const env={confirm:()=>true,document:{createElement:()=>new Element()},location:{href:`https://example.test${role}`},navigator:{locks:withLocks?locks:undefined},sessionStorage:{getItem:()=>legacy?JSON.stringify(legacy):null},localStorage:{getItem:k=>values.get(k)||null,setItem(k,v){if(values.get(k)===v)return;values.set(k,v);for(const other of tabs)if(other.env!==env)queueMicrotask(()=>other.bus.emit('storage',{key:k}));}},addEventListener:(e,f)=>bus.on(e,f),removeEventListener:(e,f)=>bus.off(e,f)};
  const t={env,bus,selectors,role};tabs.push(t);
  t.room=mountCardRoom({querySelector:s=>selectors[s]},{env,role,peerLoader:async()=>Peer,identityLoader:()=>identity,getRound:()=>round,commitRound:r=>{round=r;for(const x of tabs)x.room?.publish();return true;}});
  t.click=k=>selectors[`[data-room-${k}]`].events.click();
  t.invites=()=>Object.fromEntries(selectors['[data-room-links]'].children.map(row=>{const url=new URL(row.children[0].href);assert.equal(url.pathname,'/rg/player/');const invite=decodePacket(url.hash.slice(1));assert.ok(!('round'in invite));return [invite.player,invite]}));
  return t;
 }
 return {tab,peers,values,locks,get round(){return round},set round(r){round=r;for(const x of tabs)x.room.publish()},dispose(){for(const t of tabs)t.room.dispose();}};
}
async function join(peer,invite, expect=true){
 const conn=new Connection();peer.emit('connection',conn);const clientNonce=nonce();
 conn.emit('data',{v:ROOM_VERSION,type:'hello',room:invite.room,player:invite.player,clientNonce});
 await until(()=>conn.sent.length||!conn.open);const challenge=conn.sent[0];assert.equal(challenge.type,'challenge');
 const text=transcript(challenge,channelBinding(conn,true));assert.ok(await verifyHost(invite.hostKey,text,challenge.signature));
 assert.equal('token' in challenge,false);conn.emit('data',{v:ROOM_VERSION,type:'proof',proof:await proveSeat(invite.token,text)});
 await until(()=>conn.sent.some(m=>m.type===(expect?'round':'denied'))||!conn.open);
 if(!expect)assert.equal(conn.sent.some(m=>m.type==='round'),false);
 return conn;
}

test('console and display elect one reader, share invites, and fail over with the same room and pending round',async()=>{
 const h=harness();try{
  const consoleTab=h.tab('/rg/console/');await consoleTab.room.ready;const display=h.tab('/rg/');await display.room.ready;
  assert.deepEqual(consoleTab.invites(),display.invites());const invites=consoleTab.invites();
  consoleTab.click('start');await flush();assert.equal(h.peers.length,1);h.peers[0].emit('open');await flush();
  assert.match(consoleTab.selectors['[data-room-status]'].textContent,/ACTIVE READER/);assert.match(display.selectors['[data-room-status]'].textContent,/STANDBY/);
  const kaz=await join(h.peers[0],invites.kaz);assert.deepEqual(kaz.sent.at(-1).round.hand,h.round.hands.kaz);
  const first={...invites.kaz,type:'submit',roundId:h.round.id,answer:h.round.hands.kaz[0]};kaz.emit('data',first);await flush();assert.ok(h.round.submissions.kaz);assert.ok(kaz.sent.some(m=>m.type==='ack'&&m.status==='accepted'));
  consoleTab.room.dispose();await flush();assert.equal(h.peers.length,2);assert.equal(h.peers[0].destroyed,true);assert.equal(h.peers[1].id,h.peers[0].id);h.peers[1].emit('open');await flush();assert.match(display.selectors['[data-room-status]'].textContent,/ACTIVE READER/);
  const k2=await join(h.peers[1],invites.kaz);assert.equal(k2.sent.at(-1).round.submitted,true);k2.emit('data',first);await flush();assert.ok(k2.sent.some(m=>m.type==='ack'&&m.status==='accepted'));
  const bad=await join(h.peers[1],{...invites.kaz,player:'erin'},false);assert.equal(bad.sent.at(-1).type,'denied');bad.close();
  const faroe=await join(h.peers[1],invites.faroe);assert.deepEqual(faroe.sent.at(-1).round.hand,h.round.hands.faroe);
  const second={...invites.faroe,type:'submit',roundId:h.round.id,answer:h.round.hands.faroe[0]};display.selectors['[data-room-packet]'].value=encodePacket(second);await display.click('import');assert.ok(h.round.submissions.faroe);
  const erin=await join(h.peers[1],invites.erin);erin.emit('data',{...invites.erin,type:'submit',roundId:h.round.id,answer:h.round.hands.erin[0]});await flush();assert.equal(h.round.phase,'voting');assert.equal(h.round.responses.length,3);
  h.round=createQuiplashRound(['next']);k2.emit('data',first);await flush();assert.equal(h.round.submissions.kaz,null);assert.ok(k2.sent.some(m=>m.type==='ack'&&m.status==='stale-round'));
  display.click('stop');await flush();assert.equal(h.values.get(ENABLED_KEY),'false');assert.equal(h.peers[1].destroyed,true);
 }finally{h.dispose();await flush();}
});
test('simultaneous host startup creates one identity; display can lead and console can take over',async()=>{
 const h=harness();try{const display=h.tab('/rg/'),consoleTab=h.tab('/rg/console/');await Promise.all([display.room.ready,consoleTab.room.ready]);assert.deepEqual(display.invites(),consoleTab.invites());display.click('start');consoleTab.click('start');await flush();assert.equal(h.peers.length,1);display.bus.emit('pagehide');await flush();assert.equal(h.peers.length,2);assert.equal(h.peers[0].destroyed,true);display.bus.emit('pageshow');await flush();assert.equal(h.peers.length,2);consoleTab.click('stop');await flush();assert.ok(h.peers.every(p=>p.destroyed));}finally{h.dispose();await flush();}
});
test('queued reader cancellation and repeated enable/disable do not create concurrent readers',async()=>{
 const locks=new Locks();let active=0,peak=0,count=0;const make=()=>electReader({locks,activate(){active++;count++;peak=Math.max(peak,active);return()=>active--;}});const a=make(),b=make();a.setWanted(true);b.setWanted(true);await flush();b.setWanted(false);a.setWanted(false);await flush();assert.equal(active,0);assert.equal(count,1);a.setWanted(true);b.setWanted(true);await flush();a.setWanted(false);await flush();assert.equal(active,1);assert.equal(peak,1);b.setWanted(false);await flush();assert.equal(active,0);assert.equal(locks.held.has(READER_LOCK),false);
});
test('browser without Web Locks stays offline, retains invite and packet import',async()=>{
 const h=harness();try{const t=h.tab('/rg/',null,false);await t.room.ready;assert.equal(t.selectors['[data-room-start]'].disabled,true);assert.match(t.selectors['[data-room-status]'].textContent,/unavailable/);const i=t.invites().kaz;t.selectors['[data-room-packet]'].value=encodePacket({...i,type:'submit',roundId:h.round.id,answer:h.round.hands.kaz[0]});await t.click('import');assert.ok(h.round.submissions.kaz);assert.equal(h.peers.length,0);assert.ok(h.values.has(ROOM_KEY));}finally{h.dispose();await flush();}
});

test('revocation from standby rejects old online proof and offline packet, preserves other invitations and accepted answers',async()=>{
 const h=harness();try{const a=h.tab('/rg/'),b=h.tab('/rg/console/');await Promise.all([a.room.ready,b.room.ready]);a.click('start');await until(()=>h.peers.length===1);h.peers[0].emit('open');await flush();const old=a.invites();const kaz=await join(h.peers[0],old.kaz),faroe=await join(h.peers[0],old.faroe);
 const answer={...old.kaz,type:'submit',roundId:h.round.id,answer:h.round.hands.kaz[0]};kaz.emit('data',answer);await until(()=>!!h.round.submissions.kaz);
 const row=b.selectors['[data-room-links]'].children.find(r=>decodePacket(new URL(r.children[0].href).hash.slice(1)).player==='kaz');await row.children.find(x=>x.textContent==='REVOKE / REISSUE').events.click();await until(()=>!kaz.open);assert.equal(faroe.open,true);const next=b.invites();assert.notEqual(next.kaz.token,old.kaz.token);assert.deepEqual(next.faroe,old.faroe);assert.equal(h.round.submissions.kaz,answer.answer);
 const invalid=await join(h.peers[0],old.kaz,false);assert.equal(invalid.sent.at(-1).type,'denied');invalid.close();const valid=await join(h.peers[0],next.kaz);assert.equal(valid.sent.at(-1).round.submitted,true);
 h.round=createQuiplashRound(['next']);b.selectors['[data-room-packet]'].value=encodePacket({...answer,roundId:h.round.id,answer:'forged'});await b.click('import');assert.equal(h.round.submissions.kaz,null);
 await b.click('rotate');await until(()=>h.peers.length===2);assert.notEqual(b.invites().kaz.room,old.kaz.room);assert.ok(!valid.open&&!faroe.open);assert.deepEqual(a.invites(),b.invites());assert.equal(h.round.submissions.kaz,null);
 }finally{h.dispose();await flush();}
});
test('legacy v1 join never receives a private hand; replayed proof cannot join another connection',async()=>{
 const h=harness();try{const a=h.tab('/rg/');await a.room.ready;a.click('start');await until(()=>h.peers.length===1);h.peers[0].emit('open');const i=a.invites().kaz;const old=new Connection();h.peers[0].emit('connection',old);old.emit('data',{...i,v:1,type:'join'});assert.equal(old.open,false);assert.equal(old.sent.length,0);
 const c1=new Connection(),c2=new Connection();const clientNonce=nonce();for(const c of [c1,c2]){h.peers[0].emit('connection',c);c.emit('data',{v:ROOM_VERSION,type:'hello',room:i.room,player:i.player,clientNonce});}await until(()=>c1.sent.length&&c2.sent.length);const p=await proveSeat(i.token,transcript(c1.sent[0],channelBinding(c1,true)));c2.emit('data',{v:ROOM_VERSION,type:'proof',proof:p});await until(()=>c2.sent.some(m=>m.type==='denied'));assert.ok(!c2.sent.some(m=>m.type==='round'));c1.close();c2.close();
 }finally{h.dispose();await flush();}
});

test('authenticated live trivia reaches all seats and survives elected-reader handoff',async()=>{
 const {createLiveTrivia}=await import('./live-trivia.mjs');const h=harness();try{
 const a=h.tab('/rg/console/');await a.room.ready;const b=h.tab('/rg/');await b.room.ready;const invites=a.invites();a.click('start');await flush();h.peers[0].emit('open');await flush();const k=await join(h.peers[0],invites.kaz),f=await join(h.peers[0],invites.faroe),e=await join(h.peers[0],invites.erin);
 h.round=createLiveTrivia({round:'25',difficulty:5,format:{mode:'choice-text'},content:{question:'Question?',subtitle:'Context',options:[{label:'A',correct:true},{label:'B'}],acceptedAnswers:['private']},cards:{}});await flush();for(const c of [k,f,e]){const r=c.sent.at(-1).round;assert.equal(r.mode,'trivia');assert.equal(r.question.subtitle,'Context');assert.ok(!JSON.stringify(r).includes('private'));assert.equal('correct'in r.question.options[0],false);}
 const answer=JSON.stringify({selected:[0]});const id=h.round.id;k.emit('data',{v:ROOM_VERSION,type:'submit',roundId:id,answer});await until(()=>h.round.submissions.kaz===answer);assert.equal(h.round.submissions.faroe,null);a.room.dispose();await flush();assert.equal(h.peers.length,2);h.peers[1].emit('open');await flush();const k2=await join(h.peers[1],invites.kaz);assert.equal(k2.sent.at(-1).round.submitted,true);const e2=await join(h.peers[1],invites.erin);e2.emit('data',{v:ROOM_VERSION,type:'submit',roundId:'old',answer});await until(()=>e2.sent.some(m=>m.status==='stale-round'));assert.equal(h.round.submissions.erin,null);e2.emit('data',{v:ROOM_VERSION,type:'submit',roundId:id,answer});await until(()=>h.round.submissions.erin===answer);
 }finally{h.dispose();}
});
