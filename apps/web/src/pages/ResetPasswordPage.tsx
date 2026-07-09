import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { resetPasswordSchema, type ResetPasswordSchema } from '../lib/schemas';
import { useState } from 'react';
import logoSvg from '../assets/logo.svg';

export function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordSchema) => {
    if (!token) { setServerError(t('reset_password.invalid_link')); return; }
    setServerError('');
    try {
      await api.post('/auth/reset-password', { token, newPassword: data.password });
      setDone(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : t('reset_password.generic_error'));
    }
  };

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-bg)', padding: 24,
      }}>
        <Card>
          <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{t('reset_password.invalid_or_expired')}</p>
          <Link to="/forgot-password" style={{ color: 'var(--color-primary)', fontSize: 14 }}>
            {t('reset_password.request_new_link')}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(61,74,235,0.18) 0%, var(--color-bg) 70%)',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <img src={logoSvg} alt="Mega Chess Online" style={{ width: 72, height: 72 }} />
        </div>

        <Card glow>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{t('reset_password.title')}</h2>

          {done ? (
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(45,106,79,0.2)', color: '#4ade80',
              fontSize: 14, lineHeight: 1.6,
            }}>
              {t('reset_password.success')}
            </div>
          ) : (
            <>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
                {t('reset_password.min_chars')}
              </p>

              <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Input
                  label={t('reset_password.new_password_label')}
                  type="password"
                  placeholder="••••••••"
                  autoFocus
                  error={errors.password?.message ? t(errors.password.message) : undefined}
                  {...register('password')}
                />
                <Input
                  label={t('reset_password.confirm_password_label')}
                  type="password"
                  placeholder="••••••••"
                  error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}
                  {...register('confirmPassword')}
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

                <Button type="submit" loading={isSubmitting} fullWidth size="lg">
                  {t('reset_password.submit')}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
