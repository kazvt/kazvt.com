import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {focusArrowKey,screenBounds,projectedArrowTarget,characterArrowTarget,focusArrowPose,createFocusArrow,FOCUS_ARROW_ANIMATION_MS} from './focus-arrow.mjs';
const viewport={width:1280,height:720},bounds={left:400,right:800,top:180,bottom:620};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('semantic destinations cover both keyboard and clicked targets, never overview or invalid ids',()=>{
 for(const kind of ['host','hazel','contestants','slot','roulette','dice-door','dice','card-table','trivia'])assert.equal(focusArrowKey({kind}),kind);
 for(const id of ['faroe','erin','kaz'])assert.equal(focusArrowKey({kind:'contestant',contestantId:id}),`contestant:${id}`);
 for(const view of [null,{kind:'overview'},{kind:'contestant',contestantId:'invalid'}])assert.equal(focusArrowKey(view),null);
});
test('rotated sprite is outside the target and its tip ray intersects the actual aim',()=>{
 const target={bounds,aim:{x:450,y:220}},p=focusArrowPose(target,viewport);assert.ok(p);assert.ok(p.tipX<bounds.left&&p.tipY<bounds.top);assert.ok(p.angle>0&&p.angle<90);
 near(p.left+p.width*62/64,p.tipX);near(p.top+p.height/2,p.tipY);near(Math.atan2(p.aimY-p.tipY,p.aimX-p.tipX)*180/Math.PI,p.angle);
});
test('multiple sizes and cropped frames remain in the viewport and aim down-right',()=>{
 let shown=0;for(const [w,h] of [[320,480],[390,844],[768,1024],[1920,1080],[2560,720],[720,320]])for(const x of [-40,0,10,w*.25,w*.65])for(const y of [-50,0,12,h*.2,h*.5]){
  const b={left:x,top:y,right:x+w*.32,bottom:y+h*.42},p=focusArrowPose({bounds:b},{width:w,height:h});if(!p)continue;shown++;
  const rad=p.angle*Math.PI/180;for(const dx of [-p.width*62/64,p.width*2/64])for(const dy of [-p.height/2,p.height/2]){const X=p.tipX+dx*Math.cos(rad)-dy*Math.sin(rad),Y=p.tipY+dx*Math.sin(rad)+dy*Math.cos(rad);assert.ok(X>=3-1e-7&&X<=w-3+1e-7&&Y>=3-1e-7&&Y<=h-3+1e-7);}
  assert.ok(p.aimX>=Math.max(0,b.left)&&p.aimX<=Math.min(w,b.right)&&p.aimY>=Math.max(0,b.top)&&p.aimY<=Math.min(h,b.bottom));near(Math.atan2(p.aimY-p.tipY,p.aimX-p.tipX)*180/Math.PI,p.angle);
 }assert.ok(shown>100);
 for(const b of [null,{left:-60,right:-10,top:0,bottom:10},{left:0,right:10,top:800,bottom:900},{left:NaN,right:10,top:0,bottom:10}])assert.equal(focusArrowPose({bounds:b},viewport),null);
});
test('rim contour selection aims on a real perimeter point, never the empty rectangle corner',()=>{
 const points=Array.from({length:32},(_,i)=>({x:600+200*Math.cos(i*Math.PI/16),y:400+120*Math.sin(i*Math.PI/16)}));
 const t=projectedArrowTarget(points,viewport),p=focusArrowPose(t,viewport);assert.ok(p);assert.ok(points.some(q=>q.x===p.aimX&&q.y===p.aimY));assert.notDeepEqual(t.aim,{x:400,y:280});assert.equal(screenBounds([{x:NaN,y:1}]),null);
});
test('character projection respects the current visible plane and upper-plane occlusion',()=>{
 const entry={panel:{style:{visibility:'visible'}},projectedQuad:{corners:[{x:400,y:200},{x:800,y:160},{x:810,y:620},{x:380,y:640}]}};
 const target=characterArrowTarget(entry,viewport,{contains:(e,x,y)=>e===entry&&x>460&&y>210});assert.ok(target);const p=focusArrowPose(target,viewport);assert.ok(p);assert.equal(p.aimX,target.aim.x);assert.equal(characterArrowTarget(entry,viewport,{contains:()=>false}),null);entry.panel.style.visibility='hidden';assert.equal(characterArrowTarget(entry,viewport,{contains:()=>true}),null);
});
test('single DOM pointer switches destination, stops animating, respects reduced motion and can be hidden',()=>{
 const original=globalThis.document;const img={style:{},setAttribute(){},remove(){this.removed=true}};globalThis.document={createElement:()=>img};let count=0;
 try{const marker=createFocusArrow({append(){count++}}),target={bounds};marker.update({kind:'host'},target,viewport,100,false);assert.match(img.src,/\.gif$/);assert.equal(img.hidden,false);marker.update({kind:'host'},target,viewport,100+FOCUS_ARROW_ANIMATION_MS,false);assert.match(img.src,/\.png$/);marker.update({kind:'slot'},target,viewport,5000,false);assert.match(img.src,/\.gif$/);marker.update({kind:'slot'},target,viewport,5100,true);assert.match(img.src,/\.png$/);marker.update({kind:'overview'},target,viewport,5200,false);assert.equal(img.hidden,true);marker.update({kind:'host'},target,viewport,5300,true);assert.equal(img.hidden,false);assert.match(img.src,/\.png$/);marker.hide(true);assert.equal(img.hidden,true);marker.dispose();assert.equal(img.removed,true);assert.equal(count,1);}finally{globalThis.document=original;}
});
test('render integration targets actual scene objects and hides in non-focus modes',()=>{
 const src=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');const a=src.indexOf('  function updateFocusArrow('),b=src.indexOf('  function syncVipAmbience(',a);const code=src.slice(a,b);
 const actions=[];const c={roomVisible:true,diceModeOpen:false,cameraDetached:false,freecam:{active:false},cameraTransition:null,currentView:{kind:'host'},focusArrowKey,characterArrowTarget,projectedArrowTarget,selectedCharacterId:v=>v.kind==='host'?'lillie-host':v.kind==='contestant'?v.contestantId:null,focusArrow:{hide:()=>actions.push('hide'),update:(v,t)=>actions.push([v.kind,t])},document:{querySelector:()=>null},preview:{clientWidth:1280,clientHeight:720},billboards:['lillie-host','faroe','erin','kaz'].map(id=>({id,panel:{style:{visibility:'visible'}},projectedQuad:{corners:[{x:400,y:200},{x:800,y:200},{x:800,y:620},{x:400,y:620}]}})),characterOcclusion:{contains:()=>true},reducedMotion:{matches:false}};c.contestants=c.billboards.slice(1);
 runInNewContext(code+'\nthis.update=updateFocusArrow;',c);
 for(const view of [{kind:'host'},{kind:'contestant',contestantId:'erin'},{kind:'contestants'}]){c.currentView=view;c.update(1,true);assert.equal(actions.at(-1)[0],view.kind);assert.ok(actions.at(-1)[1]);}
 for(const gate of ['diceModeOpen','cameraDetached','cameraTransition']){c[gate]=true;c.update(1,true);assert.equal(actions.at(-1),'hide');c[gate]=false;}c.freecam.active=true;c.update(1,true);assert.equal(actions.at(-1),'hide');c.freecam.active=false;c.update(1,false);assert.equal(actions.at(-1),'hide');
 assert.match(code,/slotWorldPoint\(x,y\)/);assert.match(code,/door\.minY,door\.maxY/);assert.match(code,/getObjectByName\("rim"\)/);assert.match(code,/rg-live-stage-content/);assert.match(src,/updateBillboardProjection\(time\);\s*updateFocusArrow\(time,roomVisible\)/);
});
test('VIP marker uses both dice body extents and pauses during rolling',()=>{
 const src=readFileSync(new URL('./dice-mode.js',import.meta.url),'utf8');const a=src.indexOf('  function updateDiceFocusArrow('),b=src.indexOf('  function render(time)',a);
 const actions=[];const c={rolling:false,modelReady:true,graphicsLost:false,isOpen:true,isClosing:false,dialog:{clientWidth:1000,clientHeight:700},camera:{updateMatrixWorld(){}},THREE:{Vector3:class{constructor(x,y,z){Object.assign(this,{x,y,z})}project(){return this}}},dieStates:[-.25,.25].map(shift=>({baseHalfExtents:[.1,.1,.1],group:{localToWorld:p=>Object.assign(p,{x:p.x+shift,y:p.y+.15})}})),projectedArrowTarget,reducedMotion:{matches:false},diceFocusArrow:{hide:()=>actions.push('hide'),update:(v,t)=>{actions.push([v,t]);return true;}}};
 runInNewContext(src.slice(a,b)+'\nthis.update=updateDiceFocusArrow;',c);assert.equal(c.update(0),true);assert.equal(actions.at(-1)[0].kind,'dice');assert.ok(actions.at(-1)[1].bounds.left<400);assert.ok(actions.at(-1)[1].bounds.right>600);c.rolling=true;assert.equal(c.update(1),false);assert.equal(actions.at(-1),'hide');c.rolling=false;c.graphicsLost=true;assert.equal(c.update(2),false);assert.equal(actions.at(-1),'hide');
});
