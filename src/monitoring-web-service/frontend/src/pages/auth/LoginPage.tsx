import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Monitor, Mail, Lock, Eye, EyeOff, Building2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { login, isLoading, error } = useAuth()
  const [formData, setFormData] = useState({
    email: 'demo@fortium.com',
    password: 'MySecurePass2025#'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [detectedTenant, setDetectedTenant] = useState<{ id: string; name: string; domain: string } | null>(null)

  // Extract tenant from domain on component mount
  useEffect(() => {
    const extractTenantFromDomain = () => {
      const hostname = window.location.hostname
      const parts = hostname.split('.')

      // If localhost or IP, use demo tenant for development
      if (hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        return {
          id: '9587a32b-3ee4-4c3f-b344-739a6485cb86',
          name: 'Fortium Partners (Demo)',
          domain: 'localhost'
        }
      }

      // Extract subdomain as tenant identifier
      if (parts.length > 2) {
        const subdomain = parts[0]
        return {
          id: subdomain, // In production, this would be resolved to actual tenant ID
          name: `${subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} Organization`,
          domain: hostname
        }
      }

      return null
    }

    const tenant = extractTenantFromDomain()
    setDetectedTenant(tenant)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!detectedTenant) {
      toast.error('No tenant detected. Please access via a tenant-specific domain.')
      return
    }

    try {
      await login({
        email: formData.email,
        password: formData.password,
        tenantId: detectedTenant.id
      })

      toast.success('Login successful! Redirecting...')
      // Explicitly navigate to dashboard after successful login
      navigate('/dashboard', { replace: true })
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please try again.')
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Monitor className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Fortium Metrics
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Sign in to your dashboard
        </p>
      </div>

      {/* Tenant Information Display */}
      {detectedTenant && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Signing in to
              </h3>
              <p className="text-lg font-semibold text-blue-700 dark:text-blue-200">
                {detectedTenant.name}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300">
                Domain: {detectedTenant.domain}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full pl-10 pr-12 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Demo credentials: demo@fortium.com / MySecurePass2025#
      </div>
    </div>
  )
}

export default LoginPage