import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROULETTE_BALL_LANDING_RADIUS, ROULETTE_BALL_LANDING_HEIGHT, ROULETTE_BALL_GEOMETRY_RADIUS, ROULETTE_POCKET_COUNT } from './roulette-ball-motion.mjs';
function model(name) {const d=JSON.parse(readFileSync(new URL(`./assets/provided/${name}.gltf`,import.meta.url),'utf8'));const buffers=d.buffers.map(b=>Buffer.from(b.uri.split(',')[1],'base64'));return {d,values(index){const a=d.accessors[index],v=d.bufferViews[a.bufferView],buf=buffers[v.buffer],offset=(v.byteOffset||0)+(a.byteOffset||0),n={SCALAR:1,VEC2:2,VEC3:3}[a.type],bytes={5126:4,5123:2,5125:4}[a.componentType],read={5126:'readFloatLE',5123:'readUInt16LE',5125:'readUInt32LE'}[a.componentType];return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>buf[read](offset+i*(v.byteStride||bytes*n)+j*bytes)));}}}
test('roulette landing fits the supplied model pocket floor and width, not the adjacent pink ring',()=>{
 const {d,values}=model('rg_roulette');const wheel=d.nodes.find(n=>n.name==='wheel'&&n.mesh!==undefined);const pivot=d.nodes.find(n=>n.name==='wheel'&&n.children);const ballPivot=d.nodes.find(n=>n.name==='ball'&&n.children);
 const floor=[];for(const p of d.meshes[wheel.mesh].primitives){const points=values(p.attributes.POSITION),indices=values(p.indices).flat();for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3).map(j=>points[j]);if(tri.every(v=>Math.abs(v[1]-1.1)<1e-5))floor.push(tri);}}
 assert.equal(floor.length,ROULETTE_POCKET_COUNT*2);
 const radii=floor.flat().map(([x,y,z])=>Math.hypot(x,z));assert.ok(ROULETTE_BALL_LANDING_RADIUS-ROULETTE_BALL_GEOMETRY_RADIUS>Math.min(...radii));assert.ok(ROULETTE_BALL_LANDING_RADIUS+ROULETTE_BALL_GEOMETRY_RADIUS<Math.max(...radii)*Math.cos(Math.PI/ROULETTE_POCKET_COUNT));
 assert.ok(ROULETTE_BALL_LANDING_RADIUS*Math.sin(Math.PI/ROULETTE_POCKET_COUNT)>ROULETTE_BALL_GEOMETRY_RADIUS);
 assert.ok(Math.abs(ballPivot.translation[1]+ROULETTE_BALL_LANDING_HEIGHT-ROULETTE_BALL_GEOMETRY_RADIUS-(pivot.translation[1]+1.1))<1e-6);
});
test('positive local X crank rotation moves the authored upper handle toward the room camera',()=>{
 const {d,values}=model('rg_slots');const arm=d.nodes.find(n=>n.name==='arm');const verts=d.meshes[arm.mesh].primitives.flatMap(p=>values(p.attributes.POSITION));const top=verts.filter(v=>v[1]>6);const center=top.reduce((a,v)=>a.map((x,i)=>x+v[i]/top.length),[0,0,0]);
 const yaw=2*Math.atan2(arm.rotation[1],arm.rotation[3])+Math.PI;const worldZ=v=>-Math.sin(yaw)*v[0]+Math.cos(yaw)*v[2];const angle=.92;const moved=[center[0],center[1]*Math.cos(angle)-center[2]*Math.sin(angle),center[1]*Math.sin(angle)+center[2]*Math.cos(angle)];assert.ok(worldZ(moved)>worldZ(center));
 const source=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');assert.match(source,/lever\.rotateX\(Math\.sin\(progress \* Math\.PI\) \* 0\.92\)/);
});

