import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/auth.store';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { editProfileSchema, type EditProfileSchema } from '../lib/schemas';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

function formatCpf(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

interface DeleteAccountModalProps {
  step: 'confirm' | 'balance';
  balance: number;
  loading: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}

function DeleteAccountModal({ step, balance, loading, error, onConfirm, onClose }: DeleteAccountModalProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '28px 32px',
        maxWidth: 420, width: '90%',
        boxShadow: 'var(--shadow-card)',
      }}>
        <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          {step === 'balance' ? 'Você possui saldo em conta' : 'Excluir conta'}
        </h2>

        {step === 'confirm' && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Essa ação é permanente. Seus dados pessoais serão removidos e você perderá acesso à conta.
            Não será possível desfazer essa operação.
          </p>
        )}

        {step === 'balance' && (
          <>
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16,
              background: 'var(--color-danger-dim)', color: 'var(--color-danger)', fontSize: 13, lineHeight: 1.6,
            }}>
              Você possui <strong>R$ {balance.toFixed(2)}</strong> de saldo em sua carteira.
              Ao excluir sua conta, esse saldo será <strong>perdido permanentemente</strong> — saque antes de continuar.
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Tem certeza que deseja excluir sua conta e abrir mão desse saldo?
            </p>
          </>
        )}

        {error && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            fullWidth
            loading={loading}
            style={{ background: 'var(--color-danger)' }}
            onClick={onConfirm}
          >
            {step === 'balance' ? 'Excluir mesmo assim e perder saldo' : 'Excluir minha conta'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EditProfilePage() {
  const { user, updateUser, deleteAccount } = useAuthStore();
  const navigate = useNavigate();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'balance'>('confirm');
  const [deleteBalance, setDeleteBalance] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Billing fields (uncontrolled by rhf since they have custom masking)
  const [billingName, setBillingName] = useState(user?.billingName || '');
  const [birthDate, setBirthDate] = useState(user?.birthDate || '');
  const [cpf, setCpf] = useState(user?.cpf ? formatCpf(user.cpf) : '');
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState(false);
  const [billingError, setBillingError] = useState('');

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<EditProfileSchema>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      name: user?.name || '',
      nickname: user?.nickname || '',
      bio: user?.bio || '',
    },
  });

  const bioValue = watch('bio') ?? '';

  const onSubmit = async (data: EditProfileSchema) => {
    setAvatarError('');
    setSuccess(false);
    try {
      const updated = await api.patch<{ name: string; bio: string }>('/users/me', {
        name: data.name.trim(),
        bio: (data.bio ?? '').trim(),
      });
      updateUser(updated);
      setSuccess(true);
    } catch (err: unknown) {
      throw err;
    }
  };

  const handleBillingSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf && rawCpf.length !== 11) {
      setBillingError('CPF inválido. Informe os 11 dígitos.');
      return;
    }
    setBillingSaving(true);
    setBillingError('');
    setBillingSuccess(false);
    try {
      const updated = await api.patch('/users/me/billing', {
        billingName: billingName.trim() || undefined,
        birthDate: birthDate || undefined,
        cpf: rawCpf || undefined,
      });
      updateUser(updated as any);
      setBillingSuccess(true);
    } catch (err: unknown) {
      setBillingError(err instanceof Error ? err.message : 'Erro ao salvar dados de cobrança');
    } finally {
      setBillingSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteAccount(deleteStep === 'balance');
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'HAS_BALANCE') {
        setDeleteBalance(err.data?.balance ?? 0);
        setDeleteStep('balance');
      } else {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir conta. Tente novamente.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setAvatarError('Formato inválido. Use JPG, PNG ou WEBP.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setAvatarError('Arquivo muito grande. Máximo 2 MB.');
      e.target.value = '';
      return;
    }

    setAvatarError('');
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await api.upload<{ avatarUrl: string }>('/users/me/avatar', form);
      updateUser({ avatarUrl: result.avatarUrl });
    } catch {
      setAvatarError('Erro ao enviar foto. Tente novamente.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Editar Perfil</h1>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <Avatar src={user?.avatarUrl} name={user?.nickname} size={72} />
          <div>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              Trocar foto
            </Button>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
              JPG, PNG ou WEBP · máx 2 MB
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatar}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Nome completo"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Apelido (nickname)"
            error={errors.nickname?.message}
            {...register('nickname')}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)' }}>Bio</label>
            <textarea
              maxLength={200}
              rows={3}
              placeholder="Fale um pouco sobre você..."
              style={{
                background: 'var(--color-surface-3)',
                border: errors.bio ? '1.5px solid var(--color-danger)' : '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)',
                padding: '10px 14px',
                fontSize: 14,
                resize: 'vertical',
                fontFamily: 'var(--font)',
              }}
              {...register('bio')}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'right' }}>
              {bioValue.length}/200
            </span>
            {errors.bio && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{errors.bio.message}</span>}
          </div>

          {avatarError && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-danger-dim)', color: 'var(--color-danger)', fontSize: 13,
            }}>
              {avatarError}
            </div>
          )}
          {success && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-success-dim)', color: 'var(--color-success)', fontSize: 13,
            }}>
              Perfil atualizado com sucesso!
            </div>
          )}

          <Button type="submit" loading={isSubmitting} fullWidth>
            Salvar alterações
          </Button>
        </form>
      </Card>

      <Card>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Informações de Cobrança</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Usadas ao gerar depósitos via PIX. CPF não é obrigatório aqui, mas será solicitado ao gerar o primeiro pagamento.
        </p>

        <form onSubmit={handleBillingSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Nome completo (para cobrança) — opcional"
            value={billingName}
            onChange={e => setBillingName(e.target.value)}
            maxLength={120}
            placeholder={user?.name}
          />

          <Input
            label="Data de nascimento — opcional"
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
          />

          <Input
            label="CPF — opcional"
            value={cpf}
            onChange={e => setCpf(formatCpf(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
            error={billingError && billingError.includes('CPF') ? billingError : undefined}
          />

          {billingError && !billingError.includes('CPF') && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-danger-dim)', color: 'var(--color-danger)', fontSize: 13,
            }}>
              {billingError}
            </div>
          )}
          {billingSuccess && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-success-dim)', color: 'var(--color-success)', fontSize: 13,
            }}>
              Dados de cobrança salvos!
            </div>
          )}

          <Button type="submit" loading={billingSaving} fullWidth variant="outline">
            Salvar dados de cobrança
          </Button>
        </form>
      </Card>

      <Card style={{ border: '1px solid var(--color-danger)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: 'var(--color-danger)' }}>Zona de perigo</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Excluir sua conta é uma ação permanente. Seus dados pessoais serão apagados e você não poderá mais acessar a plataforma com esse login.
        </p>
        <Button
          type="button"
          fullWidth
          variant="outline"
          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
          onClick={() => { setDeleteStep('confirm'); setDeleteError(''); setDeleteModalOpen(true); }}
        >
          Excluir minha conta
        </Button>
      </Card>

      {deleteModalOpen && (
        <DeleteAccountModal
          step={deleteStep}
          balance={deleteBalance}
          loading={deleteLoading}
          error={deleteError}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteModalOpen(false)}
        />
      )}
    </div>
  );
}
