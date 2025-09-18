import React from 'react'
import { Menu, Search, Bell, User, Settings, LogOut, Monitor } from 'lucide-react'
import { useAppSelector, useAppDispatch } from '../../store'
import { toggleSidebar, setGlobalSearch, openModal } from '../../store/slices/uiSlice'
import { logout } from '../../store/slices/authSlice'
import { useAuth } from '../../contexts/AuthContext'
import TenantSwitcher from './TenantSwitcher'

const Header: React.FC = () => {
  const dispatch = useAppDispatch()
  const { user, organization } = useAppSelector((state) => state.auth)
  const { globalSearch, notifications, connectionStatus } = useAppSelector((state) => state.ui)
  const { logout: authLogout } = useAuth()

  const unreadNotifications = notifications.filter(n => !n.read).length

  const handleLogout = async () => {
    try {
      await authLogout()
      dispatch(logout())
    } catch (error) {
      console.error('Logout error:', error)
      dispatch(logout()) // Force logout on error
    }
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-500'
      case 'connecting':
        return 'text-yellow-500 animate-pulse'
      case 'disconnected':
        return 'text-red-500'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-400'
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'disconnected':
        return 'Disconnected'
      case 'error':
        return 'Connection Error'
      default:
        return 'Unknown'
    }
  }

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between shadow-sm">
      {/* Left side - Menu toggle and logo */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
        
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-semibold text-slate-900 dark:text-white">
              Fortium Metrics
            </h1>
            {organization && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {organization.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Center - Search */}
      <div className="flex-1 max-w-2xl mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search dashboards, metrics, users..."
            value={globalSearch}
            onChange={(e) => dispatch(setGlobalSearch(e.target.value))}
            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border-0 rounded-lg text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
          />
        </div>
      </div>

      {/* Tenant Switcher */}
      <div className="hidden lg:block">
        <TenantSwitcher />
      </div>

      {/* Right side - Connection status, notifications, user menu */}
      <div className="flex items-center space-x-3">
        {/* Connection Status */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
          <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`} />
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {getConnectionStatusText()}
          </span>
        </div>

        {/* Notifications */}
        <button
          onClick={() => dispatch(openModal('notifications'))}
          className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>

        {/* User Menu */}
        <div className="relative group">
          <button
            onClick={() => dispatch(openModal('userProfile'))}
            className="flex items-center space-x-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="User menu"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={`${user.first_name} ${user.last_name}`}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {user?.role}
              </p>
            </div>
          </button>

          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="py-2">
              <button
                onClick={() => dispatch(openModal('userProfile'))}
                className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Profile</span>
              </button>
              <button
                onClick={() => dispatch(openModal('dashboardSettings'))}
                className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <hr className="my-2 border-slate-200 dark:border-slate-700" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header