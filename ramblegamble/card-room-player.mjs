import { ACK_TIMEOUT_MS, matchesAck, pendingReceipt, validRequestId } from "./card-room-delivery.mjs?v=submission-audit-20261126-v1";
import { foley } from "./game-foley.mjs?v=expanded-foley-20261126-v1";
import { renderLiveQuestion } from "./trivia-live-view.mjs?v=show-stage-20261126-v1";
import { nonce, validNonce, validPublicKey, channelBinding, transcript, verifyHost, proveSeat } from "./card-room-auth.mjs?v=host-security-20261126-v1";
import { ROOM_VERSION, isPlayer, decodePacket, encodePacket } from "./card-room-protocol.mjs?v=show-stage-20261126-v1";
import { loadPeer } from "./card-room-peer.mjs";
const $ = id => document.getElementById(id);
const invite = decodePacket(location.hash.slice(1));
window.addEventListener("hashchange", () => location.reload());
if (invite?.v === ROOM_VERSION && isPlayer(invite.player) && /^rg-[a-f0-9]{32}$/.test(invite.room) && validNonce(invite.token) && validPublicKey(invite.hostKey)) {
  const envelope = { v: ROOM_VERSION, room: invite.room, player: invite.player, token: invite.token };
  let triviaRenderKey = "";
  let round = null, peer = null, conn = null, attempt = 0, online = false, pending = null, retryTimer = null, retryDelay = 1000, ackTimer = null;
  const pendingKey = `rg-card-pending:${invite.room}:${invite.player}`;
  function remember(value) { try { if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value)); else sessionStorage.removeItem(pendingKey); } catch {} }
  function recover(roundId) { try { const saved = JSON.parse(sessionStorage.getItem(pendingKey)); if(saved?.roundId !== roundId || saved?.room !== invite.room || saved?.token !== invite.token || typeof saved.answer !== 'string')return null; if(!validRequestId(saved.requestId))saved.requestId=crypto.randomUUID(); return saved; } catch { return null; } }
  const draftKey = `rg-player-draft:${invite.room}:${invite.player}`;
  function saveDraft(value) { if(!round || pending || round.submitted || round.phase!=='submissions')return; try { sessionStorage.setItem(draftKey,JSON.stringify({roundId:round.id,token:invite.token,value})); }catch{} }
  function loadDraft(id) { try {const d=JSON.parse(sessionStorage.getItem(draftKey));return d?.roundId===id&&d.token===invite.token?d.value:null;}catch{return null;} }
  function clearDraft(){try{sessionStorage.removeItem(draftKey);}catch{}}
  function clearPending() { clearTimeout(ackTimer); ackTimer=null; pending=null; remember(null); }
  function showPending() { if(!pending)return; $('packet').value=encodePacket(pending); $('fallback').hidden=online; $('form').hidden=true; $('trivia-player-content').hidden=true; $('submission').textContent=online?'Sending…':'Reconnecting…'; }
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
    if (!round || round.phase !== 'submissions' || round.submitted || pending) return;
    foley.play("submit");
    pending={...envelope,type:'submit',roundId:round.id,requestId:crypto.randomUUID(),answer}; remember(pending);
    showPending();sendPending();
  }
  function renderTrivia(next, changed) {
    $('mode').hidden=true; $('prompt').hidden=true; $('form').hidden=true;
    const root=$('trivia-player-content'); const q=next.question;
    if(!q || typeof q.kind!=='string'){root.hidden=true;return;}
    if(next.submitted||next.phase!=='submissions')clearPending();
    const open=next.phase==='submissions'&&!next.submitted&&!pending;
    const key=JSON.stringify([next.id,q,next.attempts,open]);
    if(changed||key!==triviaRenderKey){
      let draft=open?loadDraft(next.id):null; if(draft&&typeof draft!=='object')draft=null;
      if(next.submitted&&next.savedAnswer){try{draft=JSON.parse(next.savedAnswer);}catch{}}
      triviaRenderKey=key;
      renderLiveQuestion(root,q,{interactive:open,attempts:next.attempts||[],initialAnswer:draft,onDraft:saveDraft,onSubmit:queueAnswer});
    }
    root.hidden=!!pending;
    $('fallback').hidden=!pending||online;
    if(pending){showPending();sendPending();}
    else if(next.submitted)$('submission').textContent='Answer saved.';
    else if(next.phase!=='submissions')$('submission').textContent='Round closed.';
    else $('submission').textContent='';
  }
  function disconnect(message, retry = true) {
    ++attempt; online = false; clearTimeout(ackTimer); ackTimer=null; if(pending)showPacket(); $('connect').disabled = false;
    const old = peer; peer = null; conn = null; try { old?.destroy(); } catch {}
    clearTimeout(retryTimer);
    if (invite.round || !retry) { status(message); return; }
    status(`${message} Reconnecting…`);
    retryTimer = setTimeout(connect, retryDelay); retryTimer?.unref?.(); retryDelay = Math.min(retryDelay * 2, 15000);
  }
  async function connect() {
    clearTimeout(retryTimer); clearTimeout(ackTimer); ackTimer=null; const generation = ++attempt; online = false; $('connect').disabled = true; status('Connecting…');
    if (peer && !peer.destroyed) peer.destroy();
    const timer = setTimeout(() => { if (generation === attempt && !online) { disconnect('Host unreachable. Retry or ask the host for an OFFLINE ROUND link and copy a packet.'); } }, 18000); timer?.unref?.();
    try {
      const Peer = await loadPeer(); if (generation !== attempt) return;
      peer = new Peer({debug:0});
      const fail = (message,retry=true) => { if (generation !== attempt) return; clearTimeout(timer); disconnect(message,retry); };
      peer.on('disconnected', () => { if (!conn?.open) fail('Signaling disconnected. Retry or ask for an offline round link.'); });
      peer.on('error', () => fail('Connection error. Retry or copy a packet.'));
      peer.on('open', () => {
        if (generation !== attempt) return;
        const channel = conn = peer.connect(invite.room,{reliable:true,serialization:'binary'});
        const clientNonce = nonce(); let phase = 'challenge';
        const current = () => generation === attempt && conn === channel && channel.open;
        channel.on('open', () => { if (current()) channel.send({v:ROOM_VERSION,type:'hello',room:invite.room,player:invite.player,clientNonce}); });
        channel.on('data', async message => {
          if (!current()) return;
          if (message?.v !== ROOM_VERSION) { fail('Incompatible host. Ask for a new invitation.'); return; }
          if (phase === 'challenge') {
            phase='verifying';
            try {
              if (message.type !== 'challenge' || message.room !== invite.room || message.player !== invite.player || message.clientNonce !== clientNonce || !validNonce(message.hostNonce)) throw Error('Invalid host challenge');
              const text=transcript(message,channelBinding(channel,false));
              if (!await verifyHost(invite.hostKey,text,message.signature)) throw Error('Host identity mismatch');
              const proof=await proveSeat(invite.token,text);
              if (!current() || phase !== 'verifying') return;
              phase='verified'; channel.send({v:ROOM_VERSION,type:'proof',proof});
            } catch { if(current()) fail('Host identity could not be verified. Do not share your link; ask the host to confirm it.',false); }
            return;
          }
          if (phase !== 'verified') { fail('Unexpected authentication message.'); return; }
          if (message.type === 'denied' && !online) { clearTimeout(timer); disconnect('Invitation invalid or revoked. Ask the host for a replacement link.',false); return; }
          if (message.type !== 'round' && !online) { fail('Host did not confirm your seat.'); return; }
          if (message.type === 'round') { online = true; retryDelay = 1000; clearTimeout(timer); $('connect').disabled = false; status(message.round ? 'Connected' : 'Connected — waiting for round'); render(message.round); }
          if (message.type === 'ack' && matchesAck(pending,message)) {
            if (message.status === 'accepted' || message.status === 'already-submitted') {
              // Keep the outbox until the authoritative snapshot confirms the exact
              // attempt/answer. A lost snapshot will reconnect and retrieve it.
              $('submission').textContent='Received — confirming…';
            } else if (['storage-error','reader-changed'].includes(message.status)) {
              disconnect('Host could not save yet.');
            } else {
              const rejected=pending; clearPending(); if(round?.mode==='trivia'){try{saveDraft(JSON.parse(rejected.answer));}catch{}} foley.play('error'); $('fallback').hidden=true;
              triviaRenderKey=''; render(round); if(round?.mode==='quiplash')$('answer').value=rejected.answer;
              $('submission').textContent=message.status==='stale-round'?'Question changed.':message.status==='closed'?'Round closed.':'Answer not accepted. Try again.';
            }
          }
        });
        conn.on('close', () => fail('Disconnected. Retry or copy your pending packet.')); conn.on('error', () => fail('Connection error. Retry or copy your packet.'));
      });
    } catch { clearTimeout(timer); if (generation === attempt) disconnect('Live service unavailable. Use copy/paste packets.'); }
  }
  $('connect').addEventListener('click', connect);
  window.addEventListener('online',()=>{if(!online&&!invite.round&&!$('connect').disabled)connect();});
  $('answer').addEventListener('input',()=>saveDraft({text:$('answer').value}));
  $('form').addEventListener('submit', event => {
    event.preventDefault(); if (!round || round.mode === 'trivia' || round.phase !== 'submissions' || round.submitted || pending) return;
    const choice = document.querySelector('input[name=evidence]:checked');
    const answer = round.mode === 'quiplash' ? $('answer').value.trim() : round.hand?.[Number(choice?.value)];
    if (!answer || answer.length > 800) { $('submission').textContent = 'Enter an answer or select a card.'; return; }
    queueAnswer(answer);
  });
  $('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('packet').value); $('submission').textContent = 'Packet copied. Send it privately to the host.'; } catch { $('packet').select(); } });
  render(invite.round || null); status('Connecting…'); if (invite.round) status('Offline round'); connect();
}

if (invite && invite.v !== ROOM_VERSION) $('connection').textContent = 'Ask the host for a new invitation.';
