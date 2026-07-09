import { useState } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button,
  Avatar, Chip, Alert, CircularProgress, Snackbar,
} from '@mui/material'
import LockResetIcon from '@mui/icons-material/LockReset'
import EmailIcon from '@mui/icons-material/Email'
import { PageHeader } from '../../components/ui/PageHeader'
import { adminApi } from '../../lib/admin-api'
import { useAdminAuth } from '../../store/admin-auth.store'

export function ProfilePage() {
  const { admin } = useAdminAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [snack, setSnack] = useState('')

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setSnack('As senhas não conferem.')
      return
    }
    setChangingPw(true)
    try {
      await adminApi.profile.changePassword(currentPassword, newPassword)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setSnack('Senha alterada com sucesso.')
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro ao alterar senha') }
    finally { setChangingPw(false) }
  }

  if (!admin) return null

  return (
    <Box>
      <PageHeader title="Meu Perfil" />

      <Grid container spacing={2}>
        {/* Profile card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <Avatar sx={{ width: 80, height: 80, fontSize: 32, bgcolor: 'primary.main', mb: 2 }}>
                {admin.name.charAt(0)}
              </Avatar>
              <Typography variant="h6" fontWeight={700}>{admin.name}</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>{admin.email}</Typography>
              <Chip
                label={admin.role}
                color={admin.role === 'ADMIN' ? 'error' : admin.role === 'OPERADOR' ? 'warning' : 'info'}
                size="small"
              />
              <Alert severity="info" icon={<EmailIcon fontSize="small" />} sx={{ mt: 2, width: '100%', fontSize: 12 }}>
                Login protegido por OTP via email
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <LockResetIcon color="primary" />
                <Typography variant="subtitle1">Alterar Senha</Typography>
              </Box>
              <Box display="flex" flexDirection="column" gap={2} maxWidth={400}>
                <TextField
                  label="Senha atual"
                  type="password"
                  fullWidth
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <TextField
                  label="Nova senha"
                  type="password"
                  fullWidth
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  helperText="Mínimo 12 caracteres"
                />
                <TextField
                  label="Confirmar nova senha"
                  type="password"
                  fullWidth
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={confirmPassword.length > 0 && newPassword !== confirmPassword}
                  helperText={confirmPassword.length > 0 && newPassword !== confirmPassword ? 'Senhas não conferem' : ''}
                />
                <Button
                  variant="contained"
                  onClick={changePassword}
                  disabled={!currentPassword || newPassword.length < 12 || newPassword !== confirmPassword || changingPw}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {changingPw ? <CircularProgress size={16} /> : 'Alterar Senha'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
