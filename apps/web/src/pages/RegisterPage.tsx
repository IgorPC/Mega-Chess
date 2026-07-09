import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth.store';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { registerSchema, type RegisterSchema } from '../lib/schemas';
import { useState } from 'react';
import logoSvg from '../assets/logo.svg';

export function RegisterPage() {
  const { t } = useTranslation('auth');
  const { register: registerUser, resendVerification } = useAuthStore();
  const { isMobile } = useBreakpoint();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') ?? undefined;
  const [emailSentTo, setEmailSentTo] = useState('');
  const [serverError, setServerError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterSchema) => {
    setServerError('');
    try {
      await registerUser({ name: data.name, nickname: data.nickname, email: data.email, password: data.password, referralCode: refCode });
      setEmailSentTo(data.email);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : t('register.generic_error'));
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      await resendVerification(emailSentTo);
      setResendSent(true);
    } catch {
      // silently ignore — API always returns sent:true
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
    padding: isMobile ? '20px 16px' : 24,
  };

  if (emailSentTo) {
    return (
      <div style={containerStyle}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32, gap: 10 }}>
            <img src={logoSvg} alt="" style={{ width: 60, height: 60 }} />
          </div>
          <Card glow>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{t('register.verify_email_title')}</h2>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
                {t('register.verify_email_sent', { email: emailSentTo })}
                <br />
                {t('register.verify_email_instructions')}
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
                {t('register.didnt_receive')}
              </p>
              {resendSent ? (
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(45,106,79,0.2)', color: '#4ade80', fontSize: 13, marginBottom: 20,
                }}>
                  {t('register.resend_success')}
                </div>
              ) : (
                <Button
                  variant="outline"
                  fullWidth
                  loading={resendLoading}
                  onClick={handleResend}
                  style={{ marginBottom: 16 }}
                >
                  {t('register.resend_button')}
                </Button>
              )}
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                {t('register.already_confirmed')}{' '}
                <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{t('login.title')}</Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32, gap: 10 }}>
          <img src={logoSvg} alt="" style={{ width: 60, height: 60 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{t('register.title')}</h1>
        </div>

        <Card glow>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label={t('register.name_label')}
              placeholder={t('register.name_placeholder')}
              error={errors.name?.message ? t(errors.name.message) : undefined}
              {...register('name')}
            />
            <Input
              label={t('register.nickname_label')}
              placeholder={t('register.nickname_placeholder')}
              error={errors.nickname?.message ? t(errors.nickname.message) : undefined}
              {...register('nickname')}
            />
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
              placeholder={t('register.password_placeholder')}
              error={errors.password?.message ? t(errors.password.message) : undefined}
              {...register('password')}
            />
            <Input
              label={t('register.confirm_password_label')}
              type="password"
              placeholder={t('register.confirm_password_placeholder')}
              error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}
              {...register('confirmPassword')}
            />

            {serverError && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--color-danger-dim)', color: 'var(--color-danger)', fontSize: 13 }}>
                {serverError}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} fullWidth size="lg" style={{ marginTop: 8 }}>
              {t('register.submit')}
            </Button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
            {t('register.have_account')}{' '}
            <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{t('register.login_link')}</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
