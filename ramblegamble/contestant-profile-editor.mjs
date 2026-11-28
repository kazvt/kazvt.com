import { CAST_DEFAULTS, isCastId, isContestant, profileSnapshot, saveProfileEdit } from './contestant-profiles.mjs?v=cast-editor-20261128-v1';

export function markProfileTarget(node,id){
  node.setAttribute('data-rg-profile',id);
  if(node.tagName!=='BUTTON'){node.tabIndex=0;node.setAttribute('role','button');}
  node.setAttribute('aria-haspopup','dialog');
  return node;
}
export function mountProfileEditor({allowed=()=>true, doc=document, save=saveProfileEdit, snapshot=profileSnapshot}={}){
  const dialog=doc.createElement('dialog');dialog.className='rg-profile-dialog';dialog.setAttribute('aria-labelledby','rg-profile-title');
  dialog.innerHTML=`<form class="rg-profile-form"><header><img alt="" hidden><div><span class="rg-profile-role"></span><h2 id="rg-profile-title">EDIT PROFILE</h2></div></header>
    <label>Name<input name="name" maxlength="40" required autocomplete="off" spellcheck="false"></label>
    <label>Fugi URL<input name="source" maxlength="2048" required autocomplete="off" spellcheck="false" inputmode="url"></label>
    <div class="rg-profile-balances"><label><span><img src="/ramblegamble/assets/berries/points-chip.png" alt=""> Points</span><input name="points" inputmode="numeric" pattern="[0-9]+" maxlength="16" required></label><label><span><img src="/ramblegamble/assets/berries/star.png" alt=""> Stars</span><input name="stars" inputmode="numeric" pattern="[0-9]+" maxlength="16" required></label></div>
    <p class="rg-profile-error" role="alert" hidden></p><footer><button type="button" data-cancel>CANCEL</button><button type="submit">SAVE</button></footer></form>`;
  doc.body.append(dialog);
  const form=dialog.querySelector('form'),fields=form.elements,balances=dialog.querySelector('.rg-profile-balances'),error=dialog.querySelector('.rg-profile-error'),submit=dialog.querySelector('[type=submit]'),image=dialog.querySelector('header img');
  let session=null;
  const authorized=()=>allowed()&&!doc.documentElement.hasAttribute('data-rg-host-locked');
  const showError=message=>{error.textContent=message;error.hidden=!message;};
  function open(id,invoker=doc.activeElement){
    if(!isCastId(id)||!authorized()||dialog.open||doc.querySelector('dialog[open]:not(#rg-dice-dialog)'))return false;
    const contestant=isContestant(id);balances.hidden=!contestant;fields.points.disabled=fields.stars.disabled=!contestant;
    dialog.style.setProperty('--profile-accent',({faroe:'#54e49b',erin:'#be9aff',kaz:'#ffde63',hazel:'#d2adff','lillie-host':'#ff8cce'})[id]);
    image.hidden=!contestant;if(contestant)image.src=`/ramblegamble/assets/berries/${id}berry.png`;else image.removeAttribute('src');
    dialog.querySelector('.rg-profile-role').textContent=CAST_DEFAULTS[id].role;
    showError('');submit.disabled=false;
    let original;try{original=snapshot(id);}catch(e){showError(e.message);submit.disabled=true;}
    session={id,original,invoker};
    for(const key of ['name','source','points','stars'])fields[key].value=original?.[key]??'';
    dialog.showModal();fields.name.focus();fields.name.select();return true;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();const active=session;if(!active?.original||submit.disabled||!authorized())return;
    submit.disabled=true;showError('');
    const input=Object.fromEntries(['name','source','points','stars'].map(k=>[k,fields[k].value]));
    try{await save(active.id,active.original,input,()=>session===active&&dialog.open&&authorized());if(session===active&&dialog.open)dialog.close();}
    catch(e){if(session===active&&dialog.open)showError(e.message||'Could not save profile.');}
    finally{if(session===active)submit.disabled=false;}
  });
  dialog.querySelector('[data-cancel]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(dialog.open)return;const invoker=session?.invoker;session=null;if(authorized()&&invoker?.isConnected)invoker.focus({preventScroll:true});});
  function fromTarget(event){const node=event.target?.closest?.('[data-rg-profile]');return node&&{id:node.getAttribute('data-rg-profile'),node};}
  doc.addEventListener('contextmenu',event=>{const target=fromTarget(event);if(target&&open(target.id,target.node)){event.preventDefault();event.stopPropagation();}},true);
  doc.addEventListener('keydown',event=>{if(event.repeat||event.isComposing)return;const target=fromTarget(event);if(!target)return;
    const menu=event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10');
    const activate=target.node.tagName!=='BUTTON'&&(event.key==='Enter'||event.key===' ');
    if((menu||activate)&&open(target.id,target.node)){event.preventDefault();event.stopPropagation();}
  },true);
  return {open,dialog};
}
