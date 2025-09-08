import React, { useEffect, useRef } from 'react'
import { 
  Activity, 
  User, 
  Terminal, 
  GitBranch, 
  Code, 
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react'
import BaseWidget, { BaseWidgetConfig } from './BaseWidget'
import { useWidgetRealTime } from '../../hooks/useRealTimeData'
import { useAppSelector } from '../../store'
import { useCurrentTenant } from '../../contexts/TenantContext'
import { clsx } from 'clsx'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'

interface ActivityEvent {
  id: string
  type: 'command' | 'user_action' | 'system' | 'alert' | 'achievement' | 'collaboration'
  title: string
  description?: string
  user?: {
    id: string
    name: string
    avatar?: string
  }
  metadata?: {
    duration?: number
    status?: 'success' | 'error' | 'warning' | 'info'
    tool?: string
    project?: string
    impact?: 'low' | 'medium' | 'high'
    [key: string]: any
  }
  timestamp: Date
  room?: string
}

interface RealTimeActivityFeedProps {
  config: BaseWidgetConfig & {
    maxEvents?: number
    autoScroll?: boolean
    showFilters?: boolean
    eventTypes?: ActivityEvent['type'][]
    showUserAvatars?: boolean
    groupByTime?: boolean
  }
  isEditing?: boolean
  onRemove?: () => void
}

const RealTimeActivityFeed: React.FC<RealTimeActivityFeedProps> = ({
  config,
  isEditing,
  onRemove,
}) => {
  const currentTenant = useCurrentTenant()
  const { user } = useAppSelector((state) => state.auth)
  const feedRef = useRef<HTMLDivElement>(null)
  
  // Use real-time data hook
  const {
    data: events,
    isConnected,
    updateCount,
    subscribe,
    unsubscribe,
    refresh
  } = useWidgetRealTime(
    'activity-feed',
    [
      'activity',
      'commands',
      'users',
      'system',
      'alerts',
      currentTenant?.id ? `tenant:${currentTenant.id}` : 'global'
    ],
    {
      dataType: 'activity',
      autoReconnect: true,
      enableNotifications: false,
      onDataUpdate: (newEvent) => {
        // Auto-scroll to bottom when new events arrive
        if (config.autoScroll && feedRef.current) {
          setTimeout(() => {
            feedRef.current?.scrollTo({
              top: feedRef.current.scrollHeight,
              behavior: 'smooth'
            })
          }, 100)
        }
      }
    }
  )

  // Mock real-time events for demo (replace with actual real-time data)
  const [mockEvents, setMockEvents] = React.useState<ActivityEvent[]>([])

  useEffect(() => {
    // Generate mock events for demonstration
    const generateMockEvent = (): ActivityEvent => {
      const eventTypes: ActivityEvent['type'][] = ['command', 'user_action', 'system', 'alert', 'achievement', 'collaboration']
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]
      
      const mockUsers = [
        { id: '1', name: 'John Doe', avatar: null },
        { id: '2', name: 'Jane Smith', avatar: null },
        { id: '3', name: 'Bob Johnson', avatar: null },
      ]

      const baseEvent = {
        id: `event-${Date.now()}-${Math.random()}`,
        type,
        user: Math.random() > 0.3 ? mockUsers[Math.floor(Math.random() * mockUsers.length)] : undefined,
        timestamp: new Date(),
        room: currentTenant?.id ? `tenant:${currentTenant.id}` : 'global',
      }

      switch (type) {
        case 'command':
          return {
            ...baseEvent,
            title: 'Command Executed',
            description: [
              '/create-trd "New Feature Implementation"',
              '/implement-trd feature-auth-system',
              '/fold-prompt optimization',
              '/test e2e user-flows',
              '/review security-scan',
            ][Math.floor(Math.random() * 5)],
            metadata: {
              duration: Math.floor(Math.random() * 5000) + 500,
              status: ['success', 'error', 'warning'][Math.floor(Math.random() * 3)] as any,
              tool: 'Claude Code',
            },
          }

        case 'user_action':
          return {
            ...baseEvent,
            title: [
              'Opened VS Code',
              'Started debugging session',
              'Committed changes',
              'Created pull request',
              'Reviewed code',
            ][Math.floor(Math.random() * 5)],
            description: 'Working on authentication feature',
            metadata: {
              status: 'success',
              tool: ['VS Code', 'Git', 'GitHub', 'Terminal'][Math.floor(Math.random() * 4)],
              project: 'auth-system',
            },
          }

        case 'system':
          return {
            ...baseEvent,
            title: 'System Update',
            description: [
              'Backup completed successfully',
              'Performance optimization applied',
              'Database migration finished',
              'Security patch installed',
            ][Math.floor(Math.random() * 4)],
            metadata: {
              status: 'success',
              impact: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
            },
          }

        case 'alert':
          return {
            ...baseEvent,
            title: 'Alert Triggered',
            description: [
              'High CPU usage detected',
              'Unusual activity pattern',
              'Failed authentication attempts',
              'Low disk space warning',
            ][Math.floor(Math.random() * 4)],
            metadata: {
              status: 'warning',
              impact: 'medium',
            },
          }

        case 'achievement':
          return {
            ...baseEvent,
            title: 'Achievement Unlocked',
            description: [
              'Completed 100 tasks',
              '30-day streak milestone',
              'Code quality champion',
              'Team collaboration expert',
            ][Math.floor(Math.random() * 4)],
            metadata: {
              status: 'success',
              impact: 'high',
            },
          }

        case 'collaboration':
          return {
            ...baseEvent,
            title: [
              'Code review completed',
              'Team meeting scheduled',
              'Knowledge base updated',
              'Pair programming session',
            ][Math.floor(Math.random() * 4)],
            description: 'Collaborating on feature development',
            metadata: {
              status: 'info',
              project: 'team-project',
            },
          }

        default:
          return baseEvent as ActivityEvent
      }
    }

    // Generate initial events
    const initialEvents = Array.from({ length: 20 }, generateMockEvent)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    
    setMockEvents(initialEvents)

    // Simulate real-time events
    const interval = setInterval(() => {
      const newEvent = generateMockEvent()
      setMockEvents(prev => [newEvent, ...prev.slice(0, (config.maxEvents || 50) - 1)])
    }, Math.random() * 10000 + 5000) // Random interval between 5-15 seconds

    return () => clearInterval(interval)
  }, [currentTenant?.id, config.maxEvents])

  const getEventIcon = (event: ActivityEvent) => {
    const iconProps = { className: 'w-4 h-4' }
    
    switch (event.type) {
      case 'command':
        return <Terminal {...iconProps} />
      case 'user_action':
        return <User {...iconProps} />
      case 'system':
        return <Activity {...iconProps} />
      case 'alert':
        return <AlertCircle {...iconProps} />
      case 'achievement':
        return <CheckCircle {...iconProps} />
      case 'collaboration':
        return <GitBranch {...iconProps} />
      default:
        return <Info {...iconProps} />
    }
  }

  const getEventColor = (event: ActivityEvent) => {
    if (event.metadata?.status) {
      switch (event.metadata.status) {
        case 'success':
          return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
        case 'error':
          return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20'
        case 'warning':
          return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20'
        case 'info':
          return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20'
        default:
          return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'
      }
    }

    switch (event.type) {
      case 'command':
        return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20'
      case 'user_action':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20'
      case 'system':
        return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'
      case 'alert':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20'
      case 'achievement':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
      case 'collaboration':
        return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20'
      default:
        return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    if (isToday(timestamp)) {
      return format(timestamp, 'HH:mm')
    } else if (isYesterday(timestamp)) {
      return `Yesterday ${format(timestamp, 'HH:mm')}`
    } else {
      return format(timestamp, 'MMM dd, HH:mm')
    }
  }

  const getRelativeTime = (timestamp: Date) => {
    return formatDistanceToNow(timestamp, { addSuffix: true })
  }

  const filteredEvents = mockEvents.filter(event => {
    if (config.eventTypes && config.eventTypes.length > 0) {
      return config.eventTypes.includes(event.type)
    }
    return true
  })

  const displayEvents = filteredEvents.slice(0, config.maxEvents || 50)

  return (
    <BaseWidget
      title="Real-Time Activity"
      subtitle={`Live activity feed • ${updateCount} updates`}
      icon={<Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
      config={{
        ...config,
        refreshInterval: 0, // Disable automatic refresh since we use real-time updates
      }}
      isEditing={isEditing}
      onRemove={onRemove}
      onRefresh={refresh}
      actions={
        <div className="flex items-center space-x-2">
          {/* Connection Status Indicator */}
          <div className="flex items-center space-x-1">
            <div className={clsx(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            )} />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      }
    >
      <div 
        ref={feedRef}
        className="h-full overflow-y-auto custom-scrollbar space-y-2 pr-2"
      >
        {displayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
            <div className="text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs">Activity will appear here in real-time</p>
            </div>
          </div>
        ) : (
          displayEvents.map((event) => (
            <div 
              key={event.id}
              className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group"
            >
              {/* Event Icon */}
              <div className={clsx(
                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                getEventColor(event)
              )}>
                {getEventIcon(event)}
              </div>

              {/* Event Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {event.title}
                  </h4>
                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {getRelativeTime(event.timestamp)}
                    </span>
                  </div>
                </div>

                {event.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                    {event.description}
                  </p>
                )}

                {/* Event Metadata */}
                <div className="flex items-center space-x-3 mt-2">
                  {event.user && config.showUserAvatars && (
                    <div className="flex items-center space-x-1">
                      {event.user.avatar ? (
                        <img 
                          src={event.user.avatar} 
                          alt={event.user.name}
                          className="w-4 h-4 rounded-full"
                        />
                      ) : (
                        <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {event.user.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {event.user.name}
                      </span>
                    </div>
                  )}

                  {event.metadata?.tool && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full">
                      {event.metadata.tool}
                    </span>
                  )}

                  {event.metadata?.duration && (
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {event.metadata.duration < 1000 
                          ? `${event.metadata.duration}ms`
                          : `${(event.metadata.duration / 1000).toFixed(1)}s`
                        }
                      </span>
                    </div>
                  )}

                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </BaseWidget>
  )
}

export default RealTimeActivityFeed