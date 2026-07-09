# Mega Chess Online

Plataforma de xadrez competitivo online com matchmaking em tempo real, sistema de torneios, economia interna (Chess Coins) e integração PIX via Asaas.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend web | React 18 + Vite |
| Backend | NestJS 10 |
| Banco de dados | PostgreSQL 16 |
| Cache / filas | Redis 7 |
| Comunicação em tempo real | Socket.IO (NestJS Gateway) |
| ORM | TypeORM |
| Autenticação | JWT (access 15min + refresh 7d) |
| Pagamentos | Asaas (PIX) |
| IA / anti-cheat | DeepSeek API |
| Painel admin | React 18 + Material UI |
| Containerização | Docker Compose |

---

## Estrutura do monorepo

```
mega-chess/
├── docker-compose.yml          # desenvolvimento local
├── docker-compose.prod.yml     # produção (Coolify / Traefik)
├── .env.prod.example
├── apps/
│   ├── api/                    # NestJS — porta 3000
│   │   └── src/
│   │       ├── auth/
│   │       ├── users/
│   │       ├── matches/
│   │       ├── matchmaking/
│   │       ├── game/           # WebSocket Gateway
│   │       ├── friends/
│   │       ├── messages/
│   │       ├── notifications/
│   │       ├── ranking/
│   │       ├── reviews/
│   │       ├── wallet/
│   │       ├── asaas/
│   │       ├── webhooks/
│   │       ├── tournaments/
│   │       ├── deepseek/
│   │       ├── user-activity/
│   │       ├── platform-config/
│   │       ├── support/
│   │       └── admin/
│   ├── web/                    # React — porta 5173 (dev) / 80 (prod)
│   │   └── src/
│   │       ├── pages/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── store/          # Zustand stores
│   │       └── lib/
│   └── admin/                  # Painel admin — porta 5174
│       └── src/
│           ├── pages/
│           ├── components/
│           └── lib/
└── apps/docs/
    ├── BUSINESS_MODEL.md
    ├── ASAAS_INTEGRATION.md
    └── ADMIN_PANEL.md
```

---

## Rodando localmente

### Pré-requisito

Docker Desktop instalado.

```bash
docker compose up --build
```

| Serviço | URL |
|---------|-----|
| Frontend (React) | http://localhost:5173 |
| API (NestJS) | http://localhost:3000 |
| Painel admin | http://localhost:5174 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

Na primeira execução o banco é criado automaticamente pelo TypeORM (`synchronize: true`).

### Variáveis de ambiente (desenvolvimento)

**`apps/api/.env`**
```env
DATABASE_URL=postgresql://chess:chess@localhost:5432/megachess
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev_secret
JWT_REFRESH_SECRET=dev_refresh_secret
ADMIN_JWT_SECRET=dev_admin_secret
PORT=3000
CORS_ORIGIN=http://localhost,http://localhost:5174
ASAAS_API_KEY=          # opcional em dev
ASAAS_WEBHOOK_TOKEN=    # opcional em dev
ASAAS_ENV=sandbox
DEEPSEEK_API_KEY=       # opcional em dev
APP_URL=http://localhost # base dos links nos emails
SMTP_HOST=              # obrigatório para emails (ex: smtp.hostinger.com)
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
```

**`apps/web/.env`**
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

---

## Deploy em produção

O projeto usa **Coolify v4 + Traefik** em VPS Hostinger. As imagens são buildadas via `docker-compose.prod.yml`.

### Ambientes

| Ambiente | Web | Admin |
|----------|-----|-------|
| Homologação | `homologa.megachess.io` | `homologa.admin.megachess.io` |
| Produção | `megachess.io` | `admin.megachess.io` |

---

### 1. DNS (Hostinger)

Adicione registros `A` apontando para o IP do VPS para cada subdomínio:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `homologa` | IP do VPS |
| A | `homologa.admin` | IP do VPS |

Em produção, adicionar também `@` (raiz) e `admin`.

---

### 2. Variáveis de ambiente no Coolify

Configure todas as variáveis abaixo no painel do resource. Valores que começam com `$` precisam estar com **"Is Literal?" marcado** no Coolify (ex: `ASAAS_API_KEY`).

