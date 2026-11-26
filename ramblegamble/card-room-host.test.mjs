import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mountCardRoom } from './card-room-host.mjs';
import { createQuiplashRound, createRedHandedRound } from './card-games.mjs';
import { decodePacket, encodePacket } from './card-room-protocol.mjs';
class Element {
  constructor(){this.children=[];this.dataset={};this.events={};this.value='';}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(){this.children=[]}
  addEventListener(event,fn){this.events[event]=fn}
}
class Connection extends EventEmitter {
  open=true; sent=[];
  send(data){this.sent.push(data)}
  close(){this.open=false;this.emit('close')}
}
test('host UI connects three authenticated peers, delivers private snapshots, acknowledges and imports offline packets',async()=>{
 const selectors=Object.fromEntries(['status','links','start','packet','import'].map(k=>[`[data-room-${k}]`,new Element()]));
 const prior={document:globalThis.document,location:globalThis.location,sessionStorage:globalThis.sessionStorage,Peer:globalThis.Peer};
 let peer;
 try {
  globalThis.document={createElement:()=>new Element()}; globalThis.location={href:'https://example.test/rg/'};
  globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};
  globalThis.Peer=class extends EventEmitter { constructor(id){super();this.id=id;peer=this;} };
  let round=createRedHandedRound(Array.from({length:15},(_,i)=>`evidence ${i}`),['prompt']);
  let roomUI; roomUI=mountCardRoom({querySelector:s=>selectors[s]},{getRound:()=>round,commitRound:r=>{round=r;roomUI.publish()}});
  const invites=Object.fromEntries(selectors['[data-room-links]'].children.map(row=>{const url=new URL(row.children[0].href);assert.equal(url.pathname,'/rg/player/');const invite=decodePacket(url.hash.slice(1)); assert.ok(!('round'in invite));return [invite.player,invite]}));
  await selectors['[data-room-start]'].events.click();peer.emit('open');
  const connections={};
  for(const name of ['kaz','faroe','erin']){const conn=new Connection();connections[name]=conn;peer.emit('connection',conn);conn.emit('data',{...invites[name],type:'join'});assert.deepEqual(conn.sent.at(-1).round.hand,round.hands[name]);}
  const bad=new Connection();peer.emit('connection',bad);bad.emit('data',{...invites.kaz,player:'erin',type:'join'});assert.equal(bad.open,false);
  const first={...invites.kaz,type:'submit',roundId:round.id,answer:round.hands.kaz[0]};connections.kaz.emit('data',first);assert.equal(round.phase,'submissions');assert.ok(connections.kaz.sent.some(m=>m.type==='ack'&&m.status==='accepted'));
  const second={...invites.faroe,type:'submit',roundId:round.id,answer:round.hands.faroe[0]};selectors['[data-room-packet]'].value=encodePacket(second);selectors['[data-room-import]'].events.click();assert.ok(round.submissions.faroe);
  connections.erin.emit('data',{...invites.erin,type:'submit',roundId:round.id,answer:round.hands.erin[0]});assert.equal(round.phase,'voting');assert.equal(round.responses.length,3);
  round=createQuiplashRound(['next']);roomUI.publish();assert.equal(connections.kaz.sent.at(-1).round.mode,'quiplash');connections.kaz.emit('data',first);assert.equal(round.submissions.kaz,null);assert.ok(connections.kaz.sent.some(m=>m.type==='ack'&&m.status==='stale-round'));
  for(const c of Object.values(connections)) c.close();
 } finally { for(const [key,value] of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;} }
});