import { fitSlotInteractionFrame, fitSlotColumnArrow, rouletteRecessCenter, ROULETTE_RECESS } from './arcade-framing.mjs';
import { slotScreenPoint } from './slot-reels.mjs';
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,n)=>a.map(x=>x*n);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/Math.hypot(...a));
function rotateQuaternion(v,q=[0,0,0,1]) {const u=q.slice(0,3);return add(v,mul(add(mul(cross(u,v),q[3]),cross(u,cross(u,v))),2));}
function nodePoints(m,n){return m.d.meshes[n.mesh].primitives.flatMap(p=>m.values(p.attributes.POSITION)).map(v=>add(rotateQuaternion(v,n.rotation),n.translation||[0,0,0]));}
function box(points){const min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));return {min,max,center:mul(add(min,max),.5),corners:[min[0],max[0]].flatMap(x=>[min[1],max[1]].flatMap(y=>[min[2],max[2]].map(z=>[x,y,z])))};}
function basis(yaw,elevation){const h=Math.sqrt(1-elevation**2),dir=[Math.sin(yaw)*h,elevation,Math.cos(yaw)*h],right=unit(cross([0,1,0],dir)),up=unit(cross(dir,right));return {dir,right,up};}
function relative(points,target,{dir,right,up}){return points.map(p=>{const r=sub(p,target);return {x:dot(r,right),y:dot(r,up),z:dot(r,dir)};});}
function project(points,frame,width,height){const tan=Math.tan(42*Math.PI/360);return points.map(p=>[(p.x-frame.shiftX)/(tan*width/height*(frame.distance-p.z)),(p.y-frame.shiftY)/(tan*(frame.distance-p.z)),frame.distance-p.z]);}
function span(points,i){return Math.max(...points.map(p=>p[i]))-Math.min(...points.map(p=>p[i]));}
function slotGeometry(){
 const m=model('rg_slots'), nodes=m.d.nodes.filter(n=>n.mesh!==undefined);
 const local=nodes.flatMap(n=>nodePoints(m,n)), all=box(local), scale=2.52/(all.max[1]-all.min[1]);
 const world=p=>[-p[0]*scale*1.08,p[1]*scale,-p[2]*scale];
 const wp=(x,y,depth=.16)=>{const p=slotScreenPoint(x,y,depth);return world([p.x,p.y,p.z]);};
 const screen=[wp(5,16),wp(5,58),wp(75,16),wp(75,58)],points=[...screen];
 for(const [x,y] of [...Array.from({length:5},(_,i)=>[5+(i+.5)*14,65]),...Array.from({length:3},(_,i)=>[-2,16+(i+.5)*14])]){
  const anchor=wp(x,y),width=Math.hypot(...sub(wp(x-14*.32,y),wp(x+14*.32,y))),height=Math.hypot(...sub(wp(x,y-14*.27),wp(x,y+14*.27))),half=Math.max(width,height)*.6;
  for(const a of [-half,half])for(const b of [-half,half])for(const c of [-half,half])points.push(add(anchor,[a,b,c]));
 }
 for(const n of nodes.filter(n=>/^(arm|button[1-5])$/.test(n.name)))points.push(...box(nodePoints(m,n).map(world)).corners);
 return {points,screen,wp,spinButtons: nodes.filter(n=>/^button[1-5]$/.test(n.name)).sort((a,b)=>a.name.localeCompare(b.name)).map(n=>box(nodePoints(m,n).map(world)).corners),cabinet:box(local.map(world))};
}
test('roulette world center is the authored recess midpoint with clearance from both sloping shoulders and lower lip',()=>{
 const m=model('rg_stage'),stage=nodePoints(m,m.d.nodes[0]);
 const vertices=[[8.5086,-.4572],[10.0326,-1.3716],[13.5894,-1.3716],[15.1134,-.4572]];
 for(const [x,z] of vertices) assert.ok(stage.some(p=>Math.hypot(p[0]-x,p[2]-z)<.0001),'measured lower lip vertex');
 const r=model('rg_roulette'),rim=r.d.nodes.find(n=>n.name==='rim');const rimBox=box(nodePoints(r,rim));
 const radius=Math.max(rimBox.max[0]-rimBox.min[0],rimBox.max[2]-rimBox.min[2])*.13/2;
 const c=rouletteRecessCenter(radius);assert.ok(Math.abs(c.x-11.811)<1e-9);assert.ok(c.z<1.5);assert.ok(Math.abs(c.z-radius-ROULETTE_RECESS.frontZ-ROULETTE_RECESS.clearance)<1e-9);
 for(let i=1;i<vertices.length;i++){const a=vertices[i-1],b=vertices[i],p=[c.x,c.z],ab=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),ab)/dot(ab,ab)));assert.ok(Math.hypot(...sub(p,add(a,mul(ab,t))))>=radius+ROULETTE_RECESS.clearance-1e-8);}
 const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');assert.match(js,/rouletteRecessCenter\(radius\)/);assert.doesNotMatch(js,/moveRouletteToMarkedFloorSpot|rouletteScreenAnchor/);
});
test('slot frame fits actual screen, arrows, physical buttons and resting crank for desktop, narrow and portrait views',()=>{
 const {points,screen,cabinet}=slotGeometry(),target=box(points).center;
 for(const [w,h] of [[803,395],[1014,576],[1920,1080],[360,640],[320,240],[2560,720]]) for(const look of [-1,0,1]){
  const b=basis(-.08-look*.42,.14),p=relative(points,target,b),f=fitSlotInteractionFrame(p,{width:w,height:h});const projected=project(p,f,w,h);
  for(const [x,y,depth] of projected){assert.ok(depth>.1);assert.ok(x>=f.limits.xMin-1e-8&&x<=f.limits.xMax+1e-8);assert.ok(y>=f.limits.yMin-1e-8&&y<=f.limits.yMax+1e-8);}
  if(look===0&&w/h>1.5&&h>=395){
   const oldBasis=basis(-.38,.24),oldTarget=cabinet.center,oldCorners=cabinet.corners.map(p=>p.map((v,i)=>v+(v<oldTarget[i]?-.35:.35))),oldP=relative(oldCorners,oldTarget,oldBasis),tan=Math.tan(42*Math.PI/360);
   const oldDistance=Math.max(1,...oldP.map(p=>Math.max(Math.abs(p.x)/(tan*w/h),Math.abs(p.y)/tan)+p.z))*1.18;
   const oldScreen=project(relative(screen,oldTarget,oldBasis),{distance:oldDistance,shiftX:0,shiftY:0},w,h),newScreen=project(relative(screen,target,b),f,w,h);
   assert.ok(span(newScreen,1)>span(oldScreen,1)*1.25,`screen height at ${w}x${h}: ${span(newScreen,1)/span(oldScreen,1)}`);
  }
 }
 const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');assert.match(js,/setupPicking\(\);\s+captureSlotFocusPoints\(\)/);assert.match(js,/fitSlotInteractionFrame\(points/);
});


