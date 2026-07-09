# Mega Chess — Automated Test Cases

> **Total:** 167 cenários · 101 backend · 66 frontend  
> **Última atualização:** 2026-06-22

---

## Índice

1. [Auth](#1-auth)
2. [Users](#2-users)
3. [Matches](#3-matches)
4. [Matchmaking](#4-matchmaking)
5. [Friends](#5-friends)
6. [Messages](#6-messages)
7. [Game Gateway (WebSocket)](#7-game-gateway-websocket)
8. [Notifications](#8-notifications)
9. [Ranking](#9-ranking)
10. [Reviews](#10-reviews)
11. [Frontend — Login / Register](#11-frontend--login--register)
12. [Frontend — Lobby](#12-frontend--lobby)
13. [Frontend — Game](#13-frontend--game)
14. [Frontend — Perfil e Edição](#14-frontend--perfil-e-edição)
15. [Frontend — Friends](#15-frontend--friends)
16. [Frontend — Ranking e Histórico](#16-frontend--ranking-e-histórico)
17. [Frontend — Notifications](#17-frontend--notifications)
18. [Frontend — Modo Offline (IA)](#18-frontend--modo-offline-ia)

---

## Legenda de Status

| Ícone | Significado |
|-------|-------------|
| ⬜ | Não implementado |
| 🔄 | Em progresso |
| ✅ | Implementado e passando |
| ❌ | Implementado e falhando |

---

## 1. Auth

**Arquivo sugerido:** `apps/api/src/auth/auth.service.spec.ts`  
**Endpoint base:** `POST /api/v1/auth`

---

### TC-001 — Registro com dados válidos retorna access e refresh token
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/auth/register`
- **Input:**
  ```json
  {
    "email": "user@test.com",
    "name": "Test User",
    "nickname": "testuser",
    "password": "senha123"
  }
  ```
- **Resultado esperado:**
  - HTTP 201
  - Body contém `accessToken` (string) e `refreshToken` (string)
  - `accessToken` decodificado possui `sub` = userId
  - Usuário criado no banco com `rating = 1200` e `isOnline = false`
  - `passwordHash` nunca exposto na resposta

---

### TC-002 — Registro com email já existente retorna 409
- **Status:** ⬜
- **Tipo:** Edge case
- **Endpoint:** `POST /api/v1/auth/register`
- **Pré-condição:** Usuário com `email@test.com` já cadastrado
- **Input:** mesmo email, nickname diferente
- **Resultado esperado:**
  - HTTP 409 ConflictException
  - Mensagem de erro indicando conflito de email

---

### TC-003 — Registro com nickname já existente retorna 409
- **Status:** ⬜
- **Tipo:** Edge case
- **Endpoint:** `POST /api/v1/auth/register`
- **Pré-condição:** Usuário com nickname `testuser` já cadastrado
- **Input:** email diferente, mesmo nickname
- **Resultado esperado:**
  - HTTP 409 ConflictException

---

### TC-004 — Registro com email inválido retorna 400
- **Status:** ⬜
- **Tipo:** Validação
- **Endpoint:** `POST /api/v1/auth/register`
- **Input:** `"email": "nao-e-email"`
- **Resultado esperado:**
  - HTTP 400 BadRequest
  - Mensagem de validação para o campo `email`

---

### TC-005 — Registro com nickname contendo caracteres especiais retorna 400
- **Status:** ⬜
- **Tipo:** Validação
- **Endpoint:** `POST /api/v1/auth/register`
- **Input:** `"nickname": "user@name!"` (não bate com `^[a-zA-Z0-9_]+$`)
- **Resultado esperado:**
  - HTTP 400 BadRequest

---

### TC-006 — Registro com nickname fora do tamanho permitido retorna 400
- **Status:** ⬜
- **Tipo:** Validação
- **Casos:**
  - nickname com 2 chars (< mínimo 3)
  - nickname com 21 chars (> máximo 20)
- **Resultado esperado:**
  - HTTP 400 BadRequest para ambos os casos

---

### TC-007 — Registro com senha menor que 6 caracteres retorna 400
- **Status:** ⬜
- **Tipo:** Validação
- **Input:** `"password": "12345"`
- **Resultado esperado:**
  - HTTP 400 BadRequest

---

### TC-008 — Login com credenciais corretas retorna access e refresh token
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/auth/login`
- **Input:**
  ```json
  { "email": "user@test.com", "password": "senha123" }
  ```
- **Resultado esperado:**
  - HTTP 200
  - Body com `accessToken` e `refreshToken`
  - `refreshToken` salvo no banco com `expiresAt` ~7 dias à frente

---

### TC-009 — Login com email inexistente retorna 401
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** email não cadastrado
- **Resultado esperado:**
  - HTTP 401 UnauthorizedException
  - Mensagem genérica (não indica se é email ou senha)

---

### TC-010 — Login com senha errada retorna 401
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** email correto, senha errada
- **Resultado esperado:**
  - HTTP 401 UnauthorizedException
  - Mesma mensagem do TC-009 (não revelar qual campo está errado)

---

### TC-011 — Refresh com token válido gera novos tokens e deleta o antigo
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Input:** `{ "refreshToken": "<token_válido>" }`
- **Resultado esperado:**
  - HTTP 200
  - Novo `accessToken` e `refreshToken` retornados
  - Token antigo deletado do banco

---

### TC-012 — Refresh com token inexistente retorna 401
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** token UUID aleatório que não existe no banco
- **Resultado esperado:**
  - HTTP 401 UnauthorizedException

---

### TC-013 — Refresh com token expirado retorna 401
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Token no banco com `expiresAt` no passado
- **Resultado esperado:**
  - HTTP 401 UnauthorizedException

---

### TC-014 — Logout deleta o refresh token do banco
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/auth/logout`
- **Input:** `{ "refreshToken": "<token_válido>" }`
- **Resultado esperado:**
  - HTTP 200
  - Token removido do banco (verificar via query)

---

### TC-015 — Logout com token inexistente não lança erro
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** token que não existe no banco
- **Resultado esperado:**
  - HTTP 200 (silent success)
  - Nenhuma exceção lançada

---

## 2. Users

**Arquivo sugerido:** `apps/api/src/users/users.service.spec.ts`  
**Endpoint base:** `GET|PATCH /api/v1/users`

---

### TC-016 — GET /me retorna usuário sem passwordHash
- **Status:** ⬜
- **Tipo:** Happy path
- **Auth:** Bearer token válido
- **Resultado esperado:**
  - HTTP 200
  - Body contém `id`, `email`, `name`, `nickname`, `avatarUrl`, `bio`, `rating`, `isOnline`, `createdAt`, `updatedAt`
  - Campo `passwordHash` ausente na resposta

---

### TC-017 — GET /me com token inválido retorna 401
- **Status:** ⬜
- **Tipo:** Edge case
- **Auth:** Token malformado ou assinatura incorreta
- **Resultado esperado:** HTTP 401

---

### TC-018 — GET /me com token expirado retorna 401
- **Status:** ⬜
- **Tipo:** Edge case
- **Auth:** Access token com `exp` no passado
- **Resultado esperado:** HTTP 401

---

### TC-019 — GET /users/:nickname retorna perfil público com reviews
- **Status:** ⬜
- **Tipo:** Happy path
- **Auth:** Não requerida
- **Pré-condição:** Usuário com nickname `chess_master` existente, com reviews cadastradas
- **Resultado esperado:**
  - HTTP 200
  - Body com dados do usuário e array `reviewsReceived` populado

---

### TC-020 — GET /users/:nickname com nickname inexistente retorna 404
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** nickname que não existe no banco
- **Resultado esperado:** HTTP 404

---

### TC-021 — PATCH /me atualiza nome e bio
- **Status:** ⬜
- **Tipo:** Happy path
- **Auth:** Bearer token válido
- **Input:** `{ "name": "Novo Nome", "bio": "Nova bio" }`
- **Resultado esperado:**
  - HTTP 200
  - Body com `name` e `bio` atualizados
  - Banco reflete as alterações

---

### TC-022 — PATCH /me com nome composto apenas de espaços é rejeitado
- **Status:** ⬜
- **Tipo:** Validação
- **Input:** `{ "name": "   " }`
- **Resultado esperado:** HTTP 400 BadRequest

---

### TC-023 — Upload de avatar com imagem válida salva o arquivo
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/users/me/avatar`
- **Input:** arquivo `image/jpeg` de 500KB
- **Resultado esperado:**
  - HTTP 200 ou 201
  - Body com `{ id, avatarUrl }` onde `avatarUrl` aponta para `/uploads/avatars/...`
  - Arquivo físico criado no diretório `./uploads/avatars/`
  - `user.avatarUrl` atualizado no banco

---

### TC-024 — Upload de avatar com MIME inválido retorna 400
- **Status:** ⬜
- **Tipo:** Validação
- **Input:** arquivo `image/gif` ou `application/pdf`
- **Resultado esperado:** HTTP 400

---

### TC-025 — Upload de avatar com arquivo maior que 2MB retorna 413
- **Status:** ⬜
- **Tipo:** Validação
- **Input:** arquivo JPEG de 3MB
- **Resultado esperado:** HTTP 413 (Payload Too Large)

---

### TC-026 — GET /me/stats conta vitórias corretamente para jogador de brancas
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Partidas finalizadas **online** (`isOffline = false`) com usuário como brancas:
  - 1x `WHITE_WINS`, 1x `FORFEIT_BLACK`, 1x `TIMEOUT_BLACK`
- **Resultado esperado:**
  ```json
  { "wins": 3, "losses": 0, "draws": 0, "total": 3,
    "offline": { "wins": 0, "losses": 0, "draws": 0, "total": 0 } }
  ```
- **Nota:** Shape alterado em 2026-06-22 para incluir sub-objeto `offline`

---

### TC-027 — GET /me/stats conta vitórias corretamente para jogador de pretas
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Partidas finalizadas **online** com usuário como pretas:
  - 1x `BLACK_WINS`, 1x `FORFEIT_WHITE`, 1x `TIMEOUT_WHITE`
- **Resultado esperado:**
  ```json
  { "wins": 3, "losses": 0, "draws": 0, "total": 3,
    "offline": { "wins": 0, "losses": 0, "draws": 0, "total": 0 } }
  ```

---

### TC-028 — GET /me/stats considera DRAW corretamente
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** 2 partidas online com resultado `DRAW`
- **Resultado esperado:**
  ```json
  { "wins": 0, "losses": 0, "draws": 2, "total": 2,
    "offline": { "wins": 0, "losses": 0, "draws": 0, "total": 0 } }
  ```

---

### TC-028b — GET /me/stats separa corretamente partidas online e offline
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:**
  - 2 partidas online: 1x `WHITE_WINS` com usuário como brancas (vitória), 1x `WHITE_WINS` com usuário como pretas (derrota)
  - 1 partida offline (`isOffline = true`): `WHITE_WINS` com usuário como brancas (vitória)
- **Resultado esperado:**
  ```json
  { "wins": 1, "losses": 1, "draws": 0, "total": 2,
    "offline": { "wins": 1, "losses": 0, "draws": 0, "total": 1 } }
  ```

---

### TC-029 — GET /me/history retorna apenas partidas com status FINISHED
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Partidas ONGOING e FINISHED no banco para o usuário
- **Resultado esperado:**
  - Apenas partidas com `status = FINISHED` no array retornado

---

### TC-030 — GET /me/history ordena por finishedAt DESC
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** 3 partidas finalizadas em datas diferentes
- **Resultado esperado:**
  - Partida mais recente no índice 0

---

### TC-031 — GET /me/history paginação funciona corretamente
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** 25 partidas finalizadas
- **Casos:**
  - `?page=1&limit=20` → retorna 20 partidas, `totalPages = 2`
  - `?page=2&limit=20` → retorna 5 partidas
- **Resultado esperado:**
  - Body com `{ matches, total: 25, page, totalPages: 2 }`

---

## 3. Matches

**Arquivo sugerido:** `apps/api/src/matches/matches.service.spec.ts`

---

### TC-032 — createMatch inicializa FEN na posição inicial do xadrez
- **Status:** ⬜
- **Tipo:** Happy path
- **Input:** IDs de dois usuários existentes
- **Resultado esperado:**
  - Match criado com `status = ONGOING`
  - `fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"`
  - `moves = []`, `pgn = ""`

---

### TC-033 — createMatch captura rating dos jogadores antes da partida
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Brancas com rating 1500, pretas com 1300
- **Resultado esperado:**
  - `whiteRatingBefore = 1500`
  - `blackRatingBefore = 1300`

---

### TC-034 — finishMatch calcula ELO corretamente para vitória das brancas
- **Status:** ⬜
- **Tipo:** Happy path
- **Input:** `result = WHITE_WINS`, brancas 1200, pretas 1200
- **Resultado esperado:**
  - Brancas ganham ~16 pontos (1216)
  - Pretas perdem ~16 pontos (1184)
  - Fórmula: `K=32`, `expected = 1/(1+10^((Rb-Ra)/400))`

---

### TC-035 — finishMatch calcula ELO corretamente para vitória das pretas
- **Status:** ⬜
- **Tipo:** Happy path
- **Input:** `result = BLACK_WINS`, brancas 1200, pretas 1200
- **Resultado esperado:**
  - Pretas ganham ~16 pontos
  - Brancas perdem ~16 pontos

---

### TC-036 — finishMatch calcula ELO corretamente para empate
- **Status:** ⬜
- **Tipo:** Happy path
- **Input:** `result = DRAW`, brancas 1200, pretas 1200
- **Resultado esperado:**
  - Ambos os ratings permanecem em 1200 (score = 0.5, expected ≈ 0.5)

---

### TC-037 — finishMatch trata FORFEIT_BLACK como vitória das brancas no ELO
- **Status:** ⬜
- **Tipo:** Happy path
- **Input:** `result = FORFEIT_BLACK`
- **Resultado esperado:** Mesmo cálculo que `WHITE_WINS`

---

### TC-038 — finishMatch trata TIMEOUT_WHITE como vitória das pretas no ELO
- **Status:** ⬜
- **Tipo:** Happy path
- **Input:** `result = TIMEOUT_WHITE`
- **Resultado esperado:** Mesmo cálculo que `BLACK_WINS`

---

### TC-039 — finishMatch persiste novos ratings de ambos os jogadores no banco
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - `user.rating` de ambos atualizado no banco
  - `match.whiteRatingAfter` e `match.blackRatingAfter` preenchidos
  - `match.status = FINISHED` e `match.finishedAt` preenchido

---

### TC-154 — createOfflineMatch salva partida com isOffline=true e blackPlayerId=null
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/api/src/matches/matches.service.spec.ts`
- **Input:** `userId = 'u1'`, `result = WHITE_WINS`, `difficulty = 'hard'`, `pgn = '...'`, `moves = [...]`
- **Resultado esperado:**
  - `matchRepo.create` chamado com `{ isOffline: true, blackPlayerId: null, aiDifficulty: 'hard', status: FINISHED }`
  - `matchRepo.save` chamado com o objeto criado
  - `userRepo.update` **NÃO** chamado (ELO não alterado)

---

### TC-155 — createOfflineMatch não altera rating do usuário
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/api/src/matches/matches.service.spec.ts`
- **Pré-condição:** Usuário com rating 1400
- **Resultado esperado:**
  - Após `createOfflineMatch`, rating do usuário permanece 1400
  - `userRepo.update` com campo `rating` **nunca** chamado

---

### TC-156 — createOfflineMatch persiste whiteRatingBefore com rating atual do usuário
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/api/src/matches/matches.service.spec.ts`
- **Pré-condição:** Usuário com rating 1350
- **Resultado esperado:**
  - `matchRepo.create` chamado com `{ whiteRatingBefore: 1350 }`

---

### TC-157 — POST /matches/offline sem autenticação retorna 401
- **Status:** ⬜
- **Tipo:** Edge case
- **Arquivo:** e2e ou controller test
- **Endpoint:** `POST /api/v1/matches/offline`
- **Auth:** Nenhuma (sem Bearer token)
- **Resultado esperado:** HTTP 401

---

## 4. Matchmaking

**Arquivo sugerido:** `apps/api/src/matchmaking/matchmaking.service.spec.ts`

---

### TC-040 — Entrar na fila sem oponente disponível retorna status queued
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Fila vazia
- **Resultado esperado:**
  - HTTP 200 `{ status: 'queued' }`
  - Usuário adicionado à fila em memória

---

### TC-041 — Dois usuários com rating próximo são pareados imediatamente
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Usuário A (1200) já na fila, Usuário B (1350) entra
- **Resultado esperado:**
  - HTTP 200 `{ status: 'matched', matchId: '...' }`
  - Partida criada no banco
  - Usuário A removido da fila

---

### TC-042 — Pareamento emite evento match_found via socket para ambos os jogadores
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Evento `match_found` emitido para `user:{idA}` e `user:{idB}`
  - Payload contém `matchId`, `color` ('white'|'black'), `match`

---

### TC-043 — Entrar na fila já estando na fila retorna already_queued
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Usuário já está na fila
- **Resultado esperado:**
  - HTTP 200 `{ status: 'already_queued' }`
  - Fila inalterada

---

### TC-044 — Sair da fila remove o usuário corretamente
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Usuário na fila
- **Resultado esperado:**
  - HTTP 200 `{ status: 'left' }`
  - Usuário não mais presente na fila

---

### TC-045 — Sair da fila não estando nela retorna left sem erro
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Usuário não está na fila
- **Resultado esperado:**
  - HTTP 200 `{ status: 'left' }` sem lançar exceção

---

### TC-046 — Diferença de rating maior que 200 não gera pareamento
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Usuário A (1000) na fila, Usuário B (1201) entra
- **Resultado esperado:**
  - Usuário B adicionado à fila
  - Nenhuma partida criada

---

### TC-047 — Enviar desafio cria notificação GAME_CHALLENGE para o desafiado
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/matchmaking/challenge`
- **Input:** `{ challengedId: '<uuid>' }`
- **Resultado esperado:**
  - Notificação com `type = GAME_CHALLENGE` criada no banco para o desafiado
  - Payload contém `challengerId`, `challengerNickname`, `challengerRating`

---

### TC-048 — Enviar desafio emite evento challenge_received via socket
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Evento `challenge_received` emitido para `user:{challengedId}`

---

### TC-049 — Aceitar desafio cria partida e emite match_found para ambos
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/matchmaking/challenge/accept`
- **Input:** `{ challengerId: '<uuid>' }`
- **Resultado esperado:**
  - Partida criada no banco
  - `{ status: 'matched', matchId: '...' }` retornado
  - Evento `match_found` emitido para desafiante e desafiado

---

### TC-050 — Recusar desafio emite challenge_rejected ao desafiante
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/matchmaking/challenge/deny`
- **Input:** `{ challengerId: '<uuid>' }`
- **Resultado esperado:**
  - Evento `challenge_rejected` emitido para `user:{challengerId}`
  - Payload contém `challengedId` e `challengedNickname`

---

## 5. Friends

**Arquivo sugerido:** `apps/api/src/friends/friends.service.spec.ts`

---

### TC-051 — Enviar pedido de amizade cria registro com status PENDING
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/friends/request`
- **Input:** `{ nickname: 'outro_usuario' }`
- **Resultado esperado:**
  - HTTP 201
  - Registro de amizade no banco com `status = PENDING`
  - `requester_id` = usuário logado, `receiver_id` = usuário encontrado pelo nickname

---

### TC-052 — Enviar pedido para nickname inexistente retorna 404
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** nickname que não existe
- **Resultado esperado:** HTTP 404

---

### TC-053 — Enviar pedido de amizade para si mesmo retorna 403
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** próprio nickname do usuário logado
- **Resultado esperado:** HTTP 403

---

### TC-054 — Enviar pedido duplicado retorna 409
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Já existe amizade (PENDING ou ACCEPTED) entre os usuários
- **Resultado esperado:** HTTP 409

---

### TC-055 — GET /friends retorna apenas amizades com status ACCEPTED
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Usuário com 2 amigos aceitos e 1 pedido pendente
- **Resultado esperado:**
  - Array com 2 amigos
  - Nenhum pedido PENDING na lista

---

### TC-056 — GET /friends/requests retorna apenas pedidos onde o usuário é receiver
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Usuário recebeu 2 pedidos e enviou 1
- **Resultado esperado:**
  - Array com 2 pedidos recebidos
  - Pedido enviado ausente

---

### TC-057 — Aceitar pedido muda status para ACCEPTED
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `PATCH /api/v1/friends/request/:id/accept`
- **Resultado esperado:**
  - HTTP 200
  - Amizade no banco com `status = ACCEPTED`

---

### TC-058 — Aceitar pedido cria notificação FRIEND_ACCEPTED para o solicitante
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Notificação com `type = FRIEND_ACCEPTED` criada para o solicitante

---

### TC-059 — Aceitar pedido por usuário que não é o receiver retorna 403
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Usuário C tenta aceitar pedido entre A e B
- **Resultado esperado:** HTTP 403

---

### TC-060 — Recusar pedido deleta o registro de amizade
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `PATCH /api/v1/friends/request/:id/decline`
- **Resultado esperado:**
  - HTTP 200
  - Registro de amizade removido do banco

---

### TC-061 — Remover amigo deleta amizade ACCEPTED independente de quem solicitou
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `DELETE /api/v1/friends/:friendId`
- **Casos:**
  - Usuário A remove B (A foi o requester)
  - Usuário B remove A (B foi o receiver)
- **Resultado esperado:**
  - HTTP 200 `{ status: 'removed' }`
  - Amizade removida do banco em ambos os casos

---

## 6. Messages

**Arquivo sugerido:** `apps/api/src/messages/messages.service.spec.ts`

---

### TC-062 — Enviar mensagem cria registro e emite evento de socket ao destinatário
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/messages/:userId`
- **Input:** `{ content: "Olá!" }`
- **Resultado esperado:**
  - HTTP 201
  - Registro de mensagem no banco com `senderId`, `receiverId`, `content`
  - Evento `new_message` emitido para `user:{receiverId}`

---

### TC-063 — Enviar mensagem cria notificação MESSAGE_RECEIVED com preview de 60 chars
- **Status:** ⬜
- **Tipo:** Happy path
- **Input:** mensagem com 100 chars
- **Resultado esperado:**
  - Notificação com `type = MESSAGE_RECEIVED` criada
  - `payload.preview` = primeiros 60 chars da mensagem

---

### TC-064 — GET /messages/:userId retorna mensagens bidirecionais ordenadas por createdAt ASC
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Mensagens enviadas e recebidas entre dois usuários
- **Resultado esperado:**
  - Array com todas as mensagens (de A→B e de B→A)
  - Ordenadas por `createdAt` crescente

---

### TC-065 — GET /messages/:userId marca mensagens não lidas do outro usuário como lidas
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** 3 mensagens do outro usuário com `readAt = null`
- **Resultado esperado:**
  - Após a requisição, as 3 mensagens possuem `readAt` preenchido

---

### TC-066 — GET /messages retorna última mensagem por conversa deduplicada
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Conversas com 3 usuários diferentes
- **Resultado esperado:**
  - Array com 3 entradas `{ user, lastMessage }`
  - Sem duplicatas por usuário

---

## 7. Game Gateway (WebSocket)

**Arquivo sugerido:** `apps/api/src/game/game.gateway.spec.ts`  
**Namespace:** `/game`

---

### TC-067 — Conexão com token válido define isOnline = true no banco
- **Status:** ⬜
- **Tipo:** Happy path
- **Auth:** JWT token no `handshake.auth.token`
- **Resultado esperado:**
  - Socket conectado com sucesso
  - `user.isOnline = true` no banco

---

### TC-068 — Conexão notifica amigos com evento user_online
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Usuário possui 2 amigos conectados
- **Resultado esperado:**
  - Evento `user_online` emitido para cada amigo via `user:{friendId}`

---

### TC-069 — Conexão com token inválido desconecta o socket
- **Status:** ⬜
- **Tipo:** Edge case
- **Auth:** Token malformado ou expirado
- **Resultado esperado:**
  - Socket desconectado imediatamente
  - Nenhum evento de presença emitido

---

### TC-070 — Desconexão define isOnline = false e notifica amigos
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - `user.isOnline = false` no banco
  - Evento `user_offline` emitido para amigos conectados

---

### TC-071 — join_social retorna lista de IDs de amigos online
- **Status:** ⬜
- **Tipo:** Happy path
- **Evento emitido:** `join_social`
- **Resultado esperado:**
  - Evento `friends_status` recebido com array de IDs de amigos com `isOnline = true`

---

### TC-072 — join_game valida que o usuário pertence à partida
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** `{ matchId: '<id_de_partida_de_outros>' }`
- **Resultado esperado:**
  - Nenhum evento `game_state` emitido
  - Socket não entra na sala `game:{matchId}`

---

### TC-073 — join_game emite game_state com FEN atual da partida
- **Status:** ⬜
- **Tipo:** Happy path
- **Input:** `{ matchId: '<id_de_partida_do_usuario>' }`
- **Resultado esperado:**
  - Evento `game_state` recebido com `fen` = FEN atual da partida

---

### TC-074 — join_game inicia timer de 60 segundos
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Evento `timer_update` começa a ser recebido após join_game
  - Valor inicial próximo de 60

---

### TC-075 — move com turno correto é aceito e propagado com move_broadcast
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Partida com turno das brancas, jogador de brancas emite move
- **Input:** `{ matchId, from: 'e2', to: 'e4', fen: '<novo_fen>', pgn: '...', moves: [...] }`
- **Resultado esperado:**
  - Evento `move_broadcast` recebido por ambos os jogadores
  - FEN atualizado no banco

---

### TC-076 — move fora do turno é ignorado silenciosamente
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Turno é das brancas, jogador de pretas tenta mover
- **Resultado esperado:**
  - Nenhum `move_broadcast` emitido
  - FEN no banco inalterado

---

### TC-077 — move atualiza FEN, PGN e moves no banco
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - `match.fen`, `match.pgn`, `match.moves` atualizados após o evento
  - `match.currentTurn` alternado (white→black ou black→white)

---

### TC-078 — move reinicia o timer para o oponente
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Após `move_broadcast`, `timer_update` recomeça do 60

---

### TC-079 — game_over_client encerra partida e atualiza ELO
- **Status:** ⬜
- **Tipo:** Happy path
- **Evento:** `game_over_client` com `{ matchId, result: 'WHITE_WINS' }`
- **Resultado esperado:**
  - `match.status = FINISHED` no banco
  - Ratings de ambos os jogadores atualizados
  - Evento `game_over` emitido para a sala

---

### TC-080 — forfeit encerra com FORFEIT_WHITE ou FORFEIT_BLACK conforme cor do jogador
- **Status:** ⬜
- **Tipo:** Happy path
- **Casos:**
  - Brancas desistem → `result = FORFEIT_WHITE`
  - Pretas desistem → `result = FORFEIT_BLACK`
- **Resultado esperado:**
  - `match.result` correto no banco

---

### TC-081 — forfeit emite game_over com reason forfeit
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Evento `game_over` com `{ result: 'FORFEIT_*', reason: 'forfeit' }` para ambos os jogadores

---

### TC-082 — Timer ao atingir 0 encerra com TIMEOUT e emite game_over
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Partida ativa, aguardar 60 segundos sem mover
- **Resultado esperado:**
  - `match.result = TIMEOUT_WHITE` ou `TIMEOUT_BLACK` (conforme turno)
  - Evento `game_over` com `reason: 'timeout'`
  - ELO atualizado

---

### TC-083 — chat_message transmite mensagem para todos na sala da partida
- **Status:** ⬜
- **Tipo:** Happy path
- **Evento:** `chat_message` com `{ matchId, content: 'Boa sorte!' }`
- **Resultado esperado:**
  - Evento `chat_message` recebido por ambos os jogadores
  - Registro `MatchChatMessage` criado no banco

---

### TC-084 — chat_message com conteúdo vazio é ignorado
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** `{ matchId, content: '   ' }` (somente espaços)
- **Resultado esperado:**
  - Nenhum evento `chat_message` emitido
  - Nenhum registro criado no banco

---

## 8. Notifications

**Arquivo sugerido:** `apps/api/src/notifications/notifications.service.spec.ts`

---

### TC-085 — GET /notifications retorna apenas notificações com readAt IS NULL
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** 3 notificações não lidas e 2 já lidas
- **Resultado esperado:**
  - Array com 3 notificações
  - Todas com `readAt = null`

---

### TC-086 — GET /notifications retorna notificações ordenadas por createdAt DESC
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** 3 notificações em momentos distintos
- **Resultado esperado:**
  - Notificação mais recente no índice 0

---

### TC-087 — PATCH /notifications/read-all seta readAt em todas as não lidas
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** 4 notificações não lidas
- **Resultado esperado:**
  - HTTP 200 `{ status: 'ok' }`
  - Todas as 4 com `readAt` preenchido no banco

---

## 9. Ranking

**Arquivo sugerido:** `apps/api/src/ranking/ranking.service.spec.ts`

---

### TC-088 — GET /ranking retorna top 100 por rating DESC sem autenticação
- **Status:** ⬜
- **Tipo:** Happy path
- **Auth:** Não requerida
- **Pré-condição:** 120 usuários cadastrados
- **Resultado esperado:**
  - Array com exatamente 100 usuários
  - Ordenados por `rating` decrescente
  - Campos: `id`, `name`, `nickname`, `avatarUrl`, `rating`

---

### TC-089 — GET /ranking/me retorna posição e rating do usuário logado
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** 10 usuários; usuário logado com 5º maior rating
- **Resultado esperado:**
  - `{ position: 5, rating: <valor> }`

---

### TC-090 — Posição = quantidade de usuários com rating >= ao do usuário + 1
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** 3 usuários com rating maior, usuário logado em 4º
- **Resultado esperado:**
  - `position = 4`

---

## 10. Reviews

**Arquivo sugerido:** `apps/api/src/reviews/reviews.service.spec.ts`

---

### TC-091 — Criar review em partida FINISHED com dados válidos
- **Status:** ⬜
- **Tipo:** Happy path
- **Endpoint:** `POST /api/v1/reviews`
- **Input:**
  ```json
  {
    "matchId": "<uuid>",
    "reviewedId": "<uuid>",
    "rating": 4,
    "comment": "Ótimo jogador!"
  }
  ```
- **Resultado esperado:**
  - HTTP 201
  - Review criada no banco

---

### TC-092 — Criar review em partida não finalizada retorna 400
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Partida com `status = ONGOING`
- **Resultado esperado:** HTTP 400

---

### TC-093 — Criar review sem ser jogador da partida retorna 403
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Usuário que não participou da partida tenta criar review
- **Resultado esperado:** HTTP 403

---

### TC-094 — Auto-review retorna 400
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** `reviewedId` = próprio ID do usuário logado
- **Resultado esperado:** HTTP 400

---

### TC-095 — Criar review para usuário que não jogou a partida retorna 403
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** `reviewedId` de um terceiro usuário que não participou da partida
- **Resultado esperado:** HTTP 403

---

### TC-096 — Segundo review no mesmo jogo pelo mesmo jogador viola constraint única
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Revisor já criou review nessa partida
- **Resultado esperado:** HTTP 409 (ou 500 por unique constraint violation)

---

### TC-097 — Rating fora do range 1–5 retorna 400
- **Status:** ⬜
- **Tipo:** Validação
- **Casos:** `rating = 0` e `rating = 6`
- **Resultado esperado:** HTTP 400

---

### TC-098 — Comment com mais de 500 caracteres retorna 400
- **Status:** ⬜
- **Tipo:** Validação
- **Input:** string de 501 chars
- **Resultado esperado:** HTTP 400

---

---

## 11. Frontend — Login / Register

**Arquivo sugerido:** `apps/web/src/pages/LoginPage.test.tsx`, `RegisterPage.test.tsx`  
**Ferramenta:** Playwright ou React Testing Library

---

### TC-099 — Login com credenciais válidas redireciona para /lobby
- **Status:** ⬜
- **Tipo:** Happy path
- **Passos:**
  1. Navegar para `/`
  2. Preencher email e senha válidos
  3. Clicar em "Entrar"
- **Resultado esperado:**
  - URL muda para `/lobby`
  - Tokens armazenados no `localStorage`

---

### TC-100 — Login com credenciais inválidas exibe mensagem de erro
- **Status:** ⬜
- **Tipo:** Edge case
- **Passos:**
  1. Preencher credenciais incorretas
  2. Submeter o formulário
- **Resultado esperado:**
  - Mensagem de erro visível na tela
  - URL permanece em `/`

---

### TC-101 — Login exibe estado de loading durante a requisição
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Botão desabilitado e com indicador de carregamento enquanto a requisição está em andamento

---

### TC-102 — Usuário já autenticado é redirecionado de / para /lobby
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Tokens válidos no `localStorage`
- **Resultado esperado:**
  - Ao navegar para `/`, redireciona automaticamente para `/lobby`

---

### TC-103 — Register com dados válidos redireciona para /lobby
- **Status:** ⬜
- **Tipo:** Happy path
- **Passos:**
  1. Navegar para `/register`
  2. Preencher todos os campos válidos
  3. Submeter
- **Resultado esperado:**
  - URL muda para `/lobby`

---

### TC-104 — Register com email ou nickname duplicado exibe mensagem de erro
- **Status:** ⬜
- **Tipo:** Edge case
- **Resultado esperado:**
  - Mensagem "Erro ao criar conta" visível

---

### TC-105 — Validações HTML5 bloqueiam submit com campos inválidos
- **Status:** ⬜
- **Tipo:** Validação
- **Casos:**
  - Email com formato inválido
  - Nickname com menos de 3 chars
  - Senha com menos de 6 chars
- **Resultado esperado:**
  - Formulário não é submetido
  - Mensagem de validação nativa exibida

---

## 12. Frontend — Lobby

**Arquivo sugerido:** `apps/web/src/pages/LobbyPage.test.tsx`

---

### TC-106 — Botão Encontrar Partida alterna estado entre buscar e cancelar
- **Status:** ⬜
- **Tipo:** Happy path
- **Passos:**
  1. Clicar em "Encontrar Partida"
  2. Verificar texto alterado para "Buscando oponente..."
  3. Clicar novamente para cancelar
- **Resultado esperado:**
  - Estado alterna corretamente
  - API chamada em cada ação (`POST` e `DELETE /matchmaking/queue`)

---

### TC-107 — Evento match_found via socket redireciona para /game/:matchId
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Usuário na fila
- **Resultado esperado:**
  - Ao receber evento `match_found`, URL muda para `/game/<matchId>`

---

### TC-108 — Lista de desafios recebidos atualiza em tempo real via socket
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Evento `challenge_received` adiciona desafio à lista na UI
  - Nome do desafiante e rating exibidos

---

### TC-109 — Contador regressivo de desafio fica vermelho com 10 ou menos segundos
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Contador com cor normal quando > 10s
  - Cor vermelha ao atingir ≤ 10s

---

### TC-110 — Aceitar desafio chama a API e redireciona para o jogo
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - `POST /matchmaking/challenge/accept` chamado
  - URL muda para `/game/<matchId>`

---

### TC-111 — Barra lateral de amigos exibe status online/offline em tempo real
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Amigo aparece como online/offline conforme eventos `user_online`/`user_offline`

---

### TC-112 — Botão Desafiar só aparece para amigos online
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Amigos offline não exibem botão "Desafiar"
  - Amigos online exibem botão ao passar o mouse (hover)

---

### TC-113 — Rating do usuário exibido corretamente no lobby
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - ELO do usuário logado visível na tela do lobby

---

### TC-158 — Card "Jogar contra a IA" navega para /play/offline
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/web/src/pages/LobbyPage.test.tsx`
- **Passos:**
  1. Renderizar LobbyPage com usuário autenticado
  2. Clicar no botão "Jogar" dentro do card "Jogar contra a IA"
- **Resultado esperado:**
  - `navigate('/play/offline')` chamado
  - URL muda para `/play/offline`

---

## 13. Frontend — Game

**Arquivo sugerido:** `apps/web/src/pages/GamePage.test.tsx`

---

### TC-114 — Tabuleiro inicializa com o FEN correto após evento game_state
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Tabuleiro renderiza posição correspondente ao FEN recebido

---

### TC-115 — Jogada legal emite evento move via socket
- **Status:** ⬜
- **Tipo:** Happy path
- **Passos:** Arrastar peça para casa válida
- **Resultado esperado:**
  - Evento `move` emitido com `from`, `to`, `fen`, `pgn`, `moves`

---

### TC-116 — Jogada ilegal exibe borda vermelha por 600ms
- **Status:** ⬜
- **Tipo:** Edge case
- **Passos:** Tentar arrastar peça para casa inválida
- **Resultado esperado:**
  - Borda vermelha aparece e desaparece após 600ms

---

### TC-117 — Tentar mover fora do turno não executa a jogada
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Turno do oponente
- **Resultado esperado:**
  - Nenhum evento `move` emitido
  - Peça retorna à posição original

---

### TC-118 — Timer exibe MM:SS e muda de cor conforme segundos restantes
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Cor normal quando > 30s
  - Laranja quando ≤ 30s
  - Vermelho quando ≤ 15s

---

### TC-119 — Botão de desistência abre modal de confirmação
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Modal visível com texto de aviso sobre derrota

---

### TC-120 — Confirmar desistência emite evento forfeit via socket
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Evento `forfeit` emitido com `{ matchId }`

---

### TC-121 — Cancelar desistência fecha o modal sem ação
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Modal fechado, nenhum evento de socket emitido

---

### TC-122 — Evento game_over exibe card de resultado com motivo correto
- **Status:** ⬜
- **Tipo:** Happy path
- **Casos:**
  - Vitória → card verde, "🏆 Vitória", motivo exibido
  - Derrota → card vermelho, "😞 Derrota"
  - Empate → card neutro, "🤝 Empate"
  - Motivo: "Xeque-mate" / "Desistência" / "Tempo esgotado"

---

### TC-123 — Xeque-mate detectado client-side emite game_over_client
- **Status:** ⬜
- **Tipo:** Happy path
- **Pré-condição:** Posição de xeque-mate alcançada
- **Resultado esperado:**
  - chess.js detecta checkmate
  - Evento `game_over_client` emitido com `result` correto

---

### TC-124 — Chat envia mensagem via socket e exibe na lista
- **Status:** ⬜
- **Tipo:** Happy path
- **Passos:** Digitar mensagem e enviar
- **Resultado esperado:**
  - Evento `chat_message` emitido
  - Mensagem aparece na lista do chat alinhada à direita

---

### TC-125 — Chat com conteúdo vazio não envia
- **Status:** ⬜
- **Tipo:** Edge case
- **Input:** campo de chat vazio ou somente espaços
- **Resultado esperado:**
  - Nenhum evento de socket emitido

---

### TC-126 — Voltar ao lobby após game over navega para /lobby
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - URL muda para `/lobby` ao clicar no botão

---

## 14. Frontend — Perfil e Edição

**Arquivo sugerido:** `apps/web/src/pages/ProfilePage.test.tsx`, `EditProfilePage.test.tsx`

---

### TC-127 — Página de perfil exibe stats e reviews corretamente
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Vitórias, derrotas, empates e total exibidos
  - Percentual de vitórias calculado corretamente
  - Reviews listadas com estrelas e comentário

---

### TC-128 — Nickname inexistente exibe Perfil não encontrado
- **Status:** ⬜
- **Tipo:** Edge case
- **Resultado esperado:**
  - Mensagem de erro visível na tela

---

### TC-129 — Botão de editar perfil só aparece ao visualizar o próprio perfil
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Botão visível em `/profile/me` ou no perfil do próprio usuário
  - Ausente ao visualizar perfil alheio

---

### TC-130 — Salvar perfil chama PATCH /users/me e exibe mensagem de sucesso
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - API chamada
  - Mensagem "Perfil atualizado com sucesso!" visível

---

### TC-131 — Upload de avatar válido atualiza o preview na tela
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Preview da imagem atualizado após upload bem-sucedido

---

### TC-132 — Upload com arquivo maior que 2MB exibe mensagem de erro
- **Status:** ⬜
- **Tipo:** Validação
- **Resultado esperado:**
  - Mensagem "Arquivo muito grande" visível
  - API não chamada

---

### TC-133 — Upload com MIME inválido exibe mensagem de erro
- **Status:** ⬜
- **Tipo:** Validação
- **Resultado esperado:**
  - Mensagem "Formato inválido" visível
  - API não chamada

---

## 15. Frontend — Friends

**Arquivo sugerido:** `apps/web/src/pages/FriendsPage.test.tsx`

---

### TC-134 — Enviar pedido de amizade exibe confirmação de sucesso
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Mensagem "Solicitação enviada para @{nickname}" visível

---

### TC-135 — Aceitar pedido pendente atualiza lista de amigos
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - API chamada
  - Pedido removido da lista de pendentes
  - Amigo aparece na lista de amigos

---

### TC-136 — Recusar pedido pendente remove da lista
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - API chamada
  - Pedido removido da lista

---

### TC-137 — Clicar em amigo abre conversa e carrega mensagens
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - `GET /messages/{friendId}` chamado
  - Mensagens exibidas no painel de chat
  - Indicador de não lido removido

---

### TC-138 — Enviar mensagem no chat chama API e exibe na conversa
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - `POST /messages/{friendId}` chamado
  - Mensagem aparece na lista alinhada à direita

---

### TC-139 — Evento new_message adiciona mensagem em tempo real na conversa ativa
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Mensagem do amigo aparece automaticamente sem recarregar a página

---

### TC-140 — Indicador de não lido aparece para amigos com mensagens não abertas
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Ponto azul visível ao lado do amigo com mensagem não lida
  - Ponto removido ao abrir a conversa

---

## 16. Frontend — Ranking e Histórico

**Arquivo sugerido:** `apps/web/src/pages/RankingPage.test.tsx`, `HistoryPage.test.tsx`

---

### TC-141 — Ranking exibe top 100 com medalhas para top 3
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - 🥇 no 1º, 🥈 no 2º, 🥉 no 3º
  - Demais posições com número

---

### TC-142 — Card Sua posição exibe posição e rating do usuário logado
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Card visível com posição e rating corretos

---

### TC-143 — Troca de período recarrega a lista de ranking
- **Status:** ⬜
- **Tipo:** Happy path
- **Passos:** Clicar em "Semana", depois "Mês", depois "Dia"
- **Resultado esperado:**
  - `GET /ranking?period=<período>` chamado a cada troca

---

### TC-144 — Histórico pagina corretamente com 20 partidas por página
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - 20 itens por página
  - Botão "Próxima" navega para página 2
  - Botão "Anterior" desabilitado na página 1

---

### TC-145 — Badge de resultado exibe cor correta
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - "Vitória" → cor verde (success)
  - "Derrota" → cor vermelha (danger)
  - "Empate" → cor neutra (muted)

---

### TC-146 — Estado vazio do histórico exibe mensagem e link para /lobby
- **Status:** ⬜
- **Tipo:** Edge case
- **Pré-condição:** Usuário sem partidas finalizadas
- **Resultado esperado:**
  - Mensagem "Nenhuma partida jogada ainda" visível
  - Link "Jogar agora" presente

---

### TC-147 — Botões de paginação desabilitados nos limites
- **Status:** ⬜
- **Tipo:** Edge case
- **Resultado esperado:**
  - "Anterior" desabilitado na página 1
  - "Próxima" desabilitada na última página

---

### TC-166 — HistoryPage exibe ícone 🤖, badge OFFLINE e dificuldade para partidas offline
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/web/src/pages/HistoryPage.test.tsx`
- **Pré-condição:** API retorna 1 partida com `isOffline: true, aiDifficulty: 'hard'`
- **Resultado esperado:**
  - Ícone `🤖` visível na linha da partida (sem Avatar do oponente)
  - Badge/label `OFFLINE` visível
  - Label `Difícil` visível
  - Coluna de ELO ausente para essa linha

---

### TC-167 — HistoryPage StatChips exibem totais online e offline separadamente
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/web/src/pages/HistoryPage.test.tsx`
- **Pré-condição:** `GET /users/me/stats` retorna:
  ```json
  { "wins": 5, "losses": 3, "draws": 1, "total": 9,
    "offline": { "wins": 2, "losses": 1, "draws": 0, "total": 3 } }
  ```
- **Resultado esperado:**
  - Chip "ONLINE" visível com `9p`, `5V`, `3D`
  - Chip "OFFLINE" visível com `3p`, `2V`, `1D`
  - Os dois chips coexistem na mesma linha sem sobreposição

---

## 17. Frontend — Notifications

**Arquivo sugerido:** `apps/web/src/pages/NotificationsPage.test.tsx`

---

### TC-148 — Notificações não lidas exibidas com destaque visual
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Borda com cor primária e ponto azul visíveis em notificações com `readAt = null`

---

### TC-149 — Aceitar pedido de amizade via notificação chama API e remove após 1.5s
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - `PATCH /friends/request/{id}/accept` chamado
  - Mensagem "✓ Amizade aceita!" exibida
  - Notificação removida da lista após 1.5s

---

### TC-150 — Aceitar desafio de partida via notificação redireciona para o jogo
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - `POST /matchmaking/challenge/accept` chamado
  - URL muda para `/game/<matchId>`

---

### TC-151 — Recusar desafio de partida via notificação chama API de deny
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - `POST /matchmaking/challenge/deny` chamado
  - Notificação removida após 1.5s

---

### TC-152 — Notificação de mensagem é clicável e navega para /friends com chat aberto
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - Clicar na notificação navega para `/friends`
  - Chat do remetente aberto automaticamente (via navigation state `openFriendId`)

---

### TC-153 — Marcar todas como lidas atualiza visualmente todas as notificações
- **Status:** ⬜
- **Tipo:** Happy path
- **Resultado esperado:**
  - `PATCH /notifications/read-all` chamado
  - Destaque visual removido de todas as notificações na tela

---

## 18. Frontend — Modo Offline (IA)

**Arquivos sugeridos:** `apps/web/src/pages/OfflineSetupPage.test.tsx`, `OfflineGamePage.test.tsx`  
**Ferramenta:** React Testing Library + vitest (ou Playwright E2E)

---

### TC-159 — OfflineSetupPage — dificuldade "medium" pré-selecionada ao abrir a página
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/web/src/pages/OfflineSetupPage.test.tsx`
- **Passos:**
  1. Renderizar `OfflineSetupPage`
- **Resultado esperado:**
  - Card de dificuldade "Médio" possui estilos de seleção ativos (borda colorida)
  - Cards "Fácil" e "Difícil" aparecem sem destaque

---

### TC-160 — OfflineSetupPage — selecionar dificuldade e clicar Jogar navega com query param correto
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/web/src/pages/OfflineSetupPage.test.tsx`
- **Passos:**
  1. Renderizar `OfflineSetupPage`
  2. Clicar no card "Difícil"
  3. Clicar no botão "Jogar"
- **Resultado esperado:**
  - `navigate('/play/offline/game?difficulty=hard')` chamado
  - URL resultante inclui `difficulty=hard`

---

### TC-161 — OfflineGamePage — URL param `difficulty` inválido é normalizado para "medium"
- **Status:** ⬜
- **Tipo:** Edge case
- **Arquivo:** `apps/web/src/pages/OfflineGamePage.test.tsx`
- **Pré-condição:** Usuário acessa `/play/offline/game?difficulty=ultra_hard` diretamente
- **Resultado esperado:**
  - Componente renderiza sem erro
  - Variável interna `difficulty` é `'medium'`
  - Label exibida é "Médio" (não "undefined" nem a string inválida)

---

### TC-162 — OfflineGamePage — jogada legal do usuário atualiza o tabuleiro e dispara IA
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/web/src/pages/OfflineGamePage.test.tsx`
- **Passos:**
  1. Renderizar `OfflineGamePage?difficulty=easy` com mock de `getBestMove` retornando `{ from: 'e7', to: 'e5' }`
  2. Simular drop de peça de `e2` para `e4`
- **Resultado esperado:**
  - FEN do tabuleiro atualizado (peão branco moveu)
  - `getBestMove` chamado com o novo FEN e `'easy'`
  - Após delay de 400ms, peão preto move (FEN atualizado novamente)
  - `aiThinking` fica `true` durante o delay e `false` após

---

### TC-163 — OfflineGamePage — xeque-mate exibe card de resultado com outcome correto
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/web/src/pages/OfflineGamePage.test.tsx`
- **Pré-condição:** `gameRef.current` em posição de xeque-mate com `isGameOver() = true, isCheckmate() = true`, turno das pretas (usuário venceu)
- **Resultado esperado:**
  - Card de resultado visível com "Vitória" e motivo "Xeque-mate"
  - `POST /api/v1/matches/offline` chamado com `result: 'WHITE_WINS'`
  - Botão de desistência desabilitado

---

### TC-164 — OfflineGamePage — desistir abre modal de confirmação
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/web/src/pages/OfflineGamePage.test.tsx`
- **Passos:**
  1. Renderizar com partida em andamento
  2. Clicar no botão "Desistir"
- **Resultado esperado:**
  - Modal de confirmação visível com texto de aviso
  - `POST /matches/offline` **não** chamado ainda

---

### TC-165 — OfflineGamePage — confirmar desistência salva na API e exibe "Derrota"
- **Status:** ⬜
- **Tipo:** Happy path
- **Arquivo:** `apps/web/src/pages/OfflineGamePage.test.tsx`
- **Passos:**
  1. Abrir modal de desistência (ver TC-164)
  2. Clicar em "Confirmar desistência"
- **Resultado esperado:**
  - `POST /api/v1/matches/offline` chamado com `{ result: 'FORFEIT_WHITE', difficulty: 'medium' }`
  - Card de resultado exibe "Derrota" e motivo "Desistência"
  - Modal fechado

---

### TC-166b — OfflineGamePage — falha ao salvar resultado não bloqueia exibição do card
- **Status:** ⬜
- **Tipo:** Edge case
- **Arquivo:** `apps/web/src/pages/OfflineGamePage.test.tsx`
- **Pré-condição:** Mock de `api.post('/matches/offline')` lança exceção
- **Resultado esperado:**
  - Card de resultado ainda exibe o outcome correto
  - Aviso "Não foi possível salvar a partida" visível dentro do card
  - Nenhum crash ou tela em branco
