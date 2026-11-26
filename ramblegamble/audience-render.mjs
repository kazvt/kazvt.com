// Original low-resolution silhouette art, three world-space cutout texture panels.
// Only these canvases update at 6 fps; the rest of the scene renders normally.
export const CROWD_FPS=6;
export const CROWD_SECTIONS=Object.freeze([
  {x:7.5,z:13.4,width:18,yaw:Math.PI,seed:19},
  {x:-1.85,z:6.2,width:13.3,yaw:Math.PI/2,seed:31},
  {x:16.85,z:6.2,width:13.3,yaw:-Math.PI/2,seed:47},
]);
export function crowdPeople(width,seed) {
  let s=seed;const rand=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
  const people=[];
  for(let row=0;row<5;row++) for(let x=-4;x<width+10;x+=11+row*1.4) {
    people.push({row,x:x+rand()*6,base:60+row*23+rand()*4,w:7+row+rand()*4,h:18+row*2+rand()*7,phase:rand()*Math.PI*2,speed:.65+rand()*1.1,hair:Math.floor(rand()*4),type:rand(),shade:Math.floor(rand()*3)});
  }
  return people;
}
export function crowdPose(person,frame,emotion) {
  const t=frame/CROWD_FPS, p=person.phase, cheer=emotion==='cheer', shock=emotion==='shock', suspense=emotion==='suspense';
  const energy=cheer?1:suspense?.12:shock?.65:.36;
  const hop=cheer?Math.max(0,Math.sin(t*5*person.speed+p))*13:shock?Math.abs(Math.sin(t*3+p))*4:Math.sin(t*2.4*person.speed+p)*2;
  return {x:Math.round(person.x+Math.sin(t*2+p)*energy*(cheer?4:2)),y:Math.round(person.base-hop*energy),arm:cheer?10+Math.round((Math.sin(t*6*person.speed+p)+1)*7):shock?9:Math.round((Math.sin(t*2+p)+1)*3),arms:cheer?2:shock?1:suspense?0:person.type<.22?1:0};
}
export function paintCrowd(ctx,width,height,people,frame,emotion) {
  ctx.clearRect(0,0,width,height);
  const poly=(pts,color)=>{ctx.fillStyle=color;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
  const palettes=[['#473653','#40304e','#382940'],['#3d2d4c','#332541','#423051'],['#332541','#2c203b','#39294b'],['#291d37','#30223e','#352441'],['#21192f','#292039','#30233e']];
  for(const p of people) {
    const {x,y,arm,arms}=crowdPose(p,frame,emotion),w=Math.round(p.w),h=Math.round(p.h),head=y-h,hw=Math.round(w*.67),color=palettes[p.row][p.shade];
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
export function createAudienceRenderer(THREE,scene) {
  const group=new THREE.Group();group.name='rg-audience';scene.add(group);
  const panels=CROWD_SECTIONS.map(section=>{
    const canvas=document.createElement('canvas');canvas.width=Math.round(section.width*22);canvas.height=180;
    const ctx=canvas.getContext('2d'); const people=crowdPeople(canvas.width,section.seed);
    const tex=new THREE.CanvasTexture(canvas);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(section.width,4.3),new THREE.MeshBasicMaterial({map:tex,alphaTest:.5,side:THREE.FrontSide,toneMapped:false,fog:false}));
    mesh.position.set(section.x,1.525,section.z);mesh.rotation.y=section.yaw;group.add(mesh);
    return {ctx,canvas,people,tex,mesh};
  });
  let oldFrame=-1, oldEmotion='';
  return {group,dispose(){scene.remove(group);for(const p of panels){p.tex.dispose();p.mesh.geometry.dispose();p.mesh.material.dispose();}},update(time,emotion,reduced=false){if(!group.visible)return;const frame=reduced?0:Math.floor(time*CROWD_FPS/1000);if(frame===oldFrame&&emotion===oldEmotion)return;oldFrame=frame;oldEmotion=emotion;for(const p of panels){paintCrowd(p.ctx,p.canvas.width,p.canvas.height,p.people,frame,emotion);p.tex.needsUpdate=true;}}};
}
