import {
  Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Divider, Badge,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import BuildIcon from '@mui/icons-material/Build'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PersonIcon from '@mui/icons-material/Person'
import HistoryIcon from '@mui/icons-material/History'
import TrackChangesIcon from '@mui/icons-material/TrackChanges'
import BlockIcon from '@mui/icons-material/Block'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import GavelIcon from '@mui/icons-material/Gavel'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../store/admin-auth.store'
import type { AdminRole } from '../../types'

interface NavItem {
  label: string
  icon: React.ReactNode
  path: string
  requiredRole: AdminRole
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      icon: <DashboardIcon />,            path: '/dashboard',    requiredRole: 'SUPORTE' },
  { label: 'Usuários',       icon: <PeopleIcon />,               path: '/users',        requiredRole: 'SUPORTE' },
  { label: 'Transações',     icon: <AccountBalanceWalletIcon />, path: '/transactions', requiredRole: 'FINANCEIRO' },
  { label: 'Competições',    icon: <EmojiEventsIcon />,          path: '/tournaments',  requiredRole: 'OPERADOR' },
  { label: 'Suporte',        icon: <SupportAgentIcon />,         path: '/support',      requiredRole: 'SUPORTE' },
  { label: 'Manutenção',     icon: <BuildIcon />,                path: '/maintenance',  requiredRole: 'OPERADOR' },
  { label: 'Administradores',icon: <AdminPanelSettingsIcon />,   path: '/staff',        requiredRole: 'ADMIN' },
  { label: 'Audit Log',      icon: <HistoryIcon />,              path: '/audit-logs',        requiredRole: 'ADMIN' },
  { label: 'Atividade',     icon: <TrackChangesIcon />,         path: '/user-activity',     requiredRole: 'ADMIN' },
  { label: 'IP Blacklist',   icon: <BlockIcon />,                path: '/ip-blacklist',      requiredRole: 'ADMIN' },
  { label: 'Sugestões',      icon: <LightbulbIcon />,            path: '/suggestions',        requiredRole: 'OPERADOR' },
  { label: 'Indicações',     icon: <GroupAddIcon />,             path: '/referrals',          requiredRole: 'FINANCEIRO' },
  { label: 'Reports',        icon: <GavelIcon />,                path: '/reports',            requiredRole: 'SUPORTE' },
  { label: 'Meu Perfil',     icon: <PersonIcon />,               path: '/profile',      requiredRole: 'SUPORTE' },
]

const ROLE_LABELS: Record<AdminRole, string> = {
  SUPORTE: 'Suporte',
  FINANCEIRO: 'Financeiro',
  OPERADOR: 'Operador',
  ADMIN: 'Administrador',
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { admin, hasRole } = useAdminAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleNav = (path: string) => {
    navigate(path)
    onClose?.()
  }

  return (
    <Box display="flex" flexDirection="column" height="100%" py={2}>
      {/* Logo */}
      <Box px={2} mb={2} display="flex" alignItems="center" gap={1.5}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 2,
            background: 'linear-gradient(135deg, #3D4AEB 0%, #6C74F0 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 18, color: '#fff',
          }}
        >
          ♟
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>Mega Chess</Typography>
          <Typography variant="caption" color="text.secondary">Admin Panel</Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 1 }} />

      {/* Nav */}
      <List dense sx={{ flex: 1, px: 1 }}>
        {NAV_ITEMS.filter((item) => hasRole(item.requiredRole)).map((item) => {
          const active = location.pathname.startsWith(item.path)
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={active}
                onClick={() => handleNav(item.path)}
                sx={{ borderRadius: 2, mb: 0.25 }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: active ? 'primary.main' : 'text.secondary' }}>
                  {item.badge ? (
                    <Badge badgeContent={item.badge} color="error" max={99}>
                      {item.icon}
                    </Badge>
                  ) : item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'primary.main' : 'text.primary',
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      <Divider />

      {/* Admin info */}
      {admin && (
        <Box px={2} pt={2} display="flex" alignItems="center" gap={1.5}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}>
            {admin.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box overflow="hidden">
            <Typography variant="body2" fontWeight={600} noWrap>{admin.name}</Typography>
            <Typography variant="caption" color="text.secondary">{ROLE_LABELS[admin.role]}</Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}
