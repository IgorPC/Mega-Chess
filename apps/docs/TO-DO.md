# TO-DO — Mega Chess Online

Ordem de execução planejada. Cada item inclui considerações técnicas detalhadas.

---

## 🐛 Bugs conhecidos

### BUG-01 — Duelo por convite: apenas um jogador entra na partida

**Sintoma:** Após aceitar um convite de duelo entre amigos, em alguns casos somente o jogador que aceitou (ou somente o invitador) é redirecionado para `/game/:matchId`. O outro jogador permanece no lobby sem navegar.

**Causa raiz provável:**  
O redirecionamento de ambos os jogadores depende exclusivamente do evento WebSocket `match_found` emitido via `emitToUser(userId, 'match_found', ...)` → `server.to('user:${userId}').emit(...)`. Se um dos dois jogadores **não estiver na sala `user:${userId}` no momento da emissão** (socket desconectado, reconectando, ou não ter feito `join_social` ainda), o evento é perdido — Socket.IO não tem garantia de entrega para clientes offline, e não há reenvio.

O fluxo é:
1. `POST /tournaments/invite/:id/accept` → `acceptDuelInvite()` → `startDuel()` → `emitMatchFound()`
2. `tournament.gateway.ts` emite `match_found` para ambos via `emitToUser`
3. `App.tsx → SocialSocketManager` ouve `match_found` e chama `navigate('/game/:matchId')`

Se o socket do invitador estiver momentaneamente desconectado (ex: tela em background em mobile, tab inativa, reconexão em andamento), o evento é disparado e descartado.

**Soluções possíveis (em ordem de complexidade):**

1. **Fallback por polling no frontend (mais simples):** Após aceitar o convite, o `DuelInvitePopup` já recebe o `matchId` na resposta HTTP do `POST /accept`. Usar essa resposta para navegar imediatamente sem depender do WebSocket — pelo menos o aceitante sempre entra. Para o invitador, o mesmo: após qualquer `match_found` perdido, incluir o `matchId` no endpoint de status do torneio para que o frontend possa consultar.

2. **Reemissão por polling no backend:** Após criar a partida, salvar `matchId` no torneio. Criar endpoint `GET /tournaments/:id/status` que retorna `{ status, matchId }`. Frontend do invitador faz poll a cada 2s enquanto o popup está visível.

3. **Socket.IO rooms + ack:** Usar `socket.emit(..., callback)` com acknowledgment e retentar se o ack não vier dentro de 3s (requer Socket.IO v4 `volatile` + retry logic).

4. **Persistência de evento pendente (mais robusto):** Salvar o evento `match_found` em Redis com TTL de 30s. Quando o socket do usuário reconectar e emitir `join_social`, verificar se há evento pendente e reemitir.

**Solução recomendada (curto prazo):** Opção 1 — o `matchId` já está disponível na resposta HTTP do `POST /accept`. Redirecionar o aceitante direto pela resposta REST e, para o invitador, expor o `matchId` na resposta do `POST /invite` ou por polling de status do torneio.

**Arquivos afetados:**
- `apps/api/src/tournaments/tournaments.service.ts` — `startDuel()` / `emitMatchFound()`
- `apps/api/src/tournaments/tournament.gateway.ts` — `matchFoundEmitter` callback
- `apps/web/src/components/ui/DuelInvitePopup.tsx` — aceitar convite e navegar
- `apps/web/src/App.tsx` — `SocialSocketManager` listener de `match_found`

### BUG-02 — Relógio da partida: tempo oscila de forma inconsistente

**Sintoma:** Durante a partida, o contador de tempo de cada jogador avança de forma irregular — ora corre rápido demais, ora pula valores, ora não pausa corretamente após a jogada ser realizada. Em alguns casos o tempo do jogador inativo também continua diminuindo.

**Causa raiz provável:**  
O relógio é controlado pelo servidor em `game.gateway.ts` via `setInterval` de 1 segundo. O problema é que o servidor envia `clock_update` com os valores calculados subtraindo o `elapsed = Date.now() - lastTurnStart` do relógio em memória — mas o cliente também faz a sua própria contagem regressiva local para suavizar a exibição. Se houver múltiplos `join_game` para o mesmo `matchId` (reconexão, dois sockets do mesmo usuário), dois intervalos ficam rodando em paralelo e os eventos se sobrepõem. Além disso, ao receber um `clock_update` do servidor, o cliente precisa sincronizar seu contador local com o valor recebido; se isso não acontece, as duas contagens divergem.

**Requisitos de funcionamento esperado:**
- O relógio de cada jogador só avança quando é a vez dele
- Ao enviar uma jogada, o tempo para imediatamente para quem jogou
- Ao receber `move_broadcast`, o cliente sincroniza o relógio com os valores do `clock_update` recebido logo em seguida
- Se o tempo de um jogador chegar a 0, a partida termina automaticamente com derrota por tempo (`TIMEOUT_WHITE` ou `TIMEOUT_BLACK`)
- O relógio local do cliente deve ser reiniciado sempre que receber `clock_update` do servidor (fonte de verdade)

**Arquivos afetados:**
- `apps/api/src/game/game.gateway.ts` — lógica do intervalo e emissão de `clock_update`
- `apps/web/src/pages/GamePage/GamePage.tsx` (ou componente Clock) — recepção de `clock_update` e renderização do contador

**Prioridade:** Alta — o tempo é um dos principais indicadores da plataforma e afeta a experiência e a integridade dos duelos.

---

### ~~BUG-03 — Análise de movimentos com IA retorna "serviço indisponível"~~ ✅ CONCLUÍDO (2026-06-28)

**Causa raiz identificada:** `max_tokens: 1500` era insuficiente para o JSON de resposta completo (whiteAnalysis + blackAnalysis + flags + explanation). O JSON era truncado e o `JSON.parse` falhava silenciosamente, retornando `null` → `ERROR`.

**Correções aplicadas:**
- `max_tokens` aumentado de 1500 → 4000 em `analyzeMatchWithAi()`
- `DeepseekService.analyze()` agora loga `finish_reason='length'` com warning explícito e isola `JSON.parse` em try/catch próprio com log do raw content para diagnóstico futuro
- Análise salva em `tournament_matches.ai_analysis` (JSONB) para evitar re-análise

---

## 1. ~~Remover todos os testes atuais~~ ✅ CONCLUÍDO (2026-06-28)

