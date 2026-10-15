import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const notFoundHtml = readFileSync(new URL("../404.html", import.meta.url), "utf8");
const firstInlineScript = notFoundHtml.match(/<script>\s*([\s\S]*?)<\/script>/i)?.[1];
assert.ok(firstInlineScript, "404.html should keep its early route handler inline");

function redirectsFor(pathname, search = "", hash = "") {
  const location = {
    pathname,
    search,
    hash,
    origin: "https://kazvt.com",
    redirects: [],
    replace(destination) {
      this.redirects.push(destination);
    }
  };
  runInNewContext(firstInlineScript, { location, URL, URLSearchParams, decodeURIComponent });
  return location.redirects;
}

test("a reward username path opens that user's filtered award list", () => {
  const redirects = redirectsFor("/reward/kazvt");
  assert.equal(redirects.length, 1);
  const destination = new URL(redirects[0]);
  assert.equal(destination.pathname, "/reward/list/");
  assert.equal(destination.searchParams.get("user"), "kazvt");
});

test("reward username routes accept a trailing slash and encoded names", () => {
  const redirects = redirectsFor("/reward/Queen%20Bee/");
  assert.equal(new URL(redirects[0]).searchParams.get("user"), "Queen Bee");
});

test("plural reward aliases preserve nested routes and URL data", () => {
  assert.deepEqual(redirectsFor("/rewards"), ["https://kazvt.com/reward/list/"]);
  assert.deepEqual(redirectsFor("/rewards/list"), ["https://kazvt.com/reward/list/"]);
  assert.deepEqual(redirectsFor("/rewards/demo", "?x=1", "#preview"), [
    "https://kazvt.com/reward/demo/?x=1#preview"
  ]);
  assert.deepEqual(redirectsFor("/rewards", "?id=opaque-id"), [
    "https://kazvt.com/reward/?id=opaque-id"
  ]);
  assert.deepEqual(redirectsFor("/rewards/list/", "?user=kazvt"), [
    "https://kazvt.com/reward/list/?user=kazvt"
  ]);
});

test("existing reward pages and static files are not treated as usernames", () => {
  for (const pathname of [
    "/reward/demo/", "/reward/list/", "/reward/patterns", "/reward/retro/",
    "/reward/reward.css", "/reward/assignment-registry.mjs"
  ]) {
    assert.deepEqual(redirectsFor(pathname), [], pathname);
  }
});

test("unsafe, malformed, and nested reward paths are not treated as usernames", () => {
  for (const pathname of [
    "/reward/%2F", "/reward/%00", "/reward/%E0%A4%A", "/reward/a/b", "/reward/%20"
  ]) {
    assert.deepEqual(redirectsFor(pathname), [], pathname);
  }
});

test("unrelated existing aliases keep their current redirect behavior", () => {
  assert.deepEqual(redirectsFor("/toys"), ["https://kazvt.com/tuoys/"]);
  assert.deepEqual(redirectsFor("/multistreaming"), ["https://kazvt.com/#multistreaming"]);
});
