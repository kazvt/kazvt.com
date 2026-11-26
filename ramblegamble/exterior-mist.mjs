// World-space exterior atmosphere. Keep the authored stage and gameplay objects un-fogged.
// The checkerboard's original UV transform is recovered from the actual indexed quad.
export const EXTERIOR_FLOOR = Object.freeze({ y: -.625, minX: -1.5315, maxX: 25.1535, minZ: -3.59, maxZ: 14.4212 });
export const MIST_CLEAR = Object.freeze({ minX: -2.8, maxX: 18.2, minZ: -7.6, maxZ: 4.5 });
export const MIST_DISTANCE = 6;
export const MIST_EXTENT = 400;
export const MIST_FADE = Object.freeze({ start: 65, end: 125 });
const smooth = (a,b,x) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
export function mistDistance(x,z) {
  return Math.hypot(Math.max(MIST_CLEAR.minX-x,0,x-MIST_CLEAR.maxX), Math.max(MIST_CLEAR.minZ-z,0,z-MIST_CLEAR.maxZ));
}
export function mistCoverage(x,z,noise=.5) {
  const d=mistDistance(x,z);
  // Noise can vary the leading edge, but never expose checkerboard past MIST_DISTANCE.
  return smooth(0,MIST_DISTANCE,d) + (noise-.5)*.44*smooth(0,MIST_DISTANCE,d)*(1-smooth(0,MIST_DISTANCE,d));
}
export function isExteriorFloor(points) {
  if(points.length!==6 || points.some(p=>Math.abs(p.y-EXTERIOR_FLOOR.y)>.002))return false;
  const near=(a,b)=>Math.abs(a-b)<.003;
  return near(Math.min(...points.map(p=>p.x)),EXTERIOR_FLOOR.minX) && near(Math.max(...points.map(p=>p.x)),EXTERIOR_FLOOR.maxX)
    && near(Math.min(...points.map(p=>p.z)),EXTERIOR_FLOOR.minZ) && near(Math.max(...points.map(p=>p.z)),EXTERIOR_FLOOR.maxZ)
    && points.every(p=>(near(p.x,EXTERIOR_FLOOR.minX)||near(p.x,EXTERIOR_FLOOR.maxX))&&(near(p.z,EXTERIOR_FLOOR.minZ)||near(p.z,EXTERIOR_FLOOR.maxZ)));
}
export function floorUvTransform(points,uvs) {
  for(let i=1;i<points.length;i++) for(let j=i+1;j<points.length;j++) {
    const a=points[0],b=points[i],c=points[j], dx=b.x-a.x,dz=b.z-a.z,ex=c.x-a.x,ez=c.z-a.z;
    const det=dx*ez-dz*ex;
    if(Math.abs(det)<1e-5)continue;
    const uv=(x,z)=>{
      const s=((x-a.x)*ez-(z-a.z)*ex)/det,t=(dx*(z-a.z)-dz*(x-a.x))/det;
      return [uvs[0].x+s*(uvs[i].x-uvs[0].x)+t*(uvs[j].x-uvs[0].x),uvs[0].y+s*(uvs[i].y-uvs[0].y)+t*(uvs[j].y-uvs[0].y)];
    };
    if(points.every((p,k)=>{const v=uv(p.x,p.z);return Math.hypot(v[0]-uvs[k].x,v[1]-uvs[k].y)<.001;}))return uv;
  }
  return null;
}
export const MIST_VERTEX = `
  varying vec3 vMistWorld;
  varying vec2 vFloorUv;
  void main() {
    vec4 world = modelMatrix * vec4(position,1.0);
    vMistWorld = world.xyz;
    vFloorUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const gl = n => Number(n).toFixed(4);
export const MIST_COMMON = `
  varying vec3 vMistWorld;
  varying vec2 vFloorUv;
  uniform float uTime;
  uniform vec3 uDark;
  uniform vec3 uLight;
  float hashMist(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3,p3.yzx+33.33);
    return fract((p3.x+p3.y)*p3.z);
  }
  float noiseMist(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hashMist(i),hashMist(i+vec2(1,0)),f.x),mix(hashMist(i+vec2(0,1)),hashMist(i+vec2(1,1)),f.x),f.y);
  }
  float cloudMist(vec2 p) {
    return .57*noiseMist(p)+.29*noiseMist(p*2.03+vec2(14.1,8.7))+.14*noiseMist(p*4.09-vec2(4.3,11.5));
  }
  float exteriorDistance(vec2 p) {
    vec2 d=max(max(vec2(${gl(MIST_CLEAR.minX)},${gl(MIST_CLEAR.minZ)})-p,p-vec2(${gl(MIST_CLEAR.maxX)},${gl(MIST_CLEAR.maxZ)})),vec2(0.0));
    return length(d);
  }
  float boundaryMist(vec2 p) {
    return smoothstep(0.0,${gl(MIST_DISTANCE)},exteriorDistance(p));
  }
  float horizonMist() {
    return 1.0-smoothstep(${gl(MIST_FADE.start)},${gl(MIST_FADE.end)},exteriorDistance(vMistWorld.xz));
  }
