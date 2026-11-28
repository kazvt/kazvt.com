import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveArcadeShortcut,
  resolveSlotContextCell,
  resolvePointClick,
  resolvePointClickAction,
  resolvePointClickBack,
  resolvePointClickCursor,
  resolvePointClickZone,
  resolveSceneNavigationZone,
} from "./point-click-routing.js";

test("participant and host aliases coexist with their number shortcuts, and C is cheer", () => {
  assert.equal(resolveArcadeShortcut("1"), "participants");
  assert.equal(resolveArcadeShortcut("p"), "participants");
  assert.equal(resolveArcadeShortcut("P"), "participants");
  assert.equal(resolveArcadeShortcut("d"), "dice-door");
  assert.equal(resolveArcadeShortcut("D"), "dice-door");
  assert.equal(resolveArcadeShortcut("4"), "host");
  assert.equal(resolveArcadeShortcut("h"), "host");
  assert.equal(resolveArcadeShortcut("H"), "host");
  assert.equal(resolveArcadeShortcut("5"), "card-table");
  assert.equal(resolveArcadeShortcut("8"), "hazel");
  assert.equal(resolveArcadeShortcut("c"), "cheer");
  assert.equal(resolveArcadeShortcut("C"), "cheer");
  assert.equal(resolveArcadeShortcut("x"), "");
});

test("roulette parts distinguish direct play from opening trivia", () => {
  assert.equal(resolvePointClick("roulette", "wheel"), "spin-wheel");
  assert.equal(resolvePointClick("roulette", "ball"), "spin-wheel");
  assert.equal(resolvePointClick("roulette", "center"), "show-trivia");
  assert.equal(resolvePointClick("roulette", "rim"), "show-trivia");
});

test("the slot cabinet has no left-click staff action, hardware buttons spin reels, and arm spins all", () => {
  assert.equal(resolvePointClick("slot", "machine"), "");
  assert.equal(resolvePointClick("slot", "slot-reel-display"), "place-slot-berry");
  assert.equal(resolvePointClick("slot", "button1"), "spin-column-0");
  assert.equal(resolvePointClick("slot", "button3"), "spin-column-2");
  assert.equal(resolvePointClick("slot", "button5"), "spin-column-4");
  assert.equal(resolvePointClick("slot", "arm"), "pull-lever");
});

test("clicks outside the scene machines do nothing", () => {
  assert.equal(resolvePointClick("background", ""), "");
});

test("D and the first doorway click focus the dice door; clicking it again opens dice mode", () => {
  assert.equal(resolveArcadeShortcut("d"), "dice-door");
  assert.equal(resolvePointClick("dice-door"), "focus-dice-door");
  assert.equal(resolvePointClick("dice-door", "", true), "open-dice");
  assert.equal(resolvePointClickAction({ machine: "dice-door" }), "focus-dice-door");
  assert.equal(resolvePointClickAction({ machine: "dice-door", focused: true }), "open-dice");
});

test("screen-edge navigation resolves to fixed left, right, and back zones", () => {
  assert.equal(resolvePointClickZone({ x: 10, y: 250, width: 1280, height: 720 }), "left");
  assert.equal(resolvePointClickZone({ x: 1270, y: 250, width: 1280, height: 720 }), "right");
  assert.equal(resolvePointClickZone({ x: 640, y: 710, width: 1280, height: 720, canGoBack: true }), "back");
  assert.equal(resolvePointClickZone({ x: 640, y: 710, width: 1280, height: 720, canGoBack: false }), "");
  assert.equal(resolvePointClickZone({ x: 20, y: 20, width: 0, height: 720 }), "");
  assert.equal(resolvePointClickZone({ x: 20, y: 260, width: 360, height: 540 }), "left");
  assert.equal(resolvePointClickZone({ x: 340, y: 260, width: 360, height: 540 }), "right");
  assert.equal(resolvePointClickZone({ x: 180, y: 530, width: 360, height: 540, canGoBack: true }), "back");
});

