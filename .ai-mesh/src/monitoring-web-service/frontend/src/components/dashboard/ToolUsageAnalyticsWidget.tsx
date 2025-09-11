import React, { useEffect, useState } from 'react'
import { Bar, Line, Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js'
import { 
  Wrench, 
  TrendingUp, 
  Clock, 
  Users, 
  Activity,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react'
import BaseWidget, { BaseWidgetConfig, widgetUtils } from './BaseWidget'
import { useAppSelector } from '../../store'
import { useCurrentTenant, useTenantPermissions } from '../../contexts/TenantContext'
import { clsx } from 'clsx'
import { format, subDays, subHours } from 'date-fns'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
)

interface ToolUsageAnalyticsWidgetProps {
  config: BaseWidgetConfig & {
    viewType?: 'overview' | 'trends' | 'comparison' | 'heatmap'
    toolFilter?: string[]
    userFilter?: 'all' | 'team' | 'personal'
    showMetrics?: boolean
    groupBy?: 'tool' | 'user' | 'time'
  }
  isEditing?: boolean
  onRemove?: () => void
}

interface ToolUsageData {
  overview: {
    totalUsage: number
    uniqueTools: number
    activeUsers: number
    avgSessionTime: number
    trend: 'up' | 'down' | 'stable'
    changePercent: number
  }
  topTools: Array<{
    name: string
    usage: number
    users: number
    avgDuration: number
    trend: 'up' | 'down' | 'stable'
    category: string
    icon: string
  }>
  timelineData: Array<{
    timestamp: string
    tools: Record<string, number>
    total: number
  }>
  userAnalytics: Array<{
    userId: string
    userName: string
    totalUsage: number
    favoriteTools: string[]
    efficiency: number
  }>
  categories: Record<string, {
    name: string
    tools: string[]
    usage: number
    color: string
  }>
}

const ToolUsageAnalyticsWidget: React.FC<ToolUsageAnalyticsWidgetProps> = ({
  config,
  isEditing,
  onRemove,
}) => {
  const { theme } = useAppSelector((state) => state.ui)
  const currentTenant = useCurrentTenant()
  const { canAccessFeature } = useTenantPermissions()
  
  const [data, setData] = useState<ToolUsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedView, setSelectedView] = useState(config.viewType || 'overview')

  useEffect(() => {
    loadToolUsageData()
  }, [currentTenant?.id, config.timeRange, config.toolFilter, config.userFilter])

  const loadToolUsageData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Generate comprehensive sample data
      const sampleData: ToolUsageData = {
        overview: {
          totalUsage: Math.floor(Math.random() * 1000) + 500,
          uniqueTools: Math.floor(Math.random() * 10) + 15,
          activeUsers: Math.floor(Math.random() * 20) + 30,
          avgSessionTime: Math.floor(Math.random() * 60) + 30, // minutes
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
          changePercent: (Math.random() - 0.5) * 30,
        },
        topTools: [
          {
            name: 'Claude Code',
            usage: Math.floor(Math.random() * 200) + 300,
            users: Math.floor(Math.random() * 10) + 20,
            avgDuration: Math.floor(Math.random() * 30) + 45,
            trend: 'up',
            category: 'AI Assistant',
            icon: '🤖',
          },
          {
            name: 'VS Code',
            usage: Math.floor(Math.random() * 150) + 250,
            users: Math.floor(Math.random() * 15) + 25,
            avgDuration: Math.floor(Math.random() * 60) + 90,
            trend: 'stable',
            category: 'IDE',
            icon: '💻',
          },
          {
            name: 'Git',
            usage: Math.floor(Math.random() * 100) + 180,
            users: Math.floor(Math.random() * 12) + 22,
            avgDuration: Math.floor(Math.random() * 10) + 15,
            trend: 'up',
            category: 'Version Control',
            icon: '🔀',
          },
          {
            name: 'Terminal',
            usage: Math.floor(Math.random() * 80) + 120,
            users: Math.floor(Math.random() * 18) + 18,
            avgDuration: Math.floor(Math.random() * 20) + 25,
            trend: 'stable',
            category: 'Terminal',
            icon: '⚡',
          },
          {
            name: 'Docker',
            usage: Math.floor(Math.random() * 60) + 100,
            users: Math.floor(Math.random() * 8) + 15,
            avgDuration: Math.floor(Math.random() * 25) + 35,
            trend: 'down',
            category: 'Container',
            icon: '🐳',
          },
          {
            name: 'Postman',
            usage: Math.floor(Math.random() * 40) + 80,
            users: Math.floor(Math.random() * 10) + 12,
            avgDuration: Math.floor(Math.random() * 15) + 20,
            trend: 'up',
            category: 'API Testing',
            icon: '📮',
          },
        ],
        timelineData: (() => {
          const timeline = []
          const hours = config.timeRange === '1h' ? 1 : config.timeRange === '24h' ? 24 : 168
          for (let i = hours - 1; i >= 0; i--) {
            const timestamp = format(subHours(new Date(), i), 'MMM dd, HH:mm')
            timeline.push({
              timestamp,
              tools: {
                'Claude Code': Math.floor(Math.random() * 50) + 10,
                'VS Code': Math.floor(Math.random() * 40) + 20,
                'Git': Math.floor(Math.random() * 30) + 5,
                'Terminal': Math.floor(Math.random() * 25) + 8,
                'Docker': Math.floor(Math.random() * 20) + 5,
              },
              total: Math.floor(Math.random() * 100) + 50,
            })
          }
          return timeline
        })(),
        userAnalytics: [
          {
            userId: '1',
            userName: 'John Doe',
            totalUsage: Math.floor(Math.random() * 100) + 150,
            favoriteTools: ['Claude Code', 'VS Code', 'Git'],
            efficiency: Math.floor(Math.random() * 20) + 80,
          },
          {
            userId: '2',
            userName: 'Jane Smith',
            totalUsage: Math.floor(Math.random() * 80) + 120,
            favoriteTools: ['VS Code', 'Terminal', 'Docker'],
            efficiency: Math.floor(Math.random() * 25) + 75,
          },
          {
            userId: '3',
            userName: 'Bob Johnson',
            totalUsage: Math.floor(Math.random() * 90) + 100,
            favoriteTools: ['Claude Code', 'Postman', 'Git'],
            efficiency: Math.floor(Math.random() * 15) + 85,
          },
        ],
        categories: {
          'AI Assistant': {
            name: 'AI Assistant',
            tools: ['Claude Code', 'Copilot'],
            usage: Math.floor(Math.random() * 250) + 400,
            color: '#3b82f6',
          },
          'IDE': {
            name: 'Development Environment',
            tools: ['VS Code', 'IntelliJ', 'Vim'],
            usage: Math.floor(Math.random() * 200) + 300,
            color: '#10b981',
          },
          'Version Control': {
            name: 'Version Control',
            tools: ['Git', 'GitHub CLI'],
            usage: Math.floor(Math.random() * 150) + 200,
            color: '#f59e0b',
          },
          'Terminal': {
            name: 'Terminal & CLI',
            tools: ['Terminal', 'PowerShell', 'Zsh'],
            usage: Math.floor(Math.random() * 100) + 150,
            color: '#ef4444',
          },
          'Container': {
            name: 'Containers',
            tools: ['Docker', 'Kubernetes'],
            usage: Math.floor(Math.random() * 80) + 120,
            color: '#8b5cf6',
          },
          'API Testing': {
            name: 'API & Testing',
            tools: ['Postman', 'Insomnia', 'curl'],
            usage: Math.floor(Math.random() * 60) + 100,
            color: '#06b6d4',
          },
        },
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      setData(sampleData)
    } catch (err: any) {
      console.error('Failed to load tool usage data:', err)
      setError(err.message || 'Failed to load tool usage analytics')
    } finally {
      setIsLoading(false)
    }
  }

  const getTopToolsChartData = () => {
    if (!data) return null

    const isDark = theme === 'dark'
    const tools = data.topTools.slice(0, 8) // Top 8 tools

    return {
      labels: tools.map(tool => tool.name),
      datasets: [
        {
          label: 'Usage Count',
          data: tools.map(tool => tool.usage),
          backgroundColor: tools.map((_, index) => {
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
            return `${colors[index % colors.length]}CC`
          }),
          borderColor: tools.map((_, index) => {
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
            return colors[index % colors.length]
          }),
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    }
  }

  const getTimelineChartData = () => {
    if (!data) return null

    const timeline = data.timelineData.slice(-20) // Last 20 data points
    const toolNames = Object.keys(timeline[0]?.tools || {})

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

    return {
      labels: timeline.map(item => item.timestamp),
      datasets: toolNames.map((tool, index) => ({
        label: tool,
        data: timeline.map(item => item.tools[tool] || 0),
        borderColor: colors[index % colors.length],
        backgroundColor: `${colors[index % colors.length]}20`,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      })),
    }
  }

  const getCategoryChartData = () => {
    if (!data) return null

    const categories = Object.values(data.categories)

    return {
      labels: categories.map(cat => cat.name),
      datasets: [
        {
          data: categories.map(cat => cat.usage),
          backgroundColor: categories.map(cat => `${cat.color}CC`),
          borderColor: categories.map(cat => cat.color),
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: selectedView !== 'overview',
        position: 'top' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          color: theme === 'dark' ? '#cbd5e1' : '#475569',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
        titleColor: theme === 'dark' ? '#f1f5f9' : '#1e293b',
        bodyColor: theme === 'dark' ? '#cbd5e1' : '#475569',
        borderColor: theme === 'dark' ? '#475569' : '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: theme === 'dark' ? '#374151' : '#f1f5f9',
          drawBorder: false,
        },
        ticks: {
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          maxTicksLimit: 10,
        },
      },
      y: {
        display: selectedView !== 'comparison',
        grid: {
          color: theme === 'dark' ? '#374151' : '#f1f5f9',
          drawBorder: false,
        },
        ticks: {
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
        },
      },
    },
  }

  const renderOverview = () => {
    if (!data) return null

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-300">Total Usage</p>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  {widgetUtils.formatNumber(data.overview.totalUsage)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Wrench className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-xs text-green-700 dark:text-green-300">Unique Tools</p>
                <p className="text-lg font-bold text-green-900 dark:text-green-100">
                  {data.overview.uniqueTools}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">Active Users</p>
                <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
                  {data.overview.activeUsers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-xs text-purple-700 dark:text-purple-300">Avg Session</p>
                <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                  {widgetUtils.formatDuration(data.overview.avgSessionTime * 60)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Tools List */}
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Top Tools
          </h4>
          <div className="space-y-2">
            {data.topTools.slice(0, 5).map((tool) => (
              <div key={tool.name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="text-xl">{tool.icon}</div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white text-sm">
                      {tool.name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {tool.category} • {tool.users} users
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 dark:text-white">
                    {tool.usage}
                  </p>
                  <div className={clsx(
                    'flex items-center space-x-1 text-xs',
                    widgetUtils.getTrendColor(tool.trend)
                  )}>
                    <span>{widgetUtils.getTrendIcon(tool.trend)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderTrends = () => {
    if (!data) return null

    return (
      <div className="h-64">
        <Line data={getTimelineChartData()!} options={chartOptions} />
      </div>
    )
  }

  const renderComparison = () => {
    if (!data) return null

    return (
      <div className="h-64">
        <Bar data={getTopToolsChartData()!} options={chartOptions} />
      </div>
    )
  }

  const renderCategories = () => {
    if (!data) return null

    return (
      <div className="h-64">
        <Pie data={getCategoryChartData()!} options={{
          ...chartOptions,
          plugins: {
            ...chartOptions.plugins,
            legend: {
              ...chartOptions.plugins.legend,
              position: 'right' as const,
            },
          },
        }} />
      </div>
    )
  }

  const getViewContent = () => {
    switch (selectedView) {
      case 'trends':
        return renderTrends()
      case 'comparison':
        return renderComparison()
      case 'heatmap':
        return renderCategories()
      default:
        return renderOverview()
    }
  }

  if (!canAccessFeature('analytics')) {
    return (
      <BaseWidget
        title="Tool Usage Analytics"
        subtitle="Development tool usage insights"
        icon={<Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
        error="Access denied: Analytics feature not available"
        isEditing={isEditing}
        onRemove={onRemove}
        config={config}
      >
        <div />
      </BaseWidget>
    )
  }

  return (
    <BaseWidget
      title="Tool Usage Analytics"
      subtitle="Development tool usage insights and trends"
      icon={<Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
      config={config}
      isLoading={isLoading}
      error={error}
      isEditing={isEditing}
      onRemove={onRemove}
      onRefresh={loadToolUsageData}
      actions={
        <div className="flex items-center space-x-1">
          {/* View Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
            {(['overview', 'trends', 'comparison', 'heatmap'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                className={clsx(
                  'px-2 py-1 text-xs font-medium rounded-md transition-all duration-200',
                  selectedView === view
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="h-full">
        {getViewContent()}
      </div>
    </BaseWidget>
  )
}

export default ToolUsageAnalyticsWidget