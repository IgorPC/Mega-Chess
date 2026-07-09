import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import logoSvg from '../assets/logo.svg';

type State = 'loading' | 'success' | 'expired' | 'used' | 'invalid';

export function VerifyEmailPage() {
  const { t } = useTranslation('auth');
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
              <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>{t('verify_email.verifying')}</p>
            </div>
          )}

          {state === 'success' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('verify_email.success_title')}</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                {t('verify_email.success_message')}
              </p>
            </div>
          )}

          {state === 'expired' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('verify_email.expired_title')}</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                {t('verify_email.expired_message')}
              </p>
              {resendSent ? (
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(45,106,79,0.2)', color: '#4ade80', fontSize: 13, marginBottom: 16,
                }}>
                  {t('verify_email.resend_sent')}
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
                    {t('verify_email.resend_button')}
                  </Button>
                </div>
              )}
              <p style={{ marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
                <Link to="/" style={{ color: 'var(--color-primary)' }}>{t('verify_email.go_to_login')}</Link>
              </p>
            </div>
          )}

          {state === 'used' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('verify_email.used_title')}</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                {t('verify_email.used_message')}
              </p>
              <Link to="/" style={{ color: 'var(--color-primary)', fontSize: 14 }}>{t('verify_email.go_to_login')}</Link>
            </div>
          )}

          {state === 'invalid' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('verify_email.invalid_title')}</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                {t('verify_email.invalid_message')}
              </p>
              <Link to="/" style={{ color: 'var(--color-primary)', fontSize: 14 }}>{t('verify_email.go_to_login')}</Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
