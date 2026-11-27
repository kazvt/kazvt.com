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
import { smeemoImpactTransition } from './smeemo-impact.mjs';
class FakeElement {
  constructor() { this.children=[]; this.dataset={}; this.hidden=false; this.value=''; this.events={}; this.attributes={}; this.style={setProperty(){},removeProperty(){}}; const classes=new Set(); this.classList={add:(...items)=>items.forEach(v=>classes.add(v)),remove:(...items)=>items.forEach(v=>classes.delete(v)),contains:v=>classes.has(v),toggle:(v,force= !classes.has(v))=>{if(force)classes.add(v);else classes.delete(v);}}; }
  append(...children){ this.children.push(...children); children.forEach(child=>child.parentElement=this); }
  before(){}
  replaceChildren(...children){this.children=[];this.append(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type, listener){this.events[type]=listener;}
  click(){return this.events.click?.({});}
  querySelector(){return null;}
  focus(){}
  getBoundingClientRect(){return {left:0,width:100};}
}
function mountUI(saved, initialPoints = {kaz:0,faroe:0,erin:0}) {
  const els=new Map();
  const get=selector=>{if(!els.has(selector)) els.set(selector,new FakeElement());return els.get(selector);};
  get('#rg-card-games-layer').hidden=true;
  get('#rg-card-games-layer').querySelector=get;
  get('#rg-card-mode').value='shop'; get('#rg-card-player').value='kaz';
  let data=normalizeCardGamesState(saved), subscriber, pointsSubscriber, balances={...initialPoints}, failPoints=false, failCards=false, deferPoints=false, releasePoints=null;
  const calls=[], sounds=[], impacts=[], purchases=[], stoppedSounds=[];let impactOptions;
  const listeners=new Map();
  const timers=new Map();let timerId=0;
  const window={queueMicrotask:fn=>fn(),matchMedia:()=>({matches:true}), clearTimeout(id){timers.delete(id);},setTimeout(fn){timers.set(++timerId,fn);return timerId;},addEventListener:(type,fn)=>listeners.set(type,fn),dispatchEvent(event){calls.push(event.type);listeners.get(event.type)?.(event);}};
  class FakeEvent {constructor(type,opts={}){this.type=type;this.detail=opts.detail;}}
  const code=readFileSync(new URL('./card-games-ui.js',import.meta.url),'utf8').replace(/^import\s+[\s\S]*?;\n/gm,'');
  vm.runInNewContext(code,{audienceReact(){},showBurst(){},voteFlight(){},purchaseFlight(target,buyer,price){purchases.push({target,buyer,price});},requestAnimationFrame:fn=>fn(),...games,applyCardShowAction,activeCardStage,cardStageChange,smeemoImpactTransition,createLightningLayer:()=>({paint(){},clear(){}}),createSmeemoImpact:options=>{impactOptions=options;return {trigger:event=>impacts.push(event),stop(){}}},window,document:{querySelector:get,querySelectorAll:()=>[],createElement:()=>new FakeElement(),addEventListener(){}},CustomEvent:FakeEvent,Event:FakeEvent,readCardGames:()=>data,writeCardGames:value=>failCards?{state:data,persisted:false}:({state:data=normalizeCardGamesState(value),persisted:true}),subscribeLiveTrivia:()=>{},writeLiveTriviaDraft:()=>true,activeRoomRound:()=>data.round,subscribeCardGames:fn=>{subscriber=fn;fn(data);},readPointScores:()=>({...balances}),writePointScores:value=>{if(failPoints)return {scores:{...balances},persisted:false};balances={...value};pointsSubscriber?.({...balances});return {scores:{...balances},persisted:true};},subscribePointScores:fn=>{pointsSubscriber=fn;fn({...balances});},withPointScoresLock:async fn=>{if(deferPoints){deferPoints=false;await new Promise(resolve=>{releasePoints=resolve;});}return fn();},mountCardRoom:()=>({publish(){}}),foley:{start(channel,cue){sounds.push(cue);},stop(channel){stoppedSounds.push(channel);},play(cue){sounds.push(cue);}},withRoomSubmissionLock:async fn=>fn()});
  return {get,calls,sounds,impacts,purchases,stoppedSounds,impactOptions,window,get state(){return data;},get balances(){return balances;},setPoints(next){balances={...next};pointsSubscriber({...balances});},blockPoints(value){failPoints=value;},deferPointLock(){deferPoints=true;},releasePointLock(){releasePoints?.();},blockCards(value){failCards=value;},update(next){data=normalizeCardGamesState(next);subscriber(data);},flushTimers(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
test('restored shop stays hidden, menu has only three choices, and choosing Shop starts fresh',async()=>{
  const round=createShopRound(decks);
  const ui=mountUI({round,decks:{shop:decks}});
  assert.equal(ui.get('#rg-card-games-layer').hidden,true);
  assert.ok(!ui.calls.includes('rg:card-game-active'));
  const purchased=buyShopCard(round,round.cards[0].id,'kaz',{kaz:0}).round;
  ui.update({round:purchased,decks:{shop:decks}});
  assert.equal(ui.get('#rg-card-games-layer').hidden,true);
  ui.window.dispatchEvent({type:'rg:show-card-menu'});
  const content=ui.get('#rg-card-games-content');
  assert.equal(content.children.length,1);
  assert.doesNotMatch(allText(content),/RESUME/);
  content.children[0].children[2].click();ui.flushTimers();await Promise.resolve();
  assert.equal(ui.get('#rg-card-games-title').textContent,'THE SHOP');
  assert.notEqual(ui.state.round.id,round.id);
  assert.ok(ui.state.round.cards.every(c=>!c.revealed));
  const newRound=ui.state.round;
  ui.window.dispatchEvent({type:'rg:show-card-menu'});
  assert.equal(ui.state.round.id,newRound.id);
  assert.equal(ui.get('#rg-card-games-title').textContent,'THE SHOP');
  ui.get('#rg-card-room').click();
  ui.update({round:newRound,decks:{shop:decks}});
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
    const choice=grid.children[i], card=choice.children[0].children[0].children[0];assert.equal(choice.children.length,2);
    assert.equal(choice.children[1].textContent,["Red-Handed","BerryBlast","Shop"][i]);
    assert.ok(choice.attributes['aria-label']);assert.equal(card.children.length,6);
    assert.ok(card.children[3].src.endsWith(`menu-${mode}-face.png`));assert.ok(card.children[4].src.endsWith('menu-card-back.png'));
  }
  assert.ok(ui.get('#rg-card-games-title').classList.contains("rg-visually-hidden"));
  grid.children[0].events.pointerenter({isTrusted:true,pointerType:"mouse"});
  assert.equal(ui.sounds.at(-1),"deal");
  const beforeHover=ui.sounds.length;
  grid.children[0].events.pointerenter({isTrusted:true,pointerType:"touch"});
  grid.children[0].events.pointerenter({isTrusted:false,pointerType:"mouse"});
  assert.equal(ui.sounds.length,beforeHover);
  grid.children[1].events.contextmenu({preventDefault(){},stopPropagation(){}});
  assert.equal(ui.calls.filter(x=>x==='rg:open-host-panel').length,1);
  grid.children[0].click();assert.ok(grid.classList.contains('is-animating'));assert.ok(grid.children[0].classList.contains('is-selected'));
  grid.children[1].click();assert.ok(!grid.children[1].classList.contains('is-selected'));
  const duringFlip=ui.sounds.length;grid.children[2].events.pointerenter({isTrusted:true,pointerType:"mouse"});assert.equal(ui.sounds.length,duringFlip);
  ui.update(ui.state);assert.equal(content.children[0],grid);ui.flushTimers();await Promise.resolve();
  assert.equal(ui.calls.filter(x=>x==='rg:open-host-panel').length,1);
  assert.equal(ui.state.round.mode,'red-handed');assert.equal(ui.state.round.prompt,'Suspect');
  assert.equal(ui.get('#rg-card-games-title').textContent,'RED HANDED');
  assert.ok(!ui.get('#rg-card-games-title').classList.contains("rg-visually-hidden"));
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

function findClass(element, name){return element.className===name?element:(element.children||[]).map(child=>findClass(child,name)).find(Boolean);}
test('actual shop UI updates balances without replacing cards and commits purchase only when points save',async()=>{
  const priced={penalty:[{name:'P',price:25}],challenge:[{name:'C',price:10}],instant:[{name:'I',price:5}]};
  const ui=mountUI({}, {faroe:100,erin:50,kaz:10});
  ui.update({round:createShopRound(priced)});
  const content=ui.get('#rg-card-games-content'), card=findClass(content,'rg-shop-card');assert.ok(card);
  ui.setPoints({faroe:120,erin:50,kaz:10});assert.equal(findClass(content,'rg-shop-card'),card);assert.ok(findText(content,'FAROE 120'));
  ui.blockPoints(true);await card.click();assert.equal(ui.balances.faroe,120);assert.equal(ui.state.round.cards[0].buyer,null);
  ui.blockPoints(false);ui.blockCards(true);await card.click();assert.equal(ui.balances.faroe,120);assert.equal(ui.state.round.cards[0].buyer,null);
  ui.blockCards(false);await card.click();assert.equal(ui.balances.faroe,95);assert.equal(ui.state.round.cards[0].buyer,'faroe');assert.ok(findText(content,'FAROE 95'));
  await card.click();assert.equal(ui.balances.faroe,95,'a stale second click does not charge twice');
});

test('shop animates only a committed new reveal and keeps the item name out of the DOM until purchase',async()=>{
  const secret='Hidden prize unique 123';
  const round=createShopRound({penalty:[{name:secret,price:0}],challenge:[{name:'C',price:0}],instant:[{name:'I',price:0}]});
  const ui=mountUI({});ui.update({round});
  const content=ui.get('#rg-card-games-content');
  const findNew=node=>node.classList?.contains('is-newly-revealed')?node:(node.children||[]).map(findNew).find(Boolean);
  assert.doesNotMatch(allText(content),/Hidden prize unique 123/);
  const purchased=buyShopCard(round,round.cards.find(c=>c.name===secret).id,'faroe',{faroe:0}).round;
  ui.update({round:purchased});assert.ok(findNew(content));assert.match(allText(content),/Hidden prize unique 123/);
  const turning=findNew(content);
  ui.update({round:purchased});assert.equal(findNew(content),turning,'duplicate state must not interrupt the turn');
  assert.equal(ui.purchases.length,1);ui.flushTimers();assert.equal(findNew(content),undefined);
  ui.update({round:purchased});assert.equal(findNew(content),undefined);assert.equal(ui.purchases.length,1);
});


test('dismissed Smeemo never interrupts the menu and selecting another game clears it',async()=>{
  const game=createSmeemoGame();
  const ui=mountUI({smeemo:game,decks:{evidence:['Evidence'],suspects:['Suspect']}});
  ui.window.dispatchEvent({type:'rg:show-card-menu'});
  const content=ui.get('#rg-card-games-content'), menu=content.children[0];
  assert.equal(content.children.length,1);assert.doesNotMatch(allText(content),/RESUME/);
  ui.update({smeemo:games.advanceSmeemoPhase(game,'preview'),decks:{evidence:['Evidence'],suspects:['Suspect']}});
  assert.equal(content.children[0],menu);
  menu.children[0].click();ui.flushTimers();await Promise.resolve();
  assert.equal(ui.state.smeemo,null);assert.equal(ui.state.round.mode,'red-handed');
  assert.equal(ui.get('#rg-card-games-title').textContent,'RED HANDED');
});

test('a pending menu selection cannot override an explicitly started newer game',async()=>{
  const ui=mountUI({decks:{quiplash:['Prompt']}});
  ui.window.dispatchEvent({type:'rg:show-card-menu'});
  ui.get('#rg-card-games-content').children[0].children[1].click();
  const game=createSmeemoGame();ui.update({smeemo:game,decks:{quiplash:['Prompt']}});
  ui.flushTimers();await Promise.resolve();
  assert.equal(ui.state.smeemo.id,game.id);assert.equal(ui.get('#rg-card-games-title').textContent,'SMEEMO SCRAMBLE');
});

test('red-handed and berryblast use distinct presentation classes without exposing hidden evidence',()=>{
  for(const mode of ['red-handed','quiplash']) {
    const ui=mountUI({});let round=mode==='red-handed'?games.createRedHandedRound(Array.from({length:15},(_,i)=>`evidence-${i}`),['Suspect']):createQuiplashRound(['Prompt']);
    for(const p of games.CARD_GAME_PLAYERS)round=games.submitRoundAnswer(round,p,mode==='red-handed'?round.hands[p][0]:`answer-${p}`);
    ui.update({round});const content=ui.get('#rg-card-games-content');
    assert.ok(content.children[0].className.includes(mode==='red-handed'?'is-red-handed':'is-berryblast'));
    assert.equal(content.children[0].children[1].children[0].children.length,3);
    assert.ok(content.children[0].children[1].children[0].children.every(el=>el.className==='rg-show-answer-back'));
    for(const r of round.responses)assert.ok(!allText(content).includes(r.text));
  }
});

test('Smeemo image is present only for the revealed winning card',()=>{
  let game=createSmeemoGame();for(const phase of ['preview','stacking','stacked','dealing'])game=games.advanceSmeemoPhase(game,phase);
  const ui=mountUI({});ui.update({smeemo:game});const content=ui.get('#rg-card-games-content');
  assert.equal(findClass(content,'rg-smeemo-berry-mark'),undefined);
  const winner=game.cards.find(c=>c.smeemo);ui.update({smeemo:games.drawSmeemoCard(game,winner.id).game});
  assert.ok(findClass(content,'rg-smeemo-berry-mark').src.endsWith('/smeemo-card-mark.png'));
});

test('Smeemo impacts follow committed starts and reveals, not phase changes, echoes or dismissed updates',()=>{
  let game=createSmeemoGame();const ui=mountUI({});ui.update({smeemo:game});
  assert.deepEqual(ui.impacts,[{kind:'start',count:0}]);
  for(const phase of ['preview','stacking','stacked','dealing']) {game=games.advanceSmeemoPhase(game,phase);ui.update({smeemo:game});}
  assert.equal(ui.impacts.length,1);
  const blank=game.cards.find(c=>!c.smeemo);game=games.drawSmeemoCard(game,blank.id).game;ui.update({smeemo:game});
  assert.deepEqual(ui.impacts.at(-1),{kind:'reveal',count:1});
  const board=ui.get('#rg-card-games-content').children[0];ui.update({smeemo:game});
  assert.equal(ui.get('#rg-card-games-content').children[0],board);assert.equal(ui.impacts.length,2);
  ui.get('#rg-card-room').click();ui.update({smeemo:games.drawSmeemoCard(game,game.cards.find(c=>c.smeemo).id).game});assert.equal(ui.impacts.length,2);
  const restored=mountUI({smeemo:game});assert.equal(restored.impacts.length,0);
});

test('actual Smeemo click produces no impact on failed persistence or duplicate reveal',async()=>{
  let game=createSmeemoGame();for(const phase of ['preview','stacking','stacked','dealing'])game=games.advanceSmeemoPhase(game,phase);
  const ui=mountUI({});ui.update({smeemo:game});
  const content=ui.get('#rg-card-games-content');const index=game.cards.findIndex(c=>!c.smeemo);
  const card=content.children[0].children[0].children[0].children[index];
  ui.blockCards(true);await card.click();await Promise.resolve();assert.equal(ui.impacts.length,1);assert.equal(ui.state.smeemo.draws.length,0);
  ui.blockCards(false);await card.click();await Promise.resolve();assert.equal(ui.impacts.length,2);assert.equal(ui.state.smeemo.draws.length,1);
  await card.click();await Promise.resolve();assert.equal(ui.impacts.length,2);assert.equal(ui.state.smeemo.draws.length,1);
  const winnerIndex=game.cards.findIndex(c=>c.smeemo);const winner=content.children[0].children[0].children[0].children[winnerIndex];
  await winner.click();await Promise.resolve();assert.equal(ui.impacts.length,3);assert.deepEqual(ui.impacts.at(-1),{kind:'win',count:2});
});


test('shop buyer switching preserves all card DOM nodes and routes celebration from the committed buyer',async()=>{
 const ui=mountUI({}, {faroe:200,erin:200,kaz:200});
 const round=createShopRound({penalty:[{name:'P',price:25}],challenge:[{name:'C',price:10}],instant:[{name:'I',price:5}]});
 ui.update({round});const shell=ui.get('#rg-card-games-content').children[0],buyers=shell.children[0].children,grid=shell.children[2];
 const cards=grid.children.map(w=>w.children[0]);
 buyers[1].click();assert.equal(buyers[1].attributes['aria-pressed'],'true');
 assert.equal(ui.get('#rg-card-games-content').children[0],shell);
 assert.deepEqual(grid.children.map(w=>w.children[0]),cards);
 const task=cards[0].click();buyers[2].click();await task;
 assert.equal(ui.state.round.cards[0].buyer,'erin');assert.equal(ui.balances.erin,175);assert.equal(ui.balances.kaz,200);
 assert.equal(ui.purchases.length,1);assert.equal(ui.purchases[0].buyer,buyers[1]);assert.equal(ui.purchases[0].price,25);
 assert.deepEqual(grid.children.map(w=>w.children[0]),cards);
 assert.equal(cards[0].classList.contains('is-newly-revealed'),true);
 buyers[0].click();assert.equal(cards[0].classList.contains('is-newly-revealed'),true);
 await cards[1].click();assert.equal(ui.state.round.cards[1].buyer,'faroe');assert.equal(ui.purchases.length,2);
 assert.equal(cards[0].classList.contains('is-newly-revealed'),true);assert.deepEqual(grid.children.map(w=>w.children[0]),cards);
 ui.update({round:ui.state.round});assert.equal(ui.purchases.length,2);
 ui.flushTimers();assert.ok(cards.every(c=>!c.classList.contains('is-newly-revealed')));
});
test('a queued shop click cannot purchase after leaving the stage',async()=>{
 const ui=mountUI({}, {faroe:10,erin:10,kaz:10});ui.update({round:createShopRound(decks)});
 const card=findClass(ui.get('#rg-card-games-content'),'rg-shop-card');
 ui.deferPointLock();const pending=card.click();ui.get('#rg-card-room').click();ui.releasePointLock();await pending;
 assert.equal(ui.state.round.cards[0].buyer,null);assert.equal(ui.purchases.length,0);
});
test('actual Smeemo UI routes every event to recorded thunder, preserves discovery scream and cancels all channels',()=>{
 const ui=mountUI({});ui.sounds.length=0;ui.stoppedSounds.length=0;
 const spec={strength:.8,rate:1};
 ui.impactOptions.sound({kind:'start',count:0},spec);
 ui.impactOptions.sound({kind:'reveal',count:1},spec);
 ui.impactOptions.sound({kind:'win',count:2},spec);
 assert.deepEqual(ui.sounds,['smeemoThunder','smeemoRumble','smeemoHit','smeemoThunder','smeemoRumble','smeemoHit','smeemoThunder','smeemoRumble','smeemoWin']);
 ui.stoppedSounds.length=0;ui.impactOptions.stopSound();assert.deepEqual(ui.stoppedSounds,['smeemo-thunder','smeemo-rumble','smeemo-hit','smeemo-win']);
});
