// Presentation only. Normalized screen-space beams are composited above the
// room/billboards and below the card controls. No gameplay RNG or state writes.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mix = (a,b,t) => a+(b-a)*t;
const smooth = n => { n=clamp(n,0,1); return n*n*(3-2*n); };
const PALETTES = [
  {glow:'#a20d19', edge:'#ed3440', core:'#ff8b85'},
  {glow:'#790410', edge:'#d51d2a', core:'#ff766e'},
  {glow:'#b50b26', edge:'#ff4c43', core:'#ff9a90'},
  {glow:'#94051c', edge:'#e52a37', core:'#ff817a'},
];
// Midpoint displacement: decreasing irregularity at each subdivision. The
// final polyline is stable for the lifetime of the strike (no frame noise).
function bolt(a,b,depth,spread,random) {
  if (!depth) return [a,b];
  const mid={x:mix(a.x,b.x,.5)+(random()-.5)*spread,
    y:mix(a.y,b.y,.5)+(random()-.5)*spread*.32};
  const first=bolt(a,mid,depth-1,spread*.53,random);
  return first.slice(0,-1).concat(bolt(mid,b,depth-1,spread*.53,random));
}
export function createLightningStrike(event, at, anchor, random=Math.random, serial=0) {
  const intro=event.kind==='start', win=event.kind==='win';
  const count=clamp(Number(event.count)||0,0,9);
  const power=intro?.88:win?1:.57+count*.035;
  const x=clamp(Number.isFinite(anchor?.x)?anchor.x:.5,.12,.88);
  const y=clamp(Number.isFinite(anchor?.y)?anchor.y:.83,.59,.94);
  const side=serial%2===0?-1:1;
  const hit={x:clamp(x+side*(.06+random()*.09),.08,.92),y};
  const source={x:clamp(hit.x+side*(.20+random()*.24),.025,.975),y:-.035};
  const trunk=bolt(source,hit,5,.22+random()*.12,random);
  const forks=[];
  const forkCount=win?8:intro?6:4+Math.floor(random()*3);
  for(let i=0;i<forkCount;i++) {
    const index=3+Math.floor(random()*23), from=trunk[index];
    const direction=(i+serial)%2?1:-1;
    const end={x:clamp(from.x+direction*(.10+random()*.23),-.05,1.05),y:clamp(from.y+.10+random()*.23,.02,.98)};
    const points=bolt(from,end,3,.10+random()*.07,random);
    forks.push({points,root:index/32,width:.26+random()*.35});
    if(i<3) {
      const split=points[4];
      forks.push({points:bolt(split,{x:clamp(split.x+direction*.09,-.05,1.05),y:clamp(split.y+.13,.03,.99)},2,.075,random),root:index/32+.12,width:.18});
    }
  }
  const sparks=Array.from({length:win?40:intro?30:22},()=>({dx:(random()-.5)*.32,dy:-.04-random()*.19,life:.32+random()*.62,size:.7+random()*2.1}));
  return {at,hit,trunk,forks,sparks,power,palette:PALETTES[(serial+Math.floor(random()*2)*2)%PALETTES.length],
    travel:85+random()*50, duration:win?1180:intro?1020:850+count*20, width:2.4+power*2+random()*.9};
}
export function sampleLightningStrike(strike, now) {
  const age=now-strike.at;
  if(age<0 || age>=strike.duration) return null;
  const hitAge=age-strike.travel;
  const progress=smooth(age/strike.travel);
  // A traveling leader flows into one continuous strike, then fades. No
  // repeated white flashes or alternating full-frame exposure changes.
  const core=hitAge<0?.30*smooth(age/strike.travel):mix(.30,1,smooth(hitAge/40))*(1-smooth((hitAge-40)/330));
  const glow=hitAge<0?.23*progress:mix(.23,1,smooth(hitAge/65))*(1-smooth((hitAge-65)/(strike.duration-strike.travel-65)));
  const accent=clamp(strike.accent??1,0,1);
  return {strike,progress,core:clamp(core,0,1)*strike.power*accent,glow:clamp(glow,0,1)*strike.power*(.5+.5*accent),impact:hitAge<0?0:clamp(hitAge/(strike.duration-strike.travel),0,1)};
}
function path(ctx, points, w,h, progress=1) {
  const end=clamp(progress,0,1)*(points.length-1), last=Math.floor(end);
  ctx.beginPath();ctx.moveTo(points[0].x*w,points[0].y*h);
  for(let i=1;i<=last;i++)ctx.lineTo(points[i].x*w,points[i].y*h);
  if(last<points.length-1){const a=points[last],b=points[last+1],f=end-last;ctx.lineTo(mix(a.x,b.x,f)*w,mix(a.y,b.y,f)*h);}
}
function beam(ctx,points,w,h,progress,width,palette,core,glow) {
  if(progress<=0)return;
  path(ctx,points,w,h,progress);
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const [color,size,alpha] of [[palette.glow,8,.10*glow],[palette.glow,3.7,.28*glow],[palette.edge,1.7,.70*glow],[palette.core,.65,core]]) {
    ctx.strokeStyle=color;ctx.lineWidth=width*size;ctx.globalAlpha=clamp(alpha,0,1);ctx.stroke();
  }
}
export function paintLightning(ctx, width,height, samples) {
  ctx.clearRect(0,0,width,height);
  const scale=clamp(Math.min(width,height)/650,.62,1.45);
  for(const {strike,progress,core,glow,impact} of samples) {
    const {palette,hit}=strike,x=hit.x*width,y=hit.y*height;
    ctx.save();
    // Local volumetric-looking bloom, not a screen-wide flash. A floor
    // ellipse/ripple and drifting sparks give the strike a contact point.
    if(impact>0 && glow>0) {
      const radius=Math.min(width,height)*(.11+.11*impact);
      const halo=ctx.createRadialGradient(x,y,0,x,y,radius);
      halo.addColorStop(0,palette.edge);halo.addColorStop(.32,palette.glow);halo.addColorStop(1,'transparent');
      ctx.globalAlpha=.40*glow;ctx.fillStyle=halo;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
      ctx.strokeStyle=palette.edge;ctx.lineWidth=2*scale;ctx.globalAlpha=.62*glow;
      ctx.beginPath();ctx.ellipse(x,y,(12+impact*110)*scale,(4+impact*28)*scale,0,0,Math.PI*2);ctx.stroke();
      // A second, dimmer expanding pressure front plus rising hot cinders.
      ctx.globalAlpha=.26*glow*(1-impact);ctx.lineWidth=4*scale;ctx.beginPath();ctx.ellipse(x,y,(20+impact*170)*scale,(6+impact*45)*scale,0,0,Math.PI*2);ctx.stroke();
      for(const s of strike.sparks) {
        const t=impact/s.life;if(t>=1)continue;
        const px=x+s.dx*width*t,py=y+s.dy*height*t+.10*height*t*t;
        ctx.globalAlpha=(1-t)*glow*.9;ctx.fillStyle=palette.core;
        ctx.fillRect(px,py,s.size*scale,(s.size+2)*scale);
        ctx.strokeStyle=palette.edge;ctx.lineWidth=Math.max(.6,s.size*.48)*scale;ctx.globalAlpha=(1-t)*glow*.52;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-s.dx*width*.065,py-s.dy*height*.065);ctx.stroke();
      }
    }
    for(const f of strike.forks) beam(ctx,f.points,width,height,clamp((progress-f.root)*2.7,0,1),strike.width*f.width*scale,palette,core*.72,glow*.82);
    beam(ctx,strike.trunk,width,height,progress,strike.width*scale,palette,core,glow);
    ctx.restore();
  }
}
export function createLightningLayer(preview) {
  const canvas=preview.ownerDocument.createElement('canvas');
  canvas.className='rg-smeemo-lightning';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
  preview.append(canvas);
  let ctx=null;
  try {ctx=canvas.getContext('2d');} catch {}
  return {
    paint(samples,width,height) {
      if(!ctx || !samples.length || width<=0 || height<=0){canvas.hidden=true;return;}
      const ratio=Math.min(1.5,globalThis.devicePixelRatio||1,Math.sqrt(2500000/(width*height)));
      const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
      if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
      canvas.hidden=false;ctx.setTransform(w/width,0,0,h/height,0,0);paintLightning(ctx,width,height,samples);
    },
    clear(){if(canvas.hidden)return;canvas.hidden=true;if(ctx){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);}},
  };
}
