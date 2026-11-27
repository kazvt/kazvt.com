import { SIGN_BULB_COUNT, signMaskBytes } from './sign-glow-mask.mjs?v=neon-focus-20261127-v1';

export const SIGN_CYCLE_MS=10000;
export const SIGN_GLYPH_MS=2800;
export const SIGN_ACTIVE_MS=5000;
export function signPhase(elapsed, reduced=false){
  if(reduced||!Number.isFinite(elapsed))return {letter:-100,bulb:-100};
  const t=((elapsed%SIGN_CYCLE_MS)+SIGN_CYCLE_MS)%SIGN_CYCLE_MS;
  if(t<SIGN_GLYPH_MS)return {letter:t/SIGN_GLYPH_MS*12,bulb:-100};
  if(t<SIGN_ACTIVE_MS)return {letter:-100,bulb:(t-SIGN_GLYPH_MS)/(SIGN_ACTIVE_MS-SIGN_GLYPH_MS)*(SIGN_BULB_COUNT+3)};
  return {letter:-100,bulb:-100};
}
// A small selective emissive mask, not a scene-wide bloom pass. The authored
// sign atlas is 128x32 with its 114x24 artwork at the upper left. No change to
// the base map, alpha, UVs, geometry or occlusion cache as the sequence runs.
export const SIGN_GLOW_GLSL=`
uniform sampler2D rgSignMask;
uniform float rgSignLetter;
uniform float rgSignBulb;
vec2 rgSignEnergy(vec2 uv){
  float id=floor(texture2D(rgSignMask,uv).r*255.0+0.5);
  if(id>=1.0&&id<=12.0){
    float p=rgSignLetter-(id-1.0);
    return vec2(smoothstep(0.0,0.22,p)*(1.0-smoothstep(0.40,1.0,p)),0.0);
  }
  if(id>=32.0){
    float p=rgSignBulb-(id-32.0);
    return vec2(0.0,smoothstep(0.0,0.5,p)*(1.0-smoothstep(1.0,3.0,p)));
  }
  return vec2(0.0);
}
vec3 rgSignLight(vec2 uv,vec3 base){
  if(rgSignLetter<0.0&&rgSignBulb<0.0)return base;
  vec2 d=vec2(1.0/128.0,1.0/32.0);
  vec2 core=rgSignEnergy(uv);
  vec2 nearGlow=vec2(0.0),farGlow=vec2(0.0);
  for(int i=0;i<8;i++){
    float a=float(i)*0.785398163;
    vec2 off=vec2(cos(a),sin(a))*d;
    nearGlow+=rgSignEnergy(uv+off*1.05);
    farGlow+=rgSignEnergy(uv+off*2.35);
  }
  vec2 halo=(nearGlow*0.68+farGlow*0.32)/8.0;
  vec3 pink=vec3(1.0,0.18,0.58), gold=vec3(1.0,0.86,0.18);
  vec3 lit=base+pink*halo.x*0.78+gold*halo.y*0.72;
  lit=mix(lit,vec3(1.0,0.94,1.0),core.x*0.90);
  lit=mix(lit,vec3(1.0,1.0,0.78),core.y*0.96);
  return lit;
}`;
export function createSignGlow(THREE,stage){
  const materials=new Set();
  stage.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
    const image=m?.map?.image;
    // Unique atlas dimensions in the supplied stage model (material 22).
    if(m?.isMeshBasicMaterial&&image?.width===128&&image?.height===32)materials.add(m);
  }});
  if(!materials.size)return null;
  const mask=new THREE.DataTexture(signMaskBytes(),128,32,THREE.RGBAFormat);
  mask.magFilter=mask.minFilter=THREE.NearestFilter;mask.generateMipmaps=false;mask.flipY=false;mask.needsUpdate=true;
  const uniforms={rgSignMask:{value:mask},rgSignLetter:{value:-100},rgSignBulb:{value:-100}};
  for(const m of materials){
    const before=m.onBeforeCompile,cache=m.customProgramCacheKey.bind(m);
    m.onBeforeCompile=function(shader,renderer){
      before.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+SIGN_GLOW_GLSL)
        .replace('#include <opaque_fragment>','outgoingLight=rgSignLight(vMapUv,outgoingLight);\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey=()=>cache()+'|rg-sign-glow-v1';m.needsUpdate=true;
  }
  let elapsed=0,last=null;
  return {update(time,active,reduced){
    if(active&&!reduced){if(last!==null)elapsed=(elapsed+Math.max(0,Math.min(250,time-last)))%SIGN_CYCLE_MS;last=time;}
    else last=null;
    const p=signPhase(elapsed,!active||reduced);uniforms.rgSignLetter.value=p.letter;uniforms.rgSignBulb.value=p.bulb;
  },dispose(){mask.dispose();}};
}