**O que foi feito:**
- Deletados 12 arquivos `*.spec.ts` em `apps/api/src/`
- `jest.config.js` removido
- Scripts `test`, `test:watch`, `test:cov`, `test:verbose` removidos de `apps/api/package.json`
- Dependências de teste removidas de `apps/api`: `@nestjs/testing`, `@types/jest`, `@types/supertest`, `jest`, `supertest`, `ts-jest`
- Diretório `apps/web/cypress/` removido (8 arquivos `.cy.ts` + support)
- `apps/web/cypress.config.ts` removido
- Scripts `test:e2e` e `test:e2e:open` removidos de `apps/web/package.json`
- Dependência `cypress` removida de `apps/web/package.json`

---

## 2. ~~Bloquear tudo relacionado a torneios no painel Admin~~ ✅ CONCLUÍDO (2026-06-28)

**O que foi feito:**
- Sidebar renomeada de "Campeonatos" → "Competições"
- Aba "Torneios" dentro de Competições mantida como disabled ("em breve") — código preservado para lançamento futuro
- Aba "Duelos" implementada com sub-abas "Em andamento" e "Concluídos" com paginação
- Histórico de jogadas por partida de duelo com detalhamento de peça, origem, destino, captura e tempo
- Análise anti-cheat por IA (DeepSeek) com veredicto, confiança, flags e análise por jogador
- Análise persistida em `tournament_matches.ai_analysis` para evitar re-análise
- Vencedor exibido corretamente na lista de concluídos (via `tournaments.champion_id`) e em Partidas/Chaveamento (mapeando todos os 6 tipos de resultado)
- Resultado da partida exibido em português com chip colorido (desistência, timeout, xeque-mate, empate)

---

## 3. ~~Envio de EMAIL via SMTP~~ ✅ CONCLUÍDO (2026-06-28)

**O que foi implementado:**
- `EmailModule` global (`apps/api/src/email/`) com `nodemailer` via SMTP SSL porta 465
- `EmailService` com 7 métodos fire-and-forget com templates HTML (branding Mega Chess completo)
- Confirmação de cadastro com token UUID (24h TTL) — login bloqueado até confirmar
- Endpoints `GET /auth/verify-email?token=` e `POST /auth/resend-verification`
- Idempotência: token mantido no banco após verificação (re-clique retorna tokens em vez de 404)
- Frontend: `VerifyEmailPage`, `RegisterPage` com tela de "verifique seu email", `LoginPage` com resend inline
- Emails disparados em: registro, depósito criado, depósito confirmado, saque solicitado, ticket aberto, ticket respondido (admin), denúncia recebida
- Link de verificação usa `APP_URL` do env (não hardcoded)
- Variáveis: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`


---

## 3b. ~~Rastreamento de receita da plataforma (PlatformRevenue)~~ ✅ CONCLUÍDO (2026-06-28)

**O que foi implementado:**
- Entidade `platform_revenue` com enum `PlatformRevenueType` (RAKE_DUEL, RAKE_TOURNAMENT, WITHDRAWAL_FEE, CREATION_FEE)
- `PlatformRevenueModule` global com `PlatformRevenueService` (record, summary, history, chartByPeriod, todayTotal)
- Rake gravado em: duelos via fila (`tournaments.service.ts → finalizeDuelMatch`), torneios customizados (`distributeTournamentPrizes`), taxa de criação (`createCustomTournament`), taxa de saque (`wallet.service.ts`)
- KPI `rakeToday` no dashboard admin agora lê de `platform_revenue` (era sempre 0 antes)
- Endpoints admin: `GET /admin/platform-revenue/summary`, `/history`, `/chart?days=N`

---

## 4. ~~Logs de debug, info, warning e erro no backend~~ ✅ CONCLUÍDO (2026-06-28)

**O que foi feito:**
- Logger NestJS adicionado em todos os controllers e services
- Todos os controllers têm try/catch em cada método — nunca retornam stack trace ao cliente, sempre `InternalServerErrorException` para erro 500
- Nenhum silent fail: todos os `.catch(() => {})` substituídos por `.catch((err) => logger.warn/error(...))`
- Módulos corrigidos: `AdminDashboardController`, `AdminProfileController`, `AdminAuditService`, `PlatformRevenueService`, `DeepseekService` (usage log)
- Pattern padrão adotado: `if (err instanceof HttpException) throw err; logger.error(...); throw new InternalServerErrorException()`

~~**O que fazer:**~~
- Substituir/complementar o `Logger` padrão do NestJS por uma solução estruturada: `winston` ou `pino` (mais performático)
- Configurar `WinstonModule` globalmente no `AppModule`
- Usar níveis: `debug` (detalhes de lógica), `info` (fluxo normal), `warn` (anomalias não críticas), `error` (falhas com stack trace)
- Em produção: saída JSON para facilitar ingestão por ferramentas de observabilidade (Loki, Datadog, etc.)
- Em desenvolvimento: saída colorizada e legível

**O que logar em cada módulo:**

| Módulo | Exemplos de log |
|--------|----------------|
| Auth | `[INFO] user:${id} logged in`, `[WARN] failed login attempt for ${email}` |
| Matchmaking | `[INFO] match created: ${matchId} (${white} vs ${black})`, `[DEBUG] queue size: ${n}` |
| Game Gateway | `[DEBUG] move received: ${matchId} ${move}`, `[WARN] move rejected: not your turn` |
| Wallet | `[INFO] deposit created: ${userId} R$${amount}`, `[ERROR] debit failed: insufficient balance` |
| Tournaments | `[INFO] tournament ${id} started with ${n} players`, `[INFO] prize released to ${userId}` |
| Asaas/Webhooks | `[INFO] webhook received: ${event} for payment ${id}`, `[WARN] webhook token mismatch` |
| DeepSeek | `[INFO] anti-cheat analysis: ${result} for match ${id}`, `[WARN] DeepSeek timeout, releasing prize` |
| Admin | `[INFO] admin:${adminId} performed ${action} on ${resource}:${resourceId}` |

**Considerações:**
- Nunca logar dados sensíveis: senhas, tokens JWT, chaves Asaas, dados de cartão
- Incluir `correlationId` (UUID por requisição, via middleware) nos logs para rastrear fluxos
- Configurar log rotation se gravando em arquivo; em produção preferir stdout → coletor externo

---

## 5. ~~Logs de ações para auditoria no painel Admin~~ ✅ CONCLUÍDO (2026-06-28)

**O que foi feito:**
- `AdminAuditService.list()` implementado com filtros: adminId, action (parcial), targetType, dateFrom, dateTo + paginação
- `AdminAuditService.exportCsv()` para exportação com os mesmos filtros
- `GET /admin/audit-logs` com todos os filtros via query params
- `GET /admin/audit-logs/export` para download CSV com auth via Bearer
- Login de admin auditado: `ADMIN_LOGIN`, `ADMIN_LOGIN_FAILED`, `ADMIN_LOGIN_MFA_REQUIRED`, `ADMIN_LOGIN_MFA_OK`, `ADMIN_LOGIN_MFA_FAILED`
- Senha alterada auditada: `ADMIN_PASSWORD_CHANGED`, `ADMIN_MFA_ENABLED`
- Config de plataforma auditada: `CONFIG_UPDATED` (com detalhes JSON das keys alteradas)
- Ações já existentes cobertas: ban/suspend, force logout, ELO adjust, saques, reembolso, torneios, staff CRUD
- Página `AuditLogsPage` no painel admin com: filtros, tabela paginada, chips coloridos por severidade, exportação CSV
- Rota `/audit-logs` adicionada (role ADMIN), entrada "Audit Log" no sidebar

---

## 6. ~~Impedir login simultâneo do mesmo usuário~~ ✅ CONCLUÍDO (2026-06-29)

**Abordagem recomendada:**
- Ao fazer login, gerar um `sessionToken` único (UUID) e salvar no Redis com key `session:${userId}` e TTL = validade do refresh token
- Incluir o `sessionToken` no payload do JWT (access e refresh)
- Em cada requisição autenticada, o guard valida JWT e consulta Redis: se `session:${userId}` não existe ou não bate com o `sessionToken` do JWT, retorna 401
- Ao fazer novo login, sobrescrever `session:${userId}` no Redis → sessão anterior invalida automaticamente

**Eventos WebSocket:**
- Quando o Redis detecta a sessão inválida no gateway WebSocket, emitir evento `session_invalidated` para o socket antigo e desconectá-lo
- Exibir mensagem no frontend: "Sua conta foi acessada em outro dispositivo"

**Alternativa com múltiplos dispositivos (futuro):**
- Se no futuro quiser permitir múltiplos dispositivos: usar `Set` no Redis por userId com lista de sessionTokens válidos; ao revogar, remover o token específico

**Considerações:**
- Logout explícito deve deletar `session:${userId}` do Redis
- Refresh de token deve manter o mesmo `sessionToken` (não gerar novo)
- Cuidado com race condition: se dois logins chegam simultaneamente, o último a escrever no Redis vence

---

## 6b. ~~Segurança e autenticação do painel Admin~~ ✅ CONCLUÍDO (2026-06-29)

**O que fazer:**

### Login via OTP apenas
- Remover a autenticação por senha+TOTP atual do painel admin
- Substituir por fluxo de OTP por email: admin informa o email → sistema envia código de 6 dígitos com validade de 10 minutos → admin insere o código e recebe o token JWT
- Endpoint `POST /admin/auth/request-otp` → envia email com código
- Endpoint `POST /admin/auth/verify-otp` → valida código e retorna `accessToken`
- Código armazenado no Redis com TTL de 10 minutos; invalidado após uso (one-time)
- Remover endpoints de TOTP (`/admin/auth/mfa/setup`, `/admin/auth/mfa/confirm`, `/admin/auth/mfa/verify`) e campos `mfaEnabled`/`mfaSecret` do `AdminUser`
- Atualizar `LoginPage` do admin para o novo fluxo de dois passos (email → OTP)

### Recuperação de senha do Admin via email
- Remover a dependência de senha no login (se o OTP for o único método, "recuperação de senha" passa a ser "reenvio de OTP" — fluxo já coberto acima)
- Manter campo `password` apenas para o fluxo de primeiro login com senha temporária (abaixo)

### Senha temporária no cadastro de novo admin
- Ao criar um novo admin via `POST /admin/staff`, gerar senha temporária aleatória (16 chars, alfanumérica)
- Enviar email para o novo admin com: boas-vindas, email de acesso e senha temporária
- Adicionar flag `mustChangePassword: boolean` na entidade `AdminUser` (default `true` em novos cadastros)
- No primeiro login, após autenticar com OTP, verificar `mustChangePassword`: se `true`, redirecionar para tela obrigatória de troca de senha antes de acessar o painel
- Endpoint `POST /admin/me/change-password` que valida a senha atual e define a nova; zera `mustChangePassword`

**Considerações:**
- O OTP por email elimina a necessidade de apps autenticadores (TOTP), reduzindo atrito operacional sem sacrificar segurança para um painel interno
- Email de OTP deve ter template visual consistente com o restante dos emails da plataforma
- Auditar tentativas de OTP inválido: 3 tentativas erradas → bloquear por 5 minutos (Redis)
- Logar todos os logins de admin com IP e timestamp no `AdminAuditLog`

---

## 6c. Recuperação de senha do usuário convencional via email ✅ CONCLUÍDO (2026-06-29)

**O que fazer:**
- Endpoint `POST /auth/forgot-password` → recebe `{ email }`, gera token UUID com TTL 1h salvo no banco (ou Redis), envia email com link `${APP_URL}/reset-password?token=...`
- Endpoint `POST /auth/reset-password` → recebe `{ token, newPassword }`, valida token, aplica hash bcrypt e salva nova senha, invalida o token
- Página `/reset-password?token=` no frontend web: formulário com "Nova senha" + "Confirmar senha" com validação de regras (mín. 8 chars, 1 maiúscula, 1 número)
- Página `/forgot-password` no frontend web: formulário com campo de email + botão "Enviar link de recuperação"
- Link "Esqueceu a senha?" na `LoginPage` apontando para `/forgot-password`
- Email de recuperação com template visual padrão da plataforma; não revelar se o email existe ou não (resposta genérica para evitar enumeração de usuários)

**Throttle:**
- `POST /auth/forgot-password` → 3 req / 60s por IP (conforme já planejado no item 8)

**Considerações:**
- Token de reset deve ser de uso único: invalidar após o primeiro `reset-password` bem-sucedido
- Caso o usuário faça outro pedido antes de usar o link, o token anterior deve ser invalidado e um novo gerado (apenas um token ativo por usuário)
- Não logar o token em nenhum log — apenas o `userId` e `createdAt`

---

## 7. Login com Google (OAuth 2.0)

**Implementação no backend:**
- Instalar `passport-google-oauth20` e `@nestjs/passport`
- Criar `GoogleStrategy` que recebe o perfil do Google e faz upsert de usuário: se email já existe, retorna o usuário; se não, cria com `password_hash = null` e `email_verified = true`
- Fluxo: `GET /auth/google` → redirect para Google → callback `GET /auth/google/callback` → redireciona para o frontend com JWT no query param ou cookie
- Usuários Google não precisam de confirmação de email (item 3) pois o Google já verifica

**Implementação no frontend:**
- Botão "Entrar com Google" na tela de login e registro
- Ao clicar, redireciona para `/api/v1/auth/google`; ao voltar do callback, salva o token e redireciona para `/lobby`
- Usuários criados via Google não têm senha; caso tentem definir senha depois, criar endpoint `POST /auth/set-password` (verificar que é o próprio usuário via JWT)

**Considerações:**
- Definir avatar inicial a partir da foto do Google (`picture` do perfil)
- Nickname inicial: derivar do `name` do Google (lowercase, sem espaços, com sufixo numérico se colidir)
- Variáveis novas: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- MFA de admin (item 3) deve ser exigido independentemente de como o admin faz login; Google OAuth não dispensa MFA para o painel

---

## 8. ~~Limite de requisições nas rotas públicas~~ ✅ CONCLUÍDO (2026-06-30)

**Gap encontrado:** o `ThrottlerModule.forRoot()` estava configurado no `AppModule` mas **nunca foi registrado como guard global** (faltava o provider `APP_GUARD`). Isso significava que só as rotas com `@UseGuards(ThrottlerGuard)` explícito em `auth.controller.ts` estavam protegidas — todo o resto da API (`admin/auth/request-otp`, `verify-otp`, `matchmaking/sizes`, `matchmaking/active-match`, etc.) não tinha limite algum.

**O que foi feito:**
- `LoggingThrottlerGuard` (`apps/api/src/common/guards/logging-throttler.guard.ts`) — extends `ThrottlerGuard`, loga `[WARN]` com IP + método + path a cada rejeição por limite excedido
- Registrado como `APP_GUARD` global no `AppModule` — agora **toda** rota é protegida pelo limite default (20 req/60s) salvo override por `@Throttle()`
- `ThrottlerExceptionFilter` (`apps/api/src/common/filters/throttler-exception.filter.ts`) — captura `ThrottlerException` e responde `429` com header `Retry-After: 60` e corpo JSON padronizado
- `app.set('trust proxy', 1)` no `main.ts` — `req.ip` agora reflete o IP real do cliente atrás do Traefik (1 hop), essencial para throttling e blacklist (item 9) por IP corretos
- Limites por rota com `@Throttle()`:
  - `POST /auth/login` → 5/60s
  - `POST /auth/register` → 3/60s
  - `POST /auth/resend-verification` → 2/60s
  - `POST /auth/forgot-password` → 3/60s
  - `POST /auth/reset-password` → 5/60s (não tinha limite antes)
  - `POST /admin/auth/request-otp` → 5/60s (não tinha limite antes)
  - `POST /admin/auth/verify-otp` → 10/60s (não tinha limite antes; lockout por tentativas erradas já existe via Redis em `AdminAuthService`)
  - `GET /matchmaking/sizes` e `GET /matchmaking/active-match` → 30/60s (polling legítimo do frontend a cada 5–10s)
- `POST /webhooks/asaas` → `@SkipThrottle()` — autenticado por token (`asaas-access-token`), não deve ser limitado por IP para não quebrar retries legítimos do Asaas
- `@UseGuards(ThrottlerGuard)` redundante removido de `auth.controller.ts` (guard global já cobre)

**Arquivos alterados:**
- `apps/api/src/common/guards/logging-throttler.guard.ts` (novo)
- `apps/api/src/common/filters/throttler-exception.filter.ts` (novo)
- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/admin/auth/admin-auth.controller.ts`
- `apps/api/src/matchmaking/matchmaking.controller.ts`
- `apps/api/src/webhooks/webhooks.controller.ts`

