// Transient, presentation-only five-click encounter. No game or score writes.
export const SMEEMO_RETURN_MS=4400;
export const SMEEMO_STINGER='/ramblegamble/assets/stingers/smeemo_annoyed.webm';
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
  get quiet(){return phase!=='hidden'&&count>=2;},
  get song(){return (phase==='focused'&&count>=1)||phase==='returning'?'smeemo':null;},
 };
}
// Stinger completion is exactly once, including media failure/skip/stall.
export function createSmeemoStinger({root,video,skip,caption,muted=()=>false,onFinish,clock=()=>performance.now()}){
 let live=false,started=0,lastProgress=0,lastTime=0,token=0;
 function cancel(){live=false;token++;root.hidden=true;video.pause();video.removeAttribute('src');video.load();}
 function finish(){if(!live)return;cancel();onFinish();}
 function fail(){if(!live||lastTime<0)return;caption.textContent='SMEEMO HAS HAD ENOUGH • 5/5';started=clock();lastProgress=started;lastTime=-1;video.hidden=true;video.pause();}
 video.addEventListener('ended',finish);video.addEventListener('error',fail);skip.addEventListener('click',finish);
 function start(){cancel();live=true;const ticket=token;started=lastProgress=clock();lastTime=0;caption.textContent='SMEEMO • 5/5';video.hidden=false;root.hidden=false;video.muted=muted();video.src=SMEEMO_STINGER;try{Promise.resolve(video.play()).catch(()=>{if(live&&ticket===token)fail();});}catch{fail();}skip.focus?.({preventScroll:true});}
 function step(){if(!live)return;video.muted=muted();const now=clock();if(lastTime<0){if(now-started>=1500)finish();return;}if(video.currentTime>lastTime){lastTime=video.currentTime;lastProgress=now;}if(now-lastProgress>12000)fail();}
 return {start,step,cancel,get active(){return live;}};
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
