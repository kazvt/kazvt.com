// The animation is baked, not a simulation running in the show. Every tile
// shares a single muted video decoder and texture. World X/Z never follow
// the camera; only the height can rise to enforce the overhead clearance.
export const SKY_TILE=Object.freeze({size:36,overlap:.16,ring:3,nearFade:42,farFade:76,baseY:15,clearance:3,pixels:1024});
export const SKY_VIDEO_URL='/ramblegamble/assets/sky/floating-sky-matte.mp4?v=sky-inertia-20261127-v1';
export const skyHeight=y=>Math.max(SKY_TILE.baseY,Number.isFinite(y)?y+SKY_TILE.clearance:SKY_TILE.baseY);
export const skyStride=SKY_TILE.size*(1-SKY_TILE.overlap);
export function tileRotation(ix,iz){return (((Math.imul(ix,73856093)^Math.imul(iz,19349663))>>>0)&3)*Math.PI/2;}
function grid(a,b){
 const out=[];
 for(let dz=-SKY_TILE.ring;dz<=SKY_TILE.ring;dz++)for(let dx=-SKY_TILE.ring;dx<=SKY_TILE.ring;dx++){
  const ix=a+dx,iz=b+dz,cx=ix*skyStride,cz=iz*skyStride;
  out.push({ix,iz,x:cx,z:cz,angle:tileRotation(ix,iz)});
 }
 return out;
}
function nearTile(t,x,z){const h=SKY_TILE.size/2;return Math.hypot(Math.max(0,Math.abs(x-t.x)-h),Math.max(0,Math.abs(z-t.z)-h))<=SKY_TILE.farFade;}
export function skyTiles(x,z){return Number.isFinite(x)&&Number.isFinite(z)?grid(Math.round(x/skyStride),Math.round(z/skyStride)).filter(t=>nearTile(t,x,z)):[];}
export const SKY_VERTEX=`
 varying vec2 vUV;
 varying vec3 vWorld;
 void main(){vUV=uv;vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}
`;
export const SKY_FRAGMENT=`
 uniform sampler2D uVideo;
 uniform vec2 uCameraXZ;
 varying vec2 vUV;
 varying vec3 vWorld;
 // Color and straight alpha are stored side-by-side in one ordinary video.
 // Inset a half texel from both halves to avoid sampling the packing seam.
 void main(){
  vec2 p=(vec2(.5)+clamp(vUV,0.,1.)*1023.)/1024.;
  vec3 c=texture2D(uVideo,vec2(p.x*.5,p.y)).rgb;
  float a=texture2D(uVideo,vec2(.5+p.x*.5,p.y)).r;
  float edge=min(min(vUV.x,1.-vUV.x),min(vUV.y,1.-vUV.y));
  a=smoothstep(.025,.985,a)*smoothstep(0.,.12,edge)*(1.-smoothstep(42.,76.,length(vWorld.xz-uCameraXZ)))*.92;
  if(a<.007)discard;
  vec3 linear=mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
  gl_FragColor=vec4(linear,a);
  #include <colorspace_fragment>
 }
`;
export function createFloatingSky({THREE,scene,document:doc=globalThis.document,src=SKY_VIDEO_URL}){
 const group=new THREE.Group();group.name='rg-floating-video-sky';group.visible=false;scene.add(group);
 const video=doc.createElement('video');video.preload='none';video.loop=true;video.muted=true;video.defaultMuted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('muted','');video.disablePictureInPicture=true;
 const tex=new THREE.VideoTexture(video);tex.colorSpace=THREE.NoColorSpace;tex.generateMipmaps=false;tex.minFilter=tex.magFilter=THREE.LinearFilter;
 const mat=new THREE.ShaderMaterial({uniforms:{uVideo:{value:tex},uCameraXZ:{value:new THREE.Vector2()}},vertexShader:SKY_VERTEX,fragmentShader:SKY_FRAGMENT,side:THREE.FrontSide,transparent:true,depthTest:true,depthWrite:false,toneMapped:false});
 const geo=new THREE.PlaneGeometry(SKY_TILE.size,SKY_TILE.size);geo.rotateX(Math.PI/2); // underside faces down
 const meshes=Array.from({length:(2*SKY_TILE.ring+1)**2},()=>{const m=new THREE.Mesh(geo,mat);m.name='rg-sky-video-tile';m.visible=false;m.renderOrder=-9989;m.frustumCulled=false; m.raycast=()=>{};group.add(m);return m;});
 const matrix=new THREE.Matrix4(),frustum=new THREE.Frustum(),box=new THREE.Box3(),half=SKY_TILE.size/2;
 let requested=false,wanted=false,failed=false,blocked=false,pending=false,disposed=false,generation=0,gridX=null,gridZ=null,candidates=[];
 function hide(){group.visible=false;for(const m of meshes)m.visible=false;}
 function suspend(){if(disposed)return;wanted=false;generation++;pending=false;video.pause();hide();}
 function onError(){failed=true;suspend();} video.addEventListener('error',onError);
 function play(){
  if(disposed||!wanted||failed||blocked||pending||!video.paused)return;
  if(!requested){requested=true;video.src=src;video.preload='auto';}
  const token=++generation;pending=true;
  let promise;try{promise=video.play();}catch{pending=false;blocked=true;return;}
  Promise.resolve(promise).then(()=>{if(disposed)return;if(!wanted)video.pause();if(token===generation)pending=false;},()=>{if(disposed||token!==generation)return;pending=false;blocked=true;});
 }
 function gesture(){if(wanted&&blocked&&!failed){blocked=false;play();}}
 doc.addEventListener('pointerdown',gesture,{passive:true});doc.addEventListener('keydown',gesture);
 function update(camera,active){
  if(disposed)return;
  if(!active||!camera||failed){if(wanted||group.visible)suspend();return;}
  const {x,y,z}=camera.position;if(![x,y,z].every(Number.isFinite)){if(wanted||group.visible)suspend();return;}
  const height=skyHeight(y);camera.updateMatrixWorld(true);matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);
  let count=0;const a=Math.round(x/skyStride),b=Math.round(z/skyStride);
  if(a!==gridX||b!==gridZ){gridX=a;gridZ=b;candidates=grid(a,b);}
  for(const t of candidates){
   if(!nearTile(t,x,z))continue;
   box.min.set(t.x-half,height-.01,t.z-half);box.max.set(t.x+half,height+.01,t.z+half);
   if(!frustum.intersectsBox(box))continue;
   const m=meshes[count++];m.position.set(t.x,height,t.z);m.rotation.y=t.angle;m.visible=true;
  }
  for(let i=count;i<meshes.length;i++)meshes[i].visible=false;
  if(!count){if(wanted||group.visible)suspend();return;}
  if(!wanted){wanted=true;blocked=false;}
  mat.uniforms.uCameraXZ.value.set(x,z);play();
  // No poster rectangle while loading, on failed playback or missing media.
  group.visible=video.readyState>=2&&!failed;
 }
 function dispose(){if(disposed)return;suspend();disposed=true;doc.removeEventListener('pointerdown',gesture);doc.removeEventListener('keydown',gesture);video.removeEventListener('error',onError);video.removeAttribute('src');video.load();scene.remove(group);tex.dispose();mat.dispose();geo.dispose();}
 return {group,video,update,suspend,dispose};
}
