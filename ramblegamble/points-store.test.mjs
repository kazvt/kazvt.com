import test from "node:test";
import assert from "node:assert/strict";
import { normalizePointScores, RG_CONTESTANTS } from "./points-store.mjs";

test("points stay bound to the three fixed contestants", () => {
  assert.deepEqual(RG_CONTESTANTS, ["faroe", "erin", "kaz"]);
  assert.deepEqual(normalizePointScores({ faroe: "4", erin: 2, kaz: 9, other: 100 }), {
    faroe: 4,
    erin: 2,
    kaz: 9,
  });
});

test("malformed, fractional, negative, and unsafe scores normalize to zero", () => {
  assert.deepEqual(normalizePointScores({ faroe: -1, erin: 1.5, kaz: Number.MAX_SAFE_INTEGER + 1 }), {
    faroe: 0,
    erin: 0,
    kaz: 0,
  });
  assert.deepEqual(normalizePointScores(null), { faroe: 0, erin: 0, kaz: 0 });
  assert.deepEqual(normalizePointScores([5, 6, 7]), { faroe: 0, erin: 0, kaz: 0 });
});

import { createPointStore } from './points-store.mjs';
const KEY = 'ramblegamble.points.v1';
function fixture() {
  let raw = null, failRead = false, failWrite = false, failPost = false;
  const buses = [], messages = [];
  const storage = {
    getItem(key) { assert.equal(key, KEY); if (failRead) throw Error('read blocked'); return raw; },
    setItem(key, value) { assert.equal(key, KEY); if (failWrite) throw Error('quota'); raw = value; },
  };
  let tail = Promise.resolve();
  const locks = { request(name, fn) { assert.equal(name, 'ramblegamble.points.mutation.v1'); const next = tail.then(fn); tail = next.catch(() => {}); return next; } };
  const emit = (target, type, data = {}) => target.dispatchEvent(Object.assign(new Event(type), data));
  function tab({ channel = true } = {}) {
    const target = new EventTarget(), document = new EventTarget(); document.hidden = false;
    const bus = new EventTarget(); buses.push(bus);
    bus.postMessage = data => { if (failPost) throw Error('channel closed'); for (const other of buses) if (other !== bus) messages.push(() => emit(other, 'message', { data })); };
    const store = createPointStore({ getStorage: () => storage, makeChannel: () => { if (!channel) throw Error('no channel'); return bus; }, target, document, locks });
    const observed = [];
    const unsubscribe = store.subscribe(scores => observed.push(scores));
    return { ...store, target, document, bus, observed, unsubscribe };
  }
  return { tab, storage, emit, messages, blockRead: value => {failRead=value;}, blockWrite: value => {failWrite=value;}, blockPost: value => {failPost=value;} };
}
const scores = (faroe=0, erin=0, kaz=0) => ({faroe,erin,kaz});

test('same-tab writes immediately update every subscriber; unchanged values do not rerender', () => {
  const f=fixture(), a=f.tab(), second=[];
  a.subscribe(value => second.push(value));
  assert.equal(a.write(scores(10,20,30)).persisted,true);
  assert.deepEqual(a.observed,[scores(),scores(10,20,30)]);
  assert.deepEqual(second,a.observed);
  a.write(scores(10,20,30)); assert.equal(a.observed.length,2);
  a.unsubscribe();a.write(scores(11,20,30)); assert.equal(a.observed.length,2);assert.equal(second.length,3);
});
test('delayed storage and broadcast events never restore old scores, including after reset', () => {
  const f=fixture(), a=f.tab(), b=f.tab();
  a.write(scores(5)); a.write(scores(15)); a.write(scores());
  f.messages.reverse().forEach(fn=>fn());
  f.emit(b.target,'storage',{key:KEY,newValue:JSON.stringify(scores(15))});
  assert.deepEqual(b.observed,[scores()]);
  a.write(scores(9,8,7)); f.messages.at(-1)();
  f.emit(b.bus,'message',{data:{type:'scores',scores:scores(100)}});
  assert.deepEqual(b.observed.at(-1),scores(9,8,7));
});
test('storage-only browsers and resumed tabs recover current persisted values',()=>{
  const f=fixture(), a=f.tab({channel:false}), b=f.tab({channel:false});
  a.write(scores(10)); f.emit(b.target,'storage',{key:KEY,newValue:'{}'});assert.deepEqual(b.observed.at(-1),scores(10));
  a.write(scores(20));b.document.hidden=true;f.emit(b.document,'visibilitychange');assert.deepEqual(b.observed.at(-1),scores(10));
  b.document.hidden=false;f.emit(b.document,'visibilitychange');assert.deepEqual(b.observed.at(-1),scores(20));
  a.write(scores(30));f.emit(b.target,'pageshow');assert.deepEqual(b.observed.at(-1),scores(30));
  a.write(scores(40));f.emit(b.target,'focus');assert.deepEqual(b.observed.at(-1),scores(40));
  f.storage.setItem(KEY,'{}');f.emit(b.target,'storage',{key:null});assert.deepEqual(b.observed.at(-1),scores());
});
test('failed persistence does not publish phantom balances; read failure keeps last known and blocks mutations',()=>{
  const f=fixture(), a=f.tab(), b=f.tab();a.write(scores(8));f.messages.at(-1)();
  f.blockWrite(true); const before=f.messages.length;assert.deepEqual(a.write(scores(99)),{scores:scores(8),persisted:false});assert.equal(f.messages.length,before);
  f.blockRead(true);f.emit(b.target,'focus');assert.deepEqual(b.observed.at(-1),scores(8));assert.throws(()=>a.read({strict:true}),/Could not read/);
  f.blockRead(false);f.blockWrite(false);f.blockPost(true);assert.equal(a.write(scores(12)).persisted,true);assert.deepEqual(a.observed.at(-1),scores(12));
  f.emit(b.target,'storage',{key:KEY});assert.deepEqual(b.observed.at(-1),scores(12));
});
test('simultaneous mutations read fresh totals inside one exclusive lock',async()=>{
  const f=fixture(), a=f.tab(), b=f.tab();a.write(scores(1000,1000,1000));
  const jobs=Array.from({length:300},(_,i)=> (i%2?a:b).withLock(()=>{const tab=i%2?a:b;const value=tab.read({strict:true});value[RG_CONTESTANTS[i%3]]+=i%2?2:-1;assert.equal(tab.write(value).persisted,true);}));
  await Promise.all(jobs);assert.deepEqual(a.read(),scores(1050,1050,1050));
  // A failed transaction must release the lock for the next command.
  await assert.rejects(a.withLock(()=>{throw Error('failure');}),/failure/);
  await b.withLock(()=>{const value=b.read({strict:true});value.kaz+=1;b.write(value);});assert.deepEqual(a.read(),scores(1050,1050,1051));
});
test('subscriber exceptions do not prevent persistence or other subscribers',()=>{
  const f=fixture(), a=f.tab(), old=console.error; console.error=()=>{};
  try {a.subscribe(()=>{throw Error('view failed');});const observed=[];a.subscribe(value=>observed.push(value));assert.equal(a.write(scores(77)).persisted,true);assert.deepEqual(observed.at(-1),scores(77));} finally {console.error=old;}
});

