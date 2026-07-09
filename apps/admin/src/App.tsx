import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAdminAuth } from './store/admin-auth.store'
import { AdminGuard } from './guards/AdminGuard'
import { RoleGuard } from './guards/RoleGuard'
import { AdminLayout } from './components/layout/AdminLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { UsersListPage } from './pages/Users/UsersListPage'
import { UserDetailPage } from './pages/Users/UserDetailPage'
import { TransactionsPage } from './pages/Transactions/TransactionsPage'
import { TournamentsPage } from './pages/Tournaments/TournamentsPage'
import { TournamentDetailPage } from './pages/Tournaments/TournamentDetailPage'
import { DuelMatchDetailPage } from './pages/Tournaments/DuelMatchDetailPage'
import { TicketsListPage } from './pages/Support/TicketsListPage'
import { TicketDetailPage } from './pages/Support/TicketDetailPage'
import { MaintenancePage } from './pages/Maintenance/MaintenancePage'
import { StaffPage } from './pages/Staff/StaffPage'
import { AuditLogsPage } from './pages/AuditLogs/AuditLogsPage'
import { UserActivityPage } from './pages/UserActivity/UserActivityPage'
import { ProfilePage } from './pages/Profile/ProfilePage'
import { IpBlacklistPage } from './pages/IpBlacklist/IpBlacklistPage'
import { ChangePasswordPage } from './pages/ChangePassword/ChangePasswordPage'
import { SuggestionsAdminPage } from './pages/Suggestions/SuggestionsAdminPage'
import { ReferralsAdminPage } from './pages/Referrals/ReferralsAdminPage'
import { ReportsPage } from './pages/Reports/ReportsPage'

export function App() {
  const { logout } = useAdminAuth()
  const [kicked, setKicked] = useState(false)

  useEffect(() => {
    const onLogout = () => { setKicked(true); }
    window.addEventListener('admin:logout', onLogout)
    return () => window.removeEventListener('admin:logout', onLogout)
  }, [logout])

  if (kicked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#0f1117', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>📱</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: '#f44336' }}>
          Sessão encerrada
        </h1>
        <p style={{ fontSize: 14, color: '#888', maxWidth: 400, lineHeight: 1.6 }}>
          Sua conta foi acessada em outro dispositivo ou sua sessão expirou.
        </p>
        <button
          onClick={() => { setKicked(false); window.location.href = '/login'; }}
          style={{
            marginTop: 24, padding: '10px 24px', borderRadius: 8,
            background: '#3D4AEB', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          Fazer login novamente
        </button>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      <Route
        path="/"
        element={
          <AdminGuard>
            <AdminLayout />
          </AdminGuard>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        <Route path="users" element={<UsersListPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />

        <Route
          path="transactions"
          element={
            <RoleGuard required="FINANCEIRO">
              <TransactionsPage />
            </RoleGuard>
          }
        />

        <Route path="tournaments" element={<TournamentsPage />} />
        <Route path="tournaments/matches/:tmId" element={<DuelMatchDetailPage />} />
        <Route path="tournaments/:id" element={<TournamentDetailPage />} />

        <Route path="support" element={<TicketsListPage />} />
        <Route path="support/:id" element={<TicketDetailPage />} />

        <Route
          path="maintenance"
          element={
            <RoleGuard required="OPERADOR">
              <MaintenancePage />
            </RoleGuard>
          }
        />

        <Route
          path="staff"
          element={
            <RoleGuard required="ADMIN">
              <StaffPage />
            </RoleGuard>
          }
        />

        <Route
          path="audit-logs"
          element={
            <RoleGuard required="ADMIN">
              <AuditLogsPage />
            </RoleGuard>
          }
        />

        <Route
          path="user-activity"
          element={
            <RoleGuard required="ADMIN">
              <UserActivityPage />
            </RoleGuard>
          }
        />

        <Route
          path="ip-blacklist"
          element={
            <RoleGuard required="ADMIN">
              <IpBlacklistPage />
            </RoleGuard>
          }
        />

        <Route
          path="suggestions"
          element={
            <RoleGuard required="OPERADOR">
              <SuggestionsAdminPage />
            </RoleGuard>
          }
        />

        <Route
          path="referrals"
          element={
            <RoleGuard required="FINANCEIRO">
              <ReferralsAdminPage />
            </RoleGuard>
          }
        />

        <Route path="reports" element={<ReportsPage />} />

        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
