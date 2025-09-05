import React, { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js'
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react'
import { useAppSelector } from '../../store'
import { format, subDays } from 'date-fns'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
)

interface ProductivityTrendsWidgetProps {
  config: {
    chartType?: 'line' | 'area'
    metricType?: string
    timeRange?: '7d' | '30d' | '90d'
  }
  isEditing?: boolean
  onRemove?: () => void
}

const ProductivityTrendsWidget: React.FC<ProductivityTrendsWidgetProps> = ({
  config,
  isEditing,
  onRemove,
}) => {
  const { productivityTrends, isLoading } = useAppSelector((state) => state.metrics)
  const { theme } = useAppSelector((state) => state.ui)
  const [chartData, setChartData] = useState<any>(null)
  const [summary, setSummary] = useState({
    currentValue: 0,
    previousValue: 0,
    changePercent: 0,
    trend: 'stable' as 'up' | 'down' | 'stable'
  })

  useEffect(() => {
    // Generate sample data for demo (replace with real API data)
    const generateSampleData = () => {
      const days = 30
      const labels = []
      const data = []
      
      for (let i = days - 1; i >= 0; i--) {
        labels.push(format(subDays(new Date(), i), 'MMM dd'))
        // Generate sample productivity scores with some variance
        const baseScore = 75
        const variance = Math.random() * 20 - 10
        const trendBoost = i < days/2 ? (days/2 - i) * 0.5 : 0 // Upward trend in recent days
        data.push(Math.max(0, Math.min(100, baseScore + variance + trendBoost)))
      }
      
      return { labels, data }
    }

    const sampleData = generateSampleData()
    
    // Calculate summary stats
    const currentValue = sampleData.data[sampleData.data.length - 1]
    const previousValue = sampleData.data[sampleData.data.length - 8] // 7 days ago
    const changePercent = ((currentValue - previousValue) / previousValue) * 100
    const trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable'
    
    setSummary({
      currentValue: Math.round(currentValue),
      previousValue: Math.round(previousValue),
      changePercent: Math.round(changePercent * 10) / 10,
      trend
    })

    const isDark = theme === 'dark'
    
    setChartData({
      labels: sampleData.labels,
      datasets: [
        {
          label: 'Productivity Score',
          data: sampleData.data,
          borderColor: '#3b82f6',
          backgroundColor: config.chartType === 'area' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          borderWidth: 2,
          fill: config.chartType === 'area',
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
        },
      ],
    })
  }, [config.chartType, theme, productivityTrends])

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
        displayColors: false,
        callbacks: {
          title: (context: any) => {
            return `${context[0].label}`
          },
          label: (context: any) => {
            return `Productivity Score: ${Math.round(context.parsed.y)}%`
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
          maxTicksLimit: 8,
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
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }

  const getTrendIcon = () => {
    switch (summary.trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />
      default:
        return <Minus className="w-4 h-4 text-gray-500" />
    }
  }

  const getTrendColor = () => {
    switch (summary.trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400'
      case 'down':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
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
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Productivity Trends
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            30-day productivity score trend
          </p>
        </div>
        
        <div className="text-right">
          <div className="flex items-center space-x-1">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary.currentValue}%
            </span>
            {getTrendIcon()}
          </div>
          <div className={`text-sm ${getTrendColor()}`}>
            {summary.changePercent > 0 ? '+' : ''}{summary.changePercent}% vs last week
          </div>
        </div>
      </div>

      <div className="h-[calc(100%-5rem)]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : chartData ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
            No data available
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductivityTrendsWidget