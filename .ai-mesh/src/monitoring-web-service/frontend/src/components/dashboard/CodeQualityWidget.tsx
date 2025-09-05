import React from 'react'
import { Shield, X } from 'lucide-react'

interface CodeQualityWidgetProps {
  config: Record<string, any>
  isEditing?: boolean
  onRemove?: () => void
}

const CodeQualityWidget: React.FC<CodeQualityWidgetProps> = ({ config, isEditing, onRemove }) => {
  return (
    <div className="h-full bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 relative">
      {isEditing && onRemove && (
        <button onClick={onRemove} className="absolute top-2 right-2 z-10 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full">
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-center space-x-2 mb-4">
        <Shield className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Code Quality</h3>
      </div>
      <div className="flex items-center justify-center h-[calc(100%-3rem)] text-slate-500">
        Code quality metrics
      </div>
    </div>
  )
}

export default CodeQualityWidget