---

## 9. ~~Blacklist de IPs controlada pelo painel Admin~~ ✅ CONCLUÍDO (2026-06-30)

**O que foi feito:**
- Entidade `ip_blacklist` com campos: `ip` (unique), `reason`, `blockedBy`, `blockedByName`, `expiresAt` (null = permanente), `createdAt`
- `IpBlacklistMiddleware` global em `app.module.ts` — bloqueia IPs na primeira camada da API, antes de throttle e guards, retornando `403` com log `[WARN]`
- Cache Redis com `ip_blacklist:{ip}` — TTL sincronizado ao `expiresAt` da entidade (ou 10 anos para permanentes)
- Seed Redis no `onApplicationBootstrap` do service — IPs sobrevivem a restart da API
- Endpoints no admin: `GET/POST/PATCH/DELETE /admin/ip-blacklist` (role ADMIN)
- Auditoria automática em cada bloqueio/desbloqueio via `AdminAuditService` (ações: `IP_BLACKLISTED`, `IP_UNBLACKLISTED`, `IP_BLACKLIST_UPDATED`)
- Página `IpBlacklistPage` no painel admin: tabela paginada, filtro por IP, status (Ativo/Expirado/Permanente), dialogs para bloquear/editar/remover
- Rota `/ip-blacklist` adicionada (role ADMIN), entrada "IP Blacklist" no sidebar

**Arquivos criados:**
- `apps/api/src/entities/ip-blacklist.entity.ts`
- `apps/api/src/common/middleware/ip-blacklist.middleware.ts`
- `apps/api/src/admin/ip-blacklist/admin-ip-blacklist.service.ts`
- `apps/api/src/admin/ip-blacklist/admin-ip-blacklist.controller.ts`
- `apps/admin/src/pages/IpBlacklist/IpBlacklistPage.tsx`

**Arquivos alterados:**
- `apps/api/src/app.module.ts` — middleware global
- `apps/api/src/admin/admin.module.ts` — entity, service, controller
- `apps/api/src/database/database.module.ts` — entity
- `apps/admin/src/lib/admin-api.ts` — ipBlacklist client
- `apps/admin/src/types.ts` — IpBlacklistEntry
- `apps/admin/src/App.tsx` — rota /ip-blacklist
- `apps/admin/src/components/layout/Sidebar.tsx` — nav item

---

**Auto-bloqueio por excesso de requisições (adicionado em 2026-06-30):**
- `LoggingThrottlerGuard` rastreia violações por IP em Redis (`throttle_violations:{ip}`) com janela deslizante de 5 minutos
- Ao atingir 10 violações na janela → IP auto-bloqueado por 1 hora (salvo no banco com `blockedByName='Sistema'` + Redis)
- Parâmetros ajustáveis via constantes no guard: `VIOLATIONS_WINDOW_SECONDS`, `AUTO_BLOCK_THRESHOLD`, `AUTO_BLOCK_DURATION_SECONDS`
- Auto-bloqueios aparecem na página `/ip-blacklist` do painel admin e podem ser removidos manualmente

---

## ✅ 10. Validação de inputs com feedback visual na UI — CONCLUÍDO (2026-06-30)

