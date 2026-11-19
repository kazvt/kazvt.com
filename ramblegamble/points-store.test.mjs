import test from "node:test";
import assert from "node:assert/strict";
import { normalizePointScores, RG_CONTESTANTS } from "./points-store.mjs";

test("points stay bound to the three fixed contestants", () => {
  assert.deepEqual(RG_CONTESTANTS, ["faroe", "erin", "kaz"]);
  assert.deepEqual(normalizePointScores({ faroe: "4", erin: 2, kaz: 9, other: 100 }), {
    faroe: 4,
    erin: 2,
    kaz: 9,
  });
});

test("malformed, fractional, negative, and unsafe scores normalize to zero", () => {
  assert.deepEqual(normalizePointScores({ faroe: -1, erin: 1.5, kaz: Number.MAX_SAFE_INTEGER + 1 }), {
    faroe: 0,
    erin: 0,
    kaz: 0,
  });
  assert.deepEqual(normalizePointScores(null), { faroe: 0, erin: 0, kaz: 0 });
  assert.deepEqual(normalizePointScores([5, 6, 7]), { faroe: 0, erin: 0, kaz: 0 });
});
