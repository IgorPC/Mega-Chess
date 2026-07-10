# Mega Chess — Instruções para Claude

## Visão geral

Plataforma de xadrez competitivo online. Backend NestJS + TypeORM + PostgreSQL + Redis. Frontend React 18 + Vite. Painel admin React 18 + Material UI. Comunicação em tempo real via Socket.IO. Economia interna (Chess Coins) com integração PIX via Asaas. Anti-cheat e suporte por IA via DeepSeek.

Ambiente de homologação: `homologa.megachess.io` (deploy automático via Coolify no branch `development`).

---

## Stack e versões

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 10, TypeORM, Node 20 |
| Frontend web | React 18, Vite, React Router v6 |
| Painel admin | React 18, Material UI, Recharts, TanStack Table |
| Banco de dados | PostgreSQL 16 |
| Cache | Redis 7 |
| ORM | TypeORM (não Prisma — arquivo CLAUDE.md antigo estava errado) |
| Autenticação | JWT access (15min) + refresh (7d) |
| Pagamentos | Asaas (PIX; sandbox e produção) |
| IA | DeepSeek API (compatível com OpenAI SDK) |
| Containerização | Docker Compose |
| Deploy | Coolify + Traefik (VPS Hostinger) |

---

## Estrutura de pastas

```
apps/
  api/src/
    auth/             JWT, registro, login, refresh
    users/            Perfil, avatar, ELO
    matches/          CRUD partidas, PGN, histórico
    matchmaking/      Filas casual e duelo, desafios diretos
    game/             WebSocket Gateway (/game namespace)
    friends/          Amizades, status online
    messages/         Chat privado
    notifications/    Entrega e persistência de notificações
    ranking/          Top 100
    reviews/          Avaliações pós-partida
    wallet/           Saldo CC, crédito/débito atômico, transações
    asaas/            Cliente Asaas (PIX deposits/withdrawals)
    webhooks/         Recepção do webhook Asaas
    tournaments/      Duelos, torneios, brackets, prêmios, anti-fraude
    deepseek/         Cliente DeepSeek (anti-cheat, suporte, análise)
    user-activity/    Rastreamento de atividade para anti-cheat
    platform-config/  Configurações dinâmicas (maintenance mode, etc.)
    support/          Tickets de suporte
    admin/            Endpoints do painel admin, AdminUser, audit log
    entities/         Todas as entidades TypeORM
    database/         Configuração do banco

  web/src/
    pages/            Uma página por rota
    components/       Componentes reutilizáveis
    hooks/            useSound, useAuth, etc.
    store/            Zustand: auth.store, game.store, social.store
    lib/              api.ts (axios), socket.ts

  admin/src/
    pages/            Dashboard, Users, Transactions, Tournaments, Support, Staff, Maintenance
    components/       Charts, DataTable, UI helpers, AdminLayout, Sidebar
    guards/           AdminGuard, RoleGuard
    lib/              admin-api.ts, admin-socket.ts
    store/            admin-auth.store.ts
```

---

## Módulos NestJS registrados em app.module.ts

AuthModule, UsersModule, MatchesModule, MatchmakingModule, GameModule, FriendsModule, MessagesModule, NotificationsModule, RankingModule, ReviewsModule, WalletModule, AsaasModule, TournamentsModule, WebhooksModule, DeepseekModule, UserActivityModule, PlatformConfigModule, SupportModule, AdminModule.

Throttler global: 20 req / 60s.

---

## WebSocket (game.gateway.ts)

Namespace `/game`. JWT obrigatório no handshake.

**Rooms:**
- `user:${userId}` — sala pessoal para eventos sociais e matchmaking
- `game:${matchId}` — sala da partida

**Eventos críticos:**
- `leave_game` — cliente deve emitir ao sair da página de jogo para evitar que relógios de partidas antigas continuem atualizando a UI
- `match_found` — emitido no room `user:${userId}` de cada jogador; sempre usar handler nomeado no `socket.off` para não remover listeners globais

**Pitfall importante (já corrigido):** `socket.off('match_found')` sem referência de handler remove TODOS os listeners daquele evento, incluindo os do `SocialSocketManager` em `App.tsx`. Sempre passar a referência: `socket.off('event', handlerFn)`.

---

## Matchmaking

**Casual:** array em memória, pareamento pelo ELO mais próximo.

**Duel:** Map keyed por `"${type}:${fee}"` (ex: `"FLASH:10"`). Tipos: FLASH (3+2) e GIANT (10+0). Taxas: 6, 10, 20 CC. Débito ocorre no momento da formação da partida, não na entrada na fila.

**`GET /matchmaking/sizes`** — retorna `{ casual: number, duel: Record<string, number> }`. Frontend faz polling a cada 10s para indicadores de atividade de fila.

---

## Economia (Chess Coins)

- 1 CC = 1 BRL
- Depósitos: Asaas cria cobrança PIX, webhook confirma → credita CC
- Saques: delay de 25min → análise heurística (movimentos sub-1.5s) → análise DeepSeek se disponível → transferência via Asaas
- Taxa de saque: 2% (mínimo 2 CC)
- Débitos de duelo/torneio: pessimistic lock no banco para evitar race conditions
- Webhook Asaas: validado via header `asaas-access-token`; token em `ASAAS_WEBHOOK_TOKEN`

---

## Torneios

