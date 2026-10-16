import test from "node:test";
import assert from "node:assert/strict";
import { isPageBackgroundTarget } from "./background-context.mjs";

test("background context-menu guard only targets the page canvas", () => {
  const body = {};
  const documentElement = {};
  const card = {};

  assert.equal(isPageBackgroundTarget(body, body, documentElement), true);
  assert.equal(isPageBackgroundTarget(documentElement, body, documentElement), true);
  assert.equal(isPageBackgroundTarget(card, body, documentElement), false);
});
