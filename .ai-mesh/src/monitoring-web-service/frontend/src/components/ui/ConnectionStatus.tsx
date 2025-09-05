import React from 'react'
import { Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react'
import { useAppSelector } from '../../store'
import { useWebSocket } from '../../contexts/WebSocketContext'
import { clsx } from 'clsx'

const ConnectionStatus: React.FC = () => {
  const { connectionStatus } = useAppSelector((state) => state.ui)
  const { reconnect } = useWebSocket()

  if (connectionStatus === 'connected') {
    return null // Don't show anything when connected
  }

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connecting':
        return {
          icon: RefreshCw,
          text: 'Connecting to real-time updates...',
          bgColor: 'bg-yellow-50 border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
          animate: true,
        }
      case 'disconnected':
        return {
          icon: WifiOff,
          text: 'Real-time updates disconnected',
          bgColor: 'bg-orange-50 border-orange-200',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-600',
          animate: false,
        }
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Connection error - real-time updates unavailable',
          bgColor: 'bg-red-50 border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          animate: false,
        }
      default:
        return {
          icon: WifiOff,
          text: 'Connection status unknown',
          bgColor: 'bg-gray-50 border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
          animate: false,
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm">
      <div className={clsx(
        'flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg',
        config.bgColor
      )}>
        <Icon 
          className={clsx(
            'w-5 h-5', 
            config.iconColor,
            config.animate && 'animate-spin'
          )} 
        />
        <div className="flex-1">
          <p className={clsx('text-sm font-medium', config.textColor)}>
            {config.text}
          </p>
          {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
            <button
              onClick={reconnect}
              className="text-xs underline hover:no-underline mt-1 focus:outline-none"
            >
              Try reconnecting
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConnectionStatus