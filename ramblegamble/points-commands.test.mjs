import test from "node:test";
import assert from "node:assert/strict";
import { parsePointsCommand } from "./points-commands.mjs";

test("console commands inspect and add only the fixed contestants", () => {
  assert.deepEqual(parsePointsCommand("points"), { action: "inspect-all" });
  assert.deepEqual(parsePointsCommand("points FAROE"), { action: "inspect", name: "faroe" });
  assert.deepEqual(parsePointsCommand("points @Erin"), { action: "inspect", name: "erin" });
  assert.deepEqual(parsePointsCommand("points add kaz"), { action: "add", name: "kaz", amount: 1 });
  assert.deepEqual(parsePointsCommand("points add faroe 12"), { action: "add", name: "faroe", amount: 12 });
  assert.equal(parsePointsCommand("points add unknown").action, "error");
});

test("console rejects unsafe totals and malformed commands", () => {
  assert.equal(parsePointsCommand("points add kaz 0").action, "error");
  assert.equal(parsePointsCommand("points add kaz -1").action, "error");
  assert.equal(parsePointsCommand("points set erin 9007199254740992").action, "error");
  assert.equal(parsePointsCommand("points set erin 0").action, "set");
  assert.deepEqual(parsePointsCommand("points reset"), { action: "reset", name: null });
  assert.deepEqual(parsePointsCommand("points reset @kaz"), { action: "reset", name: "kaz" });
  assert.equal(parsePointsCommand("points add faroe nope").action, "error");
  assert.equal(parsePointsCommand("clear now").action, "error");
});

test("the console starts and resets Smeemo; card reveals remain manual on the room page", () => {
  assert.deepEqual(parsePointsCommand("smeemo start"), { action: "smeemo-start" });
  assert.deepEqual(parsePointsCommand("smeemo reset"), { action: "smeemo-reset" });
  assert.equal(parsePointsCommand("smeemo").action, "error");
  assert.equal(parsePointsCommand("smeemo draw").action, "error");
  assert.equal(parsePointsCommand("smeemo cheat").action, "error");
});

test('point removal defaults to one and rejects negative, zero, malformed and unsafe amounts',()=>{
  assert.deepEqual(parsePointsCommand('points remove KAZ'),{action:'remove',name:'kaz',amount:1});
  assert.deepEqual(parsePointsCommand('points REMOVE @Erin 10'),{action:'remove',name:'erin',amount:10});
  for(const command of ['points remove','points remove kaz 0','points remove kaz -1','points remove kaz 1.5','points remove kaz 9007199254740992','points remove unknown 2','points remove kaz 3 4']) assert.equal(parsePointsCommand(command).action,'error');
});

test('stars mirror points with a singular alias and give/take verbs, without changing point parser results',()=>{
  for(const root of ['star','stars','STARS']){
    assert.deepEqual(parsePointsCommand(root),{action:'inspect-all',currency:'stars'});
    assert.deepEqual(parsePointsCommand(`${root} @Erin`),{action:'inspect',name:'erin',currency:'stars'});
    for(const sub of ['add','give'])assert.deepEqual(parsePointsCommand(`${root} ${sub} FAROE`),{action:'add',name:'faroe',amount:1,currency:'stars'});
    for(const sub of ['remove','take'])assert.deepEqual(parsePointsCommand(`${root} ${sub} kaz 9`),{action:'remove',name:'kaz',amount:9,currency:'stars'});
    assert.deepEqual(parsePointsCommand(`${root} set kaz 0`),{action:'set',name:'kaz',total:0,currency:'stars'});
    assert.deepEqual(parsePointsCommand(`${root} reset`),{action:'reset',name:null,currency:'stars'});
    assert.deepEqual(parsePointsCommand(`${root} reset @faroe`),{action:'reset',name:'faroe',currency:'stars'});
    for(const suffix of ['give lillie 1','give kaz 0','give kaz -1','give kaz 1.5','give kaz 1e3','give kaz 9007199254740992','give kaz 1 2','set kaz -1','set kaz','reset everyone','reset kaz extra','constructor'])assert.equal(parsePointsCommand(`${root} ${suffix}`).action,'error');
  }
  assert.deepEqual(parsePointsCommand('points give erin 4'),{action:'add',name:'erin',amount:4});
  assert.deepEqual(parsePointsCommand('points take kaz'),{action:'remove',name:'kaz',amount:1});
});
