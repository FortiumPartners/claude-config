import React from 'react'
import { BarChart3 } from 'lucide-react'

const AnalyticsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <BarChart3 className="w-8 h-8 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
          <p className="text-slate-600 dark:text-slate-400">Deep dive into your productivity metrics</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Advanced Analytics Coming Soon
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Detailed productivity analysis, trend forecasting, and team insights will be available here.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPage