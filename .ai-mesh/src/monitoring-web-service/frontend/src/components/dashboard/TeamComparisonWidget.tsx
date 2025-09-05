import React, { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Users, X, Medal, Award, Trophy } from 'lucide-react'
import { useAppSelector } from '../../store'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface TeamComparisonWidgetProps {
  config: {
    chartType?: 'bar' | 'horizontal-bar'
    metricType?: string
    showRankings?: boolean
  }
  isEditing?: boolean
  onRemove?: () => void
}

const TeamComparisonWidget: React.FC<TeamComparisonWidgetProps> = ({
  config,
  isEditing,
  onRemove,
}) => {
  const { teamComparisons, isLoading } = useAppSelector((state) => state.metrics)
  const { theme } = useAppSelector((state) => state.ui)
  const [chartData, setChartData] = useState<any>(null)
  const [topTeams, setTopTeams] = useState<any[]>([])

  useEffect(() => {
    // Generate sample data for demo
    const generateSampleTeamData = () => {
      const teams = [
        { name: 'Frontend Team', score: 92, members: 5, trend: 'up' },
        { name: 'Backend Team', score: 88, members: 4, trend: 'up' },
        { name: 'DevOps Team', score: 85, members: 3, trend: 'stable' },
        { name: 'QA Team', score: 81, members: 4, trend: 'down' },
        { name: 'Mobile Team', score: 78, members: 6, trend: 'up' },
        { name: 'Data Team', score: 75, members: 3, trend: 'stable' },
      ]

      return teams.sort((a, b) => b.score - a.score)
    }

    const sampleTeams = generateSampleTeamData()
    setTopTeams(sampleTeams)

    const isDark = theme === 'dark'
    
    // Create gradient colors for bars
    const colors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Yellow
      '#ef4444', // Red
      '#8b5cf6', // Purple
      '#06b6d4', // Cyan
    ]

    setChartData({
      labels: sampleTeams.map(team => team.name),
      datasets: [
        {
          label: 'Productivity Score',
          data: sampleTeams.map(team => team.score),
          backgroundColor: colors.map(color => `${color}80`), // Add transparency
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    })
  }, [theme, teamComparisons])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
        titleColor: theme === 'dark' ? '#f1f5f9' : '#1e293b',
        bodyColor: theme === 'dark' ? '#cbd5e1' : '#475569',
        borderColor: theme === 'dark' ? '#475569' : '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (context: any) => {
            const team = topTeams[context[0].dataIndex]
            return `${team.name} (${team.members} members)`
          },
          label: (context: any) => {
            return `Productivity Score: ${context.parsed.y}%`
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: theme === 'dark' ? '#374151' : '#f1f5f9',
          drawBorder: false,
        },
        ticks: {
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        display: true,
        min: 0,
        max: 100,
        grid: {
          color: theme === 'dark' ? '#374151' : '#f1f5f9',
          drawBorder: false,
        },
        ticks: {
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          callback: (value: any) => `${value}%`,
        },
      },
    },
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-4 h-4 text-yellow-500" />
      case 1:
        return <Medal className="w-4 h-4 text-gray-400" />
      case 2:
        return <Award className="w-4 h-4 text-amber-600" />
      default:
        return <span className="w-4 h-4 flex items-center justify-center text-xs font-bold text-gray-500">#{index + 1}</span>
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-500'
      case 'down':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className="h-full bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 relative">
      {isEditing && onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 z-10 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Team Comparison
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Productivity scores by team
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100%-5rem)]">
        {/* Chart */}
        <div className="h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : chartData ? (
            <Bar data={chartData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
              No data available
            </div>
          )}
        </div>

        {/* Rankings */}
        <div className="space-y-2 overflow-y-auto">
          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
            Team Rankings
          </h4>
          {topTeams.map((team, index) => (
            <div 
              key={team.name} 
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"
            >
              <div className="flex items-center space-x-3">
                {getRankIcon(index)}
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {team.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {team.members} members
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {team.score}%
                </p>
                <div className={`text-xs ${getTrendColor(team.trend)}`}>
                  {team.trend === 'up' ? '↗' : team.trend === 'down' ? '↘' : '→'} 
                  {team.trend}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TeamComparisonWidget