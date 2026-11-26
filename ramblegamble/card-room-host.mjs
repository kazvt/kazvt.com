import { ROOM_VERSION, createRoom, validRoom, authorized, playerRound, encodePacket, decodePacket, acceptSubmission } from "./card-room-protocol.mjs";
import { loadPeer } from "./card-room-peer.mjs";
import { CARD_GAME_PLAYERS } from "./card-games.mjs?v=scene-table-20261126-v1";
import { electReader, withRoomSubmissionLock, ROOM_KEY, ENABLED_KEY, STATUS_KEY } from "./card-room-election.mjs";

export function mountCardRoom(root, { getRound, commitRound, onStatus, role = '/rg/', env = globalThis, peerLoader = loadPeer }) {
  let storage; try { storage = env.localStorage; } catch {}
  const locks = env.navigator?.locks;
  const doc = env.document;
  const read = key => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
  const write = (key, value) => { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  let room = null, leader = false, awake = true, disposed = false, shared = false;
  let peer = null, retry = null, connectionTimer = null, retryDelay = 1000, generation = 0;
  const clients = new Map(), incomingConnections = new Set();
  const status = root.querySelector('[data-room-status]');
  const links = root.querySelector('[data-room-links]');
  const start = root.querySelector('[data-room-start]');
  const stop = root.querySelector('[data-room-stop]');
  const packet = root.querySelector('[data-room-packet]');
  const importButton = root.querySelector('[data-room-import]');
  const enabled = () => read(ENABLED_KEY) === true;
  function refreshLinks() {
    links.replaceChildren();
    if (!room) return;
    const current = leader ? { connected: [...clients.keys()] } : read(STATUS_KEY);
    for (const player of CARD_GAME_PLAYERS) {
      const url = new URL('/rg/player/', env.location.href);
      const envelope = { v: ROOM_VERSION, room: room.id, player, token: room.tokens[player] };
      url.hash = encodePacket(envelope);
      const round = playerRound(getRound(), player);
      const offline = new URL(url); offline.hash = encodePacket({ ...envelope, round });
      const row = doc.createElement('div');
      const link = doc.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = `${player.toUpperCase()} — ${enabled() && current?.connected?.includes(player) ? 'connected' : 'invite'}`;
      function copyButton(label, value, message) {
        const copy = doc.createElement('button'); copy.type = 'button'; copy.textContent = label;
        copy.addEventListener('click', async () => {
          try { await env.navigator.clipboard.writeText(value); onStatus?.(message); }
          catch { const field = doc.createElement('textarea'); field.value = value; field.readOnly = true; row.append(field); field.select(); }
        });
        return copy;
      }
      row.append(link, copyButton('COPY LINK', url.href, `Copied ${player.toUpperCase()} live invite.`));
      if (round?.phase === 'submissions' && !round.submitted) row.append(copyButton('OFFLINE ROUND', offline.href, `Copied ${player.toUpperCase()} offline round link.`));
      links.append(row);
    }
  }
  function refreshStatus() {
    const active = enabled();
    start.disabled = !room || !shared || !locks?.request || active;
    if (stop) stop.disabled = !active;
    importButton.disabled = !room;
    const current = read(STATUS_KEY);
    status.textContent = !room ? 'Preparing shared room…' : !shared || !locks?.request ? 'Shared reader unavailable in this browser. Offline packets still work.' : !active ? 'Offline — start the shared online room from either host page.' : leader ? `ACTIVE READER (${role}) — ${current?.text || 'Connecting…'}` : `STANDBY (${role}) — ${current?.role ? `${current.role}: ${current.text}` : 'waiting for reader election'}`;
    refreshLinks();
  }
  function report(text) {
    if (!leader) return;
    write(STATUS_KEY, { role, text, connected: [...clients.keys()] });
    refreshStatus();
  }
  function sendState(conn, player) {
    if (leader && conn.open) { try { conn.send({ v: ROOM_VERSION, type: 'round', round: playerRound(getRound(), player) }); } catch {} }
  }
  function publish() {
    refreshLinks();
    if (leader) for (const [player, conn] of clients) sendState(conn, player);
  }
  async function accept(message, stillValid = () => true) {
    const apply = () => {
      if (!room || !stillValid()) return 'reader-changed';
      const current = getRound();
      const result = acceptSubmission(room, current, message);
      if (result.round !== current && commitRound(result.round) === false) return 'storage-error';
      onStatus?.(`${message?.player || 'Player'}: ${result.status}`);
      return result.status;
    };
    // Serialize packet imports on both pages with incoming network submissions.
    return withRoomSubmissionLock(apply, locks || null);
  }
  function incoming(conn, epoch) {
    if (!leader || epoch !== generation) { conn.close(); return; }
    incomingConnections.add(conn);
    let identity = null;
    const timeout = setTimeout(() => { if (!identity) conn.close(); }, 10000);
    const current = () => leader && epoch === generation && conn.open && clients.get(identity) === conn;
    conn.on('data', async message => {
      if (!leader || epoch !== generation || !authorized(room, message)) { conn.close(); return; }
      if (!identity) {
        if (message.type !== 'join') { conn.close(); return; }
        identity = message.player; clearTimeout(timeout);
        const previous = clients.get(identity); clients.set(identity, conn); if (previous && previous !== conn) previous.close();
        report('Online. Share private invites.'); publish(); return;
      }
      if (identity !== message.player || clients.get(identity) !== conn) { conn.close(); return; }
      if (message.type === 'submit') {
        let result;
        try { result = await accept(message, current); } catch { result = 'storage-error'; }
        if (current()) { try { conn.send({ v: ROOM_VERSION, type: 'ack', roundId: message.roundId, status: result }); } catch {} sendState(conn, identity); }
      }
    });
    function cleanup() {
      clearTimeout(timeout); incomingConnections.delete(conn);
      if (identity && clients.get(identity) === conn) { clients.delete(identity); if (leader && epoch === generation) report('Online. Share private invites.'); }
    }
    conn.on('close', cleanup); conn.on('error', cleanup);
  }
  function destroyTransport() {
    ++generation;
    clearTimeout(connectionTimer); clearTimeout(retry); connectionTimer = retry = null;
    const old = peer; peer = null;
    for (const conn of [...incomingConnections]) { try { conn.close(); } catch {} }
    incomingConnections.clear(); clients.clear();
    try { old?.destroy(); } catch {}
  }
  function scheduleRetry(text) {
    if (!leader) return;
    destroyTransport(); report(`${text} Retrying automatically…`);
    retry = setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 15000);
  }
  async function connect() {
    if (!leader || !enabled() || !awake) return;
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
  function storageChanged(event) { if ([ENABLED_KEY, STATUS_KEY, ROOM_KEY, null].includes(event.key)) { if (event.key === ROOM_KEY && !leader) { const next = read(ROOM_KEY); if (validRoom(next)) room = next; } reconcile(); } }
  function pageHide() { awake = false; destroyTransport(); election.setWanted(false); }
  function pageShow() { awake = true; reconcile(); }
  env.addEventListener?.('storage', storageChanged);
  env.addEventListener?.('pagehide', pageHide);
  env.addEventListener?.('pageshow', pageShow);
  start.addEventListener('click', () => { if (shared && locks?.request && room && write(ENABLED_KEY, true)) reconcile(); });
  stop?.addEventListener('click', () => { write(ENABLED_KEY, false); reconcile(); });
  importButton.addEventListener('click', async () => {
    let result; try { result = await accept(decodePacket(packet.value.trim())); } catch { result = 'storage-error'; }
    onStatus?.(`Packet: ${result}.`); if (result === 'accepted') packet.value = ''; publish();
  });
  function init() {
    let legacy; try { legacy = JSON.parse(env.sessionStorage.getItem(ROOM_KEY)); } catch {}
    room = read(ROOM_KEY);
    if (!validRoom(room)) { room = validRoom(legacy) ? legacy : createRoom(); shared = write(ROOM_KEY, room); }
    else shared = true;
  }
  const ready = (async () => {
    try { if (locks?.request) await locks.request('rg-card-room-init-v2', init); else init(); }
    catch { room = createRoom(); shared = false; }
    if (!disposed) reconcile();
  })();
  refreshStatus();
  return { ready, publish, dispose() { disposed = true; pageHide(); env.removeEventListener?.('storage', storageChanged); env.removeEventListener?.('pagehide', pageHide); env.removeEventListener?.('pageshow', pageShow); } };
}
