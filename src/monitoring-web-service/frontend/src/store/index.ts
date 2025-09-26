import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import type { TypedUseSelectorHook } from 'react-redux'

// Import slices
import dashboardSlice from './slices/dashboardSlice'
import metricsSlice from './slices/metricsSlice'
import authSlice from './slices/authSlice'
import uiSlice from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    dashboard: dashboardSlice,
    metrics: metricsSlice,
    auth: authSlice,
    ui: uiSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredPaths: [
          // Ignore date fields that are now ISO strings but might still trigger warnings
          'dashboard.currentDashboard.filters.date_range.start',
          'dashboard.currentDashboard.filters.date_range.end',
          'dashboard.currentDashboard.created_at',
          'dashboard.currentDashboard.updated_at',
          'dashboard.dashboards.*.filters.date_range.start',
          'dashboard.dashboards.*.filters.date_range.end',
          'dashboard.dashboards.*.created_at',
          'dashboard.dashboards.*.updated_at',
          // Ignore activity stream timestamp fields
          'activities.*.timestamp',
          'activities.lastUpdate',
        ],
      },
    }),
  devTools: import.meta.env.DEV,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector