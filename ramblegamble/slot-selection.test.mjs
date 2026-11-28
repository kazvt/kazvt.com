import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolveSlotContextCell,resolveHostContextAction} from './point-click-routing.js';
import {placeSlotBerry,placeSlotSymbolAtCell,rotateSlotColumns,removeSlotSymbol,getSlotEligibleIndexes} from './slot-game.mjs';
const code=readFileSync(new URL('./ramblegamble.js',import.meta.url),'utf8');
const section=(a,b)=>code.slice(code.indexOf(a),code.indexOf(b,code.indexOf(a)));
function fixture(){
 const calls=[], controls=['kazberry','faroeberry','erinberry','star'].map(berry=>({dataset:{slotBerry:berry},setAttribute(k,v){this[k]=v;}}));
 const marker={setAttribute(k,v){this[k]=v;},classList:{toggle(){}}};
 const ctx={selectedSlotBerry:null,SLOT_REEL_WILDCARD:'star',playing:false,slotReelMotion:null,slotCellPop:null,stageShow:null,currentView:{kind:'slot'},document:{documentElement:{hasAttribute:()=>false}},slotReelGrid:['kazberry',...Array(14).fill(null)],foley:{play:(name)=>calls.push(name)},slotPlacementControls:[{axis:'row',index:0,label:'A',button:marker}],slotBerryPicker:{children:controls},slotControlLayer:{classList:{toggle(){}}},getSlotEligibleIndexes,placeSlotBerry,placeSlotSymbolAtCell,rotateSlotColumns,removeSlotSymbol,secureRandomIndex:()=>{calls.push('rng');return 0;},startSlotAction:()=>{calls.push('start');return true;},performance:{now:()=>1},reducedMotion:{matches:true},preview:{classList:{add(){}}},hideResult(){},slotCabinetFX:null,window:{dispatchEvent:()=>calls.push('event')},CustomEvent:class{},drawSlotReelDisplay(){}};
 runInNewContext(section('  function requireSlotSelection()', '  function completeSlotPresentation(')+'\nthis.actions={placeSlotBerryOnLine,placeSelectedSlotSymbolAtCell,startSlotReelSpin,spinSlotColumn,syncSlotPlacementControls};',ctx);
 return {ctx,calls,controls,marker};
}
test('unselected line, cell, reel and crank produce only the recorded error cue',()=>{
 const {ctx,calls}=fixture();const a=ctx.actions, before=ctx.slotReelGrid.slice();
 assert.equal(a.placeSlotBerryOnLine('row',0),false);assert.equal(a.placeSlotBerryOnLine('column',1),false);assert.equal(a.placeSelectedSlotSymbolAtCell(1),false);assert.equal(a.spinSlotColumn(2),false);assert.equal(a.startSlotReelSpin([0,1,2,3,4],true),false);
 assert.deepEqual(calls,Array(5).fill('error'));assert.deepEqual(ctx.slotReelGrid,before);assert.equal(ctx.playing,false);assert.equal(ctx.slotCellPop,null);
 ctx.playing=true;assert.equal(a.spinSlotColumn(0),false);assert.equal(calls.length,5);
});
test('unselected arrows stay clickable for error feedback, and selection restores normal controls',()=>{
 const {ctx,calls,controls,marker}=fixture();const a=ctx.actions;
 a.syncSlotPlacementControls();assert.equal(marker.disabled,false);assert.equal(marker.title,'row A');assert.ok(controls.every(c=>c['aria-pressed']==='false'));
 ctx.selectedSlotBerry='erinberry';a.syncSlotPlacementControls();assert.equal(controls[2]['aria-pressed'],'true');assert.equal(a.placeSlotBerryOnLine('row',0),true);assert.ok(calls.includes('start'));
 ctx.selectedSlotBerry='star';a.syncSlotPlacementControls();assert.equal(marker.disabled,true);assert.equal(a.placeSelectedSlotSymbolAtCell(1),true);assert.equal(ctx.slotCellPop.motion.targetGrid[1],'star');
});
test('right-click without selection cannot delete or open the staff panel; selected removal works',()=>{
 const {ctx,calls}=fixture();let handler;
 Object.assign(ctx,{canvas:{addEventListener:(_,fn)=>handler=fn},freecam:{active:false},gameStarted:true,pauseMenuOpen:false,camera:{},sceneReady:true,diceModeOpen:false,cameraTransition:null,cameraDetached:false,getSceneInteractionAt:()=>({machine:'slot',part:'slot-reel-display',cellIndex:0}),resolveSlotContextCell,resolveHostContextAction,saveSlotGrid:grid=>{ctx.slotReelGrid=grid;calls.push('save');},syncSlotPlacementControls:()=>{}});
 runInNewContext(section('  canvas.addEventListener("contextmenu"', '  canvas.addEventListener("pointerleave"'),ctx);
 let prevented=0;const evt={button:2,preventDefault:()=>prevented++};handler(evt);assert.deepEqual(calls,['error']);assert.equal(ctx.slotReelGrid[0],'kazberry');assert.equal(prevented,1);
 ctx.selectedSlotBerry='star';handler(evt);assert.equal(ctx.slotReelGrid[0],null);assert.deepEqual(calls,['error','save','remove','event']);assert.equal(prevented,2);
});
test('slot entry and detached redock clear selection but normal in-place camera changes do not',()=>{
 const snippet=section('    const openingSlot=', '    if(stageShow&&viewChanged)');
 const resets=[];const c={window:{dispatchEvent:e=>resets.push(e.detail.berry)},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}};
 for(const [previous,next,detached,expected] of [['overview','slot',false,1],['slot','slot',false,0],['slot','slot',true,1],['slot','overview',false,0]]){
   const before=resets.length;runInNewContext(snippet,{...c,currentView:{kind:previous},nextView:{kind:next},fromExterior:detached});assert.equal(resets.length-before,expected);
 }
 assert.deepEqual(resets,[null,null]);assert.match(code,/let selectedSlotBerry = null;/);assert.match(code,/if \(berry === null \|\| \[/);
 const ui=readFileSync(new URL('./trivia-ui.js',import.meta.url),'utf8');assert.match(ui,/let selectedBerry = null;/);assert.match(ui,/event\.detail\?\.berry !== null/);
});
