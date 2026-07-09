# Asaas Sandbox Auto-Approve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In sandbox (`ASAAS_ENV !== 'production'`), automatically mark a freshly-created PIX deposit as paid 10 seconds after creation, so test users can get $CC without a real payment.

**Architecture:** `AsaasService.createPixPayment` schedules a `setTimeout` that calls the Asaas API `POST /payments/{id}/receiveInCash`. Asaas processes this like a real payment confirmation and fires its own `PAYMENT_RECEIVED` webhook back to our existing `/webhooks/asaas` endpoint, which already credits the wallet and notifies the client over the socket. No other module is touched.

**Tech Stack:** NestJS, Jest (with fake timers for the delayed call), native `fetch` (already used by `AsaasService`).

## Global Constraints

- Auto-approve must never run when `ASAAS_ENV === 'production'` — spec: [2026-07-09-asaas-sandbox-auto-approve-design.md](../specs/2026-07-09-asaas-sandbox-auto-approve-design.md)
- Delay is exactly 10 seconds (`SANDBOX_AUTO_APPROVE_DELAY_MS = 10_000`) — spec
- Failures calling Asaas must be logged and swallowed, never thrown or surfaced to the deposit-creation request — spec
- No changes to `WalletService`, `WalletModule`, or `GameModule` — spec
- Reuse the existing `PAYMENT_RECEIVED` webhook path for crediting — do not credit the wallet directly from `AsaasService` — spec

---

## File Structure

- `apps/api/src/asaas/consts/asaas.consts.ts` — add the `receiveInCash` path and the delay constant.
- `apps/api/src/asaas/asaas.service.ts` — add `isSandbox` flag, `scheduleAutoApprove`/`autoApprove` methods, and the call site inside `createPixPayment`.
- `apps/api/src/asaas/asaas.service.spec.ts` — new tests for the auto-approve scheduling, and a small fix to an existing test to avoid a leaked real timer.
- `apps/docs/ASAAS_INTEGRATION.md` — document the sandbox behavior next to the existing deposit/webhook sections.

---

### Task 1: Schedule sandbox auto-approve in `AsaasService`

**Files:**
- Modify: `apps/api/src/asaas/consts/asaas.consts.ts`
- Modify: `apps/api/src/asaas/asaas.service.ts:1-45` (imports, class fields, constructor) and `apps/api/src/asaas/asaas.service.ts:130-158` (`createPixPayment`)
- Test: `apps/api/src/asaas/asaas.service.spec.ts`

**Interfaces:**
- Consumes: existing `AsaasService.request<T>(method, path, body?)` (private, already implemented — retries on 429/5xx, throws `InternalServerErrorException` on non-retryable failure).
- Produces: `AsaasService.createPixPayment(userId, valueBrl, depositId, cpfOverride?)` keeps its exact existing signature and return shape (`{ paymentId, qrCode, copyPaste, expiresAt }`) — callers (`WalletService.createDeposit`) are unchanged.

- [ ] **Step 1: Write the failing tests**

Open `apps/api/src/asaas/asaas.service.spec.ts`. First, fix the existing `createPixPayment` test so it uses fake timers (the implementation will start a real `setTimeout` otherwise, which would leak a timer past the end of this test):

Replace:
```ts
  describe('createPixPayment', () => {
    it('creates the payment then fetches its PIX QR code', async () => {
      repo.findById.mockResolvedValue({ id: 'u1', cpf: '11111111111', asaasCustomerId: 'cus_1' } as any);
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ id: 'pay_1', status: 'PENDING' }))
        .mockResolvedValueOnce(jsonResponse({ encodedImage: 'img', payload: 'copy-paste', expirationDate: '2026-01-01' }));

      const result = await service.createPixPayment('u1', 100, 'deposit-1');

      expect(result).toEqual({
        paymentId: 'pay_1',
        qrCode: 'img',
        copyPaste: 'copy-paste',
        expiresAt: '2026-01-01',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
```

With:
```ts
  describe('createPixPayment', () => {
    it('creates the payment then fetches its PIX QR code', async () => {
      jest.useFakeTimers();
      repo.findById.mockResolvedValue({ id: 'u1', cpf: '11111111111', asaasCustomerId: 'cus_1' } as any);
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ id: 'pay_1', status: 'PENDING' }))
        .mockResolvedValueOnce(jsonResponse({ encodedImage: 'img', payload: 'copy-paste', expirationDate: '2026-01-01' }));

      const result = await service.createPixPayment('u1', 100, 'deposit-1');

      expect(result).toEqual({
        paymentId: 'pay_1',
        qrCode: 'img',
        copyPaste: 'copy-paste',
        expiresAt: '2026-01-01',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('createPixPayment — sandbox auto-approve', () => {
    it('schedules a receiveInCash call 10s after creating the payment while in sandbox', async () => {
      jest.useFakeTimers();
      repo.findById.mockResolvedValue({ id: 'u1', cpf: '11111111111', asaasCustomerId: 'cus_1' } as any);
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ id: 'pay_1', status: 'PENDING' }))
        .mockResolvedValueOnce(jsonResponse({ encodedImage: 'img', payload: 'copy-paste', expirationDate: '2026-01-01' }))
        .mockResolvedValueOnce(jsonResponse({ id: 'pay_1', status: 'CONFIRMED' }));

      await service.createPixPayment('u1', 100, 'deposit-1');
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(SANDBOX_AUTO_APPROVE_DELAY_MS);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [url, options] = fetchMock.mock.calls[2];
      expect(url).toContain('/payments/pay_1/receiveInCash');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        paymentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        value: 100,
        notifyCustomer: false,
      });
    });

    it('does not schedule any auto-approve call when ASAAS_ENV is production', async () => {
      const prodModule = await Test.createTestingModule({
        providers: [
          AsaasService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn((key: string) => (key === 'ASAAS_ENV' ? 'production' : 'test-api-key')) },
          },
          {
            provide: AsaasRepository,
            useValue: {
              findById: jest.fn().mockResolvedValue({ id: 'u1', cpf: '11111111111', asaasCustomerId: 'cus_1' }),
              updateAsaasCustomerId: jest.fn(),
            },
          },
        ],
      }).compile();
      const prodService = prodModule.get(AsaasService);

      jest.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ id: 'pay_1', status: 'PENDING' }))
        .mockResolvedValueOnce(jsonResponse({ encodedImage: 'img', payload: 'copy-paste', expirationDate: '2026-01-01' }));

      await prodService.createPixPayment('u1', 100, 'deposit-1');
      await jest.advanceTimersByTimeAsync(SANDBOX_AUTO_APPROVE_DELAY_MS);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('logs a warning and does not throw when the receiveInCash call fails', async () => {
      jest.useFakeTimers();
      repo.findById.mockResolvedValue({ id: 'u1', cpf: '11111111111', asaasCustomerId: 'cus_1' } as any);
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ id: 'pay_1', status: 'PENDING' }))
        .mockResolvedValueOnce(jsonResponse({ encodedImage: 'img', payload: 'copy-paste', expirationDate: '2026-01-01' }))
        .mockResolvedValue(jsonResponse({ message: 'already paid' }, 400));

      await service.createPixPayment('u1', 100, 'deposit-1');

      await expect(jest.advanceTimersByTimeAsync(SANDBOX_AUTO_APPROVE_DELAY_MS)).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });
```

Add the new import at the top of the file, alongside the existing ones:
```ts
import { SANDBOX_AUTO_APPROVE_DELAY_MS } from './consts/asaas.consts';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && npx jest src/asaas/asaas.service.spec.ts`
Expected: FAIL — `SANDBOX_AUTO_APPROVE_DELAY_MS` is not exported yet, and the new tests get only 2 fetch calls instead of 3 (no auto-approve scheduled).

- [ ] **Step 3: Add the new constants**

In `apps/api/src/asaas/consts/asaas.consts.ts`, replace:
```ts
export const ASAAS_PATHS = {
  CUSTOMERS: '/customers',
  CUSTOMER_BY_ID: (id: string) => `/customers/${id}`,
  PAYMENTS: '/payments',
  PAYMENT_BY_ID: (id: string) => `/payments/${id}`,
  PAYMENT_PIX_QR_CODE: (id: string) => `/payments/${id}/pixQrCode`,
  TRANSFERS: '/transfers',
} as const;

export const DEPOSIT_DESCRIPTION = 'Depósito Mega Chess Online';
export const WITHDRAWAL_DESCRIPTION = 'Saque Mega Chess Online';
```

With:
```ts
export const ASAAS_PATHS = {
  CUSTOMERS: '/customers',
  CUSTOMER_BY_ID: (id: string) => `/customers/${id}`,
  PAYMENTS: '/payments',
  PAYMENT_BY_ID: (id: string) => `/payments/${id}`,
  PAYMENT_PIX_QR_CODE: (id: string) => `/payments/${id}/pixQrCode`,
  PAYMENT_RECEIVE_IN_CASH: (id: string) => `/payments/${id}/receiveInCash`,
  TRANSFERS: '/transfers',
} as const;

export const DEPOSIT_DESCRIPTION = 'Depósito Mega Chess Online';
export const WITHDRAWAL_DESCRIPTION = 'Saque Mega Chess Online';

// Sandbox-only: seconds after creating a PIX charge before it's auto-marked as paid,
// so test users can try duels without a real payment. Never runs when ASAAS_ENV=production.
export const SANDBOX_AUTO_APPROVE_DELAY_MS = 10_000;
```

- [ ] **Step 4: Implement the sandbox flag and auto-approve scheduling**

In `apps/api/src/asaas/asaas.service.ts`, update the import block:
```ts
import {
  ASAAS_BASE_URL_PRODUCTION,
  ASAAS_BASE_URL_SANDBOX,
  ASAAS_MAX_RETRIES,
  ASAAS_RETRY_BACKOFF_BASE_MS,
  ASAAS_PATHS,
  DEPOSIT_DESCRIPTION,
  WITHDRAWAL_DESCRIPTION,
  SANDBOX_AUTO_APPROVE_DELAY_MS,
} from './consts/asaas.consts';
```

Update the class fields and constructor:
```ts
@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly isSandbox: boolean;

  constructor(
    config: ConfigService,
    private readonly users: AsaasRepository,
  ) {
    const env = config.get('ASAAS_ENV') ?? 'sandbox';
    this.isSandbox = env !== 'production';
    this.baseUrl = env === 'production'
      ? ASAAS_BASE_URL_PRODUCTION
      : ASAAS_BASE_URL_SANDBOX;
    this.apiKey = config.get('ASAAS_API_KEY') ?? '';
  }
```

Update `createPixPayment` to schedule the auto-approve, and add the two new private methods right after it:
```ts
  async createPixPayment(
    userId: string,
    valueBrl: number,
    depositId: string,
    cpfOverride?: string,
  ): Promise<{ paymentId: string; qrCode: string; copyPaste: string; expiresAt: string }> {
    const customerId = await this.ensureCustomer(userId, cpfOverride);

    // Expire in 3 hours — Asaas only accepts date, so use today; QR expiry from response
    const payment = await this.request<AsaasPaymentResponse>('POST', ASAAS_PATHS.PAYMENTS, {
      customer: customerId,
      billingType: 'PIX',
      value: valueBrl,
      dueDate: new Date().toISOString().split('T')[0],
      description: DEPOSIT_DESCRIPTION,
      externalReference: depositId,
    });

    const qrData = await this.request<AsaasQrCodeResponse>(
      'GET', ASAAS_PATHS.PAYMENT_PIX_QR_CODE(payment.id),
    );

    if (this.isSandbox) {
      this.scheduleAutoApprove(payment.id, valueBrl);
    }

    return {
      paymentId: payment.id,
      qrCode: qrData.encodedImage,
      copyPaste: qrData.payload,
      expiresAt: qrData.expirationDate,
    };
  }

  // ─── Sandbox testing ──────────────────────────────────────────────────────

  private scheduleAutoApprove(paymentId: string, valueBrl: number): void {
    this.logger.log(`[SANDBOX AUTO-APPROVE] scheduled paymentId=${paymentId} in ${SANDBOX_AUTO_APPROVE_DELAY_MS}ms`);
    const timer = setTimeout(() => {
      this.autoApprove(paymentId, valueBrl).catch((err) => {
        this.logger.warn(`[SANDBOX AUTO-APPROVE] failed paymentId=${paymentId}`, err instanceof Error ? err.stack : String(err));
      });
    }, SANDBOX_AUTO_APPROVE_DELAY_MS);
    timer.unref?.();
  }

  private async autoApprove(paymentId: string, valueBrl: number): Promise<void> {
    await this.request('POST', ASAAS_PATHS.PAYMENT_RECEIVE_IN_CASH(paymentId), {
      paymentDate: new Date().toISOString().split('T')[0],
      value: valueBrl,
      notifyCustomer: false,
    });
    this.logger.log(`[SANDBOX AUTO-APPROVE] triggered paymentId=${paymentId}`);
  }
```

