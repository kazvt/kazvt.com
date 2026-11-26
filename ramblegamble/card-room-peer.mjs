// Pinned official browser bundle. Lazy-loaded: offline handoff never depends
// on an external script. The project's static host runs no signaling server.
let loading;
export function loadPeer() {
  if (typeof globalThis.Peer === "function") return Promise.resolve(globalThis.Peer);
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js";
    script.referrerPolicy = "no-referrer";
    const fail = () => { clearTimeout(timer); script.remove(); loading = null; reject(new Error("PeerJS unavailable")); };
    const timer = setTimeout(fail, 12000);
    script.onerror = fail;
    script.onload = () => { clearTimeout(timer); if (typeof globalThis.Peer === "function") resolve(globalThis.Peer); else fail(); };
    document.head.append(script);
  });
  return loading;
}
