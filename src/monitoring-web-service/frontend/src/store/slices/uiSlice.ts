import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface NotificationItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  timestamp: Date
}

interface UIState {
  // Sidebar
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  
  // Theme
  theme: 'light' | 'dark' | 'system'
  
  // Notifications
  notifications: NotificationItem[]
  
  // Modals
  modals: {
    addWidget: boolean
    editWidget: boolean
    dashboardSettings: boolean
    userProfile: boolean
    exportReport: boolean
  }
  
  // Loading states
  globalLoading: boolean
  
  // Search
  globalSearch: string
  
  // Layout preferences
  compactMode: boolean
  animationsEnabled: boolean
  
  // Connection status
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
  
  // Screen size
  screenSize: 'mobile' | 'tablet' | 'desktop'
}

const initialState: UIState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  theme: 'system',
  notifications: [],
  modals: {
    addWidget: false,
    editWidget: false,
    dashboardSettings: false,
    userProfile: false,
    exportReport: false,
  },
  globalLoading: false,
  globalSearch: '',
  compactMode: false,
  animationsEnabled: true,
  connectionStatus: 'disconnected',
  screenSize: 'desktop',
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Sidebar
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload
    },

    // Theme
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload
    },

    // Notifications
    addNotification: (state, action: PayloadAction<Omit<NotificationItem, 'id' | 'timestamp'>>) => {
      const notification: NotificationItem = {
        ...action.payload,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
      }
      state.notifications.push(notification)
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload)
    },
    
    clearNotifications: (state) => {
      state.notifications = []
    },

    // Modals
    openModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = true
    },
    
    closeModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = false
    },
    
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach(key => {
        state.modals[key as keyof UIState['modals']] = false
      })
    },

    // Loading
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload
    },

    // Search
    setGlobalSearch: (state, action: PayloadAction<string>) => {
      state.globalSearch = action.payload
    },

    // Layout preferences
    setCompactMode: (state, action: PayloadAction<boolean>) => {
      state.compactMode = action.payload
    },
    
    setAnimationsEnabled: (state, action: PayloadAction<boolean>) => {
      state.animationsEnabled = action.payload
    },

    // Connection status
    setConnectionStatus: (state, action: PayloadAction<'connected' | 'disconnected' | 'connecting' | 'error'>) => {
      state.connectionStatus = action.payload
    },

    // Screen size
    setScreenSize: (state, action: PayloadAction<'mobile' | 'tablet' | 'desktop'>) => {
      state.screenSize = action.payload
      
      // Auto-collapse sidebar on mobile
      if (action.payload === 'mobile') {
        state.sidebarOpen = false
      } else if (action.payload === 'tablet') {
        state.sidebarCollapsed = true
      } else {
        state.sidebarCollapsed = false
      }
    },
  },
})

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  setTheme,
  addNotification,
  removeNotification,
  clearNotifications,
  openModal,
  closeModal,
  closeAllModals,
  setGlobalLoading,
  setGlobalSearch,
  setCompactMode,
  setAnimationsEnabled,
  setConnectionStatus,
  setScreenSize,
} = uiSlice.actions

export default uiSlice.reducer