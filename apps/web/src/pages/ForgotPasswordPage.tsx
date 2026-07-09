import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { forgotPasswordSchema, type ForgotPasswordSchema } from '../lib/schemas';
import { useState } from 'react';
import logoSvg from '../assets/logo.svg';

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordSchema) => {
    setServerError('');
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('forgot_password.generic_error'));
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(61,74,235,0.18) 0%, var(--color-bg) 70%)',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40, gap: 12 }}>
          <img src={logoSvg} alt="Mega Chess Online" style={{ width: 72, height: 72 }} />
        </div>

        <Card glow>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{t('forgot_password.title')}</h2>

          {sent ? (
            <div>
              <div style={{
                padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(45,106,79,0.2)', color: '#4ade80',
                fontSize: 14, lineHeight: 1.6, marginBottom: 20,
              }}>
                {t('forgot_password.sent_message')}
              </div>
              <Link to="/" style={{ color: 'var(--color-primary)', fontSize: 14 }}>
                {t('forgot_password.back_to_login')}
              </Link>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
                {t('forgot_password.description')}
              </p>

              <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Input
                  label="Email"
                  type="email"
                  placeholder="seu@email.com"
                  autoFocus
                  error={errors.email?.message ? t(errors.email.message) : undefined}
                  {...register('email')}
                />

                {serverError && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-danger-dim)', color: 'var(--color-danger)',
                    fontSize: 13,
                  }}>
                    {serverError}
                  </div>
                )}

                <Button type="submit" loading={isSubmitting} fullWidth size="lg">
                  {t('forgot_password.submit')}
                </Button>
              </form>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
                <Link to="/" style={{ color: 'var(--color-primary)' }}>{t('forgot_password.back_to_login')}</Link>
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
