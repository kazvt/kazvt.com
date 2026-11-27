import {signPhase, SIGN_CYCLE_MS, SIGN_ACTIVE_MS} from './sign-glow.mjs?v=neon-focus-20261127-v1';
import {signMaskBytes, SIGN_BULB_COUNT} from './sign-glow-mask.mjs?v=neon-focus-20261127-v1';

// The menu and 3D stage use the same authored pixel labels, timing and envelopes.
// Only paint a tiny transparent light layer; the original sign remains the base.
export const MENU_SIGN_WIDTH=114, MENU_SIGN_HEIGHT=24;
const mask=signMaskBytes();
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function menuSignEnergy(id,phase){
  if(id>=1&&id<=12){const p=phase.letter-(id-1);return smooth(0,.22,p)*(1-smooth(.4,1,p));}
  if(id>=32&&id<32+SIGN_BULB_COUNT){const p=phase.bulb-(id-32);return smooth(0,.5,p)*(1-smooth(1,3,p));}
  return 0;
}
// Keep the opening assembly intact; fade its decoded frames in, then retain
// the completed frame beneath the exactly registered live plate during handoff.
const INTRO_FADE_SECONDS=.32, HANDOFF_MS=700, GLOW_FADE_MS=360;
const pad=3, W=MENU_SIGN_WIDTH+2*pad,H=MENU_SIGN_HEIGHT+2*pad;
function maskAt(x,y){return x>=0&&x<128&&y>=0&&y<32?mask[(y*128+x)*4]:0;}
// Precompute the two eight-tap neighborhoods used by the scene shader.
const pixels=Array.from({length:W*H},(_,i)=>{
  const x=i%W-pad,y=Math.floor(i/W)-pad;
  const neighbors=[];
  for(const [r,w] of [[1.05,.68/8],[2.35,.32/8]])for(let k=0;k<8;k++){
    const a=k*Math.PI/4;const id=maskAt(x+Math.round(Math.cos(a)*r),y+Math.round(Math.sin(a)*r));
    if(id)neighbors.push([id,w]);
  }
  return {id:maskAt(x,y),neighbors};
});
export function paintMenuSign(out,elapsed){
  out.fill(0);const phase=signPhase(elapsed);
  if(phase.letter<0&&phase.bulb<0)return false;
  const glyph=phase.letter>=0,energy=new Float32Array(32+SIGN_BULB_COUNT);
  for(let id=glyph?1:32;id<(glyph?13:energy.length);id++)energy[id]=menuSignEnergy(id,phase);
  const haloColor=glyph?[255,75,178]:[255,215,75],coreColor=glyph?[255,241,255]:[255,255,199];
  for(let i=0;i<pixels.length;i++){
    const {id,neighbors}=pixels[i];let halo=0;for(const [n,w] of neighbors)halo+=energy[n]*w;
    halo*=.75;const core=energy[id]*(glyph ? .90 : .96);
    const a=core+halo*(1-core);if(a<=0)continue;
    for(let k=0;k<3;k++)out[4*i+k]=(coreColor[k]*core+haloColor[k]*halo*(1-core))/a;
    out[4*i+3]=255*a;
  }
  return true;
}

