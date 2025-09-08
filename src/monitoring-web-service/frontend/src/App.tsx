import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

// Layout components
import DashboardLayout from './components/layout/DashboardLayout'
import AuthLayout from './components/layout/AuthLayout'

// Page components
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import TeamsPage from './pages/teams/TeamsPage'
import UsersPage from './pages/users/UsersPage'
import SettingsPage from './pages/settings/SettingsPage'
import IntegrationPage from './pages/integration/IntegrationPage'
import ReportsPage from './pages/reports/ReportsPage'
import LoadingSpinner from './components/ui/LoadingSpinner'

const App: React.FC = () => {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth/*" element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
      </Route>

      {/* Protected routes */}
      {user ? (
        <Route path="/*" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="integration" element={<IntegrationPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      )}
    </Routes>
  )
}

export default App