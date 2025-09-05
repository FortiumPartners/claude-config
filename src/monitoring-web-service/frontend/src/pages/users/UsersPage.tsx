import React from 'react'
import { UserCheck } from 'lucide-react'

const UsersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <UserCheck className="w-8 h-8 text-purple-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Users</h1>
          <p className="text-slate-600 dark:text-slate-400">User management and permissions</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <div className="text-center">
          <UserCheck className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            User Management Coming Soon
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Manage user accounts, roles, and access permissions across your organization.
          </p>
        </div>
      </div>
    </div>
  )
}

export default UsersPage