test("first machine or contestant click focuses its target; focused machines keep their actions", () => {
  assert.equal(resolvePointClickAction({ machine: "roulette", part: "wheel" }), "focus-roulette");
  assert.equal(resolvePointClickAction({ machine: "roulette", part: "wheel", focused: true }), "spin-wheel");
  assert.equal(resolvePointClickAction({ machine: "slot", part: "arm" }), "focus-slot");
  assert.equal(resolvePointClickAction({ machine: "slot", part: "arm", focused: true }), "pull-lever");
  assert.equal(resolvePointClickAction({ machine: "contestant" }), "focus-contestant");
  assert.equal(resolvePointClickAction({ machine: "contestant", focused: true }), "");
  assert.equal(resolvePointClickAction({ machine: "host" }), "focus-host");
  assert.equal(resolvePointClickAction({ machine: "hazel" }), "focus-hazel");
  assert.equal(resolvePointClickAction({ machine: "hazel", focused: true }), "");
  assert.equal(resolvePointClickAction({ machine: "host", focused: true }), "");
  assert.equal(resolvePointClickAction({ machine: "card-table" }), "focus-card-table");
  assert.equal(resolvePointClickAction({ machine: "card-table", focused: true }), "open-card-games");
  assert.equal(resolvePointClickAction({ zone: "back", canGoBack: true }), "back");
  assert.equal(resolvePointClickAction({ zone: "back", canGoBack: false }), "");
});

test("cursor state matches navigation affordances and actionable scene objects", () => {
  assert.equal(resolvePointClickCursor({ zone: "left", actionable: true }), "left");
  assert.equal(resolvePointClickCursor({ zone: "right" }), "right");
  assert.equal(resolvePointClickCursor({ zone: "back" }), "back");
  assert.equal(resolvePointClickCursor({ actionable: true }), "hover");
  assert.equal(resolvePointClickCursor(), "default");
});

test("back returns to the starting overview view and never retreats past it", () => {
  assert.deepEqual(resolvePointClickBack({ kind: "overview", look: -1 }), { kind: "overview", look: 0, retreat: 0 });
  assert.deepEqual(resolvePointClickBack({ kind: "overview", look: 1, retreat: 1 }), { kind: "overview", look: 0, retreat: 0 });
  assert.deepEqual(resolvePointClickBack({ kind: "overview", look: 0, retreat: 3 }), { kind: "overview", look: 0, retreat: 0 });
  assert.equal(resolvePointClickBack({ kind: "overview", look: 0 }), null);
  assert.deepEqual(resolvePointClickBack({ kind: "host", look: -1 }), { kind: "overview", look: -1, retreat: 0 });
  assert.deepEqual(resolvePointClickBack({ kind: "roulette", look: 1 }), { kind: "overview", look: 1, retreat: 0 });
  assert.deepEqual(resolvePointClickBack({ kind: "contestant", contestantId: "erin", look: -1 }), {
    kind: "contestants",
    look: -1,
    retreat: 0,
  });
  assert.deepEqual(resolvePointClickBack({ kind: "card-table", look: 0 }), { kind: "overview", look: 0, retreat: 0 });
  assert.deepEqual(resolvePointClickBack({ kind: "contestants", look: 1 }), { kind: "overview", look: 1, retreat: 0 });
  assert.deepEqual(resolvePointClickBack({ kind: "host", look: 0 }), { kind: "overview", look: 0, retreat: 0 });

  const backToOverview = resolvePointClickBack({ kind: "roulette", look: 1 });
  const backToStart = resolvePointClickBack(backToOverview);
  assert.deepEqual(backToStart, { kind: "overview", look: 0, retreat: 0 });
  assert.equal(resolvePointClickBack(backToStart), null);
});

 test("right-click deletion routes only real slot display cells in all symbol modes", () => {
  const base = {button:2, view:"slot", selected:"star", interaction:{machine:"slot",part:"slot-reel-display",cellIndex:0}};
  for (const selected of [null,"star","faroeberry","erinberry","kazberry"]) for (let i=0; i<15; i++) assert.equal(resolveSlotContextCell({...base, selected, interaction:{...base.interaction,cellIndex:i}}),i);
  for (const overrides of [{button:0},{button:1},{view:"overview"},{selected:"invalid"},{interaction:null},{interaction:{...base.interaction,part:"arm"}},{interaction:{...base.interaction,machine:"roulette"}}]) assert.equal(resolveSlotContextCell({...base,...overrides}),-1);
  for (const i of [-1,15,NaN,null,1.5,"1"]) assert.equal(resolveSlotContextCell({...base,interaction:{...base.interaction,cellIndex:i}}),-1);
});

