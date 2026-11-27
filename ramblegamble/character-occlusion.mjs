// Fugi is a cross-origin iframe; the WebGL scene cannot sample its pixels.
// Render a small visibility buffer instead, preserving the original opaque and
// alpha-tested geometry, then apply a synchronous per-plane geometric clip to its DOM wrapper.
// Each of the four standees owns one bit in the red channel. They do not occlude
// one another here: their transparent pixels are composited by DOM paint order.
// Keep the target at display resolution where practical; do not multisample
// the packed ID bits. Only read back the union of visible character bounds.
export const OCCLUSION_LIMIT = 1920;
export const CHARACTER_BITS = [16,32,64,128];
export function maskSize(width,height,pixelRatio=1){
 const scale=Math.min(Math.max(1,Math.min(1.6,pixelRatio||1)),OCCLUSION_LIMIT/Math.max(1,width,height));
 return [Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))];
}
export function maskPixel(pixels,width,height,bit,x,y){return x>=0&&x<width&&y>=0&&y<height&&(pixels[((height-1-y)*width+x)*4]&bit)!==0;}
export function maskBounds(corners,w,h,viewport){
 const xs=corners.map(p=>p.x*w/viewport.width),ys=corners.map(p=>p.y*h/viewport.height);
 return {left:Math.max(0,Math.floor(Math.min(...xs))),top:Math.max(0,Math.floor(Math.min(...ys))),right:Math.min(w,Math.ceil(Math.max(...xs))),bottom:Math.min(h,Math.ceil(Math.max(...ys)))};
}
export function unionMaskBounds(bounds){
 const valid=bounds.filter(b=>b.right>b.left&&b.bottom>b.top);
 if(!valid.length)return null;
 return {left:Math.min(...valid.map(b=>b.left)),top:Math.min(...valid.map(b=>b.top)),right:Math.max(...valid.map(b=>b.right)),bottom:Math.max(...valid.map(b=>b.bottom))};
}
// Convert binary visibility into an immediate CSS path (no changing image URL,
// PNG encoding, asynchronous decode or texture upload). Merge matching runs
// vertically, and skip the clip entirely if the plane is unobstructed.
export function visibilityClip(corners,bounds,w,h,view,visibleAt){
 const quad=corners.map(p=>({x:p.x*w/view.width,y:p.y*h/view.height}));
 const completed=[];let previous=new Map(),any=false,occluded=false;
 for(let y=bounds.top;y<bounds.bottom;y++){
  const scan=y+.5,xs=[];
  for(let i=0;i<4;i++){
   const a=quad[i],b=quad[(i+1)%4];
   if((a.y<=scan&&b.y>scan)||(b.y<=scan&&a.y>scan))xs.push(a.x+(scan-a.y)*(b.x-a.x)/(b.y-a.y));
  }
  const first=xs.length?Math.max(bounds.left,Math.ceil(Math.min(...xs)-.5)):bounds.right;
  const last=xs.length?Math.min(bounds.right,Math.ceil(Math.max(...xs)-.5)):bounds.left;
  const current=new Map();let run=-1;
  // Include the GPU raster's actual visible runs even if a boundary sample
  // differs by rounding from the analytical quad. Only interior holes count
  // as occlusion; the natural transformed iframe supplies its own outer edge.
  for(let x=bounds.left;x<=bounds.right;x++){
   const visible=x<bounds.right&&visibleAt(x,y);
   if(x>=first&&x<last&&!visible)occluded=true;
   if(visible){any=true;if(run<0)run=x;continue;}
   if(run<0)continue;
   const key=run+':'+x,rect=previous.get(key)||{left:run,right:x,top:y,bottom:y};
   rect.bottom=y+1;current.set(key,rect);run=-1;
  }
  for(const [key,rect] of previous)if(!current.has(key))completed.push(rect);
  previous=current;
 }
 if(!any)return {visible:false,path:'none'};
 if(!occluded)return {visible:true,path:'none'};
 completed.push(...previous.values());
 const px=x=>Number((x*view.width/w).toFixed(3)),py=y=>Number((y*view.height/h).toFixed(3));
 const path=completed.map(r=>`M${px(r.left)} ${py(r.top)}H${px(r.right)}V${py(r.bottom)}H${px(r.left)}Z`).join('');
 return {visible:true,path:`path("${path}")`};
}
export function isDepthOccluder(material){return !!material&&material.visible!==false&&material.colorWrite!==false&&material.depthTest!==false&&material.depthWrite!==false&&!material.transparent;}
function worldVisible(object){for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;}
export function createCharacterOcclusion(THREE,renderer,roots,entries){
 const scene=new THREE.Scene(),target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false,samples:0,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
 const materialCache=new Map(),proxies=[],states=new Map();
 const depthMaterial=m=>{
  if(materialCache.has(m))return materialCache.get(m);
  const proxy=new THREE.MeshBasicMaterial({map:m?.map||null,alphaMap:m?.alphaMap||null,alphaTest:m?.alphaTest||0,opacity:m?.opacity??1,side:m?.side??THREE.FrontSide,vertexColors:!!m?.vertexColors,colorWrite:false,depthWrite:true,depthTest:true,toneMapped:false,polygonOffset:!!m?.polygonOffset,polygonOffsetFactor:m?.polygonOffsetFactor||0,polygonOffsetUnits:m?.polygonOffsetUnits||0});
  materialCache.set(m,proxy);return proxy;
 };
 const seen=new Set();for(const root of roots)root?.traverse(source=>{
  if(!source.isMesh||source.isInstancedMesh||seen.has(source))return;seen.add(source);
  const materials=Array.isArray(source.material)?source.material:[source.material];if(!materials.some(isDepthOccluder))return;
  const proxy=new THREE.Mesh(source.geometry,Array.isArray(source.material)?materials.map(depthMaterial):depthMaterial(materials[0]));
  proxy.matrixAutoUpdate=false;proxy.frustumCulled=source.frustumCulled;scene.add(proxy);proxies.push({source,proxy,materials});
 });
 const plane=new THREE.PlaneGeometry(1,1);
 entries.forEach((entry,i)=>{
  const bit=CHARACTER_BITS[i];if(!bit)return;
  const material=new THREE.ShaderMaterial({uniforms:{value:{value:bit/255}},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform float value; void main(){gl_FragColor=vec4(value,0.0,0.0,1.0);}',transparent:true,blending:THREE.AdditiveBlending,depthTest:true,depthWrite:false,toneMapped:false,side:THREE.FrontSide});
  const mesh=new THREE.Mesh(plane,material);mesh.renderOrder=1;mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  states.set(entry,{bit,mesh,path:null,visible:false});
 });
 let w=0,h=0,pixels=null,region=null,lastKey='',disposed=false,viewport=null;
 const clearColor=new THREE.Color();
 function hide(entry,state){state.visible=false;if(entry.panel.style.visibility!=='hidden')entry.panel.style.visibility='hidden';}
 function readVisible(bit,x,y){return !!region&&maskPixel(pixels,region.right-region.left,region.bottom-region.top,bit,x-region.left,y-region.top);}
 function hideAll(){for(const [entry,state] of states)hide(entry,state);}
 function update(visible,view,camera){
  if(disposed)return;viewport=view;
  const active=new Set(visible);let count=0;const ratio=renderer.getPixelRatio?.()||1;const key=[view.width,view.height,ratio,...camera.matrixWorld.elements,...camera.projectionMatrix.elements];
  for(const [entry,state] of states){const show=active.has(entry);state.mesh.visible=show;if(!show){hide(entry,state);key.push(0);continue;}count++;const pose=entry.renderPose||entry;state.mesh.position.copy(pose.anchor);state.mesh.rotation.y=entry.projectedQuad.yaw;state.mesh.scale.set(pose.worldWidth,pose.worldHeight,1);key.push(1,entry.projectedQuad.yaw,pose.anchor.x,pose.anchor.y,pose.anchor.z,pose.worldWidth,pose.worldHeight);}
  if(!count){lastKey='';region=null;return;}
  for(const {source,proxy,materials} of proxies){
   const show=worldVisible(source);proxy.visible=show&&materials.some(isDepthOccluder);key.push(Number(proxy.visible));if(!proxy.visible)continue;
   proxy.matrix.copy(source.matrixWorld);proxy.matrixWorldNeedsUpdate=true;proxy.geometry=source.geometry;
   materials.forEach((m,i)=>{const mat=Array.isArray(proxy.material)?proxy.material[i]:proxy.material;const valid=isDepthOccluder(m);mat.visible=valid;key.push(Number(valid));if(valid){if(mat.map!==(m.map||null)||mat.alphaMap!==(m.alphaMap||null)){mat.map=m.map||null;mat.alphaMap=m.alphaMap||null;mat.needsUpdate=true;}if(mat.alphaTest!==(m.alphaTest||0)){mat.alphaTest=m.alphaTest||0;mat.needsUpdate=true;}key.push(mat.map?.version??0,mat.alphaMap?.version??0,mat.alphaTest);}});
   key.push(...source.matrixWorld.elements,source.geometry.attributes.position.version,source.geometry.index?.version??0);
  }
  const signature=key.join(',');if(signature===lastKey)return;
  const [nw,nh]=maskSize(view.width,view.height,ratio);if(w!==nw||h!==nh){w=nw;h=nh;target.setSize(w,h);}
  const bounds=new Map(visible.filter(entry=>states.has(entry)).map(entry=>[entry,maskBounds(entry.projectedQuad.corners,w,h,view)]));
  const crop=unionMaskBounds([...bounds.values()]);
  if(!crop){hideAll();lastKey=signature;region=null;return;}
  const cw=crop.right-crop.left,ch=crop.bottom-crop.top,bytes=cw*ch*4;
  // Reuse capacity instead of allocating a full-screen pixel array every time.
  if(!pixels||pixels.length<bytes)pixels=new Uint8Array(bytes);
  const oldTarget=renderer.getRenderTarget(),oldAlpha=renderer.getClearAlpha(),oldAuto=renderer.autoClear;renderer.getClearColor(clearColor);
  try{
   renderer.setRenderTarget(target);renderer.autoClear=false;renderer.setClearColor(0,0);renderer.clear(true,true,true);renderer.render(scene,camera);
   pixels.fill(0,0,bytes);renderer.readRenderTargetPixels(target,crop.left,h-crop.bottom,cw,ch,pixels);
  }catch(error){lastKey='';region=null;hideAll();throw error;}
  finally{renderer.setRenderTarget(oldTarget);renderer.setClearColor(clearColor,oldAlpha);renderer.autoClear=oldAuto;}
  region=crop;
  for(const [entry,box] of bounds){const state=states.get(entry);
   const clip=visibilityClip(entry.projectedQuad.corners,box,w,h,view,(x,y)=>readVisible(state.bit,x,y));
   if(!clip.visible){hide(entry,state);continue;}
   // This geometry and the projective transform describe the same camera
   // frame. No asynchronous image resource can temporarily hide the iframe.
   const style=entry.panel.parentElement.style;
   if(state.path!==clip.path){style.clipPath=clip.path;state.path=clip.path;}
   state.visible=true;if(entry.panel.style.visibility!=='visible')entry.panel.style.visibility='visible';
  }
  lastKey=signature;
 }
 return {update,contains(entry,x,y){const state=states.get(entry);return !!(state?.visible&&pixels&&viewport&&readVisible(state.bit,Math.floor(x*w/viewport.width),Math.floor(y*h/viewport.height)));},invalidate(){lastKey='';region=null;hideAll();},dispose(){disposed=true;target.dispose();plane.dispose();for(const m of materialCache.values())m.dispose();for(const s of states.values())s.mesh.material.dispose();states.clear();}};
}
