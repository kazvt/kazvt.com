import test from "node:test";
import assert from "node:assert/strict";
import { resolvePointClick } from "./point-click-routing.js";

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
