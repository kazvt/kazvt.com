// Local-only, private MessagePort transport: no CDN, ICE, TURN or signaling
// service. The same origin and storage partition must be shared by both pages.
// The worker transfers ports and never sees application messages. A separate
// channel binding domain prevents reuse of DTLS-bound authentication proofs.
const workerUrl = new URL('./card-room-local-worker.js?v=room-recovery-20261127-v1',import.meta.url);
const validId = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
const MAX_MESSAGE = 1500000;
function createWorker(env) {
  return new env.SharedWorker(workerUrl.href,{name:'rg-private-room-recovery-20261127-v1'});
}
export function wrapLocalPort(port,id) {
  if(!validId(id))throw Error('Invalid local channel');
  const listeners=new Map();let closed=false,lastSeen=Date.now(),heartbeat;
  const emit=(type,...args)=>{for(const fn of listeners.get(type)||[])fn(...args);};
  const close=(notify=true)=>{if(closed)return;closed=true;clearInterval(heartbeat);if(notify)try{port.postMessage({type:'close'});}catch{}try{port.close();}catch{}emit('close');};
  const post=message=>{if(closed)throw Error('Channel closed');port.postMessage(message);};
  port.onmessage=({data:m})=>{
    if(closed)return;lastSeen=Date.now();
    try {
      if(m?.type==='close'){close(false);return;}
      if(m?.type==='ping'){post({type:'pong'});return;}
      if(m?.type==='pong')return;
      if(m?.type!=='data'||typeof m.value!=='string'||m.value.length>MAX_MESSAGE)throw Error('Invalid local message');
      emit('data',JSON.parse(m.value));
    }catch{close();}
  };
  port.onmessageerror=()=>close();port.addEventListener?.('close',()=>close(false));port.start();
  heartbeat=setInterval(()=>{if(Date.now()-lastSeen>45000)close();else try{post({type:'ping'});}catch{close();}},5000);heartbeat?.unref?.();
  return {localChannelId:id,get open(){return !closed;},on(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);},send(value){const json=JSON.stringify(value);if(!json||json.length>MAX_MESSAGE)throw Error('Message too large');post({type:'data',value:json});},close};
}
export function openLocalHost(room,onConnection,env=globalThis,onStatus=()=>{}) {
  if(typeof env.SharedWorker!=='function')return null;
  const worker=createWorker(env),port=worker.port,channels=new Set();let ready=false,closed=false,timer;
  const close=()=>{if(closed)return;closed=true;ready=false;clearTimeout(timer);try{port.postMessage({type:'unregister'});port.close();}catch{}for(const conn of [...channels])conn.close();channels.clear();onStatus();};
  worker.onerror=close;port.onmessageerror=close;
  port.onmessage=({data:m,ports})=>{
    if(closed){for(const p of ports||[])p.close();return;}
    if(m?.type==='ready'){clearTimeout(timer);ready=true;onStatus();return;}
    if(m?.type==='replaced'){close();return;}
    if(m?.type!=='incoming'||!validId(m.id)||!ports?.[0])return;
    if(!ready||channels.size>=24){ports[0].close();return;}
    const conn=wrapLocalPort(ports[0],m.id);channels.add(conn);conn.on('close',()=>channels.delete(conn));
    try{onConnection(conn);}catch{conn.close();}
  };
  port.start();timer=setTimeout(close,3000);timer?.unref?.();port.postMessage({type:'register',room});
  return {get ready(){return ready;},get closed(){return closed;},close};
}
export function connectLocal(room,{signal,onStage=()=>{},env=globalThis}={}) {
  if(typeof env.SharedWorker!=='function'||signal?.aborted)return Promise.resolve(null);
  return new Promise(resolve=>{
    let worker,port,timer,done=false;
    const finish=result=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);try{port?.close();}catch{}resolve(result);};
    const cancel=()=>finish(null);
    try{
      worker=createWorker(env);port=worker.port;worker.onerror=cancel;port.onmessageerror=cancel;
      port.onmessage=({data:m,ports})=>{
        if(done){for(const p of ports||[])p.close();return;}
        if(m?.type==='connected'&&validId(m.id)&&ports?.[0]){onStage('Connecting directly to host…');finish(wrapLocalPort(ports[0],m.id));}else if(m?.type==='unavailable')cancel();
      };
      signal?.addEventListener('abort',cancel,{once:true});port.start();timer=setTimeout(cancel,1500);timer?.unref?.();port.postMessage({type:'join',room});
    }catch{cancel();}
  });
}
