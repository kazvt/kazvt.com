import assert from "node:assert/strict";
import test from "node:test";
import { MIN_REWARD_LOADING_MS, minimumLoadingDelay } from "./loading-duration.mjs";

test("the loader waits the full minimum when it has just started", () => {
  assert.equal(minimumLoadingDelay(0, 0), MIN_REWARD_LOADING_MS);
});

test("the loader waits only the remaining time after work completes", () => {
  assert.equal(minimumLoadingDelay(100, 1250), 1850);
});

test("slow work does not add an unnecessary delay beyond the minimum", () => {
  assert.equal(minimumLoadingDelay(0, 4500), 0);
});

test("invalid timing values safely fall back to the full minimum", () => {
  assert.equal(minimumLoadingDelay(Number.NaN, 1000), MIN_REWARD_LOADING_MS);
  assert.equal(minimumLoadingDelay(0, Number.NaN), MIN_REWARD_LOADING_MS);
});
