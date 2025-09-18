import React, { ReactNode, useMemo } from 'react'
import { useAppSelector } from '../../store'
import { clsx } from 'clsx'

interface GridItem {
  id: string
  component: ReactNode
  span?: {
    mobile?: number
    tablet?: number
    desktop?: number
    large?: number
  }
  order?: {
    mobile?: number
    tablet?: number
    desktop?: number
    large?: number
  }
  minHeight?: string
  hidden?: {
    mobile?: boolean
    tablet?: boolean
    desktop?: boolean
    large?: boolean
  }
}

interface ResponsiveGridProps {
  items: GridItem[]
  className?: string
  gap?: 'sm' | 'md' | 'lg'
  columns?: {
    mobile?: number
    tablet?: number
    desktop?: number
    large?: number
  }
  autoFit?: boolean
  minItemWidth?: string
}

const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  items,
  className,
  gap = 'md',
  columns = {
    mobile: 1,
    tablet: 2,
    desktop: 3,
    large: 4,
  },
  autoFit = false,
  minItemWidth = '300px',
}) => {
  const { screenSize } = useAppSelector((state) => state.ui)

  const gapClasses = useMemo(() => {
    switch (gap) {
      case 'sm':
        return 'gap-3'
      case 'lg':
        return 'gap-8'
      default:
        return 'gap-6'
    }
  }, [gap])

  const gridClasses = useMemo(() => {
    if (autoFit) {
      return `grid-cols-[repeat(auto-fit,minmax(${minItemWidth},1fr))]`
    }

    return clsx(
      `grid-cols-${columns.mobile}`,
      `sm:grid-cols-${columns.tablet}`,
      `lg:grid-cols-${columns.desktop}`,
      `xl:grid-cols-${columns.large}`
    )
  }, [autoFit, minItemWidth, columns])

  const getItemClasses = (item: GridItem) => {
    const classes = []

    // Handle column spans
    if (item.span) {
      if (item.span.mobile && item.span.mobile > 1) {
        classes.push(`col-span-${item.span.mobile}`)
      }
      if (item.span.tablet && item.span.tablet > 1) {
        classes.push(`sm:col-span-${item.span.tablet}`)
      }
      if (item.span.desktop && item.span.desktop > 1) {
        classes.push(`lg:col-span-${item.span.desktop}`)
      }
      if (item.span.large && item.span.large > 1) {
        classes.push(`xl:col-span-${item.span.large}`)
      }
    }

    // Handle order
    if (item.order) {
      if (item.order.mobile) {
        classes.push(`order-${item.order.mobile}`)
      }
      if (item.order.tablet) {
        classes.push(`sm:order-${item.order.tablet}`)
      }
      if (item.order.desktop) {
        classes.push(`lg:order-${item.order.desktop}`)
      }
      if (item.order.large) {
        classes.push(`xl:order-${item.order.large}`)
      }
    }

    // Handle visibility
    if (item.hidden) {
      if (item.hidden.mobile) {
        classes.push('hidden sm:block')
      }
      if (item.hidden.tablet) {
        classes.push('sm:hidden lg:block')
      }
      if (item.hidden.desktop) {
        classes.push('lg:hidden xl:block')
      }
      if (item.hidden.large) {
        classes.push('xl:hidden')
      }
    }

    return classes.join(' ')
  }

  const getItemStyle = (item: GridItem) => {
    const style: React.CSSProperties = {}

    if (item.minHeight) {
      style.minHeight = item.minHeight
    }

    return style
  }

  return (
    <div 
      className={clsx(
        'grid',
        gridClasses,
        gapClasses,
        'w-full',
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={clsx(
            'w-full',
            getItemClasses(item)
          )}
          style={getItemStyle(item)}
        >
          {item.component}
        </div>
      ))}
    </div>
  )
}

// Helper component for creating grid items
interface GridItemWrapperProps {
  children: ReactNode
  className?: string
  padding?: boolean
  background?: boolean
  border?: boolean
  shadow?: boolean
  hover?: boolean
}

export const GridItemWrapper: React.FC<GridItemWrapperProps> = ({
  children,
  className,
  padding = true,
  background = true,
  border = true,
  shadow = true,
  hover = true,
}) => {
  return (
    <div
      className={clsx(
        'rounded-lg transition-all duration-200',
        padding && 'p-6',
        background && 'bg-white dark:bg-slate-800',
        border && 'border border-slate-200 dark:border-slate-700',
        shadow && 'shadow-sm',
        hover && 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600',
        className
      )}
    >
      {children}
    </div>
  )
}

// Predefined responsive breakpoints
export const responsiveBreakpoints = {
  mobile: {
    span: { mobile: 1 },
    order: { mobile: 1 },
  },
  tablet: {
    span: { mobile: 1, tablet: 1 },
    order: { mobile: 1, tablet: 1 },
  },
  desktop: {
    span: { mobile: 1, tablet: 1, desktop: 1 },
    order: { mobile: 1, tablet: 1, desktop: 1 },
  },
  full: {
    span: { mobile: 1, tablet: 2, desktop: 3, large: 4 },
    order: { mobile: 1 },
  },
  half: {
    span: { mobile: 1, tablet: 1, desktop: 1, large: 2 },
  },
  twoThirds: {
    span: { mobile: 1, tablet: 2, desktop: 2, large: 2 },
  },
  oneThird: {
    span: { mobile: 1, tablet: 1, desktop: 1, large: 1 },
  },
}

// Hook for responsive grid utilities
export const useResponsiveGrid = () => {
  const { screenSize } = useAppSelector((state) => state.ui)
  
  const getCurrentColumns = (columns: ResponsiveGridProps['columns']) => {
    switch (screenSize) {
      case 'mobile':
        return columns?.mobile || 1
      case 'tablet':
        return columns?.tablet || 2
      case 'desktop':
        return columns?.desktop || 3
      default:
        return columns?.large || 4
    }
  }

  const getSpanForScreen = (span?: GridItem['span']) => {
    if (!span) return 1
    
    switch (screenSize) {
      case 'mobile':
        return span.mobile || 1
      case 'tablet':
        return span.tablet || span.mobile || 1
      case 'desktop':
        return span.desktop || span.tablet || span.mobile || 1
      default:
        return span.large || span.desktop || span.tablet || span.mobile || 1
    }
  }

  const isHiddenOnScreen = (hidden?: GridItem['hidden']) => {
    if (!hidden) return false
    
    switch (screenSize) {
      case 'mobile':
        return hidden.mobile || false
      case 'tablet':
        return hidden.tablet || false
      case 'desktop':
        return hidden.desktop || false
      default:
        return hidden.large || false
    }
  }

  return {
    screenSize,
    getCurrentColumns,
    getSpanForScreen,
    isHiddenOnScreen,
  }
}

export default ResponsiveGrid