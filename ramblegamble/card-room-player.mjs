import { ROOM_VERSION, isPlayer, decodePacket, encodePacket } from "./card-room-protocol.mjs";
import { loadPeer } from "./card-room-peer.mjs";
const $ = id => document.getElementById(id);
const invite = decodePacket(location.hash.slice(1));
window.addEventListener("hashchange", () => location.reload());
if (invite?.v === ROOM_VERSION && isPlayer(invite.player) && /^rg-[a-f0-9]{32}$/.test(invite.room) && /^[a-f0-9]{32}$/.test(invite.token)) {
  const envelope = { v: ROOM_VERSION, room: invite.room, player: invite.player, token: invite.token };
  let round = null, peer = null, conn = null, attempt = 0, online = false, pending = null;
  const pendingKey = `rg-card-pending:${invite.room}:${invite.player}`;
  function remember(value) { try { if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value)); else sessionStorage.removeItem(pendingKey); } catch {} }
  function recover(roundId) { try { const saved = JSON.parse(sessionStorage.getItem(pendingKey)); return saved?.roundId === roundId && saved?.room === invite.room && saved?.token === invite.token ? saved : null; } catch { return null; } }
  function showPacket() { $('packet').value = encodePacket(pending); $('fallback').hidden = false; $('form').hidden = true; $('submission').textContent = 'Waiting for host confirmation. Reconnect or copy the packet.'; }

  $('player').textContent = invite.player.toUpperCase(); $('berry').src = `../../ramblegamble/assets/berries/${invite.player}berry.png`; $('berry').hidden = false;
  $('connect').hidden = false;
  function status(text) { $('connection').textContent = text; }
  function sendPending() { if (online && conn?.open && pending && round?.id === pending.roundId && !round.submitted && round.phase === 'submissions') { try { conn.send(pending); } catch { status('Send failed; reconnect or copy the packet.'); } } }
  function render(next) {
    if (next && (!['red-handed','quiplash'].includes(next.mode) || typeof next.id !== 'string' || typeof next.prompt !== 'string')) return;
    const changed = next?.id !== round?.id;
    if (changed) { pending = next ? recover(next.id) : null; if (next && !pending) remember(null); $('answer').value = ''; $('submission').textContent = ''; $('fallback').hidden = true; $('choices').replaceChildren(); }
    round = next;
    $('round').hidden = !round;
    if (!round) return;
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
  function disconnect(message) { online = false; $('connect').disabled = false; status(message); }
  async function connect() {
    const generation = ++attempt; online = false; $('connect').disabled = true; status('Connecting to host…');
    if (peer && !peer.destroyed) peer.destroy();
    const timer = setTimeout(() => { if (generation === attempt && !online) { ++attempt; peer?.destroy(); disconnect('Host unreachable. Retry or ask the host for an OFFLINE ROUND link and copy a packet.'); } }, 18000);
    try {
      const Peer = await loadPeer(); if (generation !== attempt) return;
      peer = new Peer({debug:0});
      const fail = message => { if (generation !== attempt) return; clearTimeout(timer); disconnect(message); };
      peer.on('disconnected', () => { if (!conn?.open) fail('Signaling disconnected. Retry or ask for an offline round link.'); });
      peer.on('error', () => fail('Connection error. Retry or copy a packet.'));
      peer.on('open', () => {
        if (generation !== attempt) return;
        conn = peer.connect(invite.room,{reliable:true});
        conn.on('open', () => { if (generation === attempt) conn.send({...envelope,type:'join'}); });
        conn.on('data', message => {
          if (generation !== attempt || message?.v !== ROOM_VERSION) return;
          if (message.type === 'round') { online = true; clearTimeout(timer); $('connect').disabled = false; status(message.round ? 'Connected to host.' : 'Connected — waiting for host to start a round.'); render(message.round); }
          if (message.type === 'ack' && message.roundId === pending?.roundId) {
            if (message.status === 'accepted' || message.status === 'already-submitted') { const already = message.status === 'already-submitted'; pending = null; remember(null); $('fallback').hidden = true; $('submission').textContent = already ? 'Host already saved an answer for this round.' : 'Answer received by host!'; }
            else { pending = null; remember(null); $('fallback').hidden = true; $('submission').textContent = `Host rejected answer: ${message.status}.`; render(round); }
          }
        });
        conn.on('close', () => fail('Disconnected. Retry or copy your pending packet.')); conn.on('error', () => fail('Connection error. Retry or copy your packet.'));
      });
    } catch { clearTimeout(timer); if (generation === attempt) disconnect('Live service unavailable. Use copy/paste packets.'); }
  }
  $('connect').addEventListener('click', connect);
  $('form').addEventListener('submit', event => {
    event.preventDefault(); if (!round || round.phase !== 'submissions' || round.submitted || pending) return;
    const choice = document.querySelector('input[name=evidence]:checked');
    const answer = round.mode === 'quiplash' ? $('answer').value.trim() : round.hand?.[Number(choice?.value)];
    if (!answer || answer.length > 800) { $('submission').textContent = 'Enter an answer or select a card.'; return; }
    pending = {...envelope,type:'submit',roundId:round.id,answer}; remember(pending); $('form').hidden = true; $('packet').value = encodePacket(pending); $('fallback').hidden = false;
    $('submission').textContent = online ? 'Sending — waiting for host confirmation…' : 'Not connected. Copy the packet or reconnect.'; sendPending();
  });
  $('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('packet').value); $('submission').textContent = 'Packet copied. Send it privately to the host.'; } catch { $('packet').select(); } });
  render(invite.round || null); status('Connecting uses the host’s private invitation. Offline: ask the host for an OFFLINE ROUND link.'); connect();
}
