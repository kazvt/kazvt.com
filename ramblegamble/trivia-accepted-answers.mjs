// Host-only accepted-answer normalization. A JSON array element is a literal
// answer (including commas and pipes); only a legacy scalar list is split.
export function normalizeAcceptedAnswers(value) {
  const answers=[];
  function visit(entry, depth=0) {
    if(depth>12)return;
    if(typeof entry==='string'||typeof entry==='number'&&Number.isFinite(entry)) {
      const answer=String(entry).trim();if(answer)answers.push(answer);return;
    }
    if(Array.isArray(entry)){for(const part of entry)visit(part,depth+1);return;}
    if(!entry||typeof entry!=='object')return;
    const label=entry.text??entry.label??entry.answer??entry.name??entry.value;
    if(label!==undefined){visit(label,depth+1);if(Array.isArray(entry.aliases))visit(entry.aliases,depth+1);return;}
    // Explicit accepted lists can be grouped by category, e.g. franchises.
    // Never turn metadata/booleans or an arbitrary object into answer text.
    for(const part of Object.values(entry))if(Array.isArray(part))visit(part,depth+1);
  }
  if(typeof value==='string') {
    // Preserve the importer's existing scalar-list convention. JSON arrays
    // and editor lines are preferred for punctuation-containing phrases.
    const sep=/[\n|;]/.test(value)?/[\n|;]+/:/,/;
    if(/\b(?:https?:\/\/|data:)/i.test(value)&&!/[\n|;]/.test(value))visit(value);
    else value.split(sep).forEach(part=>visit(part));
  } else visit(value);
  return [...new Set(answers)];
}
export const acceptedAnswerKey = value => String(value??'').normalize('NFKC')
  .replace(/[\u200b\ufeff]/g,'').replace(/[\u2018\u2019\u02bc]/g,"'")
  .replace(/[\u2010\u2011]/g,'-').trim().toLowerCase().replace(/\s+/g,' ');
