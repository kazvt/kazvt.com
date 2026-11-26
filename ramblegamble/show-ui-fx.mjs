// Transient presentation cues. Effects never own the interactive elements or game state.
export function motionAllowed(){return typeof window!=='undefined'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.hidden&&!document.documentElement.hasAttribute('data-rg-host-locked');}
export function showBurst(target,{color='#ffe576',kind='star',count=12}={}){
  if(!target?.isConnected||!motionAllowed()||!target.animate||!target.getClientRects().length)return;
  // All geometry stays inside the target's bounds; no viewport overflow or intercepted clicks.
  const overlay=document.createElement('span');overlay.className='rg-fx-burst';overlay.setAttribute('aria-hidden','true');
  target.querySelector(':scope > .rg-fx-burst')?.remove();target.append(overlay);
  const bounds=target.getBoundingClientRect();
  for(let i=0;i<Math.min(24,count);i++){
    const chip=document.createElement('i');chip.className=`rg-fx-chip is-${kind}`;chip.style.background=color;const a=i*2*Math.PI/count;
    chip.style.setProperty('--dx',`${Math.cos(a)*bounds.width*.4}px`);chip.style.setProperty('--dy',`${Math.sin(a)*bounds.height*.4}px`);
    chip.style.setProperty('--mid-x',`${Math.cos(a)*bounds.width*.16}px`);chip.style.setProperty('--mid-y',`${Math.sin(a)*bounds.height*.16}px`);
    chip.style.left='50%';chip.style.top='50%';
    chip.style.animationDelay=`${(i%4)*35}ms`;overlay.append(chip);
  }
  setTimeout(()=>overlay.remove(),1050);
}
function flyToken(target,source,text,color,{delay=0,arc=18,rotation=-15}={}){
  if(!motionAllowed()||!target?.isConnected||!source?.isConnected||!target.getClientRects().length||!source.getClientRects().length)return;
  const shell=target.closest('.rg-show-round,.rg-shop-stage');if(!shell)return;
  const a=source.getBoundingClientRect(), b=target.getBoundingClientRect(), r=shell.getBoundingClientRect();
  const x=a.left+a.width/2-r.left,y=a.top+a.height/2-r.top,dx=b.left+b.width/2-r.left-x,dy=b.top+b.height/2-r.top-y;
  const token=document.createElement('span');token.className='rg-flight-token';token.setAttribute('aria-hidden','true');token.textContent=text;token.style.color=color;token.style.left=`${x}px`;token.style.top=`${y}px`;shell.append(token);
  const anim=token.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:0},{transform:`translate(calc(-50% + ${dx*.5}px),calc(-50% + ${dy*.5-arc}px)) scale(1.12) rotate(${rotation}deg)`,opacity:1,offset:.5},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.45)`,opacity:0}],{duration:540,delay,easing:'ease-out',fill:'both'});
  anim.finished.then(()=>token.remove(),()=>token.remove());setTimeout(()=>token.remove(),750+delay);
}
export function purchaseFlight(target,buyer,price){
  if(!motionAllowed()||!target?.isConnected)return;
  // The committed buyer is authoritative even if the selection changed while
  // the points/room locks were pending. Stagger the token paths, not the charge.
  for(let i=0;i<5;i++)flyToken(target,buyer,'●',i%2?'#fff2ac':'#ffdc58',{delay:i*65,arc:18+i*9,rotation:i*18-36});
  showBurst(target,{kind:'coin',color:'#ffdc58',count:24});
  if(buyer?.isConnected){
    showBurst(buyer,{color:'#ffdc58',count:10});
    buyer.animate?.([{scale:'1'},{scale:'1.06'},{scale:'1'}],{duration:400});
    if(price>0)flyToken(target,buyer,`−${price}`,'#fff2ac',{delay:110,arc:32});
  }
}
export function voteFlight(target){
  if(!motionAllowed()||!target?.isConnected)return;
  const badge=target.querySelector('.rg-card-vote-count');if(!badge)return;
  badge.animate?.([{transform:'translate(-30px,20px) scale(.45)',opacity:0},{transform:'translate(0,0) scale(1.35)',opacity:1,offset:.65},{transform:'none',opacity:1}],{duration:550,easing:'cubic-bezier(.18,.8,.22,1)'});
  flyToken(target,target.closest('.rg-show-round')?.querySelector('.rg-card-prompt-side'),' +1','#ffdf74');
  showBurst(target,{color:'#ffdf74',count:12});
}
export function createScoreHud(root,{names,assetPath,visible=()=>true}={}){
  const colors={faroe:'#44db86',erin:'#b597ff',kaz:'#ffdc58'},nodes=new Map();let previous=null,frame=0,hideTimer=0;
  const reduce=()=>!motionAllowed()||!visible();
  root.replaceChildren();
  const announcement=document.createElement('span');announcement.className='rg-visually-hidden';root.append(announcement);
  for(const name of names){const entry=document.createElement('span');entry.className='rg-points-entry';entry.style.setProperty('--berry-fx',colors[name]);entry.setAttribute('aria-hidden','true');
    const img=document.createElement('img');img.src=`${assetPath}${name}berry.png`;img.alt=name[0].toUpperCase()+name.slice(1);img.title=img.alt;img.width=img.height=24;
    const value=document.createElement('span');value.className='rg-points-value';entry.append(img,value);root.append(entry);nodes.set(name,{entry,value,shown:0,target:0,from:0,started:0,duration:0});}
  function tick(time){frame=0;let work=false;for(const n of nodes.values()){
    const p=reduce()?1:Math.min(1,Math.max(0,(time-n.started)/Math.max(1,n.duration)));n.shown=p===1?n.target:Math.round(n.from+(n.target-n.from)*(1-(1-p)**3));n.value.textContent=String(n.shown);work||=p<1;
  }if(work)frame=requestAnimationFrame(tick);}
  return scores=>{const animate=previous!==null&&!reduce();const now=performance.now();let changed=false;
    for(const name of names){const n=nodes.get(name),target=scores[name],delta=target-(previous?.[name]??target);if(previous&&delta===0)continue;changed=true;n.from=animate?n.shown:target;n.target=target;n.started=now;n.duration=animate?Math.min(1050,420+Math.log10(Math.abs(delta)+1)*105):0;
      if(animate&&delta){n.entry.querySelector('.rg-score-delta')?.remove();const d=document.createElement('span');d.className='rg-score-delta';d.textContent=`${delta>0?'+':'−'}${Math.abs(delta).toLocaleString()}`;n.entry.append(d);d.addEventListener('animationend',()=>d.remove(),{once:true});setTimeout(()=>d.remove(),1400);n.entry.animate?.([{scale:'1'},{scale:Math.abs(delta)>=10000?'1.13':'1.06'},{scale:'1'}],{duration:550});}}
    previous={...scores};if(!changed)return;announcement.textContent=names.map(n=>`${n}: ${scores[n]}`).join(', ');clearTimeout(hideTimer);const any=names.some(n=>scores[n]>0);root.hidden=!any&&!animate;if(!any&&animate)hideTimer=setTimeout(()=>{root.hidden=true;},1400);if(frame)cancelAnimationFrame(frame);tick(now);
  };
}
