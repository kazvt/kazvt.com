import test from 'node:test';
import assert from 'node:assert/strict';
import { DICE_DOOR_OPENING } from './dice-doorway.mjs';

import { crowdCatAnchor } from './audience-render.mjs';
import { crowdCloseupPose } from './spooky-camera.mjs';
import { sampleMusicZoneGain, sampleSmeemoMusicGain, createVipInteriorTracker, MUSIC_ZONE } from './music-zones.mjs';

const cat = crowdCatAnchor();
const nearDoor = (x, y=(DICE_DOOR_OPENING.minY+DICE_DOOR_OPENING.maxY)/2, z=(DICE_DOOR_OPENING.minZ+DICE_DOOR_OPENING.maxZ)/2) => ({x,y,z});

test('Smeemo zone fades in smoothly by real camera distance and is silent at the close-up pose',()=>{
  assert.equal(sampleSmeemoMusicGain(cat,cat),0);
  const closeup=crowdCloseupPose(cat,16/9,50);
  assert.equal(sampleSmeemoMusicGain(closeup.position,cat),0,'the authored Smeemo camera lands fully inside the silent radius');
  assert.equal(sampleSmeemoMusicGain({x:cat.x+MUSIC_ZONE.smeemoSilentDistance,y:cat.y,z:cat.z},cat),0);
  const gains=[];
  for(let d=0;d<=12;d+=.1)gains.push(sampleSmeemoMusicGain({x:cat.x+d,y:cat.y,z:cat.z},cat));
  for(let i=1;i<gains.length;i++)assert.ok(gains[i]>=gains[i-1]-1e-12);
  assert.equal(sampleSmeemoMusicGain({x:cat.x+MUSIC_ZONE.smeemoFadeDistance,y:cat.y,z:cat.z},cat),1);
});

test('VIP doorway music fade matches the ambience portal curve and remains silent deeper inside',()=>{
  const door=DICE_DOOR_OPENING,centerZ=(door.minZ+door.maxZ)/2,centerY=(door.minY+door.maxY)/2;
  assert.equal(sampleMusicZoneGain(nearDoor(door.wallX-2.8,centerY,centerZ),door,cat),0,'the authored Dice-door close-up remains inside the silent falloff');
  assert.equal(sampleMusicZoneGain(nearDoor(door.wallX,centerY,centerZ),door,cat),0);
  assert.equal(sampleMusicZoneGain(nearDoor(door.wallX-3.65,centerY,centerZ),door,cat),0);
  const mid=sampleMusicZoneGain(nearDoor(door.wallX-4.925,centerY,centerZ),door,cat);
  assert.ok(mid>0&&mid<1);
  assert.equal(sampleMusicZoneGain(nearDoor(door.wallX-20,centerY,centerZ),door,cat),1);
  assert.equal(sampleMusicZoneGain(nearDoor(door.wallX+12,centerY,centerZ),door,cat,{insideVip:true}),0);
});

test('VIP interior tracker latches after a valid portal crossing and releases on return',()=>{
  const door=DICE_DOOR_OPENING,tracker=createVipInteriorTracker(door),y=1,z=(door.minZ+door.maxZ)/2;
  assert.equal(tracker.update({x:door.wallX-.5,y,z}),false);
  assert.equal(tracker.update({x:door.wallX+.1,y,z}),true);
  assert.equal(tracker.inside,true);
  // Moving deeper and away from the doorway does not accidentally unmute.
  assert.equal(tracker.update({x:door.wallX+18,y:4,z:door.maxZ+5}),true);
  assert.equal(tracker.update({x:door.wallX-.1,y,z}),false);
  assert.equal(tracker.inside,false);
});

test('crossing the wall outside the opening does not enter the VIP room',()=>{
  const door=DICE_DOOR_OPENING,tracker=createVipInteriorTracker(door);
  assert.equal(tracker.update({x:door.wallX-.5,y:1,z:door.maxZ+2}),false);
  assert.equal(tracker.update({x:door.wallX+.5,y:1,z:door.maxZ+2}),false);
  assert.equal(tracker.inside,false);
});

test('tracker can seed just inside the aperture and reset cleanly',()=>{
  const door=DICE_DOOR_OPENING,tracker=createVipInteriorTracker(door);
  assert.equal(tracker.update({x:door.wallX+.3,y:1,z:(door.minZ+door.maxZ)/2}),true);
  tracker.reset({x:door.wallX-.5,y:1,z:(door.minZ+door.maxZ)/2});
  assert.equal(tracker.inside,false);
  assert.equal(tracker.update({x:door.wallX-.2,y:1,z:(door.minZ+door.maxZ)/2}),false);
});

test('combined attenuation chooses the quieter of overlapping VIP and Smeemo zones',()=>{
  const pos={x:cat.x+4.5,y:cat.y,z:cat.z};
  const onlySmeemo=sampleSmeemoMusicGain(pos,cat);
  const combined=sampleMusicZoneGain(pos,DICE_DOOR_OPENING,cat,{insideVip:true});
  assert.ok(onlySmeemo>0);assert.equal(combined,0);
  assert.equal(sampleMusicZoneGain(null,DICE_DOOR_OPENING,cat),1);
});
