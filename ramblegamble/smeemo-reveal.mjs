// Transient, presentation-only five-click encounter. No game or score writes.
export const SMEEMO_RETURN_MS=4400;
export const SMEEMO_STINGER='/ramblegamble/assets/stingers/smeemo-explosive-alpha.webm';
export function createSmeemoEncounter(){
 let phase='hidden',count=0;
 return {
  focus(){if(phase==='hidden'){phase='focused';count=0;}},
  click(){if(phase!=='focused')return null;count++;if(count===5)phase='stinger';return count;},
  finish(){if(phase!=='stinger')return false;phase='returning';return true;},
  arrive(){if(phase!=='returning')return false;phase='table';return true;},
  reset(){phase='hidden';count=0;},
  get phase(){return phase;},get count(){return count;},
  get revealed(){return phase==='focused'&&count>=2||phase==='stinger';},
  // Hide spectators, never the separate Smeemo mesh or its click target.
  get hideCrowd(){return (phase==='focused'&&count>=3)||phase==='stinger';},
  get quiet(){return phase!=='hidden'&&count>=2;},
  get song(){return (phase==='focused'&&count>=1)||phase==='returning'?'smeemo':null;},
 };
}
// Stinger completion is exactly once, including media failure/stall.
export function createSmeemoStinger({root,video,caption,muted=()=>false,onFinish,clock=()=>performance.now()}){
 let live=false,started=0,lastProgress=0,lastTime=0,token=0,autoplayMuted=false,prepared=false;
 function cancel(){live=false;prepared=false;token++;root.hidden=true;video.pause();video.preload='none';video.removeAttribute('src');video.load();}
 function prepare(){if(live||prepared)return;prepared=true;video.preload='auto';video.src=SMEEMO_STINGER;video.load();}
 function finish(){if(!live)return;cancel();onFinish();}
 function fail(){if(!live||lastTime<0)return;caption.textContent='SMEEMO • 5/5';started=clock();lastProgress=started;lastTime=-1;video.hidden=true;caption.hidden=false;video.pause();}
 video.addEventListener('ended',finish);video.addEventListener('error',fail);
 function start(){if(live)cancel();if(!prepared)prepare();live=true;const ticket=token;started=lastProgress=clock();lastTime=0;autoplayMuted=false;caption.textContent='SMEEMO • 5/5';caption.hidden=true;video.hidden=false;root.hidden=false;video.muted=muted();try{Promise.resolve(video.play()).catch(error=>{if(!live||ticket!==token)return;if(error?.name==='NotAllowedError'&&!video.muted){video.muted=true;autoplayMuted=true;try{Promise.resolve(video.play()).catch(()=>{if(live&&ticket===token)fail();});}catch{fail();}}else fail();});}catch{fail();}root.focus?.({preventScroll:true});}
 function step(){if(!live)return;video.muted=autoplayMuted||muted();const now=clock();if(lastTime<0){if(now-started>=1500)finish();return;}if(video.currentTime>lastTime){lastTime=video.currentTime;lastProgress=now;}if(now-lastProgress>12000)fail();}
 return {prepare,start,step,cancel,get active(){return live;}};
}

// Table ambience belongs only to a newly opened, explicitly selected Smeemo
// round. Merely returning to the card table, opening its menu, or restoring a
// stale round must never arm it. Camera navigation does not cancel a live round;
// an explicit mode change, dismissal, reset or completion does.
export function createSmeemoTableSession(){
 let roundId=null,status=null,selected=false,armed=false;
 const cancelledIds=new Set();
 function cancel(){if(roundId)cancelledIds.add(roundId);selected=false;armed=false;}
 return {
  observe(next={}){
   const id=typeof next.id==='string'&&next.id?next.id:null;
   const state=next.status??null;
   const mode=next.mode??null;
   if(id!==roundId){if(roundId)cancelledIds.add(roundId);selected=false;armed=false;}
   if(!id||mode!=='smeemo'||state!=='playing'){
    if(id)cancelledIds.add(id);
    selected=false;armed=false;
   }else if(next.opened===true&&!cancelledIds.has(id))armed=true;
   roundId=id;status=state;
  },
  choose(mode){if(mode==='smeemo')selected=true;else cancel();},
  cancel,
  get active(){return selected&&armed&&status==='playing';},
 };
}
