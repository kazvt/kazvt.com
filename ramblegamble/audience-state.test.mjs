import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIENCE_KEY,AUDIENCE_MIN,AUDIENCE_MODES,createAudienceState,readAudienceMode,writeAudienceMode } from './audience-state.mjs';
import { CROWD_FPS,CROWD_SECTIONS,CROWD_BOUNDARY,CROWD_FADE_WIDTH,crowdEdgeAlpha,makeCrowdEdgeMask,applyCrowdEdgeMask,crowdPeople,crowdPose,crowdDancePose,paintCrowd } from './audience-render.mjs';
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


test('about half the audience forms deterministic adjacent pairs with synchronized and bounded dance poses',()=>{
 let total=0,dancers=0;
 for(const panel of CROWD_SECTIONS){
  const people=crowdPeople(Math.round(panel.width*22),panel.seed);total+=people.length;
  const paired=people.filter(p=>p.dance);dancers+=paired.length;
  assert.ok(Math.abs(paired.length/people.length-.5)<.04);
  for(const row of new Set(people.map(p=>p.row))){const line=people.filter(p=>p.row===row);for(let i=0;i<line.length;i++){
    const p=line[i];if(!p.dance){assert.equal(crowdDancePose(p,0),null);continue;}
    if(p.dance.side!==-1)continue;
    const q=line[i+1];assert.equal(q.dance.side,1);assert.equal(p.dance.center,q.dance.center);assert.equal(p.dance.phase,q.dance.phase);
    for(const frame of [0,1,3,8,16,60,1000,518400]){
      const a=crowdDancePose(p,frame),b=crowdDancePose(q,frame);
      assert.ok(a.x<b.x);assert.ok(Math.abs(a.x-p.x)<12);assert.ok(Math.abs(b.x-q.x)<12);
      assert.ok(Math.abs(a.y-p.base)<=6);assert.ok(Math.abs(b.y-q.base)<=6);
      assert.ok(Object.values(a).every(Number.isFinite));assert.ok(Object.values(b).every(Number.isFinite));
    }
  }}
 }
 assert.equal(total,399);assert.equal(dancers,200);
});
test('only the cheer painter uses paired dance; all other emotions retain exactly their old geometry',()=>{
 const people=crowdPeople(396,19),old=people.map(({dance,...p})=>p);
 const capture=(list,frame,mood)=>{const calls=[];const ctx=new Proxy({}, {get:(o,k)=>(...args)=>calls.push([k,...args]),set:(o,k,v)=>{calls.push([k,v]);return true;}});paintCrowd(ctx,396,180,list,frame,mood);return calls;};
 for(const frame of [0,1,10,60,518400])for(const mood of ['idle','suspense','shock'])assert.deepEqual(capture(people,frame,mood),capture(old,frame,mood));
 assert.notDeepEqual(capture(people,0,'cheer'),capture(old,0,'cheer'));
 assert.notDeepEqual(capture(people,0,'cheer'),capture(people,1,'cheer'));
 assert.deepEqual(capture(people,0,'cheer'),capture(people,0,'cheer'));
});


test('rear and side panels meet exactly with no overlap; feather only exposed front ends',()=>{
 const [rear,left,right]=CROWD_SECTIONS;
 const point=(p,u)=>[p.x+(u-.5)*p.width*Math.cos(p.yaw),p.z-(u-.5)*p.width*Math.sin(p.yaw)];
 const near=(a,b)=>assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-12);
 near(point(rear,1),point(left,0));near(point(rear,0),point(right,1));
 near(point(left,1),[CROWD_BOUNDARY.left,CROWD_BOUNDARY.front]);near(point(right,0),[CROWD_BOUNDARY.right,CROWD_BOUNDARY.front]);
 for(let i=0;i<=100;i++)assert.equal(crowdEdgeAlpha(rear,i/100),1);
 for(const p of [left,right]){
  const u=d=>p.fade==='left'?d/p.width:1-d/p.width;
  assert.equal(crowdEdgeAlpha(p,u(0)),0);
  assert.ok(Math.abs(crowdEdgeAlpha(p,u(CROWD_FADE_WIDTH/2))-.5)<1e-12);
  assert.equal(crowdEdgeAlpha(p,u(CROWD_FADE_WIDTH)),1);
  let old=0;for(let i=0;i<=1000;i++){const v=crowdEdgeAlpha(p,u(p.width*i/1000));assert.ok(v>=old-1e-12&&v<=1);old=v;}
 }
});

test('edge mask is cached, monotonic and isolated from normal crowd painting',()=>{
 const calls=[],stops=[];const ctx={createLinearGradient(...args){calls.push(args);return {addColorStop(u,color){stops.push([u,color]);}};},save(){calls.push('save');},restore(){calls.push('restore');},fillRect(...args){calls.push([this.globalCompositeOperation,...args]);}};
 assert.equal(makeCrowdEdgeMask(ctx,411,CROWD_SECTIONS[0]),null);assert.equal(calls.length,0);
 for(const section of CROWD_SECTIONS.slice(1)){
  stops.length=0;calls.length=0;const mask=makeCrowdEdgeMask(ctx,305,section);
  assert.equal(stops.length,17);assert.ok(stops.every(([u])=>u>=0&&u<=1));assert.ok(stops.every(([u],i)=>i===0||u>stops[i-1][0]));
  const alpha=stops.map(([,c])=>Number(c.slice(c.lastIndexOf(',')+1,-1)));
  assert.ok(alpha.every((a,i)=>i===0||(section.fade==='left'?a>=alpha[i-1]:a<=alpha[i-1])));
  assert.ok(Math.abs(alpha[section.fade==='left'?0:16])<1e-12);
  assert.ok(Math.abs(alpha[section.fade==='left'?16:0]-1)<1e-12);
  applyCrowdEdgeMask(ctx,305,180,mask);applyCrowdEdgeMask(ctx,305,180,mask);
  assert.deepEqual(calls,[[0,0,305,0],'save',['destination-in',0,0,305,180],'restore','save',['destination-in',0,0,305,180],'restore']);
 }
});
