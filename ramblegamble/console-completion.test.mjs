import test from 'node:test';
import assert from 'node:assert/strict';
import {commandSuggestions,applyCommandSuggestion,completionWindow} from './console-completion.mjs';
import {parsePointsCommand} from './points-commands.mjs';
const options = (s,caret) => commandSuggestions(s,caret).options;
test('command and argument completions follow the existing grammar',()=>{
  assert.deepEqual(options('po'),['points']);
  assert.deepEqual(options('points r'),['remove','reset']);
  assert.deepEqual(options('points remove '),['erin','faroe','kaz']);
  assert.deepEqual(options('POINTS ADD @F'),['@faroe']);
  assert.deepEqual(options('points remove faroe '),[]);
  assert.deepEqual(options('cards reveal '),['all','next']);
  assert.deepEqual(options('cards vote '),['1','2','3']);
  assert.deepEqual(options('trivia 36 '),['1','2','3','4','5']);
  assert.deepEqual(options('trivia 37 '),[]);
  assert.deepEqual(options('berryblast start anything'),[]);
  assert.deepEqual(options('help '),[]);
  assert.deepEqual(options('points remove faroe'),[]);
  assert.ok(options('trivia ').includes('36'));
  assert.ok(options('trivia 0').includes('01'));
  assert.ok(!options('trivia ').includes('01'));
  assert.ok(!options('cards ').includes('start'));
});
test('completion replaces one token at caret and keeps remaining arguments',()=>{
  const line='  points remXXX   kaz  250';
  const session=commandSuggestions(line,12);
  assert.deepEqual(session.options,['remove']);
  const result=applyCommandSuggestion(session,0);
  assert.equal(result.value,'  points remove   kaz  250');
  assert.equal(result.caret,15);
  assert.deepEqual(parsePointsCommand(result.value),{action:'remove',name:'kaz',amount:250});
  assert.equal(applyCommandSuggestion(session,1),null);
  const middle=commandSuggestions('points add erxxx 19',13);
  assert.equal(applyCommandSuggestion(middle,0).value,'points add erin 19');
});
test('three-row window always contains selected item and never exceeds list bounds',()=>{
  for(let n=1;n<=60;n++)for(let i=0;i<n;i++)for(let old=0;old<n;old++){
    const start=completionWindow(i,n,old);assert.ok(start<=i && i<start+3);assert.ok(start>=0 && start<=Math.max(0,n-3));
  }
});
