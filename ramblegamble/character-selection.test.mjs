import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionScale,characterRenderPose,selectedCharacterId,SELECTION_MS,createCharacterSelection} from './character-selection.mjs';
import {readFileSync} from 'node:fs';

test('selection squashes horizontally and stretches vertically before exact recovery, with fixed feet and area',()=>{
 const entry={anchor:{x:4,y:1.5,z:-2},worldWidth:1.8,worldHeight:1.8};const base=structuredClone(entry);
 let stretch=false,squash=false;
 for(let age=0;age<=SELECTION_MS+10;age++){
  const {x,y}=selectionScale(age),pose=characterRenderPose(entry,age);
  assert.ok(Math.abs(x*y-1)<1e-12);assert.ok(Math.abs(pose.anchor.y-pose.worldHeight/2-(entry.anchor.y-entry.worldHeight/2))<1e-12);assert.ok(y>.85&&y<1.2);
  stretch ||= y>1.10&&x<1;squash ||= y<.97&&x>1;
  assert.deepEqual(characterRenderPose(entry,age,true),base);
 }
 assert.ok(stretch&&squash);assert.deepEqual(characterRenderPose(entry,SELECTION_MS),base);assert.deepEqual(entry,base);
});
test('selection is only the individual focused character, not group, machine or trivia views',()=>{
 assert.equal(selectedCharacterId({kind:'host'}),'lillie-host');assert.equal(selectedCharacterId({kind:'hazel'}),'hazel');for(const id of ['faroe','erin','kaz'])assert.equal(selectedCharacterId({kind:'contestant',contestantId:id}),id);
 for(const kind of ['contestants','overview','slot','roulette','trivia','dice-door'])assert.equal(selectedCharacterId({kind}),null);
});
test('world-space marker and nameplate track selected character, hide on occlusion and remain in reduced motion',()=>{
 class V {set(x,y,z){Object.assign(this,{x,y,z});}setScalar(n){this.set(n,n,n);}}
 class Group {children=[];position=new V();add(x){this.children.push(x);}}
 class Mesh {position=new V();rotation={};scale=new V();constructor(geometry,material){Object.assign(this,{geometry,material});}}
 class Material {constructor(opts){Object.assign(this,opts);this.color={setHex(v){this.value=v;}};}dispose(){}}
 class Geometry {dispose(){}}
 const THREE={Group,Mesh,MeshBasicMaterial:Material,RingGeometry:Geometry,DoubleSide:2};
 class Node {
  children=[];style={setProperty(k,v){this[k]=v;}};classes=new Set();hidden=false;textContent='';offsetWidth=90;offsetHeight=80;
  classList={add:v=>this.classes.add(v),remove:(...vs)=>vs.forEach(v=>this.classes.delete(v)),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};
  append(...children){this.children.push(...children);}remove(){this.removed=true;}
 }
 const scene=new Group();scene.remove=()=>{};const layer=new Node();
 const old=globalThis.document;globalThis.document={createElement:()=>new Node()};
 let points,stars,stopped=0;
 try{
  const fx=createCharacterSelection(THREE,scene,layer,{subscribePoints:fn=>{points=fn;fn({faroe:1234,erin:0,kaz:27});return()=>stopped++;},subscribeStars:fn=>{stars=fn;fn({faroe:0,erin:2,kaz:5});return()=>stopped++;}}),entry={id:'faroe',anchor:{x:4,y:1.5,z:-2},worldWidth:1.8,worldHeight:1.8,panel:{style:{visibility:'visible'}},projectedQuad:{corners:[{x:120,y:75},{x:280,y:80},{x:270,y:300},{x:130,y:300}]}},view={width:400,height:360};
  const tags=Object.fromEntries(layer.children.map(tag=>[tag.children[0].textContent,tag]));
  const values=tag=>tag.children[1].children.map(row=>row.children[2].textContent);
  assert.deepEqual(values(tags.FAROE),['1,234','0']);assert.deepEqual(values(tags.ERIN),['0','2']);assert.deepEqual(values(tags.KAZ),['27','5']);assert.equal(tags.LILLIE.children.length,1);assert.equal(tags.HAZEL.children.length,1);
  assert.equal(tags.FAROE.children[1].children[0].children[0].src,'/ramblegamble/assets/berries/points-chip.png');
  assert.equal(tags.FAROE.children[1].children[1].children[0].src,'/ramblegamble/assets/berries/star.png');
  for(const [id,name] of [['faroe','FAROE'],['erin','ERIN'],['kaz','KAZ'],['lillie-host','LILLIE']]){
   entry.id=id;fx.update(entry,100,100,false,view,{contains:()=>true});assert.equal(tags[name].hidden,false);assert.equal(layer.children.filter(t=>!t.hidden).length,1);assert.ok(fx.group.visible);assert.ok(Math.abs(fx.group.position.y-(1.5-.9+.018))<1e-9);assert.ok(fx.group.children.every(m=>m.material.depthTest&&m.material.depthWrite===false));
  }
  const guest={...entry,id:'hazel',seated:true};fx.update(guest,100,100,false,view,{contains:()=>true});assert.equal(tags.HAZEL.hidden,false);assert.equal(fx.group.visible,false);assert.equal(layer.children.filter(t=>!t.hidden).length,1);
  assert.deepEqual(characterRenderPose(guest,100),characterRenderPose(guest,Infinity));
  stars({faroe:3,erin:2,kaz:5});points({faroe:9007199254740991,erin:0,kaz:27});assert.deepEqual(values(tags.FAROE),['9,007,199,254,740,991','3']);
  fx.update(entry,1000,1000,true,view,{contains:()=>true});assert.equal(fx.group.children.at(-1).visible,false);assert.equal(fx.group.children[2].rotation.z,0);assert.equal(tags.LILLIE.hidden,false);
  fx.update(entry,1000,1000,true,view,{contains:()=>false});assert.equal(tags.LILLIE.hidden,true);
  const entries=['faroe','erin','kaz'].map((id,i)=>({...entry,id,projectedQuad:{corners:[{x:20+130*i,y:120},{x:80+130*i,y:120},{x:80+130*i,y:250},{x:20+130*i,y:250}]}}));
  fx.update(null,1000,Infinity,true,view,{contains:()=>true},entries);assert.equal(fx.group.visible,false);assert.equal(layer.children.filter(t=>!t.hidden).length,3);assert.ok(layer.classes.has('rg-group-stats-visible'));
  fx.update(null,1000,Infinity,true,view,{contains:e=>e.id!=='erin'},entries);assert.equal(tags.ERIN.hidden,true);assert.equal(tags.KAZ.hidden,false);assert.ok(!layer.classes.has('rg-group-stats-visible'));
  fx.hide();assert.ok(layer.children.every(t=>t.hidden));fx.update(null,1200,Infinity,false,view,{contains:()=>true});assert.ok(layer.children.every(t=>t.hidden));
  entry.panel.style.visibility='hidden';fx.update(entry,1200,1200,false,view,{contains:()=>true});assert.equal(fx.group.visible,false);assert.ok(layer.children.every(t=>t.hidden));fx.dispose();assert.equal(stopped,2);assert.ok(layer.children.every(t=>t.removed));
 }finally{globalThis.document=old;}});
test('the projected character and visibility pass use the identical deformed render pose',()=>{
 const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8'),occlusion=readFileSync(new URL('./character-occlusion.mjs',import.meta.url),'utf8');
 assert.match(js,/projectCharacterQuad\(billboard.renderPose/);assert.match(occlusion,/const pose=entry.renderPose\|\|entry;state.mesh.position.copy\(pose.anchor\)/);assert.match(occlusion,/state.mesh.scale.set\(pose.worldWidth,pose.worldHeight,1\)/);assert.match(js,/characterSelection\?\.hide\(\)/);
 assert.match(js,/!cameraDetached&&!freecam\?\.active&&!cameraTransition&&currentView.kind==="contestants"/);
 assert.match(js,/subscribePoints:subscribePointScores,subscribeStars:subscribeStarScores/);
});
