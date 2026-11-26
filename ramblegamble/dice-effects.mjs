// Presentation-only helpers. No outcome selection, physics mutation or external assets.
export const DICE_FX_PALETTE = Object.freeze({
  blank: '#fff29b', erinberry: '#cf9aff', faroeberry: '#6df4a2', kazberry: '#ffe567',
});
const GOLD = '#fff29b', PINK = '#ff62c9', VIOLET = '#6255ee';
export const clamp01 = n => Math.max(0, Math.min(1, n));
export const easeOut = n => 1 - (1 - clamp01(n)) ** 3;
export function diceCameraDistance(aspect, fov=43, targetY=1.65, elevation=Math.atan(.53)) {
  const tan=Math.tan(fov*Math.PI/360), sin=Math.sin(elevation), cos=Math.cos(elevation);
  let distance=10.5;
  for(const [x,y,z] of [[4.5,0,3.1],[4.5,3.2,3.1],[4.5,5.4,1.2]]) {
    for(const sz of [-1,1]) {
      const yy=y-targetY, zz=z*sz, depth=yy*sin+zz*cos, vertical=yy*cos-zz*sin;
      distance=Math.max(distance,depth+x/(tan*aspect*.88),depth+Math.abs(vertical)/(tan*.86));
    }
  }
  return distance;
}
export const FX_LIMITS = Object.freeze({ impacts: 24, particles: 192, landingDuration: 1.75 });

// Cannon reuses its event and contact objects, and dispatches both bodies and
// each manifold point. Copy immediately, then keep the strongest point per
// physical pair per substep. No global time gate that could lose a second hit.
export function snapshotDiceContact(contact, step) {
  const { bi, bj, ri, rj, ni } = contact || {};
  if (!bi || !bj || !ri || !rj || !ni) return null;
  const a = [bi.position.x + ri.x, bi.position.y + ri.y, bi.position.z + ri.z];
  const b = [bj.position.x + rj.x, bj.position.y + rj.y, bj.position.z + rj.z];
  const bothDice = bi.mass > 0 && bj.mass > 0;
  // The point on the static surface is more useful than the penetrating corner.
  const point = bothDice ? a.map((v, i) => (v + b[i]) / 2) : bi.mass === 0 ? a : b;
  const sign = bi.mass === 0 || bothDice ? 1 : -1;
  const normal = [ni.x * sign, ni.y * sign, ni.z * sign];
  const speed = Math.abs(contact.getImpactVelocityAlongNormal?.() || 0);
  if (![...point, ...normal, speed].every(Number.isFinite) || Math.hypot(...normal) < .5) return null;
  return { key: `${step}:${Math.min(bi.id, bj.id)}:${Math.max(bi.id, bj.id)}`, point, normal, speed, bothDice };
}
export function collectDiceContact(pending, contact, step) {
  const hit = snapshotDiceContact(contact, step);
  if (hit && (!pending.has(hit.key) || pending.get(hit.key).speed < hit.speed)) pending.set(hit.key, hit);
}
// A rocking cube may strike another corner while its body pair is still in
// contact. Cannon's collide event is onset-only; sample sharp solver impulses
// in preStep (after solve, before integration), not the resting weight.
export function collectDiceReimpacts(pending, contacts, previous, step, dt) {
  const strongest = new Map();
  for (const contact of contacts) {
    if (!contact.enabled || !Number.isFinite(contact.multiplier)) continue;
    const impulse = Math.max(0, contact.multiplier * dt);
    if (impulse < .50) continue;
    const hit = snapshotDiceContact(contact, step);
    if (!hit) continue;
    const pair = hit.key.slice(hit.key.indexOf(':') + 1);
    if (!strongest.has(pair) || strongest.get(pair).impulse < impulse) strongest.set(pair, {hit,impulse});
  }
  const next = new Map();
  for (const [pair,{hit,impulse}] of strongest) {
    const last = previous.get(pair) || 0;
    next.set(pair, impulse);
    if (!pending.has(hit.key) && impulse >= .70 && (last < .50 || impulse > last * 1.8)) {
      // The solved relative velocity is no longer the incoming velocity;
      // use the impulse as a visual-only strength estimate.
      pending.set(hit.key, {...hit, speed:Math.min(13,impulse * 2)});
    }
  }
  return next;
}
export function impactStyle(speed, bothDice = false) {
  const power = clamp01(speed / 13);
  return { power, size: .48 + 1.45 * power, life: .26 + .35 * power,
    count: Math.round(3 + 13 * power + (bothDice ? 5 : 0)), color: bothDice ? PINK : GOLD };
}

