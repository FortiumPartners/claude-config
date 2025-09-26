import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { store } from './store'
import { AuthProvider } from './contexts/AuthContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { TenantProvider } from './contexts/TenantContext'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import './styles/index.css'

// Lazy load React Query DevTools only in development
const ReactQueryDevtools = import.meta.env.DEV
  ? React.lazy(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })))
  : null

// Enhanced React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 401/403 errors (authentication issues)
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          return false
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnReconnect: true,
      refetchIntervalInBackground: false,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Enhanced toast configuration
const toastOptions = {
  duration: 4000,
  position: 'top-right' as const,
  style: {
    borderRadius: '8px',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--card-foreground))',
    border: '1px solid hsl(var(--border))',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  success: {
    iconTheme: {
      primary: 'hsl(var(--primary))',
      secondary: 'hsl(var(--primary-foreground))',
    },
  },
  error: {
    iconTheme: {
      primary: 'hsl(var(--destructive))',
      secondary: 'hsl(var(--destructive-foreground))',
    },
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <TenantProvider>
                <WebSocketProvider>
                  <App />
                  <Toaster {...toastOptions} />
                  {import.meta.env.DEV && ReactQueryDevtools && (
                    <React.Suspense fallback={null}>
                      <ReactQueryDevtools />
                    </React.Suspense>
                  )}
                </WebSocketProvider>
              </TenantProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
)