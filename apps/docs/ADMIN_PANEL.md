# Mega Chess Online — Painel Administrativo

> **Última atualização:** 2026-06-29 (revisão 3)  
> **Status:** Implementado e em produção

---

## Índice

1. [Visão Geral e Decisões de Arquitetura](#1-visão-geral-e-decisões-de-arquitetura)
2. [Análise de Riscos de Implementação](#2-análise-de-riscos-de-implementação)
3. [Mudanças na Aplicação Atual](#3-mudanças-na-aplicação-atual)
4. [Roles e Permissões](#4-roles-e-permissões)
5. [Dashboard](#5-dashboard)
6. [Usuários](#6-usuários)
7. [Transações](#7-transações)
8. [Campeonatos](#8-campeonatos)
9. [Suporte](#9-suporte)
10. [Manutenção](#10-manutenção)
11. [Administradores](#11-administradores)
12. [Perfil do Administrador](#12-perfil-do-administrador)
13. [Integração DeepSeek (IA)](#13-integração-deepseek-ia)
14. [Log de Ações do Usuário](#14-log-de-ações-do-usuário)
15. [Novas Entidades do Banco de Dados](#15-novas-entidades-do-banco-de-dados)
16. [Novos Endpoints da API](#16-novos-endpoints-da-api)
17. [Estrutura de Arquivos Sugerida](#17-estrutura-de-arquivos-sugerida)
18. [Funcionalidades Adicionais — Detalhamento](#18-funcionalidades-adicionais--detalhamento)

---

## 1. Visão Geral e Decisões de Arquitetura

### Onde fica o painel administrativo

**Decisão: app React separado em `apps/admin/`.**

```
mega-chess/
├── apps/
│   ├── web/          # Aplicação do jogador (existente)
│   ├── admin/        # Painel administrativo (novo) ← React + Vite + MUI
│   └── api/          # Backend NestJS (existente, com novos módulos)
```

### Domínios

| Ambiente | URL | Observação |
|----------|-----|-----------|
| Homologação | `https://homologa.admin.megachess.io` | Subdomínio de staging |
| Produção | `https://admin.megachess.io` | Produto final |
| API (ambos) | `/api/v1/admin/*` no mesmo NestJS | Mesmo servidor, prefix diferente |

Configurar no Coolify como dois deployments separados do serviço `admin`, cada um com `VITE_API_URL` apontando para o ambiente correto.

### Stack Visual — `apps/admin/`

**Decisão: MUI direto (sem Creative Tim) + Recharts + TanStack Table.**

Não usar o template Creative Tim (3 camadas de abstração, código difícil de manter). Instalar só as bibliotecas necessárias e escrever componentes próprios. Resultado visual de qualidade equivalente ao Material Dashboard.

**Dependências do admin:**

```json
{
  "@mui/material": "^6",
  "@mui/icons-material": "^6",
  "@emotion/react": "^11",
  "@emotion/styled": "^11",
  "recharts": "^2",
  "@tanstack/react-table": "^8"
}
```

| Biblioteca | Função | Por quê |
|-----------|--------|---------|
| `@mui/material` | Componentes base: Modal, Drawer, Chip, TextField, Select, Snackbar, Avatar, Badge, Tooltip | Robusto, acessível, dark mode nativo, theme API |
| `@mui/icons-material` | Ícones Material | Consistência visual sem SVG manual |
| `recharts` | Gráficos: linha, barra, pizza, área | ~180KB, declarativo, fácil de customizar com cores do Mega Chess |
| `@tanstack/react-table` | Tabelas com sort, filter, paginação | Headless — você controla o HTML, usa MUI pra estilizar |

**Tema Mega Chess aplicado ao MUI:**

```ts
// apps/admin/src/theme.ts
import { createTheme } from '@mui/material'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#3D4AEB' },
    error:      { main: '#B15653' },
    background: { default: '#0C0B13', paper: '#1E1D2E' },
    text:       { primary: '#FFFFFF', secondary: '#8B8CA7' },
  },
  typography: {
    fontFamily: 'DM Sans, sans-serif',
    h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCard:      { styleOverrides: { root: { backgroundColor: '#1E1D2E' } } },
    MuiDrawer:    { styleOverrides: { paper: { backgroundColor: '#1E1D2E', borderRight: '1px solid #373855' } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: '#373855' } } },
    MuiChip:      { styleOverrides: { root: { fontFamily: 'DM Sans' } } },
  },
})
```

Logo do Mega Chess (`apps/web/src/assets/logo.svg`) importado e exibido no topo da sidebar.

**Estrutura visual resultante:**

```
┌─────────────────────────────────────────────────┐
│  [Logo Mega Chess]  Admin Panel           [Igor] │  ← MUI AppBar
├──────────────┬──────────────────────────────────┤
│ Dashboard    │                                  │
│ Usuários     │   Conteúdo da página ativa       │  ← MUI Drawer (sidebar)
│ Transações   │   Cards (MUI Card)               │    + área de conteúdo
│ Campeonatos  │   Gráficos (Recharts)            │
│ Suporte      │   Tabelas (TanStack + MUI)       │
│ Manutenção   │   Modais (MUI Dialog)            │
│ Admins       │                                  │
└──────────────┴──────────────────────────────────┘
```

### Autenticação do Admin

AdminUsers são **completamente separados** dos Users (jogadores). Tabela, JWT secret e fluxo de login próprios.

- JWT secret: variável de ambiente `ADMIN_JWT_SECRET` (diferente de `JWT_SECRET`)
- Token expira em **4 horas** (vs 15 min dos jogadores — sessões mais longas pois o admin tem MFA)
- **MFA obrigatório** para roles Operador e Administrador (TOTP via Google Authenticator)

---

## 2. Análise de Riscos de Implementação

### ⚠ Risco 1 — Chaves de API do Asaas no banco de dados

**Solicitado:** "configurar as chaves de API do Asaas no painel"

**Decisão: NÃO implementar desta forma.**

Armazenar `ASAAS_API_KEY` no banco de dados é um risco de segurança grave: se o banco for comprometido, as chaves de pagamento ficam expostas — e com elas, acesso à conta financeira da plataforma.

**Alternativa recomendada:**
- As chaves continuam em variáveis de ambiente (Coolify → Environment Variables)
- O painel admin exibe apenas o **status de conexão** com o Asaas (teste de ping), o ambiente atual (`sandbox` ou `production`) e a data do último webhook recebido
- Troca de chaves é feita via Coolify com redeploy — processo deliberado e auditável

---

### ⚠ Risco 2 — Taxas dinâmicas de torneios e saques

**Solicitado:** "configurar taxas de saque e inscrição dos campeonatos — se alterado, refletir no frontend"

**Decisão: implementar com ressalvas e mitigações.**

**Risco:** alterar uma taxa enquanto há um torneio ativo causa inconsistência (jogador pagou R$5, sistema passa a cobrar R$10).

**Mitigação obrigatória:**
- Taxas são salvas em tabela `platform_config` no banco
- Alteração de taxa **não afeta torneios já criados** — cada torneio guarda sua própria `entry_fee_cc` no momento da criação
- A alteração só vale para torneios/duels criados **após** a mudança
- Um alerta de confirmação no painel mostra quantos torneios ativos existem antes de salvar
- Frontend (jogadores) busca a configuração atual via `GET /api/v1/config/public` — **não é build-time**

---

### ⚠ Risco 3 — Leitura de logs do NestJS

**Solicitado:** "ler os logs do Nest e filtrar por erro, info, warning"

**Decisão: NÃO ler arquivos de log diretamente. Usar logging estruturado.**

Ler arquivos `.log` do filesystem dentro de um container Docker é frágil e não escalável. A solução correta é configurar o Winston logger do NestJS para gravar logs estruturados na tabela `system_logs` do banco de dados.

**Implementação:**
1. Adicionar `winston` + `nest-winston` como logger do NestJS
2. Criar um transport custom que grava em `system_logs` (para erros e warnings — não logar `info` pois gera volume excessivo)
3. O painel admin lê da tabela com filtros, paginação e search

---

### ⚠ Risco 4 — Modo de manutenção

**Solicitado:** "modo de manutenção que torna o sistema indisponível"

**Implementação:**
- Flag `maintenance_mode: boolean` na tabela `platform_config`
- Middleware NestJS (`MaintenanceGuard`) verifica o flag em cada request e retorna HTTP 503 se ativado
- Rotas **isentas**: `POST /auth/login`, `GET /api/v1/config/public` e **todos** os endpoints `/api/v1/admin/*`
- O frontend exibe uma tela de manutenção quando recebe 503
- **Cache de 10 segundos** no middleware para não bater no banco a cada request

---

### ⚠ Risco 5 — Tickets de suporte com anexos

**Solicitado:** "attachments (imagens e PDF apenas)"

**Implementação:**
- Usar o Multer já configurado na API, com nova pasta `uploads/tickets/`
- Limite: 5 arquivos por mensagem, 10MB por arquivo
- MIME permitidos: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Os arquivos são servidos pela API (não expostos diretamente no Nginx) para garantir que apenas admins autorizados acessem

---

### ℹ Nota — Sistema de suporte ainda não existe

O sistema de tickets mencionado ("tickets de suporte abertos hoje") **ainda não existe na aplicação atual**. Ele precisa ser criado do zero — tanto as entidades no banco quanto o fluxo de criação de tickets pelo lado do jogador (uma página `/support` no frontend principal).

---

## 3. Mudanças na Aplicação Atual

### 3.1 Backend (NestJS) — novos módulos

| Módulo | Localização | O que faz |
|--------|-------------|-----------|
| `admin-auth` | `src/admin/auth/` | Login, JWT e MFA para admins |
| `admin-users` | `src/admin/users/` | CRUD de jogadores pelo admin |
| `admin-transactions` | `src/admin/transactions/` | Listagem e ações em transações |
| `admin-tournaments` | `src/admin/tournaments/` | Manutenção de campeonatos |
| `admin-support` | `src/admin/support/` | Tickets de suporte |
| `admin-maintenance` | `src/admin/maintenance/` | Config, logs, modo manutenção |
| `admin-staff` | `src/admin/staff/` | CRUD de AdminUsers |
| `admin-dashboard` | `src/admin/dashboard/` | Métricas e KPIs |
| `admin-audit` | `src/admin/audit/` | Log de ações dos admins |
| `platform-config` | `src/platform-config/` | Config pública e dinâmica |
| `support` | `src/support/` | Criação de tickets pelo jogador |

### 3.2 Backend — mudanças em módulos existentes

| Módulo existente | O que muda |
|-----------------|------------|
| `app.module.ts` | Importar novos módulos admin e `MaintenanceGuard` global |
| `notifications` | Adicionar endpoint de broadcast (admin → todos os usuários) |
| `wallet` | Adicionar endpoint admin para aprovar/rejeitar saques bloqueados |
| `webhooks` | Sem alteração (já funciona) |
| `main.ts` | Configurar Winston como logger global |

### 3.3 Frontend (jogadores) — mudanças mínimas

| Arquivo | O que muda |
|---------|-----------|
| `App.tsx` | Adicionar rota `/support` — criar ticket de suporte |
| `lib/api.ts` | Tratar HTTP 503 globalmente (exibir tela de manutenção) |
| `pages/SupportPage.tsx` | Nova página: criar e acompanhar tickets |
| Qualquer fetch de config | Buscar taxas de `/api/v1/config/public` em vez de hardcode |

### 3.4 Docker Compose

Adicionar novo serviço `admin` no `docker-compose.prod.yml`:

```yaml
admin:
  build:
    context: ./apps/admin
    dockerfile: Dockerfile
  restart: always
  expose:
    - "80"
  depends_on:
    - api
```

Adicionar variável de ambiente na api:
```
ADMIN_JWT_SECRET=<secret diferente do JWT_SECRET>
```

---

## 4. Roles e Permissões

```
SUPORTE     → Dashboard (KPIs de clientes), Usuários (read-only + mensagem), Suporte, Perfil
FINANCEIRO  → Dashboard (KPIs financeiros + clientes), Usuários (read-only), Transações, Perfil
OPERADOR    → Dashboard (completo), Usuários (completo), Transações, Campeonatos, Suporte, Manutenção (read-only), Perfil
ADMIN       → TUDO, incluindo Manutenção (write), Administradores
```

### Matriz de acesso detalhada

| Funcionalidade | Suporte | Financeiro | Operador | Admin |
|---|:---:|:---:|:---:|:---:|
| Dashboard — KPIs de jogadores | ✅ | ✅ | ✅ | ✅ |
| Dashboard — KPIs financeiros | ❌ | ✅ | ✅ | ✅ |
| Dashboard — Performance técnica | ❌ | ❌ | ✅ | ✅ |
| Usuários — Listar/Ver | ✅ | ✅ | ✅ | ✅ |
| Usuários — Mensagem | ✅ | ❌ | ✅ | ✅ |
| Usuários — Banir/Suspender | ❌ | ❌ | ✅ | ✅ |
| Usuários — Ajustar ELO | ❌ | ❌ | ❌ | ✅ |
| Usuários — Exportar dados | ❌ | ✅ | ✅ | ✅ |
| Transações — Listar | ❌ | ✅ | ✅ | ✅ |
| Transações — Aprovar saque bloqueado | ❌ | ✅ | ✅ | ✅ |
| Transações — Reembolso manual | ❌ | ❌ | ❌ | ✅ |
| Campeonatos — Listar/Ver | ❌ | ❌ | ✅ | ✅ |
| Campeonatos — Criar/Editar | ❌ | ❌ | ✅ | ✅ |
| Campeonatos — Cancelar com reembolso | ❌ | ❌ | ❌ | ✅ |
| Suporte — Ver tickets | ✅ | ❌ | ✅ | ✅ |
| Suporte — Assinar e responder ticket | ✅ | ❌ | ✅ | ✅ |
| Suporte — Fechar ticket | ✅ | ❌ | ✅ | ✅ |
| Manutenção — Ver logs e métricas | ❌ | ❌ | ✅ | ✅ |
| Manutenção — Ativar modo manutenção | ❌ | ❌ | ❌ | ✅ |
| Manutenção — Alterar config da plataforma | ❌ | ❌ | ❌ | ✅ |
| Manutenção — Enviar notificação broadcast | ❌ | ❌ | ✅ | ✅ |
| Manutenção — Limpar cache Redis | ❌ | ❌ | ❌ | ✅ |
| Administradores — Listar | ❌ | ❌ | ❌ | ✅ |
| Administradores — Criar/Editar | ❌ | ❌ | ❌ | ✅ |

---

## 5. Dashboard

**Roles com acesso:** Suporte (parcial), Financeiro (parcial), Operador, Admin

### 5.1 KPIs de Jogadores (todos os roles)

Cards no topo da página, dados do dia atual (reset à meia-noite):

| Card | Fonte de dados | Atualização |
|------|--------------|-------------|
| Novos cadastros hoje | `COUNT users WHERE created_at >= today` | A cada 5 min |
| Usuários ativos hoje | `COUNT DISTINCT user_id FROM matches WHERE started_at >= today` | A cada 5 min |
| Usuários online agora | Contagem de sockets conectados no Gateway | Real-time via WebSocket |
| Partidas realizadas hoje | `COUNT matches WHERE created_at >= today AND isOffline = false` | A cada 5 min |
| Partidas em andamento agora | `COUNT matches WHERE status = ONGOING` | A cada 30s |
| Torneios iniciados hoje | `COUNT tournaments WHERE started_at >= today` | A cada 5 min |
| Tickets abertos hoje | `COUNT support_tickets WHERE created_at >= today` | A cada 5 min |

### 5.2 KPIs Financeiros (Financeiro, Operador, Admin)

| Card | Fonte de dados |
|------|--------------|
| Depósitos confirmados hoje | `SUM deposits.value_brl WHERE status=COMPLETED AND today` |
| Saques processados hoje | `SUM withdrawals.value_brl WHERE status=COMPLETED AND today` |
| Rake arrecadado hoje | `SUM wallet_transactions.amount WHERE type=RAKE AND today` |
| Saques bloqueados (anti-cheat) | `COUNT withdrawals WHERE status=BLOCKED` |
| Saldo total em wallets | `SUM wallets.balance` |
| Volume financeiro (7 dias) | Gráfico de barras: depósitos vs saques por dia |

### 5.3 Gráfico — Partidas por Hora

Gráfico de linha: quantidade de partidas iniciadas nas últimas 24 horas, agrupadas por hora. Útil para identificar horário de pico.

### 5.4 Tabela — Partidas em Tempo Real

Lista atualizada a cada 30 segundos:
- ID da partida | Brancas | Pretas | Tipo (Regular/Torneio) | Tempo decorrido | Status
- Filtros: tipo (regular / duelo / torneio), status (ongoing / finished)
- Clique abre o detalhe da partida (modo leitura, sem interferir)

### 5.5 Tabela — Tickets de Suporte Abertos Hoje

- ID | Usuário | Categoria | Prioridade | Status | Tempo aberto | Atribuído a
- Filtros: status, prioridade, atribuído, categoria
- Clique abre o ticket

### 5.6 Widget — Saques Bloqueados (Anti-cheat)

Lista de saques com `status = BLOCKED` aguardando revisão manual:
- Usuário | Valor | Motivo do bloqueio | Data
- Botão de ação rápida: Aprovar | Rejeitar (redireciona para a tela de Transações)

### 5.7 Widget — Performance da Aplicação (Operador, Admin)

Métricas do processo Node.js:
- Memória usada (MB) / total disponível
- CPU usage (%)
- Uptime da API
- Latência média dos últimos 100 requests (P50 / P95)
- Conexões ativas do PostgreSQL
- Tamanho do banco de dados

### 5.8 Widget — Top Jogadores da Semana

Ranking dos 5 maiores ganhadores em $CC na semana (por prêmios recebidos). Útil para identificar comportamento anômalo.

### 5.9 Widget — Alertas Automáticos

Sistema de alertas baseado em regras configuráveis:
- 🔴 "X saques bloqueados aguardando revisão"
- 🟡 "Uso de memória acima de 80%"
- 🟡 "X erros nos últimos 15 minutos"
- 🔴 "Modo de manutenção ativo"
- 🟡 "Torneio FAISCA com X inscrições faltando para iniciar"

---

## 6. Usuários

**Roles com acesso:** todos (com funcionalidades variadas)

### 6.1 Lista de Usuários

Tabela paginada (20 por página) com:

| Coluna | Descrição |
|--------|-----------|
| Avatar + Nickname | Link para o perfil |
| Email | |
| ELO | Rating atual |
| Status | Online / Offline / Suspenso / Banido |
| Saldo $CC | Saldo atual da wallet |
| Cadastro | Data de criação |
| Última atividade | Última partida ou login |

**Filtros disponíveis:**
- Busca por nickname ou email (busca parcial)
- Status: Ativo / Suspenso / Banido
- ELO: range (mín – máx)
- Cadastro: range de datas
- Tem saldo positivo: sim/não
- Ordenação: por ELO, por cadastro, por última atividade

### 6.2 Perfil do Usuário (detalhe)

Ao clicar em um usuário, abre uma página com abas:

**Aba: Dados Gerais**
- Foto, nickname, email, nome, CPF (mascarado: `***.xxx.xxx-**`), telefone
- Data de nascimento, ELO atual, posição no ranking
- Data de cadastro, último login, último IP
- Status da conta e histórico de suspensões
- Chave PIX cadastrada
- ID de cliente Asaas

**Aba: Histórico de Partidas**
- Lista paginada das partidas do usuário
- Filtros: período, resultado, tipo (regular/torneio/offline), modalidade
- Colunas: data, oponente, resultado, ELO antes/depois, variação, tipo
- Clique abre o replay da partida (tabuleiro interativo, read-only)

**Aba: Transações**
- Extrato completo da wallet deste usuário
- Filtros: tipo (depósito/saque/prêmio/taxa), período, status
- Colunas: data, tipo, valor, saldo após, referência

**Aba: Torneios**
- Histórico de participação em torneios
- Colunas: torneio, data, posição final, valor pago, prêmio recebido

**Aba: Suporte**
- Tickets abertos por este usuário
- Clique abre o ticket

**Aba: Atividade**
- Log de ações do admin sobre este usuário (role ADMIN only): suspensões, ajustes de ELO, mensagens enviadas

### 6.3 Ações disponíveis por role

| Ação | Suporte | Financeiro | Operador | Admin |
|------|:-------:|:----------:|:--------:|:-----:|
| Enviar mensagem interna | ✅ | ❌ | ✅ | ✅ |
| Ver dados (sem CPF completo) | ✅ | ✅ | ✅ | ✅ |
| Ver CPF completo | ❌ | ✅ | ✅ | ✅ |
| Exportar dados do usuário (LGPD) | ❌ | ✅ | ✅ | ✅ |
| Suspender conta (temporário) | ❌ | ❌ | ✅ | ✅ |
| Banir conta (permanente) | ❌ | ❌ | ❌ | ✅ |
| Remover banimento | ❌ | ❌ | ❌ | ✅ |
| Ajustar ELO manualmente | ❌ | ❌ | ❌ | ✅ |
| Forçar logout (invalidar tokens) | ❌ | ❌ | ✅ | ✅ |
| Enviar reset de senha | ❌ | ❌ | ✅ | ✅ |

### 6.4 Mensagem Interna (Suporte, Operador, Admin)

Modal acessível no perfil do usuário:
- Campo de texto (até 500 caracteres)
- Título da mensagem
- A mensagem é criada como uma `Notification` do tipo `ADMIN_MESSAGE` para o usuário
- O usuário recebe em tempo real via WebSocket e vê no sino de notificações
- Fica registrado no log de atividade do admin

### 6.5 Suspensão e Banimento (Operador/Admin)

Modal de suspensão:
- Motivo (obrigatório, texto livre)
- Duração: 1h / 6h / 24h / 7 dias / 30 dias / Permanente (banimento)
- Notificar o usuário: sim/não (envia notificação explicando)

Efeito imediato:
- Invalidar todos os refresh tokens do usuário
- Remover da fila de matchmaking
- Campo `bannedUntil` e `bannedReason` adicionados à entidade User

---

## 7. Transações

**Roles com acesso:** Financeiro, Operador, Admin

### 7.1 Lista de Transações

Tabela paginada com todas as `wallet_transactions`:

| Coluna | Descrição |
|--------|-----------|
| Data/Hora | |
| Usuário | Nickname + link para o perfil |
| Tipo | DEPOSIT / WITHDRAWAL / PRIZE / RAKE etc |
| Valor | +/- em $CC |
| Saldo após | |
| Referência | ID do depósito, saque, torneio etc |
| Status | Para depósitos e saques |

**Filtros:**
- Tipo de transação (multi-select)
- Período (data início – data fim)
- Usuário (busca por nickname/email)
- Valor mínimo / máximo
- Status (apenas para depósitos/saques)

**Exportar:** botão "Exportar CSV" aplica os filtros ativos e baixa o arquivo

### 7.2 Depósitos

Aba separada com a tabela de `deposits`:
- Usuário | Valor BRL | QR Code gerado em | Confirmado em | Status
- Filtros: status (PENDING / COMPLETED / EXPIRED / CANCELLED), período, valor

### 7.3 Saques

Aba separada com a tabela de `withdrawals`:
- Usuário | $CC debitados | BRL enviado | Taxa | Chave PIX | Status | Motivo de bloqueio (se BLOCKED)
- Filtros: status (PENDING / ANALYZING / PROCESSING / COMPLETED / BLOCKED / FAILED), período

**Ação: Aprovar saque bloqueado (Financeiro, Operador, Admin)**
- Para saques com `status = BLOCKED`
- Botão "Aprovar" → confirma com modal, registra no audit log, executa o PIX via Asaas
- Botão "Rejeitar definitivamente" → estorna os $CC para o usuário, notifica o usuário

**Ação: Reembolso manual (Admin only)**
- Credita $CC para um usuário com type = REFUND
- Campos: usuário, valor, motivo (texto obrigatório)
- Registra no audit log

### 7.4 Rake Acumulado

Card de resumo no topo da aba Transações:
- Rake total do dia / semana / mês / all-time
- Gráfico de linha: rake por dia (últimos 30 dias)

---

## 8. Campeonatos

**Roles com acesso:** Operador, Admin (cancelamento com reembolso: Admin only)

### 8.1 Visão Geral

Três abas:
1. **Em Andamento** — Torneios com status REGISTERING ou IN_PROGRESS
2. **Histórico** — Torneios FINISHED ou CANCELLED
3. **Criar Novo** — Formulário de criação

### 8.2 Lista de Torneios em Andamento

| Coluna | Descrição |
|--------|-----------|
| ID + Tipo | FAISCA / TEMPESTADE / GRANDE / DUEL_FLASH / DUEL_GIANT |
| Status | REGISTERING / IN_PROGRESS |
| Inscritos | X / max_players |
| Taxa de entrada | em $CC |
| Pote acumulado | $CC já arrecadados |
| Agendado para | Data/hora de início |
| Partidas ativas | Quantidade de partidas ONGOING dentro do torneio |

**Ação por torneio:**
- **Ver detalhes** — abre painel lateral com bracket, standings, lista de participantes e partidas
- **Forçar início** (Admin) — inicia mesmo sem atingir min_players
- **Cancelar com reembolso** (Admin) — cancela e reembolsa todos os inscritos automaticamente

### 8.3 Detalhe do Torneio

- Header: tipo, status, datas, rake, prize pool, campeão (se concluído)
- **Bracket visual** (eliminação) ou **standings** (suíço)
- Lista de participantes: nickname, ELO, status (ACTIVE / ELIMINATED / CHAMPION), prêmio recebido
- Lista de partidas: fase, brancas × pretas, resultado, duração

### 8.4 Criar Novo Torneio

Formulário:
- Tipo: FAISCA / TEMPESTADE / GRANDE
- Taxa de entrada: usa o valor atual da `platform_config` (editável neste formulário se Admin)
- Data/hora agendada
- Observações internas

> **Duelos 1v1 (DUEL_FLASH / DUEL_GIANT)** são criados automaticamente pelo sistema de matchmaking — não são criados manualmente pelo admin.

### 8.5 Histórico de Campeonatos

- Filtros: tipo, período, status
- Colunas: ID, tipo, data, participantes, prize pool, campeão, rake arrecadado
- Clique abre o detalhe (read-only)

### 8.6 Funcionalidades Adicionais Sugeridas

- **Templates de torneio** — salvar configurações frequentes para criar rapidamente
- **Recorrência** — agendar torneios automáticos (ex: FAISCA todo dia às 19h) via cron configurado no banco
- **Notificação automática** — X minutos antes do início, notificar jogadores elegíveis que ainda não se inscreveram

---

## 9. Suporte

**Roles com acesso:** Suporte, Operador, Admin

### 9.1 Fila de Tickets

Lista paginada de tickets ordenados por prioridade + data de criação:

| Coluna | Descrição |
|--------|-----------|
| ID | #0001, #0002... |
| Usuário | Nickname + link para perfil |
| Categoria | Pagamento / Partida / Conta / Técnico / Outro |
| Prioridade | 🔴 Alta / 🟡 Média / 🟢 Baixa |
| Status | Criado / Em Progresso / Aguardando Contato / Concluído |
| Atribuído a | Nome do admin responsável (ou "—") |
| Aberto há | Tempo desde criação |
| Última resposta | Data da última mensagem |

**Filtros:**
- Status (multi-select)
- Prioridade
- Categoria
- Atribuído a (meu / todos / sem atribuição)
- Período de abertura
- Busca por ID ou nickname

### 9.2 Visualização do Ticket

Layout de duas colunas:

**Coluna esquerda — Conversa**
- Histórico de mensagens em ordem cronológica
- Distinção visual: mensagens do usuário (esquerda) / admin (direita)
- Mensagens com `is_internal = true` aparecem com fundo amarelo e ícone 🔒 — visíveis apenas para admins
- Input para nova mensagem + checkbox "Nota interna"
- Upload de anexos (imagens JPG/PNG/WebP e PDF, máx 5 arquivos × 10MB)

**Coluna direita — Painel de controle**

*Dados do ticket:*
- Status (dropdown editável)
- Prioridade (dropdown editável)
- Categoria
- Atribuído a (dropdown com admins com role SUPORTE ou superior)
- SLA: tempo alvo de resposta e tempo restante

*Dados do usuário:*
- Avatar, nickname, email
- ELO, data de cadastro
- Saldo em $CC
- Quantidade de tickets anteriores

*Ações:*
- Atribuir para mim
- Mudar status
- Encerrar ticket (pede motivo obrigatório)

### 9.3 Status do Ticket

| Status | Descrição |
|--------|-----------|
| `OPEN` — Criado | Ticket criado, aguardando triagem |
| `IN_PROGRESS` — Em Progresso | Admin está trabalhando no ticket |
| `WAITING_USER` — Aguardando Contato | Resposta enviada ao usuário, aguardando retorno |
| `CLOSED` — Concluído | Ticket encerrado (exige motivo de conclusão) |

Motivos de conclusão: Resolvido / Não reproduzível / Duplicado / Sem resposta do usuário / Fraude confirmada

### 9.4 Notificações de Suporte

- Novo ticket criado → notifica admins de Suporte via WebSocket (badge no menu)
- Resposta do usuário em ticket `WAITING_USER` → move para `IN_PROGRESS` automaticamente e notifica o admin atribuído
- Ticket sem resposta por mais de 24h → alerta no dashboard

### 9.5 Métricas de Suporte (widget no Dashboard)

- Tickets abertos / em progresso / aguardando
- Tempo médio de primeira resposta (últimos 7 dias)
- Tickets resolvidos hoje
- Backlog total

---

## 10. Manutenção

**Roles com acesso:** Operador (leitura), Admin (leitura + escrita)

### 10.1 Performance da Aplicação

Métricas coletadas via endpoint interno `/api/v1/admin/maintenance/metrics`:

| Métrica | Fonte |
|---------|-------|
| Memória heap usada / total | `process.memoryUsage()` |
| Memória RSS | `process.memoryUsage()` |
| CPU usage (%) | `os.cpus()` + delta |
| Uptime da API | `process.uptime()` |
| Conexões ativas PostgreSQL | `SELECT count(*) FROM pg_stat_activity` |
| Tamanho total do banco | `pg_database_size()` |
| Conexões Redis ativas | `CLIENT LIST` |
| Partidas ONGOING no momento | Query direta |
| Usuários online (sockets) | Contagem do Gateway |
| Latência P50 / P95 últimos 100 req | Ring buffer em memória |

Gráfico de linha: memória e CPU dos últimos 30 minutos (pooling a cada 30s via WebSocket admin).

### 10.2 Logs de Erro

Tabela `system_logs` populada pelo Winston logger:

**Configuração do logger (NestJS):**
- `ERROR` → grava em `system_logs`
- `WARN` → grava em `system_logs`
- `INFO`, `DEBUG` → apenas console (não grava no banco para evitar volume)
- Retenção: logs mais antigos que 30 dias são removidos automaticamente (cron job)

**Interface no admin:**

| Coluna | Descrição |
|--------|-----------|
| Data/Hora | |
| Nível | 🔴 ERROR / 🟡 WARN |
| Contexto | Nome do módulo NestJS |
| Mensagem | Texto do log |
| Stack trace | Collapsível (apenas para ERROR) |
| Request ID | Para correlacionar com request específico |

**Filtros:** nível, módulo/contexto, período, busca por texto

### 10.3 Configurações da Plataforma

Tabela `platform_config` com chave → valor. Interface de edição (Admin only):

| Chave | Descrição | Tipo | Padrão |
|-------|-----------|------|--------|
| `duel_flash_entry_fee_cc` | Taxa de duelo Relâmpago (padrão) | decimal | 5 |
| `duel_giant_entry_fee_cc` | Taxa de duelo Gigantes (padrão) | decimal | 5 |
| `faisca_entry_fee_cc` | Taxa de inscrição Faísca | decimal | 5 |
| `tempestade_entry_fee_cc` | Taxa de inscrição Tempestade | decimal | 5 |
| `grande_entry_fee_cc` | Taxa de inscrição Grande Torneio | decimal | 5 |
| `withdrawal_fee_pct` | Percentual de taxa de saque | decimal | 0.02 |
| `withdrawal_fee_min_cc` | Taxa mínima de saque em $CC | decimal | 2 |
| `withdrawal_min_balance_cc` | Saldo mínimo para sacar | decimal | 10 |
| `rake_pct` | Percentual de rake | decimal | 0.10 |
| `elo_k_factor` | Fator K do cálculo ELO | integer | 32 |
| `matchmaking_max_rating_diff` | Diferença máxima de ELO no matchmaking | integer | 200 |
| `maintenance_mode` | Modo de manutenção ativo | boolean | false |
| `maintenance_message` | Mensagem exibida na tela de manutenção | string | — |

> **Alerta ao salvar:** se houver torneios ativos com taxa diferente da nova configuração, o admin vê um aviso explicando que a mudança afeta apenas novos torneios.

### 10.4 Conexão Asaas

Painel read-only (não configura chaves — ver seção de riscos):
- Status da conexão: ✅ Conectado / ❌ Erro (resultado do último test-ping)
- Ambiente: Sandbox / Produção
- Último webhook recebido: data/hora
- Botão "Testar conexão agora" (dispara GET /customers com limit=1)

### 10.5 Modo de Manutenção

Toggle visível e destacado:

```
┌─────────────────────────────────────────┐
│  🔴 MODO DE MANUTENÇÃO                  │
│  Ativar tornará o sistema indisponível  │
│  para todos os jogadores.               │
│                                         │
│  Mensagem de manutenção:                │
│  [Estamos em manutenção, voltamos...]   │
│                                         │
│  [ Ativar Manutenção ]                  │
└─────────────────────────────────────────┘
```

- Ao ativar: modal de confirmação ("Isso desconectará TODOS os usuários")
- Partidas em andamento recebem evento WebSocket `maintenance_start` com X segundos de aviso antes de cortar
- O frontend do jogador exibe a tela de manutenção com a mensagem configurada

### 10.6 Notificação Broadcast (Operador, Admin)

Formulário para enviar notificação para todos os usuários:
- Título (máx 60 caracteres)
- Mensagem (máx 300 caracteres)
- Segmentação: Todos / Apenas online agora / Apenas com saldo positivo
- Preview do card de notificação antes de enviar
- Confirmação: "Enviar para X usuários"

Implementação: `NotificationsService.broadcastToAll()` cria registros em lote na tabela `notifications` e emite via WebSocket.

### 10.7 Cache Redis (Admin only)

Botões de ação:
- **Limpar cache de sessão** — remove sessões inativas
- **Limpar fila de matchmaking** — zera a fila em memória e no Redis (usar com cautela)
- **Ver estatísticas Redis** — memória usada, keys totais, hit rate

---

## 11. Administradores

**Role com acesso:** Admin only

### 11.1 Lista de AdminUsers

| Coluna | Descrição |
|--------|-----------|
| Nome | |
| Email | Login no painel admin |
| Role | SUPORTE / FINANCEIRO / OPERADOR / ADMIN |
| Status | Ativo / Inativo |
| MFA | Configurado / Não configurado |
| Último acesso | Data/hora |
| Criado em | |

### 11.2 Criar AdminUser

Campos:
- Nome completo
- Email (único)
- Senha temporária (usuário deve trocar no primeiro login)
- Role
- Forçar troca de senha no primeiro login: sim/não

### 11.3 Editar AdminUser

- Alterar nome, email, role, status
- Resetar senha (gera nova senha temporária enviada por email)
- Resetar MFA (desvíncula o TOTP atual — usuário deve reconfigurar)
- Desativar conta (não exclui, apenas bloqueia acesso)

> **Proteção:** Um Admin não pode editar a própria role nem desativar a própria conta. Precisa de outro Admin.

### 11.4 Log de Acesso dos Admins

Tabela (read-only):
- Admin | Ação | Entidade afetada | IP | Data/hora
- Exemplos de ações: `LOGIN`, `USER_SUSPENDED`, `WITHDRAWAL_APPROVED`, `ELO_ADJUSTED`, `TOURNAMENT_CANCELLED`, `CONFIG_CHANGED`

---

## 12. Perfil do Administrador

**Role com acesso:** todos (próprio perfil)

- Ver nome, email, role atual
- Alterar nome
- Alterar senha (requer senha atual)
- Configurar / reconfigurar MFA (QR Code TOTP)
- Ver log de acesso próprio (últimas 20 ações)

---

## 13. Integração DeepSeek (IA)

### 13.1 Visão Geral e Orçamento

**API:** DeepSeek (`https://api.deepseek.com`) — compatível com OpenAI SDK.

**Modelos disponíveis (julho 2026):**

| Modelo | Input cache miss | Input cache hit | Output | Contexto | Uso ideal |
|--------|-----------------|----------------|--------|----------|-----------|
| `deepseek-v4-flash` | $0,14/1M tokens | $0,0028/1M | $0,28/1M | 1M tokens | Tarefas de alto volume, latência baixa |
| `deepseek-v4-pro` | $0,435/1M tokens | $0,003625/1M | $0,87/1M | 1M tokens | Análises complexas com raciocínio |

> `deepseek-chat` e `deepseek-reasoner` descontinuados em julho 2026 — usar apenas os novos nomes.

**Princípio de custo: IA acionada apenas por ação explícita, nunca em background automático.**

A estratégia não é limitar a um valor fixo de orçamento — é arquitetar o uso de IA para que o custo cresça proporcionalmente ao uso real da plataforma (número de usuários, saques, partidas reportadas), sem chamadas desnecessárias.

**Regras arquiteturais de custo:**

1. **`deepseek-v4-flash` como padrão.** Reservar `v4-pro` apenas para funcionalidades que comprovadamente precisam de raciocínio mais profundo — e só após validar necessidade em produção.

2. **Cache automático de prompt.** O DeepSeek cacheia prefixos automaticamente (custo $0,0028 vs $0,14/1M — 98% mais barato). Regra: **system prompt sempre fixo, no topo, sem dados dinâmicos concatenados**. Dados dinâmicos do usuário vão apenas na mensagem `user`.

3. **Contexto limitado e cirúrgico.** Nunca enviar histórico completo:
   - Análise de saque: máx 30 últimas partidas + 20 últimas transações
   - Chatbot: máx 10 turnos na janela da conversa
   - Resumo de ticket: máx 5.000 tokens de conteúdo
   - Denúncia de partida: PGN + tempos de jogada + avaliação Stockfish (não histórico do usuário inteiro)

4. **Sob demanda, nunca em polling.** Resumo de ticket → gerado ao clicar "Resumir", não ao abrir. Análise de partida → gerada ao clicar "Analisar". Perfil de risco → gerado ao abrir a aba no admin, com cache de 24h.

5. **Sem detecção por jogada (real-time).** Essa feature gera uma chamada a cada lance de cada partida competitiva — volume incompatível com custo controlado. Substituída pelo sistema de denúncia descrito na seção 13.7.

**Estimativa de custo por recurso (flash, cache hit no system prompt):**

| Recurso | Quando disparado | Input + Output | Custo estimado |
|---------|-----------------|----------------|---------------|
| Análise de risco de saque | A cada saque solicitado | ~2.200 + 200 tokens | ~$0,00037/análise |
| Chatbot de suporte | Por turno de conversa | ~600 + 300 tokens | ~$0,00016/turno |
| Resumo de ticket | Botão no admin | ~3.000 + 300 tokens | ~$0,00048/resumo |
| Denúncia de partida | Por partida reportada | ~3.500 + 400 tokens | ~$0,00059/denúncia |
| Perfil de risco (admin) | Por usuário, 1×/dia | ~2.500 + 400 tokens | ~$0,00046/perfil |
| Análise de partida (admin) | Sob demanda | ~4.000 + 500 tokens | ~$0,00070/análise |

**Perspectiva:** 1.000 saques + 200 denúncias + 500 turnos de chatbot + 100 resumos de ticket = **~$0,58**. O custo cresce com o sucesso da plataforma, não em idle.

**Monitoramento:** logar `usage.prompt_tokens` e `usage.completion_tokens` em cada chamada (já está no `DeepseekService`). Agregar por tipo de feature na tabela `ai_usage_logs` para visualizar no painel de manutenção.

**Características-chave da API:**
- Suporte a **thinking mode** (`"thinking": {"type": "enabled"}`) com `reasoning_effort`
- Function calling com modo strict (JSON schema validado)
- Streaming nativo
- Cache automático de prompt (reduz custo em 98% para prompts de sistema repetidos)
- 1M de tokens de contexto

**Integração no NestJS:**

```ts
// apps/api/src/deepseek/deepseek.service.ts
import OpenAI from 'openai'

@Injectable()
export class DeepseekService {
  private readonly client: OpenAI
  private readonly logger = new Logger(DeepseekService.name)

  constructor(config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.get('DEEPSEEK_API_KEY'),
      baseURL: 'https://api.deepseek.com',
    })
  }

  async analyze<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: 'deepseek-v4-flash',    // fase 1: sempre flash
      messages: [
        { role: 'system', content: systemPrompt },  // fixo → cache hit após primeira chamada
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,               // limitar output para controlar custo
    })
    const usage = response.usage
    this.logger.log(`DeepSeek tokens: ${usage?.prompt_tokens} in / ${usage?.completion_tokens} out`)
    return JSON.parse(response.choices[0].message.content) as T
  }

  streamChat(messages: OpenAI.ChatCompletionMessageParam[]) {
    return this.client.chat.completions.stream({
      model: 'deepseek-v4-flash',
      messages,
      max_tokens: 400,               // respostas concisas no chatbot
    })
  }
}
```

Adicionar ao `docker-compose.prod.yml`:
```yaml
DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
```

---

### 13.2 Análise de Risco de Saque (Anti-cheat)

**Modelo:** `deepseek-v4-flash`  
**Quando é chamado:** automaticamente ao criar uma solicitação de saque  
**Trigger:** `WithdrawalsService.requestWithdrawal()` chama `RiskAnalysisService.analyzeWithdrawal()`

**Contexto enviado ao modelo:**
- Histórico completo de partidas (últimas 50): oponentes, resultado, tempo de cada jogada, ELO antes/depois
- Histórico financeiro: todos os depósitos e saques anteriores
- Dados do usuário: data de cadastro, CPF verificado, número de amigos
- Valor do saque atual e saldo da wallet

**Saída esperada (JSON via function calling):**

```json
{
  "risk_score": 0,
  "risk_level": "LOW",
  "recommendation": "APPROVE",
  "flags": [],
  "summary": "Usuário com histórico consistente de 6 meses, padrão de jogo regular.",
  "details": {
    "account_age_days": 187,
    "win_rate_last_30d": 0.51,
    "avg_move_time_seconds": 14.2,
    "deposit_withdrawal_ratio": 0.7
  }
}
```

**Níveis de risco → ação automática:**

| Risk Level | Score | Ação |
|-----------|-------|------|
| LOW | 0–39 | Aprovação automática → processa PIX |
| MEDIUM | 40–69 | Aprovação automática com flag de monitoramento |
| HIGH | 70–89 | Bloqueio → fila de revisão manual pelo Financeiro |
| CRITICAL | 90–100 | Bloqueio permanente + alerta de fraude no Dashboard |

**Flags detectáveis:**
- `new_account_fast_withdrawal`: cadastro < 7 dias + saque
- `abnormal_win_rate`: win rate > 85% nas últimas 20 partidas
- `robotic_move_timing`: desvio padrão do tempo de jogada < 1 segundo (Stockfish timing)
- `no_deposit_history`: saque sem depósito anterior (prêmio de torneio suspeito)
- `single_opponent`: > 70% das vitórias contra o mesmo oponente
- `rapid_games_spike`: volume de partidas 5x acima da média histórica do usuário

**Custo estimado:** ~2.000 tokens por análise → $0,00056 por saque (flash). Para 1.000 saques/mês: $0,56.

---

### 13.3 Chatbot de Suporte (Primeira Interação)

**Modelo:** `deepseek-v4-flash` com streaming  
**Onde:** nova página `/support` no frontend do jogador  
**Objetivo:** resolver dúvidas comuns sem criar ticket

**Fluxo:**
1. Usuário abre `/support`
2. Chatbot responde perguntas frequentes em streaming (resposta aparece progressivamente)
3. Se o chatbot não resolver: "Quero falar com um humano" → cria ticket automaticamente com o resumo da conversa como primeira mensagem

**System prompt base (fixo, cacheado pelo DeepSeek):**

```
Você é o suporte do Mega Chess Online, plataforma brasileira de xadrez online.
Responda SOMENTE sobre: depósitos PIX, saques, regras dos torneios, problemas de conta, 
regras do jogo de xadrez. Para outros assuntos, diga que não pode ajudar e ofereça criar ticket.
Seja conciso e direto. Responda em português brasileiro.

Taxas atuais: [injetadas da platform_config em runtime]
Regras dos torneios: [resumo dos tipos de torneio]
```

**Contexto dinâmico por usuário injetado em runtime:**
- Saldo atual da wallet
- Último depósito e saque (status)
- Partidas em andamento

**Custo estimado:** ~500 tokens por interação → $0,00007 (flash). Praticamente zero.

**Endpoint:**
```
POST /api/v1/support/chat          → streaming (text/event-stream)
POST /api/v1/support/chat/escalate → encerrar chat e criar ticket com histórico
```

---

### 13.4 Resumo Automático de Tickets

**Modelo:** `deepseek-v4-flash`  
**Quando é gerado:** ao abrir um ticket com mais de 5 mensagens no admin  
**Onde aparece:** painel lateral direito na tela de detalhe do ticket

**Saída:**
```json
{
  "summary": "Usuário relata falha em saque de R$50 em 20/06. Chave PIX registrada como CPF mas tentou usar email. Já tentou 2 vezes.",
  "suggested_action": "Orientar o usuário a atualizar a chave PIX no perfil para o formato correto.",
  "category_suggestion": "PAYMENT",
  "priority_suggestion": "MEDIUM"
}
```

O admin pode aceitar as sugestões de categoria e prioridade com um clique.

---

### 13.5 Análise de Partidas com Explicação

**Modelo:** `deepseek-v4-flash` (fase 1) / `deepseek-v4-pro` com thinking (fase 2 — quando orçamento permitir)  
**Onde:** tela de replay de partida no perfil do usuário (admin) e futuramente no perfil público  
**Arquitetura:** Stockfish calcula → DeepSeek explica

**Fluxo:**
1. Backend envia o PGN para o Stockfish (já disponível como worker)
2. Stockfish retorna avaliação de cada lance (centipawn loss, melhor jogada alternativa)
3. DeepSeek recebe o PGN + análise do Stockfish e gera comentários em português

**Saída:**
```json
{
  "game_summary": "Vitória sólida do brancas com domínio do centro desde a abertura italiana.",
  "turning_point": "Lance 18: Brancas sacrificaram o cavalo em f7, forçando o rei preto a se expor.",
  "mistakes": [
    { "move": 23, "player": "black", "comment": "Rxe4 foi um erro grave — Dxe4 mantinha a defesa." }
  ],
  "opening": "Italiana — Variante Giuoco Piano",
  "overall_rating": { "white": "Bom (78/100)", "black": "Médio (54/100)" }
}
```

**Custo estimado:** ~3.000 tokens por análise com thinking → ~$0,003 (pro). Gerado sob demanda.

---

### 13.6 Sistema de Denúncia de Partida (Anti-cheat por Ação do Usuário)

> Substitui a detecção em tempo real por jogada — mais econômico e com menos falsos positivos, pois é acionado apenas quando um usuário genuinamente suspeita de trapaça.

**Modelo:** `deepseek-v4-flash`  
**Quando:** usuário clica em "Denunciar partida" após o fim de uma partida competitiva (duelo ou torneio)

---

**Fluxo completo:**

```
Usuário                    API                         DeepSeek               Admin
   │                        │                              │                    │
   │── POST /matches/:id ──►│                              │                    │
   │     /report            │── análise async ────────────►│                    │
   │◄── 202 Accepted ───────│   (não bloqueia o usuário)  │                    │
   │                        │◄── verdict JSON ─────────────│                    │
   │◄── notificação WS ─────│                              │                    │
   │   "Análise concluída"  │                              │                    │
   │                        │                              │                    │
   │  [se discordar]        │                              │                    │
   │── POST /report/:id ───►│                              │                    │
   │     /appeal            │──────────────────────────────────────────────────►│
   │◄── 201 Created ────────│                              │              fila admin
```

---

**O que o usuário vê:**

1. Na tela de resultado da partida ou no histórico: botão **"Denunciar uso de engine"**
2. Ao clicar: modal com campo de texto livre ("Descreva o que observou — opcional") + botão confirmar
3. Resposta imediata: "Denúncia recebida. Estamos analisando a partida. Você receberá uma notificação em breve."
4. A análise é assíncrona (segundos a poucos minutos)
5. Notificação chega via WebSocket com o veredicto:
   - ✅ **CLEAN:** "A análise não identificou padrões suspeitos nesta partida."
   - ⚠️ **SUSPICIOUS:** "Foram identificados padrões incomuns. A partida foi encaminhada para revisão manual."
   - 🚨 **CHEATING:** "Padrões consistentes com uso de engine foram detectados. O caso foi aberto para revisão."
6. Se o veredicto for **CLEAN** e o usuário discordar: botão **"Apelar"** disponível por 48h

**Restrições para evitar abuso:**
- Máximo 3 denúncias por usuário por dia
- Só partidas competitivas (duelos e torneios) — offline não pode ser denunciado
- Só pode denunciar a própria partida
- Período máximo: partidas das últimas 72h

---

**Contexto enviado ao DeepSeek:**

```json
{
  "match": {
    "pgn": "1. e4 e5 2. Nf3 ...",
    "move_times_ms": [1204, 892, 15100, 743, ...],
    "result": "BLACK_WINS"
  },
  "reported_player": {
    "color": "black",
    "elo": 1250,
    "games_played": 87,
    "win_rate_last_30d": 0.61
  },
  "stockfish_analysis": {
    "avg_centipawn_loss": 8,
    "perfect_moves_pct": 0.82,
    "blunders": 0,
    "best_move_match_pct": 0.91
  },
  "reporter_note": "Jogou perfeitamente sem errar nenhuma lance"
}
```

> Stockfish roda no backend (worker thread) antes de chamar o DeepSeek — custo zero, apenas CPU. O DeepSeek recebe os dados já processados, não o PGN cru para analisar ele mesmo.

---

**Saída esperada (JSON estruturado):**

```json
{
  "verdict": "SUSPICIOUS",
  "confidence": 0.74,
  "flags": [
    "avg_centipawn_loss_below_threshold",
    "best_move_match_above_threshold",
    "move_time_inconsistent_with_elo"
  ],
  "explanation_pt": "O jogador apresentou 82% de jogadas ótimas e perda média de apenas 8 centipawns, valores atípicos para o rating de 1250. O tempo de resposta foi consistentemente abaixo de 1 segundo em posições de alta complexidade.",
  "recommendation": "MANUAL_REVIEW"
}
```

---

**Ações automáticas por veredicto:**

| Veredicto | Confidence | Ação automática | Notificação ao denunciante |
|-----------|-----------|-----------------|--------------------------|
| CLEAN | qualquer | Nenhuma | "Análise: nenhum padrão suspeito encontrado" |
| SUSPICIOUS | < 0.80 | Flag no match, entra na fila admin | "Padrões incomuns detectados — em revisão" |
| SUSPICIOUS | ≥ 0.80 | Flag no match, entra na fila admin com prioridade alta | "Padrões incomuns detectados — em revisão prioritária" |
| CHEATING | qualquer | Flag no match + flag no usuário denunciado, fila admin | "Padrões de engine detectados — caso aberto" |

**Nenhum veredicto resulta em punição automática** — sempre passa por revisão humana no admin antes de qualquer ação.

---

**Sistema de Apelação:**

Disponível por 48h após veredicto CLEAN, se o denunciante discordar:

- Campo de texto: "Descreva por que você acredita que a análise foi incorreta"
- Cria um `match_report_appeal` vinculado ao relatório original
- Entra na fila de revisão manual do admin com prioridade MEDIUM
- O admin vê: veredicto da IA, confidence, flags, nota do denunciante, nota da apelação e o PGN com replay

**Endpoint:**
```
POST /api/v1/matches/:id/report          → criar denúncia
GET  /api/v1/matches/:id/report          → status da denúncia (para o denunciante)
POST /api/v1/matches/:id/report/appeal   → apelar do veredicto CLEAN
```

**Admin:**
```
GET  /api/v1/admin/match-reports         → fila de revisão (filtros: veredicto, prioridade, status)
GET  /api/v1/admin/match-reports/:id     → detalhe com AI analysis + replay
POST /api/v1/admin/match-reports/:id/resolve → decisão final: DISMISS / WARN / SUSPEND / BAN
```

---

**Novas entidades:**

```sql
match_reports
  id               UUID PK
  match_id         UUID FK → matches
  reporter_id      UUID FK → users
  reported_user_id UUID FK → users
  reporter_note    TEXT
  ai_verdict       ENUM(CLEAN, SUSPICIOUS, CHEATING)
  ai_confidence    DECIMAL(4,3)
  ai_flags         JSONB
  ai_explanation   TEXT
  ai_raw_response  JSONB
  status           ENUM(ANALYZING, COMPLETED, UNDER_REVIEW, RESOLVED)
  resolution       ENUM(DISMISSED, WARNED, SUSPENDED, BANNED)
  resolved_by      UUID FK → admin_users
  resolved_at      TIMESTAMP
  created_at       TIMESTAMP

match_report_appeals
  id          UUID PK
  report_id   UUID FK → match_reports
  user_id     UUID FK → users
  note        TEXT NOT NULL
  status      ENUM(PENDING, REVIEWED)
  created_at  TIMESTAMP
```

---

### 13.7 Resumo de Comportamento do Usuário

**Modelo:** `deepseek-v4-flash`  
**Onde:** aba "Atividade" no perfil do usuário no admin  
**Gerado:** ao abrir a aba, se o último resumo tem mais de 24h

Gera um parágrafo de análise do usuário:
> "Jogador ativo há 3 meses, ELO crescente (+150 pontos). Padrão de jogo consistente com horário preferencial entre 20h–23h. Fez 3 depósitos e 1 saque sem irregularidades. Participou de 7 torneios, ficou em top 3 em 2 deles. Sem tickets de suporte abertos."

---

### 13.8 Variável de Ambiente Necessária

```
DEEPSEEK_API_KEY=sk-...
```

Adicionar em Coolify (com "Is Literal?" marcado) e mapear no `docker-compose.prod.yml`:
```yaml
api:
  environment:
    DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
```

---

## 14. Log de Ações do Usuário

### 14.1 Conceito

Além dos `system_logs` (erros técnicos) e `audit_logs` (ações de admins), existe uma terceira camada: **o log de ações do próprio usuário** (`user_activity_logs`).

Esse log responde à pergunta: *"O que este usuário fez na plataforma e quando?"*

É fundamental para:
- Investigação de fraude (admin visualiza a linha do tempo do usuário)
- Suporte ao cliente ("quando você tentou o saque?")
- Análise de risco no DeepSeek (contexto comportamental)
- Evidência em caso de disputa

### 14.2 Ações Registradas

**Autenticação:**
| Ação | Evento |
|------|--------|
| `AUTH_LOGIN` | Login bem-sucedido |
| `AUTH_LOGIN_FAILED` | Tentativa de login com senha errada |
| `AUTH_LOGOUT` | Logout explícito |
| `AUTH_TOKEN_REFRESH` | Refresh de token |
| `AUTH_PASSWORD_RESET` | Redefinição de senha |
| `AUTH_REGISTER` | Cadastro na plataforma |

**Partidas:**
| Ação | Evento |
|------|--------|
| `MATCH_STARTED` | Partida iniciada (com opponent_id, match_id, tipo) |
| `MATCH_FINISHED` | Partida concluída (com resultado, ELO before/after) |
| `MATCH_FORFEITED` | Desistência |
| `MATCHMAKING_JOINED` | Entrou na fila de matchmaking |
| `MATCHMAKING_LEFT` | Saiu da fila |
| `CHALLENGE_SENT` | Desafio enviado a outro jogador |
| `CHALLENGE_ACCEPTED` | Desafio aceito |
| `CHALLENGE_REJECTED` | Desafio recusado |

**Social:**
| Ação | Evento |
|------|--------|
| `FRIEND_REQUEST_SENT` | Solicitação de amizade enviada |
| `FRIEND_REQUEST_ACCEPTED` | Solicitação aceita |
| `FRIEND_REQUEST_REJECTED` | Solicitação recusada |
| `FRIEND_REMOVED` | Amizade removida |

**Financeiro:**
| Ação | Evento |
|------|--------|
| `DEPOSIT_INITIATED` | QR Code PIX gerado (com valor) |
| `DEPOSIT_CONFIRMED` | Pagamento confirmado pelo webhook |
| `DEPOSIT_EXPIRED` | QR Code expirado sem pagamento |
| `WITHDRAWAL_REQUESTED` | Saque solicitado (com valor, chave PIX) |
| `WITHDRAWAL_PROCESSED` | Saque enviado pelo Asaas |
| `WITHDRAWAL_FAILED` | Falha no envio do PIX |
| `WITHDRAWAL_BLOCKED` | Bloqueado pelo sistema de anti-cheat |
| `PRIZE_RECEIVED` | Prêmio de torneio creditado |

**Torneios:**
| Ação | Evento |
|------|--------|
| `TOURNAMENT_JOINED` | Inscreveu-se em torneio (com fee pago) |
| `TOURNAMENT_LEFT` | Saiu antes do início |
| `TOURNAMENT_FINISHED` | Finalizou torneio (com posição) |

**Perfil:**
| Ação | Evento |
|------|--------|
| `PROFILE_UPDATED` | Alterou dados do perfil |
| `AVATAR_UPDATED` | Alterou foto de perfil |
| `PIX_KEY_UPDATED` | Alterou chave PIX |
| `CPF_REGISTERED` | Cadastrou CPF |
| `SUPPORT_TICKET_CREATED` | Abriu ticket de suporte |

### 14.3 Estrutura da Entidade

```sql
user_activity_logs
  id          UUID PK
  user_id     UUID FK → users (NOT NULL, INDEX)
  action      VARCHAR(50) NOT NULL                 -- AUTH_LOGIN, WITHDRAWAL_REQUESTED...
  metadata    JSONB                                -- dados específicos da ação
  ip_address  VARCHAR(45)
  user_agent  TEXT
  created_at  TIMESTAMP NOT NULL (INDEX)
```

**Exemplo de `metadata` por ação:**

```jsonc
// MATCH_FINISHED
{ "match_id": "abc", "result": "WIN", "elo_before": 1350, "elo_after": 1366, "opponent_id": "xyz" }

// WITHDRAWAL_REQUESTED
{ "amount_cc": 50, "amount_brl": 49.00, "pix_key_type": "CPF", "withdrawal_id": "..." }

// AUTH_LOGIN_FAILED
{ "reason": "wrong_password", "attempt_number": 3 }

// DEPOSIT_CONFIRMED
{ "amount_brl": 100, "amount_cc": 100, "payment_id": "pay_asaas_123" }
```

### 14.4 Implementação no NestJS

Criar `UserActivityService` com um único método público:

```ts
@Injectable()
export class UserActivityService {
  constructor(
    @InjectRepository(UserActivityLog)
    private repo: Repository<UserActivityLog>
  ) {}

  log(userId: string, action: UserAction, metadata?: object, req?: Request) {
    // Fire-and-forget — não bloqueia o fluxo principal
    this.repo.insert({
      userId,
      action,
      metadata,
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    }).catch(() => {}) // falha silenciosa — log nunca deve quebrar a operação principal
  }
}
```

Chamado em cada service relevante:
```ts
// WithdrawalsService
async requestWithdrawal(userId, amount, pixKey) {
  // ... lógica do saque ...
  this.activity.log(userId, 'WITHDRAWAL_REQUESTED', { amount_cc: amount, pixKey })
}
```

### 14.5 Retenção de Dados

- Logs **financeiros** e **de autenticação**: retidos por **2 anos** (conformidade fiscal/LGPD)
- Logs de **partida** e **social**: retidos por **1 ano**
- Logs de **perfil**: retidos por **6 meses**

Cron job semanal para limpeza automática por categoria.

### 14.6 Visualização no Admin

Na aba "Atividade" do perfil do usuário:

**Linha do tempo visual** (estilo feed):
```
📅 25/06/2026 21:43  WITHDRAWAL_REQUESTED  R$ 50,00 → Chave PIX: CPF
📅 25/06/2026 21:30  MATCH_FINISHED        Vitória vs. chesslover42 (+16 ELO)
📅 25/06/2026 21:05  MATCH_STARTED         vs. chesslover42 (Regular, tempo 10min)
📅 25/06/2026 20:58  MATCHMAKING_JOINED    —
📅 25/06/2026 20:15  DEPOSIT_CONFIRMED     R$ 50,00 confirmado
📅 25/06/2026 20:10  DEPOSIT_INITIATED     QR Code de R$ 50,00 gerado
📅 25/06/2026 20:05  AUTH_LOGIN            IP: 189.x.x.x | Chrome/Windows
```

**Filtros:** por tipo de ação (autenticação / partidas / financeiro / social / perfil), período, busca por IP.

**Endpoint:**
```
GET /api/v1/admin/users/:id/activity?type=FINANCIAL&from=2026-06-01&to=2026-06-30&page=1
```

---

## 15. Novas Entidades do Banco de Dados

### 13.1 `admin_users`

```sql
id            UUID PK
name          VARCHAR(100) NOT NULL
email         VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
role          ENUM(SUPORTE, FINANCEIRO, OPERADOR, ADMIN) NOT NULL
is_active     BOOLEAN DEFAULT true
mfa_secret    VARCHAR(100)                    -- TOTP secret (criptografado)
mfa_enabled   BOOLEAN DEFAULT false
force_pw_reset BOOLEAN DEFAULT true
last_login_at TIMESTAMP
last_login_ip VARCHAR(45)
created_at    TIMESTAMP
updated_at    TIMESTAMP
```

### 13.2 `admin_refresh_tokens`

```sql
id         UUID PK
token      VARCHAR(500) UNIQUE NOT NULL
admin_id   UUID FK → admin_users
expires_at TIMESTAMP
created_at TIMESTAMP
```

### 13.3 `audit_logs`

```sql
id           UUID PK
admin_id     UUID FK → admin_users
action       VARCHAR(100) NOT NULL       -- USER_SUSPENDED, ELO_ADJUSTED, CONFIG_CHANGED...
entity_type  VARCHAR(50)                 -- user, tournament, withdrawal, config...
entity_id    VARCHAR(100)                -- ID da entidade afetada
before_value JSONB                       -- Estado anterior (se aplicável)
after_value  JSONB                       -- Estado após a ação
ip_address   VARCHAR(45)
user_agent   TEXT
created_at   TIMESTAMP
```

### 13.4 `system_logs`

```sql
id          UUID PK
level       ENUM(ERROR, WARN) NOT NULL
context     VARCHAR(100)                -- Módulo NestJS (e.g., TournamentsService)
message     TEXT NOT NULL
stack_trace TEXT
request_id  VARCHAR(100)
created_at  TIMESTAMP
```

### 13.5 `platform_config`

```sql
key         VARCHAR(100) PK
value       TEXT NOT NULL
description TEXT
updated_by  UUID FK → admin_users
updated_at  TIMESTAMP
```

### 13.6 `support_tickets`

```sql
id           UUID PK
user_id      UUID FK → users
category     ENUM(PAYMENT, MATCH, ACCOUNT, TECHNICAL, OTHER) NOT NULL
priority     ENUM(LOW, MEDIUM, HIGH) DEFAULT MEDIUM
status       ENUM(OPEN, IN_PROGRESS, WAITING_USER, CLOSED) DEFAULT OPEN
title        VARCHAR(200) NOT NULL
assigned_to  UUID FK → admin_users (nullable)
close_reason ENUM(RESOLVED, NOT_REPRODUCIBLE, DUPLICATE, NO_RESPONSE, FRAUD)
close_note   TEXT
sla_deadline TIMESTAMP                  -- calculado na criação (ex: +24h para HIGH)
created_at   TIMESTAMP
updated_at   TIMESTAMP
closed_at    TIMESTAMP
```

### 13.7 `ticket_messages`

```sql
id          UUID PK
ticket_id   UUID FK → support_tickets
sender_type ENUM(USER, ADMIN) NOT NULL
sender_id   UUID NOT NULL               -- user.id ou admin_user.id
content     TEXT NOT NULL
is_internal BOOLEAN DEFAULT false       -- nota interna (só admins veem)
created_at  TIMESTAMP
```

### 13.8 `ticket_attachments`

```sql
id           UUID PK
message_id   UUID FK → ticket_messages
filename     VARCHAR(255) NOT NULL
mime_type    VARCHAR(100) NOT NULL      -- image/jpeg, image/png, image/webp, application/pdf
file_path    VARCHAR(500) NOT NULL      -- caminho relativo em uploads/tickets/
file_size_kb INTEGER NOT NULL
created_at   TIMESTAMP
```

### 13.9 Alterações em entidades existentes

**`users` (adicionar campos):**
```sql
banned_until  TIMESTAMP                 -- null = não banido
banned_reason TEXT
```

**`notifications` (adicionar tipo ao enum):**
```sql
type: adicionar ADMIN_MESSAGE, MAINTENANCE_ALERT
```

---

### 15.10 `match_reports` e `match_report_appeals` (novas)

Descritas na seção 13.6.

### 15.11 `ai_usage_logs` (nova)

```sql
id           UUID PK
feature      VARCHAR(50) NOT NULL    -- WITHDRAWAL_RISK, TICKET_SUMMARY, MATCH_REPORT, CHATBOT...
model        VARCHAR(30) NOT NULL    -- deepseek-v4-flash, deepseek-v4-pro
prompt_tokens   INTEGER NOT NULL
output_tokens   INTEGER NOT NULL
cost_usd     DECIMAL(10,8)          -- calculado: (prompt×0.14 + output×0.28) / 1_000_000
reference_id VARCHAR(100)           -- ID do saque, ticket, partida etc
created_at   TIMESTAMP NOT NULL
```

Permite ao admin ver custo real por feature no painel de manutenção.

### 15.12 `user_activity_logs` (nova)

```sql
id          UUID PK
user_id     UUID FK → users NOT NULL
action      VARCHAR(50) NOT NULL
metadata    JSONB
ip_address  VARCHAR(45)
user_agent  TEXT
created_at  TIMESTAMP NOT NULL

INDEX(user_id, created_at DESC)
INDEX(action, created_at DESC)
```

---

## 16. Novos Endpoints da API

Todos os endpoints abaixo ficam em `/api/v1/admin/*` e requerem o `AdminJwtGuard`.

### Auth

```
POST /admin/auth/login          → Login do admin (retorna JWT admin)
POST /admin/auth/mfa/verify     → Verificar código TOTP
POST /admin/auth/refresh        → Renovar token admin
POST /admin/auth/logout         → Logout admin
```

### Dashboard

```
GET /admin/dashboard/kpis            → KPIs do dia (jogadores, financeiro)
GET /admin/dashboard/live            → Dados em tempo real (WebSocket)
GET /admin/dashboard/matches-today   → Partidas paginadas do dia
GET /admin/dashboard/top-winners     → Top ganhadores da semana
GET /admin/dashboard/alerts          → Alertas ativos
```

### Usuários

```
GET    /admin/users                  → Lista paginada com filtros
GET    /admin/users/:id              → Perfil completo
GET    /admin/users/:id/matches      → Histórico de partidas
GET    /admin/users/:id/transactions → Extrato financeiro
GET    /admin/users/:id/tournaments  → Histórico em torneios
GET    /admin/users/:id/tickets      → Tickets de suporte
GET    /admin/users/:id/activity     → Log de ações admin sobre o usuário
POST   /admin/users/:id/message      → Enviar notificação interna
POST   /admin/users/:id/suspend      → Suspender/banir (body: reason, duration)
DELETE /admin/users/:id/suspend      → Remover suspensão
POST   /admin/users/:id/force-logout → Invalidar todos os tokens
PATCH  /admin/users/:id/elo          → Ajustar ELO manualmente (Admin only)
GET    /admin/users/export           → Exportar CSV com filtros ativos
```

### Transações

```
GET  /admin/transactions             → Lista paginada com filtros
GET  /admin/deposits                 → Lista de depósitos
GET  /admin/withdrawals              → Lista de saques
POST /admin/withdrawals/:id/approve  → Aprovar saque bloqueado
POST /admin/withdrawals/:id/reject   → Rejeitar saque (estornar $CC)
POST /admin/transactions/refund      → Reembolso manual (Admin only)
GET  /admin/transactions/export      → Exportar CSV
GET  /admin/transactions/rake-summary → Resumo de rake por período
```

### Campeonatos

```
GET  /admin/tournaments              → Lista com filtros
GET  /admin/tournaments/:id          → Detalhe completo (bracket, partidas)
POST /admin/tournaments              → Criar novo torneio
POST /admin/tournaments/:id/force-start  → Forçar início (Admin)
POST /admin/tournaments/:id/cancel   → Cancelar com reembolso (Admin)
```

### Suporte

```
GET    /admin/support/tickets        → Lista paginada com filtros
POST   /admin/support/tickets        → Criar ticket (admin abrindo em nome do usuário)
GET    /admin/support/tickets/:id    → Detalhe do ticket
PATCH  /admin/support/tickets/:id    → Atualizar status, prioridade, atribuição
POST   /admin/support/tickets/:id/messages  → Enviar mensagem (com is_internal)
POST   /admin/support/tickets/:id/attachments → Upload de anexo
GET    /admin/support/tickets/:id/attachments/:attachmentId → Baixar anexo (protegido)
GET    /admin/support/metrics        → KPIs do suporte
```

### Manutenção

```
GET  /admin/maintenance/metrics      → Performance da aplicação
GET  /admin/maintenance/logs         → System logs paginados com filtros
GET  /admin/maintenance/asaas-status → Status da conexão Asaas
GET  /admin/maintenance/config       → Todas as platform_config
PATCH /admin/maintenance/config      → Atualizar config (Admin only)
POST /admin/maintenance/mode         → Ativar/desativar modo manutenção (Admin only)
POST /admin/maintenance/notify-all   → Broadcast de notificação (Operador+)
POST /admin/maintenance/redis/flush  → Limpar cache (Admin only)
GET  /admin/maintenance/redis/stats  → Estatísticas Redis
```

### Administradores

```
GET    /admin/staff                  → Lista de AdminUsers
POST   /admin/staff                  → Criar novo AdminUser
GET    /admin/staff/:id              → Detalhe
PATCH  /admin/staff/:id              → Editar (nome, email, role, status)
POST   /admin/staff/:id/reset-password → Gerar nova senha temporária
POST   /admin/staff/:id/reset-mfa    → Desvincular MFA
GET    /admin/staff/audit-log        → Log de ações de todos os admins
```

### Perfil do Admin (self)

```
GET   /admin/me                      → Dados do admin logado
PATCH /admin/me                      → Alterar nome
PATCH /admin/me/password             → Alterar senha
POST  /admin/me/mfa/setup            → Iniciar configuração MFA (retorna QR code)
POST  /admin/me/mfa/confirm          → Confirmar código e ativar MFA
GET   /admin/me/activity             → Próprio log de ações
```

### Público (sem auth, consumido pelo frontend dos jogadores)

```
GET /api/v1/config/public            → Retorna configurações públicas (taxas, modo manutenção, mensagem)
```

---

### DeepSeek

```
POST /api/v1/support/chat                   → Streaming do chatbot (jogador)
POST /api/v1/support/chat/escalate          → Criar ticket a partir do chat
GET  /api/v1/admin/users/:id/risk-summary   → Análise DeepSeek do usuário
GET  /api/v1/admin/tickets/:id/summary      → Resumo automático do ticket
GET  /api/v1/matches/:id/analysis           → Análise de partida (Stockfish + DeepSeek)
```

### User Activity

```
GET /api/v1/admin/users/:id/activity        → Log paginado com filtros
GET /api/v1/users/me/activity               → Próprio log (para transparência ao jogador)
```

---

## 17. Estrutura de Arquivos Sugerida

### Backend (apps/api/src/)

```
src/
├── admin/
│   ├── auth/
│   │   ├── admin-auth.controller.ts
│   │   ├── admin-auth.service.ts
│   │   ├── admin-auth.module.ts
│   │   ├── guards/admin-jwt.guard.ts
│   │   ├── guards/roles.guard.ts
│   │   ├── decorators/roles.decorator.ts
│   │   ├── decorators/current-admin.decorator.ts
│   │   └── strategies/admin-jwt.strategy.ts
│   ├── dashboard/
│   ├── users/
│   ├── transactions/
│   ├── tournaments/
│   ├── support/
│   ├── maintenance/
│   ├── staff/
│   └── admin.module.ts
├── platform-config/
│   ├── platform-config.service.ts
│   ├── platform-config.module.ts
│   └── platform-config.cache.ts       ← cache em memória (10s TTL)
├── support/                            ← lado do jogador
│   ├── support.controller.ts
│   ├── support.service.ts
│   └── support.module.ts
└── entities/
    ├── admin-user.entity.ts
    ├── admin-refresh-token.entity.ts
    ├── audit-log.entity.ts
    ├── system-log.entity.ts
    ├── platform-config.entity.ts
    ├── support-ticket.entity.ts
    ├── ticket-message.entity.ts
    └── ticket-attachment.entity.ts
```

### Frontend Admin (`apps/admin/`)

```
apps/admin/
├── index.html
├── vite.config.ts
├── package.json                       ← deps: @mui/material, recharts, @tanstack/react-table
├── src/
│   ├── main.tsx                       ← ThemeProvider do MUI + Router
│   ├── App.tsx                        ← Rotas protegidas por AdminGuard
│   ├── theme.ts                       ← createTheme com cores do Mega Chess
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── Dashboard/
│   │   │   └── DashboardPage.tsx      ← Cards KPI + Recharts + tabelas live
│   │   ├── Users/
│   │   │   ├── UsersListPage.tsx      ← TanStack Table com filtros
│   │   │   └── UserDetailPage.tsx     ← Abas: dados / partidas / transações / suporte / atividade
│   │   ├── Transactions/
│   │   │   └── TransactionsPage.tsx   ← Abas: geral / depósitos / saques / bloqueados
│   │   ├── Tournaments/
│   │   │   ├── TournamentsPage.tsx
│   │   │   └── TournamentDetailPage.tsx
│   │   ├── Support/
│   │   │   ├── TicketsListPage.tsx
│   │   │   └── TicketDetailPage.tsx   ← Chat + painel lateral
│   │   ├── Maintenance/
│   │   │   └── MaintenancePage.tsx    ← Métricas + logs + config + manutenção
│   │   ├── Staff/
│   │   │   └── StaffPage.tsx
│   │   └── Profile/
│   │       └── ProfilePage.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx        ← MUI Drawer (sidebar) + AppBar (topbar)
│   │   │   └── Sidebar.tsx            ← Itens filtrados por role, badge na fila anti-cheat
│   │   ├── charts/
│   │   │   ├── KpiCard.tsx            ← Card numérico com ícone e variação %
│   │   │   ├── LineChart.tsx          ← Recharts LineChart wrapper com tema Mega Chess
│   │   │   ├── BarChart.tsx           ← Recharts BarChart wrapper
│   │   │   └── PieChart.tsx           ← Recharts PieChart wrapper
│   │   ├── tables/
│   │   │   └── DataTable.tsx          ← TanStack Table + MUI TableContainer (reutilizável)
│   │   └── ui/
│   │       ├── StatusChip.tsx         ← MUI Chip com cores por status
│   │       ├── RiskBadge.tsx          ← Badge LOW/MEDIUM/HIGH/CRITICAL
│   │       ├── ConfirmDialog.tsx      ← MUI Dialog de confirmação reutilizável
│   │       └── PageHeader.tsx         ← Título + breadcrumb + ação principal
│   ├── store/
│   │   └── admin-auth.store.ts        ← Zustand: token, role, admin logado
│   ├── lib/
│   │   ├── admin-api.ts               ← axios com interceptor de token admin
│   │   └── admin-socket.ts            ← Socket.IO para métricas em tempo real
│   └── guards/
│       ├── AdminGuard.tsx             ← Redireciona para /login se não autenticado
│       └── RoleGuard.tsx             ← Bloqueia rota se role insuficiente
```

**`vite.config.ts` do admin:**
```ts
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },            // porta diferente do web (5173)
  build: { outDir: 'dist' },
})
```

**`docker-compose.prod.yml` — novo serviço:**
```yaml
admin:
  build:
    context: ./apps/admin
    dockerfile: Dockerfile
    args:
      - VITE_API_URL=${APP_ADMIN_API_URL:-https://homologa.megachess.io}
  restart: always
  expose:
    - "80"
  depends_on:
    - api
```

**`.env` do admin:**
```
VITE_API_URL=https://homologa.megachess.io     # homologação
# VITE_API_URL=https://megachess.io            # produção
```

---

## 18. Funcionalidades Adicionais — Detalhamento

### 18.1 Fila de Revisão Anti-cheat

**Seção:** Transações | **Role:** Financeiro+

Saques bloqueados pelo sistema DeepSeek (risk_level HIGH/CRITICAL) entram nesta fila. Diferente da lista geral de saques, esta view é focada em ação:

- Card por saque bloqueado com: usuário, valor, motivo do bloqueio, flags detectadas, score de risco
- Botão "Ver análise completa" → abre painel com o JSON do DeepSeek, histórico de partidas, log de atividade financeira do usuário
- Ações: Aprovar (processa o PIX) | Rejeitar (estorna $CC + notifica) | Escalar para Admin
- SLA: saques em fila por mais de 24h geram alerta vermelho no dashboard
- Contador de fila visível no menu lateral (badge numérico)

**Backend:** `GET /api/v1/admin/withdrawals?status=BLOCKED` + `POST /api/v1/admin/withdrawals/:id/approve|reject`

---

### 18.2 Exportação de Dados do Usuário (LGPD)

**Seção:** Usuários | **Role:** Financeiro+

Obrigação legal da LGPD (Lei 13.709/2018): usuário tem direito de solicitar todos os dados pessoais armazenados sobre ele.

**No admin (para atender solicitações):**
- Botão "Exportar dados" no perfil do usuário
- Gera arquivo ZIP com:
  - `dados_pessoais.json`: nome, email, CPF, endereço, datas
  - `partidas.json`: todas as partidas com PGN
  - `transacoes.json`: extrato completo da wallet
  - `mensagens.json`: mensagens de chat (apenas as do usuário)
  - `atividade.json`: user_activity_logs do usuário
- Download imediato (geração síncrona para volumes normais) ou via job assíncrono para contas antigas com muito dado

**No frontend do jogador (futuramente):**
- Página `/settings/privacy` com botão "Baixar meus dados" (auto-serve)

---

### 18.3 Suspensão Temporária com Razão e Histórico

**Seção:** Usuários | **Role:** Operador+

Suspensão não é binária (ativo/banido). Gradação:

| Tipo | Duração | Efeito | Quem pode aplicar |
|------|---------|--------|-------------------|
| Aviso | — | Apenas notificação ao usuário | Suporte |
| Suspensão leve | 1h – 24h | Bloqueia login temporariamente | Operador |
| Suspensão grave | 7 – 30 dias | Bloqueia login + cancela torneios ativos | Operador |
| Banimento | Permanente | Bloqueia conta + bloqueia novo cadastro com mesmo CPF | Admin |

**Campos obrigatórios no modal:**
- Tipo e duração
- Motivo (texto, mín 20 caracteres)
- Regra violada (dropdown): Fair play / Comportamento abusivo / Fraude financeira / Spam / Outro
- Notificar usuário com explicação: sim/não

**Histórico de suspensões** visível no perfil do usuário (aba Dados Gerais), com data, motivo, admin responsável e se foi removida antecipadamente.

---

### 18.4 Audit Trail (Log de Ações dos Admins)

**Seção:** Administradores | **Role:** Admin (leitura de todos), cada admin vê o próprio

Toda ação com efeito colateral no sistema gera um registro em `audit_logs`:

```
Admin Igor | USER_SUSPENDED   | user: chesslover42  | 2026-06-25 21:05 | IP 189.x.x.x
Admin Igor | WITHDRAWAL_APPROVED | withdrawal: w_123 | 2026-06-25 20:55
Admin Ana  | CONFIG_CHANGED   | key: rake_pct 0.10→0.12 | 2026-06-25 18:00
Admin Ana  | ELO_ADJUSTED     | user: player99 | 1350→1400 | 2026-06-25 17:30
```

**Funcionalidades da interface:**
- Filtros: admin, tipo de ação, entidade afetada, período
- Busca por usuário alvo (ex: ver tudo que aconteceu com `chesslover42`)
- Expandir linha: mostra `before_value` e `after_value` em JSON diff visual
- Exportar CSV com filtros ativos (para auditoria externa)
- Irreversível: logs não podem ser editados ou excluídos (nem pelo Admin)

---

### 18.5 Notas Internas em Tickets

**Seção:** Suporte | **Role:** Suporte+

Comunicação interna entre membros da equipe de suporte, invisível ao usuário:

- Checkbox "Nota interna 🔒" ao enviar mensagem no ticket
- Visual diferente: fundo amarelo âmbar com ícone de cadeado
- Exemplos de uso:
  - "Cheque com o financeiro se o saque dele estava realmente bloqueado"
  - "Usuário já abriu 3 tickets sobre o mesmo assunto — possível manipulação"
  - "Aprovado pelo gerente para reembolso manual"
- Notas internas **não** são incluídas no export de dados do usuário (LGPD)
- Notas internas **são** incluídas no audit_log para rastreabilidade interna

---

### 18.6 SLA por Prioridade de Ticket

**Seção:** Suporte | **Role:** — (automático)

Tempo máximo de primeira resposta por prioridade:

| Prioridade | SLA primeira resposta | SLA resolução |
|-----------|----------------------|---------------|
| Alta 🔴 | 2 horas | 24 horas |
| Média 🟡 | 8 horas | 72 horas |
| Baixa 🟢 | 24 horas | 7 dias |

**No painel:**
- Barra de progresso colorida no card do ticket: verde → amarelo → vermelho conforme SLA se aproxima
- Tickets fora do SLA recebem badge ⚠️ e sobem na listagem
- Métrica de SLA no widget do dashboard: "% de tickets resolvidos dentro do SLA esta semana"
- Alerta automático ao admin atribuído quando SLA está a 25% do prazo

---

### 18.7 Recorrência de Torneios

**Seção:** Campeonatos | **Role:** Admin

Torneios recorrentes são criados automaticamente por um cron job no NestJS, sem intervenção manual:

**Configuração no painel:**
```
Tipo:           FAISCA
Recorrência:    Diário
Horário:        19:00 BRT
Ativo:          Sim
Próximo início: 2026-06-26 19:00
```

**Templates salvos:**

| Template | Tipo | Recorrência | Horário | Status |
|----------|------|-------------|---------|--------|
| Faísca Noturno | FAISCA | Diário | 19:00 | ✅ Ativo |
| Tempestade do Fim de Semana | TEMPESTADE | Sáb+Dom | 15:00 | ✅ Ativo |
| Grande Torneio Mensal | GRANDE | 1º do mês | 14:00 | ✅ Ativo |

**Comportamento:**
- O cron cria o torneio com status `REGISTERING` automaticamente
- Notificação broadcast enviada aos jogadores elegíveis 30 min antes do início
- Se o torneio anterior não terminou, o novo é adiado 1h automaticamente

---

### 18.8 Broadcast Segmentado de Notificações

**Seção:** Manutenção | **Role:** Operador+

Além do broadcast para todos, o admin pode segmentar:

| Segmento | Descrição | Caso de uso |
|---------|-----------|-------------|
| Todos os usuários | — | Manutenção programada |
| Apenas online agora | Usuários com socket conectado | Aviso urgente |
| Com saldo positivo | Wallet > 0 $CC | Promoção ou torneio especial |
| ELO acima de X | Jogadores avançados | Torneio fechado para alta classificação |
| Sem jogar há 7+ dias | Usuários inativos | Reengajamento |
| Participantes do torneio X | Por torneio_id | Informação específica do torneio |

**Pré-visualização antes de enviar:**
- "Esta notificação será enviada para X usuários"
- Preview do card de notificação como o usuário verá
- Campo "Agendamento" (opcional): enviar em data/hora futura

---

### 18.9 Top Ganhadores da Semana (Anti-anomalia)

**Seção:** Dashboard | **Role:** Operador+

Widget que lista os 10 maiores ganhadores em $CC na semana (por prêmios de torneio + duelos):

| # | Jogador | Ganhos $CC | Partidas jogadas | Win rate | Risco |
|---|---------|-----------|-----------------|----------|-------|
| 1 | player99 | $CC 450 | 48 | 94% | 🔴 HIGH |
| 2 | xadrezMaster | $CC 320 | 31 | 61% | 🟢 LOW |

- Clique no jogador abre o perfil com log de atividade
- Badge de risco calculado automaticamente pelo DeepSeek
- Jogadores com risco HIGH são destacados em vermelho — chamar atenção proativa

---

### 18.10 Status de Conexão Asaas

**Seção:** Manutenção | **Role:** Operador+

Painel de diagnóstico sem expor credenciais:

- **Status:** ✅ Conectado (último teste: há 5 min) / ❌ Erro: 401 Unauthorized
- **Ambiente:** 🟡 Sandbox / 🟢 Produção
- **Último webhook recebido:** 25/06/2026 21:43:12 (tipo: PAYMENT_RECEIVED)
- **Total webhooks hoje:** 47
- **Falhas de webhook hoje:** 0
- Botão **"Testar conexão agora"** → chama `GET /customers?limit=1` e exibe latência

**Por que isso importa:** problemas com o Asaas (chave expirada, mudança de API) causam falha silenciosa nos depósitos. Esse widget torna o problema visível antes do usuário reclamar.

---

### 18.11 Ajuste Manual de ELO com Audit

**Seção:** Usuários | **Role:** Admin

Casos de uso legítimos: partida cancelada por bug, erro no cálculo, compensação por incident.

**Modal de ajuste:**
- ELO atual: 1350
- Novo ELO: [campo numérico]
- Motivo (obrigatório, mín 30 caracteres): "Partida #match_abc foi cancelada por bug do servidor na rodada 3 do torneio FAISCA-2026-06-20. ELO restaurado ao valor anterior."
- Referência: ID da partida ou torneio (opcional)

**Efeitos:**
- Atualiza `users.rating`
- Cria registro em `user_activity_logs` com action `ELO_ADJUSTED_BY_ADMIN`
- Cria registro em `audit_logs` com before/after
- Notificação para o usuário: "Seu ELO foi ajustado de 1350 para 1366 por: [motivo]"

---

### 18.12 Forçar Logout de Usuário

**Seção:** Usuários | **Role:** Operador+

Casos de uso: conta comprometida relatada pelo próprio usuário, suspeita de acesso não autorizado, antes de um banimento.

**Implementação:**
- Invalida todos os `refresh_tokens` do usuário no banco
- Emite evento WebSocket `force_logout` para todos os sockets do usuário
- O frontend ao receber `force_logout` redireciona para `/` e limpa localStorage
- Registra em `audit_logs` e `user_activity_logs`

---

### 18.13 Templates de Torneio

**Seção:** Campeonatos | **Role:** Operador+

Evita preencher o mesmo formulário repetidamente:

**Template salvo:**
```
Nome: "FAISCA Padrão"
Tipo: FAISCA
Taxa de entrada: $CC 5 (usa platform_config atual)
Máx. jogadores: 16
Formato: Eliminação simples
Rounds: 4
Tempo por jogada: padrão
```

Ao criar novo torneio: "Usar template" → preenche automaticamente, admin só define data/hora. Templates são globais (qualquer Operador ou Admin pode usar os templates criados).

---

### 18.14 Alertas Automáticos no Dashboard (detalhado)

**Seção:** Dashboard | **Role:** Suporte (alertas de suporte), Financeiro (financeiros), Operador+ (todos)

Sistema de alertas baseado em regras avaliadas a cada 5 minutos:

| Alerta | Condição | Severidade | Role que vê |
|--------|----------|-----------|-------------|
| Saques bloqueados aguardando | `COUNT(withdrawals WHERE status=BLOCKED) > 0` | 🔴 | Financeiro+ |
| SLA de ticket vencido | Ticket sem resposta além do SLA | 🔴 | Suporte+ |
| Memória alta | Heap > 80% | 🟡 | Operador+ |
| Erros recentes | > 10 errors em 15 min | 🟡 | Operador+ |
| Modo manutenção ativo | `platform_config.maintenance_mode = true` | 🔴 | Todos |
| Asaas sem webhook há 1h | Último webhook > 60 min atrás | 🟡 | Operador+ |
| Torneio aberto sem inscrições | Torneio REGISTERING há > 2h com 0 inscritos | 🟢 | Operador+ |
| Volume de partidas muito baixo | < 10% da média semanal para o mesmo horário | 🟡 | Operador+ |

Alertas podem ser **silenciados** por 1h ou 24h (com registro de quem silenciou).

---

### 18.15 Gráfico de Rake por Período

**Seção:** Transações | **Role:** Financeiro+

Receita da plataforma visualizada como série temporal:

- Seletor de período: hoje / 7 dias / 30 dias / personalizado
- Gráfico de linha: rake diário em $CC
- Breakdown por fonte: rake de duelos / rake de torneios / taxa de saque
- Card de total do período + variação vs período anterior (ex: +12% vs semana passada)
- Meta configurável (ex: "Meta mensal: $CC 10.000") com progresso visual

---

### 18.16 MFA Obrigatório (TOTP)

**Seção:** Auth admin | **Role:** — (automático por role)

- **Suporte e Financeiro:** MFA recomendado, não obrigatório
- **Operador e Admin:** MFA obrigatório — sem MFA configurado, o login redireciona para `/admin/mfa/setup` e bloqueia todas as outras rotas

**Fluxo de setup:**
1. Admin loga com email + senha → recebe token temporário (válido por 10 min)
2. Token temporário só dá acesso a `POST /admin/auth/mfa/setup` e `POST /admin/auth/mfa/confirm`
3. Endpoint retorna QR Code (base64) para escanear no Google Authenticator / Authy
4. Admin digita o código TOTP → ativa o MFA → recebe token de sessão completo

**Fluxo de login com MFA ativo:**
1. `POST /admin/auth/login` → `{ requires_mfa: true, mfa_token: "..." }`
2. `POST /admin/auth/mfa/verify` com `{ mfa_token, totp_code }` → token de sessão completo

**Recuperação de MFA:** somente outro Admin pode resetar o MFA de um colega (registro em audit_log).
