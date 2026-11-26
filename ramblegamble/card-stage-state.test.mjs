import test from 'node:test';
import assert from 'node:assert/strict';
import { activeCardStage, cardStageChange } from './card-stage-state.mjs';
import { createShopRound, createQuiplashRound, createSmeemoGame, normalizeCardGamesState, buyShopCard } from './card-games.mjs';
const decks = { penalty:[{name:'P',price:0}],challenge:[{name:'C',price:0}],instant:[{name:'I',price:0}] };
test('persisted game is baseline on reload, not a newly started game',()=>{
  for (const state of [{round:createShopRound(decks)},{round:createQuiplashRound(['Prompt'])},{smeemo:createSmeemoGame()},{round:{mode:'shop'}}]) {
    const restored=normalizeCardGamesState(state);
    const baseline=activeCardStage(restored);
    assert.ok(baseline);
    assert.deepEqual(cardStageChange(baseline,normalizeCardGamesState(restored)),{active:baseline,opened:false,ended:false});
  }
});
test('shop purchases and score updates do not reopen; reshuffle does',()=>{
  const round=createShopRound(decks);
  const base=activeCardStage({round});
  const purchase=buyShopCard(round,round.cards[0].id,'kaz',{kaz:0});
  assert.equal(purchase.error,'');
  assert.equal(cardStageChange(base,{round:purchase.round}).opened,false);
  assert.equal(cardStageChange(base,{round:createShopRound(decks)}).opened,true);
});
test('new same-mode remote rounds and Smeemo starts open; updates and clearing do not',()=>{
  const round=createQuiplashRound(['Prompt']);
  const baseline=activeCardStage({round});
  assert.equal(cardStageChange(baseline,{round:{...round,phase:'voting'}}).opened,false);
  assert.equal(cardStageChange(baseline,{round:createQuiplashRound(['Prompt'])}).opened,true);
  assert.equal(cardStageChange(baseline,{round,smeemo:createSmeemoGame()}).opened,true);
  assert.deepEqual(cardStageChange(baseline,{}),{active:null,opened:false,ended:true});
});

// Exercise the actual UI module's initial subscription and event handlers with
// a minimal DOM and shared-store stand-in, without needing WebGL/PeerJS.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as games from './card-games.mjs';
import { applyCardShowAction } from './card-show-actions.mjs';
class FakeElement {
  constructor() { this.children=[]; this.dataset={}; this.hidden=false; this.value=''; this.events={}; this.attributes={}; const classes=new Set(); this.classList={add:(...items)=>items.forEach(v=>classes.add(v)),remove:(...items)=>items.forEach(v=>classes.delete(v)),contains:v=>classes.has(v),toggle:(v,force= !classes.has(v))=>{if(force)classes.add(v);else classes.delete(v);}}; }
  append(...children){ this.children.push(...children); children.forEach(child=>child.parentElement=this); }
  before(){}
  replaceChildren(...children){this.children=[];this.append(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type, listener){this.events[type]=listener;}
  click(){this.events.click?.({});}
  querySelector(){return null;}
  focus(){}
}
function mountUI(saved) {
  const els=new Map();
  const get=selector=>{if(!els.has(selector)) els.set(selector,new FakeElement());return els.get(selector);};
  get('#rg-card-games-layer').hidden=true;
  get('#rg-card-games-layer').querySelector=get;
  get('#rg-card-mode').value='shop'; get('#rg-card-player').value='kaz';
  let data=normalizeCardGamesState(saved), subscriber;
  const calls=[], sounds=[];
  const listeners=new Map();
  const timers=new Map();let timerId=0;
  const window={matchMedia:()=>({matches:true}), clearTimeout(id){timers.delete(id);},setTimeout(fn){timers.set(++timerId,fn);return timerId;},addEventListener:(type,fn)=>listeners.set(type,fn),dispatchEvent(event){calls.push(event.type);listeners.get(event.type)?.(event);}};
  class FakeEvent {constructor(type,opts={}){this.type=type;this.detail=opts.detail;}}
  const code=readFileSync(new URL('./card-games-ui.js',import.meta.url),'utf8').replace(/^import\s+[\s\S]*?;\n/gm,'');
  vm.runInNewContext(code,{...games,applyCardShowAction,activeCardStage,cardStageChange,window,document:{querySelector:get,querySelectorAll:()=>[],createElement:()=>new FakeElement()},CustomEvent:FakeEvent,Event:FakeEvent,readCardGames:()=>data,writeCardGames:value=>({state:data=normalizeCardGamesState(value),persisted:true}),subscribeLiveTrivia:()=>{},activeRoomRound:()=>data.round,subscribeCardGames:fn=>{subscriber=fn;fn(data);},readPointScores:()=>({kaz:0,faroe:0,erin:0}),subscribePointScores:fn=>fn({kaz:0,faroe:0,erin:0}),mountCardRoom:()=>({publish(){}}),foley:{start(channel,cue){sounds.push(cue);},stop(){},play(cue){sounds.push(cue);}},withRoomSubmissionLock:async fn=>fn()});
  return {get,calls,sounds,window,get state(){return data;},update(next){data=normalizeCardGamesState(next);subscriber(data);},flushTimers(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
test('actual card UI keeps restored shop hidden, resumes on request, and only opens newly started rounds',()=>{
  const round=createShopRound(decks);
  const ui=mountUI({round});
  assert.equal(ui.get('#rg-card-games-layer').hidden,true);
  assert.ok(!ui.calls.includes('rg:card-game-active'));
  const purchased=buyShopCard(round,round.cards[0].id,'kaz',{kaz:0}).round;
  ui.update({round:purchased});
  assert.equal(ui.get('#rg-card-games-layer').hidden,true);
  ui.window.dispatchEvent({type:'rg:show-card-menu'});
  assert.equal(ui.get('#rg-card-games-layer').hidden,false);
  const resume=ui.get('#rg-card-games-content').children.find(el=>el.textContent==='RESUME THE SHOP');
  assert.ok(resume); resume.click();
  assert.equal(ui.get('#rg-card-games-title').textContent,'THE SHOP');
  assert.ok(ui.calls.includes('rg:card-game-active'));
  ui.get('#rg-card-room').click();
  ui.update({round:purchased});
  assert.equal(ui.get('#rg-card-games-layer').hidden,true);
  ui.update({round:createShopRound(decks)});
  assert.equal(ui.get('#rg-card-games-layer').hidden,false);
});
test('actual card UI does not reopen saved Berryblast, Red Handed, or Smeemo on initialization',()=>{
  for(const saved of [{round:createQuiplashRound(['Prompt'])},{round:games.createRedHandedRound(['Evidence'],['Suspect'])},{smeemo:createSmeemoGame()}]) {
    const ui=mountUI(saved);
    assert.equal(ui.get('#rg-card-games-layer').hidden,true);
    assert.ok(!ui.calls.includes('rg:card-game-active'));
  }
});

test('actual menu left click starts a show round, right click opens staff only',async()=>{
  const ui=mountUI({decks:{evidence:['Card'],suspects:['Suspect'],quiplash:['Prompt']}});ui.window.dispatchEvent({type:'rg:show-card-menu'});
  const content=ui.get('#rg-card-games-content'),grid=content.children[0];
  assert.equal(grid.children.length,3);
  for(const [i,mode] of ['red-handed','quiplash','shop'].entries()){
    const choice=grid.children[i], card=choice.children[0];assert.equal(choice.children.length,1);
    assert.ok(choice.attributes['aria-label']);assert.equal(card.children.length,2);
    assert.ok(card.children[0].src.endsWith(`menu-${mode}-face.png`));assert.ok(card.children[1].src.endsWith('menu-card-back.png'));
  }
  grid.children[1].events.contextmenu({preventDefault(){},stopPropagation(){}});
  assert.equal(ui.calls.filter(x=>x==='rg:open-host-panel').length,1);
  grid.children[0].click();assert.ok(grid.classList.contains('is-animating'));assert.ok(grid.children[0].classList.contains('is-selected'));
  grid.children[1].click();assert.ok(!grid.children[1].classList.contains('is-selected'));
  ui.update(ui.state);assert.equal(content.children[0],grid);ui.flushTimers();await Promise.resolve();
  assert.equal(ui.calls.filter(x=>x==='rg:open-host-panel').length,1);
  assert.equal(ui.state.round.mode,'red-handed');assert.equal(ui.state.round.prompt,'Suspect');
  assert.equal(ui.get('#rg-card-games-title').textContent,'RED HANDED');
});

function allText(element){return [element.textContent||'',...(element.children||[]).map(allText)].join(' ');}
function findText(element,text){return element.textContent===text?element:(element.children||[]).map(child=>findText(child,text)).find(Boolean);}
test('actual show renderer withholds answer text from the DOM and exposes only explicitly revealed answers',async()=>{
  const ui=mountUI({});let round=games.createQuiplashRound(['Prompt']);ui.update({round});
  for(const player of games.CARD_GAME_PLAYERS){round=games.submitRoundAnswer(round,player,`secret-${player}`);ui.update({round});}
  const content=ui.get('#rg-card-games-content');
  assert.doesNotMatch(allText(content),/secret-/);assert.ok(findText(content,'REVEAL NEXT'));
  findText(content,'REVEAL NEXT').click();await Promise.resolve();
  assert.equal(ui.state.round.revealedCount,1);assert.match(allText(content),new RegExp(ui.state.round.responses[0].text));
  assert.doesNotMatch(allText(content),new RegExp(ui.state.round.responses[1].text));
  findText(content,'ALL').click();await Promise.resolve();assert.equal(ui.state.round.phase,'voting');
  for(const response of ui.state.round.responses)assert.match(allText(content),new RegExp(response.text));
  assert.ok(findText(content,'RESULTS'));
  findText(content,'RESULTS').click();await Promise.resolve();assert.equal(ui.state.round.phase,'results');
  assert.ok(findText(content,'NEW ROUND'));
});


test('remote card submissions sound once per state change, restored state is quiet',()=>{
 const round=createQuiplashRound(['Prompt']);
 const restored=mountUI({round});assert.deepEqual(restored.sounds,[]);
 const ui=mountUI({});ui.update({round});assert.deepEqual(ui.sounds,['deal']);
 const first=games.submitRoundAnswer(round,'kaz','First');ui.update({round:first});ui.update({round:first});
 const second=games.submitRoundAnswer(first,'faroe','Second');ui.update({round:second});
 const third=games.submitRoundAnswer(second,'erin','Third');ui.update({round:third});ui.update({round:third});
 assert.deepEqual(ui.sounds,['deal','submit','submit','cardFan']);
});
