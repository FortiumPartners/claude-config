import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../../store'
import { setScreenSize, setConnectionStatus } from '../../store/slices/uiSlice'
import { useWebSocket } from '../../contexts/WebSocketContext'
import Header from './Header'
import Sidebar from './Sidebar'
import ConnectionStatus from '../ui/ConnectionStatus'
import NotificationToaster from '../ui/NotificationToaster'

const DashboardLayout: React.FC = () => {
  const dispatch = useAppDispatch()
  const { sidebarOpen, screenSize, theme } = useAppSelector((state) => state.ui)
  const { isConnected, isConnecting, error } = useWebSocket()

  // Handle screen size changes
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width < 768) {
        dispatch(setScreenSize('mobile'))
      } else if (width < 1024) {
        dispatch(setScreenSize('tablet'))
      } else {
        dispatch(setScreenSize('desktop'))
      }
    }

    handleResize() // Check initial size
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [dispatch])

  // Handle WebSocket connection status
  useEffect(() => {
    if (error) {
      dispatch(setConnectionStatus('error'))
    } else if (isConnecting) {
      dispatch(setConnectionStatus('connecting'))
    } else if (isConnected) {
      dispatch(setConnectionStatus('connected'))
    } else {
      dispatch(setConnectionStatus('disconnected'))
    }
  }, [isConnected, isConnecting, error, dispatch])

  // Apply theme class to body
  useEffect(() => {
    const body = document.body
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    
    if (isDark) {
      body.classList.add('dark')
    } else {
      body.classList.remove('dark')
    }
  }, [theme])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Header */}
      <Header />
      
      <div className="flex h-[calc(100vh-4rem)]"> {/* 4rem for header height */}
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content Area */}
        <main 
          className={`
            flex-1 overflow-hidden transition-all duration-300 ease-in-out
            ${sidebarOpen && screenSize !== 'mobile' ? 'ml-0' : ''}
          `}
        >
          <div className="h-full overflow-auto">
            <div className="p-6">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* Global UI Components */}
      <ConnectionStatus />
      <NotificationToaster />
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && screenSize === 'mobile' && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => dispatch(setScreenSize('mobile'))}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export default DashboardLayout