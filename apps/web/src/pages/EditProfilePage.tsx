import React, { useState, useRef } from 'react';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';

export function EditProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess(false);
    try {
      const updated = await api.patch<any>('/users/me', { name, bio });
      updateUser(updated);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await api.upload<any>('/users/me/avatar', form);
      updateUser({ avatarUrl: result.avatarUrl });
    } catch (err: any) {
      setError('Erro ao enviar foto');
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28 }}>Editar Perfil</h1>

      <Card>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <Avatar src={user?.avatarUrl} name={user?.nickname} size={72} />
          <div>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              Trocar foto
            </Button>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>JPG, PNG ou WEBP · máx 2MB</p>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={handleAvatar} />
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Nome completo" value={name} onChange={e => setName(e.target.value)} required />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)' }}>Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Fale um pouco sobre você..."
              style={{
                background: 'var(--color-surface-3)',
                border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)',
                padding: '10px 14px',
                fontSize: 14,
                resize: 'vertical',
                fontFamily: 'var(--font)',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'right' }}>{bio.length}/300</span>
          </div>

          {error && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--color-danger-dim)', color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>}
          {success && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--color-success-dim)', color: 'var(--color-success)', fontSize: 13 }}>Perfil atualizado!</div>}

          <Button type="submit" loading={saving} fullWidth>Salvar alterações</Button>
        </form>
      </Card>
    </div>
  );
}