// One lifecycle for the opening clip, CSS fallback and live neon idle. This is
// independent of WebGL readiness, and never loops the recorded intro audio.
export function createMenuMarquee({menu,video,plate,glow,controls,doc=document,win=window}){
  let phase='closed', elapsed=0,last=null,frame=0,active=false,unavailable=Boolean(video.error)||video.networkState===3,attempt=0,disposed=false,painted=false,pageSuspended=false;
  glow.width=W;glow.height=H;
  let ctx=null,image=null;
  try{ctx=glow.getContext('2d');image=ctx?.createImageData(W,H);}catch{}
  const clear=()=>{if(painted){ctx?.clearRect(0,0,W,H);painted=false;}};
  const allowed=()=>!pageSuspended&&!menu.hidden&&!doc.hidden&&!doc.documentElement.hasAttribute('data-rg-host-locked')&&!controls.open;
  const resetVideo=()=>{++attempt;video.pause();try{video.currentTime=0;}catch{}};
  function setPhase(next){
    phase=next;elapsed=0;last=null;clear();menu.dataset.marqueePhase=next;
    video.hidden=next!=='video'&&next!=='handoff';plate.hidden=next==='video'||next==='closed';
    video.style.opacity=next==='video'?'0':'1';
    plate.style.opacity=next==='handoff'?'0':'';
    glow.style.opacity=next==='settled'?'0':'1';
  }
  function settle(){++attempt;video.pause();setPhase('settled');}
  function handoff(){++attempt;video.pause();setPhase('handoff');}
  function fallback(){++attempt;video.pause();setPhase('fallback');}
  function failed(){unavailable=true;if(phase==='video')fallback();else if(phase==='handoff')settle();}
  function play(){
    const ticket=++attempt;
    try{Promise.resolve(video.play()).catch(()=>{if(ticket===attempt&&active&&phase==='video')failed();});}
    catch{if(ticket===attempt&&active&&phase==='video')failed();}
  }
  function tick(time){
    frame=0;if(!active||!allowed()){sync();return;}
    if(last!==null)elapsed+=Math.max(0,Math.min(250,time-last));last=time;
    if(phase==='video'&&elapsed>=9000)fallback(); // stalled media cannot strand a blank title
    else if(phase==='video'){
      // Media time, not menu time: a delayed decode cannot spend the fade offscreen.
      video.style.opacity=String(smooth(0,INTRO_FADE_SECONDS,video.currentTime));
    }else if(phase==='handoff'){
      // Avoid a brightness dip: the live opaque sign becomes fully visible
      // before the outgoing frame disappears, including its transparent margins.
      const p=Math.min(1,elapsed/HANDOFF_MS);
      plate.style.opacity=String(smooth(0,.8,p));
      video.style.opacity=String(1-smooth(.72,1,p));
      if(p>=1)settle();
    }else if(phase==='fallback'&&elapsed>=2200)settle();
    else if(phase==='settled'&&image){
      if(glow.style.opacity!=='1')glow.style.opacity=String(smooth(0,GLOW_FADE_MS,elapsed));
      elapsed%=SIGN_CYCLE_MS;
      if(elapsed<SIGN_ACTIVE_MS){paintMenuSign(image.data,elapsed);ctx.putImageData(image,0,0);painted=true;}
      else clear();
    }
    schedule();
  }
  function schedule(){if(!frame&&active)frame=win.requestAnimationFrame(tick);}
  function sync(){
    if(disposed)return;
    video.preload='auto';
    if(menu.hidden){if(phase!=='closed'){resetVideo();setPhase('closed');}}
    const wasActive=active;active=allowed();menu.dataset.menuActive=String(active);
    if(!active){
      if(frame)win.cancelAnimationFrame(frame);frame=0;last=null;clear();
      if(wasActive){++attempt;video.pause();}
      return;
    }
    if(phase==='closed'){
      if(unavailable)fallback();
      else{resetVideo();setPhase('video');play();}
    }else if(active&&!wasActive&&phase==='video'){if(video.ended)handoff();else play();}
    schedule();
  }
  function ended(){if(phase==='video'&&video.ended){handoff();schedule();}}
  function matte(){
    if(video.readyState<2)return;let alpha=false;
    try{const c=doc.createElement('canvas');c.width=c.height=1;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(video,0,0,1,1);alpha=g.getImageData(0,0,1,1).data[3]<250;}catch{}
    video.classList.toggle('rg-marquee-matte',!alpha);
  }
  const observer=new win.MutationObserver(sync);
  observer.observe(menu,{attributes:true,attributeFilter:['hidden']});
  observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-rg-host-locked']});
  observer.observe(controls,{attributes:true,attributeFilter:['open']});
  video.addEventListener('ended',ended);video.addEventListener('error',failed);video.addEventListener('loadeddata',matte);
  doc.addEventListener('visibilitychange',sync);
  video.volume=Math.max(0,Math.min(1,video.volume*.2));
  setPhase('closed');sync();
  return {sync,setPageSuspended(value){pageSuspended=Boolean(value);sync();},dispose(){disposed=true;observer.disconnect();if(frame)win.cancelAnimationFrame(frame);resetVideo();setPhase('closed');video.removeEventListener('ended',ended);video.removeEventListener('error',failed);video.removeEventListener('loadeddata',matte);doc.removeEventListener('visibilitychange',sync);}};
}