Leave `cancelPayment` and everything below it untouched.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/api && npx jest src/asaas/asaas.service.spec.ts`
Expected: PASS — all tests in the file, including the 3 new ones.

- [ ] **Step 6: Run the full API test suite to check for regressions**

Run: `cd apps/api && npx jest`
Expected: PASS — no other suite references `AsaasService` internals directly, so nothing else should break.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/asaas/consts/asaas.consts.ts apps/api/src/asaas/asaas.service.ts apps/api/src/asaas/asaas.service.spec.ts
git commit -m "$(cat <<'EOF'
Auto-approve PIX deposits 10s after creation in Asaas sandbox

Lets test users get $CC credited without a real payment, so they can
try duels in homologação. Uses Asaas's own receiveInCash endpoint,
which triggers the real PAYMENT_RECEIVED webhook and reuses the
existing, already-tested confirmation flow. Never runs when
ASAAS_ENV=production.
EOF
)"
```

---

### Task 2: Document the sandbox auto-approve behavior

**Files:**
- Modify: `apps/docs/ASAAS_INTEGRATION.md:230-234` (end of section 4, right before section 5)

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing (documentation only).

- [ ] **Step 1: Add a subsection documenting the behavior**

In `apps/docs/ASAAS_INTEGRATION.md`, find this exact text (the end of section 4, right before section 5's heading):
```
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
```

Replace it with (adds a new subsection, keeps everything else identical):
```
### O que salvar no banco antes de retornar ao frontend

```sql
INSERT INTO deposits (
  id, user_id, asaas_payment_id, value_brl, status, created_at
) VALUES (
  'deposit_uuid', 'user_uuid', 'pay_123456789', 50.00, 'PENDING', NOW()
);
```

### Auto-aprovação em sandbox (testes)

Quando `ASAAS_ENV` **não** é `production`, 10 segundos após criar a cobrança
PIX o backend chama `POST /payments/{id}/receiveInCash` na própria Asaas
(`AsaasService.scheduleAutoApprove` / `autoApprove`, em
`apps/api/src/asaas/asaas.service.ts`). A Asaas processa isso como um
pagamento confirmado de verdade e dispara o webhook real `PAYMENT_RECEIVED`
de volta para `/webhooks/asaas` — ou seja, o depósito é creditado pelo mesmo
caminho de código de produção, sem nenhum atalho especial no lado da wallet.

Isso permite que qualquer pessoa testando em homologação
(`homologa.megachess.io`, onde `ASAAS_ENV` já é `sandbox` por padrão) gere um
PIX e, sem precisar pagar nada, tenha o saldo em $CC creditado 10 segundos
depois — o suficiente para testar duelos e torneios.

Falhas nessa chamada (rede, pagamento já cancelado, etc.) são apenas
logadas — nunca lançam exceção nem afetam a criação do depósito.

Em produção (`ASAAS_ENV=production`) esse agendamento nunca acontece.

---

## 5. Webhooks de Confirmação
```

- [ ] **Step 2: Commit**

```bash
git add apps/docs/ASAAS_INTEGRATION.md
git commit -m "$(cat <<'EOF'
Document the Asaas sandbox auto-approve behavior

Explains where the 10s auto-approve lives and why it's safe (reuses
the real webhook path, never runs in production) for anyone reading
the deposit flow docs later.
EOF
)"
```
