import { Card, CardContent, Box, Typography, Skeleton } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'

interface KpiCardProps {
  title: string
  value: string | number
  icon: SvgIconComponent
  color?: string
  loading?: boolean
  subtitle?: string
}

export function KpiCard({ title, value, icon: Icon, color = '#3D4AEB', loading, subtitle }: KpiCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
              {title}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={80} height={40} />
            ) : (
              <Typography variant="h4" fontWeight={700} mt={0.5} lineHeight={1}>
                {value}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 44, height: 44, borderRadius: 2,
              backgroundColor: `${color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon sx={{ color, fontSize: 22 }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