**Implementação:**
- `react-hook-form` + `zod` + `@hookform/resolvers` instalados em `apps/web`
- Schemas compartilhados em `apps/web/src/lib/schemas.ts`
- `Input` component convertido para `React.forwardRef` para compatibilidade com `register()`
- Formulários reescritos: `RegisterPage`, `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `EditProfilePage`, `SupportPage` (CreateTicketModal)
- `CreateTournamentModal`: validação inline mantida (formulário muito complexo para rhf), com erro visual por campo no nome
- `WalletPage`: validação de withdraw melhorada inline

**Princípio geral:**
- Remover todos os atributos HTML de validação nativa (`required`, `minLength`, `maxLength`, `type="email"`, `pattern`, etc.) dos elementos `<input>` — eles geram popups do browser inconsistentes com o design do projeto
- Toda validação deve ser controlada pelo React, com mensagens de erro exibidas inline abaixo de cada campo

**Biblioteca recomendada:**
- `react-hook-form` + `zod` para validação baseada em schema
- `react-hook-form` elimina re-renders desnecessários (ref-based), integra bem com componentes customizados e expõe estado de erro por campo
- `zod` permite definir schemas reutilizáveis (ex: o schema de senha pode ser compartilhado entre registro e troca de senha)

**Padrão visual para todos os formulários:**

```
[ input com borda vermelha quando inválido ]
  ✕ Mensagem de erro clara e específica          ← aparece abaixo do campo
```

- Borda do input muda para `--color-danger` (`#B15653`) quando há erro
- Ícone de erro (✕) ou ícone de sucesso (✓) dentro ou ao lado do input quando validado
- Mensagem de erro em vermelho, fonte pequena (12px), aparece abaixo do campo
- Validação dispara `onBlur` (ao sair do campo) para não punir o usuário enquanto ainda digita; erros existentes atualizam `onChange`
- Botão de submit desabilitado ou com estado de loading enquanto aguarda resposta da API

**Formulários e campos a cobrir:**

| Formulário | Campos e regras |
|------------|----------------|
| Registro | Nome (mín. 2 chars), Apelido (mín. 3, só letras/números/underscore, único), Email (formato válido), Senha (mín. 8 chars, 1 maiúscula, 1 número), Confirmar senha (deve bater) |
| Login | Email (formato válido), Senha (não vazio) |
| Editar perfil | Nome (mín. 2 chars), Bio (máx. 300 chars com contador), Apelido (mesmas regras do registro) |
| Troca de senha | Senha atual (não vazio), Nova senha (mesmas regras), Confirmar nova senha |
| Depósito CC | Valor (número, mín. 10, máx. configurável, apenas inteiros) |
| Saque CC | Valor (número, mín. 10, saldo suficiente), Chave PIX (formato válido por tipo: CPF/CNPJ/email/telefone/aleatória) |
| Criar torneio | Nome (mín. 3, máx. 60 chars), Descrição (máx. 300), Nº de jogadores (4/8/16/32/64), Senha (se privado: mín. 4 chars) |
| Chat (partida e privado) | Mensagem (não vazio, máx. 500 chars, trim) |
| Formulário de suporte | Título (mín. 5, máx. 100), Descrição (mín. 20, máx. 2000) |
| Login admin | Email (formato válido), Senha (não vazio), Código MFA (6 dígitos numéricos, quando ativo) |

**Erros da API:**
- Erros retornados pela API (ex: "apelido já em uso", "saldo insuficiente") devem ser exibidos no mesmo padrão visual — no campo correspondente se mapeável, ou em um alerta inline no topo do formulário se genérico
- Nunca usar `alert()` ou `window.confirm()` nativos do browser

**Considerações:**
- Criar um componente `<FormField>` reutilizável que encapsula label, input e mensagem de erro para manter consistência visual em todos os formulários
- Upload de avatar: validar tipo (JPEG/PNG/WebP) e tamanho (máx. 2MB) antes do upload, exibindo erro inline antes de enviar ao servidor

---

## ✅ 11. Sistema de sugestões de melhorias com votos — CONCLUÍDO (2026-07-01)

**Visão geral:** área pública para usuários cadastrados sugerirem melhorias à plataforma, com sistema de votos semanal para priorização.

**Regras de negócio:**
- Cada usuário pode criar até **3 sugestões por semana** (janela: segunda a domingo)
- Cada usuário pode **votar até 10 vezes por semana** em sugestões (qualquer combinação, máx. 1 voto por sugestão)
- Usuário **não pode votar na própria sugestão**
- Sugestão pode ser **editada pelo autor** enquanto estiver com status `OPEN` e sem votos; após receber votos, bloqueada para edição (preserva integridade dos votos)
- Sugestão pode ser **deletada pelo autor** enquanto `OPEN` e sem votos
- Admin pode **ocultar** sugestões ofensivas sem precisar rejeitá-las formalmente (status `HIDDEN`)

**Entidades:**
- `improvement_suggestion`: `id`, `authorId`, `title`, `description`, `status` (OPEN | HIDDEN | COMPLETED | REJECTED), `adminNote` (motivo de rejeição/conclusão), `voteCount` (desnormalizado para performance de ordenação), `createdAt`, `updatedAt`
- `suggestion_vote`: `id`, `suggestionId`, `userId`, `createdAt` — unique constraint `(suggestionId, userId)`

**Contadores semanais (Redis):**
- `suggestions_created:{userId}:{week}` — TTL até fim da semana (domingo 23:59)
- `suggestion_votes:{userId}:{week}` — idem
- Semana calculada como ISO week (`YYYY-Www`) para consistência

**Backend (NestJS):**
- `SuggestionsModule` com controller público (JWT obrigatório) e controller admin
- `GET /suggestions?page=&limit=&status=` — lista paginada ordenada por `voteCount DESC, createdAt DESC`; usuário logado vê se já votou em cada sugestão (`myVote: boolean`)
- `POST /suggestions` — cria sugestão (verifica limite semanal via Redis)
- `POST /suggestions/:id/vote` — vota (verifica limite semanal + já votou + não é autor)
- `DELETE /suggestions/:id/vote` — remove voto (devolve o voto semanal ao usuário)
- Endpoints admin: `GET /admin/suggestions` (paginado, filtros: status, dateFrom, dateTo, authorId), `PATCH /admin/suggestions/:id` (status + adminNote)

**Frontend web:**
- Página `/suggestions` acessível via menu ou perfil
- Lista paginada com cards: título, descrição truncada, autor, data, contagem de votos, badge de status
- Botão de voto com animação; desabilitado se já votou ou se é o autor; contador de votos disponíveis na semana visível
- Formulário de criação: título (mín. 10, máx. 100 chars), descrição (mín. 30, máx. 1000 chars)
- Filtro por status (apenas sugestões `OPEN` visíveis por padrão para usuários; `COMPLETED` em aba separada)

**Painel admin:**
- Nova aba "Sugestões" (role ADMIN) com tabela paginada
- Filtros: status, data, autor
- Ações por linha: marcar como Concluída (com nota), Rejeitar (com motivo), Ocultar/Restaurar
- Badge com contagem de sugestões abertas no sidebar

**Considerações técnicas:**
- `voteCount` atualizado via transação no mesmo request do vote/unvote (não async) para manter consistência de ordenação
- Throttle adicional: `POST /suggestions` → 3/semana (controlado pelo Redis, não pelo ThrottlerGuard)
- Não expor `HIDDEN` para usuários normais (filtro backend obrigatório)

---

## ✅ 12. Sistema de reports de jogadores — Concluído em 2026-07-01

**Observação:** as entidades `MatchReport` e `MatchReportAppeal` já existem no banco. Verificar o que está implementado antes de codificar do zero.

**Regras de negócio:**
- Ao fim de cada partida, o jogador pode reportar o oponente — janela de **24 horas** após `finishedAt`
- **1 report por partida por jogador** (unique constraint `(matchId, reporterId)`)
- Categorias: CHEATING, ABUSIVE_CHAT, UNSPORTSMANLIKE, OTHER
- O reportado não é notificado do report (preserva integridade da investigação)

**Entidades (verificar se já existem):**
- `match_report`: `id`, `matchId`, `reporterId`, `reportedId`, `category`, `description`, `status` (PENDING | UNDER_REVIEW | RESOLVED), `resolution` (DISMISSED | WARNED | SUSPENDED | BANNED), `resolvedBy` (adminId), `resolvedAt`, `adminNote`, `createdAt`
- `player_ban`: `id`, `userId`, `bannedBy` (adminId), `reason`, `duration` (1|3|7|15|30|PERMANENT), `bannedUntil` (null = permanente), `createdAt` — se não houver campo `bannedUntil` no `User`, criar entidade separada ou adicionar campo

**Backend:**
- `POST /matches/:id/report` — cria report (verifica janela 24h, unicidade, que o reporter jogou a partida)
- Admin endpoints: `GET /admin/reports` (paginado, filtros: status, category, reportedId, dateFrom, dateTo), `GET /admin/reports/:id`, `PATCH /admin/reports/:id` (resolver com resolution + adminNote)
- `POST /admin/users/:id/ban` — body: `{ duration: 1|3|7|15|30|'PERMANENT', reason }` → seta `bannedUntil` no User e registra no `player_ban`; emite evento WebSocket `session_invalidated` para desconectar o usuário banido imediatamente
- `POST /admin/users/:id/contact` — envia email ao usuário com mensagem do admin (template de contato)

**Painel admin:**
- Nova aba "Reports" (roles: ADMIN, SUPORTE, OPERADOR)
- Tabela paginada com: data, reporter, reportado (link para perfil), categoria, status, chip de resolução
- Detalhe do report:
  - Histórico de reports **contra o mesmo jogador** (contagem total + últimos 5)
  - Tickets de suporte abertos pelo mesmo jogador
  - Se a partida for um **duelo** (não casual): tabela de lances (peça, origem, destino, captura, tempo gasto) com botão "Analisar com IA" → envia ao DeepSeek com histórico do jogador e retorna veredicto + flags
  - Análise IA persistida para evitar re-análise
  - Ações: Contatar por email | Banir (dropdown: 1, 3, 7, 15, 30 dias, Permanente) | Dispensar | Resolver

**Considerações técnicas:**
- Campo `bannedUntil: Date | null` no `User` (ou entidade separada `player_ban` para histórico de bans)
- Guard `BannedUserGuard` (já existe em `apps/api/src/common/guards/`) deve verificar `bannedUntil > now()` e retornar 403 com mensagem "Conta suspensa até [data]"
- Ao banir: invalidar sessão Redis (`session:{userId}`) imediatamente
- Análise DeepSeek de lances: reaproveitar lógica de `analyzeMatchWithAi()` do `TournamentsService`, parametrizado para aceitar `matchId` arbitrário

---

## ✅ 13. Melhorias de retorno financeiro — Concluído em 2026-07-01

### 13a. Ajuste de taxas

**Contexto:** o Asaas cobra ~1,99% sobre transferências PIX + tarifas fixas por cobrança. A taxa de saque atual (2%) mal cobre os custos operacionais.

**Definido:**
- Taxa de saque: **4%** (mínimo 3 CC) — dobra a margem sem ser agressivo ao usuário
- Rake de duelos/torneios: manter em **10%** (competitivo com outras plataformas)

**Implementação:**
- Localizar constante de taxa de saque em `wallet.service.ts` (atualmente hardcoded como 2% / mín. 2 CC) e atualizar para 4% / mín. 3 CC
- Mover `WITHDRAWAL_FEE_PERCENT` e `WITHDRAWAL_FEE_MIN` para `platform_config` (chaves dinâmicas) para ser ajustável pelo painel admin sem redeploy no futuro
- Atualizar UI da página de saque para exibir a taxa correta (buscar de `/platform-config` ou expor via `/wallet/fee`)

**Arquivos afetados:**
- `apps/api/src/wallet/wallet.service.ts` — constantes de taxa
- `apps/web/src/pages/WalletPage` (ou equivalente) — exibição da taxa

### 13b. Sistema de indicações (referral)

**Regras de negócio:**
- Cada usuário tem um **código de indicação único** gerado no cadastro (ex: 8 chars alfanumérico derivado do userId)
- Link: `${APP_URL}/register?ref=CODIGO`
- Os **primeiros 10 indicados** de cada usuário são vinculados como "indicados elegíveis"
- Para cada saque de um indicado elegível, o indicador recebe **50% da taxa de saque cobrada pela plataforma** (ex: taxa = 4% → plataforma fica com 2%, indicador recebe 2% do saque)
- Crédito vai direto para a carteira CC do indicador
- Indicado deve ter e-mail verificado e ao menos 1 depósito antes de gerar receita de indicação (anti-fraude)
- **Proibido auto-indicação** (ref do próprio usuário ignorado no cadastro)
- **Sem indicações circulares**: A indica B, B não pode indicar A
- Benefício **não expira** enquanto o indicado for um dos 10 primeiros e não estiver banido

**Entidades:**
- `referral`: `id`, `referrerId`, `referredId`, `createdAt`, `isEligible` (bool — false se ultrapassou o limite de 10)
- `referral_earning`: `id`, `referrerId`, `referredId`, `withdrawalId`, `amount` (CC ganho), `createdAt`

**Backend:**
- Campo `referralCode` (unique, gerado no cadastro) e `referredBy` (userId | null) no `User`
- `GET /auth/register` aceita `?ref=CODE` → valida e associa na criação
- `GET /me/referrals` — lista indicados com: nickname, isEligible, totalWithdrawals (elegíveis), totalEarned (CC)
- `GET /me/referrals/:userId/withdrawals` — saques elegíveis desse indicado com earning por saque
- Crédito de indicação processado em `WalletService.processWithdrawal()` após aprovação do saque

