import { createDraftDelivery } from "./trivia-draft-delivery.mjs?v=match-number-20261127-v1";
import { LIVE_DRAFT_MODES, validTriviaDraft, MAX_TRIVIA_ANSWER } from "./live-trivia.mjs?v=match-number-20261127-v1";
import { ACK_TIMEOUT_MS, matchesAck, pendingReceipt, validRequestId } from "./card-room-delivery.mjs?v=submission-audit-20261126-v1";
import { foley } from "./game-foley.mjs?v=vip-water-gain-20261127-v3";
import { renderLiveQuestion } from "./trivia-live-view.mjs?v=smeemo-storm-20261127-v1";
import { nonce, validNonce, validPublicKey, channelBinding, transcript, verifyHost, proveSeat } from "./card-room-auth.mjs?v=room-recovery-20261127-v1";
import { ROOM_VERSION, isPlayer, decodePacket, encodePacket } from "./card-room-protocol.mjs?v=match-number-20261127-v1";
import { loadPeer } from "./card-room-peer.mjs?v=room-recovery-20261127-v1";
import { connectLocal } from "./card-room-local.mjs?v=room-recovery-20261127-v1";
const $ = id => document.getElementById(id);
const invite = decodePacket(location.hash.slice(1));
window.addEventListener("hashchange", () => location.reload());
if (invite?.v === ROOM_VERSION && isPlayer(invite.player) && /^rg-[a-f0-9]{32}$/.test(invite.room) && validNonce(invite.token) && validPublicKey(invite.hostKey)) {
  const envelope = { v: ROOM_VERSION, room: invite.room, player: invite.player, token: invite.token };
  let triviaRenderKey = "";
  let round = null, peer = null, conn = null, attempt = 0, online = false, pending = null, retryTimer = null, retryDelay = 1000, ackTimer = null, connectionTimer = null, controller = null, terminal = false, skipLocalOnce = false;
  const pendingKey = `rg-card-pending:${invite.room}:${invite.player}`;
  function remember(value) { try { if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value)); else sessionStorage.removeItem(pendingKey); } catch {} }
  function recover(roundId) { try { const saved = JSON.parse(sessionStorage.getItem(pendingKey)); if(saved?.roundId !== roundId || saved?.room !== invite.room || saved?.token !== invite.token || typeof saved.answer !== 'string')return null; if(!validRequestId(saved.requestId))saved.requestId=crypto.randomUUID(); return saved; } catch { return null; } }
  const draftDelivery=createDraftDelivery({ready:()=>online&&!!conn?.open&&!pending&&round?.phase==='submissions'&&!round.submitted,
    send:packet=>{if((conn.dataChannel?.bufferedAmount||0)>65536)return false;conn.send({v:ROOM_VERSION,type:'draft',...packet});return true;}});
  function offerDraft(value){if(round?.mode!=='trivia'||round.liveDrafts!==true||!LIVE_DRAFT_MODES.includes(round.question?.kind)||!validTriviaDraft(round.question,value))return;const raw=JSON.stringify(value);if(raw.length<=MAX_TRIVIA_ANSWER)draftDelivery.offer(round.id,raw);}
  const draftKey = `rg-player-draft:${invite.room}:${invite.player}`;
  function saveDraft(value) { if(!round || pending || round.submitted || round.phase!=='submissions')return; try { sessionStorage.setItem(draftKey,JSON.stringify({roundId:round.id,token:invite.token,value})); }catch{} offerDraft(value); }
  function loadDraft(id) { try {const d=JSON.parse(sessionStorage.getItem(draftKey));return d?.roundId===id&&d.token===invite.token?d.value:null;}catch{return null;} }
  function clearDraft(){try{sessionStorage.removeItem(draftKey);}catch{}}
  function clearPending() { clearTimeout(ackTimer); ackTimer=null; pending=null; remember(null); }
  const isNumeric=()=>round?.mode==='trivia'&&['number-grid','number-stepper','memory-number'].includes(round.question?.kind);
  function showPending() { if(!pending)return; $('packet').value=encodePacket(pending); $('fallback').hidden=online; $('form').hidden=true; $('trivia-player-content').hidden=!isNumeric(); $('submission').textContent=online?'Sending…':invite.round?'Copy the packet and send it to the host.':'Waiting for connection…'; }
  function resolvePending(next) { const receipt=pendingReceipt(pending,next); if(!receipt)return null; clearPending(); if(receipt==='accepted')foley.play('confirm'); return receipt; }
  function showPacket() { if(!pending)return; showPending(); $('fallback').hidden=false; $('submission').textContent='Waiting for host confirmation.'; }

  $('player').textContent = invite.player.toUpperCase(); $('berry').src = `../../ramblegamble/assets/berries/${invite.player}berry.png`; $('berry').hidden = false;
  $('connect').hidden = false;
  function status(text) { $('connection').textContent = text; }
  function sendPending() {
    if (!online || !conn?.open || !pending || ackTimer || round?.id !== pending.roundId || round.submitted || round.phase !== 'submissions') return;
    const id=pending.requestId;
    // Start the timer before sending, including for synchronous test transports.
    ackTimer=setTimeout(()=>{ackTimer=null;if(pending?.requestId===id)disconnect('No confirmation yet.');},ACK_TIMEOUT_MS); ackTimer?.unref?.();
    try { conn.send({v:ROOM_VERSION,type:'submit',roundId:pending.roundId,requestId:id,answer:pending.answer}); } catch { disconnect('Send failed.'); }
  }
  function render(next) {
    if (next && (!['red-handed','quiplash','trivia'].includes(next.mode) || typeof next.id !== 'string' || typeof next.prompt !== 'string')) return;
    const changed = next?.id !== round?.id;
    if (changed && next) foley.play("question");
    if (changed) { clearTimeout(ackTimer); ackTimer=null; pending = next ? recover(next.id) : null; if (next && !pending) remember(null); $('answer').value = next?.mode==='quiplash'?(loadDraft(next.id)?.text||''):''; $('submission').textContent = ''; $('fallback').hidden = true; $('choices').replaceChildren(); }
    round = next;
    draftDelivery.setRound(next?.id||null);
    if(next?.submitted||next?.phase!=='submissions')draftDelivery.pause();
    const receipt=resolvePending(next); if(next?.submitted||receipt==='accepted'||(next && next.phase!=='submissions'))clearDraft();
    $('round').hidden = !round;
    if (!round) { $('trivia-player-content').hidden=true; triviaRenderKey=''; return; }
    if (round.mode === 'trivia') { renderTrivia(round, changed); return; }
    $('trivia-player-content').hidden=true; triviaRenderKey=''; $('mode').hidden=false; $('prompt').hidden=false;
    $('mode').textContent = round.mode === 'quiplash' ? 'BERRYBLAST' : 'RED HANDED'; $('prompt').textContent = round.prompt;
    const open = round.phase === 'submissions' && !round.submitted;
    $('form').hidden = !open || !!pending;
    $('text-label').hidden = $('answer').hidden = round.mode !== 'quiplash'; $('answer').disabled = round.mode !== 'quiplash';
    $('hand').hidden = round.mode !== 'red-handed'; $('hand').disabled = round.mode !== 'red-handed';
    if (round.mode === 'red-handed' && open && (changed || !$('choices').children.length)) {
      $('choices').replaceChildren();
      for (const [i, answer] of (round.hand || []).entries()) { const label = document.createElement('label'); label.className = 'evidence'; const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'evidence'; radio.value = String(i); radio.required = true; radio.checked=loadDraft(round.id)?.choice===i; radio.addEventListener('change',()=>saveDraft({choice:i})); const copy = document.createElement('span'); copy.textContent = answer; label.append(radio,copy); $('choices').append(label); }
    }
    if (round.submitted) { clearPending(); $('fallback').hidden = true; $('submission').textContent = receipt==='already-submitted'?'Host already saved an answer.':'Answer saved.'; if(round.savedAnswer) $('submission').textContent += ' '+round.savedAnswer; }
    else if (!open) { clearPending(); $('fallback').hidden = true; $('submission').textContent = 'This round has closed.'; }
    else if (pending) { showPending(); sendPending(); }
    else { $('fallback').hidden=true; $('submission').textContent=''; }
  }
  function queueAnswer(answer) {
    if ((!invite.round && terminal) || !round || round.phase !== 'submissions' || round.submitted || pending) return;
    foley.play("submit");
    draftDelivery.pause();
    pending={...envelope,type:'submit',roundId:round.id,requestId:crypto.randomUUID(),answer}; remember(pending);
    if(isNumeric())renderTrivia(round,false);else {showPending();sendPending();}
  }
  function renderTrivia(next, changed) {
    $('mode').hidden=true; $('prompt').hidden=true; $('form').hidden=true;
    const root=$('trivia-player-content'); const q=next.question;
    if(!q || typeof q.kind!=='string'){root.hidden=true;return;}
    if(next.submitted||next.phase!=='submissions')clearPending();
    const open=next.phase==='submissions'&&!next.submitted&&!pending;
    const key=JSON.stringify([next.id,q,next.attempts,open]);
    if(changed||key!==triviaRenderKey){
      let draft=open?(loadDraft(next.id)||next.savedDraft):null; if(draft&&typeof draft!=='object')draft=null;
      if(next.submitted&&next.savedAnswer){try{draft=JSON.parse(next.savedAnswer);}catch{}}
      triviaRenderKey=key;
      renderLiveQuestion(root,q,{interactive:open,attempts:next.attempts||[],initialAnswer:draft,onDraft:saveDraft,onSubmit:queueAnswer});
    }
    if(open){const draft=loadDraft(next.id)||next.savedDraft;if(draft)offerDraft(draft);}
    root.hidden=!!pending&&!isNumeric();
    $('fallback').hidden=!pending||online;
    if(pending){showPending();sendPending();}
    else if(next.submitted){const result=next.attempts?.at(-1)?.result;$('submission').textContent=q.kind==='number-grid'?(Array.isArray(result)&&result.length===4&&result.every(x=>x==='green')?'Solved — answer saved.':'No guesses left — answer saved.'):'Answer saved.';}
    else if(next.phase!=='submissions')$('submission').textContent='Round closed.';
    else $('submission').textContent='';
  }
  function closeTransport() {
    clearTimeout(connectionTimer); connectionTimer=null;
    controller?.abort(); controller=null;
    const old=peer, channel=conn; peer=null;conn=null;
    try{channel?.close?.();}catch{} try{old?.destroy();}catch{}
  }
  function disconnect(message, retry = true) {
    draftDelivery.pause();
    ++attempt; online=false; terminal=!retry; clearTimeout(ackTimer);ackTimer=null;
    closeTransport(); clearTimeout(retryTimer);retryTimer=null;
    if(pending)showPacket(); $('connect').disabled=false; $('connect').textContent='RETRY NOW';
    if(invite.round || !retry){if(!invite.round){$('form').hidden=true;$('trivia-player-content').hidden=true;}status(message);return;}
    status(`${message} Retrying…`);
    retryTimer=setTimeout(connect,retryDelay);retryTimer?.unref?.();retryDelay=Math.min(retryDelay*2,15000);
  }
  async function connect() {
    draftDelivery.pause();
    clearTimeout(retryTimer);retryTimer=null; clearTimeout(ackTimer);ackTimer=null;
    const generation=++attempt; online=false;terminal=false;closeTransport();
    const abort=controller=new AbortController();
    $('connect').disabled=false;$('connect').textContent='RETRY NOW';status('Looking for host…');
    const currentAttempt=()=>generation===attempt&&!abort.signal.aborted;
    const fail=(message,retry=true)=>{if(currentAttempt()){if(retry&&!online&&conn?.localChannelId)skipLocalOnce=true;disconnect(message,retry);}};
    const deadline=(ms,message)=>{clearTimeout(connectionTimer);connectionTimer=setTimeout(()=>fail(message),ms);connectionTimer?.unref?.();};
    function attach(channel) {
      if(!currentAttempt()||!channel){channel?.close?.();return;}
      conn=channel;const clientNonce=nonce();let phase='challenge',helloSent=false;
      const current=()=>currentAttempt()&&conn===channel&&channel.open;
      const hello=()=>{if(!current()||helloSent)return;helloSent=true;status('Verifying host…');deadline(channel.localChannelId?5000:12000,'Host did not confirm the invitation.');try{channel.send({v:ROOM_VERSION,type:'hello',room:invite.room,player:invite.player,clientNonce});}catch{fail('Connection interrupted.');}};
      channel.on('open',hello);
        channel.on('data', async message => {
          if (!current()) return;
          if (message?.v !== ROOM_VERSION) { fail('Incompatible host. Refresh both pages.',false); return; }
          if (phase === 'challenge') {
            phase='verifying'; status('Verifying host…');
            try {
              if (message.type !== 'challenge' || message.room !== invite.room || message.player !== invite.player || message.clientNonce !== clientNonce || !validNonce(message.hostNonce)) throw Error('Invalid host challenge');
              const text=transcript(message,channelBinding(channel,false));
              if (!await verifyHost(invite.hostKey,text,message.signature)) throw Error('Host identity mismatch');
              const proof=await proveSeat(invite.token,text);
              if (!current() || phase !== 'verifying') return;
              phase='verified'; status('Confirming invitation…'); channel.send({v:ROOM_VERSION,type:'proof',proof});
            } catch { if(current()) fail('Host identity could not be verified. Do not share your link; ask the host to confirm it.',false); }
            return;
          }
          if (phase !== 'verified') { fail('Unexpected authentication message.'); return; }
          if (message.type === 'superseded' && online) { disconnect('This seat is open in another window. Reconnect here to take over.',false); return; }
          if (message.type === 'denied' && !online) { clearTimeout(connectionTimer); disconnect('Invitation invalid or revoked. Ask the host for a replacement link.',false); return; }
          if (message.type !== 'round' && !online) { fail('Host did not confirm your seat.'); return; }
          if (message.type === 'round') { const rejoined=!online; online = true; terminal=false; retryDelay = 1000; clearTimeout(connectionTimer); $('connect').textContent='RECONNECT'; status(message.round ? 'Connected' : 'Connected — waiting for round'); render(message.round); if(rejoined)draftDelivery.reconnect(); }
          if(message.type==='draft-ack')draftDelivery.ack(message);
          if (message.type === 'ack' && matchesAck(pending,message)) {
            if (message.status === 'accepted' || message.status === 'already-submitted') {
              // Keep the outbox until the authoritative snapshot confirms the exact
              // attempt/answer. A lost snapshot will reconnect and retrieve it.
              $('submission').textContent='Received — confirming…';
            } else if (['storage-error','reader-changed'].includes(message.status)) {
              disconnect('Host could not save yet.');
            } else {
              const rejected=pending; clearPending(); if(round?.mode==='trivia'){try{saveDraft(JSON.parse(rejected.answer));}catch{}} foley.play('error'); $('fallback').hidden=true;
              triviaRenderKey=''; render(round);draftDelivery.reconnect(); if(round?.mode==='quiplash')$('answer').value=rejected.answer;
              $('submission').textContent=message.status==='stale-round'?'Question changed.':message.status==='closed'?'Round closed.':'Answer not accepted. Try again.';
            }
          }
        });
      channel.on('close',()=>fail('Connection lost.'));channel.on('error',()=>fail('Connection interrupted.'));
      if(channel.open)hello();
    }
    try {
      const skip=skipLocalOnce;skipLocalOnce=false;const local=skip?null:await connectLocal(invite.room,{signal:abort.signal,onStage:status});
      if(!currentAttempt()){local?.close();return;}
      if(local){attach(local);return;}
      status('Connecting to online service…');deadline(16000,'Online service unavailable.');
      const Peer=await loadPeer();if(!currentAttempt())return;
      peer=new Peer({debug:0});deadline(15000,'Online service did not respond.');
      peer.on('disconnected',()=>{if(!conn?.open)fail('Signaling disconnected.');});
      peer.on('error',error=>{if(error?.type==='disconnected'&&conn?.open)return;fail(error?.type==='peer-unavailable'?'Host not reachable. Ask host to check the room.':error?.type==='browser-incompatible'?'This browser does not support live connections. Use an offline round.':'Online connection failed.',error?.type!=='browser-incompatible');});
      peer.on('open',()=>{if(!currentAttempt())return;status('Contacting host…');deadline(18000,'Host not reachable. Ask host to check the room.');try{attach(peer.connect(invite.room,{reliable:true,serialization:'binary'}));}catch{fail('Could not contact host.');}});
    }catch{fail('Live service unavailable.');}
  }
  $('connect').addEventListener('click',connect);
  window.addEventListener('online',()=>{if(!online&&!invite.round&&!terminal)connect();});
  window.addEventListener('pagehide',()=>{draftDelivery.pause();++attempt;online=false;clearTimeout(retryTimer);clearTimeout(ackTimer);ackTimer=null;closeTransport();});
  window.addEventListener('pageshow',event=>{if(event.persisted&&!invite.round&&!terminal)connect();});
  $('answer').addEventListener('input',()=>saveDraft({text:$('answer').value}));
  $('form').addEventListener('submit', event => {
    event.preventDefault(); if (!round || round.mode === 'trivia' || round.phase !== 'submissions' || round.submitted || pending) return;
    const choice = document.querySelector('input[name=evidence]:checked');
    const answer = round.mode === 'quiplash' ? $('answer').value.trim() : round.hand?.[Number(choice?.value)];
    if (!answer || answer.length > 800) { $('submission').textContent = 'Enter an answer or select a card.'; return; }
    queueAnswer(answer);
  });
  $('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('packet').value); $('submission').textContent = 'Packet copied. Send it privately to the host.'; } catch { $('packet').select(); } });
  render(invite.round || null); if(invite.round){status('Offline round — send your answer packet to the host.');$('connect').textContent='CONNECT LIVE';}else connect();
}

if (invite && invite.v !== ROOM_VERSION) $('connection').textContent = 'Ask the host for a new invitation.';
else if (location.hash && $('connect').hidden) $('connection').textContent = 'Invalid or incomplete invitation. Ask the host to copy your link again.';
