import { useState } from 'react'
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../lib/admin-api'
import { useAdminAuth } from '../store/admin-auth.store'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const { setAuth } = useAdminAuth()
  const navigate = useNavigate()

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await adminApi.auth.requestOtp(email, password)
      setInfo('Código enviado para o seu e-mail. Válido por 10 minutos.')
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar código')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await adminApi.auth.verifyOtp(email, code)
      setAuth(res.admin, res.accessToken, res.mustChangePassword)
      if (res.mustChangePassword) {
        navigate('/change-password')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido')
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
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
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
            <Typography variant="h5" fontWeight={700}>Mega Chess</Typography>
            <Typography variant="body2" color="text.secondary">Admin Panel</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {info && !error && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}

          {step === 'email' ? (
            <Box component="form" onSubmit={handleRequestOtp} display="flex" flexDirection="column" gap={2}>
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <TextField
                label="Senha"
                type="password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : undefined}
              >
                Enviar código de acesso
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleVerifyOtp} display="flex" flexDirection="column" gap={2}>
              <TextField
                label="Código de 6 dígitos"
                fullWidth
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                inputProps={{ maxLength: 6, inputMode: 'numeric' }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading || code.length < 6}
                startIcon={loading ? <CircularProgress size={16} /> : undefined}
              >
                Entrar
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => { setStep('email'); setCode(''); setPassword(''); setError(''); setInfo(''); }}
              >
                Usar outro e-mail
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
