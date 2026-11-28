import test from 'node:test';
import assert from 'node:assert/strict';
import {createPointAwardBus,normalizeAwardTotals,POINT_AWARD_KEY,POINT_AWARD_TTL} from './point-award-events.mjs';
import {createPointAwardStinger,combinePointAwards,POINT_STINGER_URL,STAR_STINGER_URL} from './point-award-stinger.mjs';
const event=(id,at,totals)=>({type:'point-award',id,at,totals});
function transport(){
  let time=100000,id=0;const channels=[],targets=[],storage=new Map();
  function make(){const target=new EventTarget();targets.push(target);let channel;
    const bus=createPointAwardBus({target,now:()=>time,makeId:()=>`id-${++id}`,getStorage:()=>({setItem(key,newValue){storage.set(key,newValue);for(const other of targets)if(other!==target)other.dispatchEvent(Object.assign(new Event('storage'),{key,newValue}));}}),makeChannel:()=>{channel=new EventTarget();channels.push(channel);channel.postMessage=data=>{for(const other of channels)if(other!==channel)other.dispatchEvent(Object.assign(new Event('message'),{data}));};channel.close=()=>channels.splice(channels.indexOf(channel),1);return channel;}});
    return {bus,target,receive(value){target.dispatchEvent(Object.assign(new Event('storage'),{key:POINT_AWARD_KEY,newValue:JSON.stringify(value)}));}};
  }return {make,storage,advance:ms=>time+=ms,now:()=>time};
}
test('awards normalize only positive safe integer deltas for known players',()=>{
 assert.deepEqual(normalizeAwardTotals({faroe:1,erin:0,kaz:'30',lillie:50}),{faroe:1});
 assert.deepEqual(normalizeAwardTotals({faroe:Infinity,erin:-10,kaz:Number.MAX_SAFE_INTEGER+1}),{});
 assert.deepEqual(normalizeAwardTotals(null),{});
});
test('same-tab and both cross-tab transports deliver once; late subscriber never replays stored award',()=>{
 const t=transport(),a=t.make(),b=t.make(),local=[],remote=[];a.bus.subscribe(x=>local.push(x));b.bus.subscribe(x=>remote.push(x));
 a.bus.publish({faroe:5,kaz:8});assert.deepEqual(local,remote);assert.equal(remote.length,1);assert.deepEqual(remote[0].totals,{faroe:5,kaz:8});
 const stored=JSON.parse(t.storage.get(POINT_AWARD_KEY));b.receive(stored);assert.equal(remote.length,1);
 const c=t.make(),late=[];c.bus.subscribe(x=>late.push(x));assert.equal(late.length,0);
 a.bus.publish({erin:9});assert.equal(remote.length,2);assert.equal(late.length,1);assert.deepEqual(late[0].totals,{erin:9});
 a.bus.publish({erin:0});assert.equal(remote.length,2);a.bus.dispose();b.bus.dispose();c.bus.dispose();
});
test('stale, future, malformed and duplicate messages ignored; storage failure is not an award failure',()=>{
 const t=transport(),a=t.make(),seen=[];a.bus.subscribe(x=>seen.push(x));
 a.receive(event('old',t.now()-POINT_AWARD_TTL-1,{faroe:1}));a.receive(event('future',t.now()+5001,{faroe:1}));a.receive(event('bad',t.now(),{faroe:-5}));a.receive({type:'scores',id:'score',at:t.now(),totals:{faroe:5}});
 a.receive(event('valid',t.now(),{faroe:4}));a.receive(event('valid',t.now(),{faroe:4}));assert.equal(seen.length,1);a.bus.dispose();
 const bus=createPointAwardBus({getStorage:()=>({setItem(){throw Error('quota')}}),makeChannel:()=>{throw Error('unavailable')},target:new EventTarget()});let count=0;bus.subscribe(()=>count++);assert.doesNotThrow(()=>bus.publish({kaz:1}));assert.equal(count,1);bus.dispose();
});
test('rapid awards combine per player without rounding even above a safe balance integer',()=>{
 const n=Number.MAX_SAFE_INTEGER;const result=combinePointAwards([event('1',0,{kaz:n,erin:2}),event('2',0,{kaz:n,faroe:1,erin:4})]);
 assert.deepEqual(result.map(x=>[x.name,x.formatted]),[['faroe','+1'],['erin','+6'],['kaz','+18,014,398,509,481,982']]);
});
class Element extends EventTarget{
 constructor(){super();this.hidden=true;this.dataset={};this.children=[];this.textContent='';const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};}
 append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 removeAttribute(key){delete this[key];}
}
function fixture(){
 let now=1000,timers=0;const scheduled=new Map(),flags={allowed:true,blocked:false,muted:false,reduced:false};
 const root=new Element(),rows=new Element(),title=new Element(),status=new Element(),video=new Element(),starVideo=new Element();let attempts=0,loads=0,play=()=>Promise.resolve();
 Object.assign(video,{currentTime:0,ended:false,paused:true,muted:false,load(){loads++;},pause(){this.paused=true;},play(){attempts++;this.paused=false;return play();}});
 Object.assign(starVideo,{currentTime:0,ended:false,paused:true,muted:false,load(){},pause(){this.paused=true;},play(){this.paused=false;return play();}});
 const ctrl=createPointAwardStinger({root,video,starVideo,rows,title,status,...Object.fromEntries(Object.keys(flags).map(key=>[key,()=>flags[key]])),doc:{createElement:()=>new Element()},clock:()=>now,wall:()=>now,setTimer:fn=>{scheduled.set(++timers,fn);return timers;},clearTimer:id=>scheduled.delete(id)});
 return {ctrl,root,rows,title,status,video,starVideo,flags,get attempts(){return attempts;},get loads(){return loads;},setPlay:fn=>play=fn,send:totals=>ctrl.enqueue(event(`e${now}`,now,totals)),sendStar:totals=>ctrl.enqueue({...event(`s${now}`,now,totals),type:"star-award"}),advance:ms=>{now+=ms;ctrl.step();},flush:async()=>{for(let i=0;i<6;i++)await Promise.resolve();},scheduled};
}
test('preloads once, displays chip before amount, actual ended starts queued batch, and never steals focus',async()=>{
 const f=fixture();f.ctrl.prepare();f.ctrl.prepare();assert.equal(f.video.src,POINT_STINGER_URL);assert.equal(f.loads,1);f.send({erin:12500});await f.flush();assert.equal(f.video.hidden,false);assert.equal(f.title.hidden,true);assert.equal(f.root.hidden,false);assert.match(f.status.textContent,/erin: \+12,500 points/);const row=f.rows.children[0];assert.equal(row.children[0].textContent,'ERIN');assert.match(row.children[1].children[0].src,/points-chip\.png$/);assert.equal(row.children[1].children[1].textContent,'+12,500');
 f.send({kaz:7});f.send({kaz:2,faroe:3});assert.equal(f.attempts,1);f.video.ended=true;f.video.dispatchEvent(new Event('ended'));f.video.ended=false;await f.flush();assert.equal(f.attempts,2);assert.match(f.status.textContent,/faroe: \+3 points; kaz: \+9 points/);f.ctrl.cancel();assert.equal(f.root.hidden,true);assert.equal(f.video.paused,true);assert.equal(f.scheduled.size,0);
});
test('autoplay denied retries muted; user mute changes cannot unmute blocked autoplay',async()=>{
 const f=fixture();f.setPlay(()=>f.attempts===1?Promise.reject(Object.assign(Error(),{name:'NotAllowedError'})):Promise.resolve());f.send({kaz:2});await f.flush();assert.equal(f.attempts,2);assert.equal(f.video.muted,true);f.video.currentTime=.2;f.advance(200);assert.equal(f.video.muted,true);f.ctrl.dispose();
});
test('reduced motion, unavailable video, stalled video and delayed play all retain readable text then clear',async()=>{
 for(const mode of ['reduced','reject','stall','hang']){
  const f=fixture();if(mode==='reduced')f.flags.reduced=true;if(mode==='reject')f.setPlay(()=>Promise.reject(Error('decode')));if(mode==='hang')f.setPlay(()=>new Promise(()=>{}));
  f.send({faroe:3});await f.flush();if(mode==='stall'||mode==='hang')f.advance(1900);assert.equal(f.video.hidden,true,mode);assert.equal(f.title.hidden,false,mode);assert.match(f.status.textContent,/\+3 points/);f.advance(3600);assert.equal(f.root.hidden,true,mode);assert.equal(f.video.paused,true);f.ctrl.dispose();
 }
});
test('hidden/blocked queues expire; lock and pause cancel immediately, late media promises cannot resurrect',async()=>{
 const f=fixture();f.flags.blocked=true;f.send({erin:5});assert.equal(f.attempts,0);f.flags.blocked=false;f.advance(100);await f.flush();assert.equal(f.attempts,1);f.flags.blocked=true;f.ctrl.step();assert.equal(f.root.hidden,true);f.send({kaz:5});f.advance(POINT_AWARD_TTL+1);f.flags.blocked=false;f.ctrl.step();assert.equal(f.attempts,1);
 let resolve;f.setPlay(()=>new Promise(r=>resolve=r));f.send({faroe:2});f.flags.allowed=false;f.ctrl.step();resolve();await f.flush();assert.equal(f.root.hidden,true);assert.equal(f.video.paused,true);f.ctrl.dispose();
});
test('Dice top-layer relocation moves both live region and video without replay; pending awards still display',async()=>{
 const f=fixture(),parent=new Element();f.send({faroe:4});await f.flush();f.flags.blocked=true;f.send({erin:2});f.ctrl.relocate(parent);assert.equal(f.root.parentNode,parent);assert.equal(f.status.parentNode,parent);assert.equal(f.root.hidden,true);f.flags.blocked=false;f.ctrl.step();await f.flush();assert.match(f.status.textContent,/erin: \+2 points/);assert.equal(f.attempts,2);f.ctrl.dispose();
});

