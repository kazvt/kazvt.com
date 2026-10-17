import assert from "node:assert/strict";
import test from "node:test";
import { createUserRewardListHref } from "./user-list-link.mjs";

test("user reward-list links preserve casing and safely encode special characters", () => {
  const href = createUserRewardListHref("Queen Bee?#", "https://kazvt.com");
  const destination = new URL(href, "https://kazvt.com");

  assert.equal(destination.pathname, "/reward/list/");
  assert.equal(destination.searchParams.get("user"), "Queen Bee?#");
});

test("user reward-list links reject empty, overlong, and control-character names", () => {
  for (const username of ["", "   ", "bad\nname", "x".repeat(101)]) {
    assert.throws(() => createUserRewardListHref(username, "https://kazvt.com"), TypeError);
  }
});
