// A transient presentation signal, not a balance mutation or a durable ledger.
// Publish only AFTER the caller's complete transaction has succeeded.
export const POINT_AWARD_KEY = 'ramblegamble.point-award.v1';
export const POINT_AWARD_TTL = 30000;
export const AWARD_NAMES = Object.freeze(['faroe','erin','kaz']);
export function normalizeAwardTotals(value) {
  const totals = {};
  for (const name of AWARD_NAMES) {
    const amount = value?.[name];
    if (Number.isSafeInteger(amount) && amount > 0) totals[name] = amount;
  }
  return totals;
}
export function createPointAwardBus({target=globalThis.window, getStorage=()=>globalThis.localStorage,
  makeChannel=key=>new BroadcastChannel(key), now=()=>Date.now(),
  makeId=()=>globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}-${Math.random()}`} = {}) {
  let channel, listening=false;
  const subscribers=new Set(), seen=new Map();
  function receive(value) {
    const time=now();
    if (!['point-award','star-award'].includes(value?.type) || typeof value.id !== 'string' || !value.id || value.id.length>128 ||
        !Number.isFinite(value.at) || value.at<time-POINT_AWARD_TTL || value.at>time+5000) return;
    for (const [id,at] of seen) if (at<time-POINT_AWARD_TTL-5000) seen.delete(id);
    if(seen.has(value.id)) return;
    const totals=normalizeAwardTotals(value.totals);
    if(!Object.keys(totals).length) return;
    seen.set(value.id,time);
    for(const fn of [...subscribers]) { try{fn({type:value.type,id:value.id,at:value.at,totals:{...totals}});}catch(error){console.error('Point award presentation failed:',error);} }
  }
  function onMessage(event){receive(event.data);}
  function onStorage(event){if(event.key===POINT_AWARD_KEY&&event.newValue){try{receive(JSON.parse(event.newValue));}catch{}}}
  function connect(){
    if(listening)return;
    listening=true;
    try{channel=makeChannel(POINT_AWARD_KEY);channel?.addEventListener('message',onMessage);}catch{}
    target?.addEventListener('storage',onStorage);
  }
  function publish(value,type='point-award'){
    try {
      const totals=normalizeAwardTotals(value);
      if(!Object.keys(totals).length)return;
      const event={type,id:makeId(),at:now(),totals};
      connect();receive(event);
      // Both transports are used for resilience; the ID deduplicates delivery.
      try{getStorage().setItem(POINT_AWARD_KEY,JSON.stringify(event));}catch{}
      try{channel?.postMessage(event);}catch{}
    } catch { /* a cosmetic failure must never turn a committed award into an error */ }
  }
  function subscribe(fn){connect();subscribers.add(fn);return()=>subscribers.delete(fn);}
  function dispose(){target?.removeEventListener('storage',onStorage);try{channel?.close();}catch{}channel=null;listening=false;subscribers.clear();seen.clear();}
  return {publish,subscribe,dispose};
}
const bus=createPointAwardBus();
export const publishPointAward=bus.publish;
export const publishStarAward=totals=>bus.publish(totals,'star-award');
export const subscribePointAwards=bus.subscribe;
