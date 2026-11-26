import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import * as core from './host-access-core.mjs';
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
class Element {events={};value='';hidden=false;inert=false;disabled=false;addEventListener(e,f){this.events[e]=f;}focus(){}contains(e){return e===this;}}
function make(local,session,policy=null,path='/rg/console/'){
 const entries=Object.fromEntries(['form','[name=passphrase]','[name=confirmation]','[data-confirm]','[name=remember]','[role=status]','[type=submit]','[data-unlock-landing]','[data-unlock-panel]','[data-host-unlock]'].map(s=>[s,new Element()]));entries['[name=remember]'].checked=true;
 const gate=new Element(),app=new Element(),lock=new Element(),attributes=new Set(['data-rg-host-locked']),win=new Element(),imports=[];
 gate.querySelector=s=>entries[s];const document={documentElement:{setAttribute:k=>attributes.add(k),removeAttribute:k=>attributes.delete(k)},getElementById:()=>gate,querySelectorAll:s=>s==='[data-host-lock]'?[lock]:[],querySelector:()=>null,body:{children:[app,gate]}};
 const context={...core,SITE_HOST_VERIFIER:policy,crypto,localStorage:local,sessionStorage:session,document,window:win,location:{pathname:path},navigator:{},Event, __import:async path=>{imports.push(path);}};
 const source=readFileSync(new URL('./host-access.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('await import(path)','await __import(path)');vm.runInNewContext(source,context);
 return{entries,gate,app,lock,attributes,win,imports,landing:entries['[data-unlock-landing]'],panel:entries['[data-unlock-panel]'],unlock:entries['[data-host-unlock]'],async submit(password,confirmation=''){entries['[name=passphrase]'].value=password;entries['[name=confirmation]'].value=confirmation;await entries.form.events.submit({preventDefault(){}});},async storageChange(){await win.events.storage({key:core.GRANT_KEY});await new Promise(r=>setImmediate(r));}};
}
test('actual host gate defers application boot, unlocks remembered second tab, and relocks both without reimporting',async()=>{const local=storage(),a=make(local,storage()),b=make(local,storage());assert.equal(a.imports.length,0);assert.equal(b.imports.length,0);assert.equal(a.app.inert,true);const phrase='1234';await a.submit(phrase,'wrong');assert.equal(a.imports.length,0);await a.submit(phrase,phrase);assert.equal(a.imports.length,1);assert.equal(a.gate.hidden,true);await b.storageChange();assert.equal(b.gate.hidden,true);assert.equal(b.imports.length,1);a.lock.events.click();await b.storageChange();assert.equal(a.gate.hidden,false);assert.equal(b.gate.hidden,false);assert.equal(a.app.inert,true);assert.equal(b.app.inert,true);assert.equal(a.landing.hidden,false);assert.equal(b.landing.hidden,false);assert.equal(a.panel.hidden,true);assert.equal(b.panel.hidden,true);assert.equal(a.lock.textContent,'UNLOCK HOST');b.unlock.events.click();assert.equal(b.landing.hidden,true);assert.equal(b.panel.hidden,false);await b.submit('wrong');assert.equal(b.gate.hidden,false);await b.submit(phrase);await a.storageChange();assert.equal(a.gate.hidden,true);assert.equal(a.imports.length,1);assert.equal(b.imports.length,1);assert.equal(a.lock.textContent,'LOCK HOST');assert.equal(b.lock.textContent,'LOCK HOST');});
test('host pages alone mount the gate, player route remains public; credentials cannot submit without script',()=>{for(const name of ['../rg/index.html','../rg/console/index.html']){const html=readFileSync(new URL(name,import.meta.url),'utf8');assert.match(html,/data-rg-host-locked/);assert.match(html,/host-access\.mjs\?v=/);assert.match(html,/name="passphrase" disabled required/);assert.doesNotMatch(html,/<script type="module" src="[^\"]*(?:console\.js|ramblegamble\.js|card-games-ui\.js)/);}assert.doesNotMatch(readFileSync(new URL('../rg/player/index.html',import.meta.url),'utf8'),/host-access/);});

test('both host lock screens omit explanatory paragraphs and keep essential controls',()=>{for(const name of ['../rg/index.html','../rg/console/index.html']){const html=readFileSync(new URL(name,import.meta.url),'utf8').split('<section id="rg-host-gate"')[1];assert.doesNotMatch(html,/data-host-description|rg-lock-note|16 characters/);assert.match(html,/Confirm password/);assert.match(html,/Remember this browser/);assert.match(html,/role="status"/);}});

test('locked landing is visible on both routes and never boots until password is verified',async()=>{
 const verifier=await core.createVerifier('7');
 for(const path of ['/rg/','/rg/console/']){
  const local=storage(),page=make(local,storage(),verifier,path);
  assert.equal(page.landing.hidden,false);assert.equal(page.panel.hidden,true);assert.equal(page.imports.length,0);assert.equal(page.app.inert,true);
  await page.submit('7');assert.equal(page.imports.length,0);
  page.unlock.events.click();assert.equal(page.panel.hidden,false);assert.equal(page.entries['[type=submit]'].textContent,'UNLOCK HOST');
  await page.storageChange();assert.equal(page.panel.hidden,false);
  await page.submit('bad');assert.equal(page.panel.hidden,false);assert.equal(page.app.inert,true);assert.equal(page.imports.length,0);
  await page.submit('7');assert.equal(page.gate.hidden,true);assert.equal(page.lock.textContent,'LOCK HOST');assert.equal(page.app.inert,false);
  const imports=page.imports.length;assert.equal(imports,path==='/rg/'?4:1);
  page.lock.events.click();assert.equal(page.gate.hidden,false);assert.equal(page.landing.hidden,false);assert.equal(page.panel.hidden,true);assert.equal(page.lock.textContent,'UNLOCK HOST');
  page.unlock.events.click();await page.submit('7');assert.equal(page.gate.hidden,true);assert.equal(page.lock.textContent,'LOCK HOST');assert.equal(page.imports.length,imports);
 }
});
test('locked landing is outside the protected application and has an unlock action',()=>{
 for(const path of ['../rg/index.html','../rg/console/index.html']){
  const html=readFileSync(new URL(path,import.meta.url),'utf8'),gate=html.split('<section id="rg-host-gate"')[1];
  assert.match(gate,/data-unlock-landing[^>]*hidden/);assert.match(gate,/data-host-unlock disabled>UNLOCK HOST<\/button>/);assert.match(gate,/data-unlock-panel/);
 }
});
