const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const JWE_HEADER = { alg: "dir", enc: "A256GCM" };
const PROTECTED_HEADER = encodeBase64Url(encoder.encode(JSON.stringify(JWE_HEADER)));
const MAX_JWE_LENGTH = 2048;

export function encodeBase64Url(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid base64url data.");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (encodeBase64Url(bytes) !== value) throw new Error("Non-canonical base64url data.");
  return bytes;
}

function validatePayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) || data.version !== 1 ||
      typeof data.username !== "string" || !data.username.trim() || data.username.length > 100 ||
      typeof data.file !== "string" || data.file.length > 120 ||
      !/^[^/\\\u0000-\u001f]+\.png$/i.test(data.file)) {
    throw new Error("Invalid reward payload.");
  }
  return { version: 1, username: data.username, file: data.file };
}

function joinBytes(left, right) {
  const joined = new Uint8Array(left.length + right.length);
  joined.set(left, 0);
  joined.set(right, left.length);
  return joined;
}

export async function encryptReward(data) {
  if (!globalThis.crypto?.subtle || typeof btoa !== "function") {
    throw new Error("Web Crypto is unavailable in this browser.");
  }
  const payload = encoder.encode(JSON.stringify(validatePayload(data)));
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipherAndTag = new Uint8Array(await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv,
    additionalData: encoder.encode(PROTECTED_HEADER),
    tagLength: 128
  }, key, payload));
  if (cipherAndTag.length <= 16) throw new Error("Could not encrypt reward payload.");

  const ciphertext = cipherAndTag.slice(0, -16);
  const tag = cipherAndTag.slice(-16);
  const id = [
    PROTECTED_HEADER,
    "",
    encodeBase64Url(iv),
    encodeBase64Url(ciphertext),
    encodeBase64Url(tag)
  ].join(".");
  return { id, key: encodeBase64Url(keyBytes) };
}

export async function decryptReward(id, keyText) {
  if (!globalThis.crypto?.subtle || typeof atob !== "function") {
    throw new Error("Web Crypto is unavailable in this browser.");
  }
  if (typeof id !== "string" || id.length > MAX_JWE_LENGTH) throw new Error("Invalid reward link.");
  if (typeof keyText !== "string" || keyText.length !== 43) throw new Error("Invalid reward key.");
  const parts = id.split(".");
  if (parts.length !== 5 || !parts[0] || parts[1] !== "") throw new Error("Invalid JWE compact serialization.");
  if (parts[0] !== PROTECTED_HEADER) throw new Error("Unsupported reward encryption algorithms.");

  const protectedHeaderBytes = decodeBase64Url(parts[0]);
  let header;
  try {
    header = JSON.parse(decoder.decode(protectedHeaderBytes));
  } catch {
    throw new Error("Invalid JWE protected header.");
  }
  if (!header || typeof header !== "object" || Array.isArray(header) ||
      Object.keys(header).length !== 2 || header.alg !== "dir" || header.enc !== "A256GCM") {
    throw new Error("Unsupported reward encryption algorithms.");
  }

  const iv = decodeBase64Url(parts[2]);
  const ciphertext = decodeBase64Url(parts[3]);
  const tag = decodeBase64Url(parts[4]);
  const keyBytes = decodeBase64Url(keyText);
  if (iv.length !== 12 || ciphertext.length === 0 || ciphertext.length > 1024 ||
      tag.length !== 16 || keyBytes.length !== 32) {
    throw new Error("Invalid reward link fields.");
  }

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({
    name: "AES-GCM",
    iv,
    additionalData: encoder.encode(parts[0]),
    tagLength: 128
  }, key, joinBytes(ciphertext, tag));
  let data;
  try {
    data = JSON.parse(decoder.decode(plaintext));
  } catch {
    throw new Error("Invalid reward payload.");
  }
  return validatePayload(data);
}