**Frontend web:**
- Seção "Indicações" no perfil do usuário (`/profile/me`)
- Exibir: código pessoal, link copiável, contagem de indicados (X/10 elegíveis)
- Lista de indicados elegíveis com earning total gerado por cada um
- Earnings acumulados em CC

**Painel admin:**
- Aba "Indicações" (roles: SUPORTE, FINANCEIRO, ADMIN)
- Tabela de indicadores com: usuário, nº de indicados, nº de elegíveis, total pago em earnings
- Drill-down: ver indicados de um usuário específico e saques com earning
- Filtro de suspeitos (alto volume de indicados em curto período → flag para revisão)

**Considerações técnicas:**
- Crédito de indicação deve ser transacional com o débito da taxa de saque (mesmo `queryRunner`)
- Gravar `referral_earning` mesmo que o indicador seja banido depois (histórico imutável); apenas futuros saques não geram earning
- Limitar: se indicado for banido permanentemente, `isEligible = false` e vaga não é reposta
- Auditoria: logar cada crédito de indicação em `platform_revenue` com tipo `REFERRAL_PAYOUT` (novo enum)

---

## ✅ 14. Sistema de feedback e avaliações no perfil — Concluído em 2026-07-01

**Observação:** as entidades `Review` e o `ReviewsModule` já existem. Verificar o que está implementado vs. o que precisa ser construído no frontend.

**Regras de negócio:**
- Ao fim de cada partida (casual ou duelo), ambos os jogadores podem avaliar o oponente — janela de **48 horas** após `finishedAt`
- **1 avaliação por partida por par** (unique constraint `(matchId, reviewerId)`)
- Rating: **0 a 5 estrelas** (inteiro)
- Comentário: opcional, máx. 500 chars
- Avaliação visível no perfil público do avaliado
- Autor da avaliação é exibido (não anônimo) — incentiva responsabilidade
- Admin pode remover avaliações abusivas

**Implementação backend (verificar o que já existe em `ReviewsModule`):**
- `POST /matches/:id/review` — cria avaliação (verifica janela, unicidade, que o reviewer jogou)
- `GET /users/:nickname/reviews?page=&limit=` — lista avaliações públicas do usuário com média de estrelas
- `GET /me/reviews/pending` — lista partidas finalizadas nas últimas 48h sem avaliação (para notificar o usuário)
- Admin: `DELETE /admin/reviews/:id` com motivo (auditado)

**Frontend web:**
- Após fim de partida: modal/toast "Avalie sua experiência com [nickname]" com estrelas + campo de comentário opcional
- Perfil público: seção "Avaliações" com: média de estrelas, total de avaliações, lista paginada de reviews com autor, data e comentário
- Navegar para perfil de outros usuários via: ranking (`/ranking`), lista de amigos (`/friends`), histórico de partidas

**Considerações técnicas:**
- Média de estrelas desnormalizada no `User` (`avgRating: float`, `reviewCount: int`) atualizada via trigger ou após cada `POST /review`
- Verificar se a entidade `Review` já tem os campos necessários; se não, migration
- Notificação in-app após partida sugerindo avaliação (não obrigatória)

---

## ✅ 15. BOTs na fila casual — Concluído em 2026-07-02

**Visão geral:** 10 contas de bot no banco de dados que entram na fila casual quando o tempo de espera é longo, mantendo a plataforma animada para novos jogadores.

**Design dos bots:**

| # | Dificuldade | ELO inicial | Stockfish depth |
|---|---|---|---|
| Bot 1-4 | Fácil | 600–800 | 1–3 |
| Bot 5-8 | Médio | 900–1100 | 5–8 |
| Bot 9-10 | Difícil | 1200–1400 | 12–15 |

**Nomes sugeridos (brasileiros + temáticos):**
- Fácil: `MagoBranco`, `PeaoQuente`, `TorreDoSul`, `CavaleiroCaipira`
- Médio: `GandalfNegro`, `GryffinDama`, `MerlinXadrez`, `SauronRei`
- Difícil: `MagnusBot`, `BotKasparov`

**Implementação backend:**
- Flag `isBot: boolean` (default false) e `botDifficulty: 'EASY'|'MEDIUM'|'HARD'|null` na entidade `User`
- Script de seed `seed-bots.ts` que cria as 10 contas com senhas aleatórias inutilizáveis (hash de UUID), email fictício `bot-{n}@megachess.internal`, `emailVerified: true`, `isBot: true`
- `MatchmakingService`: ao montar a fila casual, se um humano aguarda **> 30 segundos** sem par, selecionar um bot disponível com ELO mais próximo
- Bot só entra na fila se não estiver já em partida (`status: PLAYING` na fila)
- Partidas de bots são registradas normalmente no banco (PGN, resultado, ELO)

**Motor de jogo — Stockfish no backend:**

O modo offline do frontend já usa Stockfish via WebAssembly (no navegador). Para os bots no backend, precisamos do binário nativo do Stockfish rodando no container da API, controlado via processo filho (stdin/stdout).

**Dependência: pacote `stockfish` npm**
```bash
# apps/api
npm install stockfish
```
O pacote `stockfish` inclui o binário compilado para Node.js e uma interface simples via `require('stockfish')`.
- Alternativa: instalar binário nativo via `apt-get install stockfish` no Dockerfile (mais performático, mas exige ajuste na imagem)
- **Recomendação:** usar o pacote npm primeiro (mais simples); migrar para binário nativo se houver problemas de performance

**BotService (`apps/api/src/bots/bot.service.ts`):**
```
BotService
  ├── getMove(fen: string, difficulty: 'EASY'|'MEDIUM'|'HARD'): Promise<string>
  │     └── chama Stockfish com `position fen {fen}` + `go depth {N}`
  │         onde N = 2 (EASY) | 6 (MEDIUM) | 14 (HARD)
  │         extrai `bestmove {uci}` da resposta
  ├── Engine pool: 1 instância Stockfish por bot ativo (máx. 10 simultâneas)
  │     └── instâncias são reutilizadas entre partidas via Map<botUserId, Engine>
  └── humanDelay(difficulty): simula tempo de pensamento
        EASY   → 1.5s–4s (aleatório)
        MEDIUM → 0.8s–2.5s
        HARD   → 0.3s–1.2s
```

