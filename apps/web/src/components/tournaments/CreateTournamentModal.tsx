import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateTournamentModalProps {
  onClose: () => void;
  onCreate: (tournament: { id: string; name: string }) => void;
}

type AllowedPlayerCount = 4 | 8;

const TIME_CONTROLS = [
  { value: '1+0',  label: '1+0',   desc: 'Bullet'    },
  { value: '3+2',  label: '3+2',   desc: 'Blitz'     },
  { value: '5+0',  label: '5+0',   desc: 'Blitz'     },
  { value: '5+3',  label: '5+3',   desc: 'Blitz'     },
  { value: '10+0', label: '10+0',  desc: 'Rápido'    },
  { value: '15+10',label: '15+10', desc: 'Rápido'    },
] as const;

const PLAYER_COUNTS: AllowedPlayerCount[] = [4, 8];

// ─── Prize calculator (mirrors backend logic) ─────────────────────────────────

function calcPrizes(maxPlayers: number, entryFee: number) {
  const total     = maxPlayers * entryFee;
  const rake      = Math.floor(total * 0.1);
  const prizePool = total - rake;
  if (maxPlayers <= 4) {
    const first  = Math.floor(prizePool * 0.6);
    const second = prizePool - first;
    return { total, prizePool, first, second, third: 0, rake, hasThird: false };
  }
  const first     = Math.floor(prizePool * 0.5);
  const second    = Math.floor(prizePool * 0.35);
  const third     = Math.floor(prizePool * 0.15);
  const extraRake = prizePool - first - second - third;
  return { total, prizePool, first, second, third, rake: rake + extraRake, hasThird: true };
}

function calcCreationFee(entryFee: number): number {
  if (entryFee < 5)  return 2;
  if (entryFee < 10) return 3;
  if (entryFee < 20) return 5;
  return 10;
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
      color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 10,
    }}>
      {children}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreateTournamentModal({ onClose, onCreate }: CreateTournamentModalProps) {
  const [name,        setName]        = useState('');
  const [entryFee,    setEntryFee]    = useState(5);
  const [entryInput,  setEntryInput]  = useState('5');
  const [maxPlayers,  setMaxPlayers]  = useState<AllowedPlayerCount>(8);
  const [timeControl, setTimeControl] = useState('5+0');
  const [isPrivate,   setIsPrivate]   = useState(false);
  const [password,    setPassword]    = useState('');
  const [isFlexible,  setIsFlexible]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const prizes      = useMemo(() => calcPrizes(maxPlayers, entryFee), [maxPlayers, entryFee]);
  const creationFee = useMemo(() => calcCreationFee(entryFee), [entryFee]);

  const handleEntryChange = useCallback((raw: string) => {
    setEntryInput(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= 10000) setEntryFee(n);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError('');
    const trimmed = name.trim();
    if (trimmed.length < 3)  { setError('Nome deve ter ao menos 3 caracteres.'); return; }
    if (trimmed.length > 60) { setError('Nome pode ter no máximo 60 caracteres.'); return; }
    if (entryFee < 1)        { setError('Taxa mínima é 1 CC.'); return; }
    if (isPrivate && !password.trim()) { setError('Informe a senha do torneio privado.'); return; }

    setLoading(true);
    try {
      const { api } = await import('../../lib/api');
      const result = await api.post<{ id: string; name: string }>('/tournaments', {
        name: trimmed, entryFee, maxPlayers, timeControl, isPrivate,
        password: isPrivate ? password : undefined,
        isFlexible,
      });
      onCreate(result);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao criar torneio.');
    } finally {
      setLoading(false);
    }
  }, [name, entryFee, maxPlayers, timeControl, isPrivate, password, isFlexible, onCreate]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px',
        maxWidth: 520, width: '100%', maxHeight: '90vh',
        overflowY: 'auto', boxShadow: 'var(--shadow-card)',
        display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>🏆 Criar Torneio</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 20,
            color: 'var(--color-text-muted)', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Name */}
        <div>
          <SectionLabel>Nome do torneio</SectionLabel>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Torneio dos Campeões"
            maxLength={60}
            style={{
              width: '100%', padding: '10px 14px', fontSize: 14,
              background: 'var(--color-surface-2)',
              border: `1.5px solid ${name.trim().length > 0 && name.trim().length < 3 ? 'var(--color-danger)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
              fontFamily: 'var(--font)', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {name.trim().length > 0 && name.trim().length < 3
              ? <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>Mínimo 3 caracteres</span>
              : <span />}
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{name.trim().length} / 60</span>
          </div>
        </div>

        {/* Entry fee */}
        <div>
          <SectionLabel>Taxa de entrada por jogador (CC)</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => { const v = Math.max(1, entryFee - 1); setEntryFee(v); setEntryInput(String(v)); }}
              style={stepperBtn}
            >−</button>
            <input
              type="number" min={1} max={10000} value={entryInput}
              onChange={e => handleEntryChange(e.target.value)}
              style={{
                width: 80, padding: '8px 10px', fontSize: 18, fontWeight: 700,
                textAlign: 'center', background: 'var(--color-surface-2)',
                border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--color-primary)', fontFamily: 'var(--font)',
              }}
            />
            <button
              onClick={() => { const v = Math.min(10000, entryFee + 1); setEntryFee(v); setEntryInput(String(v)); }}
              style={stepperBtn}
            >+</button>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              CC por jogador · mínimo 1 CC
            </span>
          </div>
        </div>

        {/* Max players */}
        <div>
          <SectionLabel>Número máximo de jogadores</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {PLAYER_COUNTS.map(n => (
              <button
                key={n}
                onClick={() => setMaxPlayers(n)}
                style={{
                  flex: 1, padding: '10px 4px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${maxPlayers === n ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: maxPlayers === n ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
                  cursor: 'pointer', transition: 'all var(--transition)', fontFamily: 'var(--font)',
                  fontWeight: 700, fontSize: 14, color: maxPlayers === n ? 'var(--color-primary)' : 'var(--color-text)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 5 }}>
            Eliminação simples · {Math.log2(maxPlayers)} rodadas
            {maxPlayers > 4 ? ' + disputa de 3º lugar' : ' · sem disputa de 3º (split 60/40)'}
          </p>
        </div>

        {/* Time control */}
        <div>
          <SectionLabel>Controle de tempo</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {TIME_CONTROLS.map(tc => (
              <button
                key={tc.value}
                onClick={() => setTimeControl(tc.value)}
                style={{
                  padding: '10px 6px', borderRadius: 'var(--radius-sm)', textAlign: 'center',
                  border: `2px solid ${timeControl === tc.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: timeControl === tc.value ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
                  cursor: 'pointer', transition: 'all var(--transition)', fontFamily: 'var(--font)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: timeControl === tc.value ? 'var(--color-primary)' : 'var(--color-text)' }}>
                  {tc.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{tc.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Privacy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>Privacidade</SectionLabel>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox" checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
            />
            <span style={{ fontSize: 14 }}>Torneio privado (acesso por senha)</span>
          </label>
          {isPrivate && (
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Senha do torneio"
              style={{
                padding: '10px 14px', fontSize: 14,
                background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
                fontFamily: 'var(--font)',
              }}
            />
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox" checked={isFlexible}
              onChange={e => setIsFlexible(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
            />
            <span style={{ fontSize: 14 }}>Modo flexível <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>(iniciar com menos jogadores)</span></span>
          </label>
        </div>

        {/* Prize preview */}
        <div style={{
          background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)',
          padding: '16px 18px', border: '1px solid var(--color-border)',
        }}>
          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Prévia de prêmios <span style={{ color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 400 }}>(se todos os {maxPlayers} slots preencherem)</span></p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <PrizeRow icon="◈" label="Total arrecadado" value={prizes.total} muted />
            <PrizeRow icon="🏆" label={prizes.hasThird ? '1º lugar (50%)' : '1º lugar (60%)'} value={prizes.first} highlight />
            <PrizeRow icon="🥈" label={prizes.hasThird ? '2º lugar (35%)' : '2º lugar (40%)'} value={prizes.second} />
            {prizes.hasThird && <PrizeRow icon="🥉" label="3º lugar (15%)" value={prizes.third} />}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 6, marginTop: 2 }}>
              <PrizeRow icon="📊" label="Taxa da plataforma (10%)" value={prizes.rake} muted />
            </div>
          </div>
        </div>

        {/* Creation fee notice */}
        <div style={{
          background: 'rgba(255,160,0,0.08)', border: '1px solid rgba(255,160,0,0.25)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: '#f0a800' }}>
              Taxa de criação: {creationFee} CC (cobrada agora)
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              A taxa de entrada dos jogadores ({entryFee} CC × {maxPlayers}) só é debitada quando o torneio <strong>iniciar</strong>. Se cancelado antes, jogadores não são cobrados.
            </p>
          </div>
        </div>

        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: 13, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Button fullWidth variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button fullWidth loading={loading} onClick={handleSubmit}>
            Criar Torneio · {creationFee} CC
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrizeRow({ icon, label, value, highlight, muted }: {
  icon: string; label: string; value: number; highlight?: boolean; muted?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: muted ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
        {icon} {label}
      </span>
      <span style={{
        fontWeight: 700,
        color: highlight ? 'var(--color-primary)' : muted ? 'var(--color-text-muted)' : 'var(--color-text)',
      }}>
        {value} CC
      </span>
    </div>
  );
}

const stepperBtn: React.CSSProperties = {
  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', fontSize: 18, cursor: 'pointer', color: 'var(--color-text)',
  fontFamily: 'var(--font)', flexShrink: 0,
};
