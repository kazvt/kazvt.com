// Area-preserving squash/stretch, anchored at the same world-space foot point.
// The base pose is immutable: framing never follows the temporary deformation.
export const SELECTION_MS=720;
const names={faroe:'FAROE',erin:'ERIN',kaz:'KAZ','lillie-host':'LILLIE'};
const colors={faroe:0x64e5a0,erin:0xc6a0ff,kaz:0xffe567,'lillie-host':0xff8cce};
export function selectedCharacterId(view){return view?.kind==='host'?'lillie-host':view?.kind==='contestant'?view.contestantId:null;}
export function selectionScale(age,reduced=false){
  if(reduced||!Number.isFinite(age)||age<=0||age>=SELECTION_MS)return {x:1,y:1};
  const t=age/SELECTION_MS;
  const y=1+.20*Math.sin(t*Math.PI*4.3)*(1-t)**2;
  return {x:1/y,y};
}
export function characterRenderPose(entry,age,reduced=false){
  const scale=selectionScale(age,reduced),worldHeight=entry.worldHeight*scale.y,worldWidth=entry.worldWidth*scale.x;
  return {anchor:{x:entry.anchor.x,y:entry.anchor.y+(worldHeight-entry.worldHeight)/2,z:entry.anchor.z},worldHeight,worldWidth};
}
const contestants=['faroe','erin','kaz'];
const assetPath='/ramblegamble/assets/berries/';
const numberFormat=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});

function makeTag(layer,id){
  const tag=document.createElement('div');tag.className='rg-character-tag';tag.hidden=true;
  tag.style.setProperty('--character-accent','#'+colors[id].toString(16).padStart(6,'0'));
  const title=document.createElement('div');title.className='rg-character-name';title.textContent=names[id];tag.append(title);
  const values={};
  if(contestants.includes(id)){
    tag.classList.add('rg-character-contestant-tag');
    const stats=document.createElement('div');stats.className='rg-character-stats';
    for(const [currency,label,asset] of [['points','Points','points-chip.png'],['stars','Stars','star.png']]){
      const row=document.createElement('div');row.className='rg-character-stat';
      const img=document.createElement('img');img.src=assetPath+asset;img.alt='';img.width=img.height=24;
      const caption=document.createElement('span');caption.className='rg-character-stat-label';caption.textContent=label;
      const value=document.createElement('span');value.className='rg-character-stat-value';value.textContent='0';values[currency]=value;
      row.append(img,caption,value);stats.append(row);
    }
    tag.append(stats);
  }
  layer.append(tag);
  return {tag,values,width:null,height:null,viewportWidth:null,dirty:true};
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
  const updateBalance=currency=>scores=>{
    for(const id of contestants){
      const state=tags.get(id),value=state.values[currency],text=numberFormat.format(scores[id]);
      if(value.textContent!==text){value.textContent=text;state.dirty=true;}
    }
  };
  const unsubscribe=[subscribePoints?.(updateBalance('points')),subscribeStars?.(updateBalance('stars'))];
  let lastId=null;
  function hide(){group.visible=false;for(const {tag} of tags.values())tag.hidden=true;layer.classList.remove('rg-group-stats-visible','rg-group-stats-partial');}
  function place(id,top,viewport,scale,lane){
    const state=tags.get(id);if(!state||!top)return false;
    const {tag}=state,available=lane.right-lane.left;
    if(available<64||viewport.height<48)return false;
    // Use non-overlapping lanes for group tags. Exact long balances wrap
    // within a lane rather than clipping or abbreviating the saved total.
    const width=contestants.includes(id)?Math.floor(Math.min(184,(available-12)/scale)):null;
    tag.hidden=false;
    if(state.width!==width){tag.style.width=width===null?'':`${width}px`;state.width=width;state.dirty=true;}
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
    return true;
  }
  function update(entry,time,age,reduced,viewport,occlusion,groupEntries=[]){
    const shown=new Set();
    if(entry?.projectedQuad&&entry.panel.style.visibility==='visible'){
      const id=entry.id,color=colors[id]||0xffffff;
      if(lastId!==id){lastId=id;for(const m of group.children)m.material.color.setHex(color);}
      group.visible=true;
      group.position.set(entry.anchor.x,entry.anchor.y-entry.worldHeight/2+.018,entry.anchor.z);
      inner.position.y=.002;arc.position.y=.004;pulse.position.y=.006;
      arc.rotation.z=reduced?0:time*.0019;
      const p=Math.max(0,Math.min(1,age/SELECTION_MS));pulse.visible=!reduced&&p<1;
      pulse.scale.setScalar(1+.65*p);pulse.material.opacity=.65*(1-p);
      base.material.opacity=reduced?.85:.78+.12*Math.sin(time*.003);
      if(viewport&&place(id,projectedHead(entry,viewport,occlusion),viewport,reduced?1:1+.13*Math.sin(Math.PI*p)*(1-p),{left:0,right:viewport.width}))shown.add(id);
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
        ordered.forEach((e,i)=>{const lane=equal?{left:i*laneWidth,right:(i+1)*laneWidth}:{left:edges[i],right:edges[i+1]};if(place(e.id,projectedHead(e,viewport,occlusion),viewport,1,lane))shown.add(e.id);});
      }
    }
    for(const [id,{tag}] of tags)if(!shown.has(id))tag.hidden=true;
    // Keep the existing global points HUD for all other views; in a complete
    // group view the nameplates already contain every score.
    layer.classList.toggle('rg-group-stats-visible',groupEntries.length>0&&shown.size===contestants.length);
    layer.classList.toggle('rg-group-stats-partial',groupEntries.length>0&&shown.size>0&&shown.size<contestants.length);
  }
  return {group,hide,update,dispose(){for(const stop of unsubscribe)stop?.();for(const {tag} of tags.values())tag.remove();layer.classList.remove('rg-group-stats-visible','rg-group-stats-partial');scene.remove(group);for(const m of group.children){m.geometry.dispose();m.material.dispose();}}};
}
