import test from "node:test";
import assert from "node:assert/strict";
import { formatZonedClock, getSupportedTimeZones, getSystemTimeZone, isValidTimeZone } from "./taskbar-clock.js";

test("clock shows seconds and both compact and full dates in the chosen zone", () => {
  const result = formatZonedClock(new Date("2026-07-04T12:03:09.000Z"), "UTC");
  assert.equal(result.time, "12:03:09");
  assert.equal(result.compactDate, "04 JUL 26");
  assert.equal(result.fullDate, "Saturday, 4 July 2026");
  assert.ok(result.zoneName);
});

test("time conversion follows the selected zone, including date rollover", () => {
  const result = formatZonedClock(new Date("2026-01-01T00:30:05.000Z"), "America/Los_Angeles");
  assert.equal(result.time, "16:30:05");
  assert.equal(result.compactDate, "31 DEC 25");
});

test("timezone list includes UTC and the host machine zone without duplicates", () => {
  const systemZone = getSystemTimeZone();
  const zones = getSupportedTimeZones(systemZone);
  assert.equal(zones[0], "UTC");
  assert.ok(zones.includes(systemZone));
  assert.equal(new Set(zones).size, zones.length);
  assert.ok(zones.length >= 20);
});

test("invalid timezone ids are rejected", () => {
  assert.equal(isValidTimeZone("Mars/Olympus_Mons"), false);
  assert.throws(() => formatZonedClock(new Date(), "Mars/Olympus_Mons"), RangeError);
});
