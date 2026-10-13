import assert from "node:assert/strict";
import test from "node:test";
import { createRewardHref } from "./reward-link.mjs";

const LINK_ID = "e2b8a0b2-7dd8-4d10-802f-d308ec33ffe7";

test("a reward URL contains only its UUID and no decryptable payload or key", () => {
  const href = createRewardHref(LINK_ID, "https://kazvt.com");
  const url = new URL(href);

  assert.equal(url.origin, "https://kazvt.com");
  assert.equal(url.pathname, "/reward/");
  assert.deepEqual([...url.searchParams.entries()], [["id", LINK_ID]]);
  assert.equal(url.hash, "");
  assert.equal(href.length, "https://kazvt.com/reward/?id=".length + LINK_ID.length);
});

test("reward URLs reject malformed, non-v4, or missing identifiers", () => {
  for (const linkId of ["", "not-a-uuid", "00000000-0000-0000-0000-000000000000", null]) {
    assert.throws(() => createRewardHref(linkId, "https://kazvt.com"), /valid reward link ID/);
  }
});