test("focused slot decorative body allows navigation bands without stealing interactive controls",()=>{
  const geometry={x:400,y:390,width:803,height:395,canGoBack:true,view:"slot"};
  for(const part of ["machine", ""])assert.equal(resolveSceneNavigationZone({...geometry,interaction:{machine:"slot",part}}),"back");
  for(const part of ["slot-reel-display","arm","button1"])assert.equal(resolveSceneNavigationZone({...geometry,interaction:{machine:"slot",part}}),"");
  assert.equal(resolveSceneNavigationZone({...geometry,view:"overview",interaction:{machine:"slot",part:"machine"}}),"");
  assert.equal(resolveSceneNavigationZone({...geometry,x:10,y:150,interaction:{machine:"slot",part:"machine"}}),"left");
});

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { pointInCharacterQuad } from './character-billboards.mjs';
const roomSource=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
const roomSection=(a,b)=>roomSource.slice(roomSource.indexOf(a),roomSource.indexOf(b,roomSource.indexOf(a)));
test('visible character artwork is directly clickable, respects overlap order, and never hijacks dedicated machine views',()=>{
 const rect={left:100,right:300,top:100,bottom:300,width:200,height:200};
 const panel=(visibility='visible',zIndex=1)=>({style:{visibility},parentElement:{style:{zIndex}}});
 const projectedQuad={corners:[{x:100,y:100},{x:300,y:100},{x:300,y:300},{x:100,y:300}]};
 const host={id:'lillie-host',panel:panel('visible',3),projectedQuad},faroe={id:'faroe',panel:panel(),projectedQuad},erin={id:'erin',panel:panel('hidden'),projectedQuad};
 const ctx={cameraDetached:false,characterOcclusion:{contains:()=>true},billboards:[faroe,erin,host],hostBillboard:host,diceModeOpen:false,pauseMenuOpen:false,currentView:{kind:'overview'},preview:{clientWidth:400,clientHeight:400},pointInCharacterQuad,billboardLayer:{getBoundingClientRect:()=>({left:0,top:0,width:400,height:400}),classList:{contains:()=>false}}};
 runInNewContext(roomSection('  function getBillboardAtScreen(', '  function getSeatAtScreen(')+'\nthis.pick=getBillboardAtScreen;',ctx);
 assert.equal(ctx.pick(180,180).machine,'host');assert.equal(ctx.pick(90,180),null);
 ctx.characterOcclusion.contains=entry=>entry!==host;assert.equal(ctx.pick(180,180).contestantId,'faroe');host.panel.style.visibility='hidden';assert.equal(ctx.pick(180,180).contestantId,'faroe');
 for(const kind of ['host','contestant','contestants','hazel']){ctx.currentView.kind=kind;assert.equal(ctx.pick(180,180).contestantId,'faroe');}
 for(const kind of ['slot','roulette','card-table','dice-door','trivia']){ctx.currentView.kind=kind;assert.equal(ctx.pick(180,180),null);}
 ctx.cameraDetached=true;ctx.currentView.kind='slot';assert.equal(ctx.pick(180,180).contestantId,'faroe');ctx.characterOcclusion.contains=()=>false;assert.equal(ctx.pick(180,180),null);ctx.cameraDetached=false;ctx.currentView.kind='overview';ctx.diceModeOpen=true;assert.equal(ctx.pick(180,180),null);ctx.diceModeOpen=false;ctx.pauseMenuOpen=true;assert.equal(ctx.pick(180,180),null);
 ctx.pauseMenuOpen=false;const hazel={id:'hazel',panel:panel('visible',5),projectedQuad};ctx.billboards.push(hazel);ctx.characterOcclusion.contains=e=>e===hazel;assert.equal(ctx.pick(180,180).machine,'hazel');ctx.characterOcclusion.contains=()=>false;assert.equal(ctx.pick(180,180),null);ctx.characterOcclusion.contains=e=>e===hazel;ctx.currentView.kind='slot';assert.equal(ctx.pick(180,180),null);ctx.cameraDetached=true;assert.equal(ctx.pick(180,180).machine,'hazel');
});
test('real point-click handler selects the clicked contestant on the first click, retains group back and host focus',()=>{
 const transitions=[];let interaction;
 const ctx={encounter:{phase:"hidden"},document:{documentElement:{hasAttribute:()=>false}},cameraDetached:false,stageShow:{busy:false},freecam:{active:false},gameStarted:true,pauseMenuOpen:false,sceneReady:true,diceModeOpen:false,cameraTransition:null,camera:{},currentView:{kind:'overview'},preview:{getBoundingClientRect:()=>({left:0,top:0,width:1366,height:668})},getSceneInteractionAt:()=>interaction,resolveSceneNavigationZone,resolvePointClickAction,canGoBack:()=>true,transitionToView:view=>{transitions.push(view);ctx.currentView=view;},goBack:()=>{ctx.currentView=resolvePointClickBack(ctx.currentView);}};
 runInNewContext(roomSection('  function pointClickAt(', '  const canFreecam =')+'\nthis.click=pointClickAt;',ctx);
 for(const id of ['faroe','erin','kaz']){interaction={machine:'contestant',contestantId:id};ctx.click(600,300);assert.equal(ctx.currentView.kind,'contestant');assert.equal(ctx.currentView.contestantId,id);const count=transitions.length;ctx.click(600,300);assert.equal(transitions.length,count);}
 interaction=null;ctx.click(600,660);assert.equal(ctx.currentView.kind,'contestants');interaction={machine:'contestant',contestantId:'erin'};ctx.click(600,300);assert.equal(ctx.currentView.contestantId,'erin');
 interaction={machine:'host'};ctx.click(600,300);assert.equal(ctx.currentView.kind,'host');
 interaction={machine:'hazel'};ctx.click(600,300);assert.equal(ctx.currentView.kind,'hazel');const count=transitions.length;ctx.click(600,300);assert.equal(transitions.length,count);
 interaction=null;ctx.click(600,660);assert.equal(ctx.currentView.kind,'overview');ctx.cameraDetached=true;interaction={machine:'hazel'};ctx.click(600,300);assert.equal(ctx.currentView.kind,'hazel');
});

