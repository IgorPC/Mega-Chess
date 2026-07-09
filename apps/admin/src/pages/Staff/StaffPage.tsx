import { useState, useEffect, useCallback } from 'react'
import {
  Box, Card, CardContent, Button, Typography, Chip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Tab, Tabs, CircularProgress, Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/tables/DataTable'
import { StatusChip } from '../../components/ui/StatusChip'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { adminApi } from '../../lib/admin-api'
import type { AdminUser, AuditLog } from '../../types'

const ROLE_COLORS: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  SUPORTE: 'info', FINANCEIRO: 'warning', OPERADOR: 'warning', ADMIN: 'error',
}

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString('pt-BR') : '—' }

export function StaffPage() {
  const [tab, setTab] = useState(0)
  const [staff, setStaff] = useState<AdminUser[]>([])
  const [audit, setAudit] = useState<AuditLog[]>([])
  const [staffPage, setStaffPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)
  const [auditPages, setAuditPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [snack, setSnack] = useState('')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'SUPORTE' })

  // Edit dialog
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Deactivate
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.staff.list({ page: staffPage, limit: 25 })
      setStaff(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [staffPage])

  const loadAudit = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.staff.auditLogs({ page: auditPage, limit: 25 })
      setAudit(res.data); setAuditPages(res.totalPages)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [auditPage])

  useEffect(() => { void loadStaff() }, [loadStaff])
  useEffect(() => { void loadAudit() }, [loadAudit])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await adminApi.staff.create(form)
      setCreateOpen(false)
      setForm({ name: '', email: '', role: 'SUPORTE' })
      setSnack('Membro criado. Um e-mail com a senha temporária foi enviado.')
      void loadStaff()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setCreating(false) }
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      await adminApi.staff.update(editTarget.id, { role: editRole, isActive: editActive })
      setEditTarget(null)
      setSnack('Membro atualizado.')
      void loadStaff()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setSaving(false) }
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    try {
      await adminApi.staff.deactivate(deactivateTarget.id)
      setDeactivateTarget(null)
      setSnack('Conta desativada e sessões invalidadas.')
      void loadStaff()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
  }

  const staffColumns: ColumnDef<AdminUser, unknown>[] = [
    {
      id: 'user',
      header: 'Membro',
      cell: ({ row }) => (
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'primary.dark' }}>
            {row.original.name.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{row.original.name}</Typography>
            <Typography variant="caption" color="text.secondary">{row.original.email}</Typography>
          </Box>
        </Box>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => <Chip label={getValue<string>()} size="small" color={ROLE_COLORS[getValue<string>()] ?? 'default'} />,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ getValue }) => <StatusChip status={getValue<boolean>() ? 'ACTIVE' : 'SUSPENDED'} />,
    },
    { accessorKey: 'lastLoginAt', header: 'Último login', cell: ({ getValue }) => <Typography variant="caption">{fmtDate(getValue<string | null>())}</Typography> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Box display="flex" gap={0.5}>
          <Button size="small" onClick={() => { setEditTarget(row.original); setEditRole(row.original.role); setEditActive(row.original.isActive) }}>Editar</Button>
          {row.original.isActive && (
            <Button size="small" color="error" onClick={() => setDeactivateTarget(row.original)}>Desativar</Button>
          )}
        </Box>
      ),
    },
  ]

  const auditColumns: ColumnDef<AuditLog, unknown>[] = [
    { accessorKey: 'createdAt', header: 'Data', cell: ({ getValue }) => <Typography variant="caption">{fmtDate(getValue<string>())}</Typography> },
    { accessorKey: 'adminName', header: 'Admin' },
    { accessorKey: 'action', header: 'Ação', cell: ({ getValue }) => <Chip label={getValue<string>()} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} /> },
    { accessorKey: 'targetType', header: 'Entidade' },
    { accessorKey: 'targetId', header: 'ID alvo', cell: ({ getValue }) => <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{getValue<string>()}</Typography> },
    {
      accessorKey: 'details',
      header: 'Detalhes',
      cell: ({ getValue }) => {
        const v = getValue<string | null>()
        return v ? <Typography variant="caption" color="text.secondary">{v}</Typography> : null
      },
    },
  ]

  return (
    <Box>
      <PageHeader
        title="Equipe & Auditoria"
        action={
          <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setCreateOpen(true)}>
            Novo Membro
          </Button>
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Membros (${staff.length})`} />
        <Tab label="Log de Auditoria" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <DataTable data={staff} columns={staffColumns} loading={loading} totalPages={1} page={staffPage} onPageChange={setStaffPage} emptyMessage="Nenhum membro." />
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <DataTable data={audit} columns={auditColumns} loading={loading} totalPages={auditPages} page={auditPage} onPageChange={setAuditPage} emptyMessage="Nenhum log." />
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Novo Membro da Equipe</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Nome completo" fullWidth value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="E-mail corporativo" type="email" fullWidth value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select value={form.role} label="Role" onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <MenuItem value="SUPORTE">SUPORTE</MenuItem>
              <MenuItem value="FINANCEIRO">FINANCEIRO</MenuItem>
              <MenuItem value="OPERADOR">OPERADOR</MenuItem>
              <MenuItem value="ADMIN">ADMIN</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.name || !form.email || creating}>
            {creating ? <CircularProgress size={16} /> : 'Criar Membro'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Editar — {editTarget?.name}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select value={editRole} label="Role" onChange={(e) => setEditRole(e.target.value)}>
              <MenuItem value="SUPORTE">SUPORTE</MenuItem>
              <MenuItem value="FINANCEIRO">FINANCEIRO</MenuItem>
              <MenuItem value="OPERADOR">OPERADOR</MenuItem>
              <MenuItem value="ADMIN">ADMIN</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel control={<Switch checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />} label="Conta ativa" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEdit} disabled={saving}>
            {saving ? <CircularProgress size={16} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateTarget}
        title={`Desativar ${deactivateTarget?.name}?`}
        description="A conta será desativada e todas as sessões ativas serão invalidadas imediatamente."
        onConfirm={handleDeactivate}
        onClose={() => setDeactivateTarget(null)}
        confirmColor="error"
        confirmLabel="Desativar"
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