// Small authored, transparent arcade textures; the same pixel geometry and
// gold/pink/violet palette as the reel win animation. No full-screen flash.
export function paintDiceEffect(ctx, kind) {
  const n = ctx.canvas.width;
  ctx.clearRect(0, 0, n, n);
  ctx.save(); ctx.scale(n / 256, n / 256);
  const c = 128;
  const ring = (r, width, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
  };
  if (kind === 'shadow' || kind === 'aura') {
    const gradient = ctx.createRadialGradient(c,c,12,c,c,126);
    gradient.addColorStop(0, kind === 'shadow' ? '#09051ee6' : '#ffffff80');
    gradient.addColorStop(.48, kind === 'shadow' ? '#160b38a0' : '#ffffff45');
    gradient.addColorStop(1, kind === 'shadow' ? '#160b3800' : '#ffffff00');
    ctx.fillStyle = gradient; ctx.fillRect(0,0,256,256);
  } else if (kind === 'edge') {
    // Soft outer glow and a crisp stepped frame; leave the entire berry centre clear.
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 8; ctx.strokeRect(20,20,216,216);
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.strokeRect(20,20,216,216);
    ctx.fillStyle = '#ffffff';
    for (const [x,y] of [[14,14],[224,14],[14,224],[224,224]]) ctx.fillRect(x,y,18,18);
  } else if (kind === 'impact') {
    ring(68, 16, '#6255ee70'); ring(75, 5, '#ffffffdf'); ring(88, 3, '#ff62c9a0');
    for (let i=0;i<12;i++) {
      ctx.save(); ctx.translate(c,c); ctx.rotate(i*Math.PI/6);
      ctx.fillStyle = i%2 ? PINK : GOLD; ctx.fillRect(-3,91,6,i%2?12:25); ctx.restore();
    }
  } else if (kind === 'seal') {
    ring(111, 9, '#6255ee85'); ring(104, 3, '#ffffff'); ring(81, 2, '#ffffffa0');
    ctx.strokeStyle = '#ffffffc0'; ctx.lineWidth = 3;
    ctx.save(); ctx.translate(c,c); ctx.rotate(Math.PI/4); ctx.strokeRect(-65,-65,130,130); ctx.restore();
    for (let i=0;i<32;i++) {
      ctx.save(); ctx.translate(c,c); ctx.rotate(i*Math.PI/16);
      ctx.fillStyle = i%4 === 0 ? GOLD : '#ffffffb0'; ctx.fillRect(-2, i%4===0?86:94,4,i%4===0?15:7);
      ctx.restore();
    }
  }
  ctx.restore();
}

