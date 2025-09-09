import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Organization, LoginRequest, LoginResponse } from '../types/api'
import { authApi } from '../services/api'

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
        const token = localStorage.getItem('access_token')
        if (token) {
          // Validate token by fetching user profile
          const response = await authApi.getProfile()
          setState(prev => ({
            ...prev,
            user: response.data.user,
            organization: response.data.organization,
            isLoading: false,
          }))
        } else {
          setState(prev => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        // Token is invalid, clear it
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }

    initializeAuth()
  }, [])

  const login = async (credentials: LoginRequest): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

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

      setState(prev => ({
        ...prev,
        user,
        organization: user.organization || null, // Organization might be part of user object
        isLoading: false,
        error: null,
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.message || 'Login failed. Please try again.',
      }))
      throw error
    }
  }

  const logout = () => {
    // Clear tokens and state
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    
    setState({
      user: null,
      organization: null,
      isLoading: false,
      error: null,
    })

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