export const PROFILE_KEY='rg-host-lock-profile-v1';
export const GRANT_KEY='rg-host-lock-grant-v1';
export const EPOCH_KEY='rg-host-lock-epoch-v1';
const encoder=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const unhex=s=>Uint8Array.from(s.match(/../g),v=>parseInt(v,16));
export const randomEpoch=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
export const ITERATIONS=600000;
export function validVerifier(v) {return v?.version===1 && v.iterations===ITERATIONS && typeof v.salt==='string' && /^[a-f0-9]{32}$/.test(v.salt) && typeof v.hash==='string' && /^[a-f0-9]{64}$/.test(v.hash);}
async function derive(password,salt) {
  if(typeof password!=='string' || password.length>1024) throw Error('Invalid passphrase');
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:ITERATIONS,hash:'SHA-256'},key,256));
}
export async function createVerifier(password) {
  if(typeof password!=='string' || password.length<16 || password.length>1024) throw Error('Use a unique passphrase of at least 16 characters.');
  const salt=randomEpoch(); return {version:1,iterations:ITERATIONS,salt,hash:await derive(password,salt)};
}
export async function verifyPassword(password,verifier) {
  if(!validVerifier(verifier)) return false;
  const hash=await derive(password,verifier.salt); let difference=0;
  for(let i=0;i<hash.length;i++) difference |= hash.charCodeAt(i)^verifier.hash.charCodeAt(i);
  return difference===0;
}
const read=(storage,key)=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
export function createAccessState(local,session,policy=null) {
  if(policy!==null && !validVerifier(policy)) throw Error('Invalid deployed site lock configuration');
  const profile=()=>policy || read(local,PROFILE_KEY);
  const epoch=()=>local.getItem(EPOCH_KEY)||'initial';
  const grantMatches=(grant,v)=>!!grant && grant.hash===v.hash && grant.salt===v.salt && grant.epoch===epoch();
  function authorized(){const v=profile();return validVerifier(v)&&(grantMatches(read(local,GRANT_KEY),v)||grantMatches(read(session,GRANT_KEY),v));}
  function grant(v,remember){
    const current=profile();if(!validVerifier(current)||current.hash!==v.hash||current.salt!==v.salt)throw Error('Lock configuration changed. Try again.');
    const value=JSON.stringify({hash:v.hash,salt:v.salt,epoch:epoch()});
    if(remember)local.setItem(GRANT_KEY,value);else session.setItem(GRANT_KEY,value);
    if(!authorized())throw Error('Browser storage unavailable');
  }
  function enroll(v){if(policy!==null||profile()!==null)throw Error('Already configured'); if(!validVerifier(v))throw Error('Invalid verifier');local.setItem(PROFILE_KEY,JSON.stringify(v));}
  function lock(){local.setItem(EPOCH_KEY,randomEpoch());local.removeItem(GRANT_KEY);session.removeItem(GRANT_KEY);}
  return {profile,authorized,grant,enroll,lock,epoch};
}
