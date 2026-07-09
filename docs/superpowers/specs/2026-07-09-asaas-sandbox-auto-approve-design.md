# Auto-aprovação de depósitos PIX em sandbox (Asaas)

## Contexto

Usuários que querem testar duelos (que exigem saldo em $CC) precisam hoje pagar
um PIX real ou simular manualmente a confirmação pelo painel da Asaas. Isso
atrapalha testes em homologação (`homologa.megachess.io`), onde `ASAAS_ENV`
já é `sandbox` por padrão (`docker-compose.prod.yml`).

## Objetivo

Quando o ambiente Asaas configurado for `sandbox` (`ASAAS_ENV !== 'production'`),
10 segundos após a criação de uma cobrança PIX, o pagamento deve ser
automaticamente marcado como recebido — permitindo que o usuário de teste
tenha saldo em $CC para entrar em duelos sem precisar de um PIX real.

Em produção (`ASAAS_ENV=production`) esse comportamento nunca é ativado.

## Mecanismo

Reaproveitar o endpoint oficial da Asaas `POST /payments/{id}/receiveInCash`,
que marca uma cobrança como paga manualmente. Isso funciona em sandbox e
dispara o webhook real `PAYMENT_RECEIVED` da Asaas de volta para
`/webhooks/asaas` — reaproveitando 100% do fluxo já existente e testado
(`WebhooksController.handleAsaas` → `WalletService.confirmDeposit` → crédito
de saldo + emissão do evento de socket `deposit_confirmed`).

Não há necessidade de alterar `WalletService`, `WalletModule` ou `GameModule`.
Toda a mudança fica isolada em `AsaasService`.

### Fluxo

```
createDeposit (WalletService)
        │
        ▼
AsaasService.createPixPayment
        │
        ├─ cria cobrança PIX (já existente)
        │
        └─ se sandbox: agenda setTimeout(10s)
                    │
                    ▼
              POST /payments/{id}/receiveInCash (Asaas)
                    │
                    ▼
              Asaas dispara webhook PAYMENT_RECEIVED
                    │
                    ▼
              WebhooksController.handleAsaas (já existente)
                    │
                    ▼
              WalletService.confirmDeposit + gateway.emitToUser
```

## Mudanças

### `apps/api/src/asaas/consts/asaas.consts.ts`
- Adicionar `PAYMENT_RECEIVE_IN_CASH: (id: string) => \`/payments/${id}/receiveInCash\`` em `ASAAS_PATHS`.
- Adicionar `SANDBOX_AUTO_APPROVE_DELAY_MS = 10_000`.

### `apps/api/src/asaas/asaas.service.ts`
- Armazenar `isSandbox: boolean` no construtor (`env !== 'production'`), ao lado de `baseUrl`.
- Em `createPixPayment`, após criar a cobrança e o QR Code com sucesso: se `isSandbox`, agendar
  `setTimeout` que chama um novo método privado `autoApprove(paymentId, valueBrl)`.
- `autoApprove` chama `POST /payments/{id}/receiveInCash` com
  `{ paymentDate: <hoje, YYYY-MM-DD>, value: valueBrl, notifyCustomer: false }`.
- Falhas na chamada (rede, 4xx/5xx, pagamento já cancelado) são apenas logadas
  (`logger.warn`) — best-effort, não deve lançar exceção nem afetar o fluxo de
  criação do depósito (o `setTimeout` roda de forma desacoplada do request original).
- Logar quando o auto-approve for agendado e quando for disparado, prefixado
  para deixar claro que é comportamento de teste (ex: `[SANDBOX AUTO-APPROVE]`).

## Casos de borda

- **Cancelamento antes dos 10s**: `cancelDeposit` já chama `asaas.cancelPayment`
  (DELETE). Se o `receiveInCash` disparar depois, a Asaas deve rejeitar (pagamento
  já cancelado/inexistente) — erro capturado e logado, sem efeito.
- **Reenvio de webhook / dupla confirmação**: já protegido pela idempotência
  existente (`asaas_events` com PK único por evento, e `confirmDeposit` só
  credita depósitos com `status === PENDING`).
- **Restart do processo antes dos 10s**: o `setTimeout` é perdido (mesma
  limitação já aceita e documentada no delay de saque de 25 min em
  `wallet.service.ts`). Aceitável — é um recurso de teste, não crítico.
- **`ASAAS_API_KEY` inválida ou não configurada em sandbox**: a chamada
  `receiveInCash` falha com 401 e é apenas logada; o depósito permanece
  `PENDING` até expirar normalmente.

## Fora de escopo

- Nenhuma mudança no fluxo de produção.
- Nenhuma configuração dinâmica via painel admin (`platform-config`) — o
  comportamento é inteiramente determinado por `ASAAS_ENV`, uma variável de
  ambiente fixa por deploy.
- Nenhuma alteração no frontend — o toast e o fechamento do QR Code já
  funcionam via o listener existente de `deposit_confirmed`.
