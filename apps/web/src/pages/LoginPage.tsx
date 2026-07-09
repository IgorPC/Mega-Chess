import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth.store';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { ApiError } from '../lib/api';
import { loginSchema, type LoginSchema } from '../lib/schemas';
import { useState } from 'react';
import logoSvg from '../assets/logo.svg';

export function LoginPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { login, resendVerification } = useAuthStore();
  const { isMobile } = useBreakpoint();
  const [serverError, setServerError] = useState('');
  const [verificationSentTo, setVerificationSentTo] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginSchema) => {
    setServerError('');
    try {
      await login(data.email, data.password);
      navigate('/lobby');
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.code === 'EMAIL_NOT_VERIFIED' || err.code === 'EMAIL_VERIFICATION_EXPIRED')) {
        // Auto-send a fresh verification email and show the confirmation screen
        try { await resendVerification(data.email); } catch { /* ignore — shows screen regardless */ }
        setVerificationSentTo(data.email);
        return;
      }
      // Never surface raw backend error text (e.g. "Unauthorized") — map by status instead.
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setServerError(t('login.too_many_attempts'));
        } else if (err.status >= 500) {
          setServerError(t('login.something_went_wrong'));
        } else {
          setServerError(t('login.invalid_credentials'));
        }
        return;
      }
      setServerError(t('login.something_went_wrong'));
    }
  };

  if (verificationSentTo) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(61,74,235,0.18) 0%, var(--color-bg) 70%)',
        padding: isMobile ? '20px 16px' : 24,
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32, gap: 10 }}>
            <img src={logoSvg} alt="" style={{ width: 60, height: 60 }} />
          </div>
          <Card glow>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('login.verify_email_title')}</h2>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
                {t('login.verify_email_resent', { email: verificationSentTo })}
                <br />
                {t('login.verify_email_instructions')}
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
                {t('login.didnt_receive')}
              </p>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{t('forgot_password.back_to_login')}</Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(61,74,235,0.18) 0%, var(--color-bg) 70%)',
      padding: isMobile ? '20px 16px' : 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40, gap: 12 }}>
          <img src={logoSvg} alt="Mega Chess Online" style={{ width: 72, height: 72 }} />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>
              Mega Chess <span style={{ color: 'var(--color-primary)' }}>Online</span>
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>
              {t('login.tagline')}
            </p>
          </div>
        </div>

        <Card glow>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>{t('login.title')}</h2>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              error={errors.email?.message ? t(errors.email.message) : undefined}
              {...register('email')}
            />
            <Input
              label={t('register.password_label')}
              type="password"
              placeholder="••••••••"
              error={errors.password?.message ? t(errors.password.message) : undefined}
              {...register('password')}
            />

            {serverError && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-danger-dim)', color: 'var(--color-danger)',
                fontSize: 13, lineHeight: 1.5,
              }}>
                {serverError}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} fullWidth size="lg" style={{ marginTop: 4 }}>
              {t('login.title')}
            </Button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
            <Link to="/forgot-password" style={{ color: 'var(--color-text-muted)' }}>
              {t('login.forgot_password')}
            </Link>
          </p>

          <p style={{ textAlign: 'center', marginTop: 8, fontSize: 14, color: 'var(--color-text-muted)' }}>
            {t('login.no_account')}{' '}
            <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
              {t('login.register_link')}
            </Link>
          </p>
        </Card>

        <div style={{
          display: 'flex', justifyContent: 'center', gap: 16,
          marginTop: 32, fontSize: 28, opacity: 0.2, filter: 'grayscale(1)',
        }}>
          ♚ ♛ ♜ ♝ ♞ ♟
        </div>
      </div>
    </div>
  );
}
