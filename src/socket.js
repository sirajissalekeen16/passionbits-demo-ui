import { io } from 'socket.io-client'

let _socket = null
const _joined = new Set()

export function getSocket() {
  if (!_socket) {
    // Polling first, then upgrade to WebSocket if nginx supports the Upgrade
    // header. Without this order, environments where nginx is missing the
    // websocket upgrade config spam the console with reconnect-loop errors
    // every few seconds even though long-polling actually works.
    _socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      upgrade: true,
    })
  }
  return _socket
}

export function joinRoom(email) {
  if (!email) return
  const sock = getSocket()

  // Emit on the current connection AND on every reconnect.
  //
  // socket.io rooms are server-side state keyed by the socket's `sid`. When the
  // transport drops (which long-polling does often through nginx, especially
  // on `transport=polling` after idle timeouts) the client gets a fresh sid on
  // reconnect — and the new sid is NOT a member of any prior room. The old
  // implementation called `sock.once('connect', join)` which only fired the
  // FIRST time, so reconnects silently left us outside the room. Backend
  // would publish `subscribers=1` (the API process is up) but no client is
  // actually receiving.
  if (!_joined.has(email)) {
    sock.on('connect', () => sock.emit('join_job', { email }))
    _joined.add(email)
  }
  if (sock.connected) sock.emit('join_job', { email })
}
