import { configureStore } from '@reduxjs/toolkit'
import dashboardReducer, {
  setCurrentDashboard,
  addWidget,
  updateWidget,
  removeWidget,
  updateLayout,
  setIsEditing,
  setIsLoading,
  clearError,
} from '../../store/slices/dashboardSlice'
import { DashboardConfig, DashboardWidget } from '../../types/api'

const createTestStore = () => {
  return configureStore({
    reducer: {
      dashboard: dashboardReducer,
    },
  })
}

const mockDashboard: DashboardConfig = {
  id: 'dashboard-1',
  name: 'Test Dashboard',
  user_id: 'user-1',
  organization_id: 'org-1',
  layout: [
    {
      id: 'widget-1',
      type: 'chart',
      title: 'Test Widget',
      position: { x: 0, y: 0, w: 4, h: 3 },
      config: {},
      data_source: 'test-source',
    },
  ],
  filters: {
    date_range: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
      preset: '30d',
    },
  },
  is_default: false,
  is_shared: false,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
}

const mockWidget: DashboardWidget = {
  id: 'widget-2',
  type: 'metric',
  title: 'New Widget',
  position: { x: 4, y: 0, w: 4, h: 3 },
  config: { color: 'blue' },
  data_source: 'new-source',
}

describe('dashboardSlice', () => {
  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = createTestStore()
      const state = store.getState().dashboard

      expect(state.currentDashboard).toBeNull()
      expect(state.dashboards).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.layout).toEqual([])
      expect(state.isEditing).toBe(false)
      expect(state.isDragEnabled).toBe(true)
      expect(state.selectedWidget).toBeNull()
    })
  })

  describe('dashboard management', () => {
    it('should set current dashboard and generate layout', () => {
      const store = createTestStore()
      
      store.dispatch(setCurrentDashboard(mockDashboard))
      
      const state = store.getState().dashboard
      expect(state.currentDashboard).toEqual(mockDashboard)
      expect(state.layout).toHaveLength(1)
      expect(state.layout[0]).toEqual({
        i: 'widget-1',
        x: 0,
        y: 0,
        w: 4,
        h: 3,
        minW: 2,
        minH: 2,
        maxW: 12,
        maxH: 12,
      })
    })
  })

  describe('widget management', () => {
    it('should add widget to dashboard', () => {
      const store = createTestStore()
      
      // Set up dashboard first
      store.dispatch(setCurrentDashboard(mockDashboard))
      
      // Add new widget
      store.dispatch(addWidget(mockWidget))
      
      const state = store.getState().dashboard
      expect(state.currentDashboard?.layout).toHaveLength(2)
      expect(state.layout).toHaveLength(2)
      
      const newLayoutItem = state.layout.find(item => item.i === 'widget-2')
      expect(newLayoutItem).toBeDefined()
      expect(newLayoutItem?.x).toBe(4)
      expect(newLayoutItem?.y).toBe(0)
    })

    it('should update widget position and properties', () => {
      const store = createTestStore()
      
      // Set up dashboard
      store.dispatch(setCurrentDashboard(mockDashboard))
      
      // Update widget
      const updatedWidget: DashboardWidget = {
        ...mockDashboard.layout[0],
        title: 'Updated Widget',
        position: { x: 2, y: 1, w: 6, h: 4 },
      }
      
      store.dispatch(updateWidget(updatedWidget))
      
      const state = store.getState().dashboard
      const widget = state.currentDashboard?.layout[0]
      
      expect(widget?.title).toBe('Updated Widget')
      expect(widget?.position.x).toBe(2)
      expect(widget?.position.y).toBe(1)
      expect(widget?.position.w).toBe(6)
      expect(widget?.position.h).toBe(4)
      
      // Check layout was also updated
      const layoutItem = state.layout.find(item => item.i === 'widget-1')
      expect(layoutItem?.x).toBe(2)
      expect(layoutItem?.y).toBe(1)
      expect(layoutItem?.w).toBe(6)
      expect(layoutItem?.h).toBe(4)
    })

    it('should remove widget from dashboard', () => {
      const store = createTestStore()
      
      // Set up dashboard with widget
      store.dispatch(setCurrentDashboard(mockDashboard))
      
      // Remove widget
      store.dispatch(removeWidget('widget-1'))
      
      const state = store.getState().dashboard
      expect(state.currentDashboard?.layout).toHaveLength(0)
      expect(state.layout).toHaveLength(0)
      expect(state.selectedWidget).toBeNull()
    })
  })

  describe('layout management', () => {
    it('should update layout and sync with widgets', () => {
      const store = createTestStore()
      
      // Set up dashboard
      store.dispatch(setCurrentDashboard(mockDashboard))
      
      // Update layout
      const newLayout = [
        {
          i: 'widget-1',
          x: 8,
          y: 2,
          w: 4,
          h: 3,
          minW: 2,
          minH: 2,
          maxW: 12,
          maxH: 12,
        },
      ]
      
      store.dispatch(updateLayout(newLayout))
      
      const state = store.getState().dashboard
      expect(state.layout).toEqual(newLayout)
      
      // Check widget position was updated
      const widget = state.currentDashboard?.layout[0]
      expect(widget?.position.x).toBe(8)
      expect(widget?.position.y).toBe(2)
    })
  })

  describe('UI state management', () => {
    it('should toggle edit mode', () => {
      const store = createTestStore()
      
      store.dispatch(setIsEditing(true))
      
      let state = store.getState().dashboard
      expect(state.isEditing).toBe(true)
      expect(state.isDragEnabled).toBe(true)
      
      store.dispatch(setIsEditing(false))
      
      state = store.getState().dashboard
      expect(state.isEditing).toBe(false)
      expect(state.isDragEnabled).toBe(false)
    })

    it('should handle loading state', () => {
      const store = createTestStore()
      
      store.dispatch(setIsLoading(true))
      
      const state = store.getState().dashboard
      expect(state.isLoading).toBe(true)
    })

    it('should clear error', () => {
      const store = createTestStore()
      
      // First set an error (this would normally happen in an async action)
      const initialState = store.getState().dashboard
      expect(initialState.error).toBeNull()
      
      store.dispatch(clearError())
      
      const state = store.getState().dashboard
      expect(state.error).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle adding widget when no current dashboard', () => {
      const store = createTestStore()
      
      // Try to add widget without setting dashboard first
      store.dispatch(addWidget(mockWidget))
      
      const state = store.getState().dashboard
      expect(state.currentDashboard).toBeNull()
      expect(state.layout).toEqual([])
    })

    it('should handle updating non-existent widget', () => {
      const store = createTestStore()
      
      store.dispatch(setCurrentDashboard(mockDashboard))
      
      // Try to update widget that doesn't exist
      const nonExistentWidget: DashboardWidget = {
        id: 'non-existent',
        type: 'chart',
        title: 'Non-existent',
        position: { x: 0, y: 0, w: 4, h: 3 },
        config: {},
        data_source: 'test',
      }
      
      store.dispatch(updateWidget(nonExistentWidget))
      
      const state = store.getState().dashboard
      expect(state.currentDashboard?.layout).toHaveLength(1) // Still only original widget
    })

    it('should handle removing non-existent widget', () => {
      const store = createTestStore()
      
      store.dispatch(setCurrentDashboard(mockDashboard))
      
      // Try to remove widget that doesn't exist
      store.dispatch(removeWidget('non-existent'))
      
      const state = store.getState().dashboard
      expect(state.currentDashboard?.layout).toHaveLength(1) // Still has original widget
    })

    it('should handle layout update with non-matching widgets', () => {
      const store = createTestStore()
      
      store.dispatch(setCurrentDashboard(mockDashboard))
      
      // Update layout with different widget ID
      const newLayout = [
        {
          i: 'different-widget',
          x: 0,
          y: 0,
          w: 4,
          h: 3,
          minW: 2,
          minH: 2,
          maxW: 12,
          maxH: 12,
        },
      ]
      
      store.dispatch(updateLayout(newLayout))
      
      const state = store.getState().dashboard
      expect(state.layout).toEqual(newLayout)
      
      // Original widget position should remain unchanged
      const widget = state.currentDashboard?.layout[0]
      expect(widget?.position.x).toBe(0) // Original position
    })
  })
})