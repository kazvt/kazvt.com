import { SCORE_FORMAT as numberFormat, balanceDuration, balanceFrame, balanceLayout, balanceParticles } from './score-motion.mjs?v=compact-score-20261127-v1';
// Area-preserving squash/stretch, anchored at the same world-space foot point.
// The base pose is immutable: framing never follows the temporary deformation.
export const SELECTION_MS=720;
const names={faroe:'FAROE',erin:'ERIN',kaz:'KAZ','lillie-host':'LILLIE',hazel:'HAZEL'};
const colors={faroe:0x64e5a0,erin:0xc6a0ff,kaz:0xffe567,'lillie-host':0xff8cce,hazel:0xd2adff};
export function selectedCharacterId(view){return view?.kind==='host'?'lillie-host':view?.kind==='hazel'?'hazel':view?.kind==='contestant'?view.contestantId:null;}
export function selectionScale(age,reduced=false){
  if(reduced||!Number.isFinite(age)||age<=0||age>=SELECTION_MS)return {x:1,y:1};
  const t=age/SELECTION_MS;
  const y=1+.20*Math.sin(t*Math.PI*4.3)*(1-t)**2;
  return {x:1/y,y};
}
export function characterRenderPose(entry,age,reduced=false,{time,reactAge=Infinity,delta=0}={}){
  const scale=selectionScale(age,reduced||entry.seated);
  const idle=!reduced&&!entry.seated&&Number.isFinite(time)?1+.013*Math.sin(time/670+(entry.id?.charCodeAt(0)||0)*1.7):1;
  const reaction=!reduced&&!entry.seated&&reactAge>=0&&reactAge<680?Math.sin(reactAge/680*Math.PI*3)*(1-reactAge/680)**2*(delta>0?.12:-.075):0;
  const y=Math.max(.85,Math.min(1.2,scale.y*idle+reaction)),worldHeight=entry.worldHeight*y,worldWidth=entry.worldWidth/y;
  const hop=!reduced&&!entry.seated&&delta>0&&reactAge>=0&&reactAge<520?entry.worldHeight*.032*Math.sin(Math.PI*reactAge/520)**2:0;
  return {anchor:{x:entry.anchor.x,y:entry.anchor.y+(worldHeight-entry.worldHeight)/2+hop,z:entry.anchor.z},worldHeight,worldWidth};
}
const contestants=['faroe','erin','kaz'];
const assetPath='/ramblegamble/assets/berries/';


function makeTag(layer,id){
  const tag=document.createElement('div');tag.className='rg-character-tag';tag.hidden=true;
  tag.setAttribute?.('data-rg-profile',id);tag.setAttribute?.('role','button');tag.setAttribute?.('aria-haspopup','dialog');tag.tabIndex=0;
  tag.style.setProperty('--character-accent','#'+colors[id].toString(16).padStart(6,'0'));
  const title=document.createElement('div');title.className='rg-character-name';title.textContent=names[id];tag.append(title);
  const values={};
  if(contestants.includes(id)){
    tag.classList.add('rg-character-contestant-tag');
    const stats=document.createElement('div');stats.className='rg-character-stats';
    for(const [currency,label,asset] of [['points','Points','points-chip.png'],['stars','Stars','star.png']]){
      const row=document.createElement('div');row.className='rg-character-stat';
      const img=document.createElement('img');img.src=assetPath+asset;img.alt='';img.width=img.height=24;
      const caption=document.createElement('span');caption.className='rg-character-stat-label';caption.textContent=label;row.setAttribute?.('role','img');row.setAttribute?.('aria-label',`${label}: 0`);
      const value=document.createElement('span');value.className='rg-character-stat-value';value.textContent='0';values[currency]=value;
      row.append(img,caption,value);stats.append(row);
    }
    tag.append(stats);
  }
  layer.append(tag);
  return {tag,values,balances:{},effects:{},width:null,height:null,viewportWidth:null,dirty:true,reactAt:-Infinity,delta:0};
}
function projectedHead(entry,viewport,occlusion){
  if(!entry?.projectedQuad||entry.panel.style.visibility!=='visible'||!viewport)return null;
  const [a,b,c,d]=entry.projectedQuad.corners;
  const top={x:(a.x+b.x)/2,y:(a.y+b.y)/2},bottom={x:(c.x+d.x)/2,y:(c.y+d.y)/2};
  // Same upper-plane visibility check as the original focus nameplate.
  if(![.12,.22,.34].some(t=>occlusion?.contains(entry,top.x+(bottom.x-top.x)*t,top.y+(bottom.y-top.y)*t)))return null;
  if(top.x<0||top.x>viewport.width||top.y>viewport.height)return null;
  return top;
}