```env
# Banco de dados
POSTGRES_DB=megachess
POSTGRES_USER=chess
POSTGRES_PASSWORD=<senha forte>

# JWT — strings longas e aleatórias
JWT_SECRET=
JWT_REFRESH_SECRET=
ADMIN_JWT_SECRET=

# URLs públicas dos frontends
APP_URL=https://homologa.megachess.io
ADMIN_URL=https://homologa.admin.megachess.io

# Domínio do admin (usado nas labels do Traefik)
ADMIN_DOMAIN=homologa.admin.megachess.io

# Asaas — marcar "Is Literal?" pois o valor começa com $aact_
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_ENV=sandbox   # ou production

# DeepSeek
DEEPSEEK_API_KEY=

# Email SMTP
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=automatico@megachess.io
SMTP_PASS=
# SMTP_FROM="Mega Chess <automatico@megachess.io>"  # opcional

# Opcional — padrão já é api:3000 (nome do serviço na rede Docker)
# API_UPSTREAM=api:3000
```

---

### 3. Configurar resource no Coolify

1. Crie um resource do tipo **Docker Compose**
2. Repositório: `IgorPC/Mega-Chess-Online`, branch `development`
3. Compose file: `docker-compose.prod.yml`
4. Configure as variáveis acima
5. Clique em **Deploy**

O Traefik emite SSL automaticamente via Let's Encrypt. Os serviços `web` e `admin` usam `expose: 80` (sem `ports:`) — o roteamento é feito pelas labels do Traefik no compose.

---

### 4. Liberar espaço no servidor antes do deploy

```bash
# Remove imagens e build cache não utilizados
docker system prune -af

# Ver espaço disponível
df -h /
docker system df
```

---

### 5. Swap (obrigatório no VPS de 3.8GB)

Execute uma vez após provisionar o servidor para evitar OOM durante builds:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

### Troubleshooting de deploy

| Erro | Causa | Solução |
|------|-------|---------|
| `npm run build` exit code 2 no container admin | Erro de TypeScript | Rode `npx tsc --noEmit` em `apps/admin` localmente para ver os erros |
| `WARNING: variable is not set` para `ASAAS_API_KEY` | O valor começa com `$` e o Docker Compose interpreta como variável de shell | Marcar **"Is Literal?"** no Coolify para essa variável |
| "no server available" no admin | Traefik sem regra de roteamento para o subdomínio | Verificar se `ADMIN_DOMAIN` está configurado e as labels estão no compose; fazer redeploy |
| Container sobe mas SSL não emite | DNS ainda não propagado | Aguardar propagação do DNS e fazer redeploy para o Traefik tentar novamente |
| OOM durante build | Falta de memória/swap | Criar swap de 2GB (ver seção acima) |

---

## Funcionalidades

### Autenticação
- Registro com email, nome, apelido e senha (bcrypt)
- Verificação de email obrigatória — link com token UUID (TTL 24h) enviado via SMTP
- Login bloqueado até email confirmado; resend disponível na tela de login e no pós-cadastro
- Login retorna `access_token` (15min) e `refresh_token` (7d)
- Sessão única por usuário — login em novo dispositivo invalida a sessão anterior
- Recuperação de senha via email (link com token de uso único, TTL 1h)
- Upload de avatar via Multer (JPEG/PNG/WebP até 2MB)

### Matchmaking
- **Casual**: fila única com pareamento por ELO
- **Duelo**: filas separadas por tipo (Flash 3+2 / Giant 10+0) e taxa de entrada (6 / 10 / 20 CC); débito automático ao criar a partida
- Indicador de atividade por fila em tempo real: Baixa / Média / Alta (polling 10s)
- Desafio direto entre amigos com 60s de TTL

### Partidas online
- Tabuleiro com `react-chessboard` + `chess.js` para validação client-side
- Relógio com incremento por jogada (formato `tempo+incremento`, e.g. `3+2`)
- Detecção automática de xeque-mate, empate, abandono e timeout
- Chat em tempo real dentro da partida
- Sons: início, movimento, captura, xeque, vitória, derrota, empate (mutável)
- Promoção de peão via modal customizado

### Partidas offline (vs IA)
- Modo prática sem impacto no ELO
- Três dificuldades: Fácil / Médio / Difícil
- Delay de 2s antes da jogada da IA
- Mesmos sons da partida online + botão de mutar

