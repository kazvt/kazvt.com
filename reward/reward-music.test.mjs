import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { createRewardMusicPlayer, deriveRewardMusicPlan, hashRewardPixels } from "./reward-music.mjs";

function fakeCanvasDocument() {
  const canvas = { width: 0, height: 0 };
  const context = {
    imageSmoothingEnabled: true,
    drawnPixels: new Uint8ClampedArray(),
    clearRect() {
      this.drawnPixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
    },
    drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, destinationX, destinationY) {
      this.drawnPixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      for (let row = 0; row < sourceHeight; row += 1) {
        for (let column = 0; column < sourceWidth; column += 1) {
          const sourceOffset = ((sourceY + row) * image.width + sourceX + column) * 4;
          const destinationOffset = ((destinationY + row) * canvas.width + destinationX + column) * 4;
          this.drawnPixels.set(image.pixels.subarray(sourceOffset, sourceOffset + 4), destinationOffset);
        }
      }
    },
    getImageData() {
      return { data: this.drawnPixels };
    }
  };
  canvas.getContext = () => context;
  return { createElement: () => canvas };
}

async function fingerprint(image) {
  return hashRewardPixels(image, { documentRef: fakeCanvasDocument(), cryptoRef: webcrypto });
}

test("pixel fingerprint is stable, dimension-aware, and includes alpha/color pixels", async () => {
  const original = {
    width: 2,
    height: 2,
    pixels: new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 0
    ])
  };
  const duplicate = { ...original, pixels: new Uint8ClampedArray(original.pixels) };
  const changedPixel = { ...original, pixels: new Uint8ClampedArray(original.pixels) };
  changedPixel.pixels[15] = 255;

  const first = await fingerprint(original);
  assert.equal(first, await fingerprint(duplicate));
  assert.notEqual(first, await fingerprint(changedPixel));
  assert.notEqual(first, await fingerprint({ ...original, width: 1, height: 4 }));
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("pixel fingerprint processes all image tiles, including a partial edge tile", async () => {
  const width = 513;
  const height = 2;
  const pixels = new Uint8ClampedArray(width * height * 4);
  pixels.fill(91);
  const image = { width, height, pixels };
  const originalHash = await fingerprint(image);
  pixels[(width - 1) * 4] = 92;
  assert.notEqual(originalHash, await fingerprint(image));
});

test("pixel-derived music plan is stable and maps hashes across 24 musical keys", () => {
  const keyNames = new Set();
  for (let key = 0; key < 24; key += 1) {
    const hash = `${key.toString(16).padStart(8, "0")}${"12345678".repeat(7)}`;
    const plan = deriveRewardMusicPlan(hash);
    keyNames.add(plan.keyName);
    assert.equal(plan.progression.length, 4);
    assert.equal(plan.arpPattern.length, 8);
    assert.ok(plan.progression.every(degree => degree >= 0 && degree < 7));
    assert.ok(plan.arpPattern.every(note => note >= 0 && note < 4));
    assert.equal(JSON.stringify(plan), JSON.stringify(deriveRewardMusicPlan(hash)));
  }
  assert.equal(keyNames.size, 24);
});

test("music plan rejects malformed pixel hashes", () => {
  assert.throws(() => deriveRewardMusicPlan("not-a-hash"), /SHA-256/);
  assert.throws(() => deriveRewardMusicPlan("a".repeat(63)), /SHA-256/);
});

test("music engine schedules the enabled track and can stop cleanly", async () => {
  let audioContext;

  class FakeAudioParam {
    value = 0;
    setValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime(value) { this.value = value; }
    setTargetAtTime(value) { this.value = value; }
    cancelScheduledValues() {}
  }

  class FakeNode {
    gain = new FakeAudioParam();
    frequency = new FakeAudioParam();
    detune = new FakeAudioParam();
    threshold = new FakeAudioParam();
    knee = new FakeAudioParam();
    ratio = new FakeAudioParam();
    attack = new FakeAudioParam();
    release = new FakeAudioParam();
    type = "";
    connect(destination) { return destination; }
  }

  class FakeAudioContext {
    state = "suspended";
    destination = new FakeNode();
    oscillatorCount = 0;
    #elapsed = 0;
    #startedAt = 0;

    constructor() {
      audioContext = this;
    }

    get currentTime() {
      return this.#elapsed + (this.state === "running" ? (performance.now() - this.#startedAt) / 1000 : 0);
    }

    createGain() { return new FakeNode(); }
    createBiquadFilter() { return new FakeNode(); }
    createDynamicsCompressor() { return new FakeNode(); }
    createOscillator() {
      this.oscillatorCount += 1;
      return { type: "", frequency: new FakeAudioParam(), detune: new FakeAudioParam(), connect() {}, start() {}, stop() {} };
    }
    resume() {
      this.#startedAt = performance.now();
      this.state = "running";
      return Promise.resolve();
    }
    suspend() {
      this.#elapsed = this.currentTime;
      this.state = "suspended";
      return Promise.resolve();
    }
    close() {
      this.#elapsed = this.currentTime;
      this.state = "closed";
      return Promise.resolve();
    }
  }

  const plan = deriveRewardMusicPlan("12345678" + "abcdef01".repeat(7));
  const fakeDocument = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const player = createRewardMusicPlayer(plan, {
    audioContextConstructor: FakeAudioContext,
    documentRef: fakeDocument,
    initialVolume: 0.2
  });
  player.setTrackEnabled("chords", false);
  await player.start();
  await new Promise(resolve => setTimeout(resolve, 45));
  assert.equal(player.isPlaying, true);
  assert.equal(audioContext.oscillatorCount, plan.arpPatch.layers.length);
  player.stop();
  assert.equal(player.isPlaying, false);
  player.destroy();
  assert.equal(audioContext.state, "closed");
});
