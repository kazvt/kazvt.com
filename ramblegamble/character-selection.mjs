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
export function createCharacterSelection(THREE,scene,layer){
  const group=new THREE.Group();group.name='rg-character-selection';group.visible=false;scene.add(group);
  const ring=(inner,outer,opacity,start=0,length=Math.PI*2)=>{
    const m=new THREE.Mesh(new THREE.RingGeometry(inner,outer,64,1,start,length),new THREE.MeshBasicMaterial({color:0xffffff,opacity,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    m.rotation.x=-Math.PI/2;group.add(m);return m;
  };
  const base=ring(.39,.435,.85),inner=ring(.30,.315,.45),arc=ring(.45,.49,.92,0,Math.PI*.7),pulse=ring(.41,.44,.55);
  const tag=document.createElement('div');tag.className='rg-character-tag';tag.hidden=true;layer.append(tag);
  let lastId=null;
  function hide(){group.visible=false;tag.hidden=true;}
  function update(entry,time,age,reduced,viewport,occlusion){
    if(!entry?.projectedQuad||entry.panel.style.visibility!=='visible'){hide();return;}
    const id=entry.id,color=colors[id]||0xffffff;
    if(lastId!==id){lastId=id;tag.textContent=names[id]||'';tag.style.setProperty('--character-accent','#'+color.toString(16).padStart(6,'0'));for(const m of group.children)m.material.color.setHex(color);}
    group.visible=true;
    group.position.set(entry.anchor.x,entry.anchor.y-entry.worldHeight/2+.018,entry.anchor.z);
    inner.position.y=.002;arc.position.y=.004;pulse.position.y=.006;
    arc.rotation.z=reduced?0:time*.0019;
    const p=Math.max(0,Math.min(1,age/SELECTION_MS));pulse.visible=!reduced&&p<1;
    pulse.scale.setScalar(1+.65*p);pulse.material.opacity=.65*(1-p);
    base.material.opacity=reduced?.85:.78+.12*Math.sin(time*.003);
    const [a,b,c,d]=entry.projectedQuad.corners;
    const top={x:(a.x+b.x)/2,y:(a.y+b.y)/2},bottom={x:(c.x+d.x)/2,y:(c.y+d.y)/2};
    // Suppress the nameplate when the upper portion is behind solid scenery.
    const headVisible=[.12,.22,.34].some(t=>occlusion?.contains(entry,top.x+(bottom.x-top.x)*t,top.y+(bottom.y-top.y)*t));
    if(!headVisible||!viewport||top.x<0||top.x>viewport.width||top.y>viewport.height){tag.hidden=true;return;}
    tag.hidden=false;
    tag.style.left=`${Math.max(48,Math.min(viewport.width-48,top.x)).toFixed(2)}px`;
    tag.style.top=`${Math.max(38,top.y-8).toFixed(2)}px`;
    tag.style.transform=`translate(-50%, -100%) scale(${reduced?1:1+.13*Math.sin(Math.PI*p)*(1-p)})`;
  }
  return {group,hide,update,dispose(){tag.remove();scene.remove(group);for(const m of group.children){m.geometry.dispose();m.material.dispose();}}};
}
