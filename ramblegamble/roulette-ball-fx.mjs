// Violet voxel embers use the same palette/shape vocabulary as the VIP portal.
// The bounded emitter samples the real ball world position AFTER wheel motion.
import { portalParticleSeed } from './vip-atmosphere.mjs?v=vip-atmosphere-20261127-v1';
export const BALL_EMBER_RATE=40, BALL_EMBER_CAP=40, BALL_IDLE_INTENSITY=.2;
const clamp=n=>Math.max(0,Math.min(1,n));
export function ballEmissionRate(moving){return BALL_EMBER_RATE*(moving?1:BALL_IDLE_INTENSITY);}
export function createBallAtmosphere(THREE,group,ball){
  if(!ball)return null;
  const palette=[0x4b286b,0x68419a,0x9568c9,0xb596dc,0xd4b0fa];
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.73,depthWrite:false,depthTest:true,toneMapped:false,fog:false}),BALL_EMBER_CAP);
  mesh.name='rg-roulette-violet-embers';mesh.count=0;mesh.frustumCulled=false;mesh.visible=false;group.add(mesh);
  const cloud=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xb493d9,transparent:true,opacity:.17,depthWrite:false,depthTest:true,toneMapped:false,fog:false}),5);
  cloud.name='rg-roulette-idle-stink';cloud.frustumCulled=false;cloud.visible=false;group.add(cloud);
  const slots=Array.from({length:BALL_EMBER_CAP},(_,i)=>({seed:portalParticleSeed(i),age:Infinity,life:.6,origin:new THREE.Vector3(),velocity:new THREE.Vector3()}));
  const pose=new THREE.Object3D(),center=new THREE.Vector3(),previous=new THREE.Vector3(),color=new THREE.Color();let last=null,carry=0,next=0,clock=0,idle=0;
  function clear(){last=null;carry=idle=0;for(const p of slots)p.age=Infinity;mesh.count=0;mesh.visible=cloud.visible=false;}
  function update(time,active,moving){
    if(!active){clear();return;}
    ball.getWorldPosition(center);const dt=last===null?0:Math.max(0,Math.min(.1,(time-last)/1000));if(last===null)previous.copy(center);last=time;clock+=dt;
    for(const p of slots)p.age+=dt;
    const rate=ballEmissionRate(moving),before=carry;
    carry+=dt*rate;const n=Math.floor(carry+1e-9);carry=Math.max(0,carry-n);
    for(let j=0;j<n;j++){
      const p=slots[next++%slots.length],s=p.seed,angle=next*2.39996323+s.twist;
      const born=Math.max(0,Math.min(dt,(j+1-before)/rate));p.age=dt-born;p.life=.45+s.life*.075;p.origin.copy(previous).lerp(center,dt?born/dt:1);p.origin.x+=Math.cos(angle)*.055;p.origin.z+=Math.sin(angle)*.055;p.origin.y+=.07;
      p.velocity.set(Math.cos(angle)*(.06+s.travel*.04),.18+s.rise*.14,Math.sin(angle)*(.06+s.travel*.04));
    }
    let count=0;
    for(const p of slots){if(p.age>=p.life)continue;const s=p.seed,t=p.age/p.life,fade=clamp(t/.12)*clamp((1-t)/.4),size=(.016+s.size*.46)*fade;
      pose.position.set(p.origin.x+p.velocity.x*p.age,p.origin.y+p.velocity.y*p.age,p.origin.z+p.velocity.z*p.age);pose.position.x+=Math.sin(t*5+s.twist)*.025*t;pose.rotation.set(s.twist+t,s.twist*.7-t*2,t*3);pose.scale.set(size*.75,size*1.4,size);pose.updateMatrix();mesh.setMatrixAt(count,pose.matrix);mesh.setColorAt(count,color.setHex(palette[s.palette]));count++;}
    mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    idle=clamp(idle+dt*(moving?-8:3));cloud.visible=idle>.001;cloud.material.opacity=.17*idle;
    // Tiny voxel wisps, less than one ball diameter in width, above the ball.
    if(cloud.visible){for(let i=0;i<5;i++){const t=(clock*.8+i/5)%1,a=i*2.4+t*2,fade=Math.sin(Math.PI*t),size=(.035+.025*t)*fade;pose.position.set(center.x+Math.cos(a)*(.025+.045*t),center.y+.11+t*.14,center.z+Math.sin(a)*(.025+.045*t));pose.rotation.set(0,a,0);pose.scale.set(size,size*.8,size);pose.updateMatrix();cloud.setMatrixAt(i,pose.matrix);}cloud.instanceMatrix.needsUpdate=true;}
    previous.copy(center);
  }
  return {update,clear,mesh,cloud};
}
