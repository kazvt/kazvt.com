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
 for(const [w,h] of [[803,395],[1014,576],[1920,1080],[360,640],[320,240],[2560,720],[575,480]]) for(const look of [-1,0,1]) for(const yaw of [-focusLimits('slot')[0],0,focusLimits('slot')[0]]) for(const pitch of [-focusLimits('slot')[1],0,focusLimits('slot')[1]]){
  const authored=basis(-.08-look*.42,.14),fit=fitSlotInteractionFrame(relative(points,target,authored),{width:w,height:h});
  const aim=add(add(target,mul(authored.right,fit.shiftX)),mul(authored.up,fit.shiftY));
  const b=basis(-.08-look*.42+yaw,Math.sin(Math.asin(.14)+pitch)),f={distance:fit.distance,shiftX:0,shiftY:0};
  const px=p=>{const [x,y]=project(relative([p],aim,b),f,w,h)[0];return {x:(x+1)*w/2,y:(1-y)*h/2};};
  const screenBottom=[px(wp(5,58,.065)),px(wp(75,58,.065))];
  const buttons=spinButtons.map(corners=>{const p=corners.map(px);return {left:Math.min(...p.map(v=>v.x)),right:Math.max(...p.map(v=>v.x)),top:Math.min(...p.map(v=>v.y))};});
  const edge=x=>screenBottom[0].y+(screenBottom[1].y-screenBottom[0].y)*(x-screenBottom[0].x)/(screenBottom[1].x-screenBottom[0].x);
  const arrows=Array.from({length:5},(_,index)=>{
   const x=5+(index+.5)*14,anchor=wp(x,65),a=px(anchor),adjX=px(wp(x+(index===4?-14:14),65)),adjY=px(wp(x,79));
   const depth=f.distance-relative([anchor],aim,b)[0].z;
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

test('closer roulette camera retains the entire supplied wheel across viewport sizes and look angles',()=>{
 const m=model('rg_roulette');
 const points=m.d.nodes.filter(n=>n.mesh!==undefined).flatMap(n=>{
  const index=m.d.nodes.indexOf(n), parent=m.d.nodes.find(p=>p.children?.includes(index));
  return nodePoints(m,n).map(p=>mul(add(rotateQuaternion(p,parent?.rotation),parent?.translation||[0,0,0]),.13));
 });
 const wheel=box(points),tan=Math.tan(42*Math.PI/360);
 const source=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 assert.match(source,/if \(view.kind === "roulette" && rouletteRig\) \{\s*bounds.setFromObject\(rouletteRig\);[^}]*return bounds.expandByScalar\(0\.06\)/);
 assert.match(source,/view.kind === "roulette" \? 1\.06 : 1\.18/);
 for(const [w,h] of [[1366,668],[803,395],[1920,1080],[360,640],[320,240],[2560,720]]) for(const look of [-1,0,1]){
  const b=basis(-.38-look*.42,.86),p=relative(points,wheel.center,b);
  const fit=(padding,scale)=>{
   const expanded=wheel.corners.map(p=>p.map((v,i)=>v+(v<wheel.center[i]?-padding:padding)));
   const corners=relative(expanded,wheel.center,b);
   const distance=Math.max(1,...corners.map(p=>Math.max(Math.abs(p.x)/(tan*w/h),Math.abs(p.y)/tan)+p.z))*scale;
   return {distance,shiftX:0,shiftY:0};
  };
  const old=project(p,fit(.38,1.18),w,h),updated=project(p,fit(.06,1.06),w,h);
  for(const [x,y,depth] of updated){assert.ok(depth>.1);assert.ok(Math.abs(x)<.98);assert.ok(Math.abs(y)<.98);}
  assert.ok(span(updated,1)>span(old,1)*1.12,`wheel should be noticeably larger at ${w}x${h}, look ${look}`);
  const [yawCap,pitchCap]=focusLimits('roulette');
  for(const yaw of [-yawCap,0,yawCap])for(const pitch of [-pitchCap,0,pitchCap]){
    const actual=basis(-.38-look*.42+yaw,Math.sin(Math.asin(.86)+pitch));
    for(const [x,y,depth] of project(relative(points,wheel.center,actual),fit(.06,1.06),w,h))
      assert.ok(depth>.1&&Math.abs(x)<1&&Math.abs(y)<1,`roulette ${w}x${h}, yaw ${yaw}, pitch ${pitch}: ${x},${y}`);
  }
 }
});

import { focusLimits, orbitPosition } from './focus-orbit.mjs';
test('capped presentation orbit keeps slot interaction geometry inside the viewport without a dolly',()=>{
 const {points}=slotGeometry(),target=box(points).center,b=basis(-.08,.14),[yawCap,pitchCap]=focusLimits('slot');
 const obj=([x,y,z])=>({x,y,z});
 for(const [w,h] of [[803,395],[1014,576],[1920,1080],[360,640],[320,240],[2560,720]]){
  const f=fitSlotInteractionFrame(relative(points,target,b),{width:w,height:h});
  const aim=add(add(target,mul(b.right,f.shiftX)),mul(b.up,f.shiftY)),base=add(aim,mul(b.dir,f.distance));
  for(const yaw of [-yawCap,yawCap])for(const pitch of [-pitchCap,pitchCap]){
   const p=orbitPosition(obj(base),obj(aim),yaw,pitch),offset=sub([p.x,p.y,p.z],aim),distance=Math.hypot(...offset);
   assert.ok(Math.abs(distance-f.distance)<1e-8);
   const actual=basis(Math.atan2(offset[0],offset[2]),offset[1]/distance);
   for(const [x,y,z] of project(relative(points,aim,actual),{distance,shiftX:0,shiftY:0},w,h))assert.ok(z>.1&&Math.abs(x)<1&&Math.abs(y)<1,`${w}x${h}: ${x},${y}`);
  }
 }
});

// Fit the actual upright world quad, including weighted yaw and perspective.
import { fitCharacterCloseup } from './arcade-framing.mjs';
import { standingCharacterPose, characterYaw, characterCorners, CHARACTER_YAW_LIMIT, CHARACTER_YAW_WEIGHT } from './character-billboards.mjs';
test('standing host and three contestants clear chairs and remain framed across every orbit extreme',()=>{
 const m=model('rg_stage'),root=m.d.nodes.find(n=>n.name==='chair'&&n.children);
 const entries=root.children.map(i=>m.d.nodes[i]).filter(n=>/^(chair|tall_chair)$/.test(n.name));
 const world=p=>add(p,root.translation);
 const host=entries.filter(n=>n.name==='chair').sort((a,b)=>box(nodePoints(m,b).map(world)).max[1]-box(nodePoints(m,a).map(world)).max[1])[0];
 const chairs=[host,...entries.filter(n=>n.name==='tall_chair')];assert.equal(chairs.length,4);
 const [maxYaw,maxPitch]=focusLimits('contestant');
 const xyz=([x,y,z])=>({x,y,z});const arr=({x,y,z})=>[x,y,z];
 for(const n of chairs){
  const chair=box(nodePoints(m,n).map(world));const isHost=n===host;
  const pose=standingCharacterPose({min:xyz(chair.min),max:xyz(chair.max)},isHost),anchor=arr(pose.anchor);
  assert.ok(pose.worldHeight>1.04*1.5);assert.ok(Math.abs(anchor[1]-pose.worldHeight/2-(isHost?.6096:.3048))<1e-9);
  for(const yaw of [-CHARACTER_YAW_LIMIT,0,CHARACTER_YAW_LIMIT]){
   const corners=characterCorners(pose.anchor,pose.worldWidth,pose.worldHeight,yaw);
   assert.ok(corners.every(p=>p.z>chair.max[2]));
   if(isHost)assert.ok(corners.every(p=>p.z< -4.572)); // raised host deck front edge
  }
  const relativeYaw=Math.max(...[-1,1].map(sign=>{const a=-.38+sign*maxYaw;return Math.abs(a-characterYaw(Math.sin(a),Math.cos(a)));}));
  for(const [w,h] of [[320,640],[390,844],[768,1024],[1366,668],[1920,1080],[2560,1080],[844,390]]){
   const distance=fitCharacterCloseup({...pose,aspect:w/h,pitchCap:maxPitch,relativeYaw});
   for(let j=0;j<=12;j++)for(let i=0;i<=20;i++){
    const yaw=-.38-maxYaw+2*maxYaw*j/12,pitch=-maxPitch+2*maxPitch*i/20,b=basis(yaw,Math.sin(Math.asin(.12)+pitch));
    const corners=characterCorners(pose.anchor,pose.worldWidth,pose.worldHeight,characterYaw(Math.sin(yaw),Math.cos(yaw))).map(arr);
    const points=project(relative(corners,anchor,b),{distance,shiftX:0,shiftY:0},w,h);
    assert.ok(points.every(p=>p[2]>.1&&Math.abs(p[1])<=.74+1e-9&&Math.abs(p[0])<=.76+1e-9),`${n.name} ${w}x${h}`);
    if(w/h>=1.5)assert.ok(span(points,1)/2>.54);
   }
  }
 }
 assert.ok(Math.abs(characterYaw(Math.sin(.2),Math.cos(.2))-.2*CHARACTER_YAW_WEIGHT)<1e-12);
 assert.equal(characterYaw(1,0),CHARACTER_YAW_LIMIT);
 const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 assert.match(js,/const target = character\.anchor\.clone\(\);/);
 assert.match(js,/distance = fitCharacterCloseup\(/);
});

import {cabinetPose} from './stage-show-state.mjs';
import { SLOT_CURTAIN_BAY, curtainLayout, createCurtainProfile, curtainVertex } from './stage-curtain.mjs';
test('the measured cabinet fits through the curtain opening and fully inside the deeper recess',()=>{
 const {cabinet}=slotGeometry(),bay=SLOT_CURTAIN_BAY,center=(bay.left+bay.right)/2;
 const w=cabinet.max[0]-cabinet.min[0],d=cabinet.max[2]-cabinet.min[2],floor=0;
 const bounds={min:{x:center-w/2,y:floor,z:-6.10+.025},max:{x:center+w/2,y:floor+2.52,z:-6.10+.025+d}};
 const layout=curtainLayout(bounds),profile=createCurtainProfile(layout);
 assert.ok(bounds.min.z-layout.retract>bay.backZ+.04);assert.ok(bounds.max.z-layout.retract<bay.frontZ-.1);
 // At every progress where the cabinet moves the fabric is fully open,
 // including its weighted hem. During opening/closing the cabinet is backstage.
 for(let i=0;i<=1000;i++){
  const p=cabinetPose(i/1000);assert.ok(p.travel>=0&&p.travel<=1&&p.curtain>=p.travel);
  if(p.travel>0){assert.equal(p.curtain,1);for(let j=0;j<=18;j++){
   const left=layout.center+curtainVertex(profile,-1,1,j/18,1,0).x,right=layout.center+curtainVertex(profile,1,1,j/18,1,0).x;
   assert.ok(left<bounds.min.x-.16&&right>bounds.max.x+.16);
  }}else assert.ok(bounds.max.z-layout.retract<bay.frontZ);
 }
 const m=model('rg_stage'),stage=nodePoints(m,m.d.nodes[0]);
 for(const x of [bay.left,bay.right])for(const y of [0,bay.top])for(const z of [bay.frontZ,bay.backZ])assert.ok(stage.some(p=>Math.hypot(p[0]-x,p[1]-y,p[2]-z)<.002),`bay vertex ${x},${y},${z}`);
 // Verify a real floor triangle reaches the rear of the recess and the floor
 // covers both sides of the full cabinet footprint; do not rely on AABB alone.
 const n=m.d.nodes[0],floorTris=[];for(const prim of m.d.meshes[n.mesh].primitives){const points=m.values(prim.attributes.POSITION).map(v=>add(rotateQuaternion(v,n.rotation),n.translation)),ids=m.values(prim.indices).flat();for(let i=0;i<ids.length;i+=3){const tri=ids.slice(i,i+3).map(j=>points[j]);if(tri.every(v=>Math.abs(v[1])<.002)&&tri.some(v=>v[2]<bay.backZ+.002))floorTris.push(tri);}}
 function inside(x,z,t){const a=t.map(([xx,,zz])=>[xx,zz]);const signs=a.map((v,i)=>{const b=a[(i+1)%3];return (b[0]-v[0])*(z-v[1])-(b[1]-v[1])*(x-v[0]);});return signs.every(v=>v>=-1e-6)||signs.every(v=>v<=1e-6);}
 for(const x of [bounds.min.x,center,bounds.max.x])for(const z of [bounds.min.z-layout.retract,bounds.max.z-layout.retract])assert.ok(floorTris.some(t=>inside(x,z,t)),`floor supports ${x},${z}`);
});

test('roulette base and outer rim rest on the actual exterior floor without submerging the pocket surface',()=>{
 const stage=model('rg_stage'),wheel=model('rg_roulette');
 const exterior=stage.d.nodes[0];
 const floorY=-.625;
 const ground=nodePoints(stage,exterior).filter(p=>Math.abs(p[1]-floorY)<1e-5);
 assert.ok(ground.some(p=>p[0]<11.811&&p[2]<-1.3716));
 assert.ok(ground.some(p=>p[0]>11.811&&p[2]>4));
 const rim=wheel.d.nodes.find(n=>n.name==='rim');
 const pivot=wheel.d.nodes.find(n=>n.name==='wheel'&&n.children);
 const moving=wheel.d.nodes.find(n=>n.name==='wheel'&&n.mesh!==undefined);
 const rimY=box(nodePoints(wheel,rim)).min[1];
 const wheelY=box(nodePoints(wheel,moving)).min[1]+pivot.translation[1];
 assert.ok(Math.abs(rimY-wheelY)<1e-6,'outer rim underside meets the rotating assembly base');
 const scale=.13,rigY=floorY-scale*Math.min(rimY,wheelY);
 assert.ok(Math.abs(rigY+rimY*scale-floorY)<1e-7);
 // Even at the lowest existing visual wheel wobble, the pocket remains above ground.
 assert.ok(rigY+(pivot.translation[1]+1.1-.055)*scale>floorY);
 const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
 assert.match(js,/rouletteRig\.position\.set\(\s*recess\.x - rouletteLocalCenter\.x,\s*EXTERIOR_FLOOR\.y - rouletteLocalBounds\.min\.y,\s*recess\.z - rouletteLocalCenter\.z/);
 assert.match(js,/slotRig\.position\.set\(\s*slotTargetCenter\.x - slotCenter\.x,\s*floorY - slotBounds\.min\.y/);
 assert.match(js,/rg_roulette\.gltf\?v=roulette-ground-20261127-v1/);
});


import { sampleCabinetPose, fitCabinetPose } from './slot-cabinet-fx.mjs';
test('actual cabinet motion stays inside the authored bay and above the floor, including reel-brake kicks',()=>{
 const {cabinet}=slotGeometry(), width=cabinet.max[0]-cabinet.min[0],height=cabinet.max[1]-cabinet.min[1],bayWidth=14.48-9.14;
 let highest=0,lean=0;
 for(const kind of ['crank','press','tap','win','loss'])for(let t=0;t<=2400;t+=9){
  const p=fitCabinetPose(sampleCabinetPose(kind,t,{rolling:kind==='crank'||kind==='press',brakeAge:t%120}),{width,height,bayWidth});
  highest=Math.max(highest,p.y);lean=Math.max(lean,Math.abs(p.roll));
  for(const x of [-width/2,width/2])for(const y of [0,height]){
   const xx=p.x+x*p.sx*Math.cos(p.roll)-y*p.sy*Math.sin(p.roll), yy=p.y+x*p.sx*Math.sin(p.roll)+y*p.sy*Math.cos(p.roll);
   assert.ok(Math.abs(xx)<=bayWidth/2-.0349999);assert.ok(Math.abs(xx)<=3.81/2-.035);assert.ok(yy>=-1e-9);assert.ok(yy<=3.000001);
  }
 }
 assert.ok(highest>.34&&highest<.44);assert.ok(lean>.03&&lean<.06);
});
test('moving cabinet keeps actual controls and reel corners in the viewport across sizes and focus orbit angles',()=>{
 const {points,cabinet,wp,spinButtons}=slotGeometry(),target=box(points).center;
 const pivot=[cabinet.center[0],cabinet.min[1],cabinet.center[2]],width=cabinet.max[0]-cabinet.min[0],height=cabinet.max[1]-cabinet.min[1];
 const samples=[...Array.from({length:73},(_,i)=>['crank',i*15]),['crank',235],['press',180],['win',285],['win',470],['loss',220],['loss',355],['crank',1720]];
 for(const [w,h] of [[803,395],[1014,576],[1920,1080],[360,640],[320,240],[2560,720],[575,480],[3840,2160],[1440,2560],[1280,800]])for(const look of [-1,0,1])for(const yaw of [-focusLimits('slot')[0],0,focusLimits('slot')[0]])for(const pitch of [-focusLimits('slot')[1],0,focusLimits('slot')[1]]){
  const authored=basis(-.08-look*.42,.14),fit=fitSlotInteractionFrame(relative(points,target,authored),{width:w,height:h,cabinetMotion:true});
  const aim=add(add(target,mul(authored.right,fit.shiftX)),mul(authored.up,fit.shiftY));
  const b=basis(-.08-look*.42+yaw,Math.sin(Math.asin(.14)+pitch)),f={distance:fit.distance,shiftX:0,shiftY:0};
  for(const [kind,t] of samples){
   const pose=fitCabinetPose(sampleCabinetPose(kind,t,{rolling:kind==='crank'||kind==='press'}),{width,height,bayWidth:5.34});
   const move=v=>{const [x,y,z]=sub(v,pivot),c=Math.cos(pose.roll),s=Math.sin(pose.roll);return add(pivot,[-pose.x+x*pose.sx*c+y*pose.sy*s,pose.y-x*pose.sx*s+y*pose.sy*c,z]);};
   for(const [x,y,d] of project(relative(points.map(move),aim,b),f,w,h))assert.ok(d>.1&&Math.abs(x)<=1&&Math.abs(y)<=1,`${w}x${h} ${kind} ${t}: ${x},${y}`);
   const px=v=>{const [x,y]=project(relative([v],aim,b),f,w,h)[0];return {x:(x+1)*w/2,y:(1-y)*h/2};};
   const screenBottom=[px(move(wp(5,58,.065))),px(move(wp(75,58,.065)))];
   const buttons=spinButtons.map(corners=>{const p=box(corners.map(move)).corners.map(px);return {left:Math.min(...p.map(v=>v.x)),right:Math.max(...p.map(v=>v.x)),top:Math.min(...p.map(v=>v.y))};});
   for(let i=0;i<5;i++){
    const x=5+(i+.5)*14,a=px(move(wp(x,65))),ax=px(move(wp(x+(i===4?-14:14),65))),ay=px(move(wp(x,79)));
    const depth=f.distance-relative([move(wp(x,65))],aim,b)[0].z;
    const ww=Math.hypot(...sub(wp(x-14*.32,65),wp(x+14*.32,65))),wh=Math.hypot(...sub(wp(x,65-14*.27),wp(x,65+14*.27)));
    const preferred=Math.min(Math.max(22,Math.min(ww,wh)*h/(2*Math.tan(42*Math.PI/360))/depth),Math.hypot(a.x-ax.x,a.y-ax.y)*.9,Math.hypot(a.x-ay.x,a.y-ay.y)*.9);
    const placement=fitSlotColumnArrow({x:px(move(wp(x,58,.065))).x,size:preferred,screenBottom,spinButtons:buttons,index:i});
    assert.ok(placement,`moving arrow ${i} ${kind} at ${w}x${h}`);
    assert.ok(placement.y+placement.size/2<=buttons[i].top-6+1e-6);
   }

  }
 }
});

import {TRIM_PATHS} from './room-light-trim.mjs';
test('architectural pixel trim is supported by authored stage ledges',()=>{
 const m=model('rg_stage'),n=m.d.nodes[0],triangles=[];
 for(const p of m.d.meshes[n.mesh].primitives){const points=m.values(p.attributes.POSITION).map(v=>add(rotateQuaternion(v,n.rotation),n.translation||[0,0,0]));const indices=m.values(p.indices).flat();for(let i=0;i<indices.length;i+=3)triangles.push(indices.slice(i,i+3).map(j=>points[j]));}
 const contains=(p,t)=>{if(!t.every(v=>Math.abs(v[1]-p[1])<.0002))return false;const [a,b,c]=t.map(v=>[v[0],v[2]]),q=[p[0],p[2]],u=sub(b,a),v=sub(c,a),w=sub(q,a),det=u[0]*v[1]-u[1]*v[0];if(Math.abs(det)<1e-10)return false;const s=(w[0]*v[1]-w[1]*v[0])/det,r=(u[0]*w[1]-u[1]*w[0])/det;return s>=-.0001&&r>=-.0001&&s+r<=1.0001;};
 for(const path of TRIM_PATHS)for(let i=0;i<path.count;i++){const p=add(path.a,mul(sub(path.b,path.a),(i+.5)/path.count));assert.ok(triangles.some(t=>contains(p,t)),`Unsupported trim at ${p}`);}
});
