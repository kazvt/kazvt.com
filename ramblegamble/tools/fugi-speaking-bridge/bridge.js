// Content script: runs inside the Fugi frame with the host's explicit permission.
// No credentials, image URLs, microphone access, storage or network requests.
(() => {
  if (window.parent === window || !/^\/basic\/\d+\/?$/.test(location.pathname)) return;
  const hosts = new Set(['https://kazvt.com','https://www.kazvt.com']);
  let host = null, last = undefined, queued = false;
  function readSpeaking() {
    const values=[...document.querySelectorAll('[data-speaking]')].map(el=>el.getAttribute('data-speaking'));
    if(values.includes('true'))return true;
    if(values.includes('false'))return false;
    return null;
  }
  function publish(force=false) {
    if(!host)return;
    const speaking=readSpeaking();if(!force&&speaking===last)return;last=speaking;
    window.parent.postMessage({type:'rg:fugi-speaking:state:v1',speaking},host);
  }
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||!hosts.has(event.origin)||event.data?.type!=='rg:fugi-speaking:request:v1')return;
    host=event.origin;publish(true);
  });
  new MutationObserver(()=>{
    if(queued)return;queued=true;queueMicrotask(()=>{queued=false;publish();});
  }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-speaking']});
})();
