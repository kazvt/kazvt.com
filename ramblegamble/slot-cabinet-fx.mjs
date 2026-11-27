// Presentation only: no game state, RNG, storage, or reel scheduling.
const TAU = Math.PI * 2;
const clamp = (n, a=0, b=1) => Math.max(a, Math.min(b,n));
const smooth = n => { n=clamp(n); return n*n*(3-2*n); };
const REST = Object.freeze({x:0,y:0,roll:0,sx:1,sy:1});
// Values are fractions of cabinet height, radians, and scale deltas.
const poses = {
  crank: [[0,0,0,0,0],[90,-.007,0,-.026,-.025],[235,.012,.045,.032,.025],[380,-.006,0,-.019,-.018],[510,0,0,0,0]],
  press: [[0,0,0,0,0],[70,.005,0,.018,-.022],[180,-.008,.032,-.023,.022],[300,.004,0,.014,-.012],[420,0,0,0,0]],
  tap: [[0,0,0,0,0],[75,0,0,.009,-.012],[170,0,.012,-.008,.009],[280,0,0,0,0]],
  win: [[0,0,0,0,0],[100,-.008,0,-.021,-.032],[285,.015,.068,.032,.027],[470,-.01,0,-.024,-.027],[590,.006,.033,.017,.015],[750,0,0,0,0]],
  loss: [[0,0,0,0,0],[95,.009,0,.027,-.023],[220,-.012,.04,-.034,.013],[355,.008,0,.022,-.04],[490,-.003,.012,-.012,.007],[650,0,0,0,0]],
};
function keyPose(kind,elapsed) {
  const keys=poses[kind];
  if(!keys || elapsed<0 || elapsed>=keys.at(-1)[0]) return REST;
  const i=keys.findIndex(k=>k[0]>elapsed), a=keys[i-1], b=keys[i];
  const t=smooth((elapsed-a[0])/(b[0]-a[0]));
  const [x,y,roll,s]=a.slice(1).map((v,j)=>v+(b[j+1]-v)*t);
  return {x,y,roll,sx:1-s*.65,sy:1+s};
}
export function sampleCabinetPose(kind,elapsed,{rolling=false,brakeAge=Infinity}={}) {
  const p=keyPose(kind,elapsed);
  if(!rolling || elapsed<0) return p;
  // Continuous, bounded mechanical wobble after the anticipatory hop.
  const gain=smooth((elapsed-160)/230);
  const t=elapsed/1000, beat=Math.sin(t*TAU*5.1), slow=Math.sin(t*TAU*2.7);
  const kick=brakeAge>=0&&brakeAge<220 ? Math.sin(brakeAge/220*Math.PI*2)*(1-brakeAge/220):0;
  return {x:p.x+gain*(.006*beat+.003*slow),y:p.y+gain*.008*Math.abs(slow),roll:p.roll+gain*(.013*beat+.006*slow)+.012*kick,sx:p.sx,sy:p.sy};
}
// Keep all corners above the floor and inside the measured bay, even on a
// compressed/tilted pose. Z is untouched, so the rear wall clearance survives.
export function fitCabinetPose(p,{width,height,bayWidth}) {
  const half=width/2, clearance=Math.max(0,(bayWidth-width)/2-.035);
  const factor=clearance===0?0:Math.min(1,clearance/(height*Math.abs(p.x)+height*Math.abs(p.roll)*1.05+half*Math.max(0,p.sx-1)+1e-9));
  const roll=p.roll*factor, sx=1+(p.sx-1)*factor, sy=p.sy;
  return {x:p.x*height*factor,y:p.y*height+half*sx*Math.abs(Math.sin(roll)),roll,sx,sy};
}
function makeSmokeTexture(THREE) {
  // Deliberately low-resolution, irregular cel-shaded soot, not luminous mist.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=48;
  const c=canvas.getContext('2d'); if(!c) throw Error('Smoke canvas unavailable');
  const lobes=[[24,25,15],[13,27,10],[33,28,11],[20,14,11],[33,16,9],[12,17,7],[25,36,9]];
  function cloud(layers,fill){c.fillStyle=fill;for(const [x,y,r] of lobes){c.beginPath();c.arc(x+layers[0],y+layers[1],r*layers[2],0,TAU);c.fill();}}
  cloud([0,0,1],'#17151e');cloud([-1,-2,.83],'#38353e');cloud([-3,-4,.64],'#59565e');
  c.fillStyle='#747078';c.fillRect(14,11,7,3);c.fillRect(11,15,5,4);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  tex.magFilter=tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false;return tex;
}
export function createSlotCabinetFX(THREE,rig,model,{bayWidth,foley,random=Math.random}={}) {
  const bounds=new THREE.Box3().setFromObject(model), size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());center.y=bounds.min.y;
  const pivot=rig.worldToLocal(center.clone());
  const bodyBounds=new THREE.Box3().setFromObject(model.getObjectByName("machine")||model);
  const bodySize=bodyBounds.getSize(new THREE.Vector3());
  const bodyCenter=rig.worldToLocal(bodyBounds.getCenter(new THREE.Vector3())).sub(pivot);
  const texture=makeSmokeTexture(THREE);
  const restInverse=new THREE.Matrix4();
  const carrier=new THREE.Group();carrier.name='rg-slot-cabinet-motion';carrier.position.copy(pivot);
  // Parent rig retains sole ownership of curtain travel. Model local scale,
  // screen geometry and lever quaternion are unchanged.
  const smoke=new THREE.Group();smoke.name='rg-slot-soot';
  const pool=Array.from({length:36},()=>{
    const material=new THREE.SpriteMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,depthTest:true,toneMapped:false});
    const sprite=new THREE.Sprite(material);sprite.visible=false;smoke.add(sprite);return {sprite,born:-Infinity};
  });
  // Attach only after all presentation objects are constructed.
  rig.add(carrier);carrier.add(model);model.position.sub(pivot);carrier.updateWorldMatrix(true,true);
  restInverse.copy(carrier.matrixWorld).invert();rig.add(smoke);
  // Actual cabinet's rear half and two side seams. The local +Z direction is
  // toward the back wall (the stage rig is turned 180 degrees).
  const backZ=rig.worldToLocal(new THREE.Vector3(center.x,center.y,bodyBounds.min.z)).z-pivot.z;
  let kind='',started=0,rolling=false,brake=-Infinity,nextPuff=Infinity,serial=0,sounding=false,eligible=false;
  function emit(time,side,back=false,force=1){
    const p=pool.find(p=>!p.sprite.visible)||pool.reduce((a,b)=>a.born<b.born?a:b);
    const s=side||1, r=random();
    const local=new THREE.Vector3(bodyCenter.x+s*bodySize.x*(back ? .34 : .49),bodyCenter.y+bodySize.y*(back ? .41 : -.01+.19*r),backZ-(back ? .035 : bodySize.z*.25));
    carrier.localToWorld(local);rig.worldToLocal(local);
    Object.assign(p,{born:time,life:950+random()*450,origin:local,side:s,force,phase:random()*TAU,spin:(random()-.5)*1.3,base:.18+random()*.09});
    p.sprite.position.copy(local);p.sprite.scale.setScalar(p.base);p.sprite.material.opacity=0;p.sprite.visible=true;
  }
  function burst(time,count,force=1){for(let i=0;i<count;i++)emit(time+(i%3)*45,i%2?1:-1,i%3===2,force);}
  function stopSound(){if(!sounding)return;sounding=false;foley?.stop('slot-rattle');foley?.stop('slots');}
  function stopRolling(){rolling=false;nextPuff=Infinity;stopSound();}
  function reset(){stopRolling();eligible=false;brake=-Infinity;kind='';carrier.position.copy(pivot);carrier.rotation.z=0;carrier.scale.set(1,1,1);carrier.updateMatrixWorld(true);for(const p of pool)p.sprite.visible=false;}
  function begin(time,action,{active=true,reduced=false}={}){
    reset();if(!active)return;eligible=true;
    const spin=action!=='tap';rolling=spin;started=time;kind=reduced?'':action;
    if(spin){sounding=true;foley?.start('slot-rattle','slotRattle',{loop:true,volume:action==='crank'?1:.78});foley?.start('slots','slotMelody',{loop:true,volume:.64});}
    if(spin&&!reduced){burst(time,3,.75);nextPuff=time+200;}
  }
  function result(time,won,{active=true,reduced=false,wasRolling=true}={}){
    stopRolling();if(!eligible||!active||reduced){reset();return;}eligible=false;
    if(!won&&!wasRolling)return;
    kind=won?'win':'loss';started=time;burst(time,won?5:8,won?.85:1.25);
  }
  function update(time,{active,reduced}){
    if(!active){if(eligible||kind||rolling||sounding||pool.some(p=>p.sprite.visible))reset();return;}
    if(reduced){if(!kind&&!pool.some(p=>p.sprite.visible))return;kind='';nextPuff=Infinity;for(const p of pool)p.sprite.visible=false;carrier.position.copy(pivot);carrier.rotation.z=0;carrier.scale.set(1,1,1);carrier.updateMatrixWorld(true);return;}
    if(!kind&&!pool.some(p=>p.sprite.visible))return;
    const pose=fitCabinetPose(sampleCabinetPose(kind,time-started,{rolling:rolling&&Boolean(kind),brakeAge:time-brake}),{width:size.x,height:size.y,bayWidth});
    carrier.position.copy(pivot);carrier.position.x+=pose.x;carrier.position.y+=pose.y;carrier.rotation.z=pose.roll;carrier.scale.set(pose.sx,pose.sy,1);carrier.updateMatrixWorld(true);
    if(!rolling&&kind&&time-started>=poses[kind].at(-1)[0])kind='';
    if(rolling&&time>=nextPuff){emit(time,serial++%2?1:-1,serial%3===0);if(serial%3===0)emit(time,serial%2?1:-1,true,.75);nextPuff=time+170;}
    for(const p of pool){if(!p.sprite.visible)continue;const age=time-p.born,t=age/p.life;if(t>=1){p.sprite.visible=false;continue;}if(t<0)continue;
      p.sprite.position.copy(p.origin);p.sprite.position.x+=p.side*(.32+.32*p.force)*t+Math.sin(p.phase+t*4)*.055*t;p.sprite.position.y+=(.42+.38*p.force)*t;p.sprite.position.z-=.12*t;
      p.sprite.scale.setScalar(p.base+(.32+.24*p.force)*t);p.sprite.material.rotation=p.spin*t;
      p.sprite.material.opacity=.83*smooth(t/.12)*(1-smooth((t-.33)/.67));
    }
  }
  return {begin,result,stopRolling,brake(time){brake=time;},update,reset,worldPoint(point){return point.clone().applyMatrix4(restInverse).applyMatrix4(carrier.matrixWorld);},dispose(){reset();for(const p of pool)p.sprite.material.dispose();texture.dispose();smoke.removeFromParent();}};
}
