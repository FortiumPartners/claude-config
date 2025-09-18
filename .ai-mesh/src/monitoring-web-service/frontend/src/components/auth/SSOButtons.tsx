import React from 'react'
import { clsx } from 'clsx'

interface SSOProvider {
  id: string
  name: string
  icon: React.ReactNode
  color: string
  textColor: string
  borderColor: string
  enabled: boolean
}

interface SSOButtonsProps {
  onSSOLogin: (providerId: string) => void
  isLoading?: boolean
  disabled?: boolean
  className?: string
}

const SSOButtons: React.FC<SSOButtonsProps> = ({
  onSSOLogin,
  isLoading = false,
  disabled = false,
  className,
}) => {
  const providers: SSOProvider[] = [
    {
      id: 'google',
      name: 'Google',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      ),
      color: 'bg-white dark:bg-white',
      textColor: 'text-slate-700',
      borderColor: 'border-slate-300',
      enabled: true,
    },
    {
      id: 'microsoft',
      name: 'Microsoft',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#f25022" d="M1 1h10v10H1z" />
          <path fill="#00a4ef" d="M13 1h10v10H13z" />
          <path fill="#7fba00" d="M1 13h10v10H1z" />
          <path fill="#ffb900" d="M13 13h10v10H13z" />
        </svg>
      ),
      color: 'bg-white dark:bg-white',
      textColor: 'text-slate-700',
      borderColor: 'border-slate-300',
      enabled: true,
    },
    {
      id: 'azure-ad',
      name: 'Azure AD',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#0078d4"
            d="M12.53 2.85l8.6 15.72c.16.29-.04.64-.36.64H3.23c-.32 0-.52-.35-.36-.64L11.47 2.85c.16-.29.56-.29.72 0l.34.62z"
          />
          <path
            fill="#fff"
            d="M7.6 16.4h8.8l-3.3-6.4h-2.2L7.6 16.4zm4.4-8.8c.9 0 1.6-.7 1.6-1.6S12.9 4.4 12 4.4s-1.6.7-1.6 1.6.7 1.6 1.6 1.6z"
          />
        </svg>
      ),
      color: 'bg-[#0078d4]',
      textColor: 'text-white',
      borderColor: 'border-[#0078d4]',
      enabled: true,
    },
    {
      id: 'github',
      name: 'GitHub',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      ),
      color: 'bg-slate-900 dark:bg-slate-800',
      textColor: 'text-white',
      borderColor: 'border-slate-900 dark:border-slate-700',
      enabled: true,
    },
    {
      id: 'okta',
      name: 'Okta',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <circle fill="#0066cc" cx="12" cy="12" r="12" />
          <circle fill="#ffffff" cx="12" cy="12" r="6" />
          <circle fill="#0066cc" cx="12" cy="12" r="3" />
        </svg>
      ),
      color: 'bg-[#0066cc]',
      textColor: 'text-white',
      borderColor: 'border-[#0066cc]',
      enabled: true,
    },
    {
      id: 'saml',
      name: 'SAML SSO',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 9 5.16-.74 9-4.45 9-10V7l-10-5z" />
          <path fill="white" d="M12 7L6 10v4c0 2.78 1.92 4.87 5 4.5 2.58-.37 5-2.22 5-5V10l-6-3z" />
        </svg>
      ),
      color: 'bg-purple-600',
      textColor: 'text-white',
      borderColor: 'border-purple-600',
      enabled: true,
    },
  ]

  const enabledProviders = providers.filter(provider => provider.enabled)

  return (
    <div className={clsx('space-y-3', className)}>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-300 dark:border-slate-600" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Or continue with
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {enabledProviders.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => onSSOLogin(provider.id)}
            disabled={disabled || isLoading}
            className={clsx(
              'flex items-center justify-center px-4 py-3 border rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              provider.color,
              provider.textColor,
              provider.borderColor,
              'hover:shadow-md hover:scale-[1.02]',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span className="mr-3">{provider.icon}</span>
                <span className="text-sm font-medium">{provider.name}</span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* Enterprise SSO note */}
      <div className="text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Enterprise SSO available for Pro and Enterprise plans
        </p>
      </div>
    </div>
  )
}

export default SSOButtons