import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTenant } from '../../contexts/TenantContext'
import LoadingSpinner from '../ui/LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: string[]
  permissions?: string[]
  requireTenant?: boolean
  fallbackPath?: string
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  roles = [],
  permissions = [],
  requireTenant = false,
  fallbackPath = '/auth/login',
}) => {
  const { user, isLoading: authLoading } = useAuth()
  const { currentTenant, isLoadingTenants } = useTenant()
  const location = useLocation()

  // Show loading spinner while checking authentication
  if (authLoading || (requireTenant && isLoadingTenants)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
            Verifying access...
          </p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <Navigate 
        to={fallbackPath} 
        state={{ from: location.pathname }} 
        replace 
      />
    )
  }

  // Check role requirements
  if (roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5C2.962 17.333 3.924 19 5.464 19z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            You don't have permission to access this page. Required role: {roles.join(', ')}.
          </p>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Check tenant requirement
  if (requireTenant && !currentTenant) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m11 0a2 2 0 01-2 2H7a2 2 0 01-2-2m2-4h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v8m-4 0V9"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            No Tenant Access
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            You need to be associated with a tenant to access this page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    )
  }

  // TODO: Add permission checking with tenant context
  // if (permissions.length > 0) {
  //   const hasPermissions = permissions.every(permission => 
  //     hasPermission(permission, currentTenant?.id)
  //   )
  //   if (!hasPermissions) {
  //     return <AccessDenied />
  //   }
  // }

  return <>{children}</>
}

export default ProtectedRoute

// Additional utility components
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ProtectedRoute roles={['admin']}>{children}</ProtectedRoute>
}

export const RequireManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ProtectedRoute roles={['admin', 'manager']}>{children}</ProtectedRoute>
}

export const RequireTenant: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ProtectedRoute requireTenant={true}>{children}</ProtectedRoute>
}