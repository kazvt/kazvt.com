import test from "node:test";
import assert from "node:assert/strict";
import { createSlotLineMotion, slotMotionFrame, sampleSlotReelColumn, sampleSlotReelRow } from "./slot-reels.mjs";
import { createSlotLinePainter, slotFeatherStops } from "./slot-reel-render.mjs";
import { placeSlotBerry, rotateSlotColumns, resolveSlotPayouts } from "./slot-game.mjs";

const grid = ["star", "kazberry", null, "erinberry", "faroeberry", "erinberry", "star", "faroeberry", null, "kazberry", null, "faroeberry", "kazberry", "star", "erinberry"];
const options = { startedAt: 100, duration: 1950, stagger: 120, random: () => .75 };

for (const axis of ["row", "column"]) {
  test(`${axis} placement parks every unchanged occupied cell and scrolls only the changed cell and blanks`, () => {
    for (let cell = 0; cell < 15; cell++) {
      const initial = grid.slice(); initial[cell] = "erinberry";
      const target = initial.slice(); target[cell] = "kazberry";
      const index = axis === "row" ? Math.floor(cell / 5) : cell % 5;
      const motion = createSlotLineMotion(initial, { axis, indexes: [index] }, { ...options, targetGrid: target, preserveUnchanged: true });
      for (const time of [0, 100, 101, 230, 500, 1000, 1900, 2050, 5000]) {
        const f = slotMotionFrame(motion, time);
        assert.equal(f.lines.length, 1);
        assert.equal(f.lines[0].axis, axis);
        const chosen = axis === "row" ? cell % 5 : Math.floor(cell / 5);
        const track = axis === "row" ? motion.rows[0] : motion.columns[0];
        const positions = track.start.flatMap((s,i)=>s===null || i===chosen ? [i] : []);
        assert.deepEqual(f.lines[0].positions, positions);
        assert.deepEqual(f.grid, initial.map((v, i) => i === cell ? null : v));
        for (let i=0; i<track.start.length; i++) if (!positions.includes(i)) {
          assert.equal(track.strip[i], null, "parked symbol must not appear in scrolling start strip");
          assert.equal(track.strip[track.targetOffset+i], null, "parked symbol must not appear in scrolling target strip");
        }
        assert.equal(motion.grid[cell], "erinberry");
      }
      assert.deepEqual(slotMotionFrame(motion, 2050).lines[0].frame.symbols, motion[axis === "row" ? "rows" : "columns"][0].target);
      assert.deepEqual(motion.targetGrid, target);
    }
  });
}

test("steady exposure is strong, frame-rate independent, continuous at phase boundaries, and fades to zero", () => {
  for (const axis of ["row", "column"]) {
    const motion = createSlotLineMotion(grid, {axis, indexes: [1]}, options);
    const line = (axis === "row" ? motion.rows : motion.columns)[0];
    const sample = axis === "row" ? sampleSlotReelRow : sampleSlotReelColumn;
    let last = 0;
    for (let ms = 0; ms <= 1950; ms++) {
      const frame = sample(line, motion, 100 + ms);
      assert.ok(frame.offset >= last - 1e-10 && frame.offset <= line.targetOffset + 1e-10);
      last = frame.offset;
      assert.ok(frame.velocity >= 0);
      if (ms > 0 && ms < 1950) {
        const numerical = (sample(line, motion, 100 + ms + .01).offset - sample(line, motion, 100 + ms - .01).offset) / .02;
        assert.ok(Math.abs(frame.velocity - numerical) < 1e-7);
      }
    }
    const get = time => slotMotionFrame(motion, time).lines[0].blur;
    assert.equal(get(100), 0);
    assert.ok(get(900) > .5 && get(900) <= .85);
    assert.ok(get(1990) < get(1900) && get(1900) < get(900));
    assert.equal(get(2050), 0);
    assert.equal(get(900), slotMotionFrame(motion, 900).lines[0].blur);
    assert.equal(slotMotionFrame(motion, 900, true).lines[0].blur, 0);
  }
});

test("whole crank uses vertical reels, including zero-shift spins, with independent crisp delayed and stopped reels", () => {
  const spin = rotateSlotColumns(grid, [0,1,2,3,4], {randomIndex: () => 0});
  const motion = createSlotLineMotion(grid, {axis:"column", indexes:[0,1,2,3,4]}, {...options, targetGrid: spin.grid});
  const early = slotMotionFrame(motion, 200);
  assert.deepEqual(early.lines.map(l=>l.axis), Array(5).fill("column"));
  assert.deepEqual(early.lines.map(l=>l.positions), Array.from({length:5},()=>[0,1,2]));
  assert.ok(early.lines[0].blur > 0);
  assert.equal(early.lines[1].blur, 0);
  const end = slotMotionFrame(motion, 2100);
  assert.equal(end.lines[0].frame.spinning, false);
  assert.equal(end.lines[0].blur, 0);
  assert.equal(end.lines[4].frame.spinning, true);
  assert.ok(end.lines[4].blur > 0);
  assert.deepEqual(motion.targetGrid, grid);
});

