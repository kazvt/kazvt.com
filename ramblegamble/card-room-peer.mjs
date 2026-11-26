// Pinned official browser bundle. Offline and same-browser transport are independent.
let loading;
const sources = [
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js',
];
export function loadPeer() {
  if (typeof globalThis.Peer === 'function') return Promise.resolve(globalThis.Peer);
  if (!loading) loading = (async()=>{
    for(const src of sources){
      try {return await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src=src;script.referrerPolicy='no-referrer';
        let finished=false;const finish=(ok)=>{if(finished)return;finished=true;clearTimeout(timer);script.onload=script.onerror=null;if(ok&&typeof globalThis.Peer==='function')resolve(globalThis.Peer);else{script.remove();reject(Error('PeerJS unavailable'));}};
        const timer=setTimeout(()=>finish(false),6500);script.onerror=()=>finish(false);script.onload=()=>finish(true);document.head.append(script);
      });}catch{}
    }
    throw Error('PeerJS unavailable');
  })().catch(error=>{loading=null;throw error;});
  return loading;
}