export function createCharacterSelection(THREE,scene,layer,{subscribePoints,subscribeStars}={}){
  const group=new THREE.Group();group.name='rg-character-selection';group.visible=false;scene.add(group);
  const ring=(inner,outer,opacity,start=0,length=Math.PI*2)=>{
    const m=new THREE.Mesh(new THREE.RingGeometry(inner,outer,64,1,start,length),new THREE.MeshBasicMaterial({color:0xffffff,opacity,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    m.rotation.x=-Math.PI/2;group.add(m);return m;
  };
  const base=ring(.39,.435,.85),inner=ring(.30,.315,.45),arc=ring(.45,.49,.92,0,Math.PI*.7),pulse=ring(.41,.44,.55);
  const tags=new Map(Object.keys(names).map(id=>[id,makeTag(layer,id)]));
  const canAnimate=state=>!state.tag.hidden&&typeof window!=='undefined'&&!document.hidden&&!document.documentElement.hasAttribute('data-rg-host-locked')&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clearEffect(state,currency){
    const effect=state.effects[currency];if(!effect)return;
    for(const a of effect.animations)a.cancel();effect.overlay.remove();delete state.effects[currency];
  }
  function paintBalance(state,currency,n){const value=state.values[currency],text=numberFormat.format(n);if(value.textContent!==text)value.textContent=text;}
  function finish(state){for(const [currency,b] of Object.entries(state.balances)){if(b.from!==b.target)state.dirty=true;b.from=b.shown=b.target;b.duration=0;paintBalance(state,currency,b.target);clearEffect(state,currency);}state.reactAt=-Infinity;}
  function animateAward(state,currency,delta){
    clearEffect(state,currency);
    const value=state.values[currency],row=value.parentElement,icon=row?.querySelector('img');
    if(!row?.animate||!icon)return;
    const overlay=document.createElement('span');overlay.className='rg-balance-fx';overlay.setAttribute('aria-hidden','true');row.append(overlay);
    const positive=delta>0,star=currency==='stars',count=balanceParticles(currency,delta),animations=[];
    const badge=document.createElement('span');badge.className='rg-balance-delta';badge.textContent=`${positive?'+':'−'}${numberFormat.format(Math.abs(delta))}`;badge.style.color=positive?(star?'#ffe567':'#bfeaff'):'#ffb0bb';overlay.append(badge);
    animations.push(badge.animate([{transform:'translate(-50%,0) scale(.8)',opacity:0},{transform:'translate(-50%,8px) scale(1.08)',opacity:1,offset:.19},{transform:'translate(-50%,13px)',opacity:1,offset:.72},{transform:'translate(-50%,24px)',opacity:0}],{duration:star?1200:980,fill:'both'}));
    for(let i=0;i<count;i++){
      const token=document.createElement('img');token.className='rg-balance-token';token.src=icon.src;token.alt='';overlay.append(token);
      const angle=(i/count)*Math.PI*2,dx=Math.cos(angle)*(22+i%3*8),dy=Math.sin(angle)*20-14;
      const outside={transform:`translate(${dx}px,${dy}px) rotate(${i*72-180}deg) scale(.65)`,opacity:0},middle={transform:`translate(${dx*.7}px,${dy*.7-7}px) rotate(${i*40}deg) scale(1.1)`,opacity:1},inside={transform:'translate(0,0) scale(.35)',opacity:0};
      animations.push(token.animate(positive?[outside,middle,inside]:[inside,middle,outside],{duration:star?690:470,delay:i*43,fill:'both',easing:'ease-out'}));
    }
    animations.push(icon.animate(positive?[{transform:'scale(1)'},{transform:star?'scale(1.55) rotate(22deg)':'scale(1.25)'},{transform:'scale(1)'}]:[{transform:'none'},{transform:'translateX(-3px) rotate(-12deg)'},{transform:'translateX(2px)'},{transform:'none'}],{duration:star?700:430}));
    // The row itself never moves, preserving measured widths and the projected anchor.
    animations.push(value.animate([{opacity:.78},{opacity:1,color:positive?'#fff5b8':'#ffb0bb',offset:.3},{opacity:1}],{duration:550}));
    if(positive&&(star||Math.abs(delta)>=10000)){const ring=document.createElement('span');ring.className='rg-balance-ring';overlay.append(ring);animations.push(ring.animate([{transform:'scale(.88)',opacity:0},{transform:'scale(1.04)',opacity:.9,offset:.3},{transform:'scale(1.23)',opacity:0}],{duration:star?850:620,fill:'both'}));}
    const effect={overlay,animations};state.effects[currency]=effect;
    Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(state.effects[currency]===effect){overlay.remove();delete state.effects[currency];}});
  }
  const updateBalance=currency=>scores=>{
    for(const id of contestants){
      const state=tags.get(id),target=scores[id],previous=state.balances[currency];
      if(previous?.target===target)continue;
      const delta=target-(previous?.target??target),animate=!!previous&&canAnimate(state)&&delta!==0,now=typeof performance!=='undefined'?performance.now():0;
      const shown=animate?balanceFrame(previous.from,previous.target,now-previous.started,previous.duration):target;
      state.balances[currency]={from:shown,shown,target,started:now,duration:animate?balanceDuration(delta,currency):0};
      state.values[currency].parentElement?.setAttribute('aria-label',`${currency==='stars'?'Stars':'Points'}: ${numberFormat.format(target)}`);
      paintBalance(state,currency,shown);state.dirty=true;
      if(animate){state.reactAt=now;state.delta=delta;animateAward(state,currency,delta);}else clearEffect(state,currency);
    }
  };
  const unsubscribe=[subscribePoints?.(updateBalance('points')),subscribeStars?.(updateBalance('stars'))];
  let lastId=null;
  function hide(){group.visible=false;for(const state of tags.values()){state.tag.hidden=true;finish(state);}layer.classList.remove('rg-group-stats-visible','rg-group-stats-partial');}
  function place(id,top,viewport,scale,lane,time,reduced){
    const state=tags.get(id);if(!state||!top)return false;
    const {tag}=state,available=lane.right-lane.left;
    if(available<64||viewport.height<48)return false;
    // Fit exact single-line balances in a non-overlapping seat lane. Allocate
    // more width only for unusually long totals; never break an individual number.
    const entering=tag.hidden;tag.hidden=false;
    if(reduced||!canAnimate(state))finish(state);
    else for(const [currency,b] of Object.entries(state.balances)){if(b.duration){b.shown=balanceFrame(b.from,b.target,time-b.started,b.duration);paintBalance(state,currency,b.shown);if(time-b.started>=b.duration){b.duration=0;b.from=b.target;state.dirty=true;}}}
    const p=state.balances.points,s=state.balances.stars;
    const maxP=Math.max(p?.from??0,p?.target??0),maxS=Math.max(s?.from??0,s?.target??0);
    const chars=numberFormat.format(maxP).length+numberFormat.format(maxS).length;
    const width=contestants.includes(id)?Math.floor(Math.min(Math.max(140,chars*10+62), (available-12)/scale)):null;
    if(state.width!==width||state.dirty){
      tag.style.width=width===null?'':`${width}px`;state.width=width;state.dirty=true;
      if(width!==null){const fit=balanceLayout(width,maxP,maxS);tag.style.setProperty('--balance-icon',`${fit.icon}px`);tag.style.setProperty('--balance-gap',`${fit.gap}px`);tag.style.setProperty('--balance-font',`${fit.font}px`);tag.style.setProperty('--balance-name',`${Math.min(22,(width-14)/4.2)}px`);state.values.points.style.minWidth=`${fit.p}ch`;state.values.stars.style.minWidth=`${fit.s}ch`;}
    }
    if(state.dirty||state.viewportWidth!==viewport.width){
      state.height=tag.offsetHeight;state.measuredWidth=tag.offsetWidth;state.viewportWidth=viewport.width;state.dirty=false;
    }
    const half=state.measuredWidth*scale/2+6,height=state.height*scale;
    if(half*2>available||height+14>viewport.height){tag.hidden=true;return false;}
    const x=Math.max(lane.left+half,Math.min(lane.right-half,top.x));
    const y=Math.max(height+6,Math.min(viewport.height-8,top.y-8));
    tag.style.left=`${x.toFixed(2)}px`;tag.style.top=`${y.toFixed(2)}px`;
    const arrow=Math.max(9,Math.min(state.measuredWidth-9,state.measuredWidth/2+(top.x-x)/scale));
    tag.style.setProperty('--character-arrow-x',`${arrow.toFixed(2)}px`);
    tag.style.transform=`translate(-50%, -100%) scale(${scale})`;
    if(entering&&!reduced&&canAnimate(state))tag.children[0].animate?.([{transform:'translateY(3px) scale(.9)',opacity:.45},{transform:'translateY(-1px) scale(1.045)',opacity:1,offset:.65},{transform:'none',opacity:1}],{duration:id==='hazel'?520:330,easing:'ease-out'});
    return true;
  }
  function update(entry,time,age,reduced,viewport,occlusion,groupEntries=[]){
    const shown=new Set();
    if(entry?.projectedQuad&&entry.panel.style.visibility==='visible'){
      const id=entry.id,color=colors[id]||0xffffff;
      if(lastId!==id){lastId=id;for(const m of group.children)m.material.color.setHex(color);}
      // A floor ring would float or intersect the balcony; use the nameplate
      // and focus arrow only for the seated guest.
      group.visible=!entry.seated;
      group.position.set(entry.anchor.x,entry.anchor.y-entry.worldHeight/2+.018,entry.anchor.z);
      inner.position.y=.002;arc.position.y=.004;pulse.position.y=.006;
      arc.rotation.z=reduced?0:time*.0019;
      const p=Math.max(0,Math.min(1,age/SELECTION_MS));pulse.visible=!reduced&&p<1;
      pulse.scale.setScalar(1+.65*p);pulse.material.opacity=.65*(1-p);
      base.material.opacity=reduced?.85:.78+.12*Math.sin(time*.003);
      if(viewport&&place(id,projectedHead(entry,viewport,occlusion),viewport,reduced?1:1+.13*Math.sin(Math.PI*p)*(1-p),{left:0,right:viewport.width},time,reduced))shown.add(id);
    }else{
      group.visible=false;
      if(viewport&&groupEntries.length){
        // Order by projected seat, never by score. Keep empty/occluded lanes
        // reserved so another player's label cannot jump to the wrong seat.
        const headX=e=>(e.projectedQuad.corners[0].x+e.projectedQuad.corners[1].x)/2;
        const ordered=groupEntries.filter(e=>contestants.includes(e.id)&&e.projectedQuad).sort((a,b)=>headX(a)-headX(b)||contestants.indexOf(a.id)-contestants.indexOf(b.id));
        const edges=[0,...ordered.slice(1).map((e,i)=>Math.max(0,Math.min(viewport.width,(headX(ordered[i])+headX(e))/2))),viewport.width];
        // Prefer the actual projected seat midpoints; for a very compressed
        // perspective fall back to equal screen lanes to keep text legible.
        const laneWidth=viewport.width/ordered.length;
        const minLane=Math.min(120,laneWidth*.9);
        const equal=edges.slice(1).some((right,i)=>right-edges[i]<minLane);
        ordered.forEach((e,i)=>{const lane=equal?{left:i*laneWidth,right:(i+1)*laneWidth}:{left:edges[i],right:edges[i+1]};if(place(e.id,projectedHead(e,viewport,occlusion),viewport,1,lane,time,reduced))shown.add(e.id);});
      }
    }
    for(const [id,state] of tags)if(!shown.has(id)){state.tag.hidden=true;finish(state);}
    // Keep the existing global points HUD for all other views; in a complete
    // group view the nameplates already contain every score.
    layer.classList.toggle('rg-group-stats-visible',groupEntries.length>0&&shown.size===contestants.length);
    layer.classList.toggle('rg-group-stats-partial',groupEntries.length>0&&shown.size>0&&shown.size<contestants.length);
  }
  return {group,hide,update,setNames(profiles){for(const [id,state] of tags){const name=profiles[id]?.name;if(!name)continue;state.tag.children[0].textContent=name.toUpperCase();state.tag.title=name;state.dirty=true;}},reaction(id,time){const s=tags.get(id);return {reactAge:time-(s?.reactAt??-Infinity),delta:s?.delta??0};},dispose(){hide();for(const stop of unsubscribe)stop?.();for(const {tag} of tags.values())tag.remove();layer.classList.remove('rg-group-stats-visible','rg-group-stats-partial');scene.remove(group);for(const m of group.children){m.geometry.dispose();m.material.dispose();}}};
}
