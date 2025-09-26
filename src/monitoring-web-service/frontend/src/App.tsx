import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

// Layout components (keep these non-lazy as they're always needed)
import DashboardLayout from './components/layout/DashboardLayout'
import AuthLayout from './components/layout/AuthLayout'
import LoadingSpinner from './components/ui/LoadingSpinner'

// Lazy load page components for better code splitting
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'))
const TeamsPage = lazy(() => import('./pages/teams/TeamsPage'))
const UsersPage = lazy(() => import('./pages/users/UsersPage'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))
const IntegrationPage = lazy(() => import('./pages/integration/IntegrationPage'))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'))

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
        <Route
          path="login"
          element={
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <LoginPage />
            </Suspense>
          }
        />
      </Route>

      {/* Protected routes */}
      {user ? (
        <Route path="/*" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="analytics"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" />}>
                <AnalyticsPage />
              </Suspense>
            }
          />
          <Route
            path="teams"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" />}>
                <TeamsPage />
              </Suspense>
            }
          />
          <Route
            path="users"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" />}>
                <UsersPage />
              </Suspense>
            }
          />
          <Route
            path="reports"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" />}>
                <ReportsPage />
              </Suspense>
            }
          />
          <Route
            path="integration"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" />}>
                <IntegrationPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      )}
    </Routes>
  )
}

export default App