/* Real downloaded Kenney CC0 3D models — no original meshes or art assets generated. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const FILE_ROOT = 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/';
const CDN_ROOT = 'https://cdn.jsdelivr.net/gh/Hidencod/tge-assets@main/packs/';
const MODEL_PATHS = {
  original:'prototype-kit/crate-color.glb',
  static:'prototype-kit/crate.glb',
  phantom:'car-kit/box.glb',
  mint:'food-kit/pizza-box.glb',
  human:'blocky-characters/character-a.glb'
};
const active = [];
const cache = new Map();
let demoPhase='idle';
let hype=40;

function loadGLB(name){
  if(cache.has(name))return cache.get(name);
  const path=MODEL_PATHS[name];
  const origins = window.GFUMES_USE_LOCAL_ASSETS
    ? ['./assets/models/'+path, CDN_ROOT+path, FILE_ROOT+path]
    : [CDN_ROOT+path, FILE_ROOT+path];
  const get=(index)=>new Promise((resolve,reject)=>loader.load(origins[index],resolve,undefined,reject)).catch(err=>{
    if(index<origins.length-1)return get(index+1);
    throw err;
  });
  const p=get(0);cache.set(name,p);return p;
}
function pixellate(object){
  object.traverse(node=>{
    if(!node.isMesh)return;
    node.frustumCulled=false;
    const list=Array.isArray(node.material)?node.material:[node.material];
    for(const mat of list){if(!mat)continue;mat.flatShading=true;if(mat.map){mat.map.magFilter=THREE.NearestFilter;mat.map.minFilter=THREE.NearestMipmapNearestFilter;mat.map.anisotropy=1;mat.map.needsUpdate=true;}if('roughness' in mat)mat.roughness=1;mat.needsUpdate=true;}
  });
  return object;
}
function normalize(obj,targetHeight=2.65){
  const box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const largest=Math.max(size.x,size.y,size.z,.01);
  obj.position.set(-center.x,-center.y,-center.z);
  const wrapper=new THREE.Group();wrapper.add(obj);wrapper.scale.setScalar(targetHeight/largest);
  return wrapper;
}
function createViewer(host,opts={}){
  if(!host)return null;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(opts.demo?36:opts.hero?36:41,1,.1,100);
  camera.position.set(opts.demo?4.8:4.2,opts.demo?2.5:2.9,opts.demo?7.6:6.8);camera.lookAt(0,0,0);
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;
  renderer.domElement.setAttribute('aria-label',opts.demo?'Rotating 3D pixel character demonstration':'Interactive rotating 3D box model');renderer.domElement.setAttribute('role','img');
  host.appendChild(renderer.domElement);
  const light1=new THREE.HemisphereLight(0xf5ffdc,0x273b2a,3.3);scene.add(light1);
  const light2=new THREE.DirectionalLight(0xffffff,3.6);light2.position.set(-4,6,8);scene.add(light2);
  const light3=new THREE.DirectionalLight(0xb7ff79,2);light3.position.set(4,3,-4);scene.add(light3);
  const root=new THREE.Group();scene.add(root);
  const viewer={host,renderer,scene,camera,root,opts,visible:true,rotation:0.2,targetRotation:0.2,dragging:false,loaded:false};
  const resize=()=>{
    const {width,height}=host.getBoundingClientRect();
    if(!width||!height)return;
    const factor=opts.demo?.52:opts.hero?.60:.57;
    renderer.setSize(Math.max(1,Math.round(width*factor)),Math.max(1,Math.round(height*factor)),false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
    renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';
  };
  viewer.resize=resize;
  resize();new ResizeObserver(resize).observe(host);
  if(!opts.demo){
    let prevX=0;
    renderer.domElement.addEventListener('pointerdown',e=>{viewer.dragging=true;prevX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId);});
    renderer.domElement.addEventListener('pointermove',e=>{if(!viewer.dragging)return;viewer.targetRotation+=(e.clientX-prevX)*.012;prevX=e.clientX;});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,()=>viewer.dragging=false);
  }
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{viewer.visible=entries[0].isIntersecting;},{rootMargin:'100px'});observer.observe(host);}
  active.push(viewer);
  return viewer;
}
function hideFallback(host){const fallback=host.querySelector('.viewer-fallback');if(fallback)fallback.style.display='none';}
async function addBox(hostId,name,opts={}){
  const host=document.getElementById(hostId),viewer=createViewer(host,opts);if(!viewer)return;
  try{
    const loaded=await loadGLB(name),obj=pixellate(loaded.scene.clone(true));
    viewer.root.add(normalize(obj,opts.hero?3.6:2.8));viewer.loaded=true;hideFallback(host);
  }catch(e){console.warn('GFUMES free model unavailable; the public-domain thumbnail is being used.',name,e.message);viewer.renderer.domElement.style.display='none';}
}
async function addDemo(){
  const host=document.getElementById('demo3d'),viewer=createViewer(host,{demo:true});
  if(!viewer)return;
  let loadedCount=0;
  const place=async(name,x,scale,rot=0)=>{
    try{
      const source=await loadGLB(name);
      const item=normalize(pixellate(source.scene.clone(true)),scale);item.position.x=x;item.rotation.y=rot;viewer.root.add(item);
      if(name==='human')viewer.human=item;else viewer.box=item;
      loadedCount++;hideFallback(host);
    }catch(e){console.warn('GFUMES demo model failed:',name,e.message);}
  };
  await Promise.all([place('human',-1.35,3.3,0.26),place('original',1.55,1.8,-.3)]);
  if(!loadedCount)viewer.renderer.domElement.style.display='none';
}

async function start(){
  const tasks=[addBox('hero3d','original',{hero:true}),addDemo()];
  for(const name of ['original','static','phantom','mint'])tasks.push(addBox('product3d-'+name,name,{card:true}));
  await Promise.allSettled(tasks);
}

document.addEventListener('gfumes:phase',e=>{demoPhase=e.detail.phase;});
document.addEventListener('gfumes:hype',e=>{hype=e.detail.value;});
let last=0;
function animate(t){
  requestAnimationFrame(animate);
  const dt=Math.min((t-last)/1000,.05);last=t;
  for(const v of active){
    if(!v.visible || document.hidden)continue;
    if(!v.opts.demo){if(!v.dragging)v.targetRotation+=dt*(v.opts.hero?.23:.36);v.rotation+=(v.targetRotation-v.rotation)*.16;v.root.rotation.y=v.rotation;v.root.rotation.x=-.08;v.root.position.y=Math.sin(t*.0012)*.055;}
    else {
      if(v.human){v.human.rotation.y=(demoPhase==='idle'?.16:demoPhase==='unbox'?-.25:-.46)+Math.sin(t*.0008)*.045;v.human.position.y=Math.sin(t*.0018)*.045*(demoPhase==='hype'?2.2:1);v.human.rotation.z=demoPhase==='hype'?Math.sin(t*.006)*.07:0;}
      if(v.box){v.box.rotation.y+=dt*(demoPhase==='hype'?1.6:demoPhase==='unbox'?.65:.22);v.box.position.y=Math.sin(t*.002)*.07;v.box.rotation.z=demoPhase==='hype'?Math.sin(t*.008)*(hype/100)*.1:0;}
      v.root.rotation.y=.09;
    }
    v.renderer.render(v.scene,v.camera);
  }
}
requestAnimationFrame(animate);
start();
