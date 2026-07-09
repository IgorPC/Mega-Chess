# Mega Chess Online — Handoff Document

Documento de contexto completo para continuidade do projeto por qualquer agente ou desenvolvedor.
**Última atualização:** 2026-07-01 (sistema de indicações, feature toggles, validação de formulários com Zod, sugestões de melhoria, melhorias financeiras)

---

## Índice

1. [O que é o projeto](#1-o-que-é-o-projeto)
2. [Stack e Estrutura de Arquivos](#2-stack-e-estrutura-de-arquivos)
3. [Estado Atual do Desenvolvimento](#3-estado-atual-do-desenvolvimento)
4. [Backend — O que está implementado](#4-backend--o-que-está-implementado)
5. [Frontend — O que está implementado](#5-frontend--o-que-está-implementado)
6. [Infraestrutura e Deploy](#6-infraestrutura-e-deploy)
7. [Modelo de Negócio e Pagamentos](#7-modelo-de-negócio-e-pagamentos)
8. [Decisões Técnicas Importantes](#8-decisões-técnicas-importantes)
9. [Bugs Corrigidos](#9-bugs-corrigidos)
10. [O que ainda NÃO está implementado](#10-o-que-ainda-não-está-implementado)
11. [Próximas Features Planejadas](#11-próximas-features-planejadas)
12. [Variáveis de Ambiente](#12-variáveis-de-ambiente)
13. [Como rodar localmente](#13-como-rodar-localmente)

---

## 1. O que é o projeto

**Mega Chess Online** é uma plataforma de xadrez competitivo online com:
- Partidas em tempo real via WebSocket
- Sistema de ranking ELO
- Matchmaking automático e desafios entre amigos
- Sistema social (amigos, chat privado, notificações)
- **Torneios pagos com moeda virtual ($CC = Chess Coins)** integrados ao gateway de pagamento **Asaas** via PIX
- Histórico de partidas, reviews de jogadores e modo offline contra IA (Stockfish)
- **Denúncia de partida com análise por IA** (DeepSeek v4-flash)
- **Tickets de suporte** com mensagens e anexos
- **Logs de atividade do usuário** para auditoria

**Domínio de produção:** `https://megachess.io`
**Domínio de homologação:** `https://homologa.megachess.io`
**Repositório GitHub:** `IgorPC/Mega-Chess-Online` (privado)

---

## 2. Stack e Estrutura de Arquivos

```
mega-chess/
├── docker-compose.yml          # Dev: todos os serviços em Docker com hot-reload
├── docker-compose.prod.yml     # Prod: build otimizado, sem serviço admin (ainda não existe)
├── CLAUDE.md                   # Especificação completa do projeto
├── BUSINESS_MODEL.md           # Modelo de negócio e precificação
├── ASAAS_INTEGRATION.md        # Guia técnico completo da integração Asaas
├── ADMIN_PANEL.md              # Especificação completa do painel administrativo (planejado)
├── HANDOFF.md                  # Este arquivo
├── apps/
│   ├── api/                    # NestJS (porta 3000)
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── app.module.ts           # Importa todos os módulos novos
│   │       ├── main.ts                 # CORS multi-origem, MaintenanceGuard global, cria uploads/tickets/
│   │       ├── database/               # TypeORM config + todas as 26 entidades registradas
│   │       ├── entities/               # 26 entidades TypeORM (ver seção 4)
│   │       ├── auth/
│   │       ├── users/
│   │       ├── matches/                # + MatchReportsService + rotas de denúncia
│   │       ├── matchmaking/
│   │       ├── game/                   # WebSocket Gateway (/game namespace)
│   │       ├── friends/
│   │       ├── messages/
│   │       ├── notifications/
│   │       ├── ranking/
│   │       ├── reviews/
│   │       ├── wallet/                 # + DeepSeek no anti-cheat de saque
│   │       ├── tournaments/
│   │       ├── asaas/
│   │       ├── webhooks/
│   │       ├── deepseek/               # ← Novo: cliente DeepSeek API
│   │       ├── user-activity/          # ← Novo: log de ações do usuário
│   │       ├── platform-config/        # ← Novo: configurações dinâmicas (manutenção, taxas)
│   │       ├── support/                # ← Novo: tickets de suporte do jogador
│   │       └── common/
│   │           └── guards/
│   │               ├── maintenance.guard.ts   # ← Novo: 503 quando maintenance_mode=true
│   │               └── banned-user.guard.ts   # ← Novo: 403 quando User.bannedUntil > now
│   ├── web/                    # React + Vite (porta 5173 dev / 80 prod)
│   │   ├── Dockerfile
│   │   ├── nginx.conf
│   │   └── src/
│   │       ├── pages/          # 16 páginas (+ SupportPage + TicketDetailPage)
│   │       ├── components/
│   │       │   └── ui/
│   │       │       └── ReportMatchModal.tsx  # ← Novo
│   │       ├── store/          # Zustand (auth, game, social)
│   │       ├── lib/            # api.ts (+ handlers 503/403) + socket.ts
│   │       └── styles/
│   └── admin/                  # ← Implementado: Painel administrativo (React + Vite + MUI)
│       ├── Dockerfile
│       ├── src/
│       │   ├── pages/          # LoginPage + 8 páginas (Dashboard, Users, Transactions, Tournaments, Support, Maintenance, Staff, Profile)
│       │   ├── components/     # Layout, sidebar, guards
│       │   ├── lib/            # admin-api.ts (cliente tipado)
│       │   ├── store/          # admin-auth.store.ts (Zustand)
│       │   └── types.ts        # interfaces AdminUser, SupportTicket, Tournament, etc.
│       └── vite.config.ts      # proxy /api → http://api:3000
└── cypress/                    # Testes E2E Cypress
    ├── e2e/
    └── support/
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
| WebSocket | Socket.IO | — |
| Testes E2E | Cypress | — |
| Containerização | Docker + Docker Compose | — |
| Reverse Proxy (prod) | Nginx (dentro do container web) | — |
| SSL + Routing (prod) | Traefik (gerenciado pelo Coolify) | — |
| Hospedagem | Hostinger VPS + Coolify | — |
| Pagamentos | Asaas (PIX) | v3 |
| IA | DeepSeek API (`deepseek-v4-flash`) | — |

---

## 3. Estado Atual do Desenvolvimento

### Concluído
- [x] Monorepo + Docker Compose (dev e prod)
- [x] Docker dev com hot-reload completo para API e Web (volumes nomeados)
- [x] Backend NestJS com 20 módulos implementados
- [x] 26 entidades TypeORM com `synchronize: true`
- [x] Auth (registro, login, refresh token, logout) — com log de atividade
- [x] Perfil de usuário (CRUD, upload de avatar, CPF, chave PIX)
- [x] WebSocket Gateway para partidas em tempo real
- [x] Timer de 60 segundos por lance (server-side)
- [x] ELO calculado ao fim de cada partida (K=32)
- [x] Matchmaking (fila de busca por rating próximo)
- [x] Desafio direto entre amigos
- [x] Sistema de amigos (solicitação, aceitar, remover)
- [x] Chat de partida e mensagens privadas
- [x] Notificações em tempo real com ações inline
- [x] Ranking (top 100)
- [x] Reviews de jogadores
- [x] Frontend com 16 páginas completas
- [x] Design system implementado (tema escuro, DM Sans, paleta definida)
- [x] GamePage: modal de promoção, preview de movimentos, feedback visual completo
- [x] OfflineGamePage: Stockfish com detecção completa de empate e motivo
- [x] Módulo Wallet (depósito e saque PIX via Asaas)
- [x] Módulo Tournaments (criação, inscrição, rake, distribuição de prêmios)
- [x] Módulo Webhooks (callbacks Asaas)
- [x] Deploy na Coolify (homologa.megachess.io)
- [x] CORS multi-origem (`main.ts` faz split por vírgula)
- [x] Testes E2E com Cypress
- [x] **DeepseekModule** — cliente nativo `fetch`, sem pacote `openai`, log de uso em `ai_usage_logs`
- [x] **UserActivityModule** — log fire-and-forget de 50+ ações do usuário
- [x] **PlatformConfigModule** — tabela key-value com cache 10s; endpoint público `GET /config/public`
- [x] **SupportModule** — tickets de suporte com mensagens, notas internas e upload de anexos
- [x] **MatchReportsModule** — denúncia de partida com análise DeepSeek assíncrona + apelação
- [x] **MaintenanceGuard** — global, retorna 503 quando `platform_config.maintenance_mode = 'true'`
- [x] **BannedUserGuard** — 403 quando `User.bannedUntil > now`
- [x] `User.bannedUntil` e `User.bannedReason` adicionados à entidade
- [x] Auth loga `AUTH_REGISTER`, `AUTH_LOGIN`, `AUTH_LOGIN_FAILED`, `AUTH_LOGOUT`
- [x] Anti-cheat de saque usa DeepSeek (HIGH risk = bloqueia) + heurística local prévia
- [x] Frontend: `SupportPage` + `TicketDetailPage` + `ReportMatchModal`
- [x] Frontend: novos tipos de notificação (`MATCH_REPORT_RESULT`, `ACCOUNT_SUSPENDED`, `ADMIN_MESSAGE`)
- [x] Frontend: handler 503 (manutenção) e 403 (banimento) em `api.ts` via `CustomEvent`
- [x] Frontend: badge `warning` adicionado ao componente `Badge`

### Concluído recentemente
- [x] **Painel Admin — Frontend** (`apps/admin/`) — React + Vite + MUI completo (porta 5174)
- [x] **Painel Admin — Backend** (`apps/api/src/admin/`) — todos os módulos implementados
- [x] `AdminUser` + `AdminAuditLog` entities adicionadas ao `ALL_ENTITIES`
- [x] `AdminModule` registrado no `AppModule`
- [x] Seed script para criar primeiro admin (`src/admin/seed-admin.ts`)
- [x] **EmailModule** — nodemailer SMTP SSL, 7 templates HTML com branding Mega Chess, fire-and-forget
- [x] **Verificação de email no cadastro** — token UUID (24h), login bloqueado até confirmar, resend, idempotência
- [x] **VerifyEmailPage** — estados: loading / success / expired / used / invalid; resend integrado
- [x] **RegisterPage** atualizado — sem login automático pós-cadastro; tela de "verifique seu email"
- [x] **LoginPage** atualizado — detecta `EMAIL_NOT_VERIFIED` / `EMAIL_VERIFICATION_EXPIRED`, exibe botão de resend
- [x] **PlatformRevenueModule** — entidade `platform_revenue`, tracking de rake e taxas; endpoints admin
- [x] **Dashboard admin** — `rakeToday` corrigido para ler de `platform_revenue` (antes era sempre 0)
- [x] Endpoints admin: `GET /admin/platform-revenue/summary|history|chart`
- [x] **ReferralsModule** — sistema de indicação completo: entidades `Referral` + `ReferralEarning`, geração lazy de código único (8 chars base64url), bônus 50% da taxa de saque ao indicador no momento de cada saque aprovado, máximo 10 indicações elegíveis por usuário
- [x] **Admin — Tela de Indicações** (`ReferralsAdminPage.tsx`) — lista de indicações com status de elegibilidade e ganhos
- [x] **Admin — Card "Bônus de Indicação"** movido de Dashboard → Transações > Visão Financeira com filtro de período
- [x] **Feature toggles via platform_config** — `deposits_enabled`, `withdrawals_enabled`, `referrals_enabled`; WalletPage e ProfilePage respeitam os toggles em tempo real via `GET /config/public`
- [x] **Correção de chaves camelCase → snake_case** no `platform-config.service.ts` (LEGACY_KEY_MAP) e em `admin-maintenance.service.ts` (KEY_MAP + REVERSE_KEY_MAP); corrige situação em que toggles do admin eram gravados como camelCase mas lidos como snake_case, fazendo com que valores sempre retornassem o default 'true'
- [x] **ProfilePage — seção de Indicações** — exibe código único de indicação + botão copiar link; verifica `referrals_enabled` antes de renderizar; código gerado on-demand para usuários antigos sem código
- [x] **ProfilePage — bugs de hooks** corrigidos — `useCallback` e `useEffect` movidos para antes dos early returns (`if (loading)`, `if (!profile)`), respeitando Rules of Hooks
- [x] **Taxa de saque atualizada** — de 2%/mínimo 2 CC para **4%/mínimo 3 CC**
- [x] **Validação de formulários** com `react-hook-form` + `zod` em fluxos críticos (login, registro, edição de perfil)

### Planejado (não iniciado)
- [ ] Desabilitar `synchronize: true` e usar migrations em prod
- [ ] Swap no servidor VPS (evitar OOM)
- [ ] MFA por email/TOTP para roles ADMIN e OPERADOR no painel admin
- [ ] App mobile React Native (futuro)

---

## 4. Backend — O que está implementado

### Entidades TypeORM (`apps/api/src/entities/`) — 26 entidades

| Entidade | Tabela | Destaques |
|---|---|---|
| `User` | `users` | rating ELO, isOnline, avatarUrl, cpf, pixKey, asaasCustomerId, **bannedUntil**, **bannedReason**, **emailVerified**, **emailVerificationToken**, **emailVerificationExpiresAt** |
| `RefreshToken` | `refresh_tokens` | token UUID, expiresAt |
| `Match` | `matches` | fen, pgn, moves (jsonb com elapsed_ms por lance), enums MatchStatus/MatchResult, isOffline |
| `Friendship` | `friendships` | enum: PENDING/ACCEPTED/BLOCKED |
| `Message` | `messages` | chat privado entre amigos |
| `MatchChatMessage` | `match_chat_messages` | chat dentro da partida |
| `Notification` | `notifications` | type + payload jsonb (novos tipos: MATCH_REPORT_RESULT, ADMIN_MESSAGE, MAINTENANCE_ALERT, ACCOUNT_SUSPENDED) |
| `Review` | `reviews` | unique(reviewerId, matchId) |
| `Wallet` | `wallets` | userId (unique), balance (decimal string) |
| `WalletTransaction` | `wallet_transactions` | type, amount, balanceAfter, referenceId |
| `Deposit` | `deposits` | valueBrl, asaasPaymentId, qrCode, copyPaste, status |
| `Withdrawal` | `withdrawals` | valueCc, valueBrl, fee, pixKey, asaasTransferId, blockReason, status |
| `Tournament` | `tournaments` | type, status, entryFee, prize, rake |
| `TournamentParticipant` | `tournament_participants` | tournamentId, userId, position, prizeWon |
| `TournamentMatch` | `tournament_matches` | partidas dentro do torneio |
| `AsaasEvent` | `asaas_events` | webhooks recebidos (idempotência) |
| `UserActivityLog` | `user_activity_logs` | **Novo** — userId, action (enum 50+ valores), metadata jsonb, ipAddress, userAgent |
| `AiUsageLog` | `ai_usage_logs` | **Novo** — feature, model, promptTokens, outputTokens, costUsd, referenceId |
| `PlatformConfig` | `platform_config` | **Novo** — key (PK), value, description, updatedBy, updatedAt |
| `SupportTicket` | `support_tickets` | **Novo** — userId, category, title, status, priority, slaDeadline |
| `TicketMessage` | `ticket_messages` | **Novo** — ticketId, senderType (USER/ADMIN), content, isInternal |
| `TicketAttachment` | `ticket_attachments` | **Novo** — messageId, filename, originalName, mimeType, filePath, fileSizeKb |
| `MatchReport` | `match_reports` | **Novo** — matchId, reporterId, reportedUserId, aiVerdict, aiConfidence, aiFlags, aiExplanation, aiRawResponse (jsonb), unique(matchId, reporterId) |
| `MatchReportAppeal` | `match_report_appeals` | **Novo** — reportId (unique), userId, note, status |
| `AdminUser` | `admin_users` | **Novo** — name, email, passwordHash, role (enum), isActive, mfaEnabled, mfaSecret, lastLoginAt |
| `AdminAuditLog` | `admin_audit_logs` | **Novo** — adminId, adminName, action, targetType, targetId, details, ipAddress |
| `PlatformRevenue` | `platform_revenue` | **Novo** — type (RAKE_DUEL/RAKE_TOURNAMENT/WITHDRAWAL_FEE/CREATION_FEE), amountCc, referenceId, description, createdAt |
| `Referral` | `referrals` | **Novo** — referrerId, referredId, isEligible (boolean), createdAt |
| `ReferralEarning` | `referral_earnings` | **Novo** — referrerId, referredId, amount (decimal), withdrawalId, createdAt |

### UserAction enum (50+ valores)
```typescript
// Categorias: AUTH_*, MATCH_*, SOCIAL_*, FINANCIAL_*, TOURNAMENT_*, PROFILE_*, SUPPORT_*, ADMIN_*
// Exemplos: AUTH_LOGIN, AUTH_LOGIN_FAILED, MATCH_REPORTED, MATCH_REPORT_APPEALED,
//           SUPPORT_TICKET_CREATED, SUPPORT_TICKET_REPLIED, WALLET_DEPOSIT, WALLET_WITHDRAWAL
```

### AiFeature enum
```typescript
WITHDRAWAL_RISK | MATCH_REPORT | TICKET_SUMMARY | SUPPORT_CHATBOT | MATCH_ANALYSIS | USER_PROFILE_SUMMARY
```

### Módulos do Backend

**Auth** (`/api/v1/auth`)
- `POST /register` — cria conta, envia email de confirmação, retorna `{ requiresEmailVerification: true }` (sem JWT)
- `POST /login` — bloqueia com `EMAIL_NOT_VERIFIED` ou `EMAIL_VERIFICATION_EXPIRED` se não confirmado; log `AUTH_LOGIN`
- `GET /verify-email?token=` — valida token UUID, marca email como verificado, retorna JWT; idempotente
- `POST /resend-verification` — gera novo token, reenvia email; throttle 2/min; sempre retorna `{ sent: true }`
- `POST /refresh`
- `POST /logout` — requer JWT, log `AUTH_LOGOUT`

**Platform Config** (`/api/v1/config`)
- `GET /config/public` — **sem auth** — retorna fees, matchmaking settings, maintenance, e `features` (depositsEnabled, withdrawalsEnabled, referralsEnabled)
- Cache em memória com TTL 10s; `DEFAULTS` objeto com todos os valores padrão
- Tabela `platform_config` é a fonte da verdade
- Chaves persistidas em snake_case (`deposits_enabled`, `withdrawals_enabled`, etc.)

**Referrals** (`/api/v1/referrals`)
- `GET /referrals/me` — lista indicações do usuário autenticado com totais ganhos
- `GET /referrals/my-code` — retorna código único (gerado on-demand se não existir) + link de cadastro
- Bônus: 50% da taxa de saque (arredondado para baixo) creditado ao indicador a cada saque aprovado do indicado, desde que elegível (máx 10 indicações elegíveis)
- Elegibilidade do indicado: email verificado + pelo menos 1 depósito realizado
- Código: 8 chars base64url uppercase, único por usuário, gravado em `User.referralCode`

**Support** (`/api/v1/support`)
- `POST /tickets` — cria ticket (categoria + título + descrição vira primeira mensagem)
- `GET /tickets` — lista tickets do usuário (paginado)
- `GET /tickets/:id` — detalhe (mensagens internas ADMIN filtradas da visão do usuário)
- `POST /tickets/:id/messages` — resposta do usuário
- `POST /tickets/:ticketId/messages/:messageId/attachments` — upload (JPEG/PNG/WEBP/PDF, max 10MB)
- `GET /tickets/:ticketId/attachments/:attachmentId` — download via `StreamableFile`
- SLA automático: HIGH=2h, MEDIUM=8h, LOW=24h
- Arquivos em `uploads/tickets/` (criado automaticamente no `main.ts`)

**Match Reports** (`/api/v1/matches`)
- `POST /matches/:id/report` — cria denúncia; valida: partida online finalizada, máx 72h, máx 3/dia, sem duplicata
- `GET /matches/:id/report` — status da denúncia do usuário autenticado
- `POST /matches/:id/report/appeal` — apela veredicto CLEAN (janela 48h)
- Análise assíncrona: extrai `elapsed_ms` dos lances → DeepSeek → veredicto (CLEAN/SUSPICIOUS/CHEATING) → notificação WebSocket tipo `MATCH_REPORT_RESULT`
- Se DeepSeek indisponível: status `UNDER_REVIEW` (revisão manual)

**DeepSeek** (serviço interno)
```typescript
// Model: deepseek-v4-flash ($0.14/M input, $0.28/M output)
// Base URL: https://api.deepseek.com/v1
// Usa native fetch, sem pacote openai
// isAvailable getter: false quando DEEPSEEK_API_KEY está vazia (dev)
// analyze<T>(feature, systemPrompt, userPrompt, referenceId?, maxTokens=500): Promise<T | null>
// streamChat(systemPrompt, messages): AsyncGenerator<string>
// Loga uso em ai_usage_logs após cada chamada (fire-and-forget)
// Timeout: 30s em analyze, 60s em stream
```

**Admin** (`/api/v1/admin`) — **Novo, implementado**

Sistema de autenticação e gestão separado dos jogadores. JWT próprio (`ADMIN_JWT_SECRET`), 4h de expiração, strategy nomeada `'admin-jwt'` (não conflita com `'jwt'` dos jogadores).

| Rota | Roles | Descrição |
|------|-------|-----------|
| `POST /admin/auth/login` | público | Login admin; retorna accessToken ou mfa_token |
| `POST /admin/auth/mfa/verify` | público | Verifica TOTP (Google Authenticator) |
| `GET /admin/auth/me` | qualquer admin | Dados do admin logado |
| `GET /admin/dashboard/kpis` | qualquer | Métricas do dia |
| `GET /admin/dashboard/top-winners` | qualquer | Top 10 ganhadores (7d) |
| `GET /admin/dashboard/alerts` | qualquer | Alertas ativos |
| `GET /admin/users` | qualquer | Lista usuários com filtro/busca |
| `GET /admin/users/export` | FINANCEIRO+ | CSV de usuários |
| `GET /admin/users/:id` | qualquer | Detalhe + saldo wallet |
| `POST /admin/users/:id/suspend` | qualquer | Suspender (1h/6h/24h/7d/30d/permanent) |
| `POST /admin/users/:id/force-logout` | qualquer | Invalida refresh tokens |
| `PATCH /admin/users/:id/elo` | qualquer | Ajusta rating (100-3000, motivo obrigatório) |
| `GET /admin/transactions` | FINANCEIRO+ | Transações paginadas |
| `GET /admin/withdrawals` | FINANCEIRO+ | Saques com filtro de status |
| `GET /admin/deposits` | FINANCEIRO+ | Depósitos paginados |
| `POST /admin/withdrawals/:id/approve` | FINANCEIRO+ | Aprova saque bloqueado |
| `POST /admin/withdrawals/:id/reject` | FINANCEIRO+ | Rejeita + estorna $CC |
| `POST /admin/transactions/refund` | ADMIN | Crédito manual |
| `GET /admin/transactions/rake-summary` | FINANCEIRO+ | Rake agrupado por data |
| `GET /admin/tournaments` | qualquer | Lista com filtro de status |
| `POST /admin/tournaments/:id/start` | qualquer | Força início |
| `POST /admin/tournaments/:id/cancel` | qualquer | Cancela + estorna buy-ins |
| `DELETE /admin/tournaments/:id/participants/:userId` | qualquer | Remove participante + estorna |
| `GET /admin/support/tickets` | qualquer | Lista tickets com search/filter |
| `POST /admin/support/tickets/:id/messages` | qualquer | Responde ticket |
| `GET /admin/support/tickets/:id/ai-summary` | qualquer | Resumo IA (DeepSeek) |
| `GET /admin/maintenance/metrics` | OPERADOR+ | CPU/RAM/DB/uptime |
| `GET /admin/maintenance/config` | ADMIN | Lê platform_config |
| `PUT /admin/maintenance/config` | ADMIN | Atualiza platform_config |
| `GET /admin/staff` | ADMIN | Lista admins |
| `POST /admin/staff` | ADMIN | Cria novo admin |
| `POST /admin/staff/:id/deactivate` | ADMIN | Desativa admin |
| `GET /admin/audit-logs` | ADMIN | Logs de auditoria |
| `PATCH /admin/me/password` | qualquer | Muda própria senha |
| `POST /admin/me/mfa/setup` | qualquer | Inicia setup TOTP |
| `POST /admin/me/mfa/confirm` | qualquer | Confirma TOTP |

**Email** (`apps/api/src/email/`) — **Novo, implementado**
- `EmailModule` global (`@Global()`) com nodemailer SMTP SSL (porta 465)
- `EmailService.send*()` — todos fire-and-forget (erros logados, não propagados)
- Templates HTML inline com branding Mega Chess (cores, logo SVG, DM Sans)
- Métodos: `sendEmailConfirmation`, `sendDepositCreated`, `sendDepositConfirmed`, `sendWithdrawalRequested`, `sendTicketOpened`, `sendTicketUpdated`, `sendReportReceived`
- Variáveis: `SMTP_HOST`, `SMTP_PORT` (465), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Link de confirmação usa `APP_URL` do env

**Platform Revenue** (`apps/api/src/platform-revenue/`) — **Novo, implementado**
- `PlatformRevenueModule` global com `PlatformRevenueService`
- `record(type, amountCc, referenceId, description)` — fire-and-forget
- Pontos de registro: rake de duelo (tournaments.service), rake de torneio, taxa de criação, taxa de saque (wallet.service)
- Métodos de consulta: `summary()`, `history(page, limit)`, `chartByPeriod(days)`, `todayTotal()`
- Endpoints admin: `GET /admin/platform-revenue/summary|history|chart`

**Hierarquia de roles:** SUPORTE(1) < FINANCEIRO(2) < OPERADOR(3) < ADMIN(4)  
**MFA obrigatório para:** OPERADOR e ADMIN  
**TOTP implementado com Node.js `crypto`** (sem `otplib`) — compatível com Google Authenticator  

**Guards globais** (aplicados em `main.ts`)
- `MaintenanceGuard` — lê `platform_config.maintenance_mode`, retorna 503 se `'true'`; exemptions: `/config/public`, `/auth/login`, `/auth/refresh`, `/admin/*`
- `BannedUserGuard` — verifica `User.bannedUntil > now`, retorna 403 com motivo

**Wallet** — anti-cheat de saque atualizado:
1. Heurística local: lances com < 1.5s cada em > 90% dos lances → bloqueia imediatamente (custo zero)
2. Se DeepSeek disponível: análise das últimas 5 partidas → veredicto LOW/MEDIUM/HIGH; HIGH = bloqueia e estorna $CC

### CORS com múltiplas origens (`main.ts`)
```typescript
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost')
  .split(',').map(o => o.trim())
app.enableCors({
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  credentials: true,
})
```

---

## 5. Frontend — O que está implementado

### Páginas (`apps/web/src/pages/`)

| Arquivo | Rota | Descrição |
|---|---|---|
| `LoginPage.tsx` | `/` | Login — detecta `EMAIL_NOT_VERIFIED`/`EMAIL_VERIFICATION_EXPIRED`, exibe resend inline |
| `RegisterPage.tsx` | `/register` | Cadastro — após registro exibe tela "📬 verifique seu email" sem redirecionar |
| `VerifyEmailPage.tsx` | `/verify-email` | **Novo** — estados loading/success/expired/used/invalid; rota pública (sem guard) |
| `LobbyPage.tsx` | `/lobby` | Buscar partida, amigos online, desafios |
| `GamePage.tsx` | `/game/:id` | Tabuleiro online completo |
| `OfflineGamePage.tsx` | `/play/offline/game` | Jogo contra Stockfish |
| `OfflineSetupPage.tsx` | `/play/offline` | Escolha de dificuldade |
| `ProfilePage.tsx` | `/profile/:nickname` | Perfil público |
| `EditProfilePage.tsx` | `/profile/me` | Editar próprio perfil |
| `FriendsPage.tsx` | `/friends` | Amigos + chat privado |
| `NotificationsPage.tsx` | `/notifications` | Notificações com ações inline |
| `RankingPage.tsx` | `/ranking` | Top 100 |
| `HistoryPage.tsx` | `/history` | Histórico + botão 🚩 para denunciar partidas online (janela 72h) |
| `WalletPage.tsx` | `/wallet` | Depósito PIX, saque, extrato |
| `TournamentsPage.tsx` | `/tournaments` | Torneios |
| `SupportPage.tsx` | `/support` | **Novo** — lista tickets + modal de criação |
| `TicketDetailPage.tsx` | `/support/:ticketId` | **Novo** — thread de mensagens + reply + upload de anexo |
| `MaintenancePage.tsx` | — | **Novo** — tela de manutenção (disparada por evento 503) |

### Componentes novos
- `components/ui/ReportMatchModal.tsx` — modal de denúncia de partida; detecta se já existe denúncia, mostra veredicto + fluxo de apelação

### Fluxo de manutenção e banimento (`api.ts` → `App.tsx`)
```
API retorna 503 → api.ts dispara CustomEvent('platform:maintenance')
                → App.tsx intercepta → mostra MaintenancePage (sobrepõe tudo)

API retorna 403 com "suspensa" → api.ts dispara CustomEvent('account:banned')
                → App.tsx intercepta → mostra tela de banimento com motivo

api.ts → CustomEvent('auth:logout') no 401 sem refresh → App.tsx chama logout()
```

Todos os valores de `CustomEvent.detail` são validados como `string` e limitados a 500 chars antes de entrar no estado React.

### NotificationsPage — tipos de notificação
| Tipo | Componente | Descrição |
|---|---|---|
| `FRIEND_REQUEST` | `FriendRequestRow` | Aceitar/Recusar com ação inline |
| `GAME_CHALLENGE` | `ChallengeRow` | Aceitar/Recusar desafio |
| `MESSAGE_RECEIVED` | `MessageRow` | Navega para `/friends` |
| `GAME_STARTED` | `GenericRow` | Navega para `/game/:matchId` |
| `MATCH_REPORT_RESULT` | `MatchReportResultRow` | **Novo** — veredicto colorido (verde/amarelo/vermelho) |
| `ACCOUNT_SUSPENDED` | `AccountSuspendedRow` | **Novo** — texto em vermelho com motivo |
| `ADMIN_MESSAGE` | `GenericRow` | **Novo** — mensagem da administração |
| `MAINTENANCE_ALERT` | `GenericRow` | **Novo** — aviso de manutenção |

### Badge component — variantes
`primary | danger | success | muted | warning` (warning adicionado: amarelo `#e6a817`)

### Segurança XSS (scan realizado 2026-06-26)
- Zero `dangerouslySetInnerHTML` em código novo
- `_messageId` em DOM via `any` cast corrigido → `useRef<string | null>()`
- Validação de MIME dupla em upload: `file.type` **e** extensão do filename
- `CustomEvent.detail` validado como string primitiva com limite de 500 chars
- `target="_blank"` com `rel="noreferrer"` (implica `noopener`) em todos os links de anexo

---

## 6. Infraestrutura e Deploy

### Dev local

```bash
docker compose up
```

Serviços disponíveis:
| Serviço | Porta | Acesso |
|---------|-------|--------|
| PostgreSQL | 5432 | `localhost:5432` |
| Redis | 6379 | `localhost:6379` |
| API NestJS | 3000 | `http://localhost:3000` |
| Web (Vite HMR) | 80 | `http://localhost` |
| Admin (Vite HMR) | 5174 | `http://localhost:5174` — quando criado |

- Volumes nomeados (`api_node_modules`, `web_node_modules`) isolam binários do container
- TypeORM `synchronize: true` cria/atualiza tabelas automaticamente
- `DEEPSEEK_API_KEY` com default vazio — não consome créditos em dev

### Produção (Coolify)

**Servidor:** Hostinger VPS — IP `72.61.129.87`, 3.8GB RAM, **sem swap**
**Plataforma:** Coolify v4 (self-hosted)
**SSL:** Traefik (Let's Encrypt automático)

**docker-compose.prod.yml — serviços ativos:**
- `db` (PostgreSQL 16)
- `redis` (Redis 7)
- `api` (NestJS)
- `web` (React via Nginx)
- ~~`admin`~~ — **removido** até `apps/admin/` ser criado (build falhava com "no such file or directory")

**Variáveis críticas no Coolify:**
- `ASAAS_API_KEY` — marcar **"Is Literal?"** (valor começa com `$aact_`)
- `ASAAS_WEBHOOK_TOKEN` — idem se contiver `$`
- `DEEPSEEK_API_KEY` — adicionar ao Coolify; marcar "Is Literal?" se necessário
- `ADMIN_JWT_SECRET` — a adicionar ao implementar o admin

**OOM em builds simultâneos:** com 3.8GB sem swap, builds paralelos podem ser mortos. Considerar:
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
```

### Nginx (`apps/web/nginx.conf`)
- `/` → React SPA (fallback para `index.html`)
- `/api` → proxy para `api:3000`
- `/socket.io` → proxy WebSocket com `Upgrade` e timeout 3600s
- `/uploads` → proxy para `api:3000`

### Testes E2E (Cypress)
```bash
npx cypress open           # interface visual
npx cypress run            # headless
npx cypress install --force  # se "No version installed"
```

---

## 7. Modelo de Negócio e Pagamentos

**Documentação completa em:** `BUSINESS_MODEL.md` e `ASAAS_INTEGRATION.md`

### Moeda virtual: Chess Coins ($CC)
- 1 BRL = 1 $CC (conversão 1:1 no depósito)
- Taxa de saque: **4% (mínimo 3 $CC)**
- $CC existe apenas no banco — Asaas só processa BRL

### Modalidades de jogo pagas

| Modalidade | Entrada | Jogadores | Rake | Pote |
|---|---|---|---|---|
| Duelo Relâmpago | 10 $CC | 2 | 10% | 18 $CC |
| Duelo de Gigantes | 50 $CC | 2 | 10% | 90 $CC |
| Torneio Faísca | 5 $CC | 8–16 | configurável | — |
| Torneio Tempestade | 5 $CC | 32 | configurável | — |
| Grande Torneio | 15 $CC | 64 | 15% | 816 $CC |

Taxas configuráveis via tabela `platform_config` (endpoints admin, a implementar).

### Gateway: Asaas
- **Depósito:** PIX → QR Code + copia-e-cola + expiresAt → webhook `PAYMENT_RECEIVED` → crédita $CC
- **Saque:** transferência PIX → webhook `TRANSFER_DONE`/`TRANSFER_FAILED`
- Delay anti-cheat de 25min antes do PIX de saque (setTimeout — migrável para BullMQ)
- Retry automático: 3 tentativas com exponential backoff para 5xx/429

---

## 8. Decisões Técnicas Importantes

### TypeORM em vez de Prisma
Prisma removido por problemas com binários no Windows. TypeORM com `synchronize: true` em dev. **Em prod futura: desabilitar e usar migrations explícitas.**

### DeepSeek: native fetch, sem pacote openai
Evita rebuild de container para instalar dependência. Usa `fetch` nativo do Node 18+. `DEEPSEEK_BASE = 'https://api.deepseek.com/v1'`. Model padrão: `deepseek-v4-flash`.

### Sistema de prompts com cache (DeepSeek)
System prompts são strings **fixas** no topo da conversa = cache automático (98% mais barato nos tokens de input). **Nunca concatenar dados dinâmicos dentro do system prompt** — isso quebra o cache e multiplica o custo.

### IA apenas por ação explícita do usuário
Detecção por-jogada descartada (custo proporcional ao volume). IA acionada somente quando: usuário clica "Denunciar partida", usuário solicita saque, admin pede análise. Cada call loga custo em `ai_usage_logs`.

### Anti-cheat em duas camadas
1. Heurística local gratuita (detecção de lances uniformes < 1.5s)
2. DeepSeek apenas se heurística não pegou e API disponível

### CORS multi-origem
`CORS_ORIGIN` no env como string separada por vírgula. `main.ts` faz split. Em prod: `https://homologa.megachess.io,https://homologa.admin.megachess.io`.

### `ASAAS_API_KEY` com "Is Literal?" no Coolify
Valor começa com `$aact_`. Coolify interpreta `$` como variável de shell → string vazia. Flag "Is Literal?" desativa interpolação. **Sempre marcar para variáveis cujo valor começa com `$`.**

### Admin removido do docker-compose.prod.yml
O serviço `admin` foi removido porque `apps/admin/` ainda não existe. Adicionar de volta quando o Dockerfile for criado.

### Verificação de email — token mantido após uso (idempotência)
`emailVerificationToken` nunca é nulificado após verificação bem-sucedida. O `verifyEmail()` detecta `user.emailVerified = true` e retorna novos tokens direto, sem validar expiração. Assim, re-clicar no link de confirmação ou ter múltiplas abas abertas não gera erros. O token é substituído apenas no reenvio (`resendVerification`), o que invalida links anteriores — a `VerifyEmailPage` exibe o estado `'used'` nesses casos.

### Platform Config — normalização de chaves camelCase → snake_case
O frontend do admin enviava chaves em camelCase (`depositsEnabled`) que eram salvas assim no banco. `PlatformConfigService.getPublicConfig()` lia as chaves em snake_case (`deposits_enabled`), não as encontrava e retornava o DEFAULTS = `'true'`. Resultado: toggles do admin eram ignorados.

**Solução em duas camadas:**
1. `admin-maintenance.service.ts` — `KEY_MAP` converte camelCase→snake_case ao salvar; `REVERSE_KEY_MAP` converte snake_case→camelCase ao ler de volta para o admin.
2. `platform-config.service.ts` — `LEGACY_KEY_MAP` normaliza rows camelCase já existentes no banco ao carregar em cache.

Não exigiu migration — qualquer row legada é corrigida on-the-fly na próxima leitura.

### Sistema de Indicações (Referral)
- Entidades: `Referral` (par referrerId/referredId + flag isEligible) e `ReferralEarning` (bônus creditado por evento de saque)
- Código gerado lazy: usuários criados antes do sistema obterão código na primeira chamada a `GET /referrals/my-code`; até 10 tentativas de unicidade com `randomBytes(6).toString('base64url').toUpperCase().slice(0, 8)`
- Cadastro via link `?ref=CODE`: `AuthService.register()` processa o parâmetro `referralCode` e cria o registro `Referral`
- Bônus pago em `wallet.service.ts` no momento de aprovação do saque, via `ReferralsService.handleWithdrawalBonus()`

### Platform Revenue — bookkeeping explícito
A tabela `platform_revenue` registra explicitamente cada centavo retido pela plataforma. `wallet_transactions` continuava registrando débitos e créditos de usuários normalmente; o rake era calculado mas nunca persistido em lugar algum (o campo `rakeToday` do dashboard sempre retornava 0). A solução foi criar uma tabela dedicada com inserts fire-and-forget em cada ponto de geração de receita. Não usa subconta Asaas (não disponível no plano atual).

### api.ts — 401 de verificação de email não dispara refresh
O interceptor de 401 lê o body da resposta antes de decidir se faz refresh. Se `body.message.code` existir (email verification codes), lança `ApiError` direto sem tentar refresh nem limpar localStorage. Isso evita que o fluxo de verificação seja interrompido por lógica de autenticação.

### Logout agora requer JWT
`POST /auth/logout` passou a exigir `@UseGuards(JwtAuthGuard)` e a assinatura mudou para `logout(userId, token, req?)`. Testes em `auth.service.spec.ts` atualizados para refletir a nova assinatura.

---

## 9. Bugs Corrigidos

| Bug | Causa | Solução |
|---|---|---|
| Reload infinito no frontend | `window.location.href = '/'` no 401 + `fetchMe` sem checar token | Removido redirect; `fetchMe` checa token antes |
| Forfeit/timeout "Derrota" para ambos | Só checava `WHITE_WINS`/`BLACK_WINS` | Cobre todos os 7 valores de MatchResult |
| `port already allocated` no Coolify | `ports: "80:80"` conflitando com Traefik | Removida seção `ports` em prod |
| Prisma erro em Windows | Binários incompatíveis | Migração para TypeORM |
| Upload de avatar falhando | `api.ts` enviava `Content-Type: application/json` em FormData | Detecta `instanceof FormData`; omite Content-Type |
| `ASAAS_API_KEY` vazia no container | Var não estava no bloco `environment` do compose prod | Adicionada ao `docker-compose.prod.yml` |
| `ASAAS_API_KEY` ainda vazia | Valor começa com `$aact_` — Coolify interpreta como shell var | Marcar "Is Literal?" no Coolify |
| Cypress "No version installed" | Binário corrompido | `npx cypress install --force` |
| Modal de promoção bugando UI | Modal renderizado in-place próximo à peça | Overlay `position: fixed` centralizado |
| Empate sem motivo (offline) | `resolveResult()` com checklist incompleto | Checklist em ordem: stalemate → repetição → material → isDraw |
| Preview de movimentos ausente | Prop `customSquareStyles` não implementado | `onSquareClick` calcula estilos e passa via prop |
| Deploy falhando: "no Dockerfile" | `admin` service no compose prod apontava para `apps/admin/` inexistente | Removido `admin` service do `docker-compose.prod.yml` |
| TypeScript: `logout` com 1 argumento | Assinatura mudou para `logout(userId, token, req?)` mas specs chamavam com 1 arg | Specs atualizados para `service.logout('user-id', 'token')` |
| `_messageId` via `any` em nó DOM | Estado armazenado em propriedade não-tipada no DOM | `useRef<string \| null>()` tipado |
| MIME spoofing no upload | `file.type` bypassável | Validação dupla: `file.type` + extensão do `file.name` |
| Admin login retorna 500 | Vite proxy apontando para `http://localhost:3000` (não resolve dentro do Docker) | `VITE_API_URL: http://api:3000` no docker-compose |
| Todas as rotas admin retornam 403 | Passport popula `request.user` mas guard/decorator liam `request.admin` | `AdminRolesGuard` e `@CurrentAdmin()` corrigidos para `request.user` |
| `process.emit` com evento customizado falha TS | `process.emit` tipado só aceita `Signals` | Cast para `NodeJS.EventEmitter` em `admin-maintenance.service.ts` |
| `Cannot read properties of undefined ('databaseName')` | TypeORM não resolve `orderBy` em queries com `leftJoin` + `addSelect` + `getManyAndCount` | Substituído por `findAndCount` + query separada para enrich de nickname |
| `operator does not exist: uuid = character varying` | Colunas UUID comparadas com `$1` (varchar) em queries raw | Cast `::uuid` adicionado em todos os parâmetros de queries raw |
| `invalid input value for enum matches_status_enum: "IN_PROGRESS"` | Enum do banco é `ONGOING`, não `IN_PROGRESS` | Corrigido em `admin-dashboard.service.ts` |
| Status de torneio não filtrado corretamente | Frontend envia `OPEN`/`COMPLETED` mas banco usa `REGISTERING`/`FINISHED` | Mapeamento adicionado em `admin-tournaments.service.ts` |
| `DEEPSEEK_API_KEY` ignorada em dev | docker-compose setava var para string vazia (default `:-`), sobrescrevendo `.env` | Linha removida do compose; NestJS lê diretamente do `apps/api/.env` |
| Login sem feedback de erro | 401 disparava `admin:logout` event antes de exibir o erro, causando reload | Guard de logout só dispara quando havia token ativo (`localStorage.getItem('adminToken')`) |
| Colisão de nome `participants` e `tickets` | Propriedade do repositório com mesmo nome do método no service | Renomeados para `participantRepo` e `ticketRepo` |
| `ProfilePage` "Rendered more hooks than during the previous render" | `useCallback` (loadReferrals) e `useEffect` declarados após early returns `if (loading)` / `if (!profile)` | Todos os hooks movidos para antes dos early returns (Rules of Hooks) |
| `WalletPage` `/platform-config` retorna 404 | URL errada; controller está em `@Controller('config')` com `@Get('public')` | Corrigido para `/config/public` |
| Feature toggles sempre retornam `true` | Admin salvava camelCase no banco; leitura era snake_case; fallback era DEFAULTS='true' | Adicionados KEY_MAP em maintenance.service e LEGACY_KEY_MAP em platform-config.service |
| `GET /referrals/my-code` retorna `{referralCode: null}` | Usuários criados antes do sistema não têm código gerado | `getMyCode()` gera e persiste código on-demand se `user.referralCode` for nulo |

---

## 10. O que ainda NÃO está implementado

### Outras
- Migrations TypeORM explícitas (substituir `synchronize: true` em prod)
- Swap no servidor VPS
- Espectador de partidas
- App mobile React Native

---

## 11. Próximas Features Planejadas

### Prioridade 1 — Hardening do Admin
- [ ] Adicionar `admin` service ao `docker-compose.prod.yml` com Dockerfile e nginx
- [ ] Testar fluxo completo em homologação
- [ ] Adicionar `ADMIN_JWT_SECRET` no Coolify

### Prioridade 2 — Hardening
1. Migrations TypeORM (substituir `synchronize: true`)
2. Swap 2GB no VPS
3. Adicionar `admin` service de volta ao `docker-compose.prod.yml`
4. Expandir cobertura de testes Cypress

### Prioridade 3 — Features de usuário
1. Chatbot de suporte com DeepSeek streaming
2. Análise explicada de partida (Stockfish + DeepSeek)
3. Espectador de partidas em andamento

---

## 12. Variáveis de Ambiente

### Dev (`docker-compose.yml` — já configurado nos defaults)

```env
DATABASE_URL=postgresql://chess:chess_secret@db:5432/megachess
REDIS_URL=redis://redis:6379
JWT_SECRET=megachess_jwt_secret_change_in_prod
JWT_REFRESH_SECRET=megachess_refresh_secret_change_in_prod
ADMIN_JWT_SECRET=megachess_admin_jwt_secret_change_in_prod
PORT=3000
CORS_ORIGIN=http://localhost,http://localhost:5174
ASAAS_API_KEY=           # sandbox key para testes
ASAAS_WEBHOOK_TOKEN=     # qualquer string em dev
ASAAS_ENV=sandbox
DEEPSEEK_API_KEY=        # deixar vazio em dev para não consumir créditos
```

### Prod (Coolify — Environment Variables)

| Variável | Obrigatória | Observação |
|----------|-------------|-----------|
| `POSTGRES_PASSWORD` | ✅ | Senha forte |
| `JWT_SECRET` | ✅ | String aleatória longa |
| `JWT_REFRESH_SECRET` | ✅ | String aleatória longa |
| `ADMIN_JWT_SECRET` | ao implementar admin | Secret separado do JWT dos jogadores |
| `ASAAS_API_KEY` | ✅ | **Marcar "Is Literal?"** — começa com `$aact_` |
| `ASAAS_WEBHOOK_TOKEN` | ✅ | Marcar "Is Literal?" se contiver `$` |
| `ASAAS_ENV` | ✅ | `sandbox` ou `production` |
| `DEEPSEEK_API_KEY` | ✅ (IA ativa em prod) | Marcar "Is Literal?" se necessário |
| `ADMIN_JWT_SECRET` | ✅ (painel admin) | Secret separado do JWT dos jogadores |
| `APP_URL` | ✅ | URL base do frontend — usada nos links dos emails de verificação |
| `ADMIN_URL` | opcional | default: `https://homologa.admin.megachess.io` |
| `SMTP_HOST` | ✅ | Ex: `smtp.hostinger.com` |
| `SMTP_PORT` | opcional | default: `465` (SSL) |
| `SMTP_USER` | ✅ | Ex: `automatico@megachess.io` |
| `SMTP_PASS` | ✅ | Senha do email SMTP |
| `SMTP_FROM` | opcional | default: `"Mega Chess <automatico@megachess.io>"` |

---

## 13. Como rodar localmente

### Pré-requisitos
- Docker Desktop instalado e rodando

### Subir tudo (recomendado)
```bash
cd D:\Claude\mega-chess
docker compose up
```

| URL | Serviço |
|-----|---------|
| `http://localhost` | Frontend Web (Vite HMR) |
| `http://localhost:3000` | API NestJS |
| `http://localhost:5174` | Painel Admin (quando criado) |

### Rebuild de um serviço específico
```bash
docker compose up --build api     # rebuild só do backend
docker compose up --build web     # rebuild só do frontend
```

### Ver logs em tempo real
```bash
docker compose logs -f api        # logs da API
docker compose logs -f web        # logs do Vite
```

### Painel Admin
```bash
# Criar o primeiro usuário admin (rodar uma vez após subir os containers)
docker exec megachess-api-dev npx ts-node -r tsconfig-paths/register src/admin/seed-admin.ts

# Credenciais padrão do seed:
# Email: admin@megachess.io
# Senha: Admin@123456!
# (configurável via ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME no .env)

# Acessar o painel:
# http://localhost:5174
```

### Testar DeepSeek localmente
```bash
# Editar apps/api/.env e adicionar:
DEEPSEEK_API_KEY=sua_key_aqui
# Reiniciar o container:
docker compose restart api
```

### Cypress
```bash
npx cypress open                  # interface visual
npx cypress run                   # headless
npx cypress install --force       # se der "No version installed"
```

### Verificar variáveis dentro do container
```bash
docker compose exec api printenv | grep -E 'ASAAS|DEEPSEEK|JWT'
```
