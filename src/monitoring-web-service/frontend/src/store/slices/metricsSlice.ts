import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { 
  ProductivityMetric, 
  ProductivityTrend, 
  TeamComparison, 
  CommandExecution, 
  AgentInteraction,
  ProductivityMetricType 
} from '../../types/api'

interface MetricsState {
  // Current metrics data
  productivityMetrics: ProductivityMetric[]
  productivityTrends: ProductivityTrend[]
  teamComparisons: TeamComparison[]
  commandExecutions: CommandExecution[]
  agentInteractions: AgentInteraction[]
  
  // Real-time metrics
  realtimeMetrics: Record<string, any>
  lastUpdateTime: string | null
  
  // Filters and settings
  dateRange: {
    start: string
    end: string
    preset: 'today' | '7d' | '30d' | '90d' | 'custom'
  }
  selectedTeams: string[]
  selectedUsers: string[]
  selectedMetricTypes: ProductivityMetricType[]
  
  // UI state
  isLoading: boolean
  isLoadingRealtime: boolean
  error: string | null
  
  // Performance analytics
  performanceStats: {
    averageResponseTime: number
    errorRate: number
    throughput: number
    activeUsers: number
  }
}

const initialState: MetricsState = {
  productivityMetrics: [],
  productivityTrends: [],
  teamComparisons: [],
  commandExecutions: [],
  agentInteractions: [],
  realtimeMetrics: {},
  lastUpdateTime: null,
  dateRange: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    end: new Date().toISOString(),
    preset: '7d',
  },
  selectedTeams: [],
  selectedUsers: [],
  selectedMetricTypes: [],
  isLoading: false,
  isLoadingRealtime: false,
  error: null,
  performanceStats: {
    averageResponseTime: 0,
    errorRate: 0,
    throughput: 0,
    activeUsers: 0,
  },
}

const metricsSlice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    // Data setters
    setProductivityMetrics: (state, action: PayloadAction<ProductivityMetric[]>) => {
      state.productivityMetrics = action.payload
    },
    
    setProductivityTrends: (state, action: PayloadAction<ProductivityTrend[]>) => {
      state.productivityTrends = action.payload
    },
    
    setTeamComparisons: (state, action: PayloadAction<TeamComparison[]>) => {
      state.teamComparisons = action.payload
    },
    
    setCommandExecutions: (state, action: PayloadAction<CommandExecution[]>) => {
      state.commandExecutions = action.payload
    },
    
    setAgentInteractions: (state, action: PayloadAction<AgentInteraction[]>) => {
      state.agentInteractions = action.payload
    },

    // Real-time updates
    updateRealtimeMetric: (state, action: PayloadAction<{ key: string; value: any }>) => {
      state.realtimeMetrics[action.payload.key] = action.payload.value
      state.lastUpdateTime = new Date()
    },
    
    updateRealtimeMetrics: (state, action: PayloadAction<Record<string, any>>) => {
      state.realtimeMetrics = { ...state.realtimeMetrics, ...action.payload }
      state.lastUpdateTime = new Date()
    },
    
    addRealtimeCommandExecution: (state, action: PayloadAction<CommandExecution>) => {
      state.commandExecutions.unshift(action.payload)
      // Keep only last 100 real-time executions
      if (state.commandExecutions.length > 100) {
        state.commandExecutions = state.commandExecutions.slice(0, 100)
      }
    },
    
    addRealtimeAgentInteraction: (state, action: PayloadAction<AgentInteraction>) => {
      state.agentInteractions.unshift(action.payload)
      // Keep only last 100 real-time interactions
      if (state.agentInteractions.length > 100) {
        state.agentInteractions = state.agentInteractions.slice(0, 100)
      }
    },

    // Filter management
    setDateRange: (state, action: PayloadAction<{
      start: Date
      end: Date
      preset: 'today' | '7d' | '30d' | '90d' | 'custom'
    }>) => {
      state.dateRange = action.payload
    },
    
    setSelectedTeams: (state, action: PayloadAction<string[]>) => {
      state.selectedTeams = action.payload
    },
    
    setSelectedUsers: (state, action: PayloadAction<string[]>) => {
      state.selectedUsers = action.payload
    },
    
    setSelectedMetricTypes: (state, action: PayloadAction<ProductivityMetricType[]>) => {
      state.selectedMetricTypes = action.payload
    },

    // Performance stats
    updatePerformanceStats: (state, action: PayloadAction<{
      averageResponseTime?: number
      errorRate?: number
      throughput?: number
      activeUsers?: number
    }>) => {
      state.performanceStats = { ...state.performanceStats, ...action.payload }
    },

    // UI state
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    
    setIsLoadingRealtime: (state, action: PayloadAction<boolean>) => {
      state.isLoadingRealtime = action.payload
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    
    clearError: (state) => {
      state.error = null
    },
    
    // Real-time widget updates
    updateRealTimeMetrics: (state, action: PayloadAction<{
      widgetId: string
      data: any
      timestamp: Date | string
    }>) => {
      const { widgetId, data, timestamp } = action.payload
      state.realtimeMetrics[widgetId] = {
        ...state.realtimeMetrics[widgetId],
        data,
        lastUpdate: new Date(timestamp),
      }
      state.lastUpdateTime = new Date(timestamp)
    },

    updateDashboardData: (state, action: PayloadAction<any>) => {
      // Handle dashboard-wide updates
      state.realtimeMetrics.dashboard = action.payload
      state.lastUpdateTime = new Date()
    },

    // Utilities
    clearMetrics: (state) => {
      state.productivityMetrics = []
      state.productivityTrends = []
      state.teamComparisons = []
      state.commandExecutions = []
      state.agentInteractions = []
      state.realtimeMetrics = {}
      state.lastUpdateTime = null
    },
  },
})

export const {
  setProductivityMetrics,
  setProductivityTrends,
  setTeamComparisons,
  setCommandExecutions,
  setAgentInteractions,
  updateRealtimeMetric,
  updateRealtimeMetrics,
  addRealtimeCommandExecution,
  addRealtimeAgentInteraction,
  setDateRange,
  setSelectedTeams,
  setSelectedUsers,
  setSelectedMetricTypes,
  updatePerformanceStats,
  setIsLoading,
  setIsLoadingRealtime,
  setError,
  clearError,
  updateRealTimeMetrics,
  updateDashboardData,
  clearMetrics,
} = metricsSlice.actions

export default metricsSlice.reducer