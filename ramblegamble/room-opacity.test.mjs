import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudienceRenderer } from './audience-render.mjs';
import { createShowFX } from './show-fx.mjs';

// Minimal rendering doubles: verify material settings and the real update methods,
// without requiring a WebGL context or fetching the pinned Three.js module.
class Vector {
  constructor(x=0,y=0,z=0){this.set(x,y,z);}
  set(x,y,z){Object.assign(this,{x,y,z});return this;}
  copy(v){return this.set(v.x,v.y,v.z);}
  setScalar(s){return this.set(s,s,s);}
}
class Group {
  children=[]; visible=true;
  add(o){this.children.push(o);}
  remove(o){this.children=this.children.filter(c=>c!==o);}
}
class Mesh {
  position=new Vector();rotation=new Vector();scale=new Vector();visible=true;
  constructor(geometry,material){Object.assign(this,{geometry,material});}
}
class InstancedMesh extends Mesh {
  instanceMatrix={};instanceColor={};colors=[];
  constructor(g,m,count){super(g,m);this.count=count;}
  setMatrixAt(){}
  setColorAt(i,c){this.colors[i]=c.value;}
}
class Object3D {position=new Vector();updateMatrix(){}}
class Box3 {
  min=new Vector(-1,0,-1);max=new Vector(1,2,1);
  setFromObject(){return this;}
  getCenter(v){return v.set(0,1,0);}
}
class Color {setHex(v){this.value=v;return this;}multiplyScalar(v){this.value*=v;return this;}}
class Geometry {constructor(...args){this.args=args;}dispose(){}}
class Material {constructor(opts){Object.assign(this,opts);}dispose(){}}
class Texture {constructor(canvas){this.canvas=canvas;}dispose(){}}
const THREE={Group,Mesh,InstancedMesh,Object3D,Box3,Color,Vector3:Vector,CanvasTexture:Texture,MeshBasicMaterial:Material,PlaneGeometry:Geometry,BoxGeometry:Geometry,RingGeometry:Geometry,CylinderGeometry:Geometry,CircleGeometry:Geometry,FrontSide:0,DoubleSide:2,NearestFilter:1,SRGBColorSpace:'srgb',MathUtils:{lerp:(a,b,t)=>a+(b-a)*t}};

test('all three crowd panels blend at half opacity without writing transparent depth',()=>{
  const old=globalThis.document;
  const ctx=new Proxy({}, {get:()=>()=>{}});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{
    const audience=createAudienceRenderer(THREE,new Group());
    assert.equal(audience.group.children.length,3);
    for(const t of [0,167,1000])for(const mood of ['idle','cheer','suspense','shock']){
      audience.update(t,mood);
      for(const m of audience.group.children){
        assert.equal(m.material.opacity,.5);
        assert.equal(m.material.transparent,true);
        assert.equal(m.material.depthWrite,false);
        assert.equal(m.material.side,THREE.FrontSide);
        assert.ok(m.material.alphaTest>0&&m.material.alphaTest<.5);
        assert.equal(m.material.map.magFilter,THREE.NearestFilter);
      }
    }
  }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('portal squares stay at half opacity across views and chase animation',()=>{
  const fx=createShowFX(THREE,new Group(),{wheel:{},slot:{},contestants:[],door:{wallX:1,minY:0,maxY:2,minZ:0,maxZ:1}});
  const portal=fx.group.children.find(m=>m instanceof InstancedMesh&&m.count===36);
  assert.ok(portal);
  const initial=portal.colors.slice();
  for(const kind of ['overview','dice-door','slot'])for(const reduced of [false,true])for(const time of [0,250,1000]){
    fx.update(time,{view:{kind},reduced});
    assert.equal(portal.material.opacity,.5);
    assert.equal(portal.material.transparent,true);
    assert.equal(portal.material.depthWrite,false);
    assert.equal(portal.material.side,THREE.FrontSide);
  }
  assert.notDeepEqual(portal.colors,initial);
});