import {createStarStore,normalizeStarScores} from './points-store.mjs';
test('star storage, channel and mutation locks are distinct from legacy points',async()=>{
  const data=new Map([[KEY,JSON.stringify(scores(100,200,300))]]),channels=[],lockNames=[],pending=[];
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const buses=new Map();
  const makeChannel=key=>{channels.push(key);const bus=new EventTarget();const group=buses.get(key)||[];group.push(bus);buses.set(key,group);bus.postMessage=message=>{for(const other of group)if(other!==bus)pending.push(()=>other.dispatchEvent(Object.assign(new Event('message'),{data:message})));};return bus;};
  const tails=new Map();const locks={request(name,fn){lockNames.push(name);const next=(tails.get(name)||Promise.resolve()).then(fn);tails.set(name,next.catch(()=>{}));return next;}};
  const options={getStorage:()=>storage,makeChannel,locks};
  const points=createPointStore(options),a=createStarStore(options),b=createStarStore(options),seen=[],pointSeen=[];
  points.subscribe(v=>pointSeen.push(v));b.subscribe(v=>seen.push(v));a.subscribe(()=>{});
  assert.deepEqual(a.read(),scores());assert.deepEqual(points.read(),scores(100,200,300));
  assert.equal(data.has('ramblegamble.stars.v1'),false);
  await Promise.all(Array.from({length:100},(_,i)=>{const store=i%2?a:b;return store.withLock(()=>{const next=store.read({strict:true});next.kaz++;assert.ok(store.write(next).persisted);});}));
  pending.reverse().forEach(fn=>fn());assert.deepEqual(b.read(),scores(0,0,100));assert.deepEqual(seen.at(-1),scores(0,0,100));
  assert.deepEqual(pointSeen,[scores(100,200,300)]);assert.deepEqual(channels,[KEY,'ramblegamble.stars.v1','ramblegamble.stars.v1']);assert.ok(lockNames.every(v=>v==='ramblegamble.stars.mutation.v1'));
  assert.deepEqual(createStarStore(options).read(),scores(0,0,100));
  data.set('ramblegamble.stars.v1','{');assert.throws(()=>a.read({strict:true}),/Could not read saved stars/);assert.deepEqual(a.read(),scores(0,0,100));assert.deepEqual(points.read(),scores(100,200,300));
});


test('new star saves never coerce corrupt strings, booleans, arrays or fractions into awards',()=>{
  for(const invalid of [true,false,'12',[5],{},null,undefined,1.5,-2,Number.MAX_SAFE_INTEGER+1,NaN,Infinity])assert.deepEqual(normalizeStarScores({faroe:invalid,erin:2,kaz:3}),scores(0,2,3));
  assert.deepEqual(normalizeStarScores({faroe:Number.MAX_SAFE_INTEGER,erin:0,kaz:1,lillie:42}),scores(Number.MAX_SAFE_INTEGER,0,1));
});