test('all five bottom arrows stay aligned between the actual reel and spin buttons at all slot camera angles',()=>{
 const {points,wp,spinButtons}=slotGeometry(),target=box(points).center;
 for(const [w,h] of [[803,395],[1014,576],[1920,1080],[360,640],[320,240],[2560,720],[575,480]]) for(const look of [-1,0,1]){
  const b=basis(-.08-look*.42,.14),f=fitSlotInteractionFrame(relative(points,target,b),{width:w,height:h});
  const px=p=>{const [x,y]=project(relative([p],target,b),f,w,h)[0];return {x:(x+1)*w/2,y:(1-y)*h/2};};
  const screenBottom=[px(wp(5,58,.065)),px(wp(75,58,.065))];
  const buttons=spinButtons.map(corners=>{const p=corners.map(px);return {left:Math.min(...p.map(v=>v.x)),right:Math.max(...p.map(v=>v.x)),top:Math.min(...p.map(v=>v.y))};});
  const edge=x=>screenBottom[0].y+(screenBottom[1].y-screenBottom[0].y)*(x-screenBottom[0].x)/(screenBottom[1].x-screenBottom[0].x);
  const arrows=Array.from({length:5},(_,index)=>{
   const x=5+(index+.5)*14,anchor=wp(x,65),a=px(anchor),adjX=px(wp(x+(index===4?-14:14),65)),adjY=px(wp(x,79));
   const depth=f.distance-relative([anchor],target,b)[0].z;
   const ww=Math.hypot(...sub(wp(x-14*.32,65),wp(x+14*.32,65))),wh=Math.hypot(...sub(wp(x,65-14*.27),wp(x,65+14*.27)));
   const preferred=Math.min(Math.max(22,Math.min(ww,wh)*h/(2*Math.tan(42*Math.PI/360))/depth),Math.hypot(a.x-adjX.x,a.y-adjX.y)*.9,Math.hypot(a.x-adjY.x,a.y-adjY.y)*.9);
   const placement=fitSlotColumnArrow({x:px(wp(x,58,.065)).x,size:preferred,screenBottom,spinButtons:buttons,index});
   assert.ok(placement,`arrow ${index} visible at ${w}x${h} look ${look}`);
   const {x:cx,y,size}=placement, half=size/2;
   assert.ok(size >= (h <= 240 ? 3 : 8), `visible arrow ${size} at ${w}x${h} look ${look}`);
   assert.ok(y-half>=Math.max(edge(cx-half),edge(cx+half))+3-1e-6);
   assert.ok(y+half<=buttons[index].top-6+1e-6);
   for(const button of buttons) if(cx+half>=button.left-5&&cx-half<=button.right+5) assert.ok(y+half<=button.top-6+1e-6);
   assert.ok(cx-half>=0&&cx+half<=w&&y-half>=0&&y+half<=h);
   return placement;
  });
  for(let i=1;i<arrows.length;i++) assert.ok(arrows[i].x-arrows[i].size/2>arrows[i-1].x+arrows[i-1].size/2);
 }
 const source=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 assert.match(source,/y: bottom \+ cellHeight \* 0\.5/);
 assert.match(source,/fitSlotColumnArrow\(\{ x: toScreen/);
});
