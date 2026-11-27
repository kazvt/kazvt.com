import test from 'node:test';
import assert from 'node:assert/strict';
import { DICE_DOOR_OPENING as door } from './dice-doorway.mjs';
import { VIP_ZONE, portalDistance, sampleVipAmbience, portalParticleSeed, samplePortalParticle, PORTAL_PARTICLE_COUNT } from './vip-atmosphere.mjs';
const position=(d,y=1,z=(door.minZ+door.maxZ)/2)=>({x:door.wallX-d,y,z});
test('VIP sound zone reaches absolute silence near the real aperture, not the entire wall',()=>{
 assert.equal(portalDistance(position(0),door),0);
 assert.equal(sampleVipAmbience(position(0),door).room,0);
 assert.equal(sampleVipAmbience(position(3.5),door).room,0);
 assert.equal(sampleVipAmbience(position(6.3),door).room,1);
 assert.equal(sampleVipAmbience(position(0,9),door).water,0);
 assert.equal(sampleVipAmbience(position(0,1,8),door).room,1);
 assert.equal(sampleVipAmbience(null,door).room,1);
 let last=0;for(let d=0;d<8;d+=.01){const mix=sampleVipAmbience(position(d),door);assert.ok(mix.room>=last&&mix.room<=1);assert.ok(mix.water>=0&&mix.water<=VIP_ZONE.outsideDrip);last=mix.room;}
});
test('modal state and authored doorway framing reliably mute crowd, even for portrait views',()=>{
 assert.deepEqual(sampleVipAmbience(position(100),door,{inside:true}),{room:0,water:1,cutoff:3400});
 assert.deepEqual(sampleVipAmbience(position(100),door,{focused:true}),{room:0,water:.64,cutoff:null});
 assert.equal(sampleVipAmbience(position(100),door).water,0);
});
test('every particle starts within aperture, travels toward room, and resets invisibly',()=>{
 for(let i=0;i<PORTAL_PARTICLE_COUNT;i++){
  const seed=portalParticleSeed(i),start=-seed.phase*seed.life;
  let previous=Infinity;
  for(let j=0;j<100;j++){const p=(j+.000001)/100,s=samplePortalParticle(seed,start+p*seed.life,door);assert.ok(Object.values(s).every(Number.isFinite));assert.ok(s.x<door.wallX&&s.x<=previous+1e-9);assert.ok(s.size>=0&&s.size<=.05);previous=s.x;if(j===0){assert.ok(s.size<1e-9);assert.ok(s.y>=door.minY&&s.y<=door.maxY);assert.ok(s.z>=door.minZ&&s.z<=door.maxZ);}}
  assert.ok(samplePortalParticle(seed,start+seed.life-1e-6,door).size<1e-8);
 }
});
