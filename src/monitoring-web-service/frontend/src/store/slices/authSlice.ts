import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { User, Organization } from '../../types/api'

interface AuthState {
  user: User | null
  organization: Organization | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  organization: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true, // Start with loading true for token validation
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true
      state.error = null
    },
    
    loginSuccess: (state, action: PayloadAction<{
      user: User
      organization: Organization
      accessToken: string
      refreshToken: string
    }>) => {
      state.user = action.payload.user
      state.organization = action.payload.organization
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.isAuthenticated = true
      state.isLoading = false
      state.error = null
      
      // Store tokens in localStorage
      localStorage.setItem('access_token', action.payload.accessToken)
      localStorage.setItem('refresh_token', action.payload.refreshToken)
    },
    
    loginFailure: (state, action: PayloadAction<string>) => {
      state.user = null
      state.organization = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.isLoading = false
      state.error = action.payload
      
      // Clear tokens from localStorage
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    },
    
    logout: (state) => {
      state.user = null
      state.organization = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.isLoading = false
      state.error = null
      
      // Clear tokens from localStorage
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    },
    
    refreshTokenSuccess: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload
      localStorage.setItem('access_token', action.payload)
      state.error = null
    },
    
    refreshTokenFailure: (state) => {
      state.user = null
      state.organization = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.isLoading = false
      state.error = 'Session expired. Please login again.'
      
      // Clear tokens from localStorage
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    },
    
    updateUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload
    },
    
    updateOrganization: (state, action: PayloadAction<Organization>) => {
      state.organization = action.payload
    },
    
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    
    clearError: (state) => {
      state.error = null
    },
  },
})

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  refreshTokenSuccess,
  refreshTokenFailure,
  updateUser,
  updateOrganization,
  setIsLoading,
  clearError,
} = authSlice.actions

export default authSlice.reducer