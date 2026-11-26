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
class FakeElement {
  constructor() { this.children=[]; this.dataset={}; this.hidden=false; this.value=''; this.events={}; this.classList={add(){},remove(){},toggle(){}}; }
  append(...children){ this.children.push(...children); }
  before(){}
  replaceChildren(...children){this.children=children;}
  setAttribute(){}
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
  const calls=[];
  const listeners=new Map();
  const window={matchMedia:()=>({matches:true}), clearTimeout(){},setTimeout(){return 1;},addEventListener:(type,fn)=>listeners.set(type,fn),dispatchEvent(event){calls.push(event.type);listeners.get(event.type)?.(event);}};
  class FakeEvent {constructor(type,opts={}){this.type=type;this.detail=opts.detail;}}
  const code=readFileSync(new URL('./card-games-ui.js',import.meta.url),'utf8').replace(/^import\s+[\s\S]*?;\n/gm,'');
  vm.runInNewContext(code,{...games,activeCardStage,cardStageChange,window,document:{querySelector:get,querySelectorAll:()=>[],createElement:()=>new FakeElement()},CustomEvent:FakeEvent,Event:FakeEvent,readCardGames:()=>data,writeCardGames:value=>({state:data=normalizeCardGamesState(value),persisted:true}),subscribeCardGames:fn=>{subscriber=fn;fn(data);},readPointScores:()=>({kaz:0,faroe:0,erin:0}),subscribePointScores:fn=>fn({kaz:0,faroe:0,erin:0}),mountCardRoom:()=>({publish(){}}),foley:{start(){},stop(){},play(){}},withRoomSubmissionLock:async fn=>fn()});
  return {get,calls,window,update(next){data=normalizeCardGamesState(next);subscriber(data);}};
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
