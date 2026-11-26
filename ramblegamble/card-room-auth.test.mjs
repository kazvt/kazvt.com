import test from 'node:test';
import assert from 'node:assert/strict';
import { generateHostIdentity, nonce, transcript, signHost, verifyHost, proveSeat, verifySeat, channelBinding } from './card-room-auth.mjs';
const desc=x=>({sdp:`v=0\r\na=fingerprint:sha-256 ${Array(32).fill(x).join(':')}\r\n`});
const connection=(a,b)=>({peerConnection:{localDescription:desc(a),remoteDescription:desc(b)}});
const fields=()=>({room:'rg-test',player:'kaz',clientNonce:nonce(),hostNonce:nonce()});
test('host key nonextractable, correct host and channel proof verified; impostor, nonce, player, room and relay mismatch rejected',async()=>{
 const host=await generateHostIdentity(), impostor=await generateHostIdentity();assert.equal(host.privateKey.extractable,false);await assert.rejects(crypto.subtle.exportKey('jwk',host.privateKey));
 const f=fields(), hostBinding=channelBinding(connection('aa','bb'),true), playerBinding=channelBinding(connection('bb','aa'),false);assert.deepEqual(hostBinding,playerBinding);
 const text=transcript(f,hostBinding), sig=await signHost(host,text), token=nonce(), proof=await proveSeat(token,text);
 assert.equal(await verifyHost(host.publicKey,text,sig),true);assert.equal(await verifyHost(impostor.publicKey,text,sig),false);assert.equal(await verifySeat(token,text,proof),true);assert.equal(await verifySeat(nonce(),text,proof),false);
 for(const altered of [transcript({...f,hostNonce:nonce()},hostBinding),transcript({...f,clientNonce:nonce()},hostBinding),transcript({...f,player:'erin'},hostBinding),transcript({...f,room:'other'},hostBinding),transcript(f,channelBinding(connection('cc','bb'),true))]){assert.equal(await verifyHost(host.publicKey,altered,sig),false);assert.equal(await verifySeat(token,altered,proof),false);}
 assert.throws(()=>channelBinding({},true));assert.throws(()=>channelBinding({peerConnection:{localDescription:{sdp:desc('aa').sdp+desc('cc').sdp},remoteDescription:desc('bb')}},true));assert.equal(await verifyHost(host.publicKey,text,'00'),false);assert.equal(await verifySeat(token,text,'00'),false);
});
