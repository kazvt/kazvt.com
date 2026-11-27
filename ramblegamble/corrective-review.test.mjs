import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolveArcadeShortcut} from './point-click-routing.js';
const js=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../rg/index.html',import.meta.url),'utf8');
const section=(a,b)=>js.slice(js.indexOf(a),js.indexOf(b,js.indexOf(a)));
test('real keyboard handler consumes repeated discrete shortcuts without invoking them; orbit and text entry retain native behaviour',()=>{
 const log=[],handlers={};class Element {constructor({selector='',editable=false}={}){this.selector=selector;this.isContentEditable=editable;}closest(s){return this.selector&&s.includes(this.selector)?this:null;}}
 const ctx={encounter:{phase:"hidden"},Element,resolveArcadeShortcut,freecam:{active:false},cameraDetached:false,sceneReady:true,gameStarted:true,pauseMenuOpen:false,diceModeOpen:false,currentView:{kind:'overview'},audience:{},document:{querySelector:()=>null,documentElement:{hasAttribute:()=>false}},transitionToView:v=>log.push(v.kind),setLookDirection:v=>log.push(v),goBack:()=>log.push('back'),playCheer:()=>log.push('cheer'),startWheelSpin:()=>log.push('wheel'),startLeverPull:()=>log.push('lever'),showPauseMenu:()=>log.push('pause'),window:{addEventListener:(n,f)=>handlers[n]=f},focusDrag:{stopFollowing(){}},focusOrbit:{nudge(){log.push('nudge');}}};
 runInNewContext(section('  window.addEventListener("keydown", (event) => {','  window.addEventListener("rg:spin-wheel"'),ctx);
 const press=(key,props={})=>{let prevented=false;handlers.keydown({key,target:new Element(),preventDefault(){prevented=true;},...props});return prevented;};
 for(const k of ['1','2','3','4','5','8','9','c','d','r','s','Escape','Enter',' ','Backspace','ArrowDown','g','t'])assert.equal(press(k,{repeat:true}),true,k);assert.deepEqual(log,[]);
 assert.equal(press('x',{repeat:true}),false);assert.equal(press('ArrowRight',{repeat:true}),true);assert.deepEqual(log,[1]);
 for(const props of [{isComposing:true},{defaultPrevented:true},{ctrlKey:true},{target:new Element({editable:true})},{target:new Element({selector:'input'})},{target:new Element({selector:"[role='textbox']"})}])assert.equal(press('r',props),false);
 assert.equal(press('Enter',{repeat:true,target:new Element({selector:'button'})}),false);assert.equal(press('r'),true);assert.equal(press('s'),true);assert.deepEqual(log,[1,'wheel','lever']);
 ctx.document.documentElement.hasAttribute=()=>true;assert.equal(press('r'),false);assert.deepEqual(log,[1,'wheel','lever']);
});
test('projection runs after cabinet movement, not one frame before; hidden and detached controls are explicitly hidden',()=>{
 const frame=section('  function animate(time) {','  async function boot()');const p=frame.indexOf('updateSlotPlacementControlProjection()');assert.ok(p>frame.indexOf('slotCabinetFX?.update(time'));assert.ok(p>frame.indexOf('updateCameraTransition(time)'));assert.equal(frame.match(/updateSlotPlacementControlProjection\(\)/g).length,1);
 const projection=section('  function updateSlotPlacementControlProjection()','  const cardLayer');assert.match(projection,/if \(slotControlLayer\) slotControlLayer.hidden = true/);assert.match(projection,/!document.hidden && !document.documentElement.hasAttribute\("data-rg-host-locked"\)/);
});
test('cached pagehide suspends, pageshow restores without disposal or duplicate animation frames; real departure disposes',()=>{
 const handlers={},log=[];const obj=n=>({dispose:()=>log.push(n+':dispose'),reset:()=>log.push(n+':reset'),hide:()=>log.push(n+':hide'),suspend:()=>log.push(n+':suspend'),setActive:v=>log.push(n+':'+v),setPageSuspended:v=>log.push(n+':'+v),sync:v=>log.push(n+':'+v)});
 const ctx={resetEncounter(){},window:{addEventListener:(n,f)=>handlers[n]=f},animationFrame:5,cancelAnimationFrame:id=>log.push('cancel:'+id),requestAnimationFrame:()=>{log.push('frame');return 6;},animate(){},gameStarted:true,pauseMenuOpen:false,document:{hidden:false},crowdLastFrame:123,fitCamera:()=>log.push('fit'),suppressElapsedWheelCue:()=>log.push('suppress'),syncMusic:()=>log.push('music'),resizeObserver:{disconnect:()=>log.push('resize:disconnect')}};
 for(const n of ['floatingSky','slotMarquee','soundtrack','menuPresentation','liquidPortal','exteriorMist','exteriorHands','slotCabinetFX','rouletteCabinetFX','focusArrow','characterOcclusion','characterSelection','signGlow','audience','showFX','stageShow','stageDance','contestantStands','renderer'])ctx[n]=obj(n);
 runInNewContext(js.slice(js.indexOf('  window.addEventListener("pageshow", event => {'),js.lastIndexOf('})();')),ctx);
 handlers.pagehide({persisted:true});assert.equal(ctx.animationFrame,0);assert.equal(ctx.crowdLastFrame,null);assert.ok(log.includes('floatingSky:suspend'));assert.ok(log.includes('slotMarquee:suspend'));assert.ok(log.includes('contestantStands:suspend'));assert.ok(log.includes('menuPresentation:true'));assert.equal(log.filter(x=>x.includes('dispose')).length,0);
 handlers.pageshow({persisted:true});assert.equal(ctx.animationFrame,6);assert.ok(log.includes('menuPresentation:false'));handlers.pageshow({persisted:true});assert.equal(log.filter(x=>x==='frame').length,1);
 handlers.pagehide({persisted:false});assert.ok(log.includes('renderer:dispose'));assert.ok(log.includes('floatingSky:dispose'));assert.ok(log.includes('slotMarquee:dispose'));assert.ok(log.includes('exteriorHands:dispose'));assert.ok(log.includes('contestantStands:dispose'));assert.ok(log.includes('resize:disconnect'));
});
test('controls reference actual shortcuts without revealing the hidden Smeemo and no motion switch returns',()=>{
 const controls=html.slice(html.indexOf('id="rg-controls-dialog"'),html.indexOf('id="rg-dice-dialog"'));for(const label of ['Explore','Jump to','Play &amp; show','Staff','Hazel’s balcony','Shift+D','Shift+T','Backspace'])assert.ok(controls.includes(label),label);assert.doesNotMatch(controls,/Smeemo|<kbd>9<\/kbd>|MOTION/i);
 assert.match(js,/menuMarquee\.muted = foley\.muted/);assert.match(js,/function beginTurn\(machine\) \{\s*if \(playing \|\| document.documentElement.hasAttribute/);
});
