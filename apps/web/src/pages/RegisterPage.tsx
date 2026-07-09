import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/auth.store';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { registerSchema, type RegisterSchema } from '../lib/schemas';
import { useState } from 'react';
import logoSvg from '../assets/logo.svg';

export function RegisterPage() {
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
      setServerError(err instanceof Error ? err.message : 'Erro ao criar conta');
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
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Verifique seu email</h2>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
                Enviamos um link de confirmação para{' '}
                <strong style={{ color: 'var(--color-text)' }}>{emailSentTo}</strong>.
                <br />
                Clique no link para ativar sua conta.
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
                Não recebeu o email? Verifique a pasta de spam ou solicite um novo abaixo.
              </p>
              {resendSent ? (
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(45,106,79,0.2)', color: '#4ade80', fontSize: 13, marginBottom: 20,
                }}>
                  Email reenviado com sucesso!
                </div>
              ) : (
                <Button
                  variant="outline"
                  fullWidth
                  loading={resendLoading}
                  onClick={handleResend}
                  style={{ marginBottom: 16 }}
                >
                  Reenviar email de confirmação
                </Button>
              )}
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                Já confirmou?{' '}
                <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Entrar</Link>
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
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>Criar conta</h1>
        </div>

        <Card glow>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label="Nome completo"
              placeholder="João Silva"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Apelido (nickname)"
              placeholder="joao_chess"
              error={errors.nickname?.message}
              {...register('nickname')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Senha"
              type="password"
              placeholder="Mínimo 6 caracteres"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirmar senha"
              type="password"
              placeholder="Repita a senha"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            {serverError && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--color-danger-dim)', color: 'var(--color-danger)', fontSize: 13 }}>
                {serverError}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} fullWidth size="lg" style={{ marginTop: 8 }}>
              Criar conta
            </Button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
            Já tem conta?{' '}
            <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Entrar</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
