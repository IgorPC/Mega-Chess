import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { getGameSocket } from '../lib/socket';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

type PixKeyType = 'CPF' | 'EMAIL' | 'PHONE' | 'EVP';
type TransactionType =
  | 'DEPOSIT' | 'WITHDRAWAL' | 'WITHDRAWAL_FEE'
  | 'TOURNAMENT_ENTRY' | 'ENTRY_RESERVE' | 'ENTRY_RELEASE'
  | 'PRIZE' | 'RAKE' | 'REFUND';
type DepositStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  balanceAfter: string;
  description?: string;
  createdAt: string;
}

interface DepositItem {
  id: string;
  valueBrl: string;
  status: DepositStatus;
  qrCode: string | null;
  copyPaste: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface DepositListData {
  items: DepositItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface TxData {
  items: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}

interface DepositResult {
  depositId: string;
  qrCode: string;
  copyPaste: string;
  expiresAt: string;
  valueBrl: number;
}

const DEPOSIT_STATUS_LABEL: Record<DepositStatus, string> = {
  PENDING: 'Aguardando pagamento',
  COMPLETED: 'Pago',
  EXPIRED: 'Expirado',
  CANCELLED: 'Cancelado',
};

const DEPOSIT_STATUS_COLOR: Record<DepositStatus, string> = {
  PENDING: '#E8A838',
  COMPLETED: '#4CAF50',
  EXPIRED: 'var(--color-text-muted)',
  CANCELLED: 'var(--color-danger)',
};

const TX_LABELS: Record<TransactionType, string> = {
  DEPOSIT: 'Depósito',
  WITHDRAWAL: 'Saque',
  WITHDRAWAL_FEE: 'Taxa de saque',
  TOURNAMENT_ENTRY: 'Entrada em torneio',
  ENTRY_RESERVE: 'Reserva (duelo)',
  ENTRY_RELEASE: 'Estorno (duelo)',
  PRIZE: 'Prêmio',
  RAKE: 'Taxa da plataforma',
  REFUND: 'Reembolso',
};

// CC transaction display helpers
const CC_TX_LABEL: Record<string, string> = {
  TOURNAMENT_ENTRY: 'Taxa de entrada — torneio',
  TOURNAMENT_CREATION_FEE: 'Taxa de criação — torneio',
  ENTRY_RESERVE: 'Reserva — duelo',
  ENTRY_RELEASE: 'Estorno — saiu da fila',
  PRIZE: 'Prêmio recebido',
  RAKE: 'Taxa da plataforma',
  REFUND: 'Reembolso',
  DEPOSIT: 'Depósito PIX convertido',
  WITHDRAWAL: 'Saque solicitado',
  WITHDRAWAL_FEE: 'Taxa de saque',
};
const CC_TX_ICON: Record<string, string> = {
  TOURNAMENT_ENTRY: '🏆',
  TOURNAMENT_CREATION_FEE: '🏗️',
  ENTRY_RESERVE: '⚔️',
  ENTRY_RELEASE: '↩️',
  PRIZE: '🎁',
  RAKE: '📊',
  REFUND: '↩️',
  DEPOSIT: '💰',
  WITHDRAWAL: '🏦',
  WITHDRAWAL_FEE: '📋',
};
const CC_TX_CREDIT = ['PRIZE', 'ENTRY_RELEASE', 'REFUND', 'DEPOSIT'];

const PIX_KEY_LABELS: Record<PixKeyType, string> = {
  CPF: 'CPF',
  EMAIL: 'E-mail',
  PHONE: 'Telefone',
  EVP: 'Chave aleatória',
};

// ─── Deposit QR Code Modal ────────────────────────────────────────────────────

function DepositModal({ result, onClose }: { result: DepositResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(result.copyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result.copyPaste]);

  const expiresAt = new Date(result.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '28px 32px',
        maxWidth: 420, width: '90%', textAlign: 'center',
        boxShadow: 'var(--shadow-card)',
      }}>
        <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Pagar com PIX</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>
          Valor: <strong style={{ color: 'var(--color-text)' }}>R$ {result.valueBrl.toFixed(2)}</strong>
          {' '}· Expira às {expiresAt}
        </p>

        {/* QR Code image from base64 — only render if string is valid base64 */}
        {/^[A-Za-z0-9+/]+={0,2}$/.test(result.qrCode) && (
          <div style={{
            background: '#fff', borderRadius: 8, padding: 12,
            display: 'inline-block', marginBottom: 20,
          }}>
            <img
              src={`data:image/png;base64,${result.qrCode}`}
              alt="QR Code PIX"
              width={200} height={200}
              style={{ display: 'block' }}
            />
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Ou copie o código PIX Copia e Cola:
          </p>
          <div style={{
            background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)',
            padding: '10px 14px', fontSize: 11,
            color: 'var(--color-text-muted)',
            wordBreak: 'break-all', textAlign: 'left',
            maxHeight: 60, overflowY: 'auto',
          }}>
            {result.copyPaste}
          </div>
          <Button fullWidth size="sm" variant="outline" style={{ marginTop: 8 }} onClick={copy}>
            {copied ? '✓ Copiado!' : 'Copiar código'}
          </Button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Após o pagamento, o saldo será creditado automaticamente em até 1 minuto.
        </p>
        <Button fullWidth variant="ghost" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const QUICK_ADD_CENTS = [100, 500, 1000] as const;

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text)',
  padding: '10px 14px', fontSize: 14,
};

// ─── Copy Paste Row ───────────────────────────────────────────────────────────

function CopyPasteRow({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)',
        padding: '8px 12px', fontSize: 11, color: 'var(--color-text-muted)',
        wordBreak: 'break-all', maxHeight: 54, overflowY: 'auto', marginBottom: 6,
      }}>
        {code}
      </div>
      <Button fullWidth size="sm" variant="outline" onClick={copy}>
        {copied ? '✓ Copiado!' : 'Copiar código PIX'}
      </Button>
    </div>
  );
}

