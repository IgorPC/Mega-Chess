# Mega Chess Online — Integração Asaas (PIX)

Documento técnico completo de integração com a API Asaas v3 para operações financeiras da plataforma.

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Configuração Inicial](#2-configuração-inicial)
3. [Cadastro de Clientes](#3-cadastro-de-clientes)
4. [Depósito — PIX para $CC](#4-depósito--pix-para-cc)
5. [Webhooks de Confirmação](#5-webhooks-de-confirmação)
6. [Carteira Virtual Interna ($CC)](#6-carteira-virtual-interna-cc)
7. [Inscrição em Torneios](#7-inscrição-em-torneios)
8. [Distribuição de Prêmios e Rake](#8-distribuição-de-prêmios-e-rake)
9. [Saque — $CC para PIX](#9-saque--cc-para-pix)
10. [Anti-Cheat com Delay de Saque](#10-anti-cheat-com-delay-de-saque)
11. [Reembolso](#11-reembolso)
12. [Fluxo Completo de Dados](#12-fluxo-completo-de-dados)
13. [Variáveis de Ambiente](#13-variáveis-de-ambiente)
14. [Erros e Tratamento](#14-erros-e-tratamento)

---

## 1. Visão Geral da Arquitetura

O Asaas é responsável exclusivamente pelo dinheiro real (BRL). A moeda virtual $CC existe apenas dentro do banco de dados da plataforma. A conversão entre BRL e $CC acontece em dois momentos:

```
BRL (mundo real)          $CC (mundo virtual)
─────────────────         ────────────────────────────────────
PIX recebido  ──────────► credita $CC na wallet do usuário
                          (1 BRL = 1 $CC)

saque solicitado ◄──────── debita $CC da wallet do usuário
PIX enviado                (1 $CC = 1 BRL - taxa de saque)
```

**O Asaas nunca sabe da existência de $CC.** Ele apenas recebe e envia BRL. A lógica de torneios, rake e distribuição de prêmios vive inteiramente no backend NestJS.

### Ambientes

| Ambiente | Base URL |
|---|---|
| Sandbox (testes) | `https://api-sandbox.asaas.com/v3` |
| Produção | `https://api.asaas.com/v3` |

---

## 2. Configuração Inicial

### Instalação

```bash
npm install axios
```

### Cliente HTTP (apps/api/src/asaas/asaas.client.ts)

```typescript
import axios from 'axios';

export const asaasClient = axios.create({
  baseURL: process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3',
  headers: {
    'access_token': process.env.ASAAS_API_KEY,
    'Content-Type': 'application/json',
  },
});
```

A autenticação é feita via header `access_token` em **todas** as requisições. Nunca exponha essa chave no frontend.

---

## 3. Cadastro de Clientes

Todo usuário que quiser fazer depósito ou saque precisa ter um registro no Asaas. Esse registro é feito uma única vez e o ID retornado (`asaasCustomerId`) fica salvo no banco de dados do usuário.

### Quando criar

No momento em que o usuário tentar fazer o primeiro depósito ou cadastrar uma chave PIX para saque — não no registro da conta.

### Endpoint

```
POST /customers
```

### Request Body

```json
{
  "name": "Igor Coutinho",
  "cpfCnpj": "123.456.789-00",
  "email": "usuario@email.com",
  "mobilePhone": "11999999999",
  "externalReference": "user_uuid_do_seu_banco"
}
```

| Campo | Obrigatório | Descrição |
|---|---|---|
| `name` | Sim | Nome completo do usuário |
| `cpfCnpj` | Sim | CPF ou CNPJ (apenas números) |
| `email` | Não | Usado para notificações do Asaas |
| `mobilePhone` | Não | Telefone sem formatação |
| `externalReference` | Não* | **Use sempre.** ID do usuário no seu banco. Permite resgatar o cliente Asaas sem guardar o ID deles |

### Response

```json
{
  "id": "cus_000012345678",
  "name": "Igor Coutinho",
  "cpfCnpj": "12345678900",
  "externalReference": "550e8400-e29b-41d4-a716-446655440000"
}
```

### O que salvar no banco

```sql
UPDATE users SET asaas_customer_id = 'cus_000012345678' WHERE id = 'uuid-do-usuario';
```

> **Atenção:** O Asaas permite criar clientes duplicados com o mesmo CPF. Implemente uma verificação antes de chamar `POST /customers` para evitar duplicatas. Use `externalReference` para buscar o cliente existente se necessário.

---

## 4. Depósito — PIX para $CC

O usuário informa o valor que quer depositar. O backend cria uma cobrança PIX no Asaas e retorna o QR Code para o usuário escanear.

### Fluxo

```
Usuário digita R$ 50
        │
        ▼
Backend: POST /payments (billingType: PIX, value: 50)
        │
        ▼
Asaas retorna paymentId + encodedImage (QR Code)
        │
        ▼
Frontend exibe QR Code ao usuário
        │
        ▼
Usuário paga no banco
        │
        ▼
Asaas envia webhook PAYMENT_RECEIVED para o backend
        │
        ▼
Backend credita 50 $CC na wallet do usuário
```

### Passo 1 — Criar cobrança PIX

```
POST /payments
```

```json
{
  "customer": "cus_000012345678",
  "billingType": "PIX",
  "value": 50.00,
  "dueDate": "2026-06-21",
  "description": "Depósito Mega Chess Online",
  "externalReference": "deposit_uuid_gerado_por_voce"
}
```

| Campo | Valor | Descrição |
|---|---|---|
| `customer` | `asaasCustomerId` do usuário | ID Asaas salvo no banco |
| `billingType` | `"PIX"` | Tipo de cobrança |
| `value` | valor digitado pelo usuário | Em reais (BRL) |
| `dueDate` | hoje + 1 dia | Prazo para pagamento. PIX expira rápido, use `+1` |
| `externalReference` | UUID gerado pelo seu backend | Para rastrear o depósito no seu banco |

### Response da cobrança

```json
{
  "id": "pay_123456789",
  "status": "PENDING",
  "value": 50.00,
  "billingType": "PIX",
  "externalReference": "deposit_uuid_gerado_por_voce"
}
```

### Passo 2 — Buscar o QR Code

Após criar a cobrança, faça uma segunda chamada para obter o QR Code:

```
GET /payments/{pay_123456789}/pixQrCode
```

### Response do QR Code

```json
{
  "encodedImage": "iVBORw0KGgoAAAANS...",
  "payload": "00020126580014br.gov.bcb.pix...",
  "expirationDate": "2026-06-22T10:00:00"
}
```

| Campo | Uso no Frontend |
|---|---|
| `encodedImage` | Base64 do PNG do QR Code — exibir com `<img src="data:image/png;base64,{encodedImage}" />` |
| `payload` | Código "copia e cola" do PIX |
| `expirationDate` | Exibir countdown para o usuário |

### O que salvar no banco antes de retornar ao frontend

```sql
INSERT INTO deposits (
  id, user_id, asaas_payment_id, value_brl, status, created_at
) VALUES (
  'deposit_uuid', 'user_uuid', 'pay_123456789', 50.00, 'PENDING', NOW()
);
```

---

## 5. Webhooks de Confirmação

O Asaas não aguarda você perguntar se o PIX foi pago — ele te avisa automaticamente via HTTP POST quando algo acontece.

### Configuração

Registre o webhook uma vez via API ou pelo painel do Asaas:

```
POST /webhooks
```

```json
{
  "url": "https://megachessonline.pcout.cloud/api/v1/webhooks/asaas",
  "email": "dev@seusite.com",
  "enabled": true,
  "interrupted": false,
  "authToken": "token_secreto_que_voce_define",
  "events": [
    "PAYMENT_RECEIVED",
    "PAYMENT_CONFIRMED",
    "TRANSFER_DONE",
    "TRANSFER_FAILED"
  ]
}
```

### Eventos essenciais

| Evento | Quando dispara | Ação no backend |
|---|---|---|
| `PAYMENT_RECEIVED` | PIX confirmado pelo banco | Creditar $CC na wallet do usuário |
| `PAYMENT_CONFIRMED` | Pagamento processado pelo Asaas | Confirmação extra (boleto/cartão) |
| `TRANSFER_DONE` | Saque PIX enviado com sucesso | Marcar saque como concluído |
| `TRANSFER_FAILED` | Saque PIX falhou | Estornar $CC, notificar usuário |

### Payload recebido pelo seu endpoint

```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_123456789",
    "customer": "cus_000012345678",
    "value": 50.00,
    "netValue": 49.50,
    "status": "RECEIVED",
    "billingType": "PIX",
    "externalReference": "deposit_uuid_gerado_por_voce"
  }
}
```

> **`netValue`** é o valor após as taxas do Asaas. Para o crédito de $CC, use sempre o `value` original (o que o usuário informou que queria depositar), e não o `netValue` — caso contrário o usuário recebe menos do que digitou.

### Implementação do endpoint de webhook (NestJS)

```typescript
// POST /api/v1/webhooks/asaas
async handleAsaasWebhook(body: any, headers: any) {
  // 1. Validar token de autenticação
  if (headers['asaas-access-token'] !== process.env.ASAAS_WEBHOOK_TOKEN) {
    throw new UnauthorizedException();
  }

  // 2. Verificar idempotência (Asaas pode reenviar o mesmo evento)
  const alreadyProcessed = await this.eventRepository.exists(body.payment.id);
  if (alreadyProcessed) return { received: true };

  // 3. Processar o evento
  if (body.event === 'PAYMENT_RECEIVED') {
    const deposit = await this.depositRepository.findOne({
      asaasPaymentId: body.payment.id
    });
    await this.walletService.credit(deposit.userId, deposit.valueBrl);
    await this.depositRepository.update(deposit.id, { status: 'COMPLETED' });
  }

  if (body.event === 'TRANSFER_FAILED') {
    const withdrawal = await this.withdrawalRepository.findOne({
      asaasTransferId: body.transfer.id
    });
    // Estornar os $CC que foram debitados
    await this.walletService.credit(withdrawal.userId, withdrawal.valueCC);
    await this.withdrawalRepository.update(withdrawal.id, { status: 'FAILED' });
  }

  // 4. Salvar evento para idempotência
  await this.eventRepository.save({ asaasEventId: body.payment.id });

  return { received: true }; // Sempre responda 200 rapidamente
}
```

> **Regra crítica:** O endpoint de webhook deve responder `200 OK` em menos de 5 segundos. Se a lógica for pesada, use uma fila (BullMQ/Redis) — receba o webhook, enfileire o processamento, responda 200.

---

## 6. Carteira Virtual Interna ($CC)

Toda a lógica de $CC é interna ao banco de dados. O Asaas nunca vê $CC.

### Tabela sugerida

```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL, -- DEPOSIT, WITHDRAWAL, TOURNAMENT_ENTRY, PRIZE, RAKE
  amount DECIMAL(10,2) NOT NULL, -- positivo = crédito, negativo = débito
  reference_id VARCHAR(100), -- ID do torneio, saque, depósito relacionado
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Operações

| Operação | Tipo | Valor | Quando |
|---|---|---|---|
| PIX recebido | `DEPOSIT` | +50.00 | Webhook `PAYMENT_RECEIVED` |
| Inscrição no torneio | `TOURNAMENT_ENTRY` | -10.00 | Usuário confirma inscrição |
| Rake da plataforma | `RAKE` | -1.00 | Calculado na inscrição |
| Receber prêmio | `PRIZE` | +18.00 | Fim da partida |
| Solicitar saque | `WITHDRAWAL` | -20.00 | Usuário solicita saque |
| Taxa de saque | `WITHDRAWAL_FEE` | -2.00 | Calculada no saque |

---

## 7. Inscrição em Torneios

O custo de inscrição é debitado em $CC no momento em que o usuário confirma a entrada. **Nenhuma chamada ao Asaas é necessária nessa etapa** — é apenas uma operação no banco de dados.

### Fluxo de inscrição

```typescript
async joinTournament(userId: string, tournamentId: string) {
  const tournament = await this.tournamentRepository.findById(tournamentId);
  const wallet = await this.walletRepository.findByUserId(userId);

  // 1. Verificar saldo suficiente
  if (wallet.balance < tournament.entryFee) {
    throw new BadRequestException('Saldo insuficiente de $CC');
  }

  // 2. Debitar o valor de inscrição
  await this.walletService.debit(userId, tournament.entryFee, {
    type: 'TOURNAMENT_ENTRY',
    referenceId: tournamentId,
    description: `Inscrição: ${tournament.name}`,
  });

  // 3. Registrar participante
  await this.tournamentRepository.addParticipant(tournamentId, userId);
}
```

### Rake calculado no momento da inscrição

O rake não é debitado separadamente do usuário — ele já está embutido no valor da inscrição. A conta da plataforma fica com a diferença entre o total arrecadado e o pote de prêmios.

Exemplo — Duelo Relâmpago:
- 2 jogadores × 10 $CC = 20 $CC arrecadados
- 18 $CC vão para o pote de prêmios
- 2 $CC ficam na conta da plataforma (rake de 10%)

---

## 8. Distribuição de Prêmios e Rake

Ao fim de cada partida ou torneio, o backend distribui os $CC do pote para os vencedores. Novamente, **nenhuma chamada ao Asaas** — é operação interna.

### Duelo 1v1 — Resultado normal (vitória)

```typescript
async finalizeDuel(matchId: string) {
  const match = await this.matchRepository.findById(matchId);
  const pot = match.entryFee * 2; // 20 $CC
  const rake = pot * 0.10;        // 2 $CC (10%)
  const prize = pot - rake;       // 18 $CC

  // Creditar vencedor
  await this.walletService.credit(match.winnerId, prize, {
    type: 'PRIZE',
    referenceId: matchId,
    description: `Prêmio: Duelo Relâmpago #${matchId}`,
  });

  // Registrar rake no histórico (para auditoria)
  await this.platformWalletService.credit(rake, {
    referenceId: matchId,
    description: `Rake 10%: Duelo #${matchId}`,
  });
}
```

### Duelo 1v1 — Empate (Draw)

```typescript
async finalizeDrawDuel(matchId: string) {
  const match = await this.matchRepository.findById(matchId);
  const pot = match.entryFee * 2;  // 20 $CC
  const rake = pot * 0.10;         // 2 $CC
  const splitPrize = (pot - rake) / 2; // 9 $CC para cada

  await this.walletService.credit(match.whitePlayerId, splitPrize, { ... });
  await this.walletService.credit(match.blackPlayerId, splitPrize, { ... });
}
```

### Grande Torneio (64 jogadores)

```typescript
const PRIZE_DISTRIBUTION = {
  1: 490, // 1º lugar
  2: 245, // 2º lugar
  3: 81,  // 3º lugar
};

async finalizeTournament(tournamentId: string) {
  const tournament = await this.tournamentRepository.findById(tournamentId);
  // tournament.pot = 816 $CC (após rake de 15%)

  for (const [position, prize] of Object.entries(PRIZE_DISTRIBUTION)) {
    const winner = tournament.getPlayerByPosition(Number(position));
    await this.walletService.credit(winner.userId, prize, {
      type: 'PRIZE',
      referenceId: tournamentId,
      description: `${position}º lugar — Grande Torneio #${tournamentId}`,
    });
  }
}
```

---

## 9. Saque — $CC para PIX

O usuário solicita converter $CC em BRL via PIX. Aqui o Asaas entra novamente.

### Fluxo completo

```
Usuário solicita saque de 20 $CC
        │
        ▼
Backend valida: saldo >= 20 $CC + taxa de saque
        │
        ▼
Backend debita 20 $CC + 2 $CC (taxa) da wallet
        │
        ▼
Saque entra na fila de anti-cheat (delay 15-30 min)
        │
        ▼
Após delay: backend analisa PGN das partidas recentes
        │
        ├── Suspeito? → Bloquear saque, notificar admin
        │
        └── OK? → POST /transfers no Asaas (envia PIX)
                        │
                        ▼
                Asaas envia webhook TRANSFER_DONE
                        │
                        ▼
                Backend marca saque como COMPLETED
```

### Endpoint Asaas — Enviar PIX

```
POST /transfers
```

```json
{
  "value": 18.00,
  "operationType": "PIX",
  "pixAddressKey": "chave-pix-do-usuario@email.com",
  "pixAddressKeyType": "EMAIL",
  "description": "Saque Mega Chess Online"
}
```

| Campo | Valor | Descrição |
|---|---|---|
| `value` | valor em BRL a enviar | 20 $CC - 2 $CC taxa = 18 BRL |
| `operationType` | `"PIX"` | Tipo de transferência |
| `pixAddressKey` | chave PIX do usuário | Coletada no momento do saque |
| `pixAddressKeyType` | `"EMAIL"`, `"CPF"`, `"PHONE"`, `"EVP"` | Tipo da chave PIX |

### Tipos de chave PIX aceitos

| `pixAddressKeyType` | Formato da chave |
|---|---|
| `CPF` | `"12345678900"` |
| `EMAIL` | `"usuario@email.com"` |
| `PHONE` | `"+5511999999999"` |
| `EVP` | UUID aleatório (chave Pix aleatória) |

### Response

```json
{
  "id": "tra_000011111",
  "status": "PENDING",
  "value": 18.00,
  "operationType": "PIX"
}
```

Salve o `id` da transferência (`asaasTransferId`) para rastrear via webhook.

### Taxa de saque — regra de negócio

```typescript
function calcWithdrawalFee(amount: number): number {
  const fixedFee = 2; // $CC
  const percentFee = amount * 0.02; // 2%
  return Math.max(fixedFee, percentFee); // cobra o maior dos dois
}

// Exemplos:
// saque de 20 $CC → taxa = max(2, 0.40) = 2 $CC → recebe 18 BRL
// saque de 200 $CC → taxa = max(2, 4.00) = 4 $CC → recebe 196 BRL
```

---

## 10. Anti-Cheat com Delay de Saque

O objetivo é impedir que jogadores que usaram engine (Stockfish etc.) saquem o prêmio antes de serem detectados.

### Implementação com BullMQ (Redis)

```typescript
// Ao criar o saque, enfileirar com delay
await this.withdrawalQueue.add(
  'process-withdrawal',
  { withdrawalId, userId, asaasTransferId: null },
  { delay: 25 * 60 * 1000 } // 25 minutos em ms
);
```

### Worker de processamento

```typescript
@Processor('withdrawals')
export class WithdrawalProcessor {
  async process(job: Job) {
    const { withdrawalId, userId } = job.data;

    // 1. Buscar partidas recentes do usuário (últimas 24h)
    const recentMatches = await this.matchRepository.findRecentByUser(userId, '24h');

    // 2. Analisar cada PGN
    for (const match of recentMatches) {
      const suspicion = await this.antiCheatService.analyzePgn(match.pgn, {
        userRating: match.userRating,
      });

      if (suspicion.score > 0.95) { // 95% ou mais de lances "perfeitos"
        await this.withdrawalRepository.update(withdrawalId, {
          status: 'BLOCKED',
          reason: `Precisão suspeita: ${suspicion.score * 100}%`,
        });
        await this.notificationService.alertAdmin(userId, suspicion);
        return; // Não processa o saque
      }
    }

    // 3. Passou na verificação — enviar PIX via Asaas
    const withdrawal = await this.withdrawalRepository.findById(withdrawalId);
    const transfer = await this.asaasService.sendPix({
      value: withdrawal.valueBrl,
      pixAddressKey: withdrawal.pixKey,
      pixAddressKeyType: withdrawal.pixKeyType,
    });

    await this.withdrawalRepository.update(withdrawalId, {
      status: 'PROCESSING',
      asaasTransferId: transfer.id,
    });
  }
}
```

### Critérios de análise de PGN

| Critério | Threshold de Alerta |
|---|---|
| Precisão de lances (% de melhores lances) | ≥ 95% |
| Tempo de resposta médio por lance | < 2 segundos (suspeito de engine) |
| Discrepância entre Elo histórico e qualidade da partida | > 300 pontos de diferença |
| Mesmo padrão de lances em múltiplas partidas | Repetição idêntica de sequências |

---

## 11. Reembolso

Se um torneio for cancelado antes de iniciar (ex: não atingiu o número mínimo de participantes), o backend deve estornar os $CC de todos os inscritos.

```typescript
async cancelTournament(tournamentId: string, reason: string) {
  const participants = await this.tournamentRepository.getParticipants(tournamentId);

  for (const participant of participants) {
    await this.walletService.credit(participant.userId, participant.entryFee, {
      type: 'REFUND',
      referenceId: tournamentId,
      description: `Reembolso: Torneio #${tournamentId} cancelado — ${reason}`,
    });
  }

  await this.tournamentRepository.update(tournamentId, { status: 'CANCELLED' });
}
```

> Reembolso de $CC é sempre interno — não passa pelo Asaas. O Asaas só é acionado se o usuário quiser sacar os $CC reembolsados.

Se um saque já foi enviado via Asaas e o usuário quiser cancelar (possível apenas se `status: PENDING`):

```
DELETE /transfers/{tra_000011111}
```

---

## 12. Fluxo Completo de Dados

### Tabelas necessárias no banco

```sql
-- Clientes Asaas (vinculados a usuários)
ALTER TABLE users ADD COLUMN asaas_customer_id VARCHAR(50);
ALTER TABLE users ADD COLUMN pix_key VARCHAR(100);
ALTER TABLE users ADD COLUMN pix_key_type VARCHAR(10);

-- Carteiras virtuais
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Extrato de transações
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(30) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  reference_id VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Depósitos
CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  asaas_payment_id VARCHAR(50) UNIQUE,
  value_brl DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, EXPIRED
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Saques
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  asaas_transfer_id VARCHAR(50),
  value_cc DECIMAL(10,2) NOT NULL,   -- $CC debitados
  value_brl DECIMAL(10,2) NOT NULL,  -- BRL a enviar (após taxa)
  fee_cc DECIMAL(10,2) NOT NULL,     -- taxa cobrada
  pix_key VARCHAR(100) NOT NULL,
  pix_key_type VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  -- PENDING → ANALYZING → PROCESSING → COMPLETED | BLOCKED | FAILED
  block_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Eventos Asaas processados (idempotência)
CREATE TABLE asaas_events (
  asaas_event_id VARCHAR(100) PRIMARY KEY,
  event_type VARCHAR(50),
  processed_at TIMESTAMP DEFAULT NOW()
);
```

### Status de ciclo de vida

**Depósito:**
```
PENDING → COMPLETED (webhook PAYMENT_RECEIVED)
        → EXPIRED   (usuário não pagou no prazo)
```

**Saque:**
```
PENDING → ANALYZING (delay anti-cheat iniciado)
        → PROCESSING (PIX enviado para Asaas)
        → COMPLETED  (webhook TRANSFER_DONE)
        → BLOCKED    (suspeita de cheat)
        → FAILED     (webhook TRANSFER_FAILED → $CC estornados)
```

---

## 13. Variáveis de Ambiente

Adicionar ao `apps/api/.env`:

```env
# Asaas
ASAAS_API_KEY=sua_chave_api_aqui
ASAAS_ENV=sandbox          # ou production
ASAAS_WEBHOOK_TOKEN=token_secreto_para_validar_webhooks

# Redis (para fila de saques)
REDIS_URL=redis://redis:6379
```

Adicionar ao `.env.prod.example`:

```env
ASAAS_API_KEY=
ASAAS_ENV=production
ASAAS_WEBHOOK_TOKEN=
```

---

## 14. Erros e Tratamento

### Erros comuns da API Asaas

| HTTP Status | Causa provável | Ação |
|---|---|---|
| `400 Bad Request` | Campo obrigatório ausente ou formato inválido | Logar o body de resposta e corrigir |
| `401 Unauthorized` | `access_token` inválido ou ausente | Verificar variável de ambiente |
| `409 Conflict` | Tentativa de criar recurso duplicado | Verificar antes de criar |
| `422 Unprocessable` | Regra de negócio violada (ex: saldo insuficiente) | Tratar no frontend |
| `429 Too Many Requests` | Rate limit atingido | Implementar retry com exponential backoff |
| `500 Internal Server Error` | Problema no Asaas | Retry após alguns segundos |

### Retry com backoff (para saques críticos)

```typescript
async sendPixWithRetry(payload: TransferPayload, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await asaasClient.post('/transfers', payload);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      if (error.response?.status === 429 || error.response?.status >= 500) {
        await sleep(Math.pow(2, attempt) * 1000); // 2s, 4s, 8s
        continue;
      }
      throw error; // Erros 4xx não fazem retry
    }
  }
}
```

### Webhook com fila (para não perder eventos)

```typescript
// Controller — responde imediatamente
@Post('/webhooks/asaas')
async receiveWebhook(@Body() body: any, @Headers() headers: any) {
  await this.webhookQueue.add('asaas-event', { body, headers });
  return { received: true }; // 200 OK instantâneo
}

// Worker — processa de forma assíncrona
@Processor('webhooks')
async processWebhook(job: Job) {
  // lógica pesada aqui, sem risco de timeout
}
```
