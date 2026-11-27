// Pixel-sized light trim follows actual horizontal authored ledges (world units).
// No new physical lights, collision surfaces, camera offsets or picking objects.
export const TRIM_PATHS=Object.freeze([
 {a:[-1.524,.3048,-2.286],b:[3.4944,.3048,-2.286],count:18,accent:0xffdf75,kind:'stage'},
 {a:[4.572,.6096,-4.572],b:[7.62,.6096,-4.572],count:12,accent:0xc6a0ff,kind:'stage'},
 {a:[5.7912,3.9624,-4.8768],b:[15.5448,3.9624,-4.8768],count:30,accent:0xc6a0ff,kind:'balcony'},
 {a:[15.5448,3.9624,-4.8768],b:[15.5448,3.9624,.0625],count:16,accent:0xd2adff,kind:'balcony'},
]);
export function sampleTrim(index,count,time,focused=false,reduced=false){
 const p=(index+.5)/count;
 if(reduced)return .38;
 const head=((time/(focused?2200:4800))%1+1)%1;
 const d=Math.abs(p-head),distance=Math.min(d,1-d);
 return .24+(focused?.68:.47)*Math.exp(-((distance/.10)**2));
}
export function createRoomLightTrim(THREE,group,door){
 const specs=TRIM_PATHS.map(path=>({...path,a:path.a.map((v,i)=>v+(i===1?.016:0)),b:path.b.map((v,i)=>v+(i===1?.016:0))}));
 // Small violet pixels sit just inside the physical frame plane, outside the
 // aperture itself. The original liquid and zero-alpha fallback remain intact.
 const x=door.wallX-.028;
 specs.push({a:[x,door.minY+.10,door.minZ-.042],b:[x,door.maxY-.08,door.minZ-.042],count:10,accent:0x9e6cde,kind:'portal'},
 {a:[x,door.maxY+.035,door.minZ],b:[x,door.maxY+.035,door.maxZ],count:6,accent:0xc29cf0,kind:'portal'},
 {a:[x,door.maxY-.08,door.maxZ+.042],b:[x,door.minY+.10,door.maxZ+.042],count:10,accent:0x9e6cde,kind:'portal'});
 const count=specs.reduce((n,s)=>n+s.count,0),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.052,.026,.052),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.86,depthTest:true,depthWrite:false,toneMapped:false}),count);
 mesh.name='rg-architectural-trim';mesh.visible=false;mesh.frustumCulled=false;group.add(mesh);const o=new THREE.Object3D(),c=new THREE.Color();let j=0;
 for(const path of specs)for(let i=0;i<path.count;i++){const p=(i+.5)/path.count;o.position.set(...path.a.map((v,k)=>v+(path.b[k]-v)*p));o.updateMatrix();mesh.setMatrixAt(j++,o.matrix);}
 mesh.instanceMatrix.needsUpdate=true;
 let last=-Infinity,lastView='',lastReduced=null;
 function update(time,active,reduced,view){
   mesh.visible=active;if(!active)return;
   const kind=view?.kind||'';if(kind===lastView&&reduced===lastReduced&&(reduced||time-last<70))return;
   last=time;lastView=kind;lastReduced=reduced;j=0;
   for(const path of specs)for(let i=0;i<path.count;i++){const focused=path.kind==='balcony'&&kind==='hazel'||path.kind==='portal'&&kind==='dice-door';const value=sampleTrim(i,path.count,time,focused,reduced);c.setHex(path.accent).multiplyScalar(value);mesh.setColorAt(j++,c);}
   mesh.instanceColor.needsUpdate=true;
 }
 return {mesh,update};
}
