import test from "node:test";
import assert from "node:assert/strict";
import { parsePointsCommand } from "./points-commands.mjs";

test("console commands inspect and add only the fixed contestants", () => {
  assert.deepEqual(parsePointsCommand("points"), { action: "inspect-all" });
  assert.deepEqual(parsePointsCommand("points FAROE"), { action: "inspect", name: "faroe" });
  assert.deepEqual(parsePointsCommand("points @Erin"), { action: "inspect", name: "erin" });
  assert.deepEqual(parsePointsCommand("points add kaz"), { action: "add", name: "kaz", amount: 1 });
  assert.deepEqual(parsePointsCommand("points add faroe 12"), { action: "add", name: "faroe", amount: 12 });
  assert.equal(parsePointsCommand("points add unknown").action, "error");
});

test("console rejects unsafe totals and malformed commands", () => {
  assert.equal(parsePointsCommand("points add kaz 0").action, "error");
  assert.equal(parsePointsCommand("points add kaz -1").action, "error");
  assert.equal(parsePointsCommand("points set erin 9007199254740992").action, "error");
  assert.equal(parsePointsCommand("points set erin 0").action, "set");
  assert.deepEqual(parsePointsCommand("points reset"), { action: "reset", name: null });
  assert.deepEqual(parsePointsCommand("points reset @kaz"), { action: "reset", name: "kaz" });
  assert.equal(parsePointsCommand("points add faroe nope").action, "error");
  assert.equal(parsePointsCommand("clear now").action, "error");
});

test("the console starts and resets Smeemo; card reveals remain manual on the room page", () => {
  assert.deepEqual(parsePointsCommand("smeemo start"), { action: "smeemo-start" });
  assert.deepEqual(parsePointsCommand("smeemo reset"), { action: "smeemo-reset" });
  assert.equal(parsePointsCommand("smeemo").action, "error");
  assert.equal(parsePointsCommand("smeemo draw").action, "error");
  assert.equal(parsePointsCommand("smeemo cheat").action, "error");
});
