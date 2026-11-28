// Peripheral live portraits reuse the original iframe, never a second stream.
// Coverage is geometric; speaking is an explicit, origin-checked Fugi signal.
export const SIDE_ENTER_COVERAGE = .30;
export const SIDE_EXIT_COVERAGE = .46;
export const SIDE_SETTLE_MS = 140;
export const SPEECH_RELEASE_MS = 280;
export const SIDE_EXIT_MS = 240;
export const FUGI_ORIGIN = 'https://reactive.fugi.tech';
export const FUGI_SPEECH_TTL = 3500;
export const FUGI_REQUEST = 'rg:fugi-speaking:request:v1';
export const FUGI_STATE = 'rg:fugi-speaking:state:v1';

export function sideNeeded(coverage, previous = false) {
  return !Number.isFinite(coverage) || coverage < (previous ? SIDE_EXIT_COVERAGE : SIDE_ENTER_COVERAGE);
}

// Only accept the corresponding live frame, never arbitrary Discord messages,
// artwork changes, voice guesses or a stale state from another character.
export function createFugiSpeechBridge(target = window, clock = () => performance.now()) {
  const frames = new Map();
  const states = new Map();
  let lastPoll = -Infinity;
  function receive(event) {
    if (event.origin !== FUGI_ORIGIN || event.data?.type !== FUGI_STATE || ![true,false,null].includes(event.data.speaking)) return;
    for (const [entry, frame] of frames) if (event.source === frame.contentWindow) {
      states.set(entry,{speaking:event.data.speaking,at:clock()});return;
    }
  }
  target.addEventListener('message',receive);
  function track(entries) {
    for (const [entry,frame] of frames) if (!entries.includes(entry)||entry.panel.querySelector('iframe')!==frame) {
      frame.removeEventListener('load',frame.rgSpeechReset);delete frame.rgSpeechReset;frames.delete(entry);states.delete(entry);
    }
    for (const entry of entries) {
      if(frames.has(entry))continue;
      const frame=entry.panel.querySelector('iframe');
      if (!frame) continue;
      let url;try{url=new URL(frame.src);}catch{continue;}
      if(url.origin!==FUGI_ORIGIN || !/^\/basic\/\d+\/?$/.test(url.pathname))continue;
      frame.rgSpeechReset=()=>{states.delete(entry);lastPoll=-Infinity;};frame.addEventListener('load',frame.rgSpeechReset);frames.set(entry,frame);lastPoll=-Infinity;
    }
    const now=clock();if(now-lastPoll<1000)return;lastPoll=now;
    for(const frame of frames.values())frame.contentWindow?.postMessage({type:FUGI_REQUEST},FUGI_ORIGIN);
  }
  return {track,speaking(entry){const s=states.get(entry);return s?.speaking===true&&clock()-s.at<=FUGI_SPEECH_TTL;},available(){return [...states.values()].some(s=>typeof s.speaking==='boolean'&&clock()-s.at<=FUGI_SPEECH_TTL);},destroy(){track([]);target.removeEventListener('message',receive);states.clear();}};
}

// Stable hidden-cast slots, independent of speech. Bounds include the rotated
// square, so a 45-degree peek never overlaps the reserved central play area.
export function sidePortraitLayout(entries, {width, height}) {
  if (!(width > 0 && height > 0) || !entries.length) return {items:[],left:0,right:0};
  const split = Math.floor(entries.length / 2);
  const maxRows = entries.length - split;
  const rail = Math.min(280, width * (width <= 600 ? .20 : .18));
  const pad = Math.min(8, rail * .06);
  const top = height * .16, bottom = height * .12;
  const available = height - top - bottom;
  const gap = Math.min(10, available / (maxRows * 10));
  const size = Math.max(0, Math.min(rail - 2 * pad, (available - gap * (maxRows - 1)) / maxRows));
  const items = entries.map((entry, i) => {
    const left = i < split, index = left ? i : i - split, count = left ? split : maxRows;
    return {entry,side:left ? 'left':'right',size,x:left ? pad : width - size - pad,
      y:top + (available - count * size - (count - 1) * gap) / 2 + index * (size + gap)};
  });
  return {items,left:split ? size + 2 * pad : 0,right:size + 2 * pad};
}

function setVar(style, name, value) {
  if (style.getPropertyValue(name) !== value) style.setProperty(name,value);
}

export function createSidePortraits(preview, sourceSize) {
  const states = new Map();
  let tracked = [];
  function update(entries, coverage, viewport, time, enabled, speaking = () => false) {
    const missing = [];
    const ordered = [...entries].sort((a,b) => Number(a.id==='lillie-host')-Number(b.id==='lillie-host'));
    for (const entry of ordered) {
      if (!enabled) {states.delete(entry);continue;}
      let state = states.get(entry);
      const fraction = coverage(entry);
      const initial = sideNeeded(fraction);
      if (!state) {state={active:initial,pending:initial,since:time,lastSpeech:-Infinity,exitAt:null,shown:false};states.set(entry,state);}
      const next = sideNeeded(fraction,state.active);
      if (next !== state.pending) {state.pending=next;state.since=time;}
      if (next !== state.active && time-state.since>=SIDE_SETTLE_MS) state.active=next;
      if (state.active) {
        if(speaking(entry))state.lastSpeech=time;
        const wants=time-state.lastSpeech<=SPEECH_RELEASE_MS;
        if(wants){state.shown=true;state.exitAt=null;}
        else if(state.shown){if(state.exitAt===null)state.exitAt=time;if(time-state.exitAt>=SIDE_EXIT_MS)state.shown=false;}
        missing.push(entry);
      } else {state.shown=false;state.exitAt=null;state.lastSpeech=-Infinity;}
    }
    const layout = sidePortraitLayout(missing,viewport);
    const positions = new Map(layout.items.map(item=>[item.entry,item]));
    for (const entry of new Set([...tracked,...entries])) {
      const item=positions.get(entry), wrapper=entry.panel.parentElement, state=states.get(entry);
      entry.sidePortrait=!!item && !!state?.shown;
      wrapper.classList.toggle('rg-side-portrait',entry.sidePortrait);
      wrapper.classList.toggle('rg-side-exiting',entry.sidePortrait&&state.exitAt!==null);
      if (!entry.sidePortrait) continue;
      setVar(wrapper.style,'--rg-side-x',`${(item.x+item.size/2).toFixed(2)}px`);
      setVar(wrapper.style,'--rg-side-y',`${(item.y+item.size/2).toFixed(2)}px`);
      setVar(wrapper.style,'--rg-side-scale',String(item.size/Math.SQRT2/sourceSize));
      setVar(wrapper.style,'--rg-side-travel',`${Math.ceil(item.size+12)}px`);
      if(wrapper.dataset.side!==item.side)wrapper.dataset.side=item.side;
    }
    tracked=[...entries];
    for(const entry of states.keys())if(!entries.includes(entry))states.delete(entry);
    // Reserve the same slots throughout a camera view: no question reflow on
    // every syllable, no shifting when another hidden guest starts speaking.
    setVar(preview.style,'--rg-fugi-left',`${Math.ceil(layout.left)}px`);
    setVar(preview.style,'--rg-fugi-right',`${Math.ceil(layout.right)}px`);
    preview.classList.toggle('has-side-fugis',layout.items.length>0);
  }
  return {update,clear(){if(tracked.length)update([],()=>0,{width:0,height:0},0,false);states.clear();}};
}
