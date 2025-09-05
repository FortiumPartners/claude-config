import React, { useEffect, useState, useCallback } from 'react'
import { Responsive, WidthProvider, Layout } from 'react-grid-layout'
import { Plus, Settings, Edit3, Eye, Save, X } from 'lucide-react'
import { useAppSelector, useAppDispatch } from '../../store'
import { 
  updateLayout, 
  setIsEditing, 
  addWidget, 
  removeWidget,
  setCurrentDashboard 
} from '../../store/slices/dashboardSlice'
import { addNotification } from '../../store/slices/uiSlice'
import { useWebSocket } from '../../contexts/WebSocketContext'

// Import dashboard widgets
import ProductivityTrendsWidget from '../../components/dashboard/ProductivityTrendsWidget'
import TeamComparisonWidget from '../../components/dashboard/TeamComparisonWidget'
import AgentUsageWidget from '../../components/dashboard/AgentUsageWidget'
import TaskCompletionWidget from '../../components/dashboard/TaskCompletionWidget'
import CodeQualityWidget from '../../components/dashboard/CodeQualityWidget'
import RealTimeActivityWidget from '../../components/dashboard/RealTimeActivityWidget'
import MetricCardWidget from '../../components/dashboard/MetricCardWidget'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { 
    currentDashboard, 
    layout, 
    isEditing, 
    isDragEnabled, 
    isLoading 
  } = useAppSelector((state) => state.dashboard)
  const { user } = useAppSelector((state) => state.auth)
  const { screenSize, animationsEnabled } = useAppSelector((state) => state.ui)
  const { subscribe, isConnected } = useWebSocket()

  const [showAddWidgetPanel, setShowAddWidgetPanel] = useState(false)

  // Subscribe to real-time dashboard updates
  useEffect(() => {
    if (currentDashboard && isConnected) {
      subscribe([`dashboard:${currentDashboard.id}`])
    }
  }, [currentDashboard, isConnected, subscribe])

  // Initialize default dashboard if none exists
  useEffect(() => {
    if (!currentDashboard && user) {
      const defaultDashboard = createDefaultDashboard(user.id, user.organization_id)
      dispatch(setCurrentDashboard(defaultDashboard))
    }
  }, [currentDashboard, user, dispatch])

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    if (isEditing) {
      dispatch(updateLayout(newLayout))
    }
  }, [isEditing, dispatch])

  const handleEditToggle = () => {
    if (isEditing) {
      // Save changes
      dispatch(addNotification({
        type: 'success',
        title: 'Dashboard saved',
        message: 'Your dashboard layout has been updated.'
      }))
    }
    dispatch(setIsEditing(!isEditing))
  }

  const handleAddWidget = (widgetType: string) => {
    const newWidget = createNewWidget(widgetType, layout.length)
    dispatch(addWidget(newWidget))
    setShowAddWidgetPanel(false)
    dispatch(addNotification({
      type: 'success',
      title: 'Widget added',
      message: `${widgetType} widget has been added to your dashboard.`
    }))
  }

  const handleRemoveWidget = (widgetId: string) => {
    dispatch(removeWidget(widgetId))
    dispatch(addNotification({
      type: 'info',
      title: 'Widget removed',
      message: 'Widget has been removed from your dashboard.'
    }))
  }

  const renderWidget = (widget: any) => {
    const commonProps = {
      isEditing,
      onRemove: () => handleRemoveWidget(widget.id),
    }

    switch (widget.type) {
      case 'productivity-trends':
        return <ProductivityTrendsWidget {...commonProps} config={widget.config} />
      case 'team-comparison':
        return <TeamComparisonWidget {...commonProps} config={widget.config} />
      case 'agent-usage':
        return <AgentUsageWidget {...commonProps} config={widget.config} />
      case 'task-completion':
        return <TaskCompletionWidget {...commonProps} config={widget.config} />
      case 'code-quality':
        return <CodeQualityWidget {...commonProps} config={widget.config} />
      case 'real-time-activity':
        return <RealTimeActivityWidget {...commonProps} config={widget.config} />
      case 'metric-card':
        return <MetricCardWidget {...commonProps} config={widget.config} />
      default:
        return (
          <div className="h-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
            <p className="text-slate-500 dark:text-slate-400">Unknown widget type</p>
          </div>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {currentDashboard?.name || 'Dashboard'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Monitor your team's productivity and performance in real-time
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddWidgetPanel(true)}
            disabled={!isEditing}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Widget
          </button>
          
          <button
            onClick={handleEditToggle}
            className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
              isEditing
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
            }`}
          >
            {isEditing ? (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </>
            )}
          </button>
          
          <button
            className="inline-flex items-center px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </button>
        </div>
      </div>

      {/* Edit Mode Notice */}
      {isEditing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center">
            <Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
            <span className="text-blue-800 dark:text-blue-300 font-medium">
              Edit Mode Active
            </span>
            <span className="text-blue-600 dark:text-blue-400 ml-2">
              Drag widgets to reposition, resize by dragging corners, or add new widgets
            </span>
          </div>
        </div>
      )}

      {/* Connection Status */}
      {!isConnected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center">
            <Eye className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
            <span className="text-yellow-800 dark:text-yellow-300 font-medium">
              Real-time updates disconnected
            </span>
            <span className="text-yellow-600 dark:text-yellow-400 ml-2">
              Dashboard data may not be current
            </span>
          </div>
        </div>
      )}

      {/* Dashboard Grid */}
      <div className="dashboard-container">
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={120}
          onLayoutChange={handleLayoutChange}
          isDraggable={isDragEnabled && isEditing}
          isResizable={isDragEnabled && isEditing}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          useCSSTransforms={animationsEnabled}
          compactType="vertical"
          preventCollision={false}
        >
          {currentDashboard?.layout.map((widget) => (
            <div key={widget.id} className="widget-container">
              {renderWidget(widget)}
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>

      {/* Add Widget Panel */}
      {showAddWidgetPanel && (
        <AddWidgetPanel
          onAddWidget={handleAddWidget}
          onClose={() => setShowAddWidgetPanel(false)}
        />
      )}
    </div>
  )
}

// Helper function to create default dashboard
const createDefaultDashboard = (userId: string, organizationId: string) => {
  return {
    id: 'default',
    name: 'My Dashboard',
    user_id: userId,
    organization_id: organizationId,
    layout: [
      {
        id: 'productivity-trends',
        type: 'chart' as const,
        title: 'Productivity Trends',
        position: { x: 0, y: 0, w: 8, h: 3 },
        config: { chartType: 'line', metricType: 'productivity_score' },
        data_source: 'productivity-trends',
      },
      {
        id: 'team-comparison',
        type: 'chart' as const,
        title: 'Team Comparison',
        position: { x: 8, y: 0, w: 4, h: 3 },
        config: { chartType: 'bar' },
        data_source: 'team-comparison',
      },
      {
        id: 'agent-usage',
        type: 'chart' as const,
        title: 'Agent Usage',
        position: { x: 0, y: 3, w: 6, h: 3 },
        config: { chartType: 'pie' },
        data_source: 'agent-usage',
      },
      {
        id: 'real-time-activity',
        type: 'table' as const,
        title: 'Real-time Activity',
        position: { x: 6, y: 3, w: 6, h: 3 },
        config: { showTimestamp: true, maxItems: 10 },
        data_source: 'real-time-activity',
      },
    ],
    filters: {
      date_range: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
        preset: '7d' as const,
      },
    },
    is_default: true,
    is_shared: false,
    created_at: new Date(),
    updated_at: new Date(),
  }
}

// Helper function to create new widget
const createNewWidget = (type: string, currentWidgetCount: number) => {
  const id = `${type}-${Date.now()}`
  const position = {
    x: (currentWidgetCount * 3) % 12,
    y: Math.floor((currentWidgetCount * 3) / 12) * 3,
    w: 4,
    h: 3,
  }

  return {
    id,
    type: 'chart' as const,
    title: type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    position,
    config: {},
    data_source: type,
  }
}

// Add Widget Panel Component
interface AddWidgetPanelProps {
  onAddWidget: (type: string) => void
  onClose: () => void
}

const AddWidgetPanel: React.FC<AddWidgetPanelProps> = ({ onAddWidget, onClose }) => {
  const widgetTypes = [
    { type: 'productivity-trends', name: 'Productivity Trends', description: 'Track productivity metrics over time' },
    { type: 'team-comparison', name: 'Team Comparison', description: 'Compare performance across teams' },
    { type: 'agent-usage', name: 'Agent Usage', description: 'Monitor AI agent utilization' },
    { type: 'task-completion', name: 'Task Completion', description: 'Sprint and milestone progress' },
    { type: 'code-quality', name: 'Code Quality', description: 'Error rates and test coverage' },
    { type: 'real-time-activity', name: 'Real-time Activity', description: 'Live team development feed' },
    { type: 'metric-card', name: 'Metric Card', description: 'Single KPI display' },
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Add Widget
                  </h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {widgetTypes.map((widget) => (
                    <button
                      key={widget.type}
                      onClick={() => onAddWidget(widget.type)}
                      className="text-left p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                    >
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {widget.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {widget.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage