import { dancePose } from './stage-dance.mjs?v=music-intensity-20261128-v1';
// Original low-resolution silhouette art, three world-space cutout texture panels.
// Only these canvases update at 6 fps; the rest of the scene renders normally.
export const CROWD_FPS=6;
// Three inward-facing panels share exact world-space corner coordinates.
// Local +X points toward -Z on the left panel and +Z on the right panel.
export const CROWD_BOUNDARY=Object.freeze({left:-1.85,right:16.85,front:-.45,leftFront:-3.95,back:13.4});
export const CROWD_FADE_WIDTH=2.5;
const {left,right,front,leftFront,back}=CROWD_BOUNDARY;
export const CROWD_SECTIONS=Object.freeze([
  Object.freeze({x:(left+right)/2,z:back,width:right-left,yaw:Math.PI,seed:19,fade:null}),
  Object.freeze({x:left,z:(leftFront+back)/2,width:back-leftFront,yaw:Math.PI/2,seed:31,fade:'right'}),
  Object.freeze({x:right,z:(front+back)/2,width:back-front,yaw:-Math.PI/2,seed:47,fade:'left'}),
]);
export function crowdEdgeAlpha(section,u) {
  if(!section.fade)return 1;
  const distance=(section.fade==='left'?u:1-u)*section.width;
  const t=Math.max(0,Math.min(1,distance/CROWD_FADE_WIDTH));
  return t*t*(3-2*t);
}
// Cache the mask gradient once, then apply it to the completed silhouette
// texture (including the base shadow) without changing its RGB or animation.
export function makeCrowdEdgeMask(ctx,width,section) {
  if(!section.fade)return null;
  const gradient=ctx.createLinearGradient(0,0,width,0);
  const fraction=Math.min(1,CROWD_FADE_WIDTH/section.width);
  const count=16;
  for(let i=0;i<=count;i++){
    const u=section.fade==='left'?fraction*i/count:1-fraction+fraction*i/count;
    gradient.addColorStop(u,`rgba(255,255,255,${crowdEdgeAlpha(section,u)})`);
  }
  // Canvas extends the first/last stop across the untouched portion.
  return gradient;
}
export function applyCrowdEdgeMask(ctx,width,height,mask) {
  if(!mask)return;
  ctx.save();
  ctx.globalCompositeOperation='destination-in';ctx.fillStyle=mask;
  ctx.fillRect(0,0,width,height);ctx.restore();
}
export function crowdPeople(width,seed) {
  let s=seed;const rand=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
  const people=[];
  for(let row=0;row<5;row++) for(let x=-4;x<width+10;x+=11+row*1.4) {
    people.push({row,x:x+rand()*6,base:60+row*23+rand()*4,w:7+row+rand()*4,h:18+row*2+rand()*7,phase:rand()*Math.PI*2,speed:.65+rand()*1.1,hair:Math.floor(rand()*4),type:rand(),shade:Math.floor(rand()*3)});
  }
  // Pick one adjacent pair from each group of four, without altering the
  // original random sequence or the normal audience poses. Round the final
  // partial group to whole pairs. The same spectators dance every cheer.
  const pairs=[];
  for(let row=0;row<5;row++) {
    const line=people.filter(person=>person.row===row);
    for(let i=0;i<line.length;i+=4) {
      const remaining=line.length-i;
      if(remaining<2)continue;
      const first=i+(remaining>=4&&((seed+row+i/4)%2===1)?2:0);
      const a=line[first],b=line[first+1];
      const pair={center:(a.x+b.x)/2,phase:a.phase,speed:(a.speed+b.speed)/2};
      pairs.push({a,b,pair,partial:remaining<4});
    }
  }
  // Nearest possible half of the panel, in whole pairs. Drop trailing
  // partial groups first so the middle of each row stays evenly distributed.
  const targetPairs=Math.round(people.length/4);
  while(pairs.length>targetPairs){let partial=pairs.length-1;while(partial>=0&&!pairs[partial].partial)partial--;pairs.splice(partial<0?pairs.length-1:partial,1);}
  for(const {a,b,pair} of pairs){a.dance={...pair,side:-1};b.dance={...pair,side:1};}
  return people;
}
export function crowdPose(person,frame,emotion) {
  const t=frame/CROWD_FPS, p=person.phase, cheer=emotion==='cheer', shock=emotion==='shock', suspense=emotion==='suspense';
  const energy=cheer?1:suspense?.12:shock?.65:.36;
  const hop=cheer?Math.max(0,Math.sin(t*5*person.speed+p))*13:shock?Math.abs(Math.sin(t*3+p))*4:Math.sin(t*2.4*person.speed+p)*2;
  return {x:Math.round(person.x+Math.sin(t*2+p)*energy*(cheer?4:2)),y:Math.round(person.base-hop*energy),arm:cheer?10+Math.round((Math.sin(t*6*person.speed+p)+1)*7):shock?9:Math.round((Math.sin(t*2+p)+1)*3),arms:cheer?2:shock?1:suspense?0:person.type<.22?1:0};
}
// A silly paired celebration: side-by-side hip bumps, alternating shoulder
// leans and linked arms. No anatomical detail; only the cheering pose changes.
export function crowdDancePose(person,frame) {
  const d=person.dance;
  if(!d)return null;
  const t=frame/CROWD_FPS, beat=t*Math.PI*2;
  const pulse=Math.sin(beat), hop=Math.max(0,Math.sin(beat*.5))*5;
  return {x:Math.round(d.center+d.side*(5.1+1.3*pulse)),
    y:Math.round(person.base-hop),lean:d.side*(2.6*pulse),
    hip:Math.round(-d.side*(2.8+2*pulse)),arm:10+Math.round(5*(1+Math.sin(beat+.9))),
    partnerSide:-d.side};
}
export function paintCrowd(ctx,width,height,people,frame,emotion,musicFrame=frame) {
  ctx.clearRect(0,0,width,height);
  const poly=(pts,color)=>{ctx.fillStyle=color;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
  const palettes=[['#473653','#40304e','#382940'],['#3d2d4c','#332541','#423051'],['#332541','#2c203b','#39294b'],['#291d37','#30223e','#352441'],['#21192f','#292039','#30233e']];
  for(const p of people) {
    const dance=emotion==='cheer'&&Number.isFinite(musicFrame)?crowdDancePose(p,musicFrame):null;
    const {x,y,arm,arms}=dance?{...dance,arms:2}:crowdPose(p,frame,emotion),w=Math.round(p.w),h=Math.round(p.h),head=y-h,hw=Math.round(w*.67),color=palettes[p.row][p.shade];
    if(dance){
      const hx=Math.round(x+dance.lean),hip=x+dance.hip;
      // Broad, angular, clothed silhouette shapes read as a goofy dance at 6 FPS.
      poly([[hx-w*.5,head+11],[hx-w*.7,head+17],[hip-w*.65,y+9],[hip+w*.65,y+9],[hx+w*.7,head+17],[hx+w*.5,head+11]],color);
      ctx.fillStyle=color;ctx.fillRect(Math.round(hx-hw/2),head,hw,12);
      ctx.fillRect(Math.round(hx-hw/2+1),head-2,Math.max(1,hw-2),2);
      if(p.hair===1)ctx.fillRect(Math.round(hx-hw/2-2),head+2,hw+4,10);
      if(p.hair===2)ctx.fillRect(hx-2,head-5,4,3);
      if(p.hair===3)ctx.fillRect(Math.round(hx-hw/2),head-3,hw+3,4);
      ctx.fillStyle=p.row<2?'#5b466d':'#4c385d';ctx.fillRect(Math.round(hx-hw/2),head+1,1,7);
      for(const side of [-1,1]){
        const linked=side===dance.partnerSide;
        ctx.strokeStyle=color;ctx.lineWidth=4+p.row*.35;ctx.beginPath();
        ctx.moveTo(hx+side*w*.48,head+17);
        ctx.lineTo(hx+side*w*.9,head+9-arm*.45);
        ctx.lineTo(linked?p.dance.center:hx+side*w*.9,linked?Math.round(p.base-30-4*Math.sin(musicFrame/CROWD_FPS*Math.PI*2)):head+4-arm);
        ctx.stroke();
      }
      continue;
    }
    poly([[x-w/2,head+11],[x-w*.78,head+17],[x-w*.65,y+10],[x+w*.65,y+10],[x+w*.78,head+17],[x+w/2,head+11]],color);
    ctx.fillStyle=color;ctx.fillRect(Math.round(x-hw/2),head,hw,12);ctx.fillRect(Math.round(x-hw/2+1),head-2,Math.max(1,hw-2),2);
    if(p.hair===1)ctx.fillRect(Math.round(x-hw/2-2),head+2,hw+4,11);
    if(p.hair===2)ctx.fillRect(x-2,head-5,4,3);
    if(p.hair===3)ctx.fillRect(Math.round(x-hw/2),head-3,hw+3,4);
    ctx.fillStyle=p.row<2?'#5b466d':'#4c385d';ctx.fillRect(Math.round(x-hw/2),head+1,1,7);
    for(let a=0;a<arms;a++){const side=a===0?-1:1;ctx.strokeStyle=color;ctx.lineWidth=4+p.row*.35;ctx.beginPath();ctx.moveTo(x+side*w*.48,head+17);ctx.lineTo(x+side*w*(emotion==='cheer'?1.05:.84),head+9-arm*.5);ctx.lineTo(x+side*w*.8,head+4-arm);ctx.stroke();}
  }
  // A solid shadow at the base anchors the silhouettes to the stands.
  ctx.fillStyle='#21192f';ctx.fillRect(0,height-13,width,13);
}
// A single quiet Easter egg behind the right-hand audience panel. The
// original photograph stays untouched; the derived cutout is a 30x76 pixel
// plum-palette version with muted eye detail and no outline or emissive material.
export const CROWD_CAT_YAW_LIMIT=32*Math.PI/180;
export const CROWD_CAT_YAW_WEIGHT=.65;
export const CROWD_CAT=Object.freeze({
  section:2, u:107/305, centerPixelY:43, height:44*4.3/180,
  width:(44*30/76)*4.3/180, setback:.19,
});
export function crowdCatAnchor(section=CROWD_SECTIONS[CROWD_CAT.section]) {
  const x=(CROWD_CAT.u-.5)*section.width;
  return {x:section.x+Math.cos(section.yaw)*x-Math.sin(section.yaw)*CROWD_CAT.setback,
    y:1.525+(.5-CROWD_CAT.centerPixelY/180)*4.3,
    z:section.z-Math.sin(section.yaw)*x-Math.cos(section.yaw)*CROWD_CAT.setback};
}
// Cylindrical billboarding: authored inward-facing normal plus a capped
// fraction of the eye bearing. Never copy camera pitch, roll or quaternion.
export function crowdCatFacing(eye,anchor,section=CROWD_SECTIONS[CROWD_CAT.section]) {
  if(!eye||![eye.x,eye.z].every(Number.isFinite))return null;
  const sin=Math.sin(section.yaw),cos=Math.cos(section.yaw);
  // The original panel is front-sided. Don't expose the cat from outside it.
  const inward=(eye.x-section.x)*sin+(eye.z-section.z)*cos;
  if(inward<=.025)return null;
  const dx=eye.x-anchor.x,dz=eye.z-anchor.z;
  const bearing=Math.atan2(dx*cos-dz*sin,dx*sin+dz*cos);
  const yaw=section.yaw+Math.max(-CROWD_CAT_YAW_LIMIT,Math.min(CROWD_CAT_YAW_LIMIT,bearing*CROWD_CAT_YAW_WEIGHT));
  if(dx*Math.sin(yaw)+dz*Math.cos(yaw)<=.025*Math.hypot(dx,dz))return null;
  return yaw;
}
export function createCrowdCat(THREE,group) {
  const section=CROWD_SECTIONS[CROWD_CAT.section],anchor=crowdCatAnchor(section);
  let ready=false,disposed=false,revealTex=null,revealReady=false;
  const tex=new THREE.TextureLoader().load(new URL('./assets/berries/smeemo-crowd.png?v=crowd-peek-20261127-v1',import.meta.url).href,
    ()=>{if(!disposed)ready=true;},undefined,()=>{ready=false;});
  tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(CROWD_CAT.width,CROWD_CAT.height),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.86,alphaTest:.001,depthTest:true,depthWrite:false,side:THREE.FrontSide,toneMapped:false,fog:false}));
  mesh.name='rg-audience-spectator';mesh.position.set(anchor.x,anchor.y,anchor.z);mesh.rotation.y=section.yaw;mesh.visible=false;
  // Draw behind the translucent silhouettes regardless of object-center sort.
  // The setback clears the panel at every allowed yaw; opaque scenery still
  // occludes it through the normal depth test. Normal state stays camouflaged; reveal deliberately draws in front of the translucent crowd.
  mesh.renderOrder=-1;group.add(mesh);
  return {mesh,update(frame,emotion,reduced,eye,dance){
    if(disposed)return;
    const yaw=crowdCatFacing(eye,anchor,section);
    mesh.visible=ready&&yaw!==null;
    if(!mesh.visible)return;
    mesh.rotation.y=yaw;
    const revealed=!!dance?.revealed;
    if(revealed&&!revealTex){revealTex=new THREE.TextureLoader().load(new URL('./assets/berries/smeemo_scramble.png',import.meta.url).href,()=>{if(!disposed)revealReady=true;},undefined,()=>{revealReady=false;});revealTex.magFilter=THREE.NearestFilter;revealTex.minFilter=THREE.NearestFilter;revealTex.generateMipmaps=false;revealTex.colorSpace=THREE.SRGBColorSpace;}
    const map=revealed&&revealReady?revealTex:tex;if(mesh.material.map!==map){mesh.material.map=map;mesh.material.needsUpdate=true;}
    const focused=!!dance?.focused&&!reduced&&!revealed&&Number.isFinite(dance?.time);
    mesh.material.opacity=revealed?1:dance?.focused ? .96 : .86;
    mesh.renderOrder=revealed?2:-1;
    mesh.position.y=anchor.y;
    mesh.matrixAutoUpdate=true;
    if(focused){const p=dancePose(dance.time,.78,0,dance.catIntensity),h=CROWD_CAT.height;
      mesh.updateMatrix();mesh.matrix.multiply(new THREE.Matrix4().set(p.width,p.shear,0,p.shear*h/2,0,1,0,0,0,0,1,0,0,0,0,1));mesh.matrixAutoUpdate=false;mesh.matrixWorldNeedsUpdate=true;}

  },dispose(){if(disposed)return;disposed=true;mesh.visible=false;group.remove(mesh);tex.dispose();revealTex?.dispose();mesh.geometry.dispose();mesh.material.dispose();}};
}
export function createAudienceRenderer(THREE,scene) {
  const group=new THREE.Group();group.name='rg-audience';scene.add(group);
  const panels=CROWD_SECTIONS.map(section=>{
    const canvas=document.createElement('canvas');canvas.width=Math.round(section.width*22);canvas.height=180;
    const ctx=canvas.getContext('2d'); const people=crowdPeople(canvas.width,section.seed);
    const mask=makeCrowdEdgeMask(ctx,canvas.width,section);
    const tex=new THREE.CanvasTexture(canvas);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(section.width,4.3),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.7,alphaTest:.001,depthWrite:false,side:THREE.FrontSide,toneMapped:false,fog:false}));
    mesh.position.set(section.x,1.525,section.z);mesh.rotation.y=section.yaw;group.add(mesh);
    return {ctx,canvas,people,tex,mesh,mask};
  });
  // A failed optional image load must never disable the procedural crowd.
  let cat=null;
  try { cat=createCrowdCat(THREE,group); } catch(error) { console.warn('Audience decoration unavailable',error); }
  let oldFrame=-1, oldEmotion='',oldMusicFrame=null;
  return {group,get cat(){return cat?.mesh;},dispose(){cat?.dispose();scene.remove(group);for(const p of panels){p.tex.dispose();p.mesh.geometry.dispose();p.mesh.material.dispose();}},update(time,emotion,reduced=false,eye,dance){
    if(!group.visible)return;
    const frame=reduced||dance?.quiet?0:Math.floor(time*CROWD_FPS/1000);
    // Orientation must follow every rendered camera frame, not the 6 FPS paint clock.
    cat?.update(frame,emotion,reduced,eye,dance);
    const musicFrame=emotion==='cheer'&&!reduced&&!dance?.quiet&&Number.isFinite(dance?.time)?Math.floor(dance.time*CROWD_FPS/1000):null;
    if(frame===oldFrame&&emotion===oldEmotion&&musicFrame===oldMusicFrame)return;
    oldFrame=frame;oldEmotion=emotion;oldMusicFrame=musicFrame;
    for(const p of panels){paintCrowd(p.ctx,p.canvas.width,p.canvas.height,p.people,frame,emotion,musicFrame);applyCrowdEdgeMask(p.ctx,p.canvas.width,p.canvas.height,p.mask);p.tex.needsUpdate=true;}
  }};
}
