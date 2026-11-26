import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gradeSimpleAnswer, isSimpleGradeMode } from './trivia-simple-grade.mjs';
import { createLiveTrivia, publicTriviaRound } from './live-trivia.mjs';
for(const mode of ['choice-text','choice-image','choice-image-wide'])for(const count of [6,10])test(`${count} ${mode} choices grade correctly without exposing the key`,()=>{
 const options=Array.from({length:count},(_,i)=>({label:mode==='choice-text'?`Answer ${i+1}`:'',image:mode==='choice-text'?'':`https://example.test/${i}.png`,correct:i===count-1}));
 const r=createLiveTrivia({round:'01',difficulty:1,format:{mode,optionCount:count},content:{question:'Question?',subtitle:'Small subtitle',options},cards:{}});const q=r.question;
 assert.equal(q.options.length,count);assert.equal(q.subtitle,'Small subtitle');assert.equal(gradeSimpleAnswer(q,r.secret,{selected:[count-1]}).state,'correct');assert.equal(gradeSimpleAnswer(q,r.secret,{selected:[0]}).state,'wrong');assert.equal(gradeSimpleAnswer(q,r.secret,{selected:[]}).state,'neutral');assert.equal(gradeSimpleAnswer(q,{correct:[]},{selected:[0]}).state,'neutral');assert.equal(gradeSimpleAnswer(q,r.secret,{selected:[count]}).state,'neutral');const projection=publicTriviaRound(r,'kaz');assert.ok(!('secret'in projection));assert.ok(projection.question.options.every(o=>!('correct'in o)));
});
test('typed answer accepts normalization and aliases, rejects wrong values without calling empty input wrong',()=>{
 const q={kind:'short-answer'},secret={accepted:['  Café   au lait ','COFFEE']};assert.ok(isSimpleGradeMode(q.kind));assert.equal(gradeSimpleAnswer(q,secret,{text:'cafe\u0301 au   LAIT'}).state,'correct');assert.equal(gradeSimpleAnswer(q,secret,{text:'ＣＯＦＦＥＥ'}).state,'correct');assert.equal(gradeSimpleAnswer(q,secret,{text:'tea'}).state,'wrong');assert.equal(gradeSimpleAnswer(q,secret,{text:' '}).state,'neutral');assert.equal(gradeSimpleAnswer(q,{accepted:[' ']},{text:'tea'}).state,'neutral');
});
test('multiple marked answers require the expected unique selection; no accidental correct grading',()=>{
 const q={kind:'choice-text',options:Array(6).fill({}),multiple:true,requiredCount:2};const secret={correct:[0,3]};assert.equal(gradeSimpleAnswer(q,secret,{selected:[3,0]}).state,'correct');assert.equal(gradeSimpleAnswer(q,secret,{selected:[0,1]}).state,'wrong');assert.equal(gradeSimpleAnswer(q,secret,{selected:[0,0]}).state,'neutral');assert.equal(gradeSimpleAnswer(q,{correct:[0]},{selected:[0,1]}).state,'neutral');
});
test('host preview and live presentation have matching wrong animation selectors and reduced motion',()=>{
 const html=readFileSync(new URL('../rg/index.html',import.meta.url),'utf8'),css=readFileSync(new URL('./host-console.css',import.meta.url),'utf8'),live=readFileSync(new URL('./trivia-live.css',import.meta.url),'utf8'),ui=readFileSync(new URL('./trivia-ui.js',import.meta.url),'utf8');assert.match(html,/id="rg-trivia-interface"/);assert.match(css,/#rg-trivia-interface\.is-error\s*\{\s*animation: rg-answer-shake/);assert.match(css,/#rg-trivia-interface\.is-error\s*\{\s*animation: none/);assert.match(live,/prefers-reduced-motion:no-preference\)\{\.rg-live-wrong/);assert.match(ui,/renderLiveQuestion\(liveContent,q,\{interactive:!!hostCheck,hostCheck\}\)/);
});
