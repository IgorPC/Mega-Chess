import { useState } from 'react'
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../../lib/admin-api'
import { useAdminAuth } from '../../store/admin-auth.store'

export function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setAuth, admin, accessToken } = useAdminAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirm) { setError('As senhas não coincidem.'); return; }
    if (newPassword.length < 12) { setError('A senha deve ter ao menos 12 caracteres.'); return; }
    setLoading(true)
    try {
      await adminApi.auth.changePassword(newPassword)
      if (admin && accessToken) {
        setAuth({ ...admin, mustChangePassword: false } as any, accessToken, false)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgcolor="background.default"
      p={2}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
            <Box
              sx={{
                width: 52, height: 52, borderRadius: 3,
                background: 'linear-gradient(135deg, #3D4AEB 0%, #6C74F0 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, mb: 1.5,
              }}
            >
              ♟
            </Box>
            <Typography variant="h5" fontWeight={700}>Definir nova senha</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center" mt={0.5}>
              É necessário definir uma senha antes de continuar.
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Nova senha"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
              helperText="Mínimo 12 caracteres"
            />
            <TextField
              label="Confirmar senha"
              type="password"
              fullWidth
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading || !newPassword || !confirm}
              startIcon={loading ? <CircularProgress size={16} /> : undefined}
            >
              Salvar senha
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
