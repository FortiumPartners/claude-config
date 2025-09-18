import React, { useState } from 'react'
import { Building2, Check, ChevronDown, Loader2, Plus, Settings } from 'lucide-react'
import { useTenant } from '../../contexts/TenantContext'
import { useAppSelector } from '../../store'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

interface TenantSwitcherProps {
  className?: string
  compact?: boolean
}

const TenantSwitcher: React.FC<TenantSwitcherProps> = ({ 
  className,
  compact = false 
}) => {
  const { user } = useAppSelector((state) => state.auth)
  const { 
    currentTenant, 
    tenants, 
    isLoadingTenants, 
    switchTenant,
    getCurrentRole,
  } = useTenant()
  
  const [isOpen, setIsOpen] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)

  const handleTenantSwitch = async (tenantId: string) => {
    if (tenantId === currentTenant?.id || switchingTo) return

    try {
      setSwitchingTo(tenantId)
      await switchTenant(tenantId)
      setIsOpen(false)
    } catch (error: any) {
      console.error('Failed to switch tenant:', error)
      toast.error(error.message || 'Failed to switch tenant')
    } finally {
      setSwitchingTo(null)
    }
  }

  const getCurrentTenantRole = (tenantId: string) => {
    const role = getCurrentRole(tenantId)
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member'
  }

  const getTenantInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  if (isLoadingTenants) {
    return (
      <div className={clsx('flex items-center space-x-2', className)}>
        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
        {!compact && (
          <div className="space-y-1">
            <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        )}
      </div>
    )
  }

  if (!currentTenant || tenants.length === 0) {
    return (
      <div className={clsx('flex items-center space-x-2 text-slate-500', className)}>
        <Building2 className="w-5 h-5" />
        {!compact && <span className="text-sm">No tenants available</span>}
      </div>
    )
  }

  return (
    <div className={clsx('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center space-x-2 p-2 rounded-lg transition-all duration-200',
          'hover:bg-slate-100 dark:hover:bg-slate-700',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          isOpen && 'bg-slate-100 dark:bg-slate-700'
        )}
        aria-label="Switch tenant"
        aria-expanded={isOpen}
      >
        {/* Tenant Logo/Avatar */}
        <div className="relative">
          {currentTenant.settings.branding.logo ? (
            <img
              src={currentTenant.settings.branding.logo}
              alt={`${currentTenant.name} logo`}
              className="w-8 h-8 rounded-lg object-cover"
            />
          ) : (
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium"
              style={{
                backgroundColor: currentTenant.settings.branding.primaryColor || '#3b82f6'
              }}
            >
              {getTenantInitials(currentTenant.name)}
            </div>
          )}
          
          {/* Role indicator */}
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center">
            <div className={clsx(
              'w-2 h-2 rounded-full',
              getCurrentRole(currentTenant.id) === 'owner' && 'bg-purple-500',
              getCurrentRole(currentTenant.id) === 'admin' && 'bg-blue-500',
              getCurrentRole(currentTenant.id) === 'member' && 'bg-green-500',
              getCurrentRole(currentTenant.id) === 'viewer' && 'bg-slate-400'
            )} />
          </div>
        </div>

        {/* Tenant Info */}
        {!compact && (
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {currentTenant.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {getCurrentTenantRole(currentTenant.id)}
            </p>
          </div>
        )}

        {/* Dropdown Indicator */}
        {tenants.length > 1 && (
          <ChevronDown className={clsx(
            'w-4 h-4 text-slate-400 transition-transform duration-200',
            isOpen && 'transform rotate-180'
          )} />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && tenants.length > 1 && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50">
            <div className="p-2">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-2">
                Switch Tenant
              </div>
              
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {tenants.map((tenant) => {
                  const isCurrentTenant = tenant.id === currentTenant.id
                  const isSwitching = switchingTo === tenant.id
                  const role = getCurrentTenantRole(tenant.id)

                  return (
                    <button
                      key={tenant.id}
                      onClick={() => handleTenantSwitch(tenant.id)}
                      disabled={isCurrentTenant || isSwitching}
                      className={clsx(
                        'w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-all duration-200',
                        isCurrentTenant
                          ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300',
                        isSwitching && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {/* Tenant Avatar */}
                      <div className="relative">
                        {tenant.settings.branding.logo ? (
                          <img
                            src={tenant.settings.branding.logo}
                            alt={`${tenant.name} logo`}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-medium"
                            style={{
                              backgroundColor: tenant.settings.branding.primaryColor || '#3b82f6'
                            }}
                          >
                            {getTenantInitials(tenant.name)}
                          </div>
                        )}
                        
                        {/* Role indicator */}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center">
                          <div className={clsx(
                            'w-2.5 h-2.5 rounded-full',
                            getCurrentRole(tenant.id) === 'owner' && 'bg-purple-500',
                            getCurrentRole(tenant.id) === 'admin' && 'bg-blue-500',
                            getCurrentRole(tenant.id) === 'member' && 'bg-green-500',
                            getCurrentRole(tenant.id) === 'viewer' && 'bg-slate-400'
                          )} />
                        </div>
                      </div>

                      {/* Tenant Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium truncate">
                            {tenant.name}
                          </p>
                          {tenant.subscription.plan !== 'free' && (
                            <span className={clsx(
                              'inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full',
                              tenant.subscription.plan === 'enterprise'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                            )}>
                              {tenant.subscription.plan}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          {role} • {tenant.domain}
                        </p>
                      </div>

                      {/* Status Indicators */}
                      <div className="flex items-center space-x-2">
                        {isSwitching && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        )}
                        {isCurrentTenant && (
                          <Check className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Action Buttons */}
              {getCurrentRole() === 'owner' || getCurrentRole() === 'admin' ? (
                <div className="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      // TODO: Open create tenant modal
                      toast.info('Create tenant feature coming soon')
                    }}
                    className="w-full flex items-center space-x-2 p-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Tenant</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      // TODO: Open tenant settings
                      toast.info('Tenant settings feature coming soon')
                    }}
                    className="w-full flex items-center space-x-2 p-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Manage Tenants</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TenantSwitcher