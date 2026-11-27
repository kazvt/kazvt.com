// Measured from rg_stage.gltf's inner jambs, NOT from the cabinet AABB.
// The back wall has been extended from -7.0104 to -7.98 in the runtime model.
export const SLOT_CURTAIN_BAY=Object.freeze({left:9.906,right:13.716,frontZ:-6.096,backZ:-7.98,bottom:0,top:3.048});
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const FOLDS=7, TAU=2*Math.PI;
export function curtainLayout(bounds,bay=SLOT_CURTAIN_BAY){
 const center=(bay.left+bay.right)/2,outer=(bay.right-bay.left)/2+.15;
 const halfCabinet=Math.max(Math.abs(bounds.min.x-center),Math.abs(bounds.max.x-center));
 // A stack stays outside the cabinet path even at its widest authored footprint.
 const stack=Math.min(.46,outer-halfCabinet-.18);
 const parkFront=bay.frontZ-.14,retract=bounds.max.z-parkFront;
 if(stack<.24||retract<0||bounds.min.z-retract<bay.backZ+.04||bounds.max.y>bay.top-.06)throw Error('Slot cabinet no longer fits the curtain bay.');
 return {center,outer,closedWidth:outer+.105,stack,trackZ:bay.frontZ+.035,bottom:bay.bottom-.012,height:bay.top-bay.bottom+.024,retract,parkFront};
}
// Estimate the arc length of a pleat at a fixed heading width. Preserve cloth
// fullness as the runners gather, rather than horizontally shrinking the UVs.
function arcLength(width,depth){let len=0,last=0;for(let i=1;i<=112;i++){const z=depth*(1-Math.cos(TAU*FOLDS*i/112))/2;len+=Math.hypot(width/112,z-last);last=z;}return len;}
export function createCurtainProfile(layout){
 const restDepth=.064,target=arcLength(layout.closedWidth,restDepth),table=[];
 for(let i=0;i<=100;i++){const p=i/100,w=layout.closedWidth+(layout.stack-layout.closedWidth)*p;let low=0,high=.3;for(let k=0;k<15;k++){const mid=(low+high)/2;if(arcLength(w,mid)<target)low=mid;else high=mid;}table.push((low+high)/2);}
 return {layout,target,depth(p){const i=clamp(p)*100,j=Math.floor(i);return table[j]+((table[Math.min(100,j+1)]-table[j])*(i-j));}};
}
// u = fixed material coordinate from the anchored outer edge to the leading
// edge; v = vertical coordinate, 0 at the track. Gravity leaves the bottom
// a little fuller, while bounded travelling wrinkles run down the cloth.
export function curtainVertex(profile,side,u,v,open,time=0,wind=true){
 const l=profile.layout,p=clamp(open),moving=Math.sin(Math.PI*p), local=clamp(p-.12*moving*v**1.3);
 const width=l.closedWidth+(l.stack-l.closedWidth)*local;
 const wave=.62*moving*Math.sin(Math.PI*u)*Math.sin(time*.007-v*6.5+u*3+side*.7);
 const phase=TAU*FOLDS*u+wave;
 const x=side*(l.outer-width*u);
 // Outer edge meets the wall itself, middle overlaps on offset tracks.
 const depth=profile.depth(local)*(1-Math.cos(phase))/2;
 const outerReturn=.052*(1-smooth(u/.055));
 const seamOffset=side===1?.022*smooth((u-.8)/.2):0;
 const flutter=.018*moving*Math.sin(Math.PI*u)*Math.sin(time*.009-v*8+side)*v;
 const y=l.height*(1-v)+.026*moving*Math.sin(u*Math.PI)*v**5;
 // Ambient wind is separate from the traveler. It bends only in depth,
 // leaves both lateral edges and the track pinned, and weakens as cloth gathers.
 // Two non-harmonic traveling waves avoid a perfectly repetitive rigid sway.
 const strength=wind?(.044-.024*p)*Math.sin(Math.PI*u)*v**1.6:0;
 const gust=strength*(.68*Math.sin(time*.00165-u*5.4-v*3.3+side*.67)+.32*Math.sin(time*.00271+u*3.1-v*6.2+side*1.1));
 const z=depth-outerReturn+seamOffset+flutter+gust;
 // Texture remains attached to material coordinates; fold shading is based
 // on its slope so the fabric has depth even with the original unlit art.
 const shade=.54+.44*(.5+.5*Math.sin(phase+.48+gust*5));
 return {x,y,z,shade};
}
