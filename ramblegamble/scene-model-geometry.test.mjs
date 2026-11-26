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
