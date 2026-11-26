// Fugi is a cross-origin iframe; the WebGL scene cannot sample its pixels.
// Render a small visibility buffer instead, preserving the original opaque and
// alpha-tested geometry, then apply the per-plane visibility mask to its DOM wrapper.
// Each of the four standees owns one bit in the red channel. They do not occlude
// one another here: their transparent pixels are composited by DOM paint order.
export const OCCLUSION_LIMIT = 960;
export const CHARACTER_BITS = [16,32,64,128];
export function maskSize(width,height){const scale=Math.min(1,OCCLUSION_LIMIT/Math.max(1,width,height));return [Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))];}
export function maskPixel(pixels,width,height,bit,x,y){return x>=0&&x<width&&y>=0&&y<height&&(pixels[((height-1-y)*width+x)*4]&bit)!==0;}
export function maskBounds(corners,w,h,viewport){
 const xs=corners.map(p=>p.x*w/viewport.width),ys=corners.map(p=>p.y*h/viewport.height);
 return {left:Math.max(0,Math.floor(Math.min(...xs))),top:Math.max(0,Math.floor(Math.min(...ys))),right:Math.min(w,Math.ceil(Math.max(...xs))),bottom:Math.min(h,Math.ceil(Math.max(...ys)))};
}
export function isDepthOccluder(material){return !!material&&material.visible!==false&&material.colorWrite!==false&&material.depthTest!==false&&material.depthWrite!==false&&!material.transparent;}
function worldVisible(object){for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;}
export function createCharacterOcclusion(THREE,renderer,roots,entries){
 const scene=new THREE.Scene(),target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
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
  const canvas=document.createElement('canvas');states.set(entry,{bit,mesh,canvas,ctx:canvas.getContext('2d'),previous:null,visible:false});
 });
 let w=0,h=0,pixels=null,lastKey='',disposed=false,viewport=null;
 const clearColor=new THREE.Color();
 function hide(entry,state){state.visible=false;entry.panel.style.visibility='hidden';}
 function update(visible,view,camera){
  if(disposed)return;viewport=view;
  const active=new Set(visible);let count=0;const key=[view.width,view.height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements];
  for(const [entry,state] of states){const show=active.has(entry);state.mesh.visible=show;if(!show){hide(entry,state);key.push(0);continue;}count++;state.mesh.position.copy(entry.anchor);state.mesh.rotation.y=entry.projectedQuad.yaw;state.mesh.scale.set(entry.worldWidth,entry.worldHeight,1);key.push(1,entry.projectedQuad.yaw,entry.anchor.x,entry.anchor.y,entry.anchor.z,entry.worldWidth,entry.worldHeight);}
  if(!count){lastKey='';return;}
  for(const {source,proxy,materials} of proxies){
   const show=worldVisible(source);proxy.visible=show&&materials.some(isDepthOccluder);key.push(Number(proxy.visible));if(!proxy.visible)continue;
   proxy.matrix.copy(source.matrixWorld);proxy.matrixWorldNeedsUpdate=true;proxy.geometry=source.geometry;
   materials.forEach((m,i)=>{const mat=Array.isArray(proxy.material)?proxy.material[i]:proxy.material;const valid=isDepthOccluder(m);mat.visible=valid;key.push(Number(valid));if(valid){if(mat.map!==m.map||mat.alphaMap!==m.alphaMap){mat.map=m.map||null;mat.alphaMap=m.alphaMap||null;mat.needsUpdate=true;}if(mat.alphaTest!==(m.alphaTest||0)){mat.alphaTest=m.alphaTest||0;mat.needsUpdate=true;}key.push(mat.map?.version??0,mat.alphaMap?.version??0,mat.alphaTest);}});
   key.push(...source.matrixWorld.elements,source.geometry.attributes.position.version,source.geometry.index?.version??0);
  }
  const signature=key.join(',');if(signature===lastKey){for(const entry of visible){const state=states.get(entry);if(state?.visible)entry.panel.style.visibility='visible';}return;}
  const [nw,nh]=maskSize(view.width,view.height);if(w!==nw||h!==nh){w=nw;h=nh;target.setSize(w,h);pixels=new Uint8Array(w*h*4);}
  const oldTarget=renderer.getRenderTarget(),oldAlpha=renderer.getClearAlpha(),oldAuto=renderer.autoClear;renderer.getClearColor(clearColor);
  try{renderer.setRenderTarget(target);renderer.autoClear=false;renderer.setClearColor(0,0);renderer.clear(true,true,true);renderer.render(scene,camera);pixels.fill(0);renderer.readRenderTargetPixels(target,0,0,w,h,pixels);}
  finally{renderer.setRenderTarget(oldTarget);renderer.setClearColor(clearColor,oldAlpha);renderer.autoClear=oldAuto;}
  for(const entry of visible){const state=states.get(entry);if(!state)continue;
   const {left,top,right,bottom}=maskBounds(entry.projectedQuad.corners,w,h,view),cw=right-left,ch=bottom-top;
   if(cw<=0||ch<=0){hide(entry,state);continue;}
   const stamp=[left,top,cw,ch,w,h,view.width,view.height].join(',');const image=state.ctx.createImageData(cw,ch);let any=false,changed=state.stamp!==stamp;
   for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const a=maskPixel(pixels,w,h,state.bit,left+x,top+y)?255:0;const j=(y*cw+x)*4;image.data[j+3]=a;any||=a!==0;if(!changed&&state.previous[j+3]!==a)changed=true;}
   state.visible=any;
   if(!any){hide(entry,state);continue;}
   if(changed){state.canvas.width=cw;state.canvas.height=ch;state.ctx.putImageData(image,0,0);const style=entry.panel.parentElement.style;const url=`url("${state.canvas.toDataURL()}")`;style.maskImage=style.webkitMaskImage=url;style.maskSize=style.webkitMaskSize=`${cw*view.width/w}px ${ch*view.height/h}px`;style.maskPosition=style.webkitMaskPosition=`${left*view.width/w}px ${top*view.height/h}px`;state.previous=image.data;state.stamp=stamp;}
   entry.panel.style.visibility='visible';
  }
  lastKey=signature;
 }
 return {update,contains(entry,x,y){const state=states.get(entry);return !!(state?.visible&&pixels&&viewport&&maskPixel(pixels,w,h,state.bit,Math.floor(x*w/viewport.width),Math.floor(y*h/viewport.height)));},invalidate(){lastKey='';},dispose(){disposed=true;target.dispose();plane.dispose();for(const m of materialCache.values())m.dispose();for(const s of states.values())s.mesh.material.dispose();states.clear();}};
}
