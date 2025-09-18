import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  UserCheck, 
  FileText, 
  Settings,
  Puzzle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useAppSelector, useAppDispatch } from '../../store'
import { toggleSidebarCollapsed } from '../../store/slices/uiSlice'
import { clsx } from 'clsx'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
  badge?: string
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    name: 'Teams',
    href: '/teams',
    icon: Users,
    roles: ['admin', 'manager'],
  },
  {
    name: 'Users',
    href: '/users',
    icon: UserCheck,
    roles: ['admin'],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: FileText,
  },
  {
    name: 'Integration',
    href: '/integration',
    icon: Puzzle,
    roles: ['admin'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch()
  const { sidebarOpen, sidebarCollapsed, screenSize } = useAppSelector((state) => state.ui)
  const { user } = useAppSelector((state) => state.auth)
  const location = useLocation()

  const filteredNavigation = navigation.filter(item => {
    if (!item.roles) return true
    return user?.role && item.roles.includes(user.role)
  })

  if (!sidebarOpen && screenSize === 'mobile') {
    return null
  }

  return (
    <>
      <aside
        className={clsx(
          'fixed lg:relative top-0 left-0 z-40 h-screen bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 ease-in-out',
          {
            'w-64': !sidebarCollapsed,
            'w-16': sidebarCollapsed,
            'translate-x-0': sidebarOpen || screenSize !== 'mobile',
            '-translate-x-full': !sidebarOpen && screenSize === 'mobile',
          }
        )}
      >
        <div className="flex flex-col h-full">
          {/* Collapse toggle button */}
          <div className="flex items-center justify-end p-4 lg:block hidden">
            <button
              onClick={() => dispatch(toggleSidebarCollapsed())}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 pb-4 space-y-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href

              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive: navLinkActive }) =>
                    clsx(
                      'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                      {
                        'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 border-r-2 border-blue-500':
                          navLinkActive,
                        'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700':
                          !navLinkActive,
                        'justify-center': sidebarCollapsed,
                      }
                    )
                  }
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <Icon
                    className={clsx('flex-shrink-0', {
                      'w-5 h-5': true,
                      'mr-3': !sidebarCollapsed,
                    })}
                  />
                  {!sidebarCollapsed && (
                    <span className="flex-1">{item.name}</span>
                  )}
                  {!sidebarCollapsed && item.badge && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* User info at bottom */}
          {!sidebarCollapsed && user && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-3">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={`${user.first_name || ''} ${user.last_name || ''}`}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {user.first_name?.charAt(0) || 'U'}{user.last_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {user.first_name || 'User'} {user.last_name || ''}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">
                    {user.role}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

export default Sidebar