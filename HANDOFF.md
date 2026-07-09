# Mega Chess Online — Handoff Document

Documento de contexto completo para continuidade do projeto por qualquer agente ou desenvolvedor.
**Última atualização:** 2026-06-28

---

## Índice

1. [O que é o projeto](#1-o-que-é-o-projeto)
2. [Stack e Estrutura de Arquivos](#2-stack-e-estrutura-de-arquivos)
3. [Estado Atual do Desenvolvimento](#3-estado-atual-do-desenvolvimento)
4. [Backend — O que está implementado](#4-backend--o-que-está-implementado)
5. [Frontend — O que está implementado](#5-frontend--o-que-está-implementado)
6. [Sistema de Torneios — Arquitetura Completa](#6-sistema-de-torneios--arquitetura-completa)
7. [Infraestrutura e Deploy](#7-infraestrutura-e-deploy)
8. [Modelo de Negócio e Pagamentos](#8-modelo-de-negócio-e-pagamentos)
9. [Decisões Técnicas Importantes](#9-decisões-técnicas-importantes)
10. [Bugs Corrigidos](#10-bugs-corrigidos)
11. [O que ainda NÃO está implementado](#11-o-que-ainda-não-está-implementado)
12. [Próximas Features Planejadas](#12-próximas-features-planejadas)
13. [Variáveis de Ambiente](#13-variáveis-de-ambiente)
14. [Como rodar localmente](#14-como-rodar-localmente)
15. [Histórico de Sessões](#15-histórico-de-sessões)

---

## 1. O que é o projeto

**Mega Chess Online** é uma plataforma de xadrez competitivo online com:
- Partidas em tempo real via WebSocket
- Sistema de ranking ELO
- Matchmaking automático e desafios entre amigos
- Sistema social (amigos, chat privado, notificações)
- **Torneios pagos com moeda virtual ($CC = Chess Coins)** integrados ao gateway de pagamento **Asaas** via PIX
- Histórico de partidas, reviews de jogadores e modo offline contra IA (Stockfish)

**Domínio de produção:** `https://megachess.io`
**Domínio de homologação:** `https://homologa.megachess.io`
**Repositório GitHub:** `IgorPC/Mega-Chess-Online` (privado)

---

## 2. Stack e Estrutura de Arquivos

```
mega-chess/
├── docker-compose.yml
├── docker-compose.prod.yml
├── HANDOFF.md                  # Este arquivo
├── apps/
│   ├── api/                    # NestJS (porta 3000)
│   │   └── src/
│   │       ├── app.module.ts
│   │       ├── main.ts
│   │       ├── database/
│   │       ├── entities/       # 20+ entidades TypeORM
│   │       ├── auth/
│   │       ├── users/
│   │       ├── matches/
│   │       ├── matchmaking/
│   │       ├── game/           # WebSocket Gateway (/game namespace)
│   │       ├── friends/
│   │       ├── messages/
│   │       ├── notifications/
│   │       ├── ranking/
│   │       ├── reviews/
│   │       ├── wallet/
│   │       ├── tournaments/    # TournamentsService + TournamentGateway (/tournament namespace)
│   │       ├── asaas/
│   │       ├── webhooks/
│   │       └── common/
│   ├── web/                    # React + Vite (porta 80)
│   │   └── src/
│   │       ├── pages/          # 16 páginas
│   │       ├── components/
│   │       │   └── tournaments/
│   │       │       └── TournamentBracket.tsx   # Componente de chaveamento visual
│   │       ├── store/          # Zustand (auth, game, social)
│   │       ├── lib/
│   │       │   ├── api.ts
│   │       │   ├── socket.ts           # /game namespace
│   │       │   └── tournament-socket.ts # /tournament namespace
│   │       └── styles/
│   └── admin/                  # Painel administrativo (React + Vite + MUI)
└── cypress/
```

### Tecnologias

| Camada | Tecnologia | Versão |
|---|---|---|
| Backend | NestJS | 10.x |
| ORM | TypeORM | 0.3.20 |
| Banco | PostgreSQL | 16 |
| Cache/Filas | Redis | 7 |
| Auth | JWT (access 15min) + UUID refresh (7 dias) | — |
| Frontend | React + Vite | 18.x |
| Estado | Zustand | — |
| Chess UI | react-chessboard + chess.js | — |
| Chess AI | Stockfish.js (web worker) | — |
| WebSocket | Socket.IO (2 namespaces: `/game`, `/tournament`) | — |
| Testes E2E | Cypress | — |
| Containerização | Docker + Docker Compose | — |
| Reverse Proxy (prod) | Nginx (dentro do container web/admin) | — |
| SSL + Routing (prod) | Traefik (gerenciado pelo Coolify) | — |
| Hospedagem | Hostinger VPS + Coolify | — |
| Pagamentos | Asaas (PIX) | v3 |
| IA | DeepSeek API (`deepseek-v4-flash`) | — |

---

## 3. Estado Atual do Desenvolvimento

### Concluído
- [x] Monorepo + Docker Compose (dev e prod)
- [x] Backend NestJS com 18 módulos implementados
- [x] Auth (registro, login, refresh token, logout)
- [x] Perfil de usuário (CRUD, upload de avatar, CPF, chave PIX)
- [x] WebSocket Gateway `/game` para partidas em tempo real
- [x] Chess clock server-side (controle de tempo configurável: 1+0, 3+2, 5+0, etc.)
- [x] ELO calculado ao fim de cada partida (K=32)
- [x] Matchmaking (fila de busca por rating próximo)
- [x] Desafio direto entre amigos
- [x] Sistema de amigos (solicitação, aceitar, remover)
- [x] Chat de partida e mensagens privadas
- [x] Notificações em tempo real com ações inline
- [x] Ranking (top 100)
- [x] Reviews de jogadores
- [x] Frontend com 16 páginas completas
- [x] Design system implementado (tema escuro, DM Sans)
- [x] GamePage completo (promoção, preview, forfeit, chat, chess clock)
- [x] OfflineGamePage: jogo contra Stockfish com detecção completa de empate
- [x] Módulo Wallet ($CC — depósito e saque PIX)
- [x] Módulo Asaas (cliente HTTP com retry, QR Code PIX)
- [x] Módulo Webhooks (callbacks do Asaas)
- [x] **Sistema de torneios completo** (ver seção 6)
- [x] Deploy configurado na Coolify
- [x] DeepSeek integrado (análise antifraude pós-torneio)

### Em desenvolvimento / Pendente
- [ ] Painel administrativo `apps/admin/` (especificação existe)
- [ ] Módulos admin no backend (dashboard, users, transactions, etc.)
- [ ] Sistema de tickets de suporte
- [ ] Denúncia de partida (anti-cheat por ação do usuário)
- [ ] Desabilitar `synchronize: true` e usar migrations explícitas em prod
- [ ] Swap no servidor VPS (evitar OOM)
- [ ] App mobile React Native (futuro)

---

## 4. Backend — O que está implementado

### Entidades TypeORM (`apps/api/src/entities/`)

| Entidade | Tabela | Destaques |
|---|---|---|
| `User` | `users` | rating ELO (default 1200), isOnline, avatarUrl, bio, cpf, billingName, pixKey, pixKeyType, asaasCustomerId |
| `RefreshToken` | `refresh_tokens` | token UUID, expiresAt |
| `Match` | `matches` | fen, pgn, moves (jsonb), enums MatchStatus/MatchResult |
| `Friendship` | `friendships` | enum: PENDING/ACCEPTED/BLOCKED |
| `Message` | `messages` | chat privado entre amigos |
| `MatchChatMessage` | `match_chat_messages` | chat dentro da partida |
| `Notification` | `notifications` | type + payload jsonb |
| `Review` | `reviews` | unique(reviewerId, matchId) |
| `Wallet` | `wallets` | userId (unique), balance (decimal) |
| `WalletTransaction` | `wallet_transactions` | type, amount, balanceAfter, referenceId, description |
| `Deposit` | `deposits` | valueBrl, valueCc, asaasPaymentId, qrCode, status |
| `Withdrawal` | `withdrawals` | valueCc, valueBrl, fee, pixKey, asaasTransferId, status |
| `Tournament` | `tournaments` | type, status, bracketData (jsonb), entryFee, prize, rake, championId, secondPlaceId, thirdPlaceId, aiFraudStatus |
| `TournamentParticipant` | `tournament_participants` | status (REGISTERED/ACTIVE/ELIMINATED/CHAMPION/SECOND/THIRD/KICKED), bracketPosition, prizeWon |
| `TournamentMatch` | `tournament_matches` | phase, roundNumber, bracketId, timeControl, clockWhiteMs, clockBlackMs, moveTimestamps (jsonb), tiebreakResult |
| `AiUsageLog` | `ai_usage_logs` | feature, tokens, latencyMs, cached |
| `AdminUser` | `admin_users` | nickname, passwordHash, role, mfaSecret |
| `AdminAuditLog` | `admin_audit_logs` | adminId, action, targetId, before/after |

### MatchResult enum (todos os 7 valores)
```typescript
WHITE_WINS | BLACK_WINS | DRAW | FORFEIT_WHITE | FORFEIT_BLACK | TIMEOUT_WHITE | TIMEOUT_BLACK
```

### WebSocket — `/game` namespace (`game.gateway.ts`)

| Evento | Direção | Descrição |
|---|---|---|
| `join_game` | client→server | Entra na sala; inicia chess clock; detecta se é partida de torneio |
| `move` | client→server | Valida turno; atualiza chess clock; propaga lance |
| `move_broadcast` | server→clients | Novo FEN/PGN/turn após lance válido |
| `clock_update` | server→clients | Emitido a cada segundo; contém `whiteClock`, `blackClock` em ms |
| `game_over` | server→clients | `result` + `reason` quando o tempo acaba |
| `game_over_client` | client→server | Xeque-mate detectado pelo chess.js no frontend |
| `forfeit` | client→server | Desistência |
| `chat_message` | bidirecional | Chat da partida |
| `join_social` | client→server | Entra na sala social; recebe `friends_status` (DB+socket híbrido) |
| `user_online/offline` | server→clients | Presença em tempo real |
| `match_found` | server→client | Partida de torneio encontrada: `{ matchId, color, match: {whitePlayer, blackPlayer} }` |
| `tournament_match_over` | server→client | Partida de torneio encerrada: `{ tournamentId }` → redireciona ao lobby |

**Detalhe crítico — `join_social` (hibridização DB + socket):**
```typescript
// Combina status do socket em memória COM flag isOnline do banco
const socketOnline = friendIds.filter(id => this.userSockets.has(id));
const dbOnline = await this.usersRepo.find({ where: { id: In(friendIds), isOnline: true }, select: ['id'] });
const onlineSet = new Set([...socketOnline, ...dbOnline.map(u => u.id)]);
client.emit('friends_status', { onlineIds: [...onlineSet] });
```
Isso garante que usuários que conectaram antes de serem adicionados como amigos ainda apareçam online.

### WebSocket — `/tournament` namespace (`tournament.gateway.ts`)

| Evento | Direção | Descrição |
|---|---|---|
| `join_tournament_room` | client→server | Entra na sala; recebe `tournament_state` atual |
| `leave_tournament_room` | client→server | Sai da sala |
| `tournament_state` | server→client | Estado completo ao entrar na sala |
| `bracket_update` | server→room | Bracket atualizado após partida encerrar |
| `room_update` | server→room | Jogador entrou/saiu/foi expulso |
| `next_round_countdown` | server→room | `{ seconds: 30 }` emitido antes do delay entre rodadas |
| `tournament_finished` | server→room | `{ tournament }` com dados completos ao finalizar |
| `subscribe_tournament_list` | client→server | Entra na sala pública de listagem |
| `list_update` | server→room | CREATED/UPDATED/STARTED/CANCELLED/FINISHED |

### Módulos Backend

**Auth, Users, Matches, Friends, Messages, Notifications, Ranking, Reviews** — CRUD completo implementado.

**Wallet** (`/api/v1/wallet`)
- `GET /` — saldo atual em $CC
- `GET /transactions?page&limit` — extrato completo paginado (todas as movimentações CC)
- `GET /deposits?page&limit` — histórico de depósitos PIX
- `POST /deposit` — gera QR Code PIX via Asaas
- `DELETE /deposit/:id` — cancela depósito pendente
- `POST /withdraw` — solicita saque PIX

**Tournaments** (`/api/v1/tournaments`) — ver seção 6 completa.

**DeepSeek** (`deepseek.service.ts`)
- Wrapper em cima do SDK OpenAI apontando para `api.deepseek.com`
- Registra uso em `ai_usage_logs` (tokens, latência, se foi cacheado)
- Usado no `TournamentsService` para análise antifraude pós-torneio

---

## 5. Frontend — O que está implementado

### Páginas (`apps/web/src/pages/`)

| Arquivo | Rota | Descrição |
|---|---|---|
| `LoginPage.tsx` | `/` | Login |
| `RegisterPage.tsx` | `/register` | Cadastro |
| `LobbyPage.tsx` | `/lobby` | Buscar partida, amigos online, desafios recebidos |
| `GamePage.tsx` | `/game/:id` | Tabuleiro online: chess clock, chat, forfeit, promoção, redirect pós-torneio |
| `OfflineSetupPage.tsx` | `/play/offline` | Config de partida offline |
| `OfflineGamePage.tsx` | `/play/offline/game` | Jogo contra Stockfish |
| `ProfilePage.tsx` | `/profile/:nickname` | Perfil público |
| `EditProfilePage.tsx` | `/profile/me` | Editar perfil (CPF, PIX, avatar) |
| `FriendsPage.tsx` | `/friends` | Amigos + chat privado |
| `NotificationsPage.tsx` | `/notifications` | Notificações com ações inline |
| `RankingPage.tsx` | `/ranking` | Top 100 |
| `HistoryPage.tsx` | `/history` | Histórico de partidas |
| `WalletPage.tsx` | `/wallet` | Depositar, Sacar, Extrato PIX, **Histórico CC** |
| `TournamentsPage.tsx` | `/tournaments` | Listagem com filtros e atualizações em tempo real |
| `TournamentLobbyPage.tsx` | `/tournaments/:id` | Bracket ao vivo, sala de espera, countdown entre rodadas |
| `SupportPage.tsx` | `/support` | Tickets de suporte (UI) |
| `TicketDetailPage.tsx` | `/support/:id` | Detalhe de ticket |

### `App.tsx` — `SocialSocketManager`

Componente global que gerencia eventos de socket de presença, notificações e partidas. Pontos críticos:

- **Depende de `userId` (string), não do objeto `user`** — evita re-renders desnecessários que limpam `onlineIds`
- **Todos os handlers são referências nomeadas** (`const onMatchFound = ...`) — `socket.off('event', handler)` remove apenas o listener específico, sem interferir com handlers de outros componentes
- **Redireciona `match_found` de torneio de qualquer página** — funciona mesmo se o usuário não estiver no `TournamentLobbyPage`
- **Toca efeito sonoro (Web Audio API)** ao receber `match_found` de torneio (C5→E5→G5)

### `GamePage.tsx` — recursos implementados
- Chess clock com `whiteClock`/`blackClock` em ms (atualizado via `clock_update`)
- Modal de promoção overlay fixo centralizado
- Preview de movimentos (casas verdes = disponíveis, âmbar = capturas)
- Modal de desistência com confirmação
- Feedback visual de xeque
- **Ao receber `tournament_match_over`**: exibe countdown de 8s e redireciona para `/tournaments/:id`; permite ir imediatamente pelo botão

### `WalletPage.tsx` — abas
- **Depositar**: gerar QR Code PIX via Asaas
- **Sacar**: transferência PIX
- **Extrato PIX**: histórico de depósitos com expansão do QR para pendentes
- **Histórico CC**: todas as movimentações de Chess Coins (entradas, taxas, prêmios, reservas, reembolsos) com ícone, descrição, data e saldo após

### Sockets no frontend

| Arquivo | Namespace | Propósito |
|---|---|---|
| `lib/socket.ts` → `getGameSocket()` | `/game` | Partidas, presença, matchmaking |
| `lib/tournament-socket.ts` → `getTournamentSocket()` | `/tournament` | Sala de torneio, bracket |

Ambos conectam com `path: '/socket.io'` relativo — funciona em dev e prod sem hardcode de URL.

### Stores (Zustand)
- `auth.store.ts` — user, loading, fetchMe, login, logout
- `game.store.ts` — `setMatch(matchId, color, whitePlayer, blackPlayer)` inicializa `myColor` + players antes de navegar para `/game/:id`
- `social.store.ts` — challenges (persistido), onlineIds (não persistido), setOnlineFriends, setFriendOnline

**Detalhe crítico do `game.store`:** `setMatch` deve ser chamado ANTES de navegar para `/game/:id`. Se `myColor` for null, o tabuleiro sempre mostra perspectiva branca e nenhum lance passa na validação `myColor !== currentTurn`.

---

## 6. Sistema de Torneios — Arquitetura Completa

### Tipos suportados

| Tipo | Descrição |
|---|---|
| `USER_CREATED` | Torneio criado por jogador (bracket de eliminação simples, 4–64 players, potência de 2) |
| `DUEL_FLASH` | Duelo 1v1 rápido (10 $CC, 3+2) via matchmaking ou convite |
| `DUEL_GIANT` | Duelo 1v1 alto valor (50 $CC, 5+3) via matchmaking ou convite |

### Fluxo de um torneio `USER_CREATED`

```
createCustomTournament → (taxa criação debitada imediatamente)
  ↓
Inscrições abertas (REGISTERING)
  ↓
joinCustomTournament × N jogadores (entry fee verificada, debitada só ao iniciar)
  ↓
Torneio cheio OU criador chama manuallyStartTournament (modo flexível)
  ↓
startCustomTournament → debita entry de todos → gera bracket (seededShuffle) → salva bracketData
  ↓
createRoundMatches(R1) → emite match_found para cada par
  ↓
[cada partida] game.gateway.finalizeGame → tournament_match_over → onMatchFinished
  ↓
finalizeCustomTournamentMatch → advanceBracket → emitBracketUpdate → next_round_countdown(30s)
  ↓
tryAdvanceRound (após 30s) → createRoundMatches(próxima rodada) + createThirdPlaceMatch (se semifinal)
  ↓
[final e 3º encerram] → checkAndFinalizeTournament → runFraudAnalysisWithTimeout(60min SLA)
  ↓
distributeTournamentPrizes → crédito na carteira → tournament_finished emitido
```

### Bracket (`bracketData` — JSONB na entidade `Tournament`)

```typescript
interface TournamentBracket {
  totalRounds: number;
  rounds: BracketRound[];      // R1..Rn na árvore principal
  thirdPlaceMatch: BracketMatch | null;  // null para 4 jogadores
}
interface BracketRound {
  roundNumber: number;
  phase: TournamentPhase;      // QUARTERFINAL/SEMIFINAL/FINAL
  matches: BracketMatch[];
}
interface BracketMatch {
  bracketId: string;           // "R1M0", "R2M1", "THIRD"
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  loserId: string | null;
  matchId: string | null;      // ID da Match real criada
  tiebreakResult: TiebreakResult | null;
}
```

### Regras de desempate em empate
1. **Material no tabuleiro** — quem tem mais peças (P=1, N/B=3, T=5, D=9) vence
2. **Tempo restante no relógio** — quem tem mais tempo vence
3. **Dupla eliminação** — caso extremamente raro; ambos eliminados

### Análise antifraude pós-torneio (DeepSeek)
- SLA de 60 minutos — timeout libera prêmios automaticamente
- Veredito: `CLEAN` → prêmios liberados | `SUSPICIOUS` → liberado com nota | `CHEATING` → prêmios retidos, notificação enviada
- Fallback graceful se DeepSeek indisponível

### Callbacks do `TournamentsService` para emissão WebSocket

O `TournamentsService` não conhece o `TournamentGateway` (evitar dependência circular). Em vez disso, usa callbacks registrados pelo gateway no construtor:

```typescript
tournamentsService.bracketUpdateEmitter   // emite bracket_update na sala
tournamentsService.matchFoundEmitter       // emite match_found via gameGateway.emitToUser
tournamentsService._roomUpdateEmitter      // emite room_update na sala
tournamentsService.nextRoundEmitter        // emite next_round_countdown na sala
tournamentsService.tournamentFinishedEmitter // emite tournament_finished na sala
```

O `TournamentGateway` também tem `@Inject(forwardRef(() => GameGateway))` para acessar `emitToUser`.

### Endpoint de torneios (`/api/v1/tournaments`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Lista torneios públicos (filtros: status, nome, isPublic; ordenação; paginação) |
| POST | `/` | Cria torneio (débita taxa de criação) |
| GET | `/:id` | Detalhes completos (participants com nickname/rating/avatarUrl) |
| POST | `/:id/join` | Inscrever-se |
| DELETE | `/:id/leave` | Sair (só em REGISTERING) |
| POST | `/:id/start` | Iniciar manualmente (criador, modo flexível, min 4 jogadores) |
| DELETE | `/:id` | Cancelar (criador, só em REGISTERING) |
| POST | `/:id/kick` | Expulsar jogador (criador) |
| POST | `/:id/invite/nickname` | Convidar por nickname |
| POST | `/duel/queue` | Entrar na fila de duelo |
| DELETE | `/duel/queue` | Sair da fila |
| POST | `/duel/invite` | Convidar amigo para duelo |
| POST | `/duel/accept` | Aceitar convite de duelo |
| POST | `/duel/decline` | Recusar convite |

### Stagnation cleanup automático
- Intervalo: a cada 30 minutos
- 24h sem novos jogadores → notifica criador
- 48h → cancela automaticamente, notifica participantes

---

## 7. Infraestrutura e Deploy

### Dev local

```bash
docker compose up
```

| Serviço | Porta |
|---------|-------|
| PostgreSQL | 5432 |
| Redis | 6379 |
| API NestJS | 3000 |
| Web (Vite HMR) | 80 |
| Admin (Vite HMR) | 5174 |

### Produção (Coolify)

**Servidor:** Hostinger VPS — IP `72.61.129.87`, 3.8GB RAM, **sem swap**
**Plataforma:** Coolify v4 (self-hosted)
**SSL:** Traefik (Let's Encrypt automático)

**Roteamento:**
```
Internet → Traefik (443) → homologa.megachess.io → container web (porta 80)
```

**Containers NÃO expõem porta 80** — Traefik roteia internamente.

**Variáveis críticas no Coolify:**
- `ASAAS_API_KEY` — marcar **"Is Literal?"** (valor começa com `$aact_`)
- `ASAAS_WEBHOOK_TOKEN` — idem se contiver `$`

### Nginx (`apps/web/nginx.conf`)
- `location /` → React SPA (fallback `index.html`)
- `location /api` → proxy `api:3000`
- `location /socket.io` → proxy WebSocket com `Upgrade` + timeout 3600s
- `location /uploads` → proxy `api:3000`

---

## 8. Modelo de Negócio e Pagamentos

### Moeda virtual: Chess Coins ($CC)
- 1 BRL = 1 $CC (conversão 1:1 no depósito)
- $CC existe apenas no banco de dados — Asaas só processa BRL

### Distribuição de prêmios em torneios USER_CREATED

| Jogadores | 1º lugar | 2º lugar | 3º lugar | Rake |
|---|---|---|---|---|
| 4 | 60% | 40% | — | 10% |
| 8+ | 50% | 35% | 15% | 10% |

**Taxa de criação:** `ceil(entryFee * 0.15)` — debitada imediatamente, não reembolsável.

### Gateway: Asaas (implementado)
- Depósito: `POST /payments` → QR Code PIX → webhook `PAYMENT_RECEIVED` → credita $CC
- Saque: `POST /transfers` → webhook `TRANSFER_DONE`/`TRANSFER_FAILED`
- Validação webhook: header `asaas-access-token` vs `ASAAS_WEBHOOK_TOKEN`
- Retry automático: 3 tentativas, exponential backoff (5xx/429)
- `ASAAS_ENV=sandbox` → `api-sandbox.asaas.com` | `production` → `api.asaas.com`

---

## 9. Decisões Técnicas Importantes

### TypeORM em vez de Prisma
Prisma removido por problemas com binários no Windows. TypeORM com `synchronize: true` em dev. **Em produção futura: desabilitar e usar migrations explícitas.**

### Dois namespaces Socket.IO separados
`/game` para partidas e presença social, `/tournament` para gerenciamento de torneio. Separação de responsabilidades — evita que eventos de torneio poluam o namespace de jogo.

### Circular dependency: `GameModule` ↔ `TournamentsModule`
`GameGateway` precisa de `TournamentsService` (para `onMatchFinished`). `TournamentGateway` precisa de `GameGateway` (para `emitToUser`). Resolvido com `forwardRef()` em ambos os lados e `@Inject(forwardRef(() => GameGateway))` no construtor do `TournamentGateway`.

### `bracketUpdateEmitter` (pattern callback no service)
`TournamentsService` é independente de WebSocket — não importa o gateway. O gateway registra callbacks no service durante a inicialização. Isso permite testar o service em isolamento e evita dependência circular via módulo.

### `setMatch()` antes de navegar para `/game/:id`
O store `game.store` precisa de `myColor`, `whitePlayer`, `blackPlayer` ANTES da `GamePage` montar. Se `myColor` for null: tabuleiro sempre mostra perspectiva branca e nenhum lance passa a validação. O `SocialSocketManager` em `App.tsx` chama `setMatch()` ao receber `match_found` de torneio antes de `navigate()`.

### Listeners nomeados no Socket.IO
`socket.off('event')` sem referência remove TODOS os listeners daquele evento, incluindo os de outros componentes. Sempre usar `socket.off('event', namedHandler)`. Crítico quando múltiplos componentes (App.tsx + TournamentLobbyPage + LobbyPage) registram `match_found`.

### Online status híbrido (DB + socket)
`handleJoinSocial` combina `userSockets` em memória (real-time) com `usersRepo.find({ isOnline: true })` (fallback para usuários que conectaram antes de qualquer reconexão). Garante consistência mesmo com race conditions no carregamento inicial.

### `SocialSocketManager` depende de `userId` (string), não de `user` (objeto)
`useEffect([user])` re-executa sempre que o objeto `user` muda de referência (ex: após `fetchMe()`), limpando `onlineIds` desnecessariamente. Usando `useAuthStore(state => state.user?.id)` (primitivo string), o effect só re-executa em login/logout real.

### CORS com múltiplas origens (`main.ts`)
```ts
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost').split(',').map(o => o.trim());
```
Permite separar origens por vírgula na variável de ambiente.

### `ASAAS_API_KEY` com flag "Is Literal?" no Coolify
Valor começa com `$aact_hmlg_...` — Coolify interpreta `$` como referência a variável de shell. A flag "Is Literal?" desativa essa interpolação.

### Chess clock server-side
Timer por movimento de 60s existe para partidas regulares (legado). Torneios usam chess clock real: `parseTimeControl("3+2")` → `{ initial: 180_000ms, increment: 2_000ms }`. Clock decrementado no server, incremento adicionado após cada lance.

### DeepSeek: system prompt fixo = cache automático
Tokens de input em cache custam 98% menos. System prompts devem ser constantes no topo da mensagem. Nunca concatenar dados dinâmicos no system prompt.

---

## 10. Bugs Corrigidos

### Sessão anterior (pré-2026-06-26)

| Bug | Causa | Solução |
|---|---|---|
| Reload infinito no frontend | `window.location.href = '/'` no handler 401 | Removido redirect; `fetchMe` verifica token antes de chamar API |
| Forfeit/timeout mostrando "Derrota" para ambos | Frontend verificava apenas `WHITE_WINS`/`BLACK_WINS` | `getMyOutcome()` cobre todos os 7 valores de `MatchResult` |
| `port is already allocated` no Coolify | `ports: - "80:80"` conflitando com Traefik | Removida seção `ports` do `docker-compose.prod.yml` |
| Upload de avatar falhando | `api.ts` enviava `Content-Type: application/json` em FormData | Detecção via `instanceof FormData`; Content-Type omitido |
| Desafio some ao recarregar | `social.store` só em memória | Zustand `persist` + `onRehydrateStorage` filtra expirados |
| `ASAAS_API_KEY` chegando vazio | Var não estava no `environment` do `api` no compose prod | Adicionadas as 3 vars Asaas ao `docker-compose.prod.yml` |
| `ASAAS_API_KEY` ainda vazia após fix | Valor começa com `$aact_` | Marcar "Is Literal?" no Coolify |
| Modal de promoção bugando UI | Modal renderizado in-place próximo à peça | Refeito como `position: fixed` centralizado |
| Empate sem motivo exibido (offline) | Checklist de empate incompleto | Checklist completo: stalemate → threefold → insufficient → draw |

### Sessão 2026-06-26 — Sistema de Torneios

| Bug | Causa | Solução |
|---|---|---|
| `TypeError: Cannot read properties of null (reading 'to')` no gateway | `this.server` null no construtor antes do WS adapter inicializar | Optional chaining em todos os `this.server?.to(...)` |
| 404 em `POST /tournaments/:id/start` | Rota não existia | Adicionado `manuallyStartTournament` + rota no controller |
| Peças não movem na partida de torneio | `setMatch()` nunca chamado → `myColor` null → validação bloqueia tudo | `match_found` agora envia `color + match` completo; frontend chama `setMatch()` antes de navegar |
| Perspectiva errada (ambos veem branco) | Mesmo causa: `myColor` null → `boardOrientation` sempre 'white' | Mesma solução |
| Nomes não exibidos na partida | Relações `whitePlayer`/`blackPlayer` não carregadas em `createMatch` | Buscamos os usuários separadamente com `users.findOne` antes de `emitMatchFound` |
| Jogador fora do lobby não redirecionado à partida | `socket.off('match_found')` sem referência removia TODOS os listeners | Handlers nomeados; `SocialSocketManager` global captura torneio de qualquer página |
| Contador de jogadores errado na listagem | `leftJoin + addSelect` não hidrata relações | Mudado para `leftJoinAndSelect` |
| Bracket mostrando IDs em vez de nicknames | `getTournamentDetails` retornava entidade bruta | Transformado para mapear `p.user?.nickname` no nível raiz |
| `tryAdvanceRound` nunca avança além da R1 | Loop iterava partindo da R1 (já concluída) → encontrava R2 com matchIds → `readyMatches = []` → `return` | Agora encontra a rodada ativa mais recente (maior R com algum `matchId`) |
| 3º lugar nunca criado | `createFinalAndThirdPlace` nunca era atingido (decorrência do bug acima) | Separado em `createThirdPlaceMatch()`; chamado junto com a criação da final quando as semis terminam |
| Prêmios distribuídos duas vezes | `checkAndFinalizeTournament` chamado tanto ao fim da FINAL quanto ao fim do THIRD_PLACE | Guard: `if (tournament.status !== IN_PROGRESS) return` |
| Status do torneio não atualiza automaticamente | `tournament_finished` não era emitido | `distributeTournamentPrizes` emite `tournament_finished` com dados completos |
| Bracket não atualiza para observadores ao retornar | `tournament_state` era emitido ao entrar na sala mas não havia handler no frontend | Adicionado `onTournamentState` handler em `TournamentLobbyPage` |
| Online status inconsistente | Race condition + `user` object como dep do effect → cleanup limpa `onlineIds` | Dep mudada para `userId`; join_social usa DB+socket híbrido |

### Sessão 2026-06-27 (parte 1) — Real-time Lobby + Sons + Correções

**Features implementadas:**

1. **Lista de participantes em tempo real** (`TournamentLobbyPage`): WebSocket `room_update` propaga lista atualizada para todos na sala. Backend emite `emitRoomUpdateWithParticipants` via `setImmediate` em join/leave/kick — não bloqueia resposta HTTP. Frontend atualiza `participants` diretamente pelo payload do socket sem re-fetch.

2. **Modal de confirmação de saída + auto-leave** (`TournamentLobbyPage`): Botão "Sair" abre modal de confirmação inline. Ao navegar para fora, unmount do componente chama `api.delete(/tournaments/:id/leave)` silenciosamente via ref `isParticipantRegisteringRef`. `beforeunload` também dispara o leave. `useBlocker` foi removido — app usa `BrowserRouter` que não suporta a API.

3. **Sons no jogo** (`useSound.ts` + `GamePage.tsx`): Hook `useSound` com Web Audio API programática (sem assets externos). 7 sons: `move`, `capture`, `check`, `gameStart`, `countdown`, `victory`, `defeat`. Mute persistido em `localStorage` (`chess_muted`). Botão mute ao lado do forfeit na `GamePage`. `mutedRef` evita stale closure no callback estável `play`.

4. **`listUpdateEmitter`** (`tournament.gateway.ts` + `tournaments.service.ts`): Callback registrado pelo gateway no service para notificar a sala `tournament_list` quando o número de jogadores muda. Frontend (`TournamentsPage`) sempre faz re-fetch completo ao receber `list_update` (garante `isUserJoined` correto por usuário).

5. **Limite de jogadores por torneio**: `ALLOWED_PLAYER_COUNTS = [4, 8]` (era `[4, 8, 16, 32, 64]`). Frontend (`CreateTournamentModal`) atualizado para refletir mesma limitação.

**Bugs corrigidos nesta sessão:**

| Bug | Causa | Solução |
|---|---|---|
| `useBlocker` crash | App usa `BrowserRouter`, não `createBrowserRouter` | Removido `useBlocker`; mantido modal de botão + auto-leave no unmount |
| `sock.once('connect', joinRoom)` consumido na reconexão | `once` já havia disparado; socket perde salas ao reconectar | Mudado para `sock.on('connect', joinRoom)` + chamada imediata se já conectado |
| `doAction` não atualiza UI em caso de erro | `load()` só era chamado no bloco de sucesso | Movido `load()` para o `finally` — sempre re-sincroniza estado |
| `isUserJoined` stale na listagem após sair do lobby | `list_update` só emitido no início/fim do torneio | `listUpdateEmitter` chamado em join/leave/kick; frontend sempre re-fetcha |
| Usuário expulso (KICKED) não conseguia re-entrar | `alreadyIn` incluía status KICKED na verificação | Excluído KICKED (e LEFT) da verificação; registro stale removido antes de novo join |
| Status `LEFT` causava 400 para usuários com registro legado no DB | Enum `ParticipantStatus` tinha `LEFT` removido; TypeORM lia 'LEFT' do DB → `alreadyIn = true` | Re-adicionado `LEFT = 'LEFT'` ao enum; adicionado a `REMOVABLE_STATUSES` |
| Dois botões redundantes na listagem ("Ver" + "Lobby") | Lógica antiga preservava botão "Ver" para usuários já inscritos | Simplificado: usuário inscrito → "Lobby"; não inscrito → "Entrar" (ou desabilitado se lotado) |

### Sessão 2026-06-27 (parte 2) — Desabilitação do Módulo de Torneios

**Decisão:** Módulo de torneios customizados desabilitado temporariamente até estar pronto para produção. Duelos 1v1 (flash e gigante) continuam funcionando normalmente.

**O que foi feito:**

| Arquivo | Mudança |
|---|---|
| `apps/api/src/tournaments/tournaments.controller.ts` | Método privado `assertTournamentsEnabled()` lança `ServiceUnavailableException` (HTTP 503) com mensagem "Módulo de torneios em implementação. Em breve disponível!". As 13 rotas de torneio customizado chamam esse método. As 5 rotas de duelo (`duel/queue`, `duel/queue/leave`, `duel/invite`, `duel/:id/accept`, `duel/:id/decline`) não foram alteradas. |
| `apps/web/src/pages/TournamentsPage.tsx` | Aba "Torneios" exibe `TournamentsComingSoonPanel` — banner visual com descrição das features planejadas e badge "Em desenvolvimento". Sem nenhuma chamada à API. Imports não utilizados removidos (`getTournamentSocket`, `useAuthStore`, `CreateTournamentModal`, tipos `CustomTournament`, funções `formatTimeControl`/`Chip`). |
| `apps/web/src/App.tsx` | Rota `/tournaments/:id` redireciona para `/tournaments` via `<Navigate to="/tournaments" replace />` — impede acesso direto ao lobby de qualquer torneio. |

**Estado atual da navegação de competições:**
- Aba "Competições" na nav: visível, funcional
- Aba "Duelo 1v1" em `/tournaments`: 100% funcional (matchmaking + convite de amigo)
- Aba "Torneios" em `/tournaments`: exibe banner "em breve"
- URL `/tournaments/:id`: redireciona para `/tournaments`
- API `POST /tournaments`, `GET /tournaments`, etc.: retorna 503
- API `POST /tournaments/duel/queue`, etc.: funciona normalmente

---

## 11. O que ainda NÃO está implementado

### Painel administrativo (`apps/admin/`)
Especificação completa existia em `ADMIN_PANEL.md` (arquivo removido do git working tree — conteúdo está no histórico de commits). Módulos necessários:

**Backend:**
- `admin/auth` — login, JWT e MFA (TOTP) para `AdminUser`
- `admin/dashboard` — KPIs (jogadores, transações, torneios)
- `admin/users` — listagem, detalhe, ban, ajuste de saldo
- `admin/transactions` — aprovação de saques, reembolsos
- `admin/tournaments` — cancelamento forçado, reembolso
- `admin/support` — tickets
- `admin/maintenance` — modo manutenção via `platform_config`
- `admin/staff` — gestão de admins

**Frontend:**
- App React separado em `apps/admin/` (Vite + MUI + Recharts + TanStack Table)
- Tema Mega Chess via `createTheme()`

### Features de produto pendentes
- Sistema de denúncia de partida (anti-cheat por ação do usuário)
- Tickets de suporte (backend: módulo `support`)
- Espectador / transmissão de partidas ao vivo
- App mobile React Native

### Hardening técnico
- Migrations TypeORM explícitas (substituir `synchronize: true`)
- Swap no servidor VPS (evitar OOM em builds: `fallocate -l 2G /swapfile`)
- Expandir cobertura de testes Cypress para torneios

---

## 12. Próximas Features Planejadas

### Prioridade 1 — Painel Admin (MVP)
1. Criar `apps/admin/` com Vite + React + MUI
2. Login/auth com JWT separado (`ADMIN_JWT_SECRET`)
3. Dashboard KPIs básicos
4. Listagem e moderação de usuários
5. Aprovação de saques
6. Tickets de suporte

### Prioridade 2 — Anti-cheat
1. Sistema de denúncia de partida pelo usuário
2. Análise assíncrona via DeepSeek (Stockfish → centipawn loss → veredicto)
3. Fila de revisão manual no admin

### Prioridade 3 — Hardening
1. Migrations TypeORM explícitas
2. Swap no servidor VPS
3. Testes Cypress para torneios (criar, entrar, iniciar, jogar, finalizar)
4. Modo de manutenção

---

## 13. Variáveis de Ambiente

### Dev (`docker-compose.yml`)

```env
DATABASE_URL=postgresql://chess:chess_secret@db:5432/megachess
REDIS_URL=redis://redis:6379
JWT_SECRET=megachess_jwt_secret_change_in_prod
JWT_REFRESH_SECRET=megachess_refresh_secret_change_in_prod
ADMIN_JWT_SECRET=megachess_admin_jwt_secret_change_in_prod
PORT=3000
CORS_ORIGIN=http://localhost,http://localhost:5174
DEEPSEEK_API_KEY=          # deixar vazio em dev
ASAAS_API_KEY=             # preencher para testar pagamentos
ASAAS_WEBHOOK_TOKEN=       # preencher para testar webhooks
ASAAS_ENV=sandbox
```

### Prod (Coolify)

| Variável | Obrigatória | Observação |
|----------|-------------|-----------|
| `POSTGRES_PASSWORD` | ✅ | Senha forte |
| `JWT_SECRET` | ✅ | String aleatória longa |
| `JWT_REFRESH_SECRET` | ✅ | String aleatória longa |
| `ADMIN_JWT_SECRET` | ✅ (ao implementar admin) | Secret separado |
| `ASAAS_API_KEY` | ✅ | **Marcar "Is Literal?"** — começa com `$aact_` |
| `ASAAS_WEBHOOK_TOKEN` | ✅ | Marcar "Is Literal?" se contiver `$` |
| `ASAAS_ENV` | ✅ | `sandbox` ou `production` |
| `DEEPSEEK_API_KEY` | ✅ (análise antifraude) | Marcar "Is Literal?" |
| `CORS_ORIGIN` | ✅ | Ex: `https://megachess.io,https://homologa.megachess.io` |

---

## 14. Como rodar localmente

### Pré-requisitos
- Docker Desktop rodando

### Subir tudo
```bash
cd D:\Claude\mega-chess
docker compose up
```

| URL | Serviço |
|-----|---------|
| `http://localhost` | Frontend Web |
| `http://localhost:5174` | Painel Admin |
| `http://localhost:3000` | API NestJS |

### Comandos úteis
```bash
docker compose up --build api     # rebuild backend
docker compose up --build web     # rebuild frontend
docker compose logs -f api        # logs da API
docker compose logs -f web        # logs do Vite

# TypeScript check sem build
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit

# Cypress
npx cypress open
npx cypress run
npx cypress install --force      # se "No version installed"
```

---

## 15. Histórico de Sessões

Registro cronológico das sessões de desenvolvimento para rastreabilidade de decisões.

### 2026-06-26 — Sistema de Torneios (sessão inicial)

**Objetivo:** Implementar sistema completo de torneios USER_CREATED + duelos 1v1.

**Entregues:**
- Entidade `Tournament`, `TournamentParticipant`, `TournamentMatch` com TypeORM
- `TournamentsService`: fluxo completo (criação → inscrição → início → bracket → rodadas → prêmios → antifraude)
- `TournamentGateway`: namespace `/tournament` com 8 eventos WebSocket
- `TournamentsController`: 13 endpoints de torneio + 5 de duelo
- Frontend: `TournamentsPage` (listagem), `TournamentLobbyPage` (lobby + bracket), `CreateTournamentModal`, `TournamentBracket`
- 14 bugs corrigidos (ver seção 10)

**Decisões tomadas:**
- Callbacks (`bracketUpdateEmitter`, etc.) em vez de injeção direta do gateway no service — evita dependência circular
- `setMatch()` antes de `navigate()` para garantir `myColor` válido na `GamePage`
- Handlers nomeados no Socket.IO para `socket.off()` seletivo

---

### 2026-06-27 (parte 1) — Real-time + Sons + Bugfixes

**Objetivo:** 5 features de tempo real solicitadas pelo usuário.

**Entregues:**
- Real-time de participantes via `room_update` + `emitRoomUpdateWithParticipants`
- Modal de confirmação de saída + auto-leave no unmount (`isParticipantRegisteringRef`)
- Hook `useSound` (Web Audio API, 7 sons, mute persistido)
- Sons na `GamePage` (move, capture, check, gameStart, victory, defeat) + botão mute
- `listUpdateEmitter` para sincronizar contador da listagem em tempo real
- Limite de torneio reduzido para max 8 jogadores (`ALLOWED_PLAYER_COUNTS = [4, 8]`)
- 7 bugs adicionais corrigidos

**Decisões tomadas:**
- `useBlocker` removido (incompatível com `BrowserRouter`) — auto-leave substitui o bloqueio de navegação
- `sock.on('connect', joinRoom)` em vez de `sock.once` — suporta reconexões
- `doAction` com `load()` no `finally` — UI sempre sincronizada independente de erro
- Re-fetch completo da listagem ao receber `list_update` — garante `isUserJoined` correto por usuário

---

### 2026-06-27 (parte 2) — Desabilitação do Módulo de Torneios

**Objetivo:** Desabilitar torneios customizados na UI e na API enquanto não estão prontos para produção, mantendo duelos operacionais.

**Entregues:**
- Backend: `assertTournamentsEnabled()` retorna 503 em todas as 13 rotas de torneio customizado
- Frontend: aba "Torneios" substituída por banner "Em desenvolvimento"
- Rota `/tournaments/:id` redireciona para `/tournaments`

**Motivação:** Módulo funcionando em dev mas com muitas arestas — preferência do usuário por lançar duelos primeiro e torneios quando mais polido.

**Para reativar torneios:**
1. Remover chamadas a `assertTournamentsEnabled()` no controller (ou remover o método)
2. Substituir `TournamentsComingSoonPanel` por `CustomTournamentsPanel` na `TournamentsPage`
3. Restaurar rota `/tournaments/:id` → `TournamentLobbyPage` no `App.tsx`

---

### 2026-06-28 (parte 1) — Matchmaking de Duelos + Indicadores de Fila

**Objetivo:** Corrigir fila de duelos (não emparelhava jogadores) e adicionar indicadores de população nas filas.

#### Refatoração do Matchmaking (`MatchmakingService`)

O fluxo de duelos foi completamente reescrito e separado dos torneios:

- **Fila casual** (`casualQueue: QueueEntry[]`): array único em memória, sem pré-requisito de saldo
- **Filas de duelo** (`duelQueues: Map<"${type}:${fee}", QueueEntry[]>`): uma fila por combinação de tipo+fee; requer `assertBalance` antes de entrar
- **Sentinel `userDuelQueueKey`**: `Map<userId, key>` onde `''` indica que o usuário está "entrando" (entre o sentinel e o push na fila) — previne double-join mesmo com `await` no meio
- `GET /matchmaking/sizes` retorna `{ casual: N, duel: { "DUEL_FLASH:6": N, ... } }` — usado pelo frontend para indicadores de população

**Rotas movidas de `TournamentsController` para `MatchmakingController`:**
- `POST /matchmaking/duel/queue` (era `POST /tournaments/duel/queue`)
- `DELETE /matchmaking/duel/queue` (era `POST /tournaments/duel/queue/leave`)

`TournamentsService` manteve apenas o fluxo de **convite direto** (`inviteFriend`, `acceptDuelInvite`, `declineDuelInvite`, `cancelDuelInvite`).

#### Bugs corrigidos nesta sessão

| Bug | Causa | Solução |
|---|---|---|
| Fila de duelo nunca emparelhava jogadores | Dois `await`s antes do bloco síncrono; saldo insuficiente lançava exceção silenciosamente | Adicionado logging extensivo com `Logger`; sentinel set antes do primeiro `await`; try/catch com log de stack |
| Segundo jogador não navegava para a partida | `socket.off('match_found')` sem referência em `LobbyPage.tsx:56` removia **todos** os listeners, inclusive o do `SocialSocketManager` | Handler nomeado `onMatchFound` passado explicitamente para `socket.off('match_found', onMatchFound)` |
| Dialog de promoção duplo (nativo da lib + modal customizado) | `react-chessboard` exibia seu próprio dialog de promoção antes do modal customizado | `onPromotionCheck={() => false}` na `Chessboard` — desabilita o dialog nativo da biblioteca |

#### Indicadores de população de fila

`GET /matchmaking/sizes` — retorna tamanho de todas as filas ativas, sem custo (in-memory). Polling a cada 10s nos componentes.

| Cor | Critério |
|---|---|
| Vermelho | ≤ 2 jogadores |
| Amarelo | 3–8 jogadores |
| Verde | > 8 jogadores |

**`LobbyPage`** (fila casual): indicador abaixo do botão "Jogar agora" — `● N jogadores na fila · Atividade Baixa/Média/Alta`.

**`TournamentsPage`** (duelos):
- Seletor de **tipo** (Flash/Gigante): soma de todos os fees daquele tipo
- Seletor de **fee** (6/10/20 CC): count exato do par `tipo:fee` selecionado — atualiza automaticamente ao mudar o tipo

---

### 2026-06-28 (parte 2) — Sons na IA + Fix Relógio + Delay IA

#### Sons na partida contra IA (`OfflineGamePage.tsx`)

Hook `useSound` adicionado com os mesmos sons da partida online:
- Mount da página: `gameStart`
- Lance do jogador: `move` ou `capture` (via `move.captured != null`) + `check` se aplicável
- Lance da IA: mesma lógica (detectado em `triggerAiMove`)
- Fim de partida: `victory` (vitória) ou `defeat` (derrota) — empate sem som
- Botão mute `🔊/🔇` ao lado do botão "Desistir" — estado compartilhado com a partida online via `localStorage` (`chess_muted`)

#### Delay realista da IA

`AI_THINK_MS` aumentado para simular "pensamento" humano:

| Dificuldade | Delay anterior | Delay atual |
|---|---|---|
| Fácil | 400ms | 2000ms |
| Médio | 600ms | 2200ms |
| Difícil | 900ms | 2500ms |

#### Fix: relógio piscando entre partidas

**Causa:** socket permanecia na sala `game:${oldMatchId}` do servidor após o fim da partida. Eventos `clock_update` da partida anterior continuavam chegando no cliente enquanto a nova partida carregava, causando flickering.

**Solução:**
- `game.gateway.ts`: novo handler `@SubscribeMessage('leave_game')` — chama `client.leave('game:${matchId}')` para remover o socket da sala
- `GamePage.tsx`: cleanup do `useEffect` agora emite `socket.emit('leave_game', { matchId })` antes de remover os listeners — garante que o servidor pare de enviar eventos da partida encerrada
