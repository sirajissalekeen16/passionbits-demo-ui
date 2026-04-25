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
  if (!email || _joined.has(email)) return
  const sock = getSocket()
  const doJoin = () => {
    sock.emit('join_job', { email })
    _joined.add(email)
  }
  if (sock.connected) doJoin()
  else sock.once('connect', doJoin)
}