// Bounded GPU objects: one instanced pixel-shard batch, a ring pool and two
// independent landing seals. Geometry is depth-tested against actual dice.
export function createDiceEffects(THREE, scene, dieStates) {
  const texture = kind => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    paintDiceEffect(canvas.getContext('2d'), kind);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const maps = Object.fromEntries(['shadow','aura','edge','impact','seal'].map(kind => [kind,texture(kind)]));
  const plane = new THREE.PlaneGeometry(1,1);
  const makePlane = (kind, parent = scene, order = 1) => {
    const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map:maps[kind], transparent:true,
      depthWrite:false, depthTest:true, toneMapped:false, side:THREE.DoubleSide }));
    mesh.visible = false; mesh.renderOrder = order; parent.add(mesh); return mesh;
  };
  const up = new THREE.Vector3(0,1,0), planeNormal = new THREE.Vector3(0,0,1);
  const impacts = Array.from({length:FX_LIMITS.impacts}, () => ({mesh:makePlane('impact'), age:Infinity,life:0}));
  const dice = dieStates.map(({group}) => {
    const shadow = makePlane('shadow',scene,0), aura = makePlane('aura',scene,1), seal = makePlane('seal',scene,1), wave = makePlane('seal',scene,1);
    for (const mesh of [shadow,aura,seal,wave]) mesh.rotation.x = -Math.PI/2;
    const edge = makePlane('edge',group,3), edgeGlow = makePlane('edge',group,3);
    const chasers = Array.from({length:4},()=>{
      const mesh = new THREE.Mesh(plane,new THREE.MeshBasicMaterial({color:0xfff8de,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
      mesh.visible=false; mesh.renderOrder=4; edge.add(mesh); return mesh;
    });
    return {group,shadow,aura,seal,wave,edge,edgeGlow,chasers,age:Infinity,color:GOLD,landed:false,trailClock:0};
  });
  const shards = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({toneMapped:false}),FX_LIMITS.particles);
  shards.count = 0; shards.frustumCulled = false; scene.add(shards);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const particles = [];
  let seed = 0x52474446;
  const rng = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function addParticle(point, velocity, size, life, tint, priority = 1) {
    if (particles.length >= FX_LIMITS.particles) {
      const index = particles.findIndex(p => p.priority <= priority);
      if (index < 0) return;
      particles.splice(index,1);
    }
    particles.push({point:[...point],velocity:[...velocity],size,life,age:0,tint,spin:(rng()-.5)*10,phase:rng()*6.28,priority});
  }
  function burst(point, normal, count, power, tint, priority = 1) {
    const axis = new THREE.Vector3(...normal).normalize();
    const tangent = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y)>.9 ? planeNormal : up).normalize();
    const bitangent = new THREE.Vector3().crossVectors(axis,tangent);
    for(let i=0;i<count;i++) {
      const angle = (i+rng()*.6)/count*Math.PI*2, speed = (.8+rng()*2.3)*( .55+power);
      const v = tangent.clone().multiplyScalar(Math.cos(angle)*speed).addScaledVector(bitangent,Math.sin(angle)*speed).addScaledVector(axis,.5+rng()*2.0);
      addParticle(point,v.toArray(),.055+rng()*.10,.28+rng()*.55,[tint,GOLD,PINK,VIOLET,'#fff8de'][i%5],priority);
    }
  }
  function impact(hit, reduced) {
    if(reduced) return;
    const style = impactStyle(hit.speed,hit.bothDice);
    const slot = impacts.find(i=>i.age>=i.life) || impacts.reduce((a,b)=>a.age/a.life>b.age/b.life?a:b);
    const normal = new THREE.Vector3(...hit.normal).normalize();
    slot.mesh.position.set(...hit.point).addScaledVector(normal,.035);
    slot.mesh.quaternion.setFromUnitVectors(planeNormal,normal);
    slot.mesh.material.color.set(style.color);
    slot.age=0; slot.life=style.life; slot.size=style.size; slot.power=style.power;
    slot.mesh.visible=true;
    burst(hit.point,hit.normal,style.count,style.power,style.color);
    // A second outward hemisphere for dice-on-dice contact.
    if(hit.bothDice) burst(hit.point,hit.normal.map(n=>-n),Math.ceil(style.count/2),style.power,PINK);
  }
  function land(index, face, asset, reduced, settled = false) {
    const d=dice[index]; d.landed=true; d.age=settled?FX_LIMITS.landingDuration:0; d.color=DICE_FX_PALETTE[asset] || GOLD;
    for(const edge of [d.edge,d.edgeGlow]) {
      edge.position.set(...face.normal).multiplyScalar(1.222);
      edge.rotation.set(...face.rotation); edge.visible=true;
    }
    d.edge.material.color.set(GOLD); d.edgeGlow.material.color.set(d.color);
    for(const mesh of [d.aura,d.seal,d.wave]) mesh.material.color.set(d.color);
    if(!reduced) burst([d.group.position.x,.10,d.group.position.z],[0,1,0],36,1.15,d.color,2);
  }
  function clearLanding(d) {
    d.landed=false; d.age=Infinity;
    for(const mesh of [d.aura,d.seal,d.wave,d.edge,d.edgeGlow]) mesh.visible=false;
  }
  function clear() {
    particles.length=0; shards.count=0;
    for(const item of impacts) {item.age=Infinity;item.mesh.visible=false;}
    for(const d of dice) {clearLanding(d);d.trailClock=0;}
  }
  function update(dt, rolling, reduced) {
    // Live motion-preference changes immediately remove nonessential movement.
    if(reduced) {particles.length=0;for(const i of impacts){i.age=Infinity;i.mesh.visible=false;}}
    for(const i of impacts) {
      if(i.age>=i.life) {i.mesh.visible=false;continue;}
      i.age+=dt; const t=clamp01(i.age/i.life);
      i.mesh.visible=t<1;
      i.mesh.scale.setScalar(i.size*(.35+1.25*easeOut(t)));
      i.mesh.material.opacity=(.40+.45*i.power)*(1-t)**1.3;
    }
    for(const [index,d] of dice.entries()) {
      const g=d.group, body=dieStates[index].body;
      const scale=g.scale.x;
      d.shadow.visible=Boolean(body);
      d.shadow.position.set(g.position.x,.009,g.position.z);
      const altitude=Math.max(0,g.position.y-1.18*scale);
      d.shadow.scale.setScalar((3.1+altitude*.42)*scale);
      d.shadow.material.opacity=.64/(1+altitude*.8);
      if(rolling && !reduced && body) {
        d.trailClock+=dt;
        const speed=Math.hypot(body.velocity.x,body.velocity.y,body.velocity.z);
        if(d.trailClock>=.045 && speed>2.8) {
          d.trailClock=0;
          const v=new THREE.Vector3(body.velocity.x,body.velocity.y,body.velocity.z).normalize();
          const p=g.position.clone().addScaledVector(v,-1.45*scale);
          addParticle(p.toArray(),[-v.x*.8,.25-v.y*.4,-v.z*.8],.12,.25,index?PINK:GOLD,0);
        }
      }
      if(!d.landed) continue;
      d.age=reduced?FX_LIMITS.landingDuration:d.age+dt;
      const t=reduced?1:clamp01(d.age/FX_LIMITS.landingDuration), p=easeOut(t);
      for(const [mesh,y] of [[d.aura,.016],[d.seal,.024],[d.wave,.031]]) mesh.position.set(g.position.x,y,g.position.z);
      d.aura.visible=d.seal.visible=true; d.wave.visible=!reduced&&t<1;
      d.aura.scale.setScalar((4.45+1.15*(1-p))*scale);
      d.aura.material.opacity=.38+.34*(1-p);
      d.seal.scale.setScalar((4.10+.40*(1-p))*scale); d.seal.material.opacity=.78;
      d.seal.rotation.z=reduced?0:(1-p)*-.7;
      d.wave.scale.setScalar((3.0+3.5*p)*scale);d.wave.material.opacity=.82*(1-t)**1.7;
      // Actual top-face frame follows the die's local transform and stays lit.
      d.edge.scale.setScalar(2.78);d.edge.material.opacity=.92;
      d.edgeGlow.scale.setScalar(2.88+.12*(1-p));d.edgeGlow.material.opacity=.42+.40*(1-p);
      for (const [j,chaser] of d.chasers.entries()) {
        chaser.visible=!reduced&&t<1;
        const u=(t*2.4+j)%4, side=Math.floor(u), along=(u-side)*.84-.42;
        const xy=[[along,-.42],[.42,along],[-along,.42],[-.42,-along]][side];
        chaser.position.set(...xy,.004);
        chaser.rotation.z=side*Math.PI/2;
        chaser.scale.set(.10,.025,1);chaser.material.opacity=(1-t)*.9;
      }
      d.edgeGlow.position.set(...d.edge.position.toArray()).multiplyScalar(1.002);
    }
    for(let i=particles.length-1;i>=0;i--) {
      const p=particles[i];p.age+=dt;
      if(p.age>=p.life) particles.splice(i,1);
    }
    particles.forEach((p,i)=>{
      const t=p.age, fade=1-t/p.life;
      dummy.position.set(p.point[0]+p.velocity[0]*t,Math.max(.045,p.point[1]+p.velocity[1]*t-3.4*t*t),p.point[2]+p.velocity[2]*t);
      dummy.rotation.set(p.phase+t*p.spin,t*p.spin,p.phase-t*p.spin);
      dummy.scale.set(p.size*fade,p.size*fade*(p.priority===0?2.6:1),p.size*fade);
      dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix);shards.setColorAt(i,color.set(p.tint));
    });
    shards.count=particles.length;shards.instanceMatrix.needsUpdate=true;
    if(shards.instanceColor)shards.instanceColor.needsUpdate=true;
    return particles.length>0 || impacts.some(i=>i.age<i.life) || (!reduced&&dice.some(d=>d.landed&&d.age<FX_LIMITS.landingDuration));
  }
  return {impact,land,clear,update};
}
