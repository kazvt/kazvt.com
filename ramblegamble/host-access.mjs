import { SITE_HOST_VERIFIER } from './host-access-policy.mjs?v=host-security-20261126-v1';
import { createAccessState, createVerifier, verifyPassword, validVerifier, PROFILE_KEY, GRANT_KEY, EPOCH_KEY } from './host-access-core.mjs?v=compact-lock-20261126-v1';

// Presentation-only gate: static source and local storage are not an auth boundary.
// Initial boot requires unlock; manual lock of an already-running tab leaves its reader alive.
const root=document.documentElement;
const gate=document.getElementById('rg-host-gate');
const form=gate.querySelector('form');
const password=gate.querySelector('[name=passphrase]');
const confirmField=gate.querySelector('[name=confirmation]');
const confirmLabel=gate.querySelector('[data-confirm]');
const remember=gate.querySelector('[name=remember]');
const message=gate.querySelector('[role=status]');
const submit=gate.querySelector('[type=submit]');
const lockButtons=[...document.querySelectorAll('[data-host-lock]')];
let access, booted=false, bootPromise=null, busy=false, locked=true, inertBefore=new Map();
const isConsole=location.pathname.replace(/\/$/,'').endsWith('/console');
const appModules=isConsole? ['/rg/console/console.js?v=live-trivia-20261126-v1'] : [
  '/ramblegamble/ramblegamble.js?v=live-trivia-20261126-v1',
  '/ramblegamble/dice-mode.js?v=live-trivia-20261126-v1',
  '/ramblegamble/trivia-ui.js?v=live-trivia-20261126-v1',
  '/ramblegamble/card-games-ui.js?v=live-trivia-20261126-v1',
];
function setLocked(next) {
  const changed=locked!==next;locked=next;
  if(next){
    if(changed){password.value="";confirmField.value="";}
    // Top-layer modal dialogs otherwise escape ancestor inertness.
    for(const dialog of document.querySelectorAll('dialog[open]')) { dialog.dispatchEvent(new Event('cancel',{cancelable:true})); if(dialog.open)dialog.close(); }
    for(const child of document.body.children) if(child!==gate && !inertBefore.has(child)){inertBefore.set(child,child.inert);child.inert=true;}
    root.setAttribute('data-rg-host-locked',''); gate.hidden=false;
    const setup=access?.profile()===null;
    confirmLabel.hidden=!setup; confirmField.disabled=!setup; confirmField.required=setup;
    password.autocomplete=setup?'new-password':'current-password';
    submit.textContent=setup?'SET PASSWORD':'UNLOCK';
    password.focus();
  }else{
    root.removeAttribute('data-rg-host-locked');gate.hidden=true;
    for(const [child,prior] of inertBefore)child.inert=prior;inertBefore.clear();
  }
}
// Installed before any game code. Gate inputs must still receive their own events,
// but shortcuts from the arcade must not see their keypresses.
for(const type of ['keydown','keyup','keypress','pointerdown','pointerup','click','contextmenu','submit']){
  window.addEventListener(type,e=>{if(locked&&!gate.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
  gate.addEventListener(type,e=>e.stopPropagation());
}
async function reconcile(){
  if(!access)return;
  let allowed=false;try{allowed=access.authorized();}catch{}
  if(!allowed){setLocked(true);return;}
  if(!booted){
    if(!bootPromise)bootPromise=(async()=>{for(const path of appModules)await import(path);booted=true;})();
    try{await bootPromise;}catch{message.textContent='Host application could not load. Reload and try again.';setLocked(true);return;}
  }
  // A different tab may lock while scripts are downloading.
  try{if(access.authorized())setLocked(false);else setLocked(true);}catch{setLocked(true);}
}
try{
  if(!globalThis.crypto?.subtle)throw Error('HTTPS and Web Crypto required');
  access=createAccessState(localStorage,sessionStorage,SITE_HOST_VERIFIER);
  // Test storage before allowing enrollment or unlocking.
  localStorage.getItem(PROFILE_KEY);sessionStorage.getItem(GRANT_KEY);
  if(access.profile()!==null&&!validVerifier(access.profile()))throw Error('Invalid host lock profile');
  password.disabled=false;submit.disabled=false;setLocked(true);reconcile();
}catch(error){access=null;submit.disabled=true;message.textContent=`Host lock unavailable: ${error.message}. Use HTTPS and enable site storage.`;}
form.addEventListener('submit',async e=>{
  e.preventDefault();if(!access||busy)return;busy=true;submit.disabled=true;message.textContent='Checking…';
  const secret=password.value, confirmation=confirmField.value;password.value='';confirmField.value='';
  const work=async()=>{
    const before=access.epoch();let verifier=access.profile();
    if(verifier===null){if(secret!==confirmation)throw Error('Passwords do not match.');verifier=await createVerifier(secret);if(access.epoch()!==before)throw Error('Host was locked in another tab. Try again.');access.enroll(verifier);}
    else if(!await verifyPassword(secret,verifier))throw Error('Incorrect password.');
    if(access.epoch()!==before)throw Error('Host was locked in another tab. Try again.');
    access.grant(verifier,remember.checked);
  };
  try{if(navigator.locks?.request)await navigator.locks.request('rg-host-lock-enroll-v1',work);else await work();message.textContent='Loading…';await reconcile();}
  catch(error){message.textContent=error.message||'Unlock failed.';setLocked(true);}
  finally{busy=false;submit.disabled=false;}
});
for(const button of lockButtons)button.addEventListener('click',()=>{
  try{access.lock();setLocked(true);message.textContent='';}catch{setLocked(true);message.textContent='Could not persist the lock. Close other host tabs if needed.';}
});
window.addEventListener('storage',event=>{if([PROFILE_KEY,GRANT_KEY,EPOCH_KEY,null].includes(event.key))reconcile();});
window.addEventListener('pageshow',()=>reconcile());
const download=document.querySelector('[data-host-policy-download]');
if(download){download.hidden=SITE_HOST_VERIFIER!==null;download.addEventListener('click',()=>{
  if(!access?.authorized())return;
  const verifier=access.profile();if(!validVerifier(verifier))return;
  if(!window.confirm('Publish public site lock? Short passwords are easy to guess.'))return;
  const blob=new Blob([`// Public verifier only; not server-side authentication.\nexport const SITE_HOST_VERIFIER = ${JSON.stringify(verifier,null,2)};\n`],{type:'text/javascript'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='host-access-policy.mjs';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});}
