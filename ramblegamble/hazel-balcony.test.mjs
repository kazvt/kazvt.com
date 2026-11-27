import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {HAZEL_SOURCE,HAZEL_LEDGE_Y,hazelBalconyPose,hazelCameraFrame} from './hazel-balcony.mjs';
import {characterCorners,characterYaw,projectCharacterQuad} from './character-billboards.mjs';
import {focusLimits,orbitPosition} from './focus-orbit.mjs';
import {characterArrowTarget,focusArrowPose} from './focus-arrow.mjs';
import {resolveArcadeShortcut,resolvePointClickBack} from './point-click-routing.js';
const source=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const xyz=p=>[p.x,p.y,p.z],obj=([x,y,z])=>({x,y,z});
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,n)=>a.map(x=>x*n);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a));
const d=JSON.parse(readFileSync(new URL('./assets/provided/rg_stage.gltf',import.meta.url),'utf8'));
const buffers=d.buffers.map(b=>Buffer.from(b.uri.split(',')[1],'base64'));
function accessor(i){const a=d.accessors[i],v=d.bufferViews[a.bufferView],buf=buffers[v.buffer],offset=(v.byteOffset||0)+(a.byteOffset||0),n={SCALAR:1,VEC3:3}[a.type],bytes={5126:4,5123:2,5125:4}[a.componentType],read={5126:'readFloatLE',5123:'readUInt16LE',5125:'readUInt32LE'}[a.componentType];return Array.from({length:a.count},(_,k)=>Array.from({length:n},(_,j)=>buf[read](offset+k*(v.byteStride||bytes*n)+j*bytes)));}
const node=d.nodes[0],q=node.rotation,u=q.slice(0,3);
const transform=v=>add(add(v,mul(add(mul(cross(u,v),q[3]),cross(u,cross(u,v))),2)),node.translation);
const triangles=d.meshes[node.mesh].primitives.flatMap(p=>{const vertices=accessor(p.attributes.POSITION).map(transform),indices=accessor(p.indices).flat();return Array.from({length:indices.length/3},(_,i)=>indices.slice(i*3,i*3+3).map(j=>vertices[j]));});
// Conservative double-sided ray test against the actual authored room mesh.
function blocked(eye,point){const dir=sub(point,eye);return triangles.some(([a,b,c])=>{const e1=sub(b,a),e2=sub(c,a),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)return false;const s=sub(eye,a),v=dot(s,h)/det;if(v<0||v>1)return false;const r=cross(s,e1),w=dot(dir,r)/det;if(w<0||v+w>1)return false;const t=dot(e2,r)/det;return t>1e-5&&t<.99999;});}
const near=(a,b,tol=1e-5)=>Math.abs(a-b)<tol;
const pose=hazelBalconyPose();
test('Hazel is anchored above the actual top die on the right/rear balcony, not a contestant seat',()=>{
 assert.equal(HAZEL_SOURCE.id,'hazel');assert.equal(HAZEL_SOURCE.source,'https://reactive.fugi.tech/basic/1130618562382413834');
 const ledge=triangles.filter(t=>t.every(v=>near(v[1],HAZEL_LEDGE_Y)));
 // The vertical line through the avatar center meets the real ledge top.
 const eye=[pose.anchor.x,HAZEL_LEDGE_Y+1,pose.anchor.z],point=[pose.anchor.x,HAZEL_LEDGE_Y-1,pose.anchor.z];
 assert.ok(ledge.some(t=>t.some(v=>near(v[0],15.5448)&&near(v[2],-4.8768))));assert.ok(blocked(eye,point));
 assert.ok(triangles.some(t=>t.every(v=>near(v[1],3.028))&&t.some(v=>near(v[0],15.0995,.0001)&&near(v[2],-5.0756,.0001))));
 assert.ok(near(pose.anchor.y-pose.worldHeight/2,HAZEL_LEDGE_Y-.24));
 assert.equal(pose.worldWidth,pose.worldHeight);
 assert.match(source,/setupHostBillboard\(\);\s*setupHazelBillboard\(\);/);
 assert.match(source,/billboards\.push\(hazelBillboard\)/);assert.doesNotMatch(source,/contestants\.push\(hazelBillboard\)/);
});

test('72 responsive orbit/framing cases keep the upper billboard, ledge and upper die face visible',()=>{
 const [yawCap,pitchCap]=focusLimits('hazel');
 for(const [width,height] of [[320,960],[360,640],[480,800],[640,480],[658,448],[1280,720],[1920,1080],[2560,720]])for(const yaw of [-yawCap,0,yawCap])for(const pitch of [-pitchCap,0,pitchCap]){
  const viewport={width,height},aspect=width/height,frame=hazelCameraFrame(pose,aspect,42,.1,yawCap,pitchCap),eye=orbitPosition(frame.position,frame.target,yaw,pitch),e=xyz(eye),target=xyz(frame.target),dir=unit(sub(e,target)),right=unit(cross([0,1,0],dir)),up=cross(dir,right),tan=Math.tan(42*Math.PI/360);
  const project=p=>{const r=sub(xyz(p),e),depth=-dot(r,dir);return {x:dot(r,right)/(depth*tan*aspect),y:dot(r,up)/(depth*tan),z:(320+.1)/(320-.1)-2*320*.1/((320-.1)*depth),depth};};
  const y=characterYaw(eye.x-pose.anchor.x,eye.z-pose.anchor.z),corners=characterCorners(pose.anchor,pose.worldWidth,pose.worldHeight,y);
  assert.ok(corners.every(p=>{const q=project(p);return Math.abs(q.x)<.80&&Math.abs(q.y)<.80&&q.depth>.1;}));
  // Upper and middle portions stay clear. Lower source sits behind ledge.
  for(const s of [-.35,0,.35])for(const h of [0,.25,.4]){const pt=add(xyz(pose.anchor),[s*pose.worldWidth*Math.cos(y),h*pose.worldHeight,-s*pose.worldWidth*Math.sin(y)]);assert.equal(blocked(e,pt),false,`${width}x${height} ${yaw} ${pitch}`);}
  assert.equal(blocked(e,[pose.anchor.x,pose.anchor.y-pose.worldHeight*.48,pose.anchor.z]),true);
  // Upper die front-face center is part of the shot; the top face itself is
  // naturally occluded by the balcony and need not be artificially exposed.
  const die=[15.55265,2.528,-4.86425],p=project(obj(die));assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1);assert.equal(blocked(e,die),false);
  const quad=projectCharacterQuad(pose,eye,project,viewport,.1);assert.ok(quad);
  const guest={panel:{style:{visibility:'visible'}},projectedQuad:quad};
  const targetArrow=characterArrowTarget(guest,viewport,{contains:()=>true});assert.ok(targetArrow);assert.ok(focusArrowPose(targetArrow,viewport));
 }
});

test('real shortcut handler focuses Hazel only when the room is ready and accepts the normal back navigation',()=>{
 const transitions=[];let callback,locked=false,dialog=false;
 class Element {closest(){return null;}}
 const ctx={Element,freecam:{active:false},diceModeOpen:false,gameStarted:true,pauseMenuOpen:false,sceneReady:true,hazelBillboard:{id:'hazel'},currentView:{kind:'overview'},resolveArcadeShortcut,document:{querySelector:()=>dialog?{}:null,documentElement:{hasAttribute:()=>locked}},window:{addEventListener:(type,fn)=>{callback=fn;}},transitionToView:view=>{transitions.push(view.kind);ctx.currentView=view;}};
 runInNewContext(section('  window.addEventListener("keydown", (event) => {','  window.addEventListener("rg:spin-wheel"'),ctx);
 const press=(opts={})=>{let prevented=false;callback({key:'8',target:new Element(),preventDefault:()=>prevented=true,...opts});return prevented;};
 assert.equal(press(),true);assert.deepEqual(transitions,['hazel']);assert.equal(resolvePointClickBack(ctx.currentView).kind,'overview');
 press({repeat:true});locked=true;press();locked=false;ctx.sceneReady=false;press();ctx.sceneReady=true;ctx.hazelBillboard=null;press();ctx.hazelBillboard={};dialog=true;press();dialog=false;ctx.freecam.active=true;press();ctx.freecam.active=false;ctx.diceModeOpen=true;press();ctx.diceModeOpen=false;press({ctrlKey:true});ctx.pauseMenuOpen=true;press();ctx.pauseMenuOpen=false;ctx.gameStarted=false;press();ctx.gameStarted=true;
 assert.deepEqual(transitions,['hazel','hazel']);
 const input=new Element();input.closest=()=>true;press({target:input});assert.deepEqual(transitions,['hazel','hazel']);
 press();assert.deepEqual(transitions,['hazel','hazel','hazel']);
});

test('balcony camera uses the authored pose even if the guest panel is absent',()=>{
 assert.match(source,/if \(view.kind === "hazel"\) \{/);
 assert.match(source,/hazelCameraFrame\(hazelBillboard \?\? hazelBalconyPose\(\),aspect/);
});
