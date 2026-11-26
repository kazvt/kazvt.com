import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIENCE_KEY,AUDIENCE_MIN,AUDIENCE_MODES,createAudienceState,readAudienceMode,writeAudienceMode } from './audience-state.mjs';
import { CROWD_FPS,CROWD_SECTIONS,crowdPeople,crowdPose } from './audience-render.mjs';
import { parsePointsCommand } from './points-commands.mjs';
import { commandSuggestions,applyCommandSuggestion } from './console-completion.mjs';

test('each emotion has a minimum dwell and no maximum, even after 24h',()=>{
 for(const emotion of Object.keys(AUDIENCE_MIN)){
  const state=createAudienceState(0);const other=emotion==='idle'?'cheer':'idle';
  state.setMode(other,0);state.setMode(emotion,5000);
  assert.equal(state.active,emotion);
  assert.equal(state.step(86400000),emotion);
  const s=createAudienceState(0);s.setMode(other,0);s.setMode(emotion,5000);s.setMode(other,5001);
  assert.equal(s.step(5000+AUDIENCE_MIN[emotion]-1),emotion);
  assert.equal(s.step(5000+AUDIENCE_MIN[emotion]),other);
 }
});
test('latest pending intent wins; auto events cannot override manual emotion',()=>{
 const s=createAudienceState();s.react('cheer',0);s.react('shock',1);s.react('suspense',2);
 assert.equal(s.pending,'suspense');assert.equal(s.step(4199),'cheer');assert.equal(s.step(4200),'suspense');
 s.setMode('idle',4201);s.react('shock',4202);assert.equal(s.step(6500),'idle');
 s.setMode('auto',6501);assert.equal(s.step(7700),'shock');assert.equal(s.step(1e9),'shock');
});
test('storage validates modes and degrades safely if blocked',()=>{
 const values=new Map();const store={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(readAudienceMode(store),'auto');for(const mode of AUDIENCE_MODES){assert.equal(writeAudienceMode(mode,store),true);assert.equal(readAudienceMode(store),mode);}
 assert.equal(writeAudienceMode('unknown',store),false);values.set(AUDIENCE_KEY,'invalid');assert.equal(readAudienceMode(store),'auto');
 const blocked={getItem(){throw Error()},setItem(){throw Error()}};assert.equal(readAudienceMode(blocked),'auto');assert.equal(writeAudienceMode('cheer',blocked),false);
});
test('crowd has three inward-facing sides, deterministic independent poses and exaggerated cheering',()=>{
 assert.equal(CROWD_FPS,6);assert.equal(CROWD_SECTIONS.length,3);assert.equal(CROWD_SECTIONS[0].yaw,Math.PI);
 for(const panel of CROWD_SECTIONS){const people=crowdPeople(Math.round(panel.width*22),panel.seed);assert.deepEqual(people,crowdPeople(Math.round(panel.width*22),panel.seed));assert.ok(people.length>75);assert.ok(new Set(people.map(p=>p.phase)).size===people.length);
 for(const p of people){let low=Infinity,high=-Infinity;for(let f=0;f<90;f++){const pose=crowdPose(p,f,'cheer');assert.equal(pose.arms,2);assert.equal(crowdPose(p,f,'suspense').arms,0);assert.ok(pose.arm>=10&&pose.arm<=24);assert.ok(Math.abs(pose.x-p.x)<=5);low=Math.min(low,pose.y);high=Math.max(high,pose.y);}assert.ok(high-low>=11);}}
});
test('both audience and emote command names complete only valid emotion arguments',()=>{
 for(const cmd of ['audience','emote'])for(const mode of AUDIENCE_MODES){assert.deepEqual(parsePointsCommand(`${cmd} ${mode}`),{action:'audience',mode});}
 assert.equal(parsePointsCommand('audience invalid').action,'error');assert.equal(parsePointsCommand('emote cheer now').action,'error');
 const s=commandSuggestions('emote ch');assert.deepEqual(s.options,['cheer']);assert.equal(applyCommandSuggestion(s,0).value,'emote cheer');
});
