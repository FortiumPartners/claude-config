import React, { useEffect, useState } from 'react'
import { Activity, X, Clock, User, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { useAppSelector } from '../../store'
import { useWebSocket } from '../../contexts/WebSocketContext'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
  id: string
  user: string
  action: string
  target: string
  status: 'success' | 'error' | 'in_progress'
  timestamp: Date
  duration?: number
  avatar?: string
}

interface RealTimeActivityWidgetProps {
  config: {
    showTimestamp?: boolean
    maxItems?: number
    showAvatars?: boolean
  }
  isEditing?: boolean
  onRemove?: () => void
}

const RealTimeActivityWidget: React.FC<RealTimeActivityWidgetProps> = ({
  config,
  isEditing,
  onRemove,
}) => {
  const { commandExecutions, agentInteractions } = useAppSelector((state) => state.metrics)
  const { isConnected } = useWebSocket()
  const [activities, setActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    // Generate sample real-time activities
    const generateSampleActivities = (): ActivityItem[] => {
      const sampleActivities: ActivityItem[] = [
        {
          id: '1',
          user: 'Sarah Chen',
          action: 'executed',
          target: '/plan-product command',
          status: 'success',
          timestamp: new Date(Date.now() - 30000), // 30 seconds ago
          duration: 2340,
        },
        {
          id: '2',
          user: 'Mike Johnson',
          action: 'deployed',
          target: 'React component',
          status: 'success',
          timestamp: new Date(Date.now() - 90000), // 1.5 minutes ago
          duration: 5670,
        },
        {
          id: '3',
          user: 'Emma Davis',
          action: 'failed',
          target: '/test e2e command',
          status: 'error',
          timestamp: new Date(Date.now() - 180000), // 3 minutes ago
          duration: 1200,
        },
        {
          id: '4',
          user: 'Alex Kim',
          action: 'reviewing',
          target: 'Pull Request #142',
          status: 'in_progress',
          timestamp: new Date(Date.now() - 300000), // 5 minutes ago
        },
        {
          id: '5',
          user: 'Lisa Wang',
          action: 'optimized',
          target: 'Database query',
          status: 'success',
          timestamp: new Date(Date.now() - 420000), // 7 minutes ago
          duration: 890,
        },
        {
          id: '6',
          user: 'David Rodriguez',
          action: 'created',
          target: 'API endpoint',
          status: 'success',
          timestamp: new Date(Date.now() - 600000), // 10 minutes ago
          duration: 4560,
        },
      ]

      return sampleActivities
    }

    const sampleActivities = generateSampleActivities()
    setActivities(sampleActivities.slice(0, config.maxItems || 10))

    // Simulate real-time updates
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance of new activity
        const users = ['Sarah Chen', 'Mike Johnson', 'Emma Davis', 'Alex Kim', 'Lisa Wang', 'David Rodriguez']
        const actions = ['executed', 'deployed', 'reviewed', 'created', 'optimized', 'tested']
        const targets = ['React component', 'API endpoint', '/plan-product command', 'Database query', 'Pull Request', 'Test suite']
        const statuses: ('success' | 'error' | 'in_progress')[] = ['success', 'success', 'success', 'error', 'in_progress']
        
        const newActivity: ActivityItem = {
          id: Date.now().toString(),
          user: users[Math.floor(Math.random() * users.length)],
          action: actions[Math.floor(Math.random() * actions.length)],
          target: targets[Math.floor(Math.random() * targets.length)],
          status: statuses[Math.floor(Math.random() * statuses.length)],
          timestamp: new Date(),
          duration: Math.floor(Math.random() * 5000) + 500,
        }

        setActivities(prev => [newActivity, ...prev.slice(0, (config.maxItems || 10) - 1)])
      }
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [config.maxItems, commandExecutions, agentInteractions])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'in_progress':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      default:
        return 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700'
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase()
  }

  return (
    <div className="h-full bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 relative">
      {isEditing && onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 z-10 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Activity className="w-5 h-5 text-blue-500" />
            {isConnected && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Real-time Activity
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isConnected ? 'Live updates' : 'Offline mode'}
            </p>
          </div>
        </div>
      </div>

      <div className="h-[calc(100%-5rem)] overflow-y-auto space-y-3">
        {activities.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
            <div className="text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-all ${getStatusColor(activity.status)}`}
            >
              {config.showAvatars && (
                <div className="flex-shrink-0">
                  {activity.avatar ? (
                    <img
                      src={activity.avatar}
                      alt={activity.user}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        {getInitials(activity.user)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-slate-900 dark:text-white">
                    <span className="font-medium">{activity.user}</span>{' '}
                    {activity.action}{' '}
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-600 px-1.5 py-0.5 rounded">
                      {activity.target}
                    </span>
                  </p>
                  {getStatusIcon(activity.status)}
                </div>
                
                <div className="flex items-center space-x-4 mt-1">
                  {config.showTimestamp && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </p>
                  )}
                  
                  {activity.duration && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {(activity.duration / 1000).toFixed(1)}s
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {!isConnected && (
        <div className="absolute bottom-2 right-2">
          <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-full px-2 py-1">
            <span className="text-xs text-yellow-800 dark:text-yellow-300">Offline</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default RealTimeActivityWidget