import assert from "node:assert/strict";
import test from "node:test";
import { createRewardHref } from "./reward-link.mjs";

const LINK_ID = "e2b8a0b2-7dd8-4d10-802f-d308ec33ffe7";
const SHORT_ID = "aB3_dE5-fG7_hJ9k";

test("new reward URLs use short opaque IDs without payloads or keys", () => {
  const href = createRewardHref(SHORT_ID, "https://kazvt.com");
  const url = new URL(href);

  assert.equal(url.origin, "https://kazvt.com");
  assert.equal(url.pathname, "/reward/");
  assert.deepEqual([...url.searchParams.entries()], [["id", SHORT_ID]]);
  assert.equal(url.hash, "");
  assert.equal(href.length, "https://kazvt.com/reward/?id=".length + 16);
  assert.equal(createRewardHref(LINK_ID.toUpperCase(), "https://kazvt.com").endsWith(`id=${LINK_ID}`), true);
});

test("reward URLs reject malformed, non-v4, or missing identifiers", () => {
  for (const linkId of ["", "not-a-uuid", "00000000-0000-0000-0000-000000000000", "short", null]) {
    assert.throws(() => createRewardHref(linkId, "https://kazvt.com"), /valid reward link ID/);
  }
});
