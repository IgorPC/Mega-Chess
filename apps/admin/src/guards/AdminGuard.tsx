import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../store/admin-auth.store'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { admin, accessToken } = useAdminAuth()
  const location = useLocation()

  if (!admin || !accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