**Duelos (1v1 ranqueados):**
- Criados via convite de amigo ou fila pública por tipo+taxa
- Prêmio = 90% do pool (rake 10%)
- Antes de liberar prêmio: análise anti-fraude DeepSeek (SLA 60min); se timeout, libera automaticamente

**Torneios customizados:**
- Criados por usuários com taxa de criação + taxa de entrada
- 4 a 64 jogadores, eliminatória simples
- Bracket gerado com shuffle determinístico (seed = tournament ID)
- 3º lugar para torneios com ≥8 jogadores
- Rodadas agendadas automaticamente a cada 30s após conclusão da rodada anterior
- Auto-cancelamento por estagnação: aviso com 24h, cancelamento com 48h sem novos jogadores

---

## Painel admin

Aplicação separada em `apps/admin/` (porta 5174). Autenticação independente com `ADMIN_JWT_SECRET`, tokens de 4h.

**Roles:** SUPORTE, FINANCEIRO, OPERADOR, ADMIN.

**Fluxo de login (2 fatores):**
1. Admin informa e-mail + senha → backend valida credenciais
2. Se válido, envia código OTP de 6 dígitos por email (TTL 10 min, one-time use)
3. Admin insere o código → recebe JWT de acesso
- Bloqueio automático após 3 tentativas erradas de OTP (5 min, Redis)
- Novo admin criado via Staff recebe senha temporária por email e é forçado a redefinir no primeiro acesso (`mustChangePassword`)
- URL do email configurada via variável `ADMIN_URL`

**Sessão única:** ao logar em outro dispositivo, a sessão anterior é invalidada imediatamente na próxima requisição (`adminSession:{adminId}` no Redis, TTL 4h).

**Módulos implementados:** Dashboard, Users (lista + detalhe), Transactions, Tournaments (lista + detalhe), Support (tickets + detalhe), Staff, Maintenance, AuditLogs, UserActivity.

**IA no admin:** análise de risco de usuário, chatbot, sumário de ticket, relatório de partida, perfil comportamental — tudo via DeepSeek.

---

## Design System (web)

| Token | Hex | Uso |
|-------|-----|-----|
| `--color-bg` | `#0C0B13` | Fundo principal |
| `--color-surface` | `#1E1D2E` | Cards e painéis |
| `--color-surface-2` | `#373855` | Elementos secundários |
| `--color-primary` | `#3D4AEB` | Ações principais |
| `--color-danger` | `#B15653` | Perigo, derrota |
| `--color-text` | `#FFFFFF` | Texto principal |
| `--color-text-muted` | `#8B8CA7` | Texto secundário |

Fonte: **DM Sans** (Google Fonts), pesos 400/500/700.

---

## Variáveis de ambiente (produção)

```env
# Banco
POSTGRES_DB=megachess
POSTGRES_USER=chess
POSTGRES_PASSWORD=

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=
ADMIN_JWT_SECRET=

# URLs (usadas no docker-compose.prod.yml)
APP_URL=https://megachess.io
ADMIN_URL=https://admin.megachess.io

# Asaas
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_ENV=production   # ou sandbox

# DeepSeek
DEEPSEEK_API_KEY=
```

---

## Convenções

- **NestJS:** módulo por domínio; controllers finos, lógica nos services
- **React:** componentes em PascalCase, hooks em camelCase com prefixo `use`
- **Estado global:** Zustand (`auth.store`, `game.store`, `social.store`)
- **API REST:** prefixo `/api/v1/`
- **WebSocket namespace:** `/game` (única namespace para partidas e social)
- **Validação backend:** `class-validator` + `class-transformer`
- **Sem comentários desnecessários:** nomes auto-descritivos; comentar apenas WHY não-óbvio
- **Sem mocks de banco em testes** (se existirem): usar banco real

---

## Estado atual do desenvolvimento (2026-06-28)

### Implementado e funcionando
- Auth completo (registro, login, refresh, logout, avatar)
- Perfil de usuário (edição, histórico, stats, ELO)
- Matchmaking casual com pareamento por ELO
- Matchmaking de duelo por tipo e taxa
- Partidas em tempo real com relógio, chat, sons
- Promoção de peão via modal customizado
- Modo offline vs IA (3 dificuldades, sons, delay)
- Sistema de amigos (pedidos, chat privado, status online)
- Notificações em tempo real + persistidas
- Ranking ELO
- Histórico de partidas
- Carteira (CC), depósito PIX via Asaas, saque com anti-cheat
- Torneios e duelos (motor completo backend)
- Frontend de duelos com indicadores de atividade de fila
- Painel admin (UI completa, módulos: dashboard, users, transactions, tournaments, support, staff, maintenance)
- DeepSeek integrado (anti-cheat, análise de risco de saque, suporte admin)

### Parcialmente implementado / pendente
- Frontend de torneios customizados (exibe "em breve")
- Testes automatizados (serão removidos futuramente)

### Notas técnicas relevantes
- Relógio por partida: `clock_update` no intervalo de 1s; cliente emite `leave_game` ao sair para evitar atualizações residuais de partidas anteriores
- `onPromotionCheck={() => false}` no `<Chessboard>` desativa o dialog nativo do react-chessboard; a promoção é tratada pelo modal customizado
- Filas de matchmaking são in-memory (não sobrevivem a restart da API); escala vertical apenas
