import test from "node:test";
import assert from "node:assert/strict";
import { retryRead } from "./retry-read.mjs";

test("retryRead recovers after a short-lived read failure", async () => {
  let attempts = 0;
  const waits = [];
  const result = await retryRead(() => {
    attempts += 1;
    if (attempts < 3) throw new Error("temporary network failure");
    return "loaded";
  }, { delays: [20, 40], waitImpl: async milliseconds => waits.push(milliseconds) });

  assert.equal(result, "loaded");
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [20, 40]);
});

test("retryRead stops after its bounded attempts and rethrows the last error", async () => {
  let attempts = 0;
  await assert.rejects(retryRead(() => {
    attempts += 1;
    throw new Error(`failure ${attempts}`);
  }, { delays: [0, 0], waitImpl: async () => {} }), /failure 3/);
  assert.equal(attempts, 3);
});

test("retryRead does not wait or repeat after success", async () => {
  let attempts = 0;
  const result = await retryRead(() => {
    attempts += 1;
    return 42;
  }, { waitImpl: async () => assert.fail("should not wait") });

  assert.equal(result, 42);
  assert.equal(attempts, 1);
});
