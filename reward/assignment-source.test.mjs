import test from "node:test";
import assert from "node:assert/strict";
import { assignmentRegistrySources, fetchAssignmentRegistry } from "./assignment-source.mjs";

test("production reads the current public GitHub ledger first with a unique cache key", () => {
  const urls = assignmentRegistrySources({ hostname: "kazvt.com", origin: "https://kazvt.com", cacheBust: 123 });
  assert.equal(urls.length, 2);
  assert.match(urls[0], /^https:\/\/raw\.githubusercontent\.com\/kazvt\/kazvt\.com\/main\/zzz_assets\/rewards\/assignments\.json\?_\=123$/);
  assert.equal(urls[1], "https://kazvt.com/zzz_assets/rewards/assignments.json?_=123");
});

test("local and preview sites do not accidentally read production assignments", () => {
  const urls = assignmentRegistrySources({ hostname: "127.0.0.1", origin: "http://127.0.0.1:8157", cacheBust: 456 });
  assert.deepEqual(urls, ["http://127.0.0.1:8157/zzz_assets/rewards/assignments.json?_=456"]);
});

test("registry fetch falls back to Pages if GitHub raw is unavailable", async () => {
  const requests = [];
  const data = { version: 1, assignments: [] };
  const registry = await fetchAssignmentRegistry({
    hostname: "kazvt.com",
    origin: "https://kazvt.com",
    cacheBust: 789,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (requests.length === 1) throw new Error("offline");
      return { ok: true, json: async () => data };
    }
  });

  assert.equal(registry, data);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.cache, "no-store");
  assert.equal(requests[0].options.credentials, "omit");
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  assert.match(requests[0].url, /^https:\/\/raw\.githubusercontent\.com\//);
  assert.match(requests[1].url, /^https:\/\/kazvt\.com\/zzz_assets\/rewards\/assignments\.json/);
});

test("returns an exact raw GitHub match immediately and cancels a slower Pages read", async () => {
  const fresh = { version: 1, assignments: [{ linkId: "abcdefghijklmnop" }] };
  let pagesSignal;
  const registry = await fetchAssignmentRegistry({
    hostname: "kazvt.com",
    origin: "https://kazvt.com",
    cacheBust: 790,
    expectedLinkId: "abcdefghijklmnop",
    fetchImpl: async (url, options) => {
      if (url.startsWith("https://raw.githubusercontent.com/")) {
        return { ok: true, json: async () => fresh };
      }
      pagesSignal = options.signal;
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    }
  });

  assert.equal(registry, fresh);
  assert.equal(pagesSignal.aborted, true);
});
