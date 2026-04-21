import { io } from 'socket.io-client'

let _socket = null
const _joined = new Set()

export function getSocket() {
  if (!_socket) {
    _socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
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
