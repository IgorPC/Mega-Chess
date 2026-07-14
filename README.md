<p align="center">
  <img src="LOGO-MEGA-CHESS.png" alt="Mega Chess Online" width="360" />
</p>

<p align="center">
  A full-stack, real-time competitive chess platform with matchmaking, tournaments,
  an internal wallet with real PIX payments, and AI-assisted anti-cheat / support.
</p>

---

## About the project

Mega Chess Online is a portfolio project built to showcase a production-style, full-stack
real-time application — not just a toy chess board. Players are matched by ELO or by paid
"duel" queues, play live games over WebSockets with synced clocks, and can join
bracket-style tournaments. The platform has its own in-app currency (Chess Coins),
backed by real PIX deposits/withdrawals through a payment gateway, and uses an LLM
to help detect cheating and triage support tickets. A separate admin panel gives staff
visibility into users, finances, tournaments and support.

The repo is a monorepo with three apps: the **API** (NestJS), the **web client** (React),
and the **admin panel** (React + Material UI).

---

## Tech stack

Roughly in order of how central each piece is to the project:

| | Technology | Role |
|---|---|---|
| <img src="https://cdn.simpleicons.org/nestjs" width="20"/> | **NestJS** | Backend framework — modular, domain-driven API |
| <img src="https://cdn.simpleicons.org/typescript" width="20"/> | **TypeScript** | End-to-end, used across API, web and admin |
| <img src="https://cdn.simpleicons.org/react" width="20"/> | **React 18** | Web client and admin panel UI |
| <img src="https://cdn.simpleicons.org/socketdotio" width="20"/> | **Socket.IO** | Real-time game state, clocks, chat, presence |
| <img src="https://cdn.simpleicons.org/postgresql" width="20"/> | **PostgreSQL** | Primary datastore |
| <img src="https://cdn.simpleicons.org/typeorm" width="20"/> | **TypeORM** | ORM / entities / migrations-style schema sync |
| <img src="https://cdn.simpleicons.org/redis" width="20"/> | **Redis** | Sessions, OTP codes, login throttling, caches |
| <img src="https://cdn.simpleicons.org/vite" width="20"/> | **Vite** | Build tooling for both React apps |
| <img src="https://cdn.simpleicons.org/mui" width="20"/> | **Material UI** | Admin panel component library |
| <img src="https://cdn.simpleicons.org/jsonwebtokens" width="20"/> | **JWT** | Access/refresh authentication |
| <img src="https://cdn.simpleicons.org/pix" width="20"/> | **Asaas (PIX)** | Payment gateway for deposits & withdrawals |
| <img src="https://cdn.simpleicons.org/openai" width="20"/> | **DeepSeek API** | LLM used for anti-cheat, risk analysis & support |
| <img src="https://cdn.simpleicons.org/docker" width="20"/> | **Docker Compose** | Local dev and production containers, reverse-proxied by Traefik in prod |

---

## Interesting concepts applied

- **Real-time gameplay over WebSockets** — a single authenticated Socket.IO namespace handles
  live moves, per-second clock sync, chat, presence and matchmaking notifications, all scoped
  into per-user and per-match rooms.
- **Payment gateway integration** — real PIX deposits and withdrawals via Asaas, driven by
  signed webhooks rather than client-reported state, so wallet balances can't be spoofed.
- **Money-safe concurrency** — wallet debits/credits (duel entry fees, tournament prizes,
  withdrawals) use pessimistic row locks to prevent race conditions on concurrent requests.
- **AI-assisted risk & support** — an LLM (DeepSeek) reviews withdrawal patterns for
  suspicious play before releasing funds, and powers admin-side ticket summaries and a
  support chatbot.
- **Layered authentication** — JWT access/refresh tokens, enforced single active session
  per account, and a separate two-factor (password + emailed OTP) login flow for the admin
  panel.
- **Abuse mitigation** — IP blacklisting middleware, global rate limiting, and Redis-backed
  lockouts after repeated failed OTP attempts.
- **Scheduled/background work without a queue system** — interval-based jobs handle
  tournament round progression, queue cleanup, and stagnant-tournament auto-cancellation,
  entirely in-process.
- **Multi-domain production deployment** — Traefik routes separate subdomains (app, admin,
  staging vs. production) to the right container purely from Docker Compose labels, with
  automatic TLS via Let's Encrypt.
- **Internationalization** — both backend error/notification strings and the web UI are
  translated through i18n layers (`nestjs-i18n` / `react-i18next`).
- **Deterministic tournament brackets** — brackets are generated with a seeded shuffle
  (seed = tournament ID) so pairings are reproducible and auditable.

---

## Backend structure (`apps/api`)

NestJS, organized as one module per business domain:

