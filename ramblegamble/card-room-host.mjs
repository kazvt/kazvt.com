import { validRequestId } from "./card-room-delivery.mjs?v=submission-audit-20261126-v1";
import { loadHostIdentity, nonce, validNonce, transcript, channelBinding, signHost, verifySeat } from "./card-room-auth.mjs?v=host-security-20261126-v1";
import { ROOM_VERSION, createRoom, validRoom, playerRound, encodePacket, decodePacket, acceptSubmission, isPlayer, randomToken } from "./card-room-protocol.mjs?v=submission-audit-20261126-v1";
import { loadPeer } from "./card-room-peer.mjs";
import { CARD_GAME_PLAYERS } from "./card-games.mjs?v=scene-table-20261126-v1";
import { electReader, withRoomSubmissionLock, ROOM_KEY, ENABLED_KEY, STATUS_KEY } from "./card-room-election.mjs";

export function mountCardRoom(root, { getRound, commitRound, onStatus, role = '/rg/', env = globalThis, peerLoader = loadPeer, identityLoader = loadHostIdentity }) {
  let storage; try { storage = env.localStorage; } catch {}
  const locks = env.navigator?.locks;
  const doc = env.document;
  const read = key => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
  const write = (key, value) => { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  let initFailed = false, hostIdentity = null, room = null, leader = false, awake = true, disposed = false, shared = false;
  let peer = null, retry = null, connectionTimer = null, retryDelay = 1000, generation = 0;
  const clients = new Map(), incomingConnections = new Map(), sentStates = new WeakMap();
  const status = root.querySelector('[data-room-status]');
  const links = root.querySelector('[data-room-links]');
  const start = root.querySelector('[data-room-start]');
  const stop = root.querySelector('[data-room-stop]');
  const packet = root.querySelector('[data-room-packet]');
  const importButton = root.querySelector('[data-room-import]');
  const rotate = root.querySelector('[data-room-rotate]');
  const enabled = () => read(ENABLED_KEY) === true;
  function refreshLinks() {
    links.replaceChildren();
    if (!room) return;
    const current = leader ? { connected: [...clients.keys()] } : read(STATUS_KEY);
    for (const player of CARD_GAME_PLAYERS) {
      const url = new URL('/rg/player/', env.location.href);
      const envelope = { v: ROOM_VERSION, room: room.id, player, token: room.tokens[player], hostKey: room.hostKey };
      url.hash = encodePacket(envelope);
      const round = playerRound(getRound(), player);
      const offline = new URL(url); const offlineFits = JSON.stringify(round).length < 40000; if (offlineFits) offline.hash = encodePacket({ ...envelope, round });
      const row = doc.createElement('div');
      const link = doc.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = `${player.toUpperCase()} — ${enabled() && current?.connected?.includes(player) ? 'connected' : 'offline'}${round?.submitted ? ' · saved' : round?.phase === 'submissions' ? ' · waiting' : ''}`;
      function copyButton(label, value, message) {
        const copy = doc.createElement('button'); copy.type = 'button'; copy.textContent = label;
        copy.addEventListener('click', async () => {
          try { await env.navigator.clipboard.writeText(value); onStatus?.(message); }
          catch { const field = doc.createElement('textarea'); field.value = value; field.readOnly = true; row.append(field); field.select(); }
        });
        return copy;
      }
      row.append(link, copyButton('COPY LINK', url.href, `Copied ${player.toUpperCase()} live invite.`));
      const revoke = doc.createElement('button'); revoke.type='button'; revoke.textContent='REVOKE / REISSUE';
      revoke.addEventListener('click', () => { if (env.confirm?.(`Revoke ${player.toUpperCase()}’s invitation? Send the replacement privately. Saved answers stay.`)) return changeCredentials(player); }); row.append(revoke);
      if (round?.phase === 'submissions' && !round.submitted && offlineFits && offline.hash.length <= 60001) row.append(copyButton('OFFLINE ROUND', offline.href, `Copied ${player.toUpperCase()} offline round link.`));
      links.append(row);
    }
  }
  function refreshStatus() {
    const active = enabled();
    start.disabled = !room || !shared || !locks?.request || active;
    if (stop) stop.disabled = !active;
    importButton.disabled = !room;
    if (rotate) rotate.disabled = !room;
    const current = read(STATUS_KEY);
    status.textContent = !room ? (disposed ? 'Room closed.' : initFailed ? 'Secure identity unavailable. Check HTTPS and browser storage; manual host entry still works.' : hostIdentity ? 'Preparing shared room…' : 'Preparing secure identity (HTTPS and browser storage required)…') : !shared || !locks?.request ? 'Shared reader unavailable in this browser. Offline packets still work.' : !active ? 'Offline — start the shared online room from either host page.' : leader ? `ACTIVE READER (${role}) — ${current?.text || 'Connecting…'}` : `STANDBY (${role}) — ${current?.role ? `${current.role}: ${current.text}` : 'waiting for reader election'}`;
    refreshLinks();
  }
  function report(text) {
    if (!leader) return;
    write(STATUS_KEY, { role, text, connected: [...clients.keys()] });
    refreshStatus();
  }
  function sendState(conn, player, force=false) {
    if (leader && enabled() && conn.open && room && read(ROOM_KEY)?.id === room.id && read(ROOM_KEY)?.tokens?.[player] === room.tokens[player]) { try { const payload={v:ROOM_VERSION,type:"round",round:playerRound(getRound(),player)};const key=JSON.stringify(payload);if(force||sentStates.get(conn)!==key){conn.send(payload);sentStates.set(conn,key);} } catch { try { conn.close(); } catch {} } }
  }
  function publish() {
    refreshLinks();
    if (leader) for (const [player, conn] of clients) sendState(conn, player);
  }
  async function accept(message, stillValid = () => true) {
    const apply = () => {
      const latest = read(ROOM_KEY);
      if (!validRoom(latest) || !stillValid()) return 'reader-changed';
      const current = getRound();
      const result = acceptSubmission(latest, current, message);
      if (result.round !== current && commitRound(result.round) === false) return 'storage-error';
      onStatus?.(`${message?.player || 'Player'}: ${result.status}`);
      return result.status;
    };
    // Serialize packet imports on both pages with incoming network submissions.
    return withRoomSubmissionLock(apply, locks || null);
  }
  function incoming(conn, epoch) {
    if (!leader || epoch !== generation || incomingConnections.size >= 24) { conn.close(); return; }
    
    let identity = null, seatToken = null, phase = 'hello', challenge = null, closed = false;
    const timeout = setTimeout(() => { if (!identity) { cleanup(); conn.close(); } }, 12000);
    const alive = () => !closed && leader && epoch === generation && conn.open && enabled() && !!room && read(ROOM_KEY)?.id === room.id;
    const current = () => alive() && clients.get(identity) === conn && read(ROOM_KEY)?.tokens?.[identity] === seatToken;
    conn.on('data', async message => {
      try {
        if (!alive() || message?.v !== ROOM_VERSION) { conn.close(); return; }
        if (phase === 'hello') {
          if (message.type !== 'hello' || message.room !== room.id || !isPlayer(message.player) || !validNonce(message.clientNonce)) { conn.close(); return; }
          phase = 'signing';
          const player = message.player, token = read(ROOM_KEY)?.tokens?.[player];
          const fields = {room:room.id,player,clientNonce:message.clientNonce,hostNonce:nonce()};
          const text = transcript(fields,channelBinding(conn,true));
          const signature = await signHost(hostIdentity,text);
          if (!alive() || phase !== 'signing' || read(ROOM_KEY)?.tokens?.[player] !== token) { conn.close(); return; }
          challenge = {player,token,text}; phase='proof';
          conn.send({v:ROOM_VERSION,type:'challenge',...fields,signature}); return;
        }
        if (phase === 'proof') {
          if (message.type !== 'proof') { conn.close(); return; }
          phase = 'verifying';
          const verified = await verifySeat(challenge.token,challenge.text,message.proof);
          if (!alive() || phase !== 'verifying') { conn.close(); return; }
          if (!verified || read(ROOM_KEY)?.tokens?.[challenge.player] !== challenge.token) { conn.send({v:ROOM_VERSION,type:'denied'}); phase='denied'; return; }
          identity=challenge.player; seatToken=challenge.token; phase='joined'; clearTimeout(timeout); challenge=null;
          const previous=clients.get(identity); clients.set(identity,conn); if(previous && previous!==conn) previous.close();
          report('Online. Share private invites.'); publish(); return;
        }
        if (phase !== 'joined' || !current() || message.type !== 'submit' || typeof message.roundId!=='string' || message.roundId.length>160 || (message.requestId!==undefined&&!validRequestId(message.requestId))) { conn.close(); return; }
        const submission={v:ROOM_VERSION,type:'submit',room:room.id,player:identity,token:seatToken,roundId:message.roundId,answer:message.answer,requestId:message.requestId};
        let result;
        try { result=await accept(submission,current); } catch { result='storage-error'; }
        if(current()) { try { conn.send({v:ROOM_VERSION,type:'ack',roundId:submission.roundId,...(submission.requestId===undefined?{}:{requestId:submission.requestId}),status:result}); } catch {} sendState(conn,identity,true); }
      } catch { conn.close(); }
    });
    function cleanup() {
      closed=true; clearTimeout(timeout); incomingConnections.delete(conn);
      if(identity && clients.get(identity)===conn) { clients.delete(identity); if(leader && epoch===generation) report('Online. Share private invites.'); }
    }
    incomingConnections.set(conn,cleanup); conn.on('close',cleanup); conn.on('error',cleanup);
  }
  function destroyTransport() {
    ++generation;
    clearTimeout(connectionTimer); clearTimeout(retry); connectionTimer = retry = null;
    const old = peer; peer = null;
    for (const [conn,cleanup] of [...incomingConnections]) { cleanup(); try { conn.close(); } catch {} }
    incomingConnections.clear(); clients.clear();
    try { old?.destroy(); } catch {}
  }
  function scheduleRetry(text) {
    if (!leader) return;
    destroyTransport(); report(`${text} Retrying automatically…`);
    retry = setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 15000);
  }
  async function connect() {
    if (!leader || !room || !enabled() || !awake) return;
    destroyTransport(); const epoch = generation;
    report('Connecting to PeerJS Cloud…');
    try {
      const Peer = await peerLoader();
      if (!leader || epoch !== generation || !enabled() || !awake) return;
      const active = peer = new Peer(room.id, { debug: 0 });
      const current = () => leader && epoch === generation && peer === active;
      const failed = text => { if (current()) scheduleRetry(text); };
      connectionTimer = setTimeout(() => failed('Connection timed out.'), 15000);
      active.on('open', () => { if (!current()) return; clearTimeout(connectionTimer); retryDelay = 1000; report('Online. Share private invites.'); publish(); });
      active.on('connection', conn => incoming(conn, epoch));
      active.on('error', () => failed('Room connection error.'));
      active.on('disconnected', () => failed('Signaling disconnected.'));
      active.on('close', () => failed('Room closed.'));
    } catch { if (leader && epoch === generation) scheduleRetry('PeerJS unavailable.'); }
  }
  const election = electReader({ locks, activate() {
    leader = true; retryDelay = 1000; connect();
    return () => { leader = false; destroyTransport(); write(STATUS_KEY, null); refreshStatus(); };
  }, onError() { shared = false; refreshStatus(); } });
  function reconcile() { election.setWanted(!disposed && awake && shared && !!room && enabled()); refreshStatus(); }
  function syncRoom() {
    const next=read(ROOM_KEY);
    if (!validRoom(next) || next.hostKey !== hostIdentity?.publicKey) { room=null; destroyTransport(); return; }
    const prior=room; room=next;
    if(leader && prior?.id!==next.id) { destroyTransport(); if(enabled()) connect(); }
    else if(leader && prior) for(const player of CARD_GAME_PLAYERS) if(prior.tokens[player]!==next.tokens[player]) clients.get(player)?.close();
  }
  async function changeCredentials(player) {
    try { await withRoomSubmissionLock(() => {
      const current=read(ROOM_KEY); if(!validRoom(current) || current.hostKey!==hostIdentity?.publicKey) throw new Error('Room unavailable');
      const next=player ? {...current,tokens:{...current.tokens,[player]:randomToken()}} : createRoom(hostIdentity.publicKey);
      if(!write(ROOM_KEY,next)) throw new Error('Storage error'); syncRoom(); reconcile();
    },locks); onStatus?.(player ? `${player.toUpperCase()} invitation replaced. Send new link privately.` : 'Room credentials replaced. Send all three new links.'); }
    catch { onStatus?.('Could not replace credentials. No change confirmed.'); }
  }
  function storageChanged(event) { if ([ENABLED_KEY, STATUS_KEY, ROOM_KEY, null].includes(event.key)) { if ((event.key===ROOM_KEY || event.key===null) && hostIdentity) syncRoom(); reconcile(); } }
  function pageHide() { awake = false; destroyTransport(); election.setWanted(false); }
  function pageShow() { awake = true; reconcile(); }
  env.addEventListener?.('storage', storageChanged);
  env.addEventListener?.('pagehide', pageHide);
  env.addEventListener?.('pageshow', pageShow);
  rotate?.addEventListener('click', () => { if(env.confirm?.('Replace room ID and all invitations? Players need new links. Saved rounds stay.')) return changeCredentials(); });
  start.addEventListener('click', () => { if (shared && locks?.request && room && write(ENABLED_KEY, true)) reconcile(); });
  stop?.addEventListener('click', () => { write(ENABLED_KEY, false); reconcile(); });
  importButton.addEventListener('click', async () => {
    let result; try { result = await accept(decodePacket(packet.value.trim())); } catch { result = 'storage-error'; }
    onStatus?.(`Packet: ${result}.`); if (result === 'accepted') packet.value = ''; publish();
  });
  async function init() {
    hostIdentity=await identityLoader(env);
    room=read(ROOM_KEY);
    if(!validRoom(room) || room.hostKey!==hostIdentity.publicKey) {
      room=createRoom(hostIdentity.publicKey); shared=write(ROOM_KEY,room); if(!shared)throw Error('Room storage unavailable');
    } else shared=true;
  }
  const ready=(async()=>{
    try { if(locks?.request) await locks.request('rg-card-room-init-v2',init); else await init(); }
    catch { room=null; shared=false; initFailed=true; }
    if(!disposed) reconcile();
  })();
  refreshStatus();
  return { ready, publish, dispose() { disposed = true; pageHide(); env.removeEventListener?.('storage', storageChanged); env.removeEventListener?.('pagehide', pageHide); env.removeEventListener?.('pageshow', pageShow); } };
}
