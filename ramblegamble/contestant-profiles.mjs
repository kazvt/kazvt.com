// Seat IDs, invitation credentials and berry assets never change with display names.
import { readPointScores, writePointScores, withPointScoresLock, readStarScores, writeStarScores, withStarScoresLock } from './points-store.mjs?v=player-stats-20261127-v1';
export const CAST_PROFILE_KEY = 'ramblegamble.cast-profiles.v1';
export const CAST_PROFILE_EVENT = 'rg:cast-profiles-changed';
const source = id => `https://reactive.fugi.tech/basic/${id}`;
export const CAST_DEFAULTS = Object.freeze(Object.fromEntries([
  ['faroe','Faroe','489548166316949513','Contestant'],
  ['erin','Erin','205887066855178244','Contestant'],
  ['kaz','Kaz','796834631961935893','Contestant'],
  ['lillie-host','Lillie','185073584211755008','Host'],
  ['hazel','Hazel','1130618562382413834','Referee'],
].map(([id,name,fugi,role])=>[id,Object.freeze({name,source:source(fugi),role})])));
export const isCastId = id => Object.hasOwn(CAST_DEFAULTS,id);
export const isContestant = id => isCastId(id) && CAST_DEFAULTS[id].role === 'Contestant';
export function cleanDisplayName(value) {
  if(typeof value!=='string')return null;
  const name=value.trim();
  return name && name.length<=40 && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)?name:null;
}
export function cleanFugiSource(value) {
  if(typeof value!=='string'||value.length>2048)return null;
  const text=value.trim();
  if(/^\d{1,24}$/.test(text))return source(text);
  try {const url=new URL(text);if(url.origin==='https://reactive.fugi.tech'&&!url.username&&!url.password&&/^\/basic\/\d{1,24}\/?$/.test(url.pathname))return url.href;}catch{}
  return null;
}
export function readCastProfiles(storage, strict=false) {
  let saved;
  try {saved=JSON.parse((storage??globalThis.localStorage).getItem(CAST_PROFILE_KEY)??'{}');}
  catch(error){if(strict)throw Error('Could not read saved profiles. No changes made.',{cause:error});}
  return Object.fromEntries(Object.entries(CAST_DEFAULTS).map(([id,defaults])=>[id,{
    name:cleanDisplayName(saved?.[id]?.name)??defaults.name,
    source:cleanFugiSource(saved?.[id]?.source)??defaults.source,
    role:defaults.role,
  }]));
}
export function castName(id, storage) {return isCastId(id)?readCastProfiles(storage)[id].name:String(id??'');}
export function subscribeCastProfiles(callback, env=globalThis) {
  let previous;
  const deliver=profiles=>{const next=JSON.stringify(profiles);if(next!==previous){previous=next;callback(profiles);}};
  const update=()=>{let storage;try{storage=env.localStorage;}catch{}deliver(readCastProfiles(storage));};
  const onStorage=e=>{if(e.key===CAST_PROFILE_KEY||e.key===null)update();};
  env.addEventListener?.(CAST_PROFILE_EVENT,update);env.addEventListener?.('storage',onStorage);env.addEventListener?.('focus',update);
  update();
  return ()=>{env.removeEventListener?.(CAST_PROFILE_EVENT,update);env.removeEventListener?.('storage',onStorage);env.removeEventListener?.('focus',update);};
}
function balance(value,label){const raw=String(value);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw Error(`${label} must be a nonnegative whole number.`);return Number(raw);}
export function normalizeProfileInput(id, input){
  if(!isCastId(id))throw Error('Unknown character.');
  const name=cleanDisplayName(input.name),source=cleanFugiSource(input.source);
  if(!name)throw Error('Enter a name (1–40 characters).');
  if(!source)throw Error('Enter a Fugi basic URL or Discord user ID.');
  return {name,source,...(isContestant(id)?{points:balance(input.points,'Points'),stars:balance(input.stars,'Stars')}:{})};
}
export function profileSnapshot(id,{storage,readPoints=readPointScores,readStars=readStarScores}={}){
  if(!isCastId(id))throw Error('Unknown character.');
  const {name,source}=readCastProfiles(storage,true)[id];
  return {name,source,...(isContestant(id)?{points:readPoints({strict:true})[id],stars:readStars({strict:true})[id]}:{})};
}
// Run inside both existing score locks and the profile lock. Read the latest
// values only after locking; edits to untouched fields never overwrite awards.
export function commitProfileEdit(id, original, input, {storage,readPoints=readPointScores,readStars=readStarScores,writePoints=writePointScores,writeStars=writeStarScores,allowed=()=>true,notify=()=>globalThis.dispatchEvent?.(new Event(CAST_PROFILE_EVENT))}={}){
  const wanted=normalizeProfileInput(id,input),fields=Object.keys(wanted).filter(k=>wanted[k]!==original[k]);
  if(!allowed())throw Error('Editor closed or host locked.');
  if(!fields.length)return false;
  storage??=globalThis.localStorage;
  const profiles=readCastProfiles(storage,true), current=profiles[id];
  const points=isContestant(id)?readPoints({strict:true}):null,stars=isContestant(id)?readStars({strict:true}):null;
  const now={...current,points:points?.[id],stars:stars?.[id]};
  for(const k of fields)if(now[k]!==original[k]&&now[k]!==wanted[k])throw Error(`${k[0].toUpperCase()+k.slice(1)} changed elsewhere. Reopen the editor.`);
  const profileChanged=fields.some(k=>k==='name'||k==='source');
  const done=[];
  try {
    for(const [key,prior,write] of [['points',points,writePoints],['stars',stars,writeStars]]){
      if(!fields.includes(key)||now[key]===wanted[key])continue;
      if(!write({...prior,[id]:wanted[key]}).persisted)throw Error(`Could not save ${key}.`);
      done.push(()=>write(prior).persisted);
    }
    if(profileChanged){for(const key of ['name','source'])if(fields.includes(key))profiles[id][key]=wanted[key];storage.setItem(CAST_PROFILE_KEY,JSON.stringify(profiles));}
  }catch(error){let restored=true;for(const rollback of done.reverse()){try{restored=rollback()&&restored;}catch{restored=false;}}
    throw Error(restored?`${error.message} No changes saved.`:'Save interrupted; some balances may have changed. Reopen to check the saved values.');}
  if(profileChanged)try{notify();}catch{}
  return true;
}
export function saveProfileEdit(id,original,input,allowed){
  const work=()=>commitProfileEdit(id,original,input,{allowed});
  const profileLock=()=>globalThis.navigator?.locks?.request?globalThis.navigator.locks.request(CAST_PROFILE_KEY,work):work();
  return isContestant(id)?withPointScoresLock(()=>withStarScoresLock(profileLock)):Promise.resolve().then(profileLock);
}
