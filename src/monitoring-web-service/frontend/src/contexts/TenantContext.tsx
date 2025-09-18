import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAppDispatch, useAppSelector } from '../store'
import { setCurrentTenant, setTenants } from '../store/slices/authSlice'
import api from '../services/api'
import toast from 'react-hot-toast'

// Tenant interfaces
export interface Tenant {
  id: string
  name: string
  domain: string
  settings: TenantSettings
  subscription: TenantSubscription
  createdAt: string
  updatedAt: string
}

export interface TenantSettings {
  timezone: string
  dateFormat: string
  currency: string
  features: {
    analytics: boolean
    reports: boolean
    integrations: boolean
    api: boolean
    sso: boolean
    customBranding: boolean
  }
  limits: {
    users: number
    projects: number
    storage: number // in GB
    apiRequests: number // per month
  }
  branding: {
    logo?: string
    primaryColor: string
    secondaryColor: string
    companyName: string
  }
}

export interface TenantSubscription {
  plan: 'free' | 'pro' | 'enterprise'
  status: 'active' | 'past_due' | 'canceled' | 'trialing'
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEnd?: string
}

export interface UserTenantRole {
  tenantId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  permissions: string[]
}

// Context interfaces
interface TenantContextValue {
  currentTenant: Tenant | null
  tenants: Tenant[]
  userRoles: UserTenantRole[]
  isLoadingTenants: boolean
  error: string | null
  switchTenant: (tenantId: string) => Promise<void>
  refreshTenants: () => Promise<void>
  updateTenantSettings: (tenantId: string, settings: Partial<TenantSettings>) => Promise<void>
  hasPermission: (permission: string, tenantId?: string) => boolean
  canAccessFeature: (feature: keyof TenantSettings['features'], tenantId?: string) => boolean
  getCurrentRole: (tenantId?: string) => string | null
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined)

interface TenantProviderProps {
  children: ReactNode
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const dispatch = useAppDispatch()
  const { currentTenant, tenants } = useAppSelector((state) => state.auth)
  
  const [userRoles, setUserRoles] = useState<UserTenantRole[]>([])
  const [isLoadingTenants, setIsLoadingTenants] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load tenants and user roles when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      loadTenants()
      loadUserRoles()
    }
  }, [isAuthenticated, user])

  // Load current tenant from localStorage on mount
  useEffect(() => {
    const savedTenantId = localStorage.getItem('currentTenantId')
    if (savedTenantId && tenants.length > 0) {
      const tenant = tenants.find(t => t.id === savedTenantId)
      if (tenant && tenant !== currentTenant) {
        dispatch(setCurrentTenant(tenant))
      }
    } else if (tenants.length > 0 && !currentTenant) {
      // Set first tenant as default if none selected
      dispatch(setCurrentTenant(tenants[0]))
      localStorage.setItem('currentTenantId', tenants[0].id)
    }
  }, [tenants, currentTenant, dispatch])

  const loadTenants = async () => {
    try {
      setIsLoadingTenants(true)
      setError(null)
      
      const response = await api.get('/api/v1/tenants')
      const tenantsData = response.data.tenants || []
      
      dispatch(setTenants(tenantsData))
      
      // If no current tenant and we have tenants, set the first one
      if (!currentTenant && tenantsData.length > 0) {
        dispatch(setCurrentTenant(tenantsData[0]))
        localStorage.setItem('currentTenantId', tenantsData[0].id)
      }
    } catch (error: any) {
      console.error('Failed to load tenants:', error)
      setError('Failed to load tenants')
      toast.error('Failed to load tenants')
    } finally {
      setIsLoadingTenants(false)
    }
  }

  const loadUserRoles = async () => {
    try {
      const response = await api.get('/api/v1/user/roles')
      setUserRoles(response.data.roles || [])
    } catch (error: any) {
      console.error('Failed to load user roles:', error)
    }
  }

  const switchTenant = async (tenantId: string) => {
    try {
      const tenant = tenants.find(t => t.id === tenantId)
      if (!tenant) {
        throw new Error('Tenant not found')
      }

      // Check if user has access to this tenant
      const hasAccess = userRoles.some(role => role.tenantId === tenantId)
      if (!hasAccess) {
        throw new Error('Access denied to this tenant')
      }

      dispatch(setCurrentTenant(tenant))
      localStorage.setItem('currentTenantId', tenantId)
      
      toast.success(`Switched to ${tenant.name}`)
    } catch (error: any) {
      console.error('Failed to switch tenant:', error)
      toast.error(error.message || 'Failed to switch tenant')
      throw error
    }
  }

  const refreshTenants = async () => {
    await loadTenants()
    await loadUserRoles()
  }

  const updateTenantSettings = async (tenantId: string, settings: Partial<TenantSettings>) => {
    try {
      const response = await api.patch(`/api/v1/tenants/${tenantId}/settings`, settings)
      
      // Update tenant in store
      const updatedTenant = response.data.tenant
      const updatedTenants = tenants.map(t => 
        t.id === tenantId ? { ...t, settings: updatedTenant.settings } : t
      )
      
      dispatch(setTenants(updatedTenants))
      
      // Update current tenant if it's the one being updated
      if (currentTenant?.id === tenantId) {
        dispatch(setCurrentTenant(updatedTenant))
      }
      
      toast.success('Tenant settings updated successfully')
    } catch (error: any) {
      console.error('Failed to update tenant settings:', error)
      toast.error('Failed to update tenant settings')
      throw error
    }
  }

  const hasPermission = (permission: string, tenantId?: string): boolean => {
    const targetTenantId = tenantId || currentTenant?.id
    if (!targetTenantId) return false

    const role = userRoles.find(r => r.tenantId === targetTenantId)
    return role?.permissions.includes(permission) || false
  }

  const canAccessFeature = (feature: keyof TenantSettings['features'], tenantId?: string): boolean => {
    const targetTenant = tenantId 
      ? tenants.find(t => t.id === tenantId)
      : currentTenant
    
    if (!targetTenant) return false
    
    // Check if feature is enabled for the tenant
    const featureEnabled = targetTenant.settings.features[feature]
    
    // Check if user has permission to access the feature
    const hasFeaturePermission = hasPermission(`access:${feature}`, targetTenant.id)
    
    return featureEnabled && hasFeaturePermission
  }

  const getCurrentRole = (tenantId?: string): string | null => {
    const targetTenantId = tenantId || currentTenant?.id
    if (!targetTenantId) return null

    const role = userRoles.find(r => r.tenantId === targetTenantId)
    return role?.role || null
  }

  const contextValue: TenantContextValue = {
    currentTenant,
    tenants,
    userRoles,
    isLoadingTenants,
    error,
    switchTenant,
    refreshTenants,
    updateTenantSettings,
    hasPermission,
    canAccessFeature,
    getCurrentRole,
  }

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  )
}

// Custom hook to use tenant context
export const useTenant = (): TenantContextValue => {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}

// Helper hooks
export const useCurrentTenant = (): Tenant | null => {
  const { currentTenant } = useTenant()
  return currentTenant
}

export const useTenantPermissions = (tenantId?: string) => {
  const { hasPermission, canAccessFeature, getCurrentRole } = useTenant()
  
  return {
    hasPermission: (permission: string) => hasPermission(permission, tenantId),
    canAccessFeature: (feature: keyof TenantSettings['features']) => canAccessFeature(feature, tenantId),
    getCurrentRole: () => getCurrentRole(tenantId),
  }
}

export const useTenantSettings = (tenantId?: string): TenantSettings | null => {
  const { currentTenant, tenants } = useTenant()
  
  const targetTenant = tenantId 
    ? tenants.find(t => t.id === tenantId)
    : currentTenant
  
  return targetTenant?.settings || null
}