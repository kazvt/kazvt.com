import { normalizeAcceptedAnswers, acceptedAnswerKey } from "./trivia-accepted-answers.mjs?v=accepted-20261128-v1";
// Host-only grading. This module receives the answer key only on the host;
// it never writes a contestant submission, score or public room snapshot.
const choices = new Set(['choice-text','choice-image','choice-image-wide','image-grid']);
export const isSimpleGradeMode = mode => mode==='short-answer'||choices.has(mode);
export const normalizeSimpleAnswer = acceptedAnswerKey;
export function gradeSimpleAnswer(question,secret,answer) {
  if(question?.kind==='short-answer'){
    const accepted=normalizeAcceptedAnswers(secret?.accepted).map(normalizeSimpleAnswer).filter(Boolean);
    if(!accepted.length)return {state:'neutral',text:'Set an accepted answer first.'};
    const given=normalizeSimpleAnswer(answer?.text);
    if(!given)return {state:'neutral',text:'Enter the answer given.'};
    return accepted.includes(given)?{state:'correct',text:'Correct!'}:{state:'wrong',text:'Not quite.'};
  }
  if(choices.has(question?.kind)){
    const count=question.options?.length||0;
    const correct=[...new Set(Array.isArray(secret?.correct)?secret.correct:[])].filter(i=>Number.isInteger(i)&&i>=0&&i<count);
    const required=question.multiple?question.requiredCount||correct.length:1;
    if(!correct.length||(question.multiple&&required!==correct.length))return {state:'neutral',text:'Mark the correct choices first.'};
    const selected=Array.isArray(answer?.selected)?answer.selected:[];
    if(!selected.length||selected.length!==required||new Set(selected).size!==selected.length||selected.some(i=>!Number.isInteger(i)||i<0||i>=count))return {state:'neutral',text:required===1?'Choose an answer.':`Choose ${required} answers.`};
    return selected.every(i=>correct.includes(i))?{state:'correct',text:'Correct!'}:{state:'wrong',text:'Not quite.'};
  }
  return {state:'neutral',text:'Check this answer manually.'};
}
