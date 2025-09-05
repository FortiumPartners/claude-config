import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { DashboardConfig, DashboardWidget } from '../../types/api'
import { Layout } from 'react-grid-layout'

interface DashboardState {
  currentDashboard: DashboardConfig | null
  dashboards: DashboardConfig[]
  isLoading: boolean
  error: string | null
  layout: Layout[]
  isEditing: boolean
  isDragEnabled: boolean
  selectedWidget: string | null
}

const initialState: DashboardState = {
  currentDashboard: null,
  dashboards: [],
  isLoading: false,
  error: null,
  layout: [],
  isEditing: false,
  isDragEnabled: true,
  selectedWidget: null,
}

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    // Dashboard management
    setCurrentDashboard: (state, action: PayloadAction<DashboardConfig>) => {
      state.currentDashboard = action.payload
      state.layout = action.payload.layout.map(widget => ({
        i: widget.id,
        x: widget.position.x,
        y: widget.position.y,
        w: widget.position.w,
        h: widget.position.h,
        minW: 2,
        minH: 2,
        maxW: 12,
        maxH: 12,
      }))
    },
    
    setDashboards: (state, action: PayloadAction<DashboardConfig[]>) => {
      state.dashboards = action.payload
    },
    
    addDashboard: (state, action: PayloadAction<DashboardConfig>) => {
      state.dashboards.push(action.payload)
    },
    
    updateDashboard: (state, action: PayloadAction<DashboardConfig>) => {
      const index = state.dashboards.findIndex(d => d.id === action.payload.id)
      if (index !== -1) {
        state.dashboards[index] = action.payload
      }
      if (state.currentDashboard?.id === action.payload.id) {
        state.currentDashboard = action.payload
      }
    },
    
    deleteDashboard: (state, action: PayloadAction<string>) => {
      state.dashboards = state.dashboards.filter(d => d.id !== action.payload)
      if (state.currentDashboard?.id === action.payload) {
        state.currentDashboard = null
      }
    },

    // Widget management
    addWidget: (state, action: PayloadAction<DashboardWidget>) => {
      if (state.currentDashboard) {
        state.currentDashboard.layout.push(action.payload)
        state.layout.push({
          i: action.payload.id,
          x: action.payload.position.x,
          y: action.payload.position.y,
          w: action.payload.position.w,
          h: action.payload.position.h,
          minW: 2,
          minH: 2,
          maxW: 12,
          maxH: 12,
        })
      }
    },
    
    updateWidget: (state, action: PayloadAction<DashboardWidget>) => {
      if (state.currentDashboard) {
        const index = state.currentDashboard.layout.findIndex(w => w.id === action.payload.id)
        if (index !== -1) {
          state.currentDashboard.layout[index] = action.payload
        }
        
        // Update layout
        const layoutIndex = state.layout.findIndex(l => l.i === action.payload.id)
        if (layoutIndex !== -1) {
          state.layout[layoutIndex] = {
            ...state.layout[layoutIndex],
            x: action.payload.position.x,
            y: action.payload.position.y,
            w: action.payload.position.w,
            h: action.payload.position.h,
          }
        }
      }
    },
    
    removeWidget: (state, action: PayloadAction<string>) => {
      if (state.currentDashboard) {
        state.currentDashboard.layout = state.currentDashboard.layout.filter(w => w.id !== action.payload)
        state.layout = state.layout.filter(l => l.i !== action.payload)
      }
      if (state.selectedWidget === action.payload) {
        state.selectedWidget = null
      }
    },
    
    selectWidget: (state, action: PayloadAction<string | null>) => {
      state.selectedWidget = action.payload
    },

    // Layout management
    updateLayout: (state, action: PayloadAction<Layout[]>) => {
      state.layout = action.payload
      
      // Update widget positions
      if (state.currentDashboard) {
        state.currentDashboard.layout = state.currentDashboard.layout.map(widget => {
          const layoutItem = action.payload.find(l => l.i === widget.id)
          if (layoutItem) {
            return {
              ...widget,
              position: {
                x: layoutItem.x,
                y: layoutItem.y,
                w: layoutItem.w,
                h: layoutItem.h,
              }
            }
          }
          return widget
        })
      }
    },

    // UI state
    setIsEditing: (state, action: PayloadAction<boolean>) => {
      state.isEditing = action.payload
      state.isDragEnabled = action.payload
    },
    
    setIsDragEnabled: (state, action: PayloadAction<boolean>) => {
      state.isDragEnabled = action.payload
    },
    
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    
    clearError: (state) => {
      state.error = null
    },
  },
})

export const {
  setCurrentDashboard,
  setDashboards,
  addDashboard,
  updateDashboard,
  deleteDashboard,
  addWidget,
  updateWidget,
  removeWidget,
  selectWidget,
  updateLayout,
  setIsEditing,
  setIsDragEnabled,
  setIsLoading,
  setError,
  clearError,
} = dashboardSlice.actions

export default dashboardSlice.reducer