test("reduced motion and zero-duration rolls settle correctly without blur", () => {
  for (const axis of ["row", "column"]) {
    const motion = createSlotLineMotion(grid,{axis,indexes:[0]},{...options,reducedMotion:true});
    assert.equal(slotMotionFrame(motion, 250).lines[0].blur, 0);
    assert.equal(slotMotionFrame(motion, 460).lines[0].frame.spinning, false);
    const instant = createSlotLineMotion(grid,{axis,indexes:[0]},{...options,duration:0});
    assert.equal(slotMotionFrame(instant, 100).lines[0].frame.spinning, false);
  }
});

function fakeContext(width, height) {
  const canvas = {width,height}; const calls = [], stack = [];
  const ctx = {canvas,calls,globalAlpha:1,globalCompositeOperation:"source-over",imageSmoothingEnabled:false,
    save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.imageSmoothingEnabled]);},
    restore(){[this.globalAlpha,this.globalCompositeOperation,this.imageSmoothingEnabled]=stack.pop();},
    beginPath(){calls.push(["begin"]);}, rect(...args){calls.push(["rect",...args]);}, clip(){calls.push(["clip"]);},
    clearRect(...args){calls.push(["clear",...args]);},
    drawImage(image,x,y){calls.push(["image",x,y,this.globalAlpha,this.globalCompositeOperation]);},
    createLinearGradient(...args){calls.push(["gradient",...args]);return {addColorStop(at,color){calls.push(["stop",at,color]);}};},
    fillRect(...args){calls.push(["fill",...args,this.globalAlpha,this.globalCompositeOperation]);}};
  canvas.getContext=()=>ctx; return ctx;
}

test("painter clips placement to exact cell and accumulates 17 normalized samples only along movement axis", () => {
  const buffers=[];
  const painter=createSlotLinePainter(()=>{const buffer=fakeContext(0,0);buffers.push(buffer);return buffer.canvas;});
  for(const axis of ["row","column"]){
    const fullGrid=grid.map(s=>s||"erinberry");
    const target=fullGrid.slice();target[7]="kazberry";
    const motion=createSlotLineMotion(fullGrid,{axis,indexes:[axis==="row"?1:2]},{...options,targetGrid:target,preserveUnchanged:true});
    const ctx=fakeContext(1000,600);const draws=[];
    painter(ctx,slotMotionFrame(motion,900).lines,(...args)=>draws.push(args));
    const layer=buffers[buffers.length-2];
    assert.deepEqual(layer.calls.filter(c=>c[0]==="rect"),[axis==="row"?["rect",400,0,200,200]:["rect",0,200,200,200]]);
    const images=layer.calls.filter(c=>c[0]==="image");assert.equal(images.length,17);
    assert.ok(Math.abs(images.reduce((sum,c)=>sum+c[3],0)-1)<1e-12);
    assert.ok(images.every(c=>c[4]==="lighter"));
    assert.equal(new Set(images.map(c=>c[axis==="row"?2:1])).size,1);
    assert.equal(new Set(images.map(c=>c[axis==="row"?1:2])).size,17);
    assert.ok(draws.every(d=>d[0]!==ctx));
    assert.deepEqual(ctx.calls,[["image",axis==="row"?0:400,axis==="row"?200:0,1,"source-over"]]);
    assert.equal(layer.calls.filter(c=>c[0]==="fill").length,1);
    assert.equal(layer.calls.find(c=>c[0]==="fill").at(-1),"destination-in");
    assert.equal(layer.globalAlpha,1);assert.equal(layer.globalCompositeOperation,"source-over");
    assert.equal(ctx.globalAlpha,1);assert.equal(ctx.globalCompositeOperation,"source-over");
    const still=fakeContext(1000,600);const stops=[];
    painter(still,slotMotionFrame(motion,2050).lines,(...args)=>stops.push(args));
    assert.equal(still.calls.length,0);assert.deepEqual(stops,[[still,2,1,"kazberry",0,0]]);
  }
  assert.equal(buffers.length,4);
});

test("placing a berry and evaluating payouts retains the existing game result", () => {
  const before=grid.slice();
  for(const axis of ["row","column"]){
    const placement=placeSlotBerry(before,"kazberry",{axis,index:1,randomIndex:()=>0});
    const motion=createSlotLineMotion(before,{axis,indexes:[1]},{...options,targetGrid:placement.grid,preserveUnchanged:true});
    assert.deepEqual(resolveSlotPayouts(motion.targetGrid),resolveSlotPayouts(placement.grid));
    assert.deepEqual(before,grid);
  }
});


test("a blank row or column scrolls across its whole length until the chosen berry appears",()=>{
  const blank=Array(15).fill(null), target=blank.slice(); target[7]="star";
  for(const axis of ["row","column"]){
    const motion=createSlotLineMotion(blank,{axis,indexes:[axis==="row"?1:2]},{...options,targetGrid:target,preserveUnchanged:true});
    const f=slotMotionFrame(motion,900);
    assert.deepEqual(f.lines[0].positions,axis==="row"?[0,1,2,3,4]:[0,1,2]);
    assert.ok(f.lines[0].blur>0);
  }
});


test("parked symbols vibrate only on the affected track, deterministically and within cell margins", () => {
  for (const axis of ["row", "column"]) {
    for (let cell = 0; cell < 15; cell++) {
      const start = grid.map(s => s || "star"), target = start.slice();
      target[cell] = start[cell] === "kazberry" ? "erinberry" : "kazberry";
      const index = axis === "row" ? Math.floor(cell / 5) : cell % 5;
      const motion = createSlotLineMotion(start, {axis, indexes:[index]}, {...options,targetGrid:target,preserveUnchanged:true});
      const snapshot = structuredClone(motion);
      const affected = start.flatMap((s,i) => i !== cell && (axis === "row" ? Math.floor(i/5) : i%5) === index ? [i] : []);
      for (const time of [0,100,2050,10000]) {
        const f = slotMotionFrame(motion,time);
        assert.equal(f.parked.size,0); assert.equal(f.lines[0].feather,0);
      }
      const middle=slotMotionFrame(motion,900);
      assert.deepEqual([...middle.parked.keys()],affected);
      assert.ok(middle.lines[0].feather > .14 && middle.lines[0].feather <= .18);
      assert.deepEqual(middle,slotMotionFrame(motion,900));
      assert.notDeepEqual(middle.parked,slotMotionFrame(motion,940).parked);
      for (let t=100;t<=2050;t+=7) {
        const f=slotMotionFrame(motion,t);
        assert.deepEqual(f.grid,start.map((s,i)=>i===cell?null:s));
        for (const [i,offset] of f.parked) {
          assert.ok(affected.includes(i));
          assert.ok(Math.abs(offset.x) <= (axis === "row" ? .032 : .018)+1e-10);
          assert.ok(Math.abs(offset.y) <= (axis === "row" ? .018 : .032)+1e-10);
        }
      }
      for (const t of [101,2049]) {
        const f=slotMotionFrame(motion,t);
        assert.ok(f.lines[0].feather<1e-5);
        for(const offset of f.parked.values())assert.ok(Math.hypot(offset.x,offset.y)<1e-5);
      }
      assert.equal(slotMotionFrame(motion,900,true).parked.size,0);
      assert.equal(slotMotionFrame(motion,900,true).lines[0].feather,0);
      assert.deepEqual(motion,snapshot);
    }
  }
});

test("full, blank, instant, reduced and staggered tracks do not get inappropriate vibration or feathering",()=>{
  const target=grid.slice();target[0]="erinberry";target[1]="faroeberry";
  for (const extra of [{preserveUnchanged:false},{preserveUnchanged:true,reducedMotion:true},{preserveUnchanged:true,duration:0}]) {
    const motion=createSlotLineMotion(grid,{axis:"row",indexes:[0]},{...options,targetGrid:target,...extra});
    for(const t of [100,150,250,900,2050]){
      const f=slotMotionFrame(motion,t);assert.equal(f.parked.size,0);assert.equal(f.lines[0].feather,0);
    }
  }
  const motion=createSlotLineMotion(grid,{axis:"column",indexes:[0,1]},{...options,targetGrid:target,preserveUnchanged:true});
  const f=slotMotionFrame(motion,180);assert.equal(f.lines[1].feather,0);assert.ok([...f.parked.keys()].every(i=>i%5===0));
  const end=slotMotionFrame(motion,2100);assert.equal(end.lines[0].feather,0);assert.ok([...end.parked.keys()].every(i=>i%5===1));
});

test("feather ramps cover disjoint runs without dimming shared edges or leaking into gaps",()=>{
  for (const count of [3,5]) for(let mask=1;mask<(1<<count);mask++){
    const positions=Array.from({length:count},(_,i)=>i).filter(i=>mask&(1<<i));
    const stops=slotFeatherStops(positions,count,.18);
    assert.ok(stops.every(([x,a],i)=>x>=0&&x<=1&&[0,1].includes(a)&&(!i||x>=stops[i-1][0])));
    function alpha(x){for(let i=1;i<stops.length;i++){const [b,v]=stops[i], [a,u]=stops[i-1];if(x<=b&&b>a)return u+(v-u)*(x-a)/(b-a);}return 0;}
    for(let i=0;i<count;i++){
      assert.equal(alpha((i+.5)/count),positions.includes(i)?1:0);
      if(i>0)assert.equal(alpha(i/count),positions.includes(i)&&positions.includes(i-1)?1:0);
    }
  }
});
