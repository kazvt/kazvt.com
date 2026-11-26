import test from 'node:test';
import assert from 'node:assert/strict';
import {characterYaw,characterCorners,pointInCharacterQuad,projectCharacterQuad,CHARACTER_YAW_LIMIT,CHARACTER_YAW_WEIGHT} from './character-billboards.mjs';

test('horizontal character tracking is fractional, bounded, and upright',()=>{
 for(let i=-180;i<=180;i++){
  const a=i*Math.PI/180,yaw=characterYaw(Math.sin(a),Math.cos(a));
  assert.ok(Math.abs(yaw)<=CHARACTER_YAW_LIMIT);
  if(Math.abs(a)*CHARACTER_YAW_WEIGHT<CHARACTER_YAW_LIMIT)assert.ok(Math.abs(yaw-a*CHARACTER_YAW_WEIGHT)<1e-12);
  const corners=characterCorners({x:1,y:2,z:3},1.8,1.8,yaw);
  assert.equal(corners[0].x,corners[3].x);assert.equal(corners[0].z,corners[3].z);
  assert.equal(corners[1].x,corners[2].x);assert.equal(corners[1].z,corners[2].z);
 }
 assert.equal(characterYaw(0,0),0);assert.equal(characterYaw(NaN,1),0);
});
test('projected quads reject near-plane crossings, rear views and off-screen artwork',()=>{
 const pose={anchor:{x:0,y:0,z:0},worldWidth:1.8,worldHeight:1.8};
 const eye={x:0,y:0,z:3},viewport={width:800,height:600};
 const project=p=>({x:p.x/(3-p.z),y:p.y/(3-p.z),z:.5,depth:3-p.z});
 const q=projectCharacterQuad(pose,eye,project,viewport,.1);assert.ok(q);assert.ok(pointInCharacterQuad(q.corners,400,300));assert.equal(pointInCharacterQuad(q.corners,0,0),false);
 assert.equal(projectCharacterQuad(pose,{...eye,z:-3},project,viewport,.1),null);
 assert.equal(projectCharacterQuad(pose,eye,p=>({...project(p),depth:.05}),viewport,.1),null);
 assert.equal(projectCharacterQuad(pose,eye,p=>({...project(p),x:3}),viewport,.1),null);
 assert.equal(projectCharacterQuad(pose,eye,p=>({...project(p),x:NaN}),viewport,.1),null);
 assert.equal(pointInCharacterQuad([{x:0,y:0},{x:10,y:5},{x:8,y:10},{x:2,y:8}],0,10),false);
});
