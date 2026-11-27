// One marker for the current camera destination, never a second cursor.
export const FOCUS_ARROW_ANIMATION_MS = 3200;
const assets='/ramblegamble/assets/provided/focus-arrow';
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
export function focusArrowKey(view){
  if(view?.kind==='contestant')return ['faroe','erin','kaz'].includes(view.contestantId)?`contestant:${view.contestantId}`:null;
  return ['host','hazel','contestants','slot','roulette','dice-door','dice','card-table','trivia'].includes(view?.kind)?view.kind:null;
}
export function screenBounds(points){
  if(!points?.length||!points.every(finite))return null;
  return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
}
// A circular rim or a perspective trapezoid has empty space in the corners
// of its axis-aligned rectangle. Aim at an actual projected contour point.
export function projectedArrowTarget(points,viewport){
  const bounds=screenBounds(points);if(!bounds)return null;
  const w=bounds.right-bounds.left,h=bounds.bottom-bounds.top;
  if(w<=0||h<=0)return null;
  const visible=points.filter(p=>p.x>=0&&p.x<=viewport.width&&p.y>=0&&p.y<=viewport.height);
  if(!visible.length)return null;
  const score=p=>(p.x-bounds.left)/w+(p.y-bounds.top)/h;
  visible.sort((a,b)=>score(a)-score(b));
  return {bounds,aim:visible[0],alternates:visible.slice(1)};
}
// Point into the visible upper-left portion of a Fugi plane. Actual iframe
// artwork is cross-origin; use the same occlusion map as its live nameplate.
export function characterArrowTarget(entry,viewport,occlusion){
  if(entry?.panel?.style.visibility!=='visible'||!entry.projectedQuad||!occlusion)return null;
  const corners=entry.projectedQuad.corners;
  const bounds=screenBounds(corners);if(!bounds)return null;
  const [a,b,c,d]=corners;
  for(const [u,v] of [[.16,.16],[.08,.08],[.24,.16],[.32,.20],[.12,.28],[.25,.32],[.36,.30],[.42,.36]]){
    const p={x:(a.x+(b.x-a.x)*u)*(1-v)+(d.x+(c.x-d.x)*u)*v,y:(a.y+(b.y-a.y)*u)*(1-v)+(d.y+(c.y-d.y)*u)*v};
    if(p.x>=0&&p.y>=0&&p.x<=viewport.width&&p.y<=viewport.height&&occlusion.contains(entry,p.x,p.y))return {bounds,aim:p};
  }
  return null;
}
// A right-facing 2:1 image rotates around its actual tip (62,16 in 64x32).
// Place the complete rotated sprite outside the top-left whenever possible.
// At an extreme viewport edge, shrink or use the visible upper-left interior,
// never pin an arrow to an unrelated screen edge or point backwards.
export function focusArrowPose(target,viewport){
  const b=target?.bounds, w=viewport?.width,h=viewport?.height;
  if(!b||![b.left,b.right,b.top,b.bottom,w,h].every(Number.isFinite)||w<40||h<40||b.right<=0||b.bottom<=0||b.left>=w||b.top>=h||b.right<=b.left||b.bottom<=b.top)return null;
  const l=Math.max(0,b.left),t=Math.max(0,b.top),r=Math.min(w,b.right),bot=Math.min(h,b.bottom);
  if(r-l<8||bot-t<8)return null;
  const aim=finite(target.aim)?target.aim:{x:l+Math.min(8,(r-l)*.12),y:t+Math.min(8,(bot-t)*.12)};
  if(aim.x<0||aim.x>w||aim.y<0||aim.y>h)return null;
  const size=Math.max(32,Math.min(64,Math.min(w,h)*.105));
  const angles=[45,30,60];
  function tryPose(ax,ay,width,angle,gap){
    const rad=angle*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad),height=width/2;
    const tipX=ax-gap*cos,tipY=ay-gap*sin;
    const ox=width*62/64,oy=height/2;
    const corners=[[-ox,-oy],[width-ox,-oy],[width-ox,height-oy],[-ox,height-oy]].map(([x,y])=>({x:tipX+x*cos-y*sin,y:tipY+x*sin+y*cos}));
    if(corners.some(p=>p.x<3||p.y<3||p.x>w-3||p.y>h-3))return null;
    return {left:tipX-ox,top:tipY-oy,width,height,angle,tipX,tipY,aimX:ax,aimY:ay};
  }
  // First try the true outside corner, while pointing into the subject.
  const cornerX=Math.min(aim.x,l),cornerY=Math.min(aim.y,t);
  for(const width of [size,size*.8,24])for(const angle of angles){
    const rad=angle*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
    const gap=Math.max(6,(aim.x-cornerX+4)/cos,(aim.y-cornerY+4)/sin);
    const pose=tryPose(aim.x,aim.y,width,angle,gap);if(pose)return pose;
  }
  // On a tightly framed target the original corner can be outside the view.
  // Keep aiming at the same verified point; only shorten the gap/arrow.
  for(const width of [size*.8,24,18])for(const angle of angles){const pose=tryPose(aim.x,aim.y,width,angle,3);if(pose)return pose;}
  // For non-character bounds only, a visible inset is preferable to a false
  // offscreen marker. Character targets must retain their occlusion test.
  for(const alt of target.alternates||[]){
    if(!finite(alt)||alt.x<l||alt.x>r||alt.y<t||alt.y>bot||alt.x>l+(r-l)*.55||alt.y>t+(bot-t)*.55)continue;
    for(const angle of angles){const pose=tryPose(alt.x,alt.y,24,angle,3);if(pose)return pose;}
  }
  if(!target.aim){
    const ax=Math.min(r-3,Math.max(aim.x,26)),ay=Math.min(bot-3,Math.max(aim.y,26));
    for(const angle of angles){const pose=tryPose(ax,ay,24,angle,3);if(pose)return pose;}
  }
  return null;
}
export function createFocusArrow(layer){
  const image=document.createElement('img');image.className='rg-focus-arrow';image.alt='';image.setAttribute('aria-hidden','true');image.draggable=false;image.hidden=true;layer.append(image);
  let key=null,started=0,animated=null;
  return {
    update(view,target,viewport,time,reduced){
      const next=focusArrowKey(view),pose=next&&focusArrowPose(target,viewport);
      if(!pose){image.hidden=true;if(!next)key=null;return false;}
      if(next!==key){key=next;started=time;animated=null;}
      const moving=!reduced&&time-started<FOCUS_ARROW_ANIMATION_MS;
      if(moving!==animated){image.src=assets+(moving?'.gif':'.png');animated=moving;}
      Object.assign(image.style,{left:`${pose.left}px`,top:`${pose.top}px`,width:`${pose.width}px`,height:`${pose.height}px`,transform:`rotate(${pose.angle}deg)`});
      image.hidden=false;return moving;
    },
    hide(reset=false){image.hidden=true;if(reset)key=null;},
    dispose(){image.remove();},
  };
}