### Torneios e Duelos
- **Duelos**: pares 1v1 ranqueados com prêmio automático (90% do pool, rake 10%)
- **Torneios customizados**: criados por usuários, sistema de chaves eliminatórias (4–64 jogadores), proteção por senha, taxa de criação e de entrada
- Geração automática do bracket, agendamento de rodadas, partida pelo 3º lugar para torneios com ≥8 jogadores
- Análise anti-fraude com DeepSeek antes de liberar prêmios (SLA 60min)

### Economia (Chess Coins — CC)
- 1 CC = 1 BRL
- Depósitos via PIX usando Asaas (QR Code, validade 3h)
- Saques com delay anti-cheat de 25min e análise de risco por IA
- Taxa de saque: 2% (mínimo 2 CC)
- Histórico completo de transações
- **Receita da plataforma rastreada explicitamente** — rake de duelos/torneios, taxas de criação e saque registrados em `platform_revenue`

### Sistema social
- Lista de amigos com status online/offline em tempo real
- Envio/aceitação/recusa de amizade e desafios
- Notificações persistidas no banco + entrega em tempo real via WebSocket

### Ranking
- ELO calculado por Elo padrão (K=32)
- Top 100 global

### Painel admin (`/admin`)
- Autenticação separada com roles: SUPORTE, FINANCEIRO, OPERADOR, ADMIN
- Login em 2 etapas: email + senha → OTP de 6 dígitos enviado por email (TTL 10min, bloqueio após 3 tentativas erradas)
- Sessão única por admin — novo login invalida sessão anterior imediatamente
- Novo admin criado pelo Staff recebe senha temporária por email e é forçado a redefinir no primeiro acesso
- Dashboards de KPIs, usuários, transações, torneios, suporte e manutenção
- Aba "Visão Financeira" (ADMIN): totais de depósitos, saques, saldo em carteiras e rake acumulado
- Gerenciamento de staff e tickets de suporte
- Chatbot e análise de risco via DeepSeek
- Log de auditoria de todas as ações administrativas
- **Receita da plataforma**: summary por tipo, histórico paginado e chart diário via `GET /admin/platform-revenue/*`

---

## API — Endpoints principais

Prefixo: `/api/v1`

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/auth/register` | Criar conta (envia email de verificação) |
| `POST` | `/auth/login` | Login (requer email verificado) |
| `GET` | `/auth/verify-email?token=` | Confirmar email |
| `POST` | `/auth/resend-verification` | Reenviar email de confirmação |
| `POST` | `/auth/forgot-password` | Solicitar link de recuperação de senha |
| `POST` | `/auth/reset-password` | Redefinir senha via token |
| `POST` | `/auth/refresh` | Renovar token |
| `POST` | `/auth/logout` | Logout |
| `GET` | `/users/me` | Perfil do usuário logado |
| `PATCH` | `/users/me` | Atualizar nome e bio |
| `POST` | `/users/me/avatar` | Upload de avatar |
| `GET` | `/users/:nickname` | Perfil público |
| `POST` | `/matchmaking/queue` | Entrar na fila casual |
| `DELETE` | `/matchmaking/queue` | Sair da fila casual |
| `GET` | `/matchmaking/sizes` | Tamanho de todas as filas |
| `POST` | `/matchmaking/challenge` | Enviar desafio direto |
| `POST` | `/matchmaking/challenge/accept` | Aceitar desafio |
| `POST` | `/matchmaking/challenge/deny` | Recusar desafio |
| `POST` | `/matchmaking/duel/join` | Entrar na fila de duelo |
| `DELETE` | `/matchmaking/duel/leave` | Sair da fila de duelo |
| `GET` | `/wallet/balance` | Saldo CC do usuário |
| `POST` | `/wallet/deposit` | Criar depósito PIX |
| `POST` | `/wallet/withdraw` | Solicitar saque |
| `GET` | `/wallet/transactions` | Histórico de transações |
| `GET` | `/tournaments` | Listar torneios |
| `POST` | `/tournaments` | Criar torneio |
| `POST` | `/tournaments/:id/join` | Entrar em torneio |
| `POST` | `/tournaments/:id/start` | Iniciar torneio (criador) |
| `GET` | `/ranking` | Top 100 jogadores |
| `GET` | `/notifications` | Notificações não lidas |
| `PATCH` | `/notifications/read-all` | Marcar todas como lidas |

---

## WebSocket — Eventos

Namespace `/game` — autenticado via JWT no handshake.

| Evento (client → server) | Descrição |
|--------------------------|-----------|
| `join_social` | Inicializa presença online |
| `join_game` | Entra na sala da partida |
| `move` | Envia jogada |
| `forfeit` | Desistência |
| `leave_game` | Sai da sala (limpa relógio residual) |
| `chat_message` | Mensagem no chat da partida |
| `challenge_user` | Desafiar amigo |
| `accept_challenge` | Aceitar desafio |
| `deny_challenge` | Recusar desafio |

| Evento (server → client) | Descrição |
|--------------------------|-----------|
| `game_state` | Estado completo da partida ao entrar |
| `move_broadcast` | Jogada validada propagada |
| `clock_update` | Tempo restante de ambos (intervalo 1s) |
| `game_over` | Resultado final com motivo |
| `match_found` | Partida encontrada pelo matchmaking |
| `friends_status` | Lista de amigos online ao conectar |
| `user_online` / `user_offline` | Status de amigo mudou |
| `friend_challenge` | Convite de partida recebido |
| `duel_invite` | Convite de duelo recebido |
| `notification` | Notificação genérica |

---

## Comandos úteis

```bash
# Ver logs de um serviço específico
docker compose logs -f api
docker compose logs -f web

