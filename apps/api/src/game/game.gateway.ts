import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchesService } from '../matches/matches.service';
import { MatchChatMessage } from '../entities/match-chat-message.entity';
import { User } from '../entities/user.entity';
import { MatchResult } from '../entities/match.entity';

interface ActiveGame {
  matchId: string;
  whiteId: string;
  blackId: string;
  currentTurn: 'white' | 'black';
  timer: NodeJS.Timeout | null;
}

@WebSocketGateway({ namespace: '/game', cors: { origin: '*', credentials: true } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private userSockets = new Map<string, string>();
  private activeGames = new Map<string, ActiveGame>();

  constructor(
    private jwt: JwtService,
    private matches: MatchesService,
    @InjectRepository(MatchChatMessage) private chatRepo: Repository<MatchChatMessage>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  private getUserFromSocket(client: Socket): string | null {
    try {
      const token = client.handshake.auth?.token
        || client.handshake.headers?.authorization?.split(' ')[1];
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET });
      return payload.sub;
    } catch { return null; }
  }

  handleConnection(client: Socket) {
    const userId = this.getUserFromSocket(client);
    if (!userId) { client.disconnect(); return; }
    this.userSockets.set(userId, client.id);
    this.users.update(userId, { isOnline: true }).catch(() => {});
    client.broadcast.emit('user_online', { userId });
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        this.users.update(userId, { isOnline: false }).catch(() => {});
        client.broadcast.emit('user_offline', { userId });
        break;
      }
    }
  }

  @SubscribeMessage('join_game')
  async handleJoinGame(@ConnectedSocket() client: Socket, @MessageBody() data: { matchId: string }) {
    const userId = this.getUserFromSocket(client);
    if (!userId) return;

    const match = await this.matches.getMatch(data.matchId);
    if (!match) return;
    if (match.whitePlayerId !== userId && match.blackPlayerId !== userId) return;

    client.join(`game:${data.matchId}`);
    client.emit('game_state', { match });

    if (!this.activeGames.has(data.matchId)) {
      this.activeGames.set(data.matchId, {
        matchId: data.matchId,
        whiteId: match.whitePlayerId,
        blackId: match.blackPlayerId,
        currentTurn: match.currentTurn as 'white' | 'black',
        timer: null,
      });
      this.startTurnTimer(data.matchId);
    }
  }

  @SubscribeMessage('move')
  async handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; from: string; to: string; promotion?: string; fen: string; pgn: string; moves: any[] },
  ) {
    const userId = this.getUserFromSocket(client);
    if (!userId) return;

    const game = this.activeGames.get(data.matchId);
    if (!game) return;

    const isWhite = game.whiteId === userId;
    if ((isWhite && game.currentTurn !== 'white') || (!isWhite && game.currentTurn !== 'black')) return;

    this.clearTimer(data.matchId);
    await this.matches.updateFen(data.matchId, data.fen, data.pgn, data.moves);
    game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';

    this.server.to(`game:${data.matchId}`).emit('move_broadcast', {
      from: data.from, to: data.to, promotion: data.promotion,
      fen: data.fen, pgn: data.pgn, moves: data.moves, turn: game.currentTurn,
    });

    this.startTurnTimer(data.matchId);
  }

  @SubscribeMessage('game_over_client')
  async handleGameOver(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; result: MatchResult },
  ) {
    const userId = this.getUserFromSocket(client);
    if (!userId) return;
    this.clearTimer(data.matchId);
    this.activeGames.delete(data.matchId);
    await this.matches.finishMatch(data.matchId, data.result);
    this.server.to(`game:${data.matchId}`).emit('game_over', { result: data.result, reason: 'checkmate' });
  }

  @SubscribeMessage('forfeit')
  async handleForfeit(@ConnectedSocket() client: Socket, @MessageBody() data: { matchId: string }) {
    const userId = this.getUserFromSocket(client);
    if (!userId) return;
    const game = this.activeGames.get(data.matchId);
    if (!game) return;
    this.clearTimer(data.matchId);
    this.activeGames.delete(data.matchId);
    const result = game.whiteId === userId ? MatchResult.FORFEIT_WHITE : MatchResult.FORFEIT_BLACK;
    await this.matches.finishMatch(data.matchId, result);
    this.server.to(`game:${data.matchId}`).emit('game_over', { result, reason: 'forfeit' });
  }

  @SubscribeMessage('chat_message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; content: string },
  ) {
    const userId = this.getUserFromSocket(client);
    if (!userId || !data.content?.trim()) return;

    const msg = this.chatRepo.create({ matchId: data.matchId, senderId: userId, content: data.content.trim() });
    await this.chatRepo.save(msg);
    const full = await this.chatRepo.findOne({ where: { id: msg.id }, relations: ['sender'] });
    this.server.to(`game:${data.matchId}`).emit('chat_message', full);
  }

  @SubscribeMessage('join_social')
  handleJoinSocial(@ConnectedSocket() client: Socket) {
    client.join('social');
  }

  private startTurnTimer(matchId: string) {
    const game = this.activeGames.get(matchId);
    if (!game) return;
    this.clearTimer(matchId);
    let seconds = 60;
    this.server.to(`game:${matchId}`).emit('timer_update', { seconds, turn: game.currentTurn });

    game.timer = setInterval(async () => {
      seconds--;
      this.server.to(`game:${matchId}`).emit('timer_update', { seconds, turn: game.currentTurn });
      if (seconds <= 0) {
        this.clearTimer(matchId);
        const result = game.currentTurn === 'white' ? MatchResult.TIMEOUT_WHITE : MatchResult.TIMEOUT_BLACK;
        this.activeGames.delete(matchId);
        await this.matches.finishMatch(matchId, result);
        this.server.to(`game:${matchId}`).emit('game_over', { result, reason: 'timeout' });
      }
    }, 1000);
  }

  private clearTimer(matchId: string) {
    const game = this.activeGames.get(matchId);
    if (game?.timer) { clearInterval(game.timer); game.timer = null; }
  }

  emitToUser(userId: string, event: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) this.server.to(socketId).emit(event, data);
  }
}
