import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const notFoundHtml = readFileSync(new URL("../404.html", import.meta.url), "utf8");
const firstInlineScript = notFoundHtml.match(/<script>\s*([\s\S]*?)<\/script>/i)?.[1];
assert.ok(firstInlineScript, "404.html should keep its early route handler inline");

function redirectsFor(pathname) {
  const location = {
    pathname,
    origin: "https://kazvt.com",
    redirects: [],
    replace(destination) {
      this.redirects.push(destination);
    }
  };
  runInNewContext(firstInlineScript, { location, URL });
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
