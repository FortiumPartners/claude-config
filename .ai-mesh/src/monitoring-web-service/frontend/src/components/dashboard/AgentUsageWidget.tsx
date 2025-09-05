import React, { useEffect, useState } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Bot, X } from 'lucide-react'
import { useAppSelector } from '../../store'

ChartJS.register(ArcElement, Tooltip, Legend)

interface AgentUsageWidgetProps {
  config: Record<string, any>
  isEditing?: boolean
  onRemove?: () => void
}

const AgentUsageWidget: React.FC<AgentUsageWidgetProps> = ({ config, isEditing, onRemove }) => {
  const { agentInteractions, isLoading } = useAppSelector((state) => state.metrics)
  const { theme } = useAppSelector((state) => state.ui)
  const [chartData, setChartData] = useState<any>(null)

  useEffect(() => {
    // Sample agent usage data
    const agentData = [
      { name: 'code-reviewer', usage: 35, color: '#3b82f6' },
      { name: 'frontend-developer', usage: 28, color: '#10b981' },
      { name: 'backend-developer', usage: 22, color: '#f59e0b' },
      { name: 'test-runner', usage: 15, color: '#ef4444' },
    ]

    setChartData({
      labels: agentData.map(agent => agent.name),
      datasets: [{
        data: agentData.map(agent => agent.usage),
        backgroundColor: agentData.map(agent => agent.color),
        borderWidth: 2,
        borderColor: theme === 'dark' ? '#1e293b' : '#ffffff',
      }],
    })
  }, [theme, agentInteractions])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: theme === 'dark' ? '#cbd5e1' : '#475569',
          usePointStyle: true,
        },
      },
    },
  }

  return (
    <div className="h-full bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 relative">
      {isEditing && onRemove && (
        <button onClick={onRemove} className="absolute top-2 right-2 z-10 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full">
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-center space-x-2 mb-4">
        <Bot className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Agent Usage</h3>
      </div>
      <div className="h-[calc(100%-3rem)]">
        {chartData && <Doughnut data={chartData} options={chartOptions} />}
      </div>
    </div>
  )
}

export default AgentUsageWidget