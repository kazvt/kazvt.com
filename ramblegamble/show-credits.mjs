// One non-looping credit soundtrack and a media-clock crawl. No game/score mutations.
export const CREDITS_DURATION=198.288;
export const CREDITS_INTRO=5;
export const CREDITS_FINALE=188;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function creditsFrame(time,height,contentHeight){
  const t=clamp(Number.isFinite(time)?time:0,0,CREDITS_DURATION);
  const h=Math.max(0,height||0), c=Math.max(0,contentHeight||0);
  const p=clamp((t-CREDITS_INTRO)/(CREDITS_FINALE-CREDITS_INTRO),0,1);
  return {phase:t<CREDITS_INTRO?'intro':t<CREDITS_FINALE?'crawl':'finale',offset:h*.22+p*(c+h*1.58),progress:t/CREDITS_DURATION,done:t>=CREDITS_DURATION};
}
export function createShowCredits({dialog,button,menu,onOpenChange=()=>{},muted=()=>false,doc=document,win=window}){
  const audio=dialog.querySelector('audio'),stage=dialog.querySelector('.rg-credits-stage'),track=dialog.querySelector('.rg-credits-track'),closeButton=dialog.querySelector('[data-credits-close]');
  const motion=win.matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,elapsed=0,last=null,playing=false,fallback=false,requested=false,epoch=0,suspended=false,disposed=false,h=0,c=0,finished=false,sessionOpen=false,stall=0;
  audio.loop=false;audio.volume=.20;
  const locked=()=>doc.documentElement.hasAttribute('data-rg-host-locked');
  const allowed=()=>dialog.open&&!menu.hidden&&!doc.hidden&&!locked()&&!suspended&&!disposed;
  function measure(){h=stage.clientHeight;c=track.offsetHeight;}
  function paint(){
    const f=creditsFrame(elapsed,h,c);
    if(dialog.dataset.phase!==f.phase)dialog.dataset.phase=f.phase;
    track.style.transform=`translate3d(0,${-f.offset}px,0)`;
  }
  function stopClock(){if(frame)win.cancelAnimationFrame(frame);frame=0;last=null;stall=0;}
  function stopAudio(){if(requested||!audio.paused){++epoch;requested=false;audio.pause();}}
  function finish(){elapsed=CREDITS_DURATION;finished=true;playing=false;stopClock();stopAudio();dialog.dataset.running="false";paint();}
  function fail(){if(!dialog.open||finished)return;fallback=true;stopAudio();last=null;stall=0;sync();}
  function requestAudio(){
    if(fallback||requested||!allowed()||!playing)return;
    requested=true;const ticket=++epoch;
    const reject=()=>{if(ticket===epoch&&allowed()&&playing)fail();};
    try{Promise.resolve(audio.play()).catch(reject);}catch{reject();}
  }
  function tick(now){
    frame=0;if(!allowed()||!playing){sync();return;}
    const dt=last===null?0:Math.min(250,Math.max(0,now-last));
    if(fallback)elapsed+=dt/1000;
    else if(Number.isFinite(audio.currentTime)){
      const next=audio.currentTime;
      stall=next===elapsed?stall+dt:0;elapsed=next;
      // A failed/indefinitely stalled download must not strand the show.
      if(stall>=10000){fail();return;}
    }
    last=now;
    if(elapsed>=CREDITS_DURATION||(!fallback&&audio.ended)){finish();return;}
    paint();schedule();
  }
  function schedule(){if(!frame&&allowed()&&playing)frame=win.requestAnimationFrame(tick);}
  function sync(){
    if(disposed)return;
    if(!dialog.open){if(sessionOpen)cleanup();return;}
    const running=String(allowed()&&playing);if(dialog.dataset.running!==running)dialog.dataset.running=running;
    const isMuted=Boolean(muted());if(audio.muted!==isMuted)audio.muted=isMuted;
    if(dialog.open&&(locked()||menu.hidden)){close();return;}
    if(!allowed()||!playing){stopClock();stopAudio();return;}
    if(audio.error&&!fallback)fallback=true;
    requestAudio();schedule();
  }
  function reset(){
    stopClock();stopAudio();elapsed=0;finished=false;fallback=Boolean(audio.error);playing=true;
    try{audio.currentTime=0;}catch{}
    stage.scrollTop=0;measure();paint();sync();
  }
  function open(){
    if(disposed||locked()||menu.hidden||dialog.open||doc.hidden)return;
    if(typeof dialog.showModal!=='function')return;
    dialog.showModal();sessionOpen=true;onOpenChange(true);reset();closeButton.focus({preventScroll:true});
  }
  function cleanup(){if(!sessionOpen)return;sessionOpen=false;stopClock();stopAudio();playing=false;try{audio.currentTime=0;}catch{};onOpenChange(false);}
  function close(){if(!sessionOpen&&!dialog.open)return;stopClock();stopAudio();playing=false;if(dialog.open)dialog.close();cleanup();}
  function cancel(e){e.preventDefault();close();}
  function nativeClose(){if(!dialog.open)cleanup();}
  function ended(){if(dialog.open&&!fallback&&audio.ended)finish();}
  function resize(){if(dialog.open){measure();paint();}}
  const observer=new win.MutationObserver(sync);
  observer.observe(dialog,{attributes:true,attributeFilter:['open']});
  observer.observe(menu,{attributes:true,attributeFilter:['hidden']});
  observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-rg-host-locked']});
  button.addEventListener('click',open);closeButton.addEventListener('click',close);
  dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',nativeClose);audio.addEventListener('ended',ended);audio.addEventListener('error',fail);
  doc.addEventListener('visibilitychange',sync);win.addEventListener('resize',resize);motion.addEventListener?.('change',resize);
  const ro=win.ResizeObserver?new win.ResizeObserver(resize):null;ro?.observe(stage);ro?.observe(track);
  return {sync,close,setPageSuspended(v){suspended=Boolean(v);sync();},dispose(){close();disposed=true;stopClock();stopAudio();observer.disconnect();ro?.disconnect();button.removeEventListener('click',open);closeButton.removeEventListener('click',close);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('close',nativeClose);audio.removeEventListener('ended',ended);audio.removeEventListener('error',fail);doc.removeEventListener('visibilitychange',sync);win.removeEventListener('resize',resize);motion.removeEventListener?.('change',resize);}};
}
