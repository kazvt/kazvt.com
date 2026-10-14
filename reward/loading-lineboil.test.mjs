import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("loading text cycles through the three per-character phases every 500ms", async () => {
  const source = await readFile(new URL("./loading-lineboil.mjs", import.meta.url), "utf8");
  const styles = await readFile(new URL("./reward.css", import.meta.url), "utf8");
  const loadingState = { hidden: false };
  const ellipsis = { nodeType: 1 };
  const title = { childNodes: [], dataset: {} };
  const textNode = {
    nodeType: 3,
    textContent: "Loading",
    replaceWith(fragment) {
      title.childNodes.splice(0, 1, ...fragment.children);
    }
  };
  title.childNodes.push(textNode, ellipsis);

  let intervalCallback;
  let intervalDelay;
  let clearCalls = 0;
  let observerCallback;
  let observerDisconnects = 0;
  const motionPreference = {
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  };
  const document = {
    hidden: false,
    querySelector: selector => selector === ".loading-lineboil" ? title : null,
    getElementById: id => id === "loadingState" ? loadingState : null,
    createDocumentFragment: () => ({
      children: [],
      append(child) { this.children.push(child); }
    }),
    createElement: () => ({
      setAttribute(name, value) { this[name] = value; }
    }),
    addEventListener() {},
    removeEventListener() {}
  };
  class TestMutationObserver {
    constructor(callback) { observerCallback = callback; }
    observe() {}
    disconnect() { observerDisconnects += 1; }
  }
  const window = {
    matchMedia: () => motionPreference,
    setInterval(callback, delay) {
      intervalCallback = callback;
      intervalDelay = delay;
      return 1;
    },
    clearInterval() { clearCalls += 1; }
  };

  vm.runInNewContext(source, { document, window, Node: { TEXT_NODE: 3 }, MutationObserver: TestMutationObserver });

  const letters = title.childNodes.slice(0, -1);
  assert.equal(letters.map(letter => letter.textContent).join(""), "Loading");
  assert.ok(letters.every(letter => letter.className === "loading-lineboil-letter" && letter["aria-hidden"] === "true"));
  assert.match(styles, /transform: translateY\(-4px\)/);
  assert.match(styles, /transform: translateY\(4px\)/);
  assert.equal(intervalDelay, 500);
  assert.equal(title.dataset.boilPhase, undefined);

  intervalCallback();
  assert.equal(title.dataset.boilPhase, "1");
  intervalCallback();
  assert.equal(title.dataset.boilPhase, "2");
  intervalCallback();
  assert.equal(title.dataset.boilPhase, "3");
  intervalCallback();
  assert.equal(title.dataset.boilPhase, "1");

  loadingState.hidden = true;
  observerCallback();
  assert.equal(title.dataset.boilPhase, undefined);
  assert.equal(clearCalls, 1);
  assert.equal(observerDisconnects, 1);
});
