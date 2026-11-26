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

test("first machine or contestant click focuses the area; focused machines keep their actions", () => {
  assert.equal(resolvePointClickAction({ machine: "roulette", part: "wheel" }), "focus-roulette");
  assert.equal(resolvePointClickAction({ machine: "roulette", part: "wheel", focused: true }), "spin-wheel");
  assert.equal(resolvePointClickAction({ machine: "slot", part: "arm" }), "focus-slot");
  assert.equal(resolvePointClickAction({ machine: "slot", part: "arm", focused: true }), "pull-lever");
  assert.equal(resolvePointClickAction({ machine: "contestant" }), "focus-contestants");
  assert.equal(resolvePointClickAction({ machine: "contestant", focused: true }), "");
  assert.equal(resolvePointClickAction({ machine: "host" }), "focus-host");
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

 test("right-click deletion routes only real slot display cells in star mode", () => {
  const base = {button:2, view:"slot", selected:"star", interaction:{machine:"slot",part:"slot-reel-display",cellIndex:0}};
  for (let i=0; i<15; i++) assert.equal(resolveSlotContextCell({...base, interaction:{...base.interaction,cellIndex:i}}),i);
  for (const overrides of [{button:0},{button:1},{view:"overview"},{selected:"kazberry"},{interaction:null},{interaction:{...base.interaction,part:"arm"}},{interaction:{...base.interaction,machine:"roulette"}}]) assert.equal(resolveSlotContextCell({...base,...overrides}),-1);
  for (const i of [-1,15,NaN,null,1.5,"1"]) assert.equal(resolveSlotContextCell({...base,interaction:{...base.interaction,cellIndex:i}}),-1);
});

test("focused slot decorative body allows navigation bands without stealing interactive controls",()=>{
  const geometry={x:400,y:390,width:803,height:395,canGoBack:true,view:"slot"};
  for(const part of ["machine", ""])assert.equal(resolveSceneNavigationZone({...geometry,interaction:{machine:"slot",part}}),"back");
  for(const part of ["slot-reel-display","arm","button1"])assert.equal(resolveSceneNavigationZone({...geometry,interaction:{machine:"slot",part}}),"");
  assert.equal(resolveSceneNavigationZone({...geometry,view:"overview",interaction:{machine:"slot",part:"machine"}}),"");
  assert.equal(resolveSceneNavigationZone({...geometry,x:10,y:150,interaction:{machine:"slot",part:"machine"}}),"left");
});
