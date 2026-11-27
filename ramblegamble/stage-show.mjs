import { createStageShowState } from './stage-show-state.mjs?v=smeemo-reveal-20261127-v1';
import { curtainLayout, createCurtainProfile, curtainVertex } from './stage-curtain.mjs?v=all-curtain-20261127-v1';
// Unlit GLTF art deliberately stays unlit outside a show. A world-space cone
// mask illuminates the original texels rather than replacing all room materials.
export function installStageLighting(THREE, roots, uniforms){
  const materials=new Set();
  for(const root of roots)root?.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.isMeshBasicMaterial)materials.add(m);});
  for(const m of materials){
    const before=m.onBeforeCompile, cache=m.customProgramCacheKey.bind(m);
    m.onBeforeCompile=function(shader,renderer){
      before.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 rgWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nrgWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 rgWorld;
uniform float rgShow; uniform vec3 rgLamp[3]; uniform vec3 rgAim[3];
float rgBeam(vec3 origin, vec3 aim){
  vec3 delta=rgWorld-origin; float d=max(length(delta),0.001);
  float axis=dot(delta/d,normalize(aim-origin));
  return smoothstep(0.925,0.980,axis)*(1.0-smoothstep(12.0,18.0,d));
}`).replace('#include <opaque_fragment>',`if(rgShow>0.0001){
 float lit=max(rgBeam(rgLamp[0],rgAim[0]),max(rgBeam(rgLamp[1],rgAim[1]),rgBeam(rgLamp[2],rgAim[2])));
 outgoingLight*=mix(1.0,0.17+0.93*lit,rgShow);
}
#include <opaque_fragment>`);
    };
    m.customProgramCacheKey=()=>cache()+'|rg-theatre-v1';m.needsUpdate=true;
  }
  return ()=>{uniforms.rgShow.value=0;};
}
export function createStageShow(THREE,scene,{slotRig,slotsModel,roots,foley,onEmotion=()=>{},reduced=()=>false}){
  const bounds=new THREE.Box3().setFromObject(slotsModel), center=bounds.getCenter(new THREE.Vector3());
  const base=slotRig.position.clone(), layout=curtainLayout(bounds), profile=createCurtainProfile(layout);
  const group=new THREE.Group();group.name='rg-stage-theatre';scene.add(group);
  const {trackZ,bottom,height,outer,retract}=layout;
  const texture=new THREE.TextureLoader().load('/ramblegamble/assets/provided/slot-curtain.png');
  texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  const cloth=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,vertexColors:true,toneMapped:false});
  const curtains=[]; const segments=84,rows=18;
  for(const side of [-1,1]){
    const geo=new THREE.PlaneGeometry(1,1,segments,rows), colors=new Float32Array(geo.attributes.position.count*3);
    const uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++){const u=uv.getX(i);uv.setXY(i,u*6,uv.getY(i)*2);colors.set([1,1,1],i*3);}
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.attributes.position.setUsage?.(THREE.DynamicDrawUsage);geo.attributes.color.setUsage?.(THREE.DynamicDrawUsage);
    const mesh=new THREE.Mesh(geo,cloth);mesh.name='slot-curtain';mesh.position.set(layout.center,bottom,trackZ);mesh.frustumCulled=false;group.add(mesh);curtains.push({mesh,side,colors});
  }
  // A quiet valance in the identical authored texture, not another light strip.
  const valanceMaterial=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false});
  const valance=new THREE.Mesh(new THREE.BoxGeometry(outer*2+.06,.15,.15),valanceMaterial);valance.position.set(layout.center,bottom+height-.045,trackZ+.015);group.add(valance);
  const uniforms={rgShow:{value:0},rgLamp:{value:[0,1,2].map(()=>new THREE.Vector3())},rgAim:{value:[0,1,2].map(()=>new THREE.Vector3())}};
  const restoreLighting=installStageLighting(THREE,[...roots,group],uniforms);
  const beamGeo=new THREE.ConeGeometry(1,1,24,1,true), palette=[0xffedb8,0xe2c4ff,0xffd5ef];
  const beams=palette.map(color=>{const mesh=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}));mesh.visible=false;mesh.frustumCulled=false;group.add(mesh);return mesh;});
  const confetti=new THREE.InstancedMesh(new THREE.PlaneGeometry(.075,.12),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false}),180);confetti.visible=false;confetti.frustumCulled=false;group.add(confetti);
  const temp=new THREE.Object3D(), up=new THREE.Vector3(0,1,0), delta=new THREE.Vector3();
  const confettiColors=[0xffe567,0xff76c9,0xc5a0ff,0x60e3a8,0xfff5d6];
  const pieces=Array.from({length:180},(_,i)=>{const a=i*2.39996323;const r=.4+((i*37)%101)/101*2;confetti.setColorAt(i,new THREE.Color(confettiColors[i%5]));return {a,r,vy:1.1+((i*71)%97)/97*2.1,spin:1+((i*19)%17)/5,phase:i*.45};});
  let burst=null,lastTime=0,lightTarget=null,lastPose=-1,lastTravel=-1,lastClothPose=-1,wasActive=true;
  function cue(name){
    if(name==='stop-roll'){foley.stop('stage-roll');return;}
    if(name==='roll'){foley.stop('stage-hit');foley.stop('stage-cheer');foley.start('stage-roll','stageDrumRoll',{maxDelay:450});onEmotion('suspense');return;}
    if(name==='reveal'||name==='hide'){
      if(name==='reveal')foley.start('stage-hit','stageDrumHit');else foley.stop('stage-hit');
      foley.start('stage-cheer','cheer',{volume:.8});onEmotion('cheer');
      if(lightTarget)burst={time:lastTime,at:lightTarget.clone()};
    }
  }
  const state=createStageShowState({cue});
  function updateCurtains(p,travel,time){
    slotRig.position.copy(base);slotRig.position.z-=retract*(1-travel);slotRig.updateMatrixWorld(true);
    // Only hide after BOTH the cabinet and the cloth reach the closed pose.
    // Opening begins with the fully recessed cabinet already visible.
    slotsModel.visible=p>0||travel>0;
    if(p===lastClothPose&&(p===0||p===1))return;
    lastClothPose=p;
    for(const {mesh,side,colors} of curtains){
      const pos=mesh.geometry.attributes.position;
      for(let i=0;i<pos.count;i++){
        const u=(i%(segments+1))/segments,v=Math.floor(i/(segments+1))/rows;
        const {x,y,z,shade}=curtainVertex(profile,side,u,v,p,time);
        pos.setXYZ(i,x,y,z);colors[i*3]=colors[i*3+1]=colors[i*3+2]=shade;
      }
      pos.needsUpdate=true;mesh.geometry.attributes.color.needsUpdate=true;mesh.geometry.computeBoundingSphere();
    }
  }
  function slot(open,time){lastTime=time;
    if(!state.cabinet(open,time,reduced())){if(reduced()){const s=state.step(time);updateCurtains(s.curtain,s.travel,time);}return;}
    if(open){lightTarget=center.clone();state.begin(center,time,'slot');}
    else {lightTarget=center.clone();state.hide(center,time);}
  }
  function update(time,active,open){
    lastTime=time;
    if(!active||reduced()){if(wasActive||state.open!==open)reset(open);wasActive=false;group.visible=active;return;}
    wasActive=true;
    group.visible=true;
    const s=state.step(time);
    if(s.curtain!==lastPose||s.travel!==lastTravel||s.busy){updateCurtains(s.curtain,s.travel,time);lastPose=s.curtain;lastTravel=s.travel;}
    uniforms.rgShow.value=s.strength;
    if(s.target){
      lightTarget??=new THREE.Vector3(s.target.x,s.target.y,s.target.z);lightTarget.set(s.target.x,s.target.y,s.target.z);
      for(let i=0;i<3;i++){
        const a=i*Math.PI*2/3, phase=time*.001*(.8+i*.13)+i*2.3;
        const lamp=uniforms.rgLamp.value[i],aim=uniforms.rgAim.value[i];
        lamp.set(lightTarget.x+Math.cos(a)*3.4,Math.max(4.3,lightTarget.y+3.1),lightTarget.z+Math.sin(a)*3.4);
        const radius=s.search*2.0+.14;
        aim.set(lightTarget.x+Math.cos(phase)*radius,lightTarget.y+.12*Math.sin(phase*1.3),lightTarget.z+Math.sin(phase*1.13)*radius);
        const beam=beams[i];delta.copy(lamp).sub(aim);beam.position.copy(lamp).add(aim).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(up,delta.clone().normalize());
        beam.scale.set(delta.length()*.38,delta.length(),delta.length()*.38);beam.material.opacity=s.strength*(.055+.025*s.search);beam.visible=s.strength>.01;
      }
    }else for(const b of beams)b.visible=false;
    if(burst){const age=(time-burst.time)/1000;confetti.visible=age>=0&&age<2.4;
      if(confetti.visible){for(let i=0;i<pieces.length;i++){const p=pieces[i],t=Math.max(0,age-(i%6)*.025);temp.position.set(burst.at.x+Math.cos(p.a)*p.r*t,burst.at.y+.55+p.vy*t-1.75*t*t,burst.at.z+Math.sin(p.a)*p.r*t+.5);temp.rotation.set(p.phase+t*p.spin,t*p.spin*1.3,p.a+t*p.spin);temp.scale.setScalar(t>0?Math.min(1,(2.4-age)*2.5):0);temp.updateMatrix();confetti.setMatrixAt(i,temp.matrix);}confetti.instanceMatrix.needsUpdate=true;}else burst=null;
    }else confetti.visible=false;
  }
  function reset(open){state.reset(open);foley.stop('stage-hit');foley.stop('stage-cheer');burst=null;confetti.visible=false;lightTarget=null;restoreLighting();for(const b of beams)b.visible=false;const s=state.step(lastTime);updateCurtains(s.curtain,s.travel,lastTime);lastPose=s.curtain;lastTravel=s.travel;}
  function toggle(point,time){lastTime=time;lightTarget=new THREE.Vector3(point.x,point.y,point.z);return state.toggle(point,time,reduced());}
  function dismiss(time){lastTime=time;return state.dismiss(time);}
  function silent(point,time){lastTime=time;burst=null;confetti.visible=false;for(const key of ['stage-roll','stage-hit','stage-cheer'])foley.stop(key);lightTarget=new THREE.Vector3(point.x,point.y,point.z);return state.begin(point,time,'silent',reduced());}
  function brightnessAt(point){
    const strength=uniforms.rgShow.value;if(!strength)return 1;let lit=0;
    for(let i=0;i<3;i++){const from=uniforms.rgLamp.value[i],aim=uniforms.rgAim.value[i];const x=point.x-from.x,y=point.y-from.y,z=point.z-from.z;const ax=aim.x-from.x,ay=aim.y-from.y,az=aim.z-from.z;const d=Math.max(.001,Math.hypot(x,y,z)),dot=(x*ax+y*ay+z*az)/(d*Math.max(.001,Math.hypot(ax,ay,az)));lit=Math.max(lit,Math.max(0,Math.min(1,(dot-.925)/.055)));}
    return 1-strength+strength*(.17+.93*lit);
  }
  function dispose(){reset(false);scene.remove(group);const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose?.();});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();texture.dispose();}
  reset(false);
  return {group,curtains:curtains.map(c=>c.mesh),slot,toggle,dismiss,silent,reset,update,dispose,brightnessAt,get travel(){return lastTravel;},get busy(){return state.busy;},get silentActive(){return state.owner==='silent';},get manual(){return state.owner==='manual';},get target(){return lightTarget;}};
}
