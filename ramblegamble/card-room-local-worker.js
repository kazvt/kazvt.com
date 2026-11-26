/* Same-origin room rendezvous. Only transfers private MessagePorts; never
   receives a seat token, answer, or question. The elected host authenticates
   every connection on its own port with the existing signed challenge. */
const rooms = new Map();
const validRoomId = value => typeof value === 'string' && /^rg-[a-f0-9]{32}$/.test(value);
self.onconnect = ({ports:[port]}) => {
  let registered = null, joined = false;
  const unregister = () => {
    if (registered && rooms.get(registered) === port) rooms.delete(registered);
    registered = null;
  };
  const send = (target, message, transfer = []) => target.postMessage(message, transfer);
  port.onmessage = ({data:m}) => {
    if (m?.type === 'unregister') { unregister(); return; }
    if (!validRoomId(m?.room)) return;
    if (m.type === 'register' && !joined && !registered) {
      const previous = rooms.get(m.room);
      if (previous && previous !== port) { try { send(previous,{type:'replaced'}); } catch {} }
      registered = m.room; rooms.set(registered,port);
      send(port,{type:'ready'}); return;
    }
    if (m.type !== 'join' || joined || registered) return;
    joined = true;
    const host = rooms.get(m.room);
    if (!host) { send(port,{type:'unavailable'}); return; }
    const pair = new MessageChannel(), id = crypto.randomUUID();
    try {
      send(host,{type:'incoming',id},[pair.port1]);
      send(port,{type:'connected',id},[pair.port2]);
    } catch {
      if (rooms.get(m.room) === host) rooms.delete(m.room);
      try { pair.port1.close(); pair.port2.close(); send(port,{type:'unavailable'}); } catch {}
    }
  };
  port.onmessageerror = unregister;
  port.addEventListener('close',unregister);
  port.start();
};
