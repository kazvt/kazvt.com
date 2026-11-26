import { renderLiveQuestion } from "./trivia-live-view.mjs";
import { nonce, validNonce, validPublicKey, channelBinding, transcript, verifyHost, proveSeat } from "./card-room-auth.mjs?v=host-security-20261126-v1";
import { ROOM_VERSION, isPlayer, decodePacket, encodePacket } from "./card-room-protocol.mjs?v=live-trivia-20261126-v1";
import { loadPeer } from "./card-room-peer.mjs";
const $ = id => document.getElementById(id);
const invite = decodePacket(location.hash.slice(1));
window.addEventListener("hashchange", () => location.reload());
if (invite?.v === ROOM_VERSION && isPlayer(invite.player) && /^rg-[a-f0-9]{32}$/.test(invite.room) && validNonce(invite.token) && validPublicKey(invite.hostKey)) {
  const envelope = { v: ROOM_VERSION, room: invite.room, player: invite.player, token: invite.token };
  let triviaRenderKey = "";
  let round = null, peer = null, conn = null, attempt = 0, online = false, pending = null, retryTimer = null, retryDelay = 1000;
  const pendingKey = `rg-card-pending:${invite.room}:${invite.player}`;
  function remember(value) { try { if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value)); else sessionStorage.removeItem(pendingKey); } catch {} }
  function recover(roundId) { try { const saved = JSON.parse(sessionStorage.getItem(pendingKey)); return saved?.roundId === roundId && saved?.room === invite.room && saved?.token === invite.token ? saved : null; } catch { return null; } }
  function showPacket() { $('packet').value = encodePacket(pending); $('fallback').hidden = false; $('form').hidden = true; $('trivia-player-content').hidden = true; $('submission').textContent = 'Waiting for host confirmation. Reconnect or copy the packet.'; }

  $('player').textContent = invite.player.toUpperCase(); $('berry').src = `../../ramblegamble/assets/berries/${invite.player}berry.png`; $('berry').hidden = false;
  $('connect').hidden = false;
  function status(text) { $('connection').textContent = text; }
  function sendPending() { if (online && conn?.open && pending && round?.id === pending.roundId && !round.submitted && round.phase === 'submissions') { try { conn.send({v:ROOM_VERSION,type:"submit",roundId:pending.roundId,answer:pending.answer}); } catch { status('Send failed; reconnect or copy the packet.'); } } }
  function render(next) {
    if (next && (!['red-handed','quiplash','trivia'].includes(next.mode) || typeof next.id !== 'string' || typeof next.prompt !== 'string')) return;
    const changed = next?.id !== round?.id;
    if (changed) { pending = next ? recover(next.id) : null; if (next && !pending) remember(null); $('answer').value = ''; $('submission').textContent = ''; $('fallback').hidden = true; $('choices').replaceChildren(); }
    round = next;
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
      for (const [i, answer] of (round.hand || []).entries()) { const label = document.createElement('label'); label.className = 'evidence'; const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'evidence'; radio.value = String(i); radio.required = true; const copy = document.createElement('span'); copy.textContent = answer; label.append(radio,copy); $('choices').append(label); }
    }
    if (round.submitted) { pending = null; remember(null); $('fallback').hidden = true; $('submission').textContent = 'Host has saved your submission.'; }
    else if (!open) { pending = null; remember(null); $('fallback').hidden = true; $('submission').textContent = 'This round has closed.'; }
    else if (pending) { showPacket(); sendPending(); }
  }
  function queueAnswer(answer) {
    if (!round || round.phase !== 'submissions' || round.submitted || pending) return;
    pending={...envelope,type:'submit',roundId:round.id,answer}; remember(pending);
    $('form').hidden=true; $('trivia-player-content').hidden=true; $('packet').value=encodePacket(pending); $('fallback').hidden=false;
    $('submission').textContent=online?'Sending…':'Not connected. Copy the packet or reconnect.';sendPending();
  }
  function renderTrivia(next, changed) {
    $('mode').hidden=true; $('prompt').hidden=true; $('form').hidden=true;
    const root=$('trivia-player-content'); const q=next.question;
    if(!q || typeof q.kind!=='string'){root.hidden=true;return;}
    if(pending&&next.attempts?.length){try{const a=JSON.parse(pending.answer);if(next.attempts.some(x=>x.id===a.id)){pending=null;remember(null);}}catch{}}
    if(next.submitted||next.phase!=='submissions'){pending=null;remember(null);}
    const open=next.phase==='submissions'&&!next.submitted&&!pending;
    const key=JSON.stringify([next.id,q,next.attempts,open]);
    if(changed||key!==triviaRenderKey){const preserve=!changed&&open&&["text-sequence","image-sequence","memory-number"].includes(q.kind);const draft=preserve?root.querySelector?.("input")?.value:null;triviaRenderKey=key;renderLiveQuestion(root,q,{interactive:open,attempts:next.attempts||[],onSubmit:queueAnswer});if(draft!=null&&root.querySelector?.("input"))root.querySelector("input").value=draft;}
    root.hidden=!!pending;
    $('fallback').hidden=!pending;
    if(pending){showPacket();sendPending();}
    else if(next.submitted)$('submission').textContent='Answer saved.';
    else if(next.phase!=='submissions')$('submission').textContent='Round closed.';
    else $('submission').textContent='';
  }
  function disconnect(message, retry = true) {
    ++attempt; online = false; $('connect').disabled = false;
    const old = peer; peer = null; conn = null; try { old?.destroy(); } catch {}
    clearTimeout(retryTimer);
    if (invite.round || !retry) { status(message); return; }
    status(`${message} Reconnecting automatically…`);
    retryTimer = setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 15000);
  }
  async function connect() {
    clearTimeout(retryTimer); const generation = ++attempt; online = false; $('connect').disabled = true; status('Connecting to host…');
    if (peer && !peer.destroyed) peer.destroy();
    const timer = setTimeout(() => { if (generation === attempt && !online) { disconnect('Host unreachable. Retry or ask the host for an OFFLINE ROUND link and copy a packet.'); } }, 18000);
    try {
      const Peer = await loadPeer(); if (generation !== attempt) return;
      peer = new Peer({debug:0});
      const fail = (message,retry=true) => { if (generation !== attempt) return; clearTimeout(timer); disconnect(message,retry); };
      peer.on('disconnected', () => { if (!conn?.open) fail('Signaling disconnected. Retry or ask for an offline round link.'); });
      peer.on('error', () => fail('Connection error. Retry or copy a packet.'));
      peer.on('open', () => {
        if (generation !== attempt) return;
        const channel = conn = peer.connect(invite.room,{reliable:true});
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
          if (message.type === 'round') { online = true; retryDelay = 1000; clearTimeout(timer); $('connect').disabled = false; status(message.round ? 'Connected to verified host.' : 'Verified host — waiting for host to start a round.'); render(message.round); }
          if (message.type === 'ack' && message.roundId === pending?.roundId) {
            if (message.status === 'accepted' || message.status === 'already-submitted') { const already = message.status === 'already-submitted'; pending = null; remember(null); $('fallback').hidden = true; $('submission').textContent = already ? 'Host already saved an answer for this round.' : 'Answer received by host!'; }
            else if (['storage-error','reader-changed'].includes(message.status)) { showPacket(); status('Host could not save yet. Retrying connection…'); disconnect('Host could not save yet.'); }
            else { pending = null; remember(null); $('fallback').hidden = true; render(round); $('submission').textContent = `Host rejected answer: ${message.status}.`; }
          }
        });
        conn.on('close', () => fail('Disconnected. Retry or copy your pending packet.')); conn.on('error', () => fail('Connection error. Retry or copy your packet.'));
      });
    } catch { clearTimeout(timer); if (generation === attempt) disconnect('Live service unavailable. Use copy/paste packets.'); }
  }
  $('connect').addEventListener('click', connect);
  $('form').addEventListener('submit', event => {
    event.preventDefault(); if (!round || round.mode === 'trivia' || round.phase !== 'submissions' || round.submitted || pending) return;
    const choice = document.querySelector('input[name=evidence]:checked');
    const answer = round.mode === 'quiplash' ? $('answer').value.trim() : round.hand?.[Number(choice?.value)];
    if (!answer || answer.length > 800) { $('submission').textContent = 'Enter an answer or select a card.'; return; }
    pending = {...envelope,type:'submit',roundId:round.id,answer}; remember(pending); $('form').hidden = true; $('packet').value = encodePacket(pending); $('fallback').hidden = false;
    $('submission').textContent = online ? 'Sending — waiting for host confirmation…' : 'Not connected. Copy the packet or reconnect.'; sendPending();
  });
  $('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('packet').value); $('submission').textContent = 'Packet copied. Send it privately to the host.'; } catch { $('packet').select(); } });
  render(invite.round || null); status('Connecting to your verified host. Offline: ask for a fresh OFFLINE ROUND link.'); if (invite.round) { status('Offline round — submit and copy the packet, or CONNECT / RETRY to verify the host.'); } else connect();
}

if (invite && invite.v !== ROOM_VERSION) $('connection').textContent = 'This invitation is from an older version. Ask the host for a new private link.';