```
apps/api/src/
├── auth/              Registration, login, JWT refresh, email verification
├── users/              Profiles, avatars, public user pages
├── matches/            Match history, PGN storage
├── matchmaking/        Casual (ELO) and paid duel queues, direct challenges
├── game/                WebSocket gateway — moves, clocks, chat, game state
├── friends/             Friend requests, online presence
├── messages/            Private chat between friends
├── notifications/       Real-time + persisted notifications
├── ranking/             ELO leaderboard
├── reviews/             Post-match player reviews
├── wallet/              Chess Coins balance, deposits, withdrawals, ledger
├── asaas/               Payment gateway client (PIX)
├── webhooks/            Signed webhook receivers (Asaas)
├── tournaments/         Duels, bracket tournaments, prizes, anti-fraud checks
├── deepseek/            LLM client — anti-cheat, risk analysis, support AI
├── user-activity/       Behavioral tracking used for anti-cheat
├── platform-config/     Dynamic settings (e.g. maintenance mode)
├── platform-revenue/    Rake/fee tracking for the platform's own revenue
├── referrals/           Referral program
├── suggestions/         In-app user feedback/suggestions
├── support/             Support ticket system
├── bots/                Offline vs-AI opponent logic
├── email/               Transactional email sending (SMTP)
├── i18n/                Backend translation strings
├── admin/               Admin-only endpoints, roles, audit log, IP blacklist
├── entities/            TypeORM entities (single source of schema truth)
├── database/            Database module/config
└── common/              Shared guards, middleware, decorators, filters
```

---

## Frontend structure

### Web client (`apps/web`)

```
apps/web/src/
├── pages/          One component per route (lobby, game, profile, wallet, etc.)
├── components/     Reusable UI building blocks
├── hooks/          Custom hooks (sound effects, auth, socket helpers, ...)
├── store/          Zustand stores: auth, game, social
├── lib/            API client (axios) and Socket.IO client setup
├── locales/        i18n translation files
├── i18n/           i18n configuration
├── styles/         Global styles and design tokens
└── assets/         Static assets (logo, icons)
```

### Admin panel (`apps/admin`)

```
apps/admin/src/
├── pages/          Dashboard, Users, Transactions, Tournaments, Support, Staff, Maintenance
├── components/     Charts, data tables, layout and UI helpers
├── guards/         Route guards (auth + role-based access)
├── store/          Admin auth store (Zustand)
└── lib/            Admin API client and socket setup
```

---

## Environment variables

The API reads its configuration from two different `.env` files depending on how it's
run — same app, two execution paths:

- **`.env.example`** (project root) → copy to `.env`, used by `docker-compose.prod.yml`
  (production). Compose injects these into the containers; the required ones (no
  default value) make the stack refuse to start with a clear error if missing.
- **`apps/api/.env.example`** → copy to `apps/api/.env`, used when running the API
  directly with `npm run start:dev` (local development).

Variables appear in both files where the same app needs them in both contexts, with
different values (e.g. real JWT secrets in prod vs. throwaway ones locally).

### Database (PostgreSQL)

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_DB` | No (default `megachess`) | Database name created inside the Postgres container. Production only. |
| `POSTGRES_USER` | No (default `chess`) | Database user created inside the Postgres container. Production only. |
| `POSTGRES_PASSWORD` | **Yes** (prod) | Database password. Generate with `openssl rand -base64 32`. |
| `DATABASE_URL` | **Yes** (local) | Full connection string: `postgresql://<user>:<password>@<host>:<port>/<database>`. In production this is built automatically from the three variables above — you don't set it directly. |

### Authentication (JWT)

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | **Yes** | Signs player access tokens. Generate with `openssl rand -hex 64`. |
| `JWT_REFRESH_SECRET` | **Yes** | Reserved for refresh-token signing — use a different random value than `JWT_SECRET`. |
| `ADMIN_JWT_SECRET` | **Yes** | Signs admin-panel JWTs — use a different random value than the two above. |

### Public URLs

| Variable | Required | Description |
|---|---|---|
| `APP_URL` | **Yes** | Full public URL of the player-facing web app (e.g. `https://myapp.example.com`). Drives CORS, the frontend build, and links in transactional emails. No domain is hardcoded anywhere else in the stack. |
| `ADMIN_URL` | **Yes** | Full public URL of the admin panel (e.g. `https://admin.myapp.example.com`). Same role as `APP_URL`, for the admin app. |
| `ADMIN_DOMAIN` | **Yes** (prod) | Bare hostname of the admin panel — no protocol, must match the host portion of `ADMIN_URL` (e.g. `admin.myapp.example.com`). Docker Compose can't strip the protocol from a URL at interpolation time, so Traefik's routing rule needs it as its own variable. |
| `API_UPSTREAM` | No (default `api:3000`) | Internal Docker network address of the API service. Only change it if you rename the `api` service. |

