import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentBracket } from '../entities/tournament.entity';
import { GameGateway } from '../game/game.gateway';

@WebSocketGateway({
  namespace: '/tournament',
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost', credentials: true },
})
export class TournamentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(TournamentGateway.name);

  /** userId → Set<socketId> para envio direcionado */
  private userSockets = new Map<string, Set<string>>();
  /** socketId → userId */
  private socketUsers = new Map<string, string>();

  private readonly jwtSecret: string;

  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly jwt: JwtService,
    @Inject(forwardRef(() => GameGateway)) private readonly gameGateway: GameGateway,
    config: ConfigService,
  ) {
    this.jwtSecret = config.get<string>('JWT_SECRET') ?? '';

    // Registra callback no service para emitir bracket updates
    this.tournamentsService.bracketUpdateEmitter = (tournamentId, bracket) => {
      this.server?.to(`tournament:${tournamentId}`)?.emit('bracket_update', {
        tournamentId, bracket, updatedAt: new Date().toISOString(),
      });
    };

    // Registra callback para updates da sala (player joined/left/kicked)
    (this.tournamentsService as any)._roomUpdateEmitter = (tournamentId: string, data: object) => {
      this.server?.to(`tournament:${tournamentId}`)?.emit('room_update', data);
    };

    // Jogador entrou/saiu/kickado — atualiza contagem na lista pública
    this.tournamentsService.listUpdateEmitter = (tournamentId, currentPlayers) => {
      this.server?.to('tournament_list')?.emit('list_update', { type: 'PLAYERS_CHANGED', tournamentId, currentPlayers });
    };

    // Countdown da próxima rodada
    this.tournamentsService.nextRoundEmitter = (tournamentId, seconds) => {
      this.server?.to(`tournament:${tournamentId}`)?.emit('next_round_countdown', { seconds });
    };

    // Torneio finalizado — envia dados atualizados
    this.tournamentsService.tournamentFinishedEmitter = (tournamentId, tournament) => {
      this.server?.to(`tournament:${tournamentId}`)?.emit('tournament_finished', { tournament });
      this.server?.to('tournament_list')?.emit('list_update', { type: 'FINISHED', tournamentId });
    };

    // Envia convite de duelo em tempo real para o amigo convidado
    this.tournamentsService.duelInviteEmitter = (userId, data) => {
      this.gameGateway?.emitToUser(userId, 'duel_invite_received', data);
    };

    // Registra callback para notificar jogadores quando partida de torneio é criada
    this.tournamentsService.matchFoundEmitter = (player1Id, player2Id, matchId, match) => {
      const matchPayload = {
        id: match.id,
        whitePlayer: match.whitePlayer
          ? { id: match.whitePlayerId, nickname: match.whitePlayer.nickname, rating: match.whitePlayer.rating, avatarUrl: match.whitePlayer.avatarUrl ?? null }
          : { id: match.whitePlayerId, nickname: '...', rating: 1200, avatarUrl: null },
        blackPlayer: match.blackPlayer
          ? { id: match.blackPlayerId, nickname: match.blackPlayer.nickname, rating: match.blackPlayer.rating, avatarUrl: match.blackPlayer.avatarUrl ?? null }
          : { id: match.blackPlayerId, nickname: '...', rating: 1200, avatarUrl: null },
      };
      this.gameGateway?.emitToUser(player1Id, 'match_found', { matchId, color: 'white', match: matchPayload });
      this.gameGateway?.emitToUser(player2Id, 'match_found', { matchId, color: 'black', match: matchPayload });
    };
  }

  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) { socket.disconnect(); return; }

      const payload = this.jwt.verify<{ sub: string }>(token, { secret: this.jwtSecret });
      const userId = payload.sub;

      socket.data.userId = userId;
      this.socketUsers.set(socket.id, userId);

      const sockets = this.userSockets.get(userId) ?? new Set<string>();
      sockets.add(socket.id);
      this.userSockets.set(userId, sockets);
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = this.socketUsers.get(socket.id);
    if (userId) {
      this.socketUsers.delete(socket.id);
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) this.userSockets.delete(userId);
      }
    }
  }

  /** Cliente entra na sala do torneio para receber bracket updates */
  @SubscribeMessage('join_tournament_room')
  async handleJoinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { tournamentId: string },
  ) {
    if (!data?.tournamentId) return;
    await socket.join(`tournament:${data.tournamentId}`);

    try {
      const tournament = await this.tournamentsService.getTournamentDetails(data.tournamentId);
      socket.emit('tournament_state', { tournament });
    } catch (e) {
      this.logger.warn(`join_tournament_room error: ${e.message}`);
    }
  }

  /** Cliente sai da sala */
  @SubscribeMessage('leave_tournament_room')
  async handleLeaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { tournamentId: string },
  ) {
    if (data?.tournamentId) {
      await socket.leave(`tournament:${data.tournamentId}`);
    }
  }

  /** Emite bracket atualizado para todos na sala do torneio */
  emitBracketUpdate(tournamentId: string, bracket: TournamentBracket) {
    this.server.to(`tournament:${tournamentId}`).emit('bracket_update', {
      tournamentId,
      bracket,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Emite para lista pública — clientes na tela de listagem recebem updates */
  emitTournamentListUpdate(data: {
    type: 'CREATED' | 'UPDATED' | 'STARTED' | 'CANCELLED' | 'FINISHED';
    tournamentId: string;
    name?: string;
    currentPlayers?: number;
    maxPlayers?: number;
  }) {
    this.server.to('tournament_list').emit('list_update', data);
  }

  /** Cliente se inscreve na lista pública de torneios */
  @SubscribeMessage('subscribe_tournament_list')
  async handleSubscribeList(@ConnectedSocket() socket: Socket) {
    await socket.join('tournament_list');
  }

  @SubscribeMessage('unsubscribe_tournament_list')
  async handleUnsubscribeList(@ConnectedSocket() socket: Socket) {
    await socket.leave('tournament_list');
  }
}
