import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import logoSvg from '../assets/logo.svg';

type State = 'loading' | 'success' | 'expired' | 'used' | 'invalid';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { resendVerification } = useAuthStore();

  const [state, setState] = useState<State>('loading');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setState('invalid'); return; }

    api.get<{ accessToken: string; refreshToken: string }>(`/auth/verify-email?token=${token}`)
      .then((data) => {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        setState('success');
        setTimeout(() => navigate('/lobby', { replace: true }), 2500);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 400) {
          setState('expired');
        } else if (err instanceof ApiError && err.status === 404) {
          setState('used');
        } else {
          setState('invalid');
        }
      });
  }, []);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendLoading(true);
    try {
      await resendVerification(resendEmail);
      setResendSent(true);
    } catch {
      // silently ignore
    } finally {
      setResendLoading(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(ellipse at 50% 0%, rgba(61,74,235,0.18) 0%, var(--color-bg) 70%)',
    padding: 24,
  };

  return (
    <div style={containerStyle}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <img src={logoSvg} alt="" style={{ width: 60, height: 60 }} />
        </div>

        <Card glow>
          {state === 'loading' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 42, marginBottom: 16 }}>⏳</div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>Verificando seu email...</p>
            </div>
          )}

          {state === 'success' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Email confirmado!</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                Sua conta está ativa. Redirecionando para o lobby...
              </p>
            </div>
          )}

          {state === 'expired' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Link expirado</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                O link de confirmação expirou após 24 horas. Informe seu email para receber um novo.
              </p>
              {resendSent ? (
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(45,106,79,0.2)', color: '#4ade80', fontSize: 13, marginBottom: 16,
                }}>
                  Novo email enviado! Verifique sua caixa de entrada.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={e => setResendEmail(e.target.value)}
                    placeholder="seu@email.com"
                    style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text)',
                      fontSize: 14,
                      padding: '10px 14px',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                  <Button
                    fullWidth
                    loading={resendLoading}
                    onClick={handleResend}
                    disabled={!resendEmail}
                  >
                    Reenviar email de confirmação
                  </Button>
                </div>
              )}
              <p style={{ marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
                <Link to="/" style={{ color: 'var(--color-primary)' }}>Voltar ao login</Link>
              </p>
            </div>
          )}

          {state === 'used' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Link já utilizado</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                Este link foi substituído por um mais recente. Se sua conta já está verificada, faça login normalmente.
              </p>
              <Link to="/" style={{ color: 'var(--color-primary)', fontSize: 14 }}>Ir para o login</Link>
            </div>
          )}

          {state === 'invalid' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Link inválido</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                Este link de verificação é inválido.
              </p>
              <Link to="/" style={{ color: 'var(--color-primary)', fontSize: 14 }}>Voltar ao login</Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
