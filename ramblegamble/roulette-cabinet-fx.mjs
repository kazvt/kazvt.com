import {createCartoonCueTrack, ROULETTE_CARTOON_CUES} from './cartoon-cues.mjs?v=sky-soot-20261127-v1';
import {makeSmokeTexture} from './slot-cabinet-fx.mjs?v=sky-soot-20261127-v1';
// A small independent soot pool. Smoke is emitted in rig space so existing
// puffs don't follow subsequent cabinet jumps or cover the spinning center.
export function createRouletteSoot(THREE,rig,carrier,dimensions,random=Math.random){
 const texture=makeSmokeTexture(THREE),group=new THREE.Group();group.name='rg-roulette-soot';rig.add(group);
 const pool=Array.from({length:28},()=>{const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,depthTest:true,toneMapped:false}));sprite.visible=false;sprite.raycast=()=>{};group.add(sprite);return {sprite,born:-Infinity,origin:new THREE.Vector3()};});
 const {width,height,depth}=dimensions,unit=Math.min(width,depth),size=Math.min(.16,unit*.095);
 let next=Infinity,serial=0;
 function emit(time){const p=pool.find(p=>!p.sprite.visible)||pool.reduce((a,b)=>a.born<b.born?a:b);const side=serial++%2?1:-1,back=serial%3===0;
  p.origin.set(side*width*(back?.28:.49),height*(.26+random()*.18),back?depth*.49:(random()-.5)*depth*.48);
  carrier.localToWorld(p.origin);rig.worldToLocal(p.origin);
  Object.assign(p,{born:time,side,back,life:850+random()*400,phase:random()*Math.PI*2,spin:(random()-.5)*1.3});p.sprite.position.copy(p.origin);p.sprite.scale.setScalar(size);p.sprite.material.opacity=0;p.sprite.visible=true;
 }
 function begin(time){clear();next=time;}
 function update(time,rolling){if(rolling&&time>=next){emit(time);if(serial%3===0)emit(time);next=time+135;}
  for(const p of pool){if(!p.sprite.visible)continue;const t=(time-p.born)/p.life;if(t>=1){p.sprite.visible=false;continue;}if(t<0)continue;
   p.sprite.position.copy(p.origin);p.sprite.position.x+=p.side*unit*.25*t+Math.sin(p.phase+t*4)*unit*.025*t;p.sprite.position.y+=height*.65*t;p.sprite.position.z+=(p.back?1:0)*unit*.14*t;
   p.sprite.scale.setScalar(size*(1+2.4*t));p.sprite.material.rotation=p.spin*t;p.sprite.material.opacity=.68*smooth(t/.15)*(1-smooth((t-.35)/.65));
  }
 }
 function clear(){next=Infinity;for(const p of pool)p.sprite.visible=false;}
 return {begin,update,clear,dispose(){clear();for(const p of pool)p.sprite.material.dispose();texture.dispose();group.removeFromParent();}};
}
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
// The whole assembly moves together. Phase is normalized to the existing spin,
// NOT the other way around; the RNG, rotor and ball timing are untouched.
// [phase, hop (cabinet heights), vertical scale, radial scale, pitch, roll, side]
const KEYS=[
 [0,0,1,1,0,0,0],[.025,0,.76,1,0,-.055,-.012],
 [.045,.045,1.33,.84,.035,.075,.012],[.095,.40,1.12,.90,-.09,-.09,-.018],
 [.145,0,.73,.98,.07,.10,.012],[.19,.19,1.20,.87,-.075,-.11,-.018],
 [.245,.09,1.07,.93,.10,.095,.014],[.29,0,.79,.99,-.065,-.10,-.014],
 [.36,.10,1.13,.90,.09,.10,.015],[.46,.04,.94,.96,-.105,-.09,-.014],
 [.56,.12,1.10,.91,.08,.10,.012],[.69,0,.82,.98,-.07,-.085,-.01],
 [.76,.075,1.12,.93,.06,.06,.007],[.83,.015,.96,.98,-.035,-.045,-.005],
 [.90,0,.86,.99,.025,.03,0],[.95,.025,1.055,.98,-.012,-.018,0],[1,0,1,1,0,0,0],
];
export function sampleRouletteCabinet(progress){
 const p=clamp(Number.isFinite(progress)?progress:0);let i=KEYS.findIndex(k=>k[0]>p);if(i<0)i=KEYS.length-1;
 const a=KEYS[i-1],b=KEYS[i],t=smooth((p-a[0])/(b[0]-a[0]));
 let [hop,sy,s,pitch,roll,side]=a.slice(1).map((v,j)=>v+(b[j+1]-v)*t);
 // Short damped mechanical shudder in the middle, before the ball settles.
 const w=smooth((p-.15)/.10)*(1-smooth((p-.63)/.18));
 roll+=.022*w*Math.sin(p*145);pitch+=.018*w*Math.cos(p*121);hop+=.018*w*(1+Math.sin(p*163));
 return {hop,sy,s,pitch,roll,side};
}
// Fit the transformed rest AABB inside its original X/Z footprint. ZXY Euler
// order = Rz * Rx. Solve horizontal support and bottom-floor clearance exactly.
export function fitRouletteCabinet(pose,{width,height,depth}){
 const hx=width/2,hz=depth/2,h=height, {pitch,roll,sy}=pose;
 const cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
 const x=pose.side*width;
 const sx=Math.min(pose.s, (hx-Math.abs(x)-Math.abs(sr*cp)*h*sy)/(Math.abs(cr)*hx+Math.abs(sr*sp)*hz),
   (hz-Math.abs(sp)*h*sy)/(Math.abs(cp)*hz));
 const radial=clamp(sx,0,1);
 const floorLift=(Math.abs(sr)*hx+Math.abs(cr*sp)*hz)*radial;
 return {x,y:floorLift+pose.hop*h,sy,s:radial,pitch,roll};
}
export function createRouletteCabinetFX(THREE,rig,model,{foley}={}){
 rig.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3().setFromObject(model), size=bounds.getSize(new THREE.Vector3());
 const pivot=bounds.getCenter(new THREE.Vector3());pivot.y=bounds.min.y;rig.worldToLocal(pivot);
 const carrier=new THREE.Group();carrier.name='rg-roulette-cabinet-motion';carrier.rotation.order='ZXY';carrier.position.copy(pivot);
 rig.add(carrier);carrier.add(model);model.position.sub(pivot);carrier.updateWorldMatrix(true,true);
 const inverse=carrier.matrixWorld.clone().invert();
 const cues=createCartoonCueTrack(foley,'roulette-cartoon');let running=false;
 const dimensions={width:size.x,height:size.y,depth:size.z};
 let soot=null;try{soot=createRouletteSoot(THREE,rig,carrier,dimensions);}catch(error){console.warn("Roulette soot unavailable",error);}

 function reset(clearSmoke=true){if(clearSmoke)soot?.clear();if(!running)return;cues.clear();running=false;carrier.position.copy(pivot);carrier.scale.set(1,1,1);carrier.rotation.set(0,0,0);carrier.updateWorldMatrix(true,true);}
 function begin(time,duration,{active=true,reduced=false}={}){reset();if(!active||reduced)return;running=true;soot?.begin(time);cues.begin(time,ROULETTE_CARTOON_CUES,duration);}
 function update(time,progress,active){if(!active){reset();return;}if(!running){soot?.update(time,false);return;}if(progress>=1){reset(false);soot?.update(time,false);return;}const p=fitRouletteCabinet(sampleRouletteCabinet(progress),dimensions);carrier.position.copy(pivot);carrier.position.x+=p.x;carrier.position.y+=p.y;carrier.scale.set(p.s,p.sy,p.s);carrier.rotation.set(p.pitch,0,p.roll);carrier.updateWorldMatrix(true,true);soot?.update(time,true);cues.update(time);}
 // Convert rest-world ring / orbit positions into the live cabinet transform.
 function worldPoint(point){return point.clone().applyMatrix4(inverse).applyMatrix4(carrier.matrixWorld);}
 // A fixed framing envelope, not a camera that chases the wobble. The sum
 // bounds vertical stretch, maximum hop, tilt, and floor correction.
 const framing=bounds.clone();framing.max.y+=size.y*.76+(size.x+size.z)*.14;
 return {begin,update,reset,worldPoint,framing,carrier,dispose(){reset();soot?.dispose();}};
}
