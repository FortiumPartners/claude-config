import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Organization, LoginRequest, LoginResponse } from '../types/api'
import { authApi } from '../services/api'
import { useAppDispatch } from '../store'
import { loginSuccess, loginFailure, setIsLoading, logout as logoutAction } from '../store/slices/authSlice'

interface AuthState {
  user: User | null
  organization: Organization | null
  isLoading: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch()
  const [state, setState] = useState<AuthState>({
    user: null,
    organization: null,
    isLoading: true,
    error: null,
  })

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const accessToken = localStorage.getItem('access_token')
        const refreshToken = localStorage.getItem('refresh_token')
        
        console.log('AuthContext initialization started:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken 
        })
        
        if (accessToken) {
          // Validate token by fetching user profile
          console.log('Validating stored access token...')
          const response = await authApi.getProfile()
          // Backend returns { success: true, data: { id, email, firstName, ... } }
          const userData = response.data.data
          
          console.log('Token validation successful:', { 
            userId: userData?.id, 
            userEmail: userData?.email,
            userRole: userData?.role
          })
          
          // Update Redux state first
          dispatch(loginSuccess({
            user: userData,
            organization: null, // Organization data not included in profile response
            accessToken,
            refreshToken: refreshToken || '',
          }))
          
          // Then update local state
          setState(prev => ({
            ...prev,
            user: userData,
            organization: null,
            isLoading: false,
          }))
          
          console.log('AuthContext initialization completed successfully')
        } else {
          console.log('No stored tokens found, user needs to login')
          setState(prev => ({ ...prev, isLoading: false }))
          dispatch(setIsLoading(false))
        }
      } catch (error) {
        console.error('Token validation failed during initialization:', error)
        // Token is invalid, clear it
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setState(prev => ({ ...prev, isLoading: false }))
        dispatch(loginFailure('Session expired. Please login again.'))
      }
    }

    initializeAuth()
  }, [])

  const login = async (credentials: LoginRequest): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    dispatch(setIsLoading(true))

    try {
      const response = await authApi.login(credentials)
      console.log('Login response:', response.data) // Debug log
      
      // The backend returns data in this structure:
      // { success: true, data: { user: {...}, tokens: { accessToken, refreshToken } } }
      const { data } = response.data
      const { user, tokens } = data
      const { accessToken, refreshToken } = tokens

      // Store tokens
      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('refresh_token', refreshToken)

      // Update local state
      setState(prev => ({
        ...prev,
        user,
        organization: user.organization || null, // Organization might be part of user object
        isLoading: false,
        error: null,
      }))
      
      // Update Redux state
      dispatch(loginSuccess({
        user,
        organization: user.organization || null,
        accessToken,
        refreshToken,
      }))
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.'
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      
      // Update Redux state with error
      dispatch(loginFailure(errorMessage))
      throw error
    }
  }

  const logout = () => {
    // Clear local state
    setState({
      user: null,
      organization: null,
      isLoading: false,
      error: null,
    })
    
    // Clear Redux state (this also clears localStorage)
    dispatch(logoutAction())

    // Optional: Call logout endpoint to invalidate token on server
    authApi.logout().catch(() => {
      // Ignore errors during logout
    })
  }

  const refreshToken = async (): Promise<void> => {
    const refresh_token = localStorage.getItem('refresh_token')
    if (!refresh_token) {
      logout()
      return
    }

    try {
      const response = await authApi.refreshToken(refresh_token)
      // Backend returns { success: true, data: { tokens: { accessToken, refreshToken } } }
      const { data } = response.data
      const { tokens } = data
      const { accessToken, refreshToken: newRefreshToken } = tokens

      localStorage.setItem('access_token', accessToken)
      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken)
      }
    } catch (error) {
      // Refresh failed, logout user
      logout()
      throw error
    }
  }

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }))
  }

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshToken,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}