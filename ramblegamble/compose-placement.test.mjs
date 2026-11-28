import test from "node:test";
import assert from "node:assert/strict";
import { migrateLegacyComposePlacements, normalizeComposePlacements, snapComposePlacement } from "./compose-placement.mjs";

test("compose placements allow multiple instances of the same item type", () => {
  const items = [{ label: "Star" }, { label: "Moon" }];
  assert.deepEqual(normalizeComposePlacements([
    { itemIndex: 0, x: 12, y: 25 },
    { itemIndex: 0, x: 48, y: 50 },
    { itemIndex: 1, x: 74, y: 20 },
  ], items), [
    { itemIndex: 0, x: 12, y: 25 },
    { itemIndex: 0, x: 48, y: 50 },
    { itemIndex: 1, x: 74, y: 20 },
  ]);
});

test("compose placements discard invalid references and clamp coordinates", () => {
  assert.deepEqual(normalizeComposePlacements([
    { itemIndex: 0, x: -20, y: 120 },
    { itemIndex: 3, x: 50, y: 50 },
    { itemIndex: 1, x: "bad", y: 50 },
    null,
  ], [{ label: "A" }, { label: "B" }]), [{ itemIndex: 0, x: 0, y: 100 }]);
});

test("legacy single-piece positions migrate without treating defaults as placements", () => {
  assert.deepEqual(migrateLegacyComposePlacements([
    { x: 8, y: 8 },
    { x: 30, y: 42 },
    { x: 44, y: 8 },
  ]), [{ itemIndex: 1, x: 30, y: 42 }]);
});

test("compose clicks snap the top-left of a doubled-size sprite to image grid cells", () => {
  const result = snapComposePlacement(101, 77, 880, 240, 16, 32);
  assert.deepEqual(result, { x: 80 / 880 * 100, y: 64 / 240 * 100 });
  assert.deepEqual(snapComposePlacement(0, 0, 880, 240, 16, 32), { x: 0, y: 0 });
});

import { alphaBounds, composeMarkerBox, composeVisibleSize, composeLiveCenter, composePointerPercent, drawComposeSprite } from './compose-placement.mjs';

test('alpha crop excludes transparent RGB padding but includes every partially visible edge pixel', () => {
  const width=13, height=9, rgba=new Uint8ClampedArray(width*height*4);
  rgba.fill(255); for(let i=3;i<rgba.length;i+=4)rgba[i]=0;
  const set=(x,y,a)=>rgba[(y*width+x)*4+3]=a;
  assert.equal(alphaBounds(rgba,width,height),null);
  set(9,1,1);set(5,7,128);set(6,4,255);
  assert.deepEqual(alphaBounds(rgba,width,height),{x:5,y:1,width:5,height:7});
  set(0,0,255);set(12,8,255);
  assert.deepEqual(alphaBounds(rgba,width,height),{x:0,y:0,width:13,height:9});
});

test('visible rectangle and legacy envelope share the same center at arbitrary aspect ratios',()=>{
  const sprite={bounds:{x:80,y:3,width:10,height:40}};
  assert.deepEqual(composeVisibleSize(sprite,32),{width:8,height:32});
  for(const [w,h] of [[880,240],[240,880],[10,6],[1920,1080]]){
    const x=w*.43,y=h*.62,p=snapComposePlacement(x,y,w,h,0,32);
    const box=composeMarkerBox(sprite,p.x,p.y,w,h,32);
    const size=Math.min(32,w,h);
    assert.ok(Math.abs((box.left+box.width/2)*w/100-(p.x*w/100+size/2))<1e-9);
    assert.ok(Math.abs((box.top+box.height/2)*h/100-(p.y*h/100+size/2))<1e-9);
    const at=composeLiveCenter(x,y,w,h);
    assert.ok(Math.abs(at[0]/10-(box.left+box.width/2))<=.050000001);
    assert.ok(Math.abs(at[1]/10-(box.top+box.height/2))<=.050000001);
  }
});

test('click coordinates use actual displayed image rect including fractional browser zoom',()=>{
  const r={left:123.4,top:72.9,width:331.5,height:95.25};
  assert.deepEqual(composePointerPercent(r.left,r.top,r),{x:0,y:0});
  const p=composePointerPercent(r.left+r.width/2,r.top+r.height/2,r);
  assert.ok(Math.abs(p.x-50)<1e-9);assert.ok(Math.abs(p.y-50)<1e-9);
  assert.deepEqual(composePointerPercent(999,-10,r),{x:100,y:0});
});

test('grid and edge clamp are preserved and canvas draws the cropped source rectangle centered',()=>{
  const image={},sprite={image,bounds:{x:70,y:19,width:10,height:40}}, calls=[];
  const ctx={drawImage(...args){calls.push(args);}};
  assert.equal(drawComposeSprite(ctx,sprite,100,80,32,.5,.75),true);
  assert.deepEqual(calls,[[image,70,19,10,40,98,68,4,24]]);
  assert.equal(ctx.imageSmoothingEnabled,false);
  assert.equal(drawComposeSprite(ctx,null,0,0,32),false);
  assert.deepEqual(composeLiveCenter(101,77,880,240,16),[109,333]);
  assert.deepEqual(composeLiveCenter(-100,10000,880,240,0),[18,933]);
});
