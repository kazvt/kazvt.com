// The theatre is presentation-only. The slot board and reel clock never depend on it.
export const REVEAL_MS = 4000;
export const RETRACT_MS = 2400;
export const LIGHT_RELEASE_MS = 1200;
const clamp = x => Math.max(0, Math.min(1,x));
export const smooth = x => {x=clamp(x);return x*x*(3-2*x);};
export function cabinetPose(progress) {
  const p=clamp(progress);
  // Fully clear the opening before travel. On reversal, the cabinet is fully
  // backstage before the curtain starts closing. A brief dead band is intentional.
  return { curtain:smooth(p/.48), travel:smooth((p-.52)/.48) };
}
export function createStageShowState({ cue=()=>{} }={}) {
  let pose=0, slot=null, lighting=null, target=null, owner=null;
  function stopSound(){cue('stop-roll');}
  function clearLight(){lighting=null;target=null;owner=null;stopSound();}
  function cabinet(open,time,reduced=false){
    const destination=open?1:0;
    if((slot?.to??pose)===destination)return false;
    if(reduced){reset(open);return false;}
    const start=pose;slot={from:start,to:destination,started:time,duration:open?REVEAL_MS:RETRACT_MS};
    return true;
  }
  function begin(point,time,kind='manual',reduced=false){
    if(reduced)return false;
    const from=lighting?.strength??0;stopSound();target={...point};owner=kind;
    lighting={started:time,phase:'roll',strength:from,from};cue('roll');return true;
  }
  function dismiss(time,cheer=true){
    if(!lighting||lighting.phase==='out')return false;
    stopSound();lighting={started:time,phase:'out',strength:lighting.strength,from:lighting.strength};
    if(cheer)cue('hide');return true;
  }
  function hide(point,time){
    const from=lighting?.strength??0;stopSound();target={...point};owner="slot";lighting={started:time,phase:"hide",strength:from,from};cue("hide");
  }
  function toggle(point,time,reduced=false){
    if(reduced)return false;
    if(owner==='manual'&&lighting?.phase!=='out'&&target&&Math.hypot(point.x-target.x,point.y-target.y,point.z-target.z)<.85)return dismiss(time);
    return begin(point,time,'manual');
  }
  function reset(open=false){slot=null;pose=open?1:0;clearLight();}
  function step(time){
    if(slot){const p=clamp((time-slot.started)/slot.duration);pose=slot.from+(slot.to-slot.from)*p;if(p>=1)slot=null;}
    let phase='off',strength=0,search=0;
    if(lighting){let age=Math.max(0,time-lighting.started);
      if(lighting.phase==='roll'){
        if(age>=REVEAL_MS){lighting={started:lighting.started+REVEAL_MS,phase:'reveal',strength:1};stopSound();cue('reveal');age=Math.max(0,time-lighting.started);}
        else {strength=lighting.from+(1-lighting.from)*smooth(age/650);search=1-smooth((age-2350)/1650);}
      }
      if(lighting.phase==='reveal'){
        strength=1;
        if(owner==='slot'&&age>=2200){lighting={started:lighting.started+2200,phase:'out',strength:1,from:1};age=Math.max(0,time-lighting.started);}
      }
      if(lighting.phase==='hide'){strength=(lighting.from+(1-lighting.from)*smooth(age/300))*(1-smooth((age-1200)/1200));search=smooth(age/RETRACT_MS);if(age>=RETRACT_MS){lighting=null;target=null;owner=null;strength=0;}}
      if(lighting?.phase==='out'){strength=lighting.from*(1-smooth(age/LIGHT_RELEASE_MS));if(age>=LIGHT_RELEASE_MS){lighting=null;target=null;owner=null;strength=0;}}
      if(lighting){lighting.strength=strength;phase=lighting.phase;}
    }
    return {...cabinetPose(pose),busy:!!slot,target,owner,phase,strength,search};
  }
  return { cabinet,begin,hide,toggle,dismiss,reset,clearLight,step,get busy(){return !!slot;},get owner(){return owner;},get open(){return (slot?.to??pose)===1;} };
}
