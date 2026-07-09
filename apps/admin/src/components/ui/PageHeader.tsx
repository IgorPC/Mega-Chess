import { Box, Typography, Breadcrumbs, Link } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

interface Crumb { label: string; to?: string }

interface PageHeaderProps {
  title: string
  crumbs?: Crumb[]
  action?: React.ReactNode
}

export function PageHeader({ title, crumbs, action }: PageHeaderProps) {
  return (
    <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={3}>
      <Box>
        {crumbs && crumbs.length > 0 && (
          <Breadcrumbs sx={{ mb: 0.5 }}>
            {crumbs.map((c, i) =>
              c.to ? (
                <Link key={i} component={RouterLink} to={c.to} color="text.secondary" underline="hover" variant="body2">
                  {c.label}
                </Link>
              ) : (
                <Typography key={i} variant="body2" color="text.secondary">{c.label}</Typography>
              )
            )}
          </Breadcrumbs>
        )}
        <Typography variant="h5">{title}</Typography>
      </Box>
      {action && <Box>{action}</Box>}
    </Box>
  )
}
