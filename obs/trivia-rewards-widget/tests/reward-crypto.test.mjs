import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes, webcrypto } from "node:crypto";
import { decryptReward, encodeBase64Url, encryptReward } from "../reward-crypto.mjs";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const example = { version: 1, username: "Kaz & Café", file: "cash monkey_bgless.png" };

test("JWE reward links round-trip Unicode usernames and spaced PNG filenames", async () => {
  const encrypted = await encryptReward(example);
  const parts = encrypted.id.split(".");
  assert.equal(parts.length, 5);
  assert.equal(parts[1], "");
  assert.deepEqual(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")), {
    alg: "dir",
    enc: "A256GCM"
  });
  assert.deepEqual(await decryptReward(encrypted.id, encrypted.key), example);
});

test("independent rewards receive independent keys and IVs", async () => {
  const first = await encryptReward(example);
  const second = await encryptReward(example);
  assert.notEqual(first.key, second.key);
  assert.notEqual(first.id.split(".")[2], second.id.split(".")[2]);
});

test("the compact JWE interoperates with Node's independent AES-GCM implementation", async () => {
  const encrypted = await encryptReward(example);
  const parts = encrypted.id.split(".");
  const key = Buffer.from(encrypted.key, "base64url");
  const iv = Buffer.from(parts[2], "base64url");
  const ciphertext = Buffer.from(parts[3], "base64url");
  const tag = Buffer.from(parts[4], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAAD(Buffer.from(parts[0], "ascii"));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  assert.deepEqual(JSON.parse(plaintext.toString("utf8")), example);

  const externalKey = randomBytes(32);
  const externalIv = randomBytes(12);
  const protectedHeader = Buffer.from(JSON.stringify({ alg: "dir", enc: "A256GCM" })).toString("base64url");
  const cipher = createCipheriv("aes-256-gcm", externalKey, externalIv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(protectedHeader, "ascii"));
  const externalCiphertext = Buffer.concat([cipher.update(JSON.stringify(example), "utf8"), cipher.final()]);
  const externalId = [
    protectedHeader,
    "",
    externalIv.toString("base64url"),
    externalCiphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url")
  ].join(".");
  assert.deepEqual(await decryptReward(externalId, externalKey.toString("base64url")), example);
});

test("tampered ciphertext and wrong key fail authentication", async () => {
  const encrypted = await encryptReward(example);
  const wrongKey = await encryptReward(example);
  await assert.rejects(() => decryptReward(encrypted.id, wrongKey.key));

  const parts = encrypted.id.split(".");
  const ciphertext = Buffer.from(parts[3], "base64url");
  ciphertext[0] ^= 0x80;
  parts[3] = encodeBase64Url(ciphertext);
  await assert.rejects(() => decryptReward(parts.join("."), encrypted.key));
});

test("unsupported algorithms, malformed compact serialization, and path filenames are rejected", async () => {
  const encrypted = await encryptReward(example);
  const parts = encrypted.id.split(".");
  parts[0] = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "none", enc: "A256GCM" })));
  await assert.rejects(() => decryptReward(parts.join("."), encrypted.key), /Unsupported/);
  const duplicateHeader = encodeBase64Url(new TextEncoder().encode(
    '{"alg":"none","alg":"dir","enc":"A256GCM"}'
  ));
  parts[0] = duplicateHeader;
  await assert.rejects(() => decryptReward(parts.join("."), encrypted.key), /Unsupported/);
  await assert.rejects(() => decryptReward(`${encrypted.id}.extra`, encrypted.key), /compact serialization/);
  await assert.rejects(() => encryptReward({ ...example, file: "../private.png" }), /Invalid reward payload/);
});
