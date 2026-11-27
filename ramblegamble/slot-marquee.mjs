import {paintMenuSign} from './menu-marquee.mjs?v=corrective-review-20261127-v1';
import {SIGN_ACTIVE_MS,SIGN_CYCLE_MS} from './sign-glow.mjs?v=neon-focus-20261127-v1';

// The existing marquee is 1152x576. Its settled sign occupies this exact crop.
// The cabinet's front face uses atlas x=0..80, y=0..64; other faces reuse
// some of those texels, so do not mutate the shared atlas itself.
export const SLOT_MARQUEE_CROP=[120,272,912,192];
export const SLOT_MARQUEE_RECT=[2,2,76,13];
export const SLOT_MARQUEE_IN=620, SLOT_MARQUEE_OUT=650;
const SCALE=4;
// The source clip has a dark #141228 matte; remove it from the logo crop
// so the unfinished opening assembly never blackens the original sign.
export function keyMarqueeMatte(bytes){
  for(let i=0;i<bytes.length;i+=4){
    const distance=Math.max(Math.abs(bytes[i]-20),Math.abs(bytes[i+1]-18),Math.abs(bytes[i+2]-40));
    bytes[i+3]=Math.round(bytes[i+3]*clamp((distance-5)/18));
  }
  return bytes;
}
const clamp=x=>Math.max(0,Math.min(1,x));
export const marqueeOpacity=p=>{const t=clamp(p);return t*t*(3-2*t);};
// Exact vertices/diagonal of the authored front face, in model-local space.
export const SLOT_MARQUEE_FACE=[5,8,-3,5.1,0,-4,-5.1,8.2,-3,-5.2,.1,-4];
export const SLOT_MARQUEE_UV=[0,1,0,0,1,1,1,0];
export const SLOT_MARQUEE_INDEX=[2,0,1,2,1,3];

// One muted playback per reveal. The original opaque logo is never hidden;
// the overlay fades over it, and the final frame becomes the live neon plate.
export function createSlotMarquee(THREE,model,{doc=document,source='/ramblegamble/assets/marquee/ramble-gamble-marquee.mp4'}={}){
  const canvas=doc.createElement('canvas');canvas.width=80*SCALE;canvas.height=64*SCALE;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Slot marquee canvas unavailable');
  ctx.imageSmoothingEnabled=false;
  const glow=doc.createElement('canvas');glow.width=120;glow.height=30;
  const g=glow.getContext('2d');if(!g)throw Error('Slot marquee glow canvas unavailable');
  const pixels=g.createImageData(120,30);
  const rect=SLOT_MARQUEE_RECT.map(v=>v*SCALE);
  const video=doc.createElement('video');video.muted=true;video.defaultMuted=true;video.volume=0;video.playsInline=true;video.preload='none';video.loop=false;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(SLOT_MARQUEE_FACE,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(SLOT_MARQUEE_UV,2));geometry.setIndex(SLOT_MARQUEE_INDEX);geometry.computeVertexNormals();
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,depthTest:true,alphaTest:.001,side:THREE.FrontSide,toneMapped:false,fog:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='slot-marquee-video';mesh.visible=false;mesh.raycast=()=>{};model.add(mesh);
  let progress=0,last=null,started=false,failed=false,attempt=0,disposed=false,elapsed=0,neonTime=0,paintTime=-1,painted=false,glowing=false,lastEnded=false,mediaTime=-1,stalled=0;
  function stop(){++attempt;video.pause();started=false;elapsed=0;neonTime=0;paintTime=-1;painted=false;glowing=false;lastEnded=false;mediaTime=-1;stalled=0;}
  function suspend(){stop();progress=0;last=null;mesh.visible=false;material.opacity=0;}
  function start(){
    started=true;failed=false;elapsed=0;neonTime=0;paintTime=-1;painted=false;glowing=false;lastEnded=false;mediaTime=-1;stalled=0;
    const ticket=++attempt;
    if(!video.getAttribute('src')||video.error)video.src=source;
    try{video.currentTime=0;Promise.resolve(video.play()).then(()=>{if(!started||disposed)video.pause();},()=>{if(ticket===attempt)failed=true;});}catch{failed=true;}
  }
  function error(){failed=true;}
  video.addEventListener('error',error);
  function paint(dt){
    if(video.readyState<2||video.seeking||video.videoWidth!==1152||video.videoHeight!==576)return false;
    if(!video.ended&&video.currentTime<=0)return false;
    // Avoid texture uploads between decoded frames; neon is painted at 30Hz
    // only during the active portion of its existing ten-second cycle.
    const ended=video.ended;
    if(ended)neonTime=(neonTime+dt)%SIGN_CYCLE_MS;
    const stamp=ended?Math.floor(neonTime/ (1000/30)):Math.floor(video.currentTime*30);
    const activeGlow=ended&&neonTime<SIGN_ACTIVE_MS;
    if(!painted||ended!==lastEnded||(!ended&&stamp!==paintTime)||(ended&&(activeGlow||glowing)&&stamp!==paintTime)){
      ctx.clearRect(...rect);ctx.drawImage(video,...SLOT_MARQUEE_CROP,...rect);
      const frame=ctx.getImageData(...rect);keyMarqueeMatte(frame.data);ctx.putImageData(frame,rect[0],rect[1]);
      if(activeGlow){paintMenuSign(pixels.data,neonTime);g.putImageData(pixels,0,0);ctx.globalAlpha=marqueeOpacity(neonTime/360);ctx.drawImage(glow,3,3,114,24,...rect);ctx.globalAlpha=1;}
      texture.needsUpdate=true;painted=true;paintTime=stamp;glowing=activeGlow;lastEnded=ended;
    }
    return painted;
  }
  function update(time,active,wanted){
    if(disposed)return;
    if(!active){if(started||progress>0)suspend();return;}
    const dt=last===null?0:Math.max(0,Math.min(100,time-last));last=time;
    if(wanted&&!started)start();
    if(started){
      elapsed+=dt;
      if(video.currentTime!==mediaTime||video.ended){mediaTime=video.currentTime;stalled=0;}else stalled+=dt;
      if(painted&&!video.ended&&stalled>2500)failed=true;
      if(video.readyState>=2&&video.videoWidth>0&&(video.videoWidth!==1152||video.videoHeight!==576))failed=true;
      if(!painted&&elapsed>9000)failed=true;
      if(!failed&&(wanted||progress>0))try{paint(dt);}catch{failed=true;}
      if(failed&&!video.paused)video.pause();
    }
    const target=Boolean(wanted&&started&&painted&&!failed);
    progress=clamp(progress+(target?dt/SLOT_MARQUEE_IN:-dt/SLOT_MARQUEE_OUT));
    material.opacity=marqueeOpacity(progress);mesh.visible=progress>0;
    if(!wanted&&started&&progress===0)stop();
  }
  function dispose(){if(disposed)return;suspend();disposed=true;video.removeEventListener('error',error);video.removeAttribute('src');video.load();mesh.removeFromParent();geometry.dispose();material.dispose();texture.dispose();}
  return {update,suspend,dispose,mesh,video};
}
