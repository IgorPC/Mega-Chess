import { io, Socket } from 'socket.io-client';

let tournamentSocket: Socket | null = null;

export function getTournamentSocket(): Socket {
  if (!tournamentSocket) {
    const token = localStorage.getItem('accessToken');
    tournamentSocket = io('/tournament', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return tournamentSocket;
}

export function disconnectTournamentSocket(): void {
  tournamentSocket?.disconnect();
  tournamentSocket = null;
}
