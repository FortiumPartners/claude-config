import axios, { AxiosInstance, AxiosResponse } from 'axios'
import {
  LoginRequest,
  LoginResponse,
  ApiResponse,
  PaginatedResponse,
  User,
  Organization,
  Team,
  TeamMember,
  MetricsQueryParams,
  CommandExecution,
  AgentInteraction,
  UserSession,
  ProductivityMetric,
  ProductivityTrend,
  TeamComparison,
  DashboardConfig,
  Alert,
  ReportExportRequest,
  ReportExportResponse,
  ActivityItem,
  ActivityFilter,
  ActivityGroup,
} from '../types/api'

class ApiService {
  private client: AxiosInstance

  constructor() {
    // Create base URL that preserves the current domain for tenant extraction
    const getBaseURL = () => {
      // If VITE_API_URL is explicitly set, use it
      if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
      }

      // Otherwise, construct URL using current domain to preserve tenant info
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = '3001'; // Backend port

      return `${protocol}//${hostname}:${port}/api/v1`;
    };

    this.client = axios.create({
      baseURL: getBaseURL(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token and tenant ID
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // Add tenant ID header - required by the backend
        // Get tenant ID from localStorage or URL subdomain
        const tenantId = localStorage.getItem('currentTenantId') || this.extractTenantFromDomain()
        if (tenantId) {
          config.headers['X-Tenant-ID'] = tenantId
        }

        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            const refreshToken = localStorage.getItem('refresh_token')
            if (refreshToken) {
              const response = await this.client.post('/auth/refresh', {
                refreshToken: refreshToken, // Backend expects camelCase
              })
              
              // Backend returns { success: true, data: { tokens: { accessToken, refreshToken } } }
              const { data } = response.data
              const { tokens } = data
              const { accessToken, refreshToken: newRefreshToken } = tokens
              
              localStorage.setItem('access_token', accessToken)
              
              if (newRefreshToken) {
                localStorage.setItem('refresh_token', newRefreshToken)
              }

              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${accessToken}`
              return this.client(originalRequest)
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            window.location.href = '/auth/login'
          }
        }

        return Promise.reject(error)
      }
    )
  }

  // Extract tenant ID from subdomain (e.g., tenant1.example.com -> tenant1)
  private extractTenantFromDomain(): string | null {
    const hostname = window.location.hostname
    const parts = hostname.split('.')

    // If localhost or IP, return demo tenant for development
    if (hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return '12345678-1234-4567-8901-123456789012' // Demo tenant for development
    }

    // Extract subdomain as tenant identifier
    if (parts.length > 2) {
      return parts[0] // Return subdomain as tenant identifier
    }

    return null
  }

  // Auth endpoints
  auth = {
    login: async (credentials: LoginRequest): Promise<AxiosResponse<LoginResponse>> => {
      // Extract tenant from email domain
      const emailDomain = credentials.email.split('@')[1];
      const tenantDomain = emailDomain.split('.')[0]; // e.g., fortium.com -> fortium

      // Set tenant ID based on email domain for this request
      const originalTenantId = localStorage.getItem('currentTenantId');

      // Map domains to tenant IDs (this should ideally come from backend)
      const domainToTenantMap: Record<string, string> = {
        'fortium': '5986f72b-f8eb-48d3-bb65-ec5e61cdd14b',
        'localhost': 'ebbb0e7b-1961-47fd-943d-4c3c5f9c1665',
        'example': 'ebbb0e7b-1961-47fd-943d-4c3c5f9c1665'
      };

      const tenantId = domainToTenantMap[tenantDomain];
      if (tenantId) {
        localStorage.setItem('currentTenantId', tenantId);
      }

      try {
        const response = await this.client.post('/auth/login', credentials);
        return response;
      } finally {
        // Restore original tenant ID if login fails
        if (originalTenantId) {
          localStorage.setItem('currentTenantId', originalTenantId);
        } else {
          localStorage.removeItem('currentTenantId');
        }
      }
    },

    logout: async (): Promise<AxiosResponse<void>> => {
      return this.client.post('/auth/logout')
    },

    refreshToken: async (refreshToken: string): Promise<AxiosResponse<any>> => {
      return this.client.post('/auth/refresh', { refreshToken: refreshToken }) // Backend expects camelCase
    },

    getProfile: async (): Promise<AxiosResponse<{ user: User; organization: Organization }>> => {
      return this.client.get('/auth/profile')
    },
  }

  // User management endpoints
  users = {
    list: async (params?: {
      role?: string
      team_id?: string
      page?: number
      limit?: number
    }): Promise<AxiosResponse<PaginatedResponse<User>>> => {
      return this.client.get('/users', { params })
    },

    get: async (userId: string): Promise<AxiosResponse<ApiResponse<User>>> => {
      return this.client.get(`/users/${userId}`)
    },

    create: async (userData: Partial<User>): Promise<AxiosResponse<ApiResponse<User>>> => {
      return this.client.post('/users', userData)
    },

    update: async (userId: string, userData: Partial<User>): Promise<AxiosResponse<ApiResponse<User>>> => {
      return this.client.put(`/users/${userId}`, userData)
    },

    delete: async (userId: string): Promise<AxiosResponse<void>> => {
      return this.client.delete(`/users/${userId}`)
    },
  }

  // Team management endpoints
  teams = {
    list: async (params?: {
      include_members?: boolean
      page?: number
      limit?: number
    }): Promise<AxiosResponse<PaginatedResponse<Team>>> => {
      return this.client.get('/teams', { params })
    },

    get: async (teamId: string): Promise<AxiosResponse<ApiResponse<Team>>> => {
      return this.client.get(`/teams/${teamId}`)
    },

    create: async (teamData: Partial<Team>): Promise<AxiosResponse<ApiResponse<Team>>> => {
      return this.client.post('/teams', teamData)
    },

    update: async (teamId: string, teamData: Partial<Team>): Promise<AxiosResponse<ApiResponse<Team>>> => {
      return this.client.put(`/teams/${teamId}`, teamData)
    },

    delete: async (teamId: string): Promise<AxiosResponse<void>> => {
      return this.client.delete(`/teams/${teamId}`)
    },

    addMember: async (teamId: string, memberData: { user_id: string; role: 'lead' | 'member' }): Promise<AxiosResponse<ApiResponse<TeamMember>>> => {
      return this.client.post(`/teams/${teamId}/members`, memberData)
    },

    removeMember: async (teamId: string, userId: string): Promise<AxiosResponse<void>> => {
      return this.client.delete(`/teams/${teamId}/members/${userId}`)
    },

    updateMember: async (teamId: string, userId: string, memberData: Partial<TeamMember>): Promise<AxiosResponse<ApiResponse<TeamMember>>> => {
      return this.client.put(`/teams/${teamId}/members/${userId}`, memberData)
    },
  }

  // Metrics endpoints
  metrics = {
    // Productivity metrics
    getProductivityMetrics: async (params: MetricsQueryParams): Promise<AxiosResponse<ApiResponse<ProductivityMetric[]>>> => {
      return this.client.get('/metrics/productivity', { params })
    },

    // Command executions
    getCommandExecutions: async (params: MetricsQueryParams): Promise<AxiosResponse<ApiResponse<CommandExecution[]>>> => {
      return this.client.get('/metrics/commands', { params })
    },

    // Agent interactions
    getAgentInteractions: async (params: MetricsQueryParams): Promise<AxiosResponse<ApiResponse<AgentInteraction[]>>> => {
      return this.client.get('/metrics/agents', { params })
    },

    // User sessions
    getUserSessions: async (params: MetricsQueryParams): Promise<AxiosResponse<ApiResponse<UserSession[]>>> => {
      return this.client.get('/metrics/sessions', { params })
    },

    // Aggregated metrics for dashboard
    getDashboardMetrics: async (params: {
      start_date: string
      end_date: string
      team_id?: string
      user_id?: string
      aggregation?: string
    }): Promise<AxiosResponse<ApiResponse<any>>> => {
      return this.client.get('/metrics/dashboard', { params })
    },
  }

  // Analytics endpoints
  analytics = {
    getProductivityTrends: async (params: {
      start_date: string
      end_date: string
      team_id?: string
      comparison_period?: string
    }): Promise<AxiosResponse<ApiResponse<ProductivityTrend[]>>> => {
      return this.client.get('/analytics/productivity-trends', { params })
    },

    getTeamComparison: async (params: {
      team_ids: string[]
      metric_types: string[]
      date_range: string
    }): Promise<AxiosResponse<ApiResponse<TeamComparison[]>>> => {
      return this.client.get('/analytics/team-comparison', { params })
    },

    getAgentUsage: async (params: {
      start_date: string
      end_date: string
      team_id?: string
    }): Promise<AxiosResponse<ApiResponse<any>>> => {
      return this.client.get('/analytics/agent-usage', { params })
    },

    getPerformanceInsights: async (params: {
      start_date: string
      end_date: string
      metric_types?: string[]
    }): Promise<AxiosResponse<ApiResponse<any>>> => {
      return this.client.get('/analytics/performance-insights', { params })
    },
  }

  // Dashboard configuration endpoints
  dashboards = {
    list: async (params?: {
      scope?: 'user' | 'team' | 'organization'
      default_only?: boolean
    }): Promise<AxiosResponse<ApiResponse<DashboardConfig[]>>> => {
      return this.client.get('/dashboards', { params })
    },

    get: async (dashboardId: string): Promise<AxiosResponse<ApiResponse<DashboardConfig>>> => {
      return this.client.get(`/dashboards/${dashboardId}`)
    },

    create: async (dashboardData: Partial<DashboardConfig>): Promise<AxiosResponse<ApiResponse<DashboardConfig>>> => {
      return this.client.post('/dashboards', dashboardData)
    },

    update: async (dashboardId: string, dashboardData: Partial<DashboardConfig>): Promise<AxiosResponse<ApiResponse<DashboardConfig>>> => {
      return this.client.put(`/dashboards/${dashboardId}`, dashboardData)
    },

    delete: async (dashboardId: string): Promise<AxiosResponse<void>> => {
      return this.client.delete(`/dashboards/${dashboardId}`)
    },
  }

  // Alerts endpoints
  alerts = {
    list: async (): Promise<AxiosResponse<ApiResponse<Alert[]>>> => {
      return this.client.get('/alerts')
    },

    get: async (alertId: string): Promise<AxiosResponse<ApiResponse<Alert>>> => {
      return this.client.get(`/alerts/${alertId}`)
    },

    create: async (alertData: Partial<Alert>): Promise<AxiosResponse<ApiResponse<Alert>>> => {
      return this.client.post('/alerts', alertData)
    },

    update: async (alertId: string, alertData: Partial<Alert>): Promise<AxiosResponse<ApiResponse<Alert>>> => {
      return this.client.put(`/alerts/${alertId}`, alertData)
    },

    delete: async (alertId: string): Promise<AxiosResponse<void>> => {
      return this.client.delete(`/alerts/${alertId}`)
    },

    getHistory: async (alertId: string, params?: {
      start_date?: string
      end_date?: string
      limit?: number
    }): Promise<AxiosResponse<ApiResponse<any[]>>> => {
      return this.client.get(`/alerts/${alertId}/history`, { params })
    },
  }

  // Reports endpoints
  reports = {
    export: async (exportRequest: ReportExportRequest): Promise<AxiosResponse<ReportExportResponse>> => {
      return this.client.post('/reports/export', exportRequest)
    },

    getExportStatus: async (jobId: string): Promise<AxiosResponse<ApiResponse<ReportExportResponse>>> => {
      return this.client.get(`/reports/export/${jobId}/status`)
    },

    downloadReport: async (jobId: string): Promise<AxiosResponse<Blob>> => {
      return this.client.get(`/reports/export/${jobId}/download`, {
        responseType: 'blob',
      })
    },
  }

  // Integration endpoints
  integration = {
    getClaudeCodeConfig: async (): Promise<AxiosResponse<ApiResponse<any>>> => {
      return this.client.get('/integration/claude-code/config')
    },

    updateClaudeCodeConfig: async (config: any): Promise<AxiosResponse<ApiResponse<any>>> => {
      return this.client.put('/integration/claude-code/config', config)
    },

    testClaudeCodeConnection: async (): Promise<AxiosResponse<ApiResponse<{ status: string; message: string }>>> => {
      return this.client.post('/integration/claude-code/test')
    },

    getMcpStatus: async (): Promise<AxiosResponse<ApiResponse<any>>> => {
      return this.client.get('/integration/mcp/status')
    },

    registerWebhook: async (webhookData: {
      hook_url: string
      events: string[]
      secret?: string
    }): Promise<AxiosResponse<ApiResponse<any>>> => {
      return this.client.post('/integration/webhooks/register', webhookData)
    },
  }

  // Organization settings
  organization = {
    get: async (): Promise<AxiosResponse<ApiResponse<Organization>>> => {
      return this.client.get('/organization')
    },

    update: async (orgData: Partial<Organization>): Promise<AxiosResponse<ApiResponse<Organization>>> => {
      return this.client.put('/organization', orgData)
    },

    getSettings: async (): Promise<AxiosResponse<ApiResponse<any>>> => {
      return this.client.get('/organization/settings')
    },

    updateSettings: async (settings: any): Promise<AxiosResponse<ApiResponse<any>>> => {
      return this.client.put('/organization/settings', settings)
    },
  }

  // Activity endpoints for real-time activity widget
  activities = {
    // Get activities with filtering and pagination
    list: async (params?: {
      search_query?: string
      user_ids?: string[]
      action_types?: string[]
      status_filters?: string[]
      start_date?: string
      end_date?: string
      tags?: string[]
      priority_levels?: string[]
      show_automated?: boolean
      min_duration?: number
      max_duration?: number
      page?: number
      limit?: number
      sort?: 'timestamp' | 'duration' | 'priority'
      order?: 'asc' | 'desc'
    }): Promise<AxiosResponse<PaginatedResponse<ActivityItem>>> => {
      return this.client.get('/activities', { params })
    },

    // Get single activity by ID
    get: async (activityId: string): Promise<AxiosResponse<ApiResponse<ActivityItem>>> => {
      return this.client.get(`/activities/${activityId}`)
    },

    // Get activities grouped by criteria
    getGrouped: async (params: {
      group_by: 'user' | 'action_type' | 'status' | 'priority'
      start_date?: string
      end_date?: string
      filters?: Partial<ActivityFilter>
    }): Promise<AxiosResponse<ApiResponse<ActivityGroup[]>>> => {
      return this.client.get('/activities/grouped', { params })
    },

    // Get activity stream for real-time updates
    getStream: async (params?: {
      last_timestamp?: string
      limit?: number
      filters?: Partial<ActivityFilter>
    }): Promise<AxiosResponse<ApiResponse<ActivityItem[]>>> => {
      return this.client.get('/activities/stream', { params })
    },

    // Get activity statistics for dashboard
    getStats: async (params?: {
      start_date?: string
      end_date?: string
      filters?: Partial<ActivityFilter>
      group_by?: string
      interval?: '1h' | '1d' | '1w' | '1m'
    }): Promise<AxiosResponse<ApiResponse<{
      total_count: number
      success_count: number
      error_count: number
      avg_duration: number
      activity_by_hour: Record<string, number>
      activity_by_type: Record<string, number>
      activity_by_user: Record<string, number>
    }>>> => {
      return this.client.get('/activities/stats', { params })
    },

    // Get activity artifacts/files
    getArtifacts: async (activityId: string): Promise<AxiosResponse<ApiResponse<{
      type: 'log' | 'output' | 'screenshot' | 'report'
      name: string
      url: string
      size_bytes?: number
    }[]>>> => {
      return this.client.get(`/activities/${activityId}/artifacts`)
    },

    // Download activity logs
    downloadLogs: async (activityId: string): Promise<AxiosResponse<Blob>> => {
      return this.client.get(`/activities/${activityId}/logs`, {
        responseType: 'blob',
      })
    },

    // Get activity performance metrics
    getMetrics: async (activityId: string): Promise<AxiosResponse<ApiResponse<{
      input_tokens?: number
      output_tokens?: number
      memory_usage?: number
      cpu_usage?: number
      execution_phases?: Array<{
        name: string
        duration_ms: number
        status: string
      }>
    }>>> => {
      return this.client.get(`/activities/${activityId}/metrics`)
    },

    // Get recent activity summary for widgets
    getSummary: async (params?: {
      hours?: number
      user_id?: string
      team_id?: string
    }): Promise<AxiosResponse<ApiResponse<{
      total_activities: number
      success_rate: number
      avg_duration: number
      most_active_user: string
      most_used_tool: string
      recent_trends: Array<{
        timestamp: Date
        count: number
        success_rate: number
      }>
    }>>> => {
      return this.client.get('/activities/summary', { params })
    },
  }

  // System health and monitoring
  system = {
    getHealth: async (): Promise<AxiosResponse<any>> => {
      return this.client.get('/health')
    },

    getMetrics: async (): Promise<AxiosResponse<any>> => {
      return this.client.get('/system/metrics')
    },
  }
}

// Create singleton instance
const apiService = new ApiService()

// Export individual API modules for easier usage
export const authApi = apiService.auth
export const usersApi = apiService.users
export const teamsApi = apiService.teams
export const metricsApi = apiService.metrics
export const analyticsApi = apiService.analytics
export const dashboardsApi = apiService.dashboards
export const alertsApi = apiService.alerts
export const reportsApi = apiService.reports
export const integrationApi = apiService.integration
export const organizationApi = apiService.organization
export const activitiesApi = apiService.activities
export const systemApi = apiService.system

export default apiService