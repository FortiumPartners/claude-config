import React, { useEffect, useState } from 'react'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { 
  User, 
  Target, 
  Clock, 
  Award, 
  TrendingUp, 
  Calendar,
  Zap,
  CheckCircle
} from 'lucide-react'
import BaseWidget, { BaseWidgetConfig, widgetUtils } from './BaseWidget'
import { useAppSelector } from '../../store'
import { useCurrentTenant, useTenantPermissions } from '../../contexts/TenantContext'
import { clsx } from 'clsx'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

interface PersonalInsightsWidgetProps {
  config: BaseWidgetConfig & {
    viewType?: 'overview' | 'goals' | 'time' | 'achievements'
    showComparisons?: boolean
    showRecommendations?: boolean
  }
  isEditing?: boolean
  onRemove?: () => void
}

interface PersonalMetrics {
  productivity: {
    score: number
    trend: 'up' | 'down' | 'stable'
    weeklyChange: number
  }
  timeAllocation: {
    coding: number
    meetings: number
    reviews: number
    planning: number
    other: number
  }
  goals: {
    completed: number
    inProgress: number
    total: number
    weeklyTarget: number
  }
  achievements: {
    streaks: {
      current: number
      longest: number
    }
    badges: Array<{
      id: string
      name: string
      icon: string
      earnedAt: string
      description: string
    }>
    milestones: Array<{
      id: string
      title: string
      value: number
      target: number
      unit: string
    }>
  }
  comparisons: {
    teamAverage: number
    previousMonth: number
    industry: number
  }
  recommendations: Array<{
    id: string
    type: 'improvement' | 'habit' | 'goal'
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
    estimatedImpact: number
  }>
}

const PersonalInsightsWidget: React.FC<PersonalInsightsWidgetProps> = ({
  config,
  isEditing,
  onRemove,
}) => {
  const { user } = useAppSelector((state) => state.auth)
  const { theme } = useAppSelector((state) => state.ui)
  const currentTenant = useCurrentTenant()
  const { canAccessFeature } = useTenantPermissions()
  
  const [metrics, setMetrics] = useState<PersonalMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPersonalMetrics()
  }, [currentTenant?.id, config.timeRange])

  const loadPersonalMetrics = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Generate sample data for demo (replace with real API call)
      const sampleMetrics: PersonalMetrics = {
        productivity: {
          score: Math.floor(Math.random() * 30) + 70, // 70-100
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
          weeklyChange: (Math.random() - 0.5) * 20, // -10 to +10
        },
        timeAllocation: {
          coding: 45 + Math.random() * 10,
          meetings: 20 + Math.random() * 10,
          reviews: 15 + Math.random() * 5,
          planning: 10 + Math.random() * 5,
          other: 10 + Math.random() * 5,
        },
        goals: {
          completed: Math.floor(Math.random() * 8) + 2,
          inProgress: Math.floor(Math.random() * 5) + 2,
          total: 15,
          weeklyTarget: 3,
        },
        achievements: {
          streaks: {
            current: Math.floor(Math.random() * 10) + 1,
            longest: Math.floor(Math.random() * 20) + 5,
          },
          badges: [
            {
              id: '1',
              name: 'Code Ninja',
              icon: '🥷',
              earnedAt: '2024-09-01',
              description: 'Completed 50 tasks without errors',
            },
            {
              id: '2',
              name: 'Team Player',
              icon: '🤝',
              earnedAt: '2024-08-15',
              description: 'Helped 10 teammates with code reviews',
            },
            {
              id: '3',
              name: 'Speed Demon',
              icon: '⚡',
              earnedAt: '2024-08-01',
              description: 'Completed tasks 30% faster than average',
            },
          ],
          milestones: [
            {
              id: '1',
              title: 'Lines of Code',
              value: 25000,
              target: 30000,
              unit: 'lines',
            },
            {
              id: '2',
              title: 'Code Reviews',
              value: 145,
              target: 200,
              unit: 'reviews',
            },
          ],
        },
        comparisons: {
          teamAverage: Math.floor(Math.random() * 20) + 70,
          previousMonth: Math.floor(Math.random() * 20) + 70,
          industry: Math.floor(Math.random() * 15) + 75,
        },
        recommendations: [
          {
            id: '1',
            type: 'improvement',
            title: 'Focus Time Optimization',
            description: 'Consider blocking 2-hour focused coding sessions to increase productivity',
            priority: 'high',
            estimatedImpact: 15,
          },
          {
            id: '2',
            type: 'habit',
            title: 'Daily Code Review',
            description: 'Reviewing 2-3 PRs daily can improve code quality and team collaboration',
            priority: 'medium',
            estimatedImpact: 10,
          },
          {
            id: '3',
            type: 'goal',
            title: 'Documentation Sprint',
            description: 'Setting aside time for documentation can improve team efficiency',
            priority: 'low',
            estimatedImpact: 8,
          },
        ],
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      setMetrics(sampleMetrics)
    } catch (err: any) {
      console.error('Failed to load personal metrics:', err)
      setError(err.message || 'Failed to load personal insights')
    } finally {
      setIsLoading(false)
    }
  }

  const getTimeAllocationData = () => {
    if (!metrics) return null

    const isDark = theme === 'dark'
    const colors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // yellow
      '#ef4444', // red
      '#8b5cf6', // purple
    ]

    return {
      labels: ['Coding', 'Meetings', 'Reviews', 'Planning', 'Other'],
      datasets: [
        {
          data: Object.values(metrics.timeAllocation),
          backgroundColor: colors.map(color => `${color}CC`),
          borderColor: colors,
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    }
  }

  const getGoalsProgressData = () => {
    if (!metrics) return null

    return {
      labels: ['Completed', 'In Progress', 'Remaining'],
      datasets: [
        {
          data: [
            metrics.goals.completed,
            metrics.goals.inProgress,
            metrics.goals.total - metrics.goals.completed - metrics.goals.inProgress,
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#e5e7eb'],
          borderColor: ['#059669', '#d97706', '#d1d5db'],
          borderWidth: 2,
        },
      ],
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
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
  }

  const renderOverview = () => {
    if (!metrics) return null

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300">Productivity Score</p>
                <div className="flex items-center space-x-2">
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                    {metrics.productivity.score}%
                  </p>
                  <span className={clsx(
                    'text-sm font-medium',
                    widgetUtils.getTrendColor(metrics.productivity.trend)
                  )}>
                    {widgetUtils.getTrendIcon(metrics.productivity.trend)} 
                    {Math.abs(metrics.productivity.weeklyChange).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-700 dark:text-green-300">Goals This Week</p>
                <div className="flex items-center space-x-2">
                  <p className="text-xl font-bold text-green-900 dark:text-green-100">
                    {metrics.goals.completed}/{metrics.goals.weeklyTarget}
                  </p>
                  <div className="w-16 bg-green-200 dark:bg-green-700 rounded-full h-1.5">
                    <div 
                      className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, (metrics.goals.completed / metrics.goals.weeklyTarget) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Allocation Chart */}
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Time Allocation
          </h4>
          <div className="h-48">
            <Doughnut data={getTimeAllocationData()!} options={chartOptions} />
          </div>
        </div>
      </div>
    )
  }

  const renderAchievements = () => {
    if (!metrics) return null

    return (
      <div className="space-y-6">
        {/* Streaks */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {metrics.achievements.streaks.current}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Current Streak</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <Award className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {metrics.achievements.streaks.longest}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Longest Streak</p>
          </div>
        </div>

        {/* Recent Badges */}
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Recent Badges
          </h4>
          <div className="space-y-2">
            {metrics.achievements.badges.slice(0, 3).map((badge) => (
              <div key={badge.id} className="flex items-center space-x-3 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="text-2xl">{badge.icon}</div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-white text-sm">
                    {badge.name}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {badge.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Progress Milestones
          </h4>
          <div className="space-y-3">
            {metrics.achievements.milestones.map((milestone) => (
              <div key={milestone.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {milestone.title}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {widgetUtils.formatNumber(milestone.value)} / {widgetUtils.formatNumber(milestone.target)} {milestone.unit}
                  </p>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, (milestone.value / milestone.target) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderRecommendations = () => {
    if (!metrics || !config.showRecommendations) return null

    const priorityColors = {
      high: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10',
      medium: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10',
      low: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10',
    }

    const priorityIcons = {
      high: '🔥',
      medium: '⚡',
      low: '💡',
    }

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Personalized Recommendations
        </h4>
        <div className="space-y-3">
          {metrics.recommendations.slice(0, 3).map((rec) => (
            <div 
              key={rec.id} 
              className={clsx(
                'border rounded-lg p-3 transition-all duration-200 hover:shadow-sm',
                priorityColors[rec.priority]
              )}
            >
              <div className="flex items-start space-x-3">
                <div className="text-lg">{priorityIcons[rec.priority]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white text-sm mb-1">
                    {rec.title}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                    {rec.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={clsx(
                      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                      rec.priority === 'high' && 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
                      rec.priority === 'medium' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
                      rec.priority === 'low' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    )}>
                      {rec.priority} priority
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      +{rec.estimatedImpact}% impact
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const getViewContent = () => {
    switch (config.viewType) {
      case 'achievements':
        return renderAchievements()
      case 'goals':
        return (
          <div className="h-48">
            <Doughnut data={getGoalsProgressData()!} options={chartOptions} />
          </div>
        )
      case 'time':
        return (
          <div className="h-48">
            <Doughnut data={getTimeAllocationData()!} options={chartOptions} />
          </div>
        )
      default:
        return renderOverview()
    }
  }

  if (!canAccessFeature('analytics')) {
    return (
      <BaseWidget
        title="Personal Insights"
        subtitle="Personal productivity analytics"
        icon={<User className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
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
      title="Personal Insights"
      subtitle={`${user?.first_name}'s productivity dashboard`}
      icon={<User className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
      config={config}
      isLoading={isLoading}
      error={error}
      isEditing={isEditing}
      onRemove={onRemove}
      onRefresh={loadPersonalMetrics}
      actions={
        config.showRecommendations && (
          <div className="flex items-center space-x-1">
            {renderRecommendations()}
          </div>
        )
      }
    >
      <div className="h-full overflow-y-auto custom-scrollbar">
        {getViewContent()}
      </div>
    </BaseWidget>
  )
}

export default PersonalInsightsWidget