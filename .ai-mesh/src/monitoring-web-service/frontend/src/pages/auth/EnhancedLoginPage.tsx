import React, { useState, useEffect } from 'react'
import { Monitor, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, Shield } from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAppDispatch, useAppSelector } from '../../store'
import { loginSuccess, loginStart, loginFailure } from '../../store/slices/authSlice'
import SSOButtons from '../../components/auth/SSOButtons'
import { useCurrentTenant } from '../../contexts/TenantContext'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
})

type LoginFormData = z.infer<typeof loginSchema>

const EnhancedLoginPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const currentTenant = useCurrentTenant()
  const { isLoading, error } = useAppSelector((state) => state.auth)
  
  const [showPassword, setShowPassword] = useState(false)
  const [loginMethod, setLoginMethod] = useState<'email' | 'sso'>('email')

  // Get the intended destination after login
  const from = (location.state as any)?.from || '/dashboard'

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'demo@fortium.com',
      password: 'password123',
      rememberMe: false,
    },
  })

  const watchedEmail = watch('email')

  // Auto-fill demo credentials
  const fillDemoCredentials = () => {
    setValue('email', 'demo@fortium.com')
    setValue('password', 'password123')
    toast.success('Demo credentials filled')
  }

  // Handle form submission
  const onSubmit = async (data: LoginFormData) => {
    dispatch(loginStart())

    try {
      // Simulate API call with realistic delay
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Mock authentication logic
      if (data.email === 'demo@fortium.com' && data.password === 'password123') {
        const mockUser = {
          id: 'user-1',
          organization_id: 'org-1',
          email: data.email,
          first_name: 'Demo',
          last_name: 'User',
          role: 'admin' as const,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          avatar_url: null,
        }

        const mockOrganization = {
          id: 'org-1',
          name: 'Fortium Partners',
          slug: 'fortium-partners',
          settings: {},
          subscription_tier: 'enterprise' as const,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        }

        dispatch(loginSuccess({
          user: mockUser,
          organization: mockOrganization,
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        }))

        // Store remember me preference
        if (data.rememberMe) {
          localStorage.setItem('rememberMe', 'true')
        }

        toast.success('Welcome back!', {
          duration: 4000,
          icon: '👋',
        })

        // Navigate to intended destination
        navigate(from, { replace: true })
      } else {
        throw new Error('Invalid credentials')
      }
    } catch (error: any) {
      dispatch(loginFailure(error.message || 'Login failed'))
      toast.error('Invalid email or password', {
        duration: 5000,
      })
    }
  }

  // Handle SSO login
  const handleSSOLogin = async (providerId: string) => {
    dispatch(loginStart())
    
    try {
      // Simulate SSO flow
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock successful SSO login
      const mockUser = {
        id: `sso-user-${providerId}`,
        organization_id: 'org-1',
        email: `user@${providerId}.com`,
        first_name: 'SSO',
        last_name: 'User',
        role: 'member' as const,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        avatar_url: null,
      }

      const mockOrganization = {
        id: 'org-1',
        name: 'Fortium Partners',
        slug: 'fortium-partners',
        settings: {},
        subscription_tier: 'enterprise' as const,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      }

      dispatch(loginSuccess({
        user: mockUser,
        organization: mockOrganization,
        accessToken: `sso-access-token-${providerId}`,
        refreshToken: `sso-refresh-token-${providerId}`,
      }))

      toast.success(`Signed in with ${providerId}`, {
        duration: 4000,
        icon: '🔐',
      })

      navigate(from, { replace: true })
    } catch (error: any) {
      dispatch(loginFailure(`${providerId} login failed`))
      toast.error(`Failed to sign in with ${providerId}`)
    }
  }

  // Check for saved login preference
  useEffect(() => {
    const rememberMe = localStorage.getItem('rememberMe')
    if (rememberMe === 'true') {
      setValue('rememberMe', true)
    }
  }, [setValue])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Welcome back
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Sign in to your External Metrics Dashboard
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Security Badge */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Secure Authentication
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Enterprise-grade security with SSO support
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Method Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 mb-6">
              <button
                type="button"
                onClick={() => setLoginMethod('email')}
                className={clsx(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  loginMethod === 'email'
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Email & Password
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('sso')}
                className={clsx(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  loginMethod === 'sso'
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Single Sign-On
              </button>
            </div>

            {/* Email & Password Form */}
            {loginMethod === 'email' && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Global Error */}
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                    </div>
                  </div>
                )}

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      {...register('email')}
                      type="email"
                      autoComplete="email"
                      className={clsx(
                        'w-full pl-10 pr-4 py-3 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors',
                        errors.email
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-slate-300 dark:border-slate-600'
                      )}
                      placeholder="Enter your email"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className={clsx(
                        'w-full pl-10 pr-12 py-3 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors',
                        errors.password
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-slate-300 dark:border-slate-600'
                      )}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      {...register('rememberMe')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 rounded"
                    />
                    <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
                      Remember me
                    </span>
                  </label>
                  <Link
                    to="/auth/forgot-password"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-400 disabled:to-purple-400 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {(isSubmitting || isLoading) ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    'Sign In'
                  )}
                </button>

                {/* Demo Credentials Helper */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={fillDemoCredentials}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 underline transition-colors"
                  >
                    Use demo credentials
                  </button>
                </div>
              </form>
            )}

            {/* SSO Options */}
            {loginMethod === 'sso' && (
              <div>
                <SSOButtons
                  onSSOLogin={handleSSOLogin}
                  isLoading={isLoading}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Don't have an account?{' '}
            <Link
              to="/auth/signup"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium transition-colors"
            >
              Sign up for free
            </Link>
          </p>
          <div className="flex items-center justify-center space-x-4 text-xs text-slate-500 dark:text-slate-400">
            <Link to="/privacy" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              Privacy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              Terms
            </Link>
            <span>•</span>
            <Link to="/support" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhancedLoginPage