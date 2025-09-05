import React from 'react'
import { Settings } from 'lucide-react'

const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Settings className="w-8 h-8 text-slate-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-600 dark:text-slate-400">Configure your dashboard and preferences</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <div className="text-center">
          <Settings className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Settings Panel Coming Soon
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Customize your dashboard, notification preferences, and account settings.
          </p>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage