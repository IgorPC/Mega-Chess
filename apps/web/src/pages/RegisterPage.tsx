import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import logoSvg from '../assets/logo.svg';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const [form, setForm] = useState({ email: '', name: '', nickname: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/lobby');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(61,74,235,0.18) 0%, var(--color-bg) 70%)',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32, gap: 10 }}>
          <img src={logoSvg} alt="" style={{ width: 60, height: 60 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>
            Criar conta
          </h1>
        </div>

        <Card glow>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Nome completo" value={form.name} onChange={set('name')} placeholder="João Silva" required />
            <Input
              label="Apelido (nickname)"
              value={form.nickname}
              onChange={set('nickname')}
              placeholder="joao_chess"
              pattern="[a-zA-Z0-9_]+"
              title="Apenas letras, números e _"
              minLength={3}
              maxLength={20}
              required
            />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="seu@email.com" required />
            <Input label="Senha" type="password" value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" minLength={6} required />

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--color-danger-dim)', color: 'var(--color-danger)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} fullWidth size="lg" style={{ marginTop: 8 }}>
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
