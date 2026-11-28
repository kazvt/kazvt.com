import {AWARD_NAMES, POINT_AWARD_TTL, normalizeAwardTotals} from './point-award-events.mjs?v=star-stinger-20261128-v1';
export const POINT_STINGER_URL='/ramblegamble/assets/stingers/points-earned.webm?v=points-stinger-20261128-v1';
export const STAR_STINGER_URL='/ramblegamble/assets/stingers/star-earned.webm?v=star-stinger-20261128-v1';
const STAR='/ramblegamble/assets/berries/star.png';
const CHIP='/ramblegamble/assets/berries/points-chip.png';
const FORMAT=new Intl.NumberFormat('en-US');
const FALLBACK_MS=3500, START_LIMIT=1800, STALL_LIMIT=1800, MAX_PLAY_MS=7500;
// Awards that arrive during a five-second clip share the next card. BigInt
// preserves exact displayed amounts even when spending occurs between awards.
export function combinePointAwards(events){
  const totals={};
  for(const event of events)for(const [name,amount] of Object.entries(normalizeAwardTotals(event.totals)))totals[name]=(totals[name]??0n)+BigInt(amount);
  return AWARD_NAMES.filter(name=>totals[name]>0n).map(name=>({name,amount:totals[name],formatted:`+${FORMAT.format(totals[name])}`}));
}
export function createPointAwardStinger({root,video:pointVideo,starVideo,rows,title,status,allowed,blocked,muted,reduced,
  doc=globalThis.document, clock=()=>performance.now(), wall=()=>Date.now(),
  setTimer=(fn,ms)=>setTimeout(fn,ms), clearTimer=id=>clearTimeout(id)}){
  let pending=[],active=null,token=0,timer=null,prepared=false,disposed=false;
  let video=pointVideo;
  const media=[pointVideo,starVideo].filter(Boolean);
  function prepare(){if(prepared||reduced()||disposed)return;prepared=true;for(const [element,url] of [[pointVideo,POINT_STINGER_URL],[starVideo,STAR_STINGER_URL]]){if(!element)continue;try{element.preload='auto';element.src=url;element.load();}catch{}} }
  function stopVideo(){if(!video)return;video.pause();video.hidden=true;try{video.currentTime=0;}catch{}}
  function stop(){token++;active=null;stopVideo();root.hidden=true;root.classList.remove('is-video');status.textContent='';}
  function cancel(){pending=[];stop();if(timer!==null){clearTimer(timer);timer=null;}}
  function schedule(){if(!disposed&&timer===null&&(active||pending.length))timer=setTimer(()=>{timer=null;step();},100);}
  function fallback(){if(!active)return;token++;active.mode='fallback';active.since=clock();stopVideo();root.classList.remove('is-video');title.hidden=false;schedule();}
  function render(data,isStar){
    const unit=isStar?'stars':'points';
    title.textContent=isStar?'STAR EARNED!':'POINTS EARNED!';
    root.dataset.award=isStar?'star':'point';
    const elements=data.map(({name,formatted})=>{
      const row=doc.createElement('div');row.className='rg-award-row';row.dataset.berry=name;
      const label=doc.createElement('span');label.className='rg-award-name';label.textContent=name.toUpperCase();
      const value=doc.createElement('span');value.className='rg-award-value';
      const chip=doc.createElement('img');chip.src=isStar?STAR:CHIP;chip.alt='';chip.draggable=false;
      const number=doc.createElement('span');number.className='rg-award-number';number.textContent=formatted;
      if(formatted.length>13)row.classList.add('is-long');
      value.append(chip,number);row.append(label,value);return row;
    });
    rows.replaceChildren(...elements);root.dataset.count=String(elements.length);
    status.textContent=`${isStar?'Star':'Points'} earned! ${data.map(({name,formatted})=>`${name}: ${formatted} ${unit}`).join('; ')}.`;
  }
  function start(events){
    const data=combinePointAwards(events);if(!data.length)return;
    const isStar=events[0].type==='star-award';
    video=isStar?starVideo:pointVideo;
    render(data,isStar);root.hidden=false;title.hidden=false;root.classList.remove('is-video');
    active={mode:'starting',since:clock(),started:clock(),progressAt:clock(),lastTime:0,autoplayMuted:false};
    const ticket=++token;
    if(reduced()||!video){fallback();return;}
    try{prepare();video.muted=muted();video.currentTime=0;video.hidden=true;
      function attempt(){
        if(!active||ticket!==token)return;
        let promise;try{promise=video.play();}catch{fallback();return;}
        Promise.resolve(promise).then(()=>{
          if(!active||ticket!==token)return;
          if(!allowed()||blocked()){stop();return;}
          active.mode='video';active.progressAt=clock();video.hidden=false;title.hidden=true;root.classList.add('is-video');
        }).catch(error=>{
          if(!active||ticket!==token)return;
          if(error?.name==='NotAllowedError'&&!video.muted){active.autoplayMuted=true;video.muted=true;attempt();}
          else fallback();
        });
      }
      attempt();
    }catch{fallback();}
  }
  function step(){
    if(disposed)return;
    if(!allowed()){cancel();return;}
    pending=pending.filter(event=>wall()-event.at<=POINT_AWARD_TTL);
    if(blocked()){if(active)stop();schedule();return;}
    const now=clock();
    if(active){
      if(reduced()&&active.mode!=='fallback')fallback();
      else if(active.mode==='fallback'){if(now-active.since>=FALLBACK_MS)stop();}
      else{
        video.muted=active.autoplayMuted||muted();
        if(active.mode==='starting'){if(now-active.since>=START_LIMIT)fallback();}
        else if(video.ended)stop();
        else if(now-active.started>=MAX_PLAY_MS)fallback();
        else if(video.currentTime>active.lastTime){active.lastTime=video.currentTime;active.progressAt=now;}
        else if(now-active.progressAt>=STALL_LIMIT)fallback();
      }
    }
    if(!active&&pending.length){
      // Preserve award order and never combine different currencies into one clip.
      const type=pending[0].type??'point-award';
      const next=pending.findIndex(event=>(event.type??'point-award')!==type);
      const batch=pending.splice(0,next<0?pending.length:next);start(batch);
    }
    schedule();
  }
  function enqueue(event){if(disposed||!allowed())return;pending.push(event);step();}
  function onError(event){if(event.currentTarget===video&&active&&active.mode!=='fallback')fallback();}
  function onEnded(event){if(event.currentTarget===video&&active?.mode==='video'&&video.ended){stop();step();}}
  for(const element of media){element.addEventListener('error',onError);element.addEventListener('ended',onEnded);}
  function relocate(parent){
    if(!parent||root.parentNode===parent)return;
    if(active)stop(); // do not leave an audible clip under a different top layer
    parent.append(root,status);step();
  }
  function dispose(){cancel();disposed=true;for(const element of media){element.removeEventListener('error',onError);element.removeEventListener('ended',onEnded);element.removeAttribute('src');element.load();}}
  return {prepare,enqueue,step,cancel,relocate,dispose};
}
