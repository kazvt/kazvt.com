import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePointClick,
  resolvePointClickAction,
  resolvePointClickCursor,
  resolvePointClickZone,
} from "./point-click-routing.js";

test("roulette parts distinguish direct play from opening trivia", () => {
  assert.equal(resolvePointClick("roulette", "wheel"), "spin-wheel");
  assert.equal(resolvePointClick("roulette", "ball"), "spin-wheel");
  assert.equal(resolvePointClick("roulette", "center"), "open-trivia");
  assert.equal(resolvePointClick("roulette", "rim"), "open-trivia");
});

test("slot cabinet and buttons open its menu, while the physical arm plays", () => {
  assert.equal(resolvePointClick("slot", "machine"), "open-slots");
  assert.equal(resolvePointClick("slot", "button3"), "open-slots");
  assert.equal(resolvePointClick("slot", "arm"), "pull-lever");
});

test("clicks outside the scene machines do nothing", () => {
  assert.equal(resolvePointClick("background", ""), "");
});

test("screen-edge navigation resolves to fixed left, right, and back zones", () => {
  assert.equal(resolvePointClickZone({ x: 10, y: 250, width: 1280, height: 720 }), "left");
  assert.equal(resolvePointClickZone({ x: 1270, y: 250, width: 1280, height: 720 }), "right");
  assert.equal(resolvePointClickZone({ x: 640, y: 710, width: 1280, height: 720, canGoBack: true }), "back");
  assert.equal(resolvePointClickZone({ x: 640, y: 710, width: 1280, height: 720, canGoBack: false }), "");
  assert.equal(resolvePointClickZone({ x: 20, y: 20, width: 0, height: 720 }), "");
});

test("first machine or contestant click focuses the area; focused machines keep their actions", () => {
  assert.equal(resolvePointClickAction({ machine: "roulette", part: "wheel" }), "focus-roulette");
  assert.equal(resolvePointClickAction({ machine: "roulette", part: "wheel", focused: true }), "spin-wheel");
  assert.equal(resolvePointClickAction({ machine: "slot", part: "arm" }), "focus-slot");
  assert.equal(resolvePointClickAction({ machine: "slot", part: "arm", focused: true }), "pull-lever");
  assert.equal(resolvePointClickAction({ machine: "contestant" }), "focus-contestants");
  assert.equal(resolvePointClickAction({ machine: "contestant", focused: true }), "");
});

test("cursor state matches navigation affordances and actionable scene objects", () => {
  assert.equal(resolvePointClickCursor({ zone: "left", actionable: true }), "left");
  assert.equal(resolvePointClickCursor({ zone: "right" }), "right");
  assert.equal(resolvePointClickCursor({ zone: "back" }), "back");
  assert.equal(resolvePointClickCursor({ actionable: true }), "hover");
  assert.equal(resolvePointClickCursor(), "default");
});
