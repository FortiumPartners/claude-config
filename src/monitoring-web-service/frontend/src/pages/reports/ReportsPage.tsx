import React from 'react'
import { FileText } from 'lucide-react'

const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <FileText className="w-8 h-8 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-slate-600 dark:text-slate-400">Generate and export productivity reports</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Report Generation Coming Soon
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Create custom reports and export them in various formats (PDF, CSV, Excel).
          </p>
        </div>
      </div>
    </div>
  )
}

export default ReportsPage