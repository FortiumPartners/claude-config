import React, { useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'
import { useAppSelector, useAppDispatch } from '../../store'
import { removeNotification } from '../../store/slices/uiSlice'

const NotificationToaster: React.FC = () => {
  const dispatch = useAppDispatch()
  const { notifications } = useAppSelector((state) => state.ui)

  useEffect(() => {
    // Process new notifications
    notifications.forEach(notification => {
      if (!notification.id) return

      const getIcon = () => {
        switch (notification.type) {
          case 'success':
            return <CheckCircle className="w-5 h-5 text-green-500" />
          case 'error':
            return <XCircle className="w-5 h-5 text-red-500" />
          case 'warning':
            return <AlertCircle className="w-5 h-5 text-yellow-500" />
          case 'info':
            return <Info className="w-5 h-5 text-blue-500" />
          default:
            return <Info className="w-5 h-5 text-gray-500" />
        }
      }

      const customToast = (
        <div className="flex items-start space-x-3 max-w-md">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {notification.title}
            </p>
            {notification.message && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {notification.message}
              </p>
            )}
          </div>
        </div>
      )

      const toastOptions = {
        duration: notification.duration || (notification.type === 'error' ? 6000 : 4000),
        style: {
          background: 'white',
          color: '#374151',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '16px',
        },
        onSuccess: () => {
          dispatch(removeNotification(notification.id))
        },
        onError: () => {
          dispatch(removeNotification(notification.id))
        },
      }

      // Show different toast types
      switch (notification.type) {
        case 'success':
          toast.success(customToast, toastOptions)
          break
        case 'error':
          toast.error(customToast, toastOptions)
          break
        case 'warning':
          toast(customToast, toastOptions)
          break
        case 'info':
        default:
          toast(customToast, toastOptions)
          break
      }
    })
  }, [notifications, dispatch])

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: '',
        duration: 4000,
        style: {
          background: 'transparent',
          boxShadow: 'none',
          padding: 0,
          margin: 0,
        },
      }}
      containerStyle={{
        top: 80, // Account for header height
        right: 20,
      }}
    />
  )
}

export default NotificationToaster