# Mega Chess — Project Instructions

## Vision

Plataforma de xadrez online em tempo real com matchmaking, ranking, histórico de partidas, sistema social (amigos, chat, desafios) e suporte a web e mobile (React Native futuramente).

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend web | React (Vite) |
| Frontend mobile (futuro) | React Native |
| Backend | NestJS |
| Banco de dados | PostgreSQL |
| Comunicação em tempo real | WebSockets (Socket.IO via NestJS) |
| Containerização | Docker / Docker Compose |
| ORM | Prisma |
| Autenticação | JWT (access + refresh tokens) |
| Upload de imagens | Multer + armazenamento local |

---

## Arquitetura

```
mega-chess/
├── docker-compose.yml
├── apps/
│   ├── web/          # React (Vite)
│   └── api/          # NestJS
├── packages/
│   └── chess-engine/ # lógica de xadrez compartilhada (validação de movimentos)
└── CLAUDE.md
```

### Containers Docker

- **db** — PostgreSQL 16
- **api** — NestJS (porta 3000)
- **web** — React via Nginx (porta 80/443)
- **redis** *(opcional, recomendado)* — cache de sessão e filas de matchmaking

Frontend e backend se comunicam via:
- **REST API** para operações CRUD (perfil, histórico, amigos, ranking)
- **WebSocket (Socket.IO)** para partidas em tempo real e chat

---

## Módulos do Backend (NestJS)

### Auth
- Registro: `email`, `nome`, `apelido`, `senha` (bcrypt), `foto_perfil`
- Login retorna `access_token` (JWT, 15 min) e `refresh_token` (7 dias)
- Guards JWT em rotas protegidas

### Users
- CRUD de perfil (nome, apelido, bio, foto)
- Endpoint público de perfil por apelido (`/users/:nickname`)
- Rating ELO inicial: 1200
- Posição no ranking

### Matches
- Criação de partida (matchmaking ou desafio direto)
- Estado da partida armazenado no banco: `fen`, `moves[]`, `status`, `turn`, `timers`
- Resultado: `win`, `loss`, `draw`, `forfeit`
- Cada partida registrada no histórico dos dois jogadores

### Matchmaking
- Fila de busca por partida (`queue`)
- Pareamento por rating próximo (diferença máxima configurável)
- Desafio direto entre amigos

### Game (WebSocket Gateway)
Eventos emitidos/recebidos pelo servidor:

| Evento | Direção | Descrição |
|--------|---------|-----------|
| `join_game` | client→server | entrar na sala da partida |
| `move` | client→server | enviar jogada (notação UCI/SAN) |
| `move_broadcast` | server→clients | propagar jogada validada |
| `game_over` | server→clients | fim de partida (motivo + resultado) |
| `timer_update` | server→clients | tempo restante do jogador atual |
| `forfeit` | client→server | desistência |
| `chat_message` | client↔server | mensagem no chat da partida |

#### Temporizador de jogada
- Cada jogador tem **1 minuto** por jogada
- O servidor controla o timer; ao expirar, passa a vez automaticamente
- Três passes consecutivos sem mover resultam em derrota por tempo (configurável)

### Friends
- Enviar/aceitar/recusar/remover solicitação de amizade
- Listar amigos com status online/offline
- Chat privado entre amigos via WebSocket

### Notifications
- Receber desafios de partida
- Solicitações de amizade pendentes
- Mensagens não lidas
- Entregues via WebSocket ao usuário conectado; persistidas no banco para offline

### Ranking
- Calculado por rating ELO
- Endpoints: top 100 do dia / semana / mês
- Posição do usuário logado no ranking global

### Reviews (Feedback)
- Após uma partida finalizada, qualquer jogador que jogou contra o usuário pode deixar feedback (texto + 1-5 estrelas)
- Visível no perfil público

---

## Modelo de Dados (entidades principais)

```
User
  id, email, name, nickname, password_hash, avatar_url, bio
  rating (ELO), created_at

Match
  id, white_player_id, black_player_id
  status (waiting | ongoing | finished)
  result (white_wins | black_wins | draw | forfeit)
  pgn, fen_final, moves (jsonb)
  started_at, finished_at

MatchPlayer (view/join)
  match_id, user_id, color, result, rating_before, rating_after

Friendship
  requester_id, receiver_id, status (pending | accepted | blocked)

Message
  id, sender_id, receiver_id, content, read_at, created_at

MatchChatMessage
  id, match_id, sender_id, content, created_at

Notification
  id, user_id, type, payload (jsonb), read_at, created_at

Review
  id, reviewer_id, reviewed_id, match_id, rating, comment, created_at
```

---

## Frontend (React / Web)

### Páginas

