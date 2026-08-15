#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname);
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8765);
const SIGNAL_PATH = process.env.SIGNAL_PATH || "/signal";
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const rooms = new Map();
const socketClients = new Map();

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (requestUrl.pathname === SIGNAL_PATH) {
    response.writeHead(426, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Room signaling uses WebSocket.");
    return;
  }

  serveStatic(requestUrl.pathname, response);
});

server.on("upgrade", (request, socket) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (requestUrl.pathname !== SIGNAL_PATH) {
    socket.destroy();
    return;
  }

  const key = request.headers["sec-websocket-key"];
  if (!key) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }

  const accept = crypto.createHash("sha1").update(`${key}${WS_GUID}`).digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "\r\n"
  ].join("\r\n"));

  const client = {
    socket,
    buffer: Buffer.alloc(0),
    roomId: "",
    peerId: "",
    name: "Player",
    role: "member"
  };
  socketClients.set(socket, client);
  socket.on("data", (chunk) => readSocketFrames(client, chunk));
  socket.on("close", () => leaveRoom(client));
  socket.on("error", () => leaveRoom(client));
});

server.listen(PORT, HOST, () => {
  console.log(`berrybox room server listening at http://${HOST}:${PORT}`);
});

function serveStatic(urlPath, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath);
  } catch (error) {
    sendText(response, 400, "Bad request");
    return;
  }

  const relativePath = pathname.replace(/^\/+/, "") || "index.html";
  const requested = path.resolve(ROOT, relativePath);
  if (requested !== ROOT && !requested.startsWith(`${ROOT}${path.sep}`)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  fs.stat(requested, (statError, stats) => {
    if (statError) {
      sendText(response, 404, "Not found");
      return;
    }
    const filePath = stats.isDirectory() ? path.join(requested, "index.html") : requested;
    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        sendText(response, 404, "Not found");
        return;
      }
      const type = contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
      response.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": "no-store"
      });
      response.end(data);
    });
  });
}

function sendText(response, status, message) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

function readSocketFrames(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  while (client.buffer.length) {
    const frame = readFrame(client.buffer);
    if (!frame) return;
    client.buffer = client.buffer.subarray(frame.size);
    if (frame.opcode === 0x8) {
      client.socket.end();
      return;
    }
    if (frame.opcode === 0x9) {
      writeFrame(client.socket, frame.payload, 0xA);
      continue;
    }
    if (frame.opcode !== 0x1) continue;

    let message;
    try {
      message = JSON.parse(frame.payload.toString("utf8"));
    } catch (error) {
      continue;
    }
    handleSignal(client, message);
  }
}

function readFrame(buffer) {
  if (buffer.length < 2) return null;
  const first = buffer[0];
  const second = buffer[1];
  const opcode = first & 0x0f;
  const masked = Boolean(second & 0x80);
  let length = second & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null;
    const wideLength = buffer.readBigUInt64BE(offset);
    if (wideLength > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    length = Number(wideLength);
    offset += 8;
  }

  const maskOffset = offset;
  if (masked) offset += 4;
  if (buffer.length < offset + length) return null;

  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (masked) {
    const mask = buffer.subarray(maskOffset, maskOffset + 4);
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }
  return {
    opcode,
    payload,
    size: offset + length
  };
}

function writeFrame(socket, data, opcode = 0x1) {
  if (!socket || socket.destroyed) return;
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function handleSignal(client, message) {
  if (!message || typeof message.type !== "string") return;
  if (message.type === "join") {
    joinRoom(client, message);
    return;
  }

  if (!client.roomId || !client.peerId) return;
  if (["offer", "answer", "candidate"].includes(message.type)) {
    forwardSignal(client, message);
  }
}

function joinRoom(client, message) {
  const roomId = cleanRoomCode(message.roomId);
  const peerId = cleanPeerId(message.peerId) || `peer-${crypto.randomBytes(5).toString("hex")}`;
  if (!roomId) {
    send(client, { type: "error", error: "bad-room" });
    return;
  }

  leaveRoom(client);
  client.roomId = roomId;
  client.peerId = peerId;
  client.name = cleanName(message.name);

  const room = ensureRoom(roomId);
  const existing = room.clients.get(peerId);
  if (existing && existing !== client) existing.socket.end();

  const hasHost = room.hostId && room.clients.has(room.hostId);
  client.role = hasHost ? "member" : "host";
  room.clients.set(peerId, client);
  if (client.role === "host") room.hostId = peerId;

  send(client, {
    type: "role",
    roomId,
    role: client.role,
    peerId
  });

  if (client.role === "member") {
    const host = room.clients.get(room.hostId);
    send(host, {
      type: "member-joined",
      roomId,
      peerId,
      name: client.name
    });
  } else {
    notifyHostOfMembers(room);
  }
}

function forwardSignal(client, message) {
  const room = rooms.get(client.roomId);
  if (!room) return;
  const targetId = cleanPeerId(message.to);
  const target = room.clients.get(targetId);
  if (!target) return;

  send(target, {
    ...message,
    roomId: client.roomId,
    from: client.peerId
  });
}

function leaveRoom(client) {
  if (!client.roomId || !client.peerId) return;
  const room = rooms.get(client.roomId);
  if (!room) return;

  room.clients.delete(client.peerId);
  const wasHost = room.hostId === client.peerId;
  const oldRoomId = client.roomId;
  const oldPeerId = client.peerId;
  client.roomId = "";
  client.peerId = "";

  if (!room.clients.size) {
    rooms.delete(oldRoomId);
    return;
  }

  if (wasHost) {
    for (const member of room.clients.values()) {
      send(member, { type: "host-left", roomId: oldRoomId });
    }
    const nextHost = room.clients.values().next().value;
    room.hostId = nextHost.peerId;
    nextHost.role = "host";
    send(nextHost, {
      type: "role",
      roomId: oldRoomId,
      role: "host",
      peerId: nextHost.peerId
    });
    setTimeout(() => notifyHostOfMembers(room), 150);
    return;
  }

  const host = room.clients.get(room.hostId);
  send(host, {
    type: "peer-left",
    roomId: oldRoomId,
    peerId: oldPeerId
  });
}

function notifyHostOfMembers(room) {
  const host = room.clients.get(room.hostId);
  if (!host) return;
  for (const member of room.clients.values()) {
    if (member.peerId === room.hostId) continue;
    send(host, {
      type: "member-joined",
      roomId: room.id,
      peerId: member.peerId,
      name: member.name
    });
  }
}

function ensureRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      hostId: "",
      clients: new Map()
    };
    rooms.set(roomId, room);
  }
  return room;
}

function send(client, message) {
  if (!client || !client.socket || client.socket.destroyed) return;
  writeFrame(client.socket, JSON.stringify(message));
}

function cleanRoomCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

function cleanPeerId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
}

function cleanName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim();
  return name.slice(0, 28) || "Player";
}
