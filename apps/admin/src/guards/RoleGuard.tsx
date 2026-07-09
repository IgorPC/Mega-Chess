import { Box, Typography, Button } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useNavigate } from 'react-router-dom'
import type { AdminRole } from '../types'
import { useAdminAuth } from '../store/admin-auth.store'

interface RoleGuardProps {
  required: AdminRole
  children: React.ReactNode
}

export function RoleGuard({ required, children }: RoleGuardProps) {
  const { hasRole } = useAdminAuth()
  const navigate = useNavigate()

  if (!hasRole(required)) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh" gap={2}>
        <LockOutlinedIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
        <Typography variant="h6" color="text.secondary">Acesso não autorizado</Typography>
        <Typography variant="body2" color="text.secondary">
          Você precisa da role <strong>{required}</strong> ou superior para acessar esta página.
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</Button>
      </Box>
    )
  }

  return <>{children}</>
}