`;
export const FLOOR_FRAGMENT = `${MIST_COMMON}
  uniform sampler2D uChecker;
  uniform vec3 uCheckerColor;
  uniform vec3 uHorizon;
  void main() {
    float fade=horizonMist();
    if(fade<=0.0)discard;
    float edge=boundaryMist(vMistWorld.xz);
    vec3 tile=texture2D(uChecker,vFloorUv).rgb*uCheckerColor;
    vec3 color=tile;
    if(edge>0.0) {
      float cloud=cloudMist(vMistWorld.xz*.38+vec2(uTime*.08,-uTime*.035));
      float mask=edge+(cloud-.5)*.44*edge*(1.0-edge);
      vec3 haze=mix(uDark,uLight,smoothstep(.16,.84,cloud));
      float farMix=smoothstep(22.0,${gl(MIST_FADE.start)},length(vMistWorld-cameraPosition));
      haze=mix(haze,uHorizon,farMix*.88);
      color=mix(tile,haze,mask);
    }
    gl_FragColor=vec4(color,fade);
    #include <colorspace_fragment>
  }
`;
export const CLOUD_FRAGMENT = `${MIST_COMMON}
  void main() {
    float edge=boundaryMist(vMistWorld.xz);
    float fade=horizonMist();
    if(edge<=0.0||fade<=0.0)discard;
    float cloud=cloudMist(vMistWorld.xz*.30+vec2(-uTime*.045,uTime*.07)+vec2(8.4,2.1));
    float density=smoothstep(.25,.78,cloud);
    float farFade=1.0-smoothstep(22.0,${gl(MIST_FADE.start)},length(vMistWorld-cameraPosition));
    gl_FragColor=vec4(mix(uDark,uLight,density),edge*fade*farFade*(.08+.34*density));
    #include <colorspace_fragment>
  }
`;
function makeQuad(THREE,y,uvAt) {
  const corners=[[-MIST_EXTENT,-MIST_EXTENT],[-MIST_EXTENT,MIST_EXTENT],[MIST_EXTENT,MIST_EXTENT],[MIST_EXTENT,-MIST_EXTENT]];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(corners.flatMap(([x,z])=>[x,y,z]),3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(corners.flatMap(([x,z])=>uvAt(x,z)),2));
  geometry.setIndex([0,1,2,0,2,3]); // upward facing
  geometry.computeBoundingSphere();
  return geometry;
}
export function createExteriorMist({THREE,scene,stage,horizonColor}) {
  stage.updateWorldMatrix(true,true);
  const matches=[];
  stage.traverse(mesh=>{
    const g=mesh.geometry,index=g?.index,pos=g?.getAttribute('position'),uv=g?.getAttribute('uv');
    if(!mesh.isMesh||index?.count!==6||!pos||!uv||!mesh.material?.map||Array.isArray(mesh.material))return;
    const indices=Array.from({length:6},(_,i)=>index.getX(i));
    const points=indices.map(i=>new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld));
    if(!isExteriorFloor(points))return;
    const uvs=indices.map(i=>new THREE.Vector2().fromBufferAttribute(uv,i));
    const transform=floorUvTransform(points,uvs);
    if(transform)matches.push({mesh,transform});
  });
  if(matches.length!==1){console.warn('Exterior mist: expected one authored checkerboard quad; leaving stage unchanged.');return null;}
  const {mesh,transform}=matches[0];
  const group=new THREE.Group(); group.name='rg-exterior-mist'; group.visible=stage.visible;
  const clock={value:0};
  const common={uTime:clock,uDark:{value:new THREE.Color('#40316d')},uLight:{value:new THREE.Color('#a18bd8')}};
  const groundMaterial=new THREE.ShaderMaterial({uniforms:{...common,uChecker:{value:mesh.material.map},uCheckerColor:{value:mesh.material.color.clone()},uHorizon:{value:new THREE.Color(horizonColor)}},vertexShader:MIST_VERTEX,fragmentShader:FLOOR_FRAGMENT,transparent:true,depthTest:true,depthWrite:true,toneMapped:false});
  const ground=new THREE.Mesh(makeQuad(THREE,EXTERIOR_FLOOR.y,transform),groundMaterial);
  ground.name='rg-expanded-checkerboard'; ground.renderOrder=-9996;
  const cloudMaterial=new THREE.ShaderMaterial({uniforms:common,vertexShader:MIST_VERTEX,fragmentShader:CLOUD_FRAGMENT,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,forceSinglePass:true});
  const clouds=new THREE.Mesh(makeQuad(THREE,.12,()=>[0,0]),cloudMaterial);
  clouds.name='rg-low-exterior-clouds'; clouds.renderOrder=-9995;
  // Explicit picking lists are used by the arcade; these surfaces are decorative.
  ground.raycast=clouds.raycast=()=>{};
  group.add(ground,clouds); scene.add(group); mesh.visible=false;
  return {group,update(time,reducedMotion){if(group.visible)clock.value=reducedMotion?0:time*.001;},dispose(){scene.remove(group);ground.geometry.dispose();clouds.geometry.dispose();groundMaterial.dispose();cloudMaterial.dispose();mesh.visible=true;}};
}
