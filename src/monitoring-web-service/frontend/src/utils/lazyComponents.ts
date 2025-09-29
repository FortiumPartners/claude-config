import { lazy } from 'react'

// Lazy load dashboard widgets for better code splitting
export const ProductivityTrendsWidget = lazy(() => import('../components/dashboard/ProductivityTrendsWidget'))
export const TeamComparisonWidget = lazy(() => import('../components/dashboard/TeamComparisonWidget'))
export const AgentUsageWidget = lazy(() => import('../components/dashboard/AgentUsageWidget'))
export const TaskCompletionWidget = lazy(() => import('../components/dashboard/TaskCompletionWidget'))
export const CodeQualityWidget = lazy(() => import('../components/dashboard/CodeQualityWidget'))
export const RealTimeActivityFeed = lazy(() => import('../components/dashboard/RealTimeActivityFeed'))
export const MetricCardWidget = lazy(() => import('../components/dashboard/MetricCardWidget'))

// Lazy load heavy chart libraries
export const ResponsiveGridLayout = lazy(async () => {
  const { Responsive, WidthProvider } = await import('react-grid-layout')
  return { default: WidthProvider(Responsive) }
})

// Chart components with dynamic imports for better bundle splitting
export const Chart = lazy(() =>
  import('chart.js/auto').then(({ default: Chart }) => {
    // Only register required components to reduce bundle size
    return import('react-chartjs-2').then((module) => ({
      default: module.Line
    }))
  })
)

export const RechartsLineChart = lazy(() =>
  import('recharts').then((module) => ({
    default: module.LineChart
  }))
)

export const RechartsBarChart = lazy(() =>
  import('recharts').then((module) => ({
    default: module.BarChart
  }))
)

export const RechartsPieChart = lazy(() =>
  import('recharts').then((module) => ({
    default: module.PieChart
  }))
)