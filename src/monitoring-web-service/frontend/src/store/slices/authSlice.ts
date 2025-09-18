import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { User, Organization } from '../../types/api'
import { Tenant } from '../../contexts/TenantContext'

interface AuthState {
  user: User | null
  organization: Organization | null
  currentTenant: Tenant | null
  tenants: Tenant[]
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  organization: null,
  currentTenant: null,
  tenants: [],
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
      state.currentTenant = null
      state.tenants = []
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.isLoading = false
      state.error = null
      
      // Clear tokens and tenant data from localStorage
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('currentTenantId')
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
    
    // Tenant-related actions
    setCurrentTenant: (state, action: PayloadAction<Tenant>) => {
      state.currentTenant = action.payload
    },
    
    setTenants: (state, action: PayloadAction<Tenant[]>) => {
      state.tenants = action.payload
    },
    
    updateTenant: (state, action: PayloadAction<Tenant>) => {
      const index = state.tenants.findIndex(t => t.id === action.payload.id)
      if (index !== -1) {
        state.tenants[index] = action.payload
      }
      // Update current tenant if it's the one being updated
      if (state.currentTenant?.id === action.payload.id) {
        state.currentTenant = action.payload
      }
    },
    
    addTenant: (state, action: PayloadAction<Tenant>) => {
      state.tenants.push(action.payload)
    },
    
    removeTenant: (state, action: PayloadAction<string>) => {
      state.tenants = state.tenants.filter(t => t.id !== action.payload)
      // Clear current tenant if it's the one being removed
      if (state.currentTenant?.id === action.payload) {
        state.currentTenant = state.tenants.length > 0 ? state.tenants[0] : null
      }
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
  setCurrentTenant,
  setTenants,
  updateTenant,
  addTenant,
  removeTenant,
} = authSlice.actions

export default authSlice.reducer