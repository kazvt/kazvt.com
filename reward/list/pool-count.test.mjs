import test from "node:test";
import assert from "node:assert/strict";
import { formatPoolCount } from "./pool-count.mjs";

test("pool counts from zero through ten use uppercase words", () => {
  assert.deepEqual(
    Array.from({ length: 11 }, (_, count) => formatPoolCount(count)),
    ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"]
  );
});

test("pool counts above ten remain numeric", () => {
  assert.equal(formatPoolCount(11), "11");
  assert.equal(formatPoolCount(212), "212");
});

test("pool count formatting rejects invalid values", () => {
  for (const count of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => formatPoolCount(count), RangeError);
  }
});