// ─── CPF Modal / Main ─────────────────────────────────────────────────────────

function formatCpf(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

interface CpfModalProps {
  needCpf: boolean;
  needBirthDate: boolean;
  onConfirm: (cpf: string | undefined, birthDate: string | undefined, save: boolean) => void;
  onClose: () => void;
}

function CpfModal({ needCpf, needBirthDate, onConfirm, onClose }: CpfModalProps) {
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [save, setSave] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = cpf.replace(/\D/g, '');
    if (needCpf && raw.length !== 11) {
      setError('Informe um CPF válido com 11 dígitos.');
      return;
    }
    if (needBirthDate && !birthDate) {
      setError('Informe sua data de nascimento.');
      return;
    }
    onConfirm(needCpf ? raw : undefined, needBirthDate ? birthDate : undefined, save);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '28px 32px',
        maxWidth: 380, width: '90%',
        boxShadow: 'var(--shadow-card)',
      }}>
        <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Dados obrigatórios</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          O Asaas exige CPF e data de nascimento para gerar o pagamento PIX e validar a maioridade.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {needCpf && (
            <input
              type="text"
              value={cpf}
              onChange={e => { setCpf(formatCpf(e.target.value)); if (error) setError(''); }}
              placeholder="000.000.000-00"
              maxLength={14}
              style={inputStyle}
              autoFocus
            />
          )}
          {needBirthDate && (
            <input
              type="date"
              value={birthDate}
              onChange={e => { setBirthDate(e.target.value); if (error) setError(''); }}
              style={inputStyle}
              autoFocus={!needCpf}
            />
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={save}
              onChange={e => setSave(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Salvar dados na minha conta (não precisar informar novamente)
          </label>
          {error && <p style={{ color: 'var(--color-danger)', fontSize: 12 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
            <Button type="submit" fullWidth>Continuar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WalletPage() {
  const { isMobile } = useBreakpoint();
  const { user, updateUser } = useAuthStore();
  const [cpfModalPending, setCpfModalPending] = useState<number | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  // Platform feature flags
  const [depositsEnabled, setDepositsEnabled] = useState(true);
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true);
  const [withdrawalFeeDisplay, setWithdrawalFeeDisplay] = useState({ pct: 4, min: 3 });
  const [txData, setTxData] = useState<TxData | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(true);

  // Deposit form
  const [depositCents, setDepositCents] = useState(0);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositResult, setDepositResult] = useState<DepositResult | null>(null);
  const [depositError, setDepositError] = useState('');

  // Withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState('');
  const [withdrawError, setWithdrawError] = useState('');

  // PIX key form
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('EMAIL');
  const [pixKeyLoading, setPixKeyLoading] = useState(false);
  const [pixKeyMsg, setPixKeyMsg] = useState('');
  const [pixKeyError, setPixKeyError] = useState('');

  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [toast, setToast] = useState<string | null>(null);

  // Deposit list (history tab)
  const [depositList, setDepositList] = useState<DepositListData | null>(null);
  const [depositListPage, setDepositListPage] = useState(1);
  const [depositListLoading, setDepositListLoading] = useState(false);
  const [expandedDeposit, setExpandedDeposit] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const fetchBalance = useCallback(() => {
    api.get<{ balance: string }>('/wallet')
      .then(r => setBalance(r.balance))
      .catch(() => {});
  }, []);

  const fetchDepositList = useCallback(() => {
    setDepositListLoading(true);
    api.get<DepositListData>(`/wallet/deposits?page=${depositListPage}&limit=15`)
      .then(d => { setDepositList(d); setDepositListLoading(false); })
      .catch(() => setDepositListLoading(false));
  }, [depositListPage]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  useEffect(() => {
    api.get<{ features?: { depositsEnabled?: boolean; withdrawalsEnabled?: boolean }; fees?: { withdrawalPct?: number; withdrawalMin?: number } }>('/config/public')
      .then((cfg) => {
        if (cfg.features) {
          setDepositsEnabled(cfg.features.depositsEnabled !== false);
          setWithdrawalsEnabled(cfg.features.withdrawalsEnabled !== false);
        }
        if (cfg.fees) {
          setWithdrawalFeeDisplay({
            pct: Math.round((cfg.fees.withdrawalPct ?? 0.04) * 100),
            min: cfg.fees.withdrawalMin ?? 3,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const socket = getGameSocket();
    const handler = (data: { valueBrl: number; balance: number }) => {
      setBalance(String(data.balance));
      setToast(`Depósito de R$ ${data.valueBrl.toFixed(2)} confirmado! Saldo atualizado.`);
      setTimeout(() => setToast(null), 5000);
      if (activeTab === 'history') fetchDepositList();
    };
    socket.on('deposit_confirmed', handler);
    return () => { socket.off('deposit_confirmed', handler); };
  }, [activeTab, fetchDepositList]);

  useEffect(() => {
    if ((activeTab as string) !== 'cc_history') return;
    setTxLoading(true);
    api.get<TxData>(`/wallet/transactions?page=${txPage}&limit=20`)
      .then(d => { setTxData(d); setTxLoading(false); })
      .catch(() => setTxLoading(false));
  }, [txPage, activeTab]);

  useEffect(() => {
    if (activeTab === 'history') fetchDepositList();
  }, [activeTab, fetchDepositList]);

  const handleCancelDeposit = useCallback(async (depositId: string) => {
    setCancelLoading(true);
    setCancelError('');
    try {
      await api.delete(`/wallet/deposit/${depositId}`);
      setCancelConfirm(null);
      setExpandedDeposit(null);
      fetchDepositList();
    } catch (err: any) {
      setCancelError(err?.message ?? 'Erro ao cancelar depósito');
    } finally {
      setCancelLoading(false);
    }
  }, [fetchDepositList]);

  const doDeposit = useCallback(async (valueBrl: number, cpf?: string, birthDate?: string) => {
    setDepositLoading(true);
    try {
      const body: Record<string, unknown> = { valueBrl };
      if (cpf) body.cpf = cpf;
      if (birthDate) body.birthDate = birthDate;
      const result = await api.post<DepositResult>('/wallet/deposit', body);
      setDepositResult(result);
      setDepositCents(0);
    } catch (err: any) {
      setDepositError(err?.message ?? 'Erro ao gerar PIX. Tente novamente.');
    } finally {
      setDepositLoading(false);
    }
  }, []);

  const handleDeposit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const valueBrl = depositCents / 100;
    if (depositCents < 500) {
      setDepositError('Valor mínimo: R$ 5,00');
      return;
    }
    setDepositError('');
    if (!user?.cpf || !user?.birthDate) {
      setCpfModalPending(valueBrl);
      return;
    }
    doDeposit(valueBrl);
  }, [depositCents, user?.cpf, user?.birthDate, doDeposit]);

  const handleCpfConfirm = useCallback(async (cpf: string | undefined, birthDate: string | undefined, save: boolean) => {
    const valueBrl = cpfModalPending!;
    setCpfModalPending(null);
    if (save) {
      try {
        const billing: Record<string, string> = {};
        if (cpf) billing.cpf = cpf;
        if (birthDate) billing.birthDate = birthDate;
        const updated = await api.patch('/users/me/billing', billing);
        updateUser(updated as any);
        doDeposit(valueBrl);
      } catch {
        doDeposit(valueBrl, cpf, birthDate);
      }
    } else {
      doDeposit(valueBrl, cpf, birthDate);
    }
  }, [cpfModalPending, doDeposit, updateUser]);

  const handleWithdraw = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const valueCC = parseFloat(withdrawAmount);
    if (!withdrawAmount || isNaN(valueCC) || valueCC < 10) {
      setWithdrawError('Valor mínimo: 10 CC');
      return;
    }
    setWithdrawError('');
    setWithdrawMsg('');
    if (!pixKey.trim()) {
      setWithdrawError('Cadastre uma chave PIX antes de sacar.');
      return;
    }
    setWithdrawLoading(true);
    try {
      const r = await api.post<{ withdrawalId: string; valueCC: number; fee: number; valueBrl: number }>(
        '/wallet/withdraw',
        { valueCC, pixKey, pixKeyType },
      );
      setWithdrawMsg(
        `Saque de ${r.valueCC} CC solicitado! ` +
        `Taxa: ${r.fee} CC. Você receberá R$ ${r.valueBrl.toFixed(2)} via PIX em até 30 min.`,
      );
      setWithdrawAmount('');
      fetchBalance();
    } catch (err: any) {
      setWithdrawError(err?.message ?? 'Erro ao solicitar saque.');
    } finally {
      setWithdrawLoading(false);
    }
  }, [withdrawAmount, pixKey, pixKeyType, fetchBalance]);

  const handlePixKey = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pixKey.trim()) return;
    setPixKeyError('');
    setPixKeyMsg('');
    setPixKeyLoading(true);
    try {
      await api.post('/wallet/pix-key', { pixKey: pixKey.trim(), pixKeyType });
      setPixKeyMsg('Chave PIX cadastrada com sucesso!');
    } catch (err: any) {
      setPixKeyError(err?.message ?? 'Erro ao cadastrar chave PIX.');
    } finally {
      setPixKeyLoading(false);
    }
  }, [pixKey, pixKeyType]);

  const balanceNum = balance !== null ? parseFloat(balance) : null;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, marginBottom: 20 }}>
        Carteira
      </h1>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, background: '#2E7D32', color: '#fff',
          padding: '12px 24px', borderRadius: 'var(--radius-md)',
          fontSize: 14, fontWeight: 500, boxShadow: 'var(--shadow-card)',
          whiteSpace: 'nowrap',
        }}>
          ✓ {toast}
        </div>
      )}

      {/* Balance card */}
      <Card style={{ padding: 24, marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6, letterSpacing: '0.05em', fontWeight: 600 }}>
          SALDO DISPONÍVEL
        </div>
        <div style={{ fontSize: isMobile ? 36 : 48, fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--color-primary)' }}>◈</span>
          {' '}
          {balanceNum !== null ? balanceNum.toFixed(2) : '—'} <span style={{ fontSize: '0.5em', fontWeight: 600, color: 'var(--color-text-muted)' }}>CC</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
          1 CC = R$ 1,00
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: 4 }}>
        {(['deposit', 'withdraw', 'history', 'cc_history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-sm)',
              fontSize: 13, fontWeight: 500,
              background: activeTab === tab ? 'var(--color-surface-2)' : 'transparent',
              color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
              transition: 'all var(--transition)',
            }}
          >
            {tab === 'deposit' ? 'Depositar' : tab === 'withdraw' ? 'Sacar' : tab === 'history' ? 'PIX' : 'Histórico CC'}
          </button>
        ))}
      </div>

      {/* Deposit tab */}
      {activeTab === 'deposit' && (
        <Card style={{ padding: 24 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Depositar via PIX</h2>
          {!depositsEnabled && (
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(177,86,83,0.15)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontSize: 13, marginBottom: 16 }}>
              Depósitos temporariamente indisponíveis. Tente novamente mais tarde.
            </div>
          )}
          <form onSubmit={handleDeposit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Valor em R$ (mín. R$ 5,00)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={depositCents > 0 ? formatBRL(depositCents) : ''}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '');
                  const cents = Math.min(parseInt(digits || '0', 10), 1_000_000_00);
                  setDepositCents(cents);
                  if (depositError) setDepositError('');
                }}
                placeholder="R$ 0,00"
                style={inputStyle}
              />
              {/* Quick-add buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {QUICK_ADD_CENTS.map(add => (
                  <button
                    key={add}
                    type="button"
                    onClick={() => {
                      setDepositCents(prev => Math.min(prev + add, 1_000_000_00));
                      if (depositError) setDepositError('');
                    }}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-primary)', fontWeight: 600, fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    +{formatBRL(add)}
                  </button>
                ))}
              </div>
            </div>
            {depositError && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{depositError}</p>}
            <Button type="submit" loading={depositLoading} disabled={!depositsEnabled}>
              Gerar QR Code PIX
            </Button>
          </form>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 14, lineHeight: 1.6 }}>
            Após o pagamento, o valor em Chess Coins será creditado automaticamente.
            Não há taxa para depósito.
          </p>
        </Card>
      )}

      {/* Withdraw tab */}
      {activeTab === 'withdraw' && (
        <Card style={{ padding: 24 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Sacar via PIX</h2>
          {!withdrawalsEnabled && (
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(177,86,83,0.15)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontSize: 13, marginBottom: 16 }}>
              Saques temporariamente indisponíveis. Tente novamente mais tarde.
            </div>
          )}

          {/* PIX key section */}
          <div style={{ marginBottom: 24, padding: 16, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Sua chave PIX</h3>
            <form onSubmit={handlePixKey} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select
                value={pixKeyType}
                onChange={e => setPixKeyType(e.target.value as PixKeyType)}
                style={{ ...inputStyle }}
              >
                {(Object.keys(PIX_KEY_LABELS) as PixKeyType[]).map(k => (
                  <option key={k} value={k}>{PIX_KEY_LABELS[k]}</option>
                ))}
              </select>
              <input
                type="text"
                value={pixKey}
                onChange={e => setPixKey(e.target.value)}
                placeholder={pixKeyType === 'CPF' ? '000.000.000-00' : pixKeyType === 'EMAIL' ? 'email@exemplo.com' : pixKeyType === 'PHONE' ? '+5511999999999' : 'Chave EVP (UUID)'}
                style={inputStyle}
              />
              {pixKeyMsg && <p style={{ color: 'var(--color-success)', fontSize: 12 }}>{pixKeyMsg}</p>}
              {pixKeyError && <p style={{ color: 'var(--color-danger)', fontSize: 12 }}>{pixKeyError}</p>}
              <Button type="submit" size="sm" variant="outline" loading={pixKeyLoading}>
                Salvar chave PIX
              </Button>
            </form>
          </div>

          {/* Withdraw form */}
          <form onSubmit={handleWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Valor em CC (mín. 10 CC · taxa: {withdrawalFeeDisplay.pct}%, mín. {withdrawalFeeDisplay.min} CC)
              </label>
              <input
                type="number"
                min="10"
                step="1"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="Ex: 100"
                style={inputStyle}
              />
              {withdrawAmount && parseFloat(withdrawAmount) >= 10 && (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  Taxa: {Math.max(2, Math.ceil(parseFloat(withdrawAmount) * 0.02))} CC →{' '}
                  você recebe R$ {(parseFloat(withdrawAmount) - Math.max(2, Math.ceil(parseFloat(withdrawAmount) * 0.02))).toFixed(2)}
                </p>
              )}
            </div>
            {withdrawMsg && <p style={{ color: 'var(--color-success)', fontSize: 13 }}>{withdrawMsg}</p>}
            {withdrawError && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{withdrawError}</p>}
            <Button type="submit" loading={withdrawLoading} disabled={!withdrawalsEnabled}>
              Solicitar saque
            </Button>
          </form>

          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 14, lineHeight: 1.6 }}>
            Saques passam por análise antifraude e são processados em até 30 minutos.
            Taxa de 2% (mínimo 2 CC).
          </p>
        </Card>
      )}

      {/* History tab — deposits list */}
      {activeTab === 'history' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {depositListLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>
          ) : !depositList || depositList.items.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum depósito ainda.</div>
          ) : (
            <>
              {depositList.items.map((dep, i) => {
                const isExpanded = expandedDeposit === dep.id;
                const isPending = dep.status === 'PENDING';
                const isLast = i === depositList.items.length - 1;
                return (
                  <div key={dep.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--color-border)' }}>
                    {/* Row */}
                    <div
                      onClick={() => isPending ? setExpandedDeposit(isExpanded ? null : dep.id) : undefined}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 20px',
                        cursor: isPending ? 'pointer' : 'default',
                        background: isExpanded ? 'var(--color-surface-2)' : 'transparent',
                        transition: 'background var(--transition)',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: dep.status === 'COMPLETED' ? 'rgba(76,175,80,0.15)'
                          : dep.status === 'PENDING' ? 'rgba(232,168,56,0.15)'
                          : 'rgba(139,140,167,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      }}>
                        {dep.status === 'COMPLETED' ? '✓' : dep.status === 'PENDING' ? '⏳' : '×'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          Depósito PIX — R$ {parseFloat(dep.valueBrl).toFixed(2)}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>
                          <span style={{ color: DEPOSIT_STATUS_COLOR[dep.status], fontWeight: 500 }}>
                            {DEPOSIT_STATUS_LABEL[dep.status]}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            {' · '}{new Date(dep.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {dep.status === 'PENDING' && dep.expiresAt && (
                          <div style={{ fontSize: 11, color: '#E8A838', marginTop: 2 }}>
                            Expira às {new Date(dep.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                      {isPending && (
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      )}
                    </div>

                    {/* Expanded QR for pending */}
                    {isExpanded && isPending && dep.qrCode && (
                      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                        {/^[A-Za-z0-9+/]+={0,2}$/.test(dep.qrCode) && (
                          <div style={{ background: '#fff', borderRadius: 8, padding: 12, display: 'inline-block' }}>
                            <img src={`data:image/png;base64,${dep.qrCode}`} alt="QR Code" width={180} height={180} style={{ display: 'block' }} />
                          </div>
                        )}
                        {dep.copyPaste && (
                          <CopyPasteRow code={dep.copyPaste} />
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', width: '100%' }}
                          onClick={() => { setCancelConfirm(dep.id); setCancelError(''); }}
                        >
                          Cancelar depósito
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {depositList.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 20px' }}>
                  <Button size="sm" variant="ghost" disabled={depositListPage === 1} onClick={() => setDepositListPage(p => p - 1)}>← Anterior</Button>
                  <span style={{ padding: '8px 12px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {depositListPage} / {depositList.totalPages}
                  </span>
                  <Button size="sm" variant="ghost" disabled={depositListPage === depositList.totalPages} onClick={() => setDepositListPage(p => p + 1)}>Próxima →</Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* CC History tab */}
      {(activeTab as string) === 'cc_history' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>Histórico de CC</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Todas as movimentações de Chess Coins na sua conta
            </p>
          </div>
          {txLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>
          ) : !txData || txData.items.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhuma movimentação ainda.</div>
          ) : (
            <>
              {txData.items.map((tx, i) => {
                const isLast = i === txData.items.length - 1;
                const isCredit = CC_TX_CREDIT.includes(tx.type);
                const label = CC_TX_LABEL[tx.type] ?? tx.type;
                const icon = CC_TX_ICON[tx.type] ?? '◈';
                const amount = parseInt(tx.amount, 10);
                return (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px',
                    borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: isCredit ? 'rgba(76,175,80,0.12)' : 'rgba(239,68,68,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                      {tx.description && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.description}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {new Date(tx.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {tx.balanceAfter !== undefined && (
                          <span> · Saldo: {parseInt(tx.balanceAfter, 10)} CC</span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      fontWeight: 700, fontSize: 16,
                      color: isCredit ? 'var(--color-success)' : 'var(--color-danger)',
                      flexShrink: 0,
                    }}>
                      {isCredit ? '+' : '-'}{Math.abs(amount)} CC
                    </div>
                  </div>
                );
              })}
              {txData.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 20px' }}>
                  <Button size="sm" variant="ghost" disabled={txPage === 1} onClick={() => setTxPage(p => p - 1)}>← Anterior</Button>
                  <span style={{ padding: '8px 12px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {txPage} / {txData.totalPages}
                  </span>
                  <Button size="sm" variant="ghost" disabled={txPage === txData.totalPages} onClick={() => setTxPage(p => p + 1)}>Próxima →</Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Cancel confirmation modal */}
      {cancelConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: '28px 32px',
            maxWidth: 360, width: '90%', textAlign: 'center',
          }}>
            <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>Cancelar depósito?</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24 }}>
              O QR Code será invalidado e você não poderá mais efetuar o pagamento.
            </p>
            {cancelError && (
              <p style={{ color: 'var(--color-danger)', fontSize: 12, marginBottom: 12 }}>{cancelError}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" fullWidth onClick={() => setCancelConfirm(null)}>Voltar</Button>
              <Button
                fullWidth
                style={{ background: 'var(--color-danger)' }}
                loading={cancelLoading}
                onClick={() => handleCancelDeposit(cancelConfirm)}
              >
                Confirmar cancelamento
              </Button>
            </div>
          </div>
        </div>
      )}

      {cpfModalPending !== null && (
        <CpfModal
          needCpf={!user?.cpf}
          needBirthDate={!user?.birthDate}
          onConfirm={handleCpfConfirm}
          onClose={() => setCpfModalPending(null)}
        />
      )}

      {depositResult && (
        <DepositModal
          result={depositResult}
          onClose={() => { setDepositResult(null); fetchBalance(); }}
        />
      )}
    </div>
  );
}
