// Render-only world accents. No physics, point calculation, hit targets or camera pose changes.
export function createShowFX(THREE,scene,{wheel, wheelPivot,ball,door}) {
  const group=new THREE.Group();group.name='rg-show-fx';scene.add(group);
  const basic=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false,fog:false,side:THREE.DoubleSide});
  const ring=(radius,width,color)=>{const m=new THREE.Mesh(new THREE.RingGeometry(radius-width,radius,48),basic(color));m.rotation.x=-Math.PI/2;group.add(m);m.visible=false;return m;};
  const ringAt=(r,p)=>r.position.copy(p);
  const wheelRestY=wheelPivot?.position.y;
  const wheelBounds=new THREE.Box3().setFromObject(wheel),center=wheelBounds.getCenter(new THREE.Vector3()),radius=Math.min(wheelBounds.max.x-wheelBounds.min.x,wheelBounds.max.z-wheelBounds.min.z)*.5;
  center.y=wheelBounds.max.y+.015;
  const halo=ring(radius*1.04,.035,0xffe66a);ringAt(halo,center);
  const outer=ring(radius*1.13,.017,0xc7a3ff);ringAt(outer,center);
  const pocket=ring(.15,.035,0xffe66a),wave=ring(.16,.022,0xff80cd);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.35,.075,.86,24,1,true),basic(0xffe6a0,.14));beam.visible=false;group.add(beam);
  const winnerEcho=ring(.27,.022,0xfff4c1);
  const sparkGeometry=new THREE.BoxGeometry(.035,.035,.035),sparkMaterial=basic(0xffe8a0);
  const sparks=new THREE.InstancedMesh(sparkGeometry,sparkMaterial,24);sparks.frustumCulled=false;group.add(sparks);sparks.visible=false;
  const matrix=new THREE.Object3D();const lightMatrix=new THREE.Object3D();const trailCount=18;
  const trail=new THREE.InstancedMesh(new THREE.BoxGeometry(.038,.038,1),basic(0xffe98c,.78),trailCount);trail.frustumCulled=false;group.add(trail);trail.visible=false;
  const trailPoints=[];const direction=new THREE.Vector3(),axis=new THREE.Vector3(0,0,1);let lastTrail=-Infinity,impactAt=-Infinity,settleAt=-Infinity;const impactPos=new THREE.Vector3(),settlePos=new THREE.Vector3(),temp=new THREE.Vector3();
  // Draw a gold/pink pocket burst at the actual ball, not the computed winner index.
  function impact(time,settled=false){if(!ball)return;ball.getWorldPosition(temp);impactPos.copy(temp);impactAt=time;if(settled){settleAt=time;settlePos.copy(temp);trailPoints.length=0;}}
  // Each set is one instanced draw call with independent chase colors, instead of a mesh per bulb.
  function lights(geometry,positions,colors,opacity){
    const mesh=new THREE.InstancedMesh(geometry,basic(0xffffff,opacity),positions.length);const color=new THREE.Color();
    for(let i=0;i<positions.length;i++){lightMatrix.position.set(...positions[i]);lightMatrix.updateMatrix();mesh.setMatrixAt(i,lightMatrix.matrix);mesh.setColorAt(i,color.setHex(colors[i%colors.length]));}
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;group.add(mesh);
    return {mesh,colors,color,count:positions.length};
  }
  function chase(batch,time,reduced,rate=.004,base=.45){
    const {mesh,colors,color,count}=batch;
    for(let i=0;i<count;i++){const intensity=reduced?.72:base+(1-base)*(.5+.5*Math.sin(time*rate-i*.56));mesh.setColorAt(i,color.setHex(colors[i%colors.length]).multiplyScalar(intensity));}
    mesh.instanceColor.needsUpdate=true;
  }
  const portal=lights(new THREE.BoxGeometry(.035,.075,.075),Array.from({length:36},(_,i)=>{const a=i/36*Math.PI*2;return [door.wallX-.07,(door.minY+door.maxY)/2+Math.sin(a)*(door.maxY-door.minY)*.48,(door.minZ+door.maxZ)/2+Math.cos(a)*(door.maxZ-door.minZ)*.49];}),[0xffffff,0xcda8ff],.5);
  // Closed cubes should blend once, rather than layering their back faces.
  portal.mesh.material.side=THREE.FrontSide;
  function clearRoulette(){if(wheelPivot)wheelPivot.position.y=wheelRestY;trailPoints.length=0;trail.visible=pocket.visible=wave.visible=sparks.visible=halo.visible=outer.visible=beam.visible=winnerEcho.visible=false;impactAt=settleAt=-Infinity;lastTrail=-Infinity;}
  function update(time,{active=true,spinning=false,view={},reduced=false}={}){
    group.visible=active;if(!active){clearRoulette();return;}
    const roulette=view.kind==='roulette';
    if(!roulette||reduced){clearRoulette();}else{
      const since=time-settleAt,impactAge=time-impactAt;
      halo.visible=outer.visible=spinning||since<1800;
      const e=spinning?.38+.12*Math.sin(time/145):Math.max(0,1-since/1800);
      halo.material.opacity=.7*e;outer.material.opacity=.5*e;
      const wobble=spinning?.006*Math.sin(time/30):0;if(wheelPivot)wheelPivot.position.y=wheelRestY+(spinning? .055*Math.sin(time/37):0);halo.scale.setScalar(1+wobble);outer.scale.setScalar(1-wobble);
      if(spinning&&ball&&time-lastTrail>=22){lastTrail=time;ball.getWorldPosition(temp);trailPoints.unshift(temp.clone());trailPoints.length=Math.min(trailPoints.length,trailCount);}
      if(!spinning)trailPoints.length=0;
      trail.visible=trailPoints.length>1;trail.count=Math.max(0,trailPoints.length-1);
      for(let i=0;i<trail.count;i++){const p=trailPoints[i],q=trailPoints[i+1];direction.subVectors(q,p);const distance=direction.length();matrix.position.copy(p).lerp(q,.32);matrix.quaternion.setFromUnitVectors(axis,distance>1e-6?direction.normalize():axis);const fade=1-i/trailCount;matrix.scale.set(fade,fade,Math.min(.22,distance*.65)*fade);matrix.updateMatrix();trail.setMatrixAt(i,matrix.matrix);}trail.instanceMatrix.needsUpdate=true;
      wave.visible=impactAge>=0&&impactAge<480;sparks.visible=wave.visible;
      if(wave.visible){const p=impactAge/480;ringAt(wave,impactPos);wave.scale.setScalar(.45+p*2.3);wave.material.opacity=(1-p)*.85;sparkMaterial.opacity=(1-p)*.9;for(let i=0;i<24;i++){const a=i*Math.PI*2/24,d=.05+p*(.22+(i%4)*.035);matrix.position.set(impactPos.x+Math.cos(a)*d,impactPos.y+.23*Math.sin(Math.PI*p),impactPos.z+Math.sin(a)*d);matrix.quaternion.identity();matrix.scale.setScalar(1-p*.7);matrix.updateMatrix();sparks.setMatrixAt(i,matrix.matrix);}sparks.instanceMatrix.needsUpdate=true;}
      pocket.visible=beam.visible=winnerEcho.visible=since>=0&&since<2200;
      if(pocket.visible){ringAt(pocket,settlePos);pocket.position.y+=.012;pocket.material.opacity=.85*(1-since/2200);pocket.scale.setScalar(1+.3*Math.sin(since/180));
        beam.position.copy(settlePos);beam.position.y+=.43;beam.material.opacity=.13*(1-since/2200);
        ringAt(winnerEcho,settlePos);winnerEcho.position.y+=.017;winnerEcho.scale.setScalar(1+(since%700)/700);winnerEcho.material.opacity=.68*(1-since/2200)*(1-(since%700)/700);
      }
    }
    // Only the VIP oval remains as decorative scene lighting.
    chase(portal,time,reduced,.005,view.kind==='dice-door'?.35:.72);
  }
  function dispose(){clearRoulette();const geometry=new Set(),materials=new Set();group.traverse(m=>{if(m.isInstancedMesh)m.dispose?.();if(m.geometry)geometry.add(m.geometry);if(m.material)materials.add(m.material);});for(const g of geometry)g.dispose();for(const m of materials)m.dispose();scene.remove(group);}
  return {group,impact,clearRoulette,update,dispose};
}
