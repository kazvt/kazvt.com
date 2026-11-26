// A small command tree matching points-commands.mjs. Suggestions replace only
// the active token (including text after the caret), never execute commands.
const names = ['faroe', 'erin', 'kaz'];
const cards = ['close', 'reveal', 'all', 'vote', 'results'];
const trivia = ['answers', 'close', 'next', 'previous', 'hide', 'show'];
const roots = ['help', 'clear', 'answers', 'points', 'berryblast', 'redhanded', 'red-handed', 'cards', 'smeemo', 'trivia'];
const numbers = n => Array.from({length:n}, (_,i) => String(i+1));

export function commandSuggestions(value, caret = value.length) {
  caret = Math.max(0, Math.min(value.length, caret));
  const before = value.slice(0, caret);
  const prefix = before.match(/\S*$/)[0];
  const start = caret - prefix.length;
  const end = caret + value.slice(caret).match(/^\S*/)[0].length;
  const prior = value.slice(0, start).trim().toLowerCase().split(/\s+/).filter(Boolean);
  const [root, sub] = prior;
  let choices = [];
  const playerNames = prefix.startsWith('@') ? names.map(n => '@'+n) : names;
  if (!prior.length) choices = roots;
  else if (root === 'points') {
    if (prior.length === 1) choices = [...playerNames, 'add', 'remove', 'set', 'reset'];
    else if (prior.length === 2 && ['add','remove','set','reset'].includes(sub)) choices = playerNames;
  } else if (['berryblast','redhanded','red-handed','cards'].includes(root)) {
    if (prior.length === 1) choices = root === 'cards' ? cards : ['start', ...cards];
    else if (prior.length === 2 && sub === 'reveal') choices = ['next','all'];
    else if (prior.length === 2 && sub === 'vote') choices = numbers(3);
  } else if (root === 'smeemo' && prior.length === 1) choices = ['start','reset'];
  else if (root === 'trivia') {
    if (prior.length === 1) choices = prefix.startsWith('0') ? numbers(9).map(n=>'0'+n) : [...trivia, ...numbers(36)];
    else if (prior.length === 2 && /^\d+$/.test(sub) && +sub>=1 && +sub<=36) choices = numbers(5);
  }
  const lower = prefix.toLowerCase();
  const options = choices.filter(x => x.startsWith(lower)).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
  // No useless list when the sole completion is already the complete token.
  return {value, start, end, caret, prefix, options: options.length === 1 && options[0] === value.slice(start,end) ? [] : options};
}

export function applyCommandSuggestion(session, index) {
  const token = session.options[index];
  if (token === undefined) return null;
  return {value:session.value.slice(0,session.start)+token+session.value.slice(session.end), caret:session.start+token.length};
}

export function completionWindow(index, count, offset=0) {
  return Math.max(0, Math.min(Math.max(0,count-3), index < offset ? index : index >= offset+3 ? index-2 : offset));
}

export function mountCommandCompletion(input, list, ghost) {
  let session = null, selected = 0, offset = 0, applied = false, composing = false, dismissed = false;
  let expectedValue = '', expectedCaret = 0;
  const measure = document.createElement('canvas').getContext('2d');
  function alignList() {
    if (!session || !measure) return;
    measure.font = getComputedStyle(input).font;
    const start = measure.measureText(session.value.slice(0,session.start)).width-input.scrollLeft;
    const width = Math.max(...session.options.map(option=>measure.measureText(option).width))+16;
    list.style.marginInlineStart=`${Math.max(0,Math.min(start,input.clientWidth-width))}px`;
  }
  const hide = () => {
    session=null; selected=0; offset=0; applied=false;
    list.replaceChildren(); list.hidden=true; ghost.textContent='';
    input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant');
  };
  function render() {
    const options=session?.options || [];
    if (!options.length) { hide(); return; }
    offset=completionWindow(selected,options.length,offset);
    list.replaceChildren(); list.hidden=false;
    options.slice(offset,offset+3).forEach((option,i)=>{
      const node=document.createElement('div');
      node.id=`terminal-suggestion-${offset+i}`; node.setAttribute('role','option');
      node.setAttribute('aria-selected',String(offset+i===selected)); node.textContent=option;
      node.addEventListener('pointerdown', event => event.preventDefault());
      node.addEventListener('click', () => { selected=offset+i; commit(); });
      list.append(node);
    });
    input.setAttribute('aria-expanded','true'); input.setAttribute('aria-activedescendant',`terminal-suggestion-${selected}`);
    ghost.replaceChildren();
    // Only draw a suffix when it won't overlap real text (middle-token edits
    // still offer range replacement through the three-line suggestion list).
    if (input.selectionStart === input.value.length && input.value === session.value && !applied && options[selected].startsWith(session.prefix.toLowerCase())) {
      const spacer=document.createElement('span'); spacer.textContent=input.value; spacer.className='terminal-ghost-prefix';
      ghost.append(spacer,document.createTextNode(options[selected].slice(session.prefix.length)));
    }
    ghost.scrollLeft=input.scrollLeft;
    alignList();
  }
  function refresh(force=false) {
    if (composing || document.activeElement!==input || input.selectionStart!==input.selectionEnd || (!force && !input.value.trim())) {hide();return;}
    dismissed=false; expectedValue=input.value; expectedCaret=input.selectionStart;
    session=commandSuggestions(input.value,input.selectionStart); selected=0;offset=0;applied=false;render();
  }
  function choose(direction) {selected=(selected+direction+session.options.length)%session.options.length;render();}
  function commit() {
    const next=applyCommandSuggestion(session,selected); if(!next)return;
    input.value=next.value;input.setSelectionRange(next.caret,next.caret);expectedValue=next.value;expectedCaret=next.caret;applied=true;render();
  }
  input.addEventListener('input',()=>{dismissed=false;refresh();});
  input.addEventListener('click',()=>refresh());
  input.addEventListener('focus',()=>{dismissed=false;refresh();});
  input.addEventListener('blur',hide);
  input.addEventListener('scroll',()=>{ghost.scrollLeft=input.scrollLeft;alignList();});
  input.addEventListener('compositionstart',()=>{composing=true;hide();});
  input.addEventListener('compositionend',()=>{composing=false;refresh();});
  // Called before the existing command-history handler; never intercept Enter.
  function handleKey(event) {
    if (composing || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return false;
    const key=event.key;
    if (key==='Escape' && session) {event.preventDefault();hide();dismissed=true;return true;}
    if (input.selectionStart!==input.selectionEnd) {hide();return false;}
    if (session && (expectedValue!==input.value || expectedCaret!==input.selectionStart)) refresh();
    if (key==='Tab') {
      if (dismissed) return false;
      if (!session && !event.shiftKey) refresh(true);
      if (!session) return false;
      event.preventDefault(); if(applied)choose(event.shiftKey?-1:1); else if(event.shiftKey)choose(-1);
      commit();return true;
    }
    if ((key==='ArrowUp'||key==='ArrowDown') && session && !event.shiftKey) {
      event.preventDefault();applied=false;choose(key==='ArrowUp'?-1:1);
      // After a committed Tab the original range remains valid for cycling;
      // don't display ghost over the changed text or skip the selected item.
      return true;
    }
    if (['ArrowLeft','ArrowRight','Home','End'].includes(key)) {hide();queueMicrotask(()=>refresh());}
    return false;
  }
  return {handleKey,hide,refresh};
}
