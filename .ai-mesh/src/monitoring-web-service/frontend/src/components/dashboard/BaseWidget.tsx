import React, { ReactNode } from 'react'
import { X, Settings, Maximize2, Minimize2, RefreshCw, Download } from 'lucide-react'
import { clsx } from 'clsx'

export interface BaseWidgetConfig {
  title?: string
  subtitle?: string
  timeRange?: '1h' | '24h' | '7d' | '30d' | '90d'
  refreshInterval?: number
  exportable?: boolean
  configurable?: boolean
}

interface BaseWidgetProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  config?: BaseWidgetConfig
  isEditing?: boolean
  isExpanded?: boolean
  isLoading?: boolean
  error?: string | null
  children: ReactNode
  className?: string
  height?: string
  onRemove?: () => void
  onConfig?: () => void
  onExpand?: () => void
  onRefresh?: () => void
  onExport?: () => void
  actions?: ReactNode
}

const BaseWidget: React.FC<BaseWidgetProps> = ({
  title,
  subtitle,
  icon,
  config,
  isEditing = false,
  isExpanded = false,
  isLoading = false,
  error = null,
  children,
  className,
  height = 'h-96',
  onRemove,
  onConfig,
  onExpand,
  onRefresh,
  onExport,
  actions,
}) => {
  return (
    <div 
      className={clsx(
        'bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-all duration-200',
        'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600',
        isExpanded && 'fixed inset-4 z-50 shadow-2xl',
        height,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {icon && (
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Widget Actions */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Custom Actions */}
          {actions}
          
          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
          )}

          {/* Export */}
          {onExport && config?.exportable && (
            <button
              onClick={onExport}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Export data"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* Configure */}
          {onConfig && config?.configurable && !isEditing && (
            <button
              onClick={onConfig}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Configure widget"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Expand/Minimize */}
          {onExpand && (
            <button
              onClick={onExpand}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Remove (only in editing mode) */}
          {isEditing && onRemove && (
            <button
              onClick={onRemove}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Remove widget"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 h-[calc(100%-5rem)] relative">
        {/* Error State */}
        {error && (
          <div className="absolute inset-4 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <X className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                Failed to load widget
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                {error}
              </p>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="mt-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm rounded-lg transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="absolute inset-4 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Loading...
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        {!isLoading && !error && (
          <div className="h-full">
            {children}
          </div>
        )}
      </div>

      {/* Expanded Mode Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onExpand}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export default BaseWidget

// Widget configuration types
export interface WidgetConfigOption {
  key: string
  label: string
  type: 'select' | 'toggle' | 'range' | 'input'
  value: any
  options?: Array<{ label: string; value: any }>
  min?: number
  max?: number
  step?: number
}

export interface WidgetMetadata {
  id: string
  type: string
  title: string
  description: string
  category: 'productivity' | 'analytics' | 'team' | 'personal' | 'system'
  tags: string[]
  minWidth?: number
  minHeight?: number
  defaultConfig: BaseWidgetConfig
  configOptions: WidgetConfigOption[]
}

// Common widget utilities
export const widgetUtils = {
  formatNumber: (value: number, precision = 0): string => {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(precision)}B`
    }
    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(precision)}M`
    }
    if (value >= 1e3) {
      return `${(value / 1e3).toFixed(precision)}K`
    }
    return value.toFixed(precision)
  },

  formatPercent: (value: number, precision = 1): string => {
    return `${value.toFixed(precision)}%`
  },

  formatDuration: (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`
    }
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m`
    }
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  },

  getTrendColor: (trend: 'up' | 'down' | 'stable'): string => {
    switch (trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400'
      case 'down':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  },

  getTrendIcon: (trend: 'up' | 'down' | 'stable'): string => {
    switch (trend) {
      case 'up':
        return '↗'
      case 'down':
        return '↘'
      default:
        return '→'
    }
  },
}