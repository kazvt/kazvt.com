import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as data from './trivia-data.js';
import { normalizeAcceptedAnswers } from './trivia-accepted-answers.mjs';
import { normalizeGuessLimit, isNumericTargetMode, resolveNumberTarget, parseTriviaNumber } from './trivia-game.mjs';
import { normalizeComposePlacements, migrateLegacyComposePlacements } from './compose-placement.mjs';
import { parseTriviaText, exportTriviaText } from './trivia-text.mjs';
import { createLiveTrivia, publicTriviaRound, validTriviaAnswer } from './live-trivia.mjs';
const source=readFileSync(new URL('./trivia-ui.js',import.meta.url),'utf8');
const effectiveSource=source.slice(source.indexOf('  function getEffectiveContent('),source.indexOf('  function setTab('));
function effective(round,difficulty,draft){
 const context={...data,modeNames:data.MODE_NAMES, drafts:{rounds:{[round]:draft}}, copy:v=>JSON.parse(JSON.stringify(v)), normalizeGuessLimit,isNumericTargetMode,resolveNumberTarget,parseTriviaNumber,normalizeComposePlacements,migrateLegacyComposePlacements,normalizeAcceptedAnswers};
 return JSON.parse(JSON.stringify(runInNewContext(`${effectiveSource}\ngetEffectiveContent(${JSON.stringify(round)},${difficulty})`,context)));
}
const items=Array.from({length:8},(_,i)=>({label:`Object ${i+1}`,image:`https://example.com/${i}.png`,asset:'',x:8+(i%5)*18,y:8+Math.floor(i/5)*18}));
test('legacy zero counts recover six default slots and preserve larger authored palettes',()=>{
 for(const count of [0,undefined,null,NaN,-1])assert.equal(data.resolveComposeTypeCount(count),6);
 assert.equal(data.resolveComposeTypeCount(0,items),8);
 assert.equal(data.resolveComposeTypeCount(2,items),2);
 assert.equal(data.resolveComposeTypeCount(100),24);
 for(let tier=1;tier<=5;tier++)assert.equal(effective('28',tier,{1:{optionCount:0}}).content.items.length,6);
});
test('actual editor resolution retains imported images and placement indices from a legacy zero-count draft',()=>{
 const {format,content}=effective('28',5,{1:{mode:'compose-image',optionCount:0,items,placements:[{itemIndex:7,x:25,y:40}]}});
 assert.equal(format.optionCount,8);assert.deepEqual(content.items,items);assert.deepEqual(content.placements,[{itemIndex:7,x:25,y:40}]);
 assert.equal(effective('28',1,{1:{optionCount:3,items}}).content.items.length,3);
});
test('switching a zero-choice template to placement creates editable object slots',()=>{
 const {format,content}=effective('25',1,{1:{mode:'compose-image',optionCount:0}});
 assert.equal(format.mode,'compose-image');assert.equal(format.optionCount,6);assert.equal(content.items.length,6);assert.equal(format.imageAspect,'11 / 3');assert.equal(format.gridSize,16);
 assert.equal(effective('25',1,{1:{mode:'short-answer',optionCount:0}}).content.items.length,0);
});
test('structured imports keep object types and positive count through all inherited tiers and public projection',()=>{
 for(const record of [{mode:'compose-image',items,optionCount:0},{mode:'Place images on the picture',items,optionCount:3},{objectTypes:['Tree','Rock']}]){
  const parsed=parseTriviaText(JSON.stringify({questions:[{round:28,question:'Place objects',...record}]}));
  assert.deepEqual(parsed.errors,[]);
  const expected=record.items?8:6;
  for(let tier=1;tier<=5;tier++)assert.equal(parsed.rounds['28'][tier].optionCount,expected);
  const {format,content}=effective('28',5,parsed.rounds['28']);
  const authored=content.items.filter(i=>i.label||i.image||i.asset);
  const round=createLiveTrivia({round:'28',difficulty:5,format,content:{...content,items:authored},cards:{},id:'test'});
  const projection=publicTriviaRound(round,'kaz');assert.equal(projection.question.items.length,record.items?8:2);assert.ok(projection.question.items.every(i=>!('x' in i)&&!('asset' in i)));assert.ok(!('secret' in projection));assert.ok(validTriviaAnswer(projection.question,{placements:[{item:0,at:[500,500]},{item:0,at:[100,200]}]}));
 }
});
test('exported legacy zero count is recovered without rewriting saved media references or placements',()=>{
 const draft={mode:'compose-image',optionCount:0,items:[{label:'A',image:'',asset:'stored-image',x:8,y:8}],placements:[{itemIndex:0,x:4,y:5}]};
 const parsed=parseTriviaText(exportTriviaText({rounds:{'28':{1:draft}}}));
 const {content}=effective('28',1,parsed.rounds['28']);assert.equal(content.items.length,6);assert.equal(content.items[0].asset,'stored-image');assert.deepEqual(content.placements,draft.placements);
});
test('text import retains placement mode and positive default slots, without adding multiple-choice options',()=>{
 const p=parseTriviaText('Round 28: Place the objects\nMode: Place images on the picture\nBackground image: https://example.com/board.png');
 assert.equal(p.rounds['28'][1].mode,'compose-image');assert.equal(p.rounds['28'][1].optionCount,6);assert.deepEqual(p.rounds['28'][1].options,[]);
});

test('matching and numeric editor resolver retains old image fields and repairs a legacy target',()=>{
 const pair={left:'answer name',leftImage:'https://example.test/answer_name.png',right:'Answer'};
 const matching=effective('21',1,{1:{mode:'match-pairs',pairs:[pair]}});assert.deepEqual(matching.content.pairs[0],pair);assert.equal(matching.format.pairCount,12);
 const custom=effective('01',1,{1:{mode:'match-pairs',pairs:[pair]}});assert.equal(custom.format.pairCount,1);assert.deepEqual(custom.content.pairs[0],pair);
 const legacy=effective('31',1,{1:{mode:'number-stepper',numberValue:0,acceptedAnswers:['42']}});assert.equal(legacy.content.numberValue,42);
 const zero=effective('31',1,{1:{mode:'number-stepper',numberValue:0,numberTargetSet:true,acceptedAnswers:['42']}});assert.equal(zero.content.numberValue,0);
 assert.equal(effective('31',1,{1:{mode:'number-stepper'}}).content.numberValue,null);
 assert.equal(effective('31',1,{1:{mode:'number-stepper',numberValue:0,numberCode:'1234'}}).content.numberValue,null);
});
