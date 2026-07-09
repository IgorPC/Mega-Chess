import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getAdminSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('adminToken')
    socket = io('/game', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    })
  }
  return socket
}

export function disconnectAdminSocket() {
  socket?.disconnect()
  socket = null
}
