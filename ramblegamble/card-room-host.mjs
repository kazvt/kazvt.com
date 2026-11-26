import { ROOM_VERSION, createRoom, validRoom, authorized, playerRound, encodePacket, decodePacket, acceptSubmission } from "./card-room-protocol.mjs";
import { loadPeer } from "./card-room-peer.mjs";
import { CARD_GAME_PLAYERS } from "./card-games.mjs?v=scene-table-20261126-v1";
export function mountCardRoom(root, { getRound, commitRound, onStatus }) {
  let room;
  try { room = JSON.parse(sessionStorage.getItem("rg-card-room-v1")); } catch {}
  if (!validRoom(room)) room = createRoom();
  try { sessionStorage.setItem("rg-card-room-v1", JSON.stringify(room)); } catch {}
  let peer = null, starting = false;
  const clients = new Map();
  const status = root.querySelector("[data-room-status]");
  const links = root.querySelector("[data-room-links]");
  const start = root.querySelector("[data-room-start]");
  const packet = root.querySelector("[data-room-packet]");
  function refreshLinks() {
    links.replaceChildren();
    for (const player of CARD_GAME_PLAYERS) {
      const url = new URL("./player/", location.href.endsWith("/rg") ? location.href + "/" : location.href);
      const envelope = { v: ROOM_VERSION, room: room.id, player, token: room.tokens[player] };
      url.hash = encodePacket(envelope);
      const round = playerRound(getRound(), player);
      const offline = new URL(url);
      offline.hash = encodePacket({ ...envelope, round });
      const row = document.createElement("div");
      const link = document.createElement("a"); link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = `${player.toUpperCase()} — ${clients.get(player)?.open ? "connected" : "invite"}`;
      function copyButton(label, value, message) {
        const copy = document.createElement("button"); copy.type = "button"; copy.textContent = label;
        copy.addEventListener("click", async () => {
          try { await navigator.clipboard.writeText(value); status.textContent = message; }
          catch { const field = document.createElement("textarea"); field.value = value; field.readOnly = true; row.append(field); field.select(); }
        });
        return copy;
      }
      row.append(link, copyButton("COPY LINK", url.href, `Copied ${player.toUpperCase()} live invite.`));
      if (round?.phase === "submissions" && !round.submitted) row.append(copyButton("OFFLINE ROUND", offline.href, `Copied ${player.toUpperCase()} offline round link.`));
      links.append(row);
    }
  }
  function sendState(conn, player) {
    if (conn.open) { try { conn.send({ v: ROOM_VERSION, type: "round", round: playerRound(getRound(), player) }); } catch {} }
  }
  function publish() {
    refreshLinks();
    for (const [player, conn] of clients) sendState(conn, player);
  }
  function accept(message) {
    const current = getRound();
    const result = acceptSubmission(room, current, message);
    if (result.round !== current) commitRound(result.round);
    onStatus?.(`${message?.player || "Player"}: ${result.status}`);
    return result.status;
  }
  function incoming(conn) {
    let identity = null;
    const timeout = setTimeout(() => { if (!identity) conn.close(); }, 10000);
    conn.on("data", message => {
      if (!authorized(room, message)) { conn.close(); return; }
      if (!identity) {
        if (message.type !== "join") { conn.close(); return; }
        identity = message.player; clearTimeout(timeout);
        const previous = clients.get(identity); clients.set(identity, conn); if (previous && previous !== conn) previous.close();
        publish(); return;
      }
      if (identity !== message.player || clients.get(identity) !== conn) { conn.close(); return; }
      if (message.type === "submit") { const result = accept(message); if (conn.open) conn.send({ v: ROOM_VERSION, type: "ack", roundId: message.roundId, status: result }); sendState(conn, identity); }
    });
    function cleanup() { clearTimeout(timeout); if (identity && clients.get(identity) === conn) { clients.delete(identity); refreshLinks(); } }
    conn.on("close", cleanup); conn.on("error", cleanup);
  }
  start.addEventListener("click", async () => {
    if (starting || start.dataset.online === "true") return;
    starting = true; start.disabled = true; status.textContent = "Connecting to PeerJS Cloud…";
    try {
      if (peer && !peer.destroyed) peer.destroy();
      start.disabled = true; starting = true;
      const Peer = await loadPeer();
      peer = new Peer(room.id, { debug: 0 });
      const active = peer;
      const failed = text => { if (peer !== active) return; starting = false; start.disabled = false; delete start.dataset.online; status.textContent = text; };
      const timer = setTimeout(() => { if (starting && peer === active) { active.destroy(); failed("Connection timed out. Retry or use copy/paste packets."); } }, 15000);
      active.on("open", () => { clearTimeout(timer); starting = false; start.dataset.online = "true"; status.textContent = "Room online. Share each player's private invite."; publish(); });
      active.on("connection", incoming);
      active.on("error", () => { clearTimeout(timer); failed("Room connection error. Retry or use copy/paste packets."); });
      active.on("disconnected", () => failed("Signaling disconnected. Retry to accept new players."));
      active.on("close", () => failed("Room closed. Retry or use copy/paste packets."));
    } catch { starting = false; start.disabled = false; status.textContent = "PeerJS unavailable. Use copy/paste packets."; }
  });
  root.querySelector("[data-room-import]").addEventListener("click", () => {
    const message = decodePacket(packet.value.trim()); const result = accept(message);
    status.textContent = `Packet: ${result}.`; if (result === "accepted") packet.value = ""; publish();
  });
  refreshLinks();
  return { publish };
}
