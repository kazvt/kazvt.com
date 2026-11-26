// App-level mutual authentication over an already encrypted RTCDataChannel.
// The SDP fingerprints bind proofs to this specific DTLS connection.
const bytes = new TextEncoder();
const ec = {name:'ECDSA', namedCurve:'P-256'};
const signAlg = {name:'ECDSA', hash:'SHA-256'};
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2,'0')).join('');
const unhex = s => Uint8Array.from(s.match(/../g) || [], x => parseInt(x,16));
export const nonce = () => hex(crypto.getRandomValues(new Uint8Array(16)));
export const validNonce = s => typeof s === 'string' && /^[a-f0-9]{32}$/.test(s);
export const validPublicKey = s => typeof s === 'string' && /^04[a-f0-9]{128}$/.test(s);
export async function generateHostIdentity() {
  const pair = await crypto.subtle.generateKey(ec, false, ['sign','verify']);
  return { privateKey: pair.privateKey, publicKey: hex(await crypto.subtle.exportKey('raw',pair.publicKey)) };
}
export async function loadHostIdentity(env = globalThis) {
  // Persist a nonextractable CryptoKey, not a private JWK or a plaintext secret.
  const db = await new Promise((resolve,reject) => {
    const req = env.indexedDB.open('rg-host-identity-v1',1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Identity storage blocked'));
  });
  const read = () => new Promise((resolve,reject) => { const r=db.transaction('keys').objectStore('keys').get('host'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
  try {
    const old = await read();
    if (old?.privateKey?.type === 'private' && old.privateKey.extractable === false && validPublicKey(old.publicKey)) return old;
    const identity = await generateHostIdentity();
    await new Promise((resolve,reject) => { const tx=db.transaction('keys','readwrite'); tx.objectStore('keys').put(identity,'host'); tx.oncomplete=resolve; tx.onabort=tx.onerror=()=>reject(tx.error); });
    return identity;
  } finally { db.close(); }
}
function fingerprint(desc) {
  const lines = [...new Set((desc?.sdp || '').split(/\r?\n/).map(line => /^a=fingerprint:sha-256 ((?:[0-9a-f]{2}:){31}[0-9a-f]{2})$/i.exec(line.trim())?.[1]?.toLowerCase()).filter(Boolean))];
  if (lines.length !== 1) throw new Error('Missing or ambiguous DTLS fingerprint');
  return lines[0];
}
export function channelBinding(conn, host) {
  // A local SharedWorker transfers a unique private MessagePort to each end.
  // Domain-separated from every WebRTC fingerprint-bound transcript.
  if (typeof conn?.localChannelId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(conn.localChannelId)) return ['rg-local-message-port-v1',conn.localChannelId];
  const pc = conn.peerConnection;
  const local = fingerprint(pc?.localDescription), remote = fingerprint(pc?.remoteDescription);
  return host ? [local,remote] : [remote,local];
}
export function transcript({room,player,clientNonce,hostNonce},binding) {
  if (!validNonce(clientNonce) || !validNonce(hostNonce) || !Array.isArray(binding) || binding.length!==2) throw new Error('Invalid challenge');
  return JSON.stringify(['RG mutual auth v2',room,player,clientNonce,hostNonce,...binding]);
}
export async function signHost(identity, text) {
  return hex(await crypto.subtle.sign(signAlg,identity.privateKey,bytes.encode('host:'+text)));
}
export async function verifyHost(publicKey,text,signature) {
  if (!validPublicKey(publicKey) || typeof signature !== 'string' || !/^[a-f0-9]{128}$/.test(signature)) return false;
  try { const key=await crypto.subtle.importKey('raw',unhex(publicKey),ec,false,['verify']); return await crypto.subtle.verify(signAlg,key,unhex(signature),bytes.encode('host:'+text)); } catch { return false; }
}
async function seatKey(token) { if(!validNonce(token)) throw new Error('Invalid seat key'); return crypto.subtle.importKey('raw',unhex(token),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']); }
export async function proveSeat(token,text) { return hex(await crypto.subtle.sign('HMAC',await seatKey(token),bytes.encode('seat:'+text))); }
export async function verifySeat(token,text,proof) {
  if(typeof proof !== 'string' || !/^[a-f0-9]{64}$/.test(proof)) return false;
  try { return await crypto.subtle.verify('HMAC',await seatKey(token),unhex(proof),bytes.encode('seat:'+text)); } catch { return false; }
}