# Reiniciar apenas a API
docker compose restart api

# Parar tudo e remover volumes (limpa o banco)
docker compose down -v

# Acessar o banco diretamente (desenvolvimento local)
docker exec -it megachess-db psql -U chess -d megachess
```

**Em produção/homologação**, o container `db` não tem `container_name` fixo no `docker-compose.prod.yml` (o Coolify define o nome) — use `docker compose exec` a partir da pasta do projeto no servidor, ou encontre o container pelo nome do serviço:

```bash
# Via docker compose (recomendado — não depende do nome exato do container)
docker compose -f docker-compose.prod.yml exec db psql -U ${POSTGRES_USER:-chess} -d ${POSTGRES_DB:-megachess}

# Alternativa: localizar o container manualmente e usar docker exec
docker ps | grep db
docker exec -it <nome-do-container-db> psql -U chess -d megachess
```

---

### Limpar espaço em disco no servidor (Coolify)

Execute no servidor via SSH. Limpa imagens antigas, cache de build e containers parados — sem afetar volumes de dados em uso:

```bash
# Ver uso atual
docker system df

# Limpar cache de build e imagens não utilizadas (maior impacto, mais seguro)
docker builder prune -af && docker image prune -af

# Limpeza completa (containers parados + volumes órfãos + redes + cache)
# ⚠️ Não remove volumes de containers em execução (pg_data, redis_data, uploads)
docker system prune -af --volumes

# Ver espaço liberado
df -h /
```

---

### Resetar o banco e criar o primeiro admin

> Use em homologação para iniciar os testes do zero. Em produção, use com cautela — apaga todos os dados.

**1. Derrubar os containers e apagar o volume do banco:**

```bash
# Produção / homologação (via docker-compose.prod.yml)
docker compose -f docker-compose.prod.yml down -v

# Desenvolvimento local
docker compose down -v
```

**2. Subir novamente (TypeORM recria todas as tabelas automaticamente):**

```bash
# Produção / homologação
docker compose -f docker-compose.prod.yml up -d

# Desenvolvimento local
docker compose up -d
```

**3. Resetar o banco e criar o primeiro admin (tudo em um comando):**

```bash
# Encontrar o nome do container da API
docker ps | grep api

# Apaga todos os dados e cria o admin inicial
docker exec -it <nome-do-container-api> \
  sh -c 'ADMIN_EMAIL=admin@megachess.io ADMIN_PASSWORD=SuaSenhaForte123! ADMIN_NAME="Admin" node scripts/reset-db.js'
```

> ⚠️ `reset-db.js` apaga **todos os dados** de todas as tabelas e cria apenas o admin.  
> Use `seed-admin.js` se quiser apenas criar o admin **sem apagar dados existentes**.
>
> Os scripts ficam em `apps/api/scripts/` e são copiados para dentro do container no build Docker.
