// Peripheral live portraits reuse the original iframe, never a second stream.
// Coverage is geometric (the cross-origin artwork's alpha is not readable).
export const SIDE_ENTER_COVERAGE = .30;
export const SIDE_EXIT_COVERAGE = .46;
export const SIDE_SETTLE_MS = 140;

export function sideNeeded(coverage, previous = false) {
  return !Number.isFinite(coverage) || coverage < (previous ? SIDE_EXIT_COVERAGE : SIDE_ENTER_COVERAGE);
}

// Stable cast order; floor(n/2) on the left, the remainder on the right.
// One common size keeps both rails balanced and all portraits inside the view.
export function sidePortraitLayout(entries, {width, height}) {
  if (!(width > 0 && height > 0) || !entries.length) return {items:[],left:0,right:0};
  const split = Math.floor(entries.length / 2);
  const maxRows = entries.length - split;
  const rail = Math.min(240, width * (width <= 600 ? .16 : .14));
  const pad = Math.min(6, rail * .06);
  const top = height * .16, bottom = height * .12;
  const available = height - top - bottom;
  const gap = Math.min(8, available / (maxRows * 10));
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
  function update(entries, coverage, viewport, time, enabled) {
    const missing = [];
    // Keep contestants first, Hazel as referee next, and the host last.
    const ordered = [...entries].sort((a,b) => Number(a.id==='lillie-host')-Number(b.id==='lillie-host'));
    for (const entry of ordered) {
      let state = states.get(entry);
      const fraction = coverage(entry);
      const initial = sideNeeded(fraction);
      if (!state) {state={active:initial,pending:initial,since:time};states.set(entry,state);}
      if (!enabled) {states.delete(entry);continue;}
      const next = sideNeeded(fraction,state.active);
      if (next !== state.pending) {state.pending=next;state.since=time;}
      if (next !== state.active && time-state.since>=SIDE_SETTLE_MS) state.active=next;
      if (state.active) missing.push(entry);
    }
    const layout = sidePortraitLayout(missing,viewport);
    const positions = new Map(layout.items.map(item=>[item.entry,item]));
    for (const entry of new Set([...tracked,...entries])) {
      const item=positions.get(entry), wrapper=entry.panel.parentElement;
      entry.sidePortrait=!!item;
      if (!item) {wrapper.classList.remove('rg-side-portrait');continue;}
      setVar(wrapper.style,'--rg-side-x',`${item.x.toFixed(2)}px`);
      setVar(wrapper.style,'--rg-side-y',`${item.y.toFixed(2)}px`);
      setVar(wrapper.style,'--rg-side-scale',String(item.size/sourceSize));
      if(wrapper.dataset.side!==item.side)wrapper.dataset.side=item.side;
      wrapper.classList.add('rg-side-portrait');
    }
    tracked=[...entries];
    for(const entry of states.keys())if(!entries.includes(entry))states.delete(entry);
    setVar(preview.style,'--rg-fugi-left',`${Math.ceil(layout.left)}px`);
    setVar(preview.style,'--rg-fugi-right',`${Math.ceil(layout.right)}px`);
    preview.classList.toggle('has-side-fugis',layout.items.length>0);
  }
  return {update,clear(){if(tracked.length)update([],()=>0,{width:0,height:0},0,false);states.clear();}};
}
