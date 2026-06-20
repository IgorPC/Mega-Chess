import { io, Socket } from 'socket.io-client';

let gameSocket: Socket | null = null;

export function getGameSocket(): Socket {
  if (!gameSocket) {
    const token = localStorage.getItem('accessToken');
    gameSocket = io('/game', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return gameSocket;
}

export function disconnectGameSocket() {
  gameSocket?.disconnect();
  gameSocket = null;
}
