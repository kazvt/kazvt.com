import test from 'node:test';
import assert from 'node:assert/strict';
import {curtainLayout,createCurtainProfile,curtainVertex,SLOT_CURTAIN_BAY} from './stage-curtain.mjs';
const bay=SLOT_CURTAIN_BAY,bounds={min:{x:10.564,y:0,z:-6.075},max:{x:13.058,y:2.52,z:-4.6135}},layout=curtainLayout(bounds),profile=createCurtainProfile(layout);
function sample(side,v,p,t){return Array.from({length:337},(_,i)=>curtainVertex(profile,side,i/336,v,p,t));}
function length(verts){return verts.slice(1).reduce((s,v,i)=>s+Math.hypot(v.x-verts[i].x,v.y-verts[i].y,v.z-verts[i].z),0);}
test('traveler gathers existing fabric instead of stretching it, while hem trails the track',()=>{
 const base=length(sample(-1,.5,0,0)),end=length(sample(-1,.5,1,0));assert.ok(Math.abs(base-end)/base<.04);assert.ok(profile.depth(1)>profile.depth(0)*2);
 for(const side of [-1,1])for(let k=0;k<=100;k++){const p=k/100;const top=curtainVertex(profile,side,1,0,p,420),hem=curtainVertex(profile,side,1,1,p,420);assert.ok(side*(top.x-hem.x)>=-1e-8);for(const v of [0,.5,1]){const row=sample(side,v,p,420);assert.ok(row.every(o=>Object.values(o).every(Number.isFinite)));assert.ok(Math.abs(length(row)-base)/base<.12);assert.ok(row.every((o,i)=>i===0||side*(o.x-row[i-1].x)<=1e-9));}}
});
test('closed panels overlap at the middle, return into jambs and reach floor and ceiling without a floating gap',()=>{
 for(let j=0;j<=18;j++){const v=j/18,left=curtainVertex(profile,-1,1,v,0,0),right=curtainVertex(profile,1,1,v,0,0);assert.ok(left.x-right.x>.20);assert.ok(Math.abs(left.z-right.z)<.024);for(const side of [-1,1]){const outer=curtainVertex(profile,side,0,v,0,0);assert.ok(layout.trackZ+outer.z<bay.frontZ);assert.ok(side===-1?layout.center+outer.x<bay.left:layout.center+outer.x>bay.right);}}
 for(const side of [-1,1])for(let i=0;i<=84;i++){const u=i/84;assert.ok(layout.bottom+curtainVertex(profile,side,u,1,0,0).y<=bay.bottom);assert.ok(layout.bottom+curtainVertex(profile,side,u,0,0,0).y>=bay.top);}
});
test('moving curtain retains fixed edges and finite bounded shading with ambient wind',()=>{
 for(const side of [-1,1])for(let k=0;k<=50;k++){const p=k/50;for(let j=0;j<=18;j++){const v=j/18,first=curtainVertex(profile,side,0,v,p,0),next=curtainVertex(profile,side,0,v,p,177);assert.deepEqual(first,next);for(let i=0;i<=84;i++){const a=curtainVertex(profile,side,i/84,v,p,149);assert.ok(a.shade>=.53&&a.shade<=.99);assert.ok(a.z>=-.053&&a.z<=.26);assert.ok(Math.abs(a.z-curtainVertex(profile,side,i/84,v,p,149,false).z)<=.044+1e-9);}}}
});

test('wind ripples both idle endpoints without changing any x/y, seam, track or clearance',()=>{
 for(const side of [-1,1])for(const p of [0,.2,.5,.8,1]){
  let max=0;for(let t=0;t<=12000;t+=271)for(let j=0;j<=18;j++)for(let i=0;i<=84;i+=2){
   const u=i/84,v=j/18,a=curtainVertex(profile,side,u,v,p,t),b=curtainVertex(profile,side,u,v,p,t,false);
   assert.equal(a.x,b.x);assert.equal(a.y,b.y);assert.ok(Math.abs(a.z-b.z)<=.044-.024*p+1e-9);
   if(i===0||i===84||j===0)assert.ok(Math.abs(a.z-b.z)<1e-12);
   if(p===0)assert.ok(layout.trackZ+a.z>bounds.max.z-layout.retract);
   if(p===1)assert.ok(side*(layout.center+a.x-(side<0?bounds.min.x:bounds.max.x))>.16);
   max=Math.max(max,Math.abs(a.z-b.z));
  }assert.ok(max>(p===1?.012:.02));
 }
});