### Payment gateway — Asaas (PIX)

| Variable | Required | Description |
|---|---|---|
| `ASAAS_API_KEY` | No | API key from your Asaas account: **Settings → Integrations → API Key**. Leave empty to disable deposits/withdrawals. In Coolify, this value starts with `$` — check **"Is Literal?"** for this variable or Compose will try to interpret it as a shell variable. |
| `ASAAS_WEBHOOK_TOKEN` | No | Shared secret configured on the Asaas webhook (**Settings → Webhooks**). Validated against the `asaas-access-token` header on every incoming webhook call. |
| `ASAAS_ENV` | No (default `sandbox`) | `sandbox` \| `production` — which Asaas environment to call. |

### AI — DeepSeek API

| Variable | Required | Description |
|---|---|---|
| `DEEPSEEK_API_KEY` | No | API key from [platform.deepseek.com](https://platform.deepseek.com). Leave empty to disable anti-cheat risk analysis, the admin chatbot, and ticket summaries. |

### Transactional email (SMTP)

| Variable | Required | Description |
|---|---|---|
| `SMTP_HOST` | **Yes** | SMTP server hostname (e.g. `smtp.gmail.com`, `smtp.hostinger.com`, `smtp.sendgrid.net`). |
| `SMTP_PORT` | No (default `465`) | `465` (implicit SSL) or `587` (STARTTLS). |
| `SMTP_USER` | **Yes** | SMTP account username — usually the sending email address. |
| `SMTP_PASS` | **Yes** | SMTP account password, or an app-specific password (e.g. Gmail App Passwords). |
| `SMTP_FROM` | No | `"From"` header, format `"Display Name <email@yourdomain.com>"`. Falls back to `SMTP_USER` if left empty. |

### Chess engine (local dev only)

| Variable | Required | Description |
|---|---|---|
| `STOCKFISH_PATH` | No (default `/usr/bin/stockfish`) | Path to a Stockfish binary, used by the offline vs-AI opponent. |

### One-off admin bootstrap scripts (local dev only)

Only read by `apps/api/scripts/seed-admin.js` and `apps/api/scripts/reset-db.js` when run
manually — the API server itself ignores these.

| Variable | Required | Description |
|---|---|---|
| `ADMIN_EMAIL` | No (default `admin@example.com`) | Email for the bootstrapped first admin account. |
| `ADMIN_PASSWORD` | No (default `ChangeMe123!`) | Password for the bootstrapped first admin account — change it immediately after first login. |
| `ADMIN_NAME` | No (default `Admin`) | Display name for the bootstrapped first admin account. |

---

## Deployment

### Running locally

Requires Docker Desktop.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Web client (React) | http://localhost |
| API (NestJS) | http://localhost:3000 |
| Admin panel | http://localhost:5174 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

The local `docker-compose.yml` doesn't read a `.env` file — every value is hardcoded for
convenience (throwaway JWT secrets, local Postgres credentials). On first run, TypeORM
creates the schema automatically (`synchronize: true` outside production).

To exercise email-dependent flows (signup verification, password reset) locally, copy
`apps/api/.env.example` to `apps/api/.env`, fill in real SMTP credentials, and run the API
directly with `npm run start:dev` instead of through Docker.

### Production deployment (Coolify + Traefik)

This project is built to deploy as a single **Docker Compose** resource on
[Coolify](https://coolify.io), with Traefik handling TLS and routing.

**Prerequisites:** a VPS with Coolify installed, and a domain you control the DNS for.

**1. DNS** — point an `A` record for your app domain and your admin subdomain at the
VPS's IP address (e.g. `myapp.example.com` and `admin.myapp.example.com`).

**2. Create the resource** — in Coolify, create a new resource of type **Docker
Compose**, pointing at this repository and the branch you want to deploy, with
**Compose file** set to `docker-compose.prod.yml`.

**3. Set environment variables** — copy every variable from the [Environment
variables](#environment-variables) section above into the resource's environment panel,
using your real production values (`APP_URL`/`ADMIN_URL` set to the domains from step 1).
Any value that starts with `$` (notably `ASAAS_API_KEY`) needs **"Is Literal?"** checked,
or Compose will try to interpret it as a shell variable reference.

**4. Deploy** — click **Deploy**. Traefik issues TLS certificates automatically via
Let's Encrypt once DNS has propagated. The `web` and `admin` services expose port 80
internally only (`expose`, not `ports`) — all public routing goes through Traefik.

**Low-memory VPS note:** a 2GB swap file prevents out-of-memory errors during the
frontend builds on small droplets:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```