| Rota | Descrição |
|------|-----------|
| `/` | Landing / login |
| `/register` | Cadastro |
| `/lobby` | Saguão: buscar partida, desafios recebidos, amigos online |
| `/game/:id` | Tabuleiro + chat da partida |
| `/profile/:nickname` | Perfil público (stats, histórico, reviews) |
| `/profile/me` | Próprio perfil (editável) |
| `/friends` | Lista de amigos + chat privado |
| `/ranking` | Top 100 (dia/semana/mês) |
| `/history` | Histórico completo de partidas |

### Componentes críticos

- **Chessboard** — tabuleiro interativo com drag-and-drop e highlight de movimentos legais
  - Biblioteca sugerida: `react-chessboard` + `chess.js` para validação client-side
- **Timer** — conta regressiva sincronizada com o servidor
- **MatchChat** — chat em tempo real dentro da partida
- **FriendChat** — janela de chat flutuante com amigos
- **NotificationBell** — badge com notificações não lidas
- **RankBadge** — exibição do rating ELO e posição

### Design

- UI responsiva (mobile-first) para facilitar migração futura para React Native
- Tema escuro como padrão (xadrez tem visual clássico escuro)
- Componentes compartilháveis: extrair lógica pura de xadrez em `packages/chess-engine` para reutilização no app mobile

---

## Regras de Negócio

1. **ELO**: ao fim de cada partida, os ratings são recalculados (K-factor padrão: 32)
2. **Forfeit**: desistir conta como derrota; o oponente recebe os pontos normalmente
3. **Timeout de jogada**: ao expirar 1 minuto, o servidor emite `move_broadcast` com `null` (passe) e avança o turno; acumular passes não é previsto no xadrez padrão — timeout de jogada resulta em derrota automática
4. **Matchmaking**: só pareia jogadores que estão com status `searching`; ao fechar a aba o status é removido
5. **Desafio direto**: o desafiado recebe notificação e tem 30 segundos para aceitar
6. **Review**: só pode ser feito uma vez por partida por cada jogador; só disponível após a partida finalizada
7. **Amizade**: ambos precisam aceitar; bloqueio remove a amizade e impede novo pedido

---

## Docker Compose (estrutura esperada)

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: megachess
      POSTGRES_USER: chess
      POSTGRES_PASSWORD: chess_secret
    volumes:
      - pg_data:/var/lib/postgresql/data

  api:
    build: ./apps/api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://chess:chess_secret@db:5432/megachess
      JWT_SECRET: ...
    depends_on:
      - db

  web:
    build: ./apps/web
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  pg_data:
```

---

## Variáveis de Ambiente

### API (`apps/api/.env`)
```
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
PORT=3000
CORS_ORIGIN=http://localhost
```

### Web (`apps/web/.env`)
```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## Design System

### Nome
**Mega Chess Online**

### Paleta de Cores
| Token | Hex | Uso |
|-------|-----|-----|
| `--color-bg` | `#0C0B13` | Fundo principal |
| `--color-surface` | `#1E1D2E` | Cards e painéis |
| `--color-surface-2` | `#373855` | Elementos secundários |
| `--color-primary` | `#3D4AEB` | Ações principais, destaques |
| `--color-danger` | `#B15653` | Perigo, derrota, resignar |
| `--color-text` | `#FFFFFF` | Texto principal |
| `--color-text-muted` | `#8B8CA7` | Texto secundário |

### Tipografia
- Fonte: **DM Sans** (Google Fonts)
- Pesos: 400 (Regular), 500 (Medium), 700 (Bold)

### Logo
SVG único combinando símbolo de conectividade (globo/rede) com peça Rei do xadrez.
Localização: `apps/web/src/assets/logo.svg`

---

## Convenções de Código

- **NestJS**: módulo por domínio (`auth`, `users`, `matches`, `friends`, etc.)
- **React**: componentes em PascalCase, hooks em camelCase com prefixo `use`
- **API REST**: prefixo `/api/v1/`
- **WebSocket namespace**: `/game` para partidas, `/social` para chat/notificações
- Sem comentários desnecessários; nomes auto-descritivos
- Testes de integração no backend usando banco real (sem mocks do banco)
- Validação no backend com `class-validator` + `class-transformer`

---

## Roadmap de Implementação

1. [ ] Monorepo + Docker Compose base (db + api + web)
2. [ ] Auth (registro, login, JWT)
3. [ ] Perfil de usuário (CRUD)
4. [ ] Tabuleiro de xadrez (UI + chess.js, sem WebSocket ainda)
5. [ ] Gateway WebSocket para partidas + temporizador
6. [ ] Matchmaking (fila)
7. [ ] Histórico de partidas + ELO
8. [ ] Sistema de amigos
9. [ ] Chat de amigos + notificações
10. [ ] Desafio direto
11. [ ] Ranking (dia/semana/mês)
12. [ ] Reviews de jogadores
13. [ ] Polish UI + responsividade mobile
14. [ ] (Futuro) React Native app consumindo a mesma API/WS