test('real focused slot click sends exact cell, never invokes random column placement',()=>{
  const placed=[];let interaction;
  const ctx={encounter:{phase:"hidden"},document:{documentElement:{hasAttribute:()=>false}},cameraDetached:false,stageShow:{busy:false},freecam:{active:false},gameStarted:true,pauseMenuOpen:false,sceneReady:true,diceModeOpen:false,cameraTransition:null,camera:{},currentView:{kind:'slot'},preview:{getBoundingClientRect:()=>({left:0,top:0,width:1366,height:668})},getSceneInteractionAt:()=>interaction,resolveSceneNavigationZone,resolvePointClickAction,canGoBack:()=>true,placeSelectedSlotSymbolAtCell:i=>placed.push(i)};
  runInNewContext(roomSection('  function pointClickAt(', '  const canFreecam =')+'\nthis.click=pointClickAt;',ctx);
  for(let index=0;index<15;index++){interaction={machine:'slot',part:'slot-reel-display',cellIndex:index};ctx.click(600,300);}
  ctx.stageShow.busy=true;ctx.click(600,300);assert.deepEqual(placed,Array.from({length:15},(_,i)=>i));
  ctx.stageShow.busy=false;ctx.cameraDetached=true;let dock;ctx.transitionToView=v=>dock=v;ctx.click(600,300);assert.equal(dock.kind,"slot");assert.equal(placed.length,15);
});

test('stand clicks toggle the addressed stand without docking, spinning, selecting or changing camera, including detached view',()=>{
 const calls=[];let interaction={machine:'contestant-stand',contestantId:'kaz'};
 const ctx={encounter:{phase:'hidden'},document:{documentElement:{hasAttribute:()=>false}},cameraDetached:false,stageShow:{busy:false},freecam:{active:false},gameStarted:true,pauseMenuOpen:false,sceneReady:true,diceModeOpen:false,cameraTransition:null,camera:{},currentView:{kind:'contestant',contestantId:'kaz'},preview:{getBoundingClientRect:()=>({left:0,top:0,width:1366,height:668})},getSceneInteractionAt:()=>interaction,resolveSceneNavigationZone,resolvePointClickAction,canGoBack:()=>true,transitionToView:()=>assert.fail('stand click must not dock'),goBack:()=>assert.fail('stand click must not navigate'),contestantStands:{toggle:(...args)=>calls.push(args)},performance:{now:()=>42},reducedMotion:{matches:false}};
 runInNewContext(roomSection('  function pointClickAt(', '  const canFreecam =')+'\nthis.click=pointClickAt;',ctx);
 ctx.click(600,300);ctx.cameraDetached=true;interaction={machine:'contestant-stand',contestantId:'faroe'};ctx.reducedMotion.matches=true;ctx.click(600,300);
 ctx.stageShow.busy=true;ctx.click(600,300);ctx.stageShow.busy=false;ctx.freecam.active=true;ctx.click(600,300);ctx.freecam.active=false;ctx.document.documentElement.hasAttribute=()=>true;ctx.click(600,300);
 assert.deepEqual(calls,[['kaz',42,false],['faroe',42,true]]);
});