test('star events use same deduplicated transient transport and never replay',()=>{
 const t=transport(),a=t.make(),b=t.make(),seen=[];b.bus.subscribe(e=>seen.push(e));
 a.bus.publish({faroe:1},'star-award');a.bus.publish({erin:5});
 assert.deepEqual(seen.map(e=>e.type),['star-award','point-award']);
 b.receive(JSON.parse(t.storage.get(POINT_AWARD_KEY)));assert.equal(seen.length,2);
 a.bus.dispose();b.bus.dispose();
});
test('star and points share ordered playback without mixing currencies or audio',async()=>{
 const f=fixture();f.ctrl.prepare();assert.equal(f.starVideo.src,STAR_STINGER_URL);
 f.sendStar({faroe:1});await f.flush();assert.equal(f.root.dataset.award,'star');assert.equal(f.starVideo.hidden,false);assert.equal(f.video.hidden,true);assert.match(f.status.textContent,/faroe: \+1 stars/);
 f.send({erin:50});f.sendStar({kaz:2});f.sendStar({kaz:3});
 f.starVideo.ended=true;f.starVideo.dispatchEvent(new Event('ended'));f.starVideo.ended=false;await f.flush();
 assert.equal(f.root.dataset.award,'point');assert.equal(f.starVideo.paused,true);assert.equal(f.starVideo.hidden,true);assert.equal(f.video.hidden,false);assert.match(f.status.textContent,/erin: \+50 points/);
 f.video.ended=true;f.video.dispatchEvent(new Event('ended'));f.video.ended=false;await f.flush();
 assert.equal(f.root.dataset.award,'star');assert.match(f.status.textContent,/kaz: \+5 stars/);assert.equal(f.video.paused,true);
 f.flags.muted=true;f.starVideo.currentTime=.5;f.advance(100);assert.equal(f.starVideo.muted,true);
 f.ctrl.cancel();assert.equal(f.starVideo.paused,true);assert.equal(f.root.hidden,true);f.ctrl.dispose();
});
test('star reduced motion and decode failure show correct fallback with star sprite',async()=>{
 for(const mode of ['reduced','error']){const f=fixture();if(mode==='reduced')f.flags.reduced=true;else f.setPlay(()=>Promise.reject(Error('decode')));
 f.sendStar({erin:2});await f.flush();assert.equal(f.starVideo.hidden,true);assert.equal(f.title.textContent,'STAR EARNED!');assert.equal(f.title.hidden,false);assert.match(f.rows.children[0].children[1].children[0].src,/star\.png$/);assert.match(f.status.textContent,/erin: \+2 stars/);f.ctrl.dispose();}
});