**Integração com GameGateway:**
```
Fluxo de uma jogada de bot:

1. Humano emite evento `move` via WebSocket
2. GameGateway valida, registra o lance, detecta que é a vez do bot
   (verifica `match.blackPlayer.isBot || match.whitePlayer.isBot`)
3. GameGateway chama `BotService.scheduleMove(matchId, botUserId, fen, difficulty)`
   → não bloqueia o handler (fire and forget com setTimeout interno)
4. BotService aguarda `humanDelay`, chama Stockfish, obtém lance UCI (ex: "e2e4")
5. BotService emite o lance internamente como se fosse um evento WebSocket do bot:
   → chama diretamente `GameService.applyMove(matchId, botUserId, uciMove)`
   → GameGateway propaga `move_broadcast` para o cliente humano normalmente
6. Se o bot ganhar/empatar/perder → `game_over` emitido normalmente
```

**Não é necessário socket real para o bot** — o `BotService` chama o `GameService` diretamente (injeção de dependência), sem passar pelo WebSocket. O cliente humano recebe os eventos normalmente porque o `GameGateway` emite para a room `game:{matchId}`.

**Dockerfile (`apps/api/Dockerfile`):**
```dockerfile
# Stockfish via binário nativo (opção mais robusta em produção)
RUN apt-get update && apt-get install -y stockfish && rm -rf /var/lib/apt/lists/*
```
Definir variável de ambiente `STOCKFISH_PATH=/usr/bin/stockfish` e usar no `BotService` via `ConfigService`. Se o pacote npm for suficiente, essa linha não é necessária.

**Tratamento de erros:**
- Se Stockfish falhar ou timeout (> 10s): bot faz uma jogada aleatória legal (fallback via `chess.js`)
- Se Stockfish travou: reiniciar a instância do engine para aquele bot
- Log `[ERROR]` em qualquer falha do engine; a partida não pode travar por causa do bot

**ELO e ranking:**
- ELO do bot ajusta normalmente após cada partida (bots melhoram/pioram com o tempo, o que é realista)
- Bots **aparecem no ranking** por padrão — isso é intencional para que a plataforma pareça ativa
- Perfil público de bot exibe badge "🤖 Bot Oficial" para transparência
- Bots **não aparecem** na lista de amigos, não recebem mensagens privadas, não podem ser desafiados diretamente

**Restrições em bots:**
- `isBot = true` → bloqueio de: login, depósito, saque, criação de torneio, envio de mensagem, solicitação de amizade
- Guard ou middleware verifica `isBot` antes de operações financeiras e sociais

**Painel admin:**
- Bots visíveis na listagem de usuários com badge
- Admin pode ajustar ELO manualmente e ativar/desativar um bot da fila (campo `isBotActive`)

**Considerações técnicas:**
**Decisão de design (ELO):** partidas contra bots contam para o ELO humano **apenas se o humano perder** (punição normal). Vitória contra bot fácil ou médio não dá ELO ao humano; vitória contra bot difícil dá ELO normalmente. Isso evita farm mas mantém a punição realista.

Implementação no `EloService` (ou onde o ELO é calculado):
```typescript
// Se oponente é bot, aplicar regra especial
if (opponent.isBot) {
  if (result === 'LOSS') applyEloChange(human, -eloLoss) // perde normalmente
  else if (result === 'WIN' && opponent.botDifficulty === 'HARD') applyEloChange(human, +eloGain)
  // WIN contra EASY/MEDIUM e DRAW: sem alteração de ELO
  // Bot: ELO sempre ajusta normalmente (vitória ou derrota)
}
```

---

## 16. Testes unitários, de integração e automatizados (Cypress)

**Meta:** 80% de coverage mínimo; 100% nos módulos financeiros (wallet, asaas, tournaments).

### Testes unitários (Jest — backend)

**O que cobrir:**
- Todos os services NestJS com mocks dos repositories e dependências externas
- Foco em: lógica de negócio (ELO, prêmios, rake, bracket), casos de erro, edge cases de concorrência
- Módulos críticos com 100% de cobertura: `WalletService`, `TournamentsService`, `MatchmakingService`

**Estrutura:**
```
apps/api/src/
  wallet/wallet.service.spec.ts
  tournaments/tournaments.service.spec.ts
  matchmaking/matchmaking.service.spec.ts
  auth/auth.service.spec.ts
  users/users.service.spec.ts
  matches/matches.service.spec.ts
  ... (um spec por service)
```

**Configuração:**
- Jest com `ts-jest`
- Mock de repositories com `@nestjs/testing` + objetos de mock simples (não `jest.mock` de módulos inteiros)
- Coverage report: `lcov` para integrar com ferramentas de CI

### Testes de integração com Asaas

**O que cobrir:**
- `AsaasService.createCharge` → verifica criação de cobrança no sandbox
- `AsaasService.processWithdrawal` → verifica transferência no sandbox
- Webhook handler: testar recepção de payload `PAYMENT_RECEIVED` com token correto e incorreto

**Abordagem:**
- Rodar contra o **sandbox do Asaas** (não mockar a API externa)
- Usar conta de sandbox configurada em variável `ASAAS_ENV=sandbox` + `ASAAS_API_KEY` de teste
- Marcar esses testes com `@group integration` e rodá-los separadamente do CI principal (são mais lentos e dependem de rede)
- Criar fixture de cliente Asaas de teste reutilizável

### Testes automatizados E2E (Cypress)

**O que cobrir (fluxos críticos):**

| Fluxo | Prioridade |
|-------|-----------|
| Registro → verificação de email → login | Alta |
| Login com Google | Alta |
| Encontrar partida casual → jogar → fim de partida | Alta |
| Entrar em fila de duelo → jogar → receber prêmio | Alta |
| Depósito PIX (mock do webhook Asaas) | Alta |
| Solicitar saque → confirmação por email | Alta |
| Adicionar amigo → desafio direto → jogar | Média |
| Promoção de peão → modal correto sem dialog nativo | Média |
| Jogar vs IA (offline) com sons | Média |
| Login admin → ação auditada → ver no audit log | Média |
| IP na blacklist → acesso bloqueado | Baixa |

**Configuração:**
- Cypress com TypeScript (`cypress.config.ts`)
- Usar `cy.intercept` para mockar respostas externas (Asaas, DeepSeek, Google OAuth)
- Fixture de usuários de teste criados via seed script antes dos testes
- Rodar contra ambiente local (docker compose) ou ambiente de staging
- Separar testes em arquivos por domínio: `auth.cy.ts`, `matchmaking.cy.ts`, `wallet.cy.ts`, etc.

**Considerações gerais:**
- Escrever os testes **depois** que as funcionalidades estiverem estáveis (justamente o motivo de remover os antigos no item 1)
- Manter testes independentes entre si: cada teste cria seus próprios dados e não depende de estado de outro
- CI: rodar unitários em cada PR; E2E apenas em merge para `development` ou `main`
