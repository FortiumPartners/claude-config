# External Metrics Web Service - Frontend Dashboard

A comprehensive React dashboard for real-time productivity analytics and team performance tracking, built as part of Fortium Partners' AI-augmented development process.

## 🚀 Features

### Real-Time Dashboard
- **Live Metrics Streaming**: Socket.io integration for real-time productivity updates
- **Drag-and-Drop Layout**: Fully customizable dashboard widgets with React Grid Layout
- **Responsive Design**: Mobile-first design supporting desktop, tablet, and mobile devices
- **Interactive Visualizations**: Chart.js-powered analytics with drill-down capabilities

### Core Widgets
- **Productivity Trends**: Time-series visualization of team productivity metrics
- **Team Comparison**: Cross-team performance analysis with rankings
- **Agent Usage**: AI agent utilization pie charts and usage statistics
- **Real-Time Activity**: Live development activity feed with user avatars
- **Code Quality**: Error rates, test coverage, and quality metrics
- **Task Completion**: Sprint and milestone progress tracking

### Enterprise Features
- **Role-Based Access**: Admin, Manager, and Developer role permissions
- **Multi-Tenant Support**: Organization-scoped data isolation
- **Theme Support**: Light/dark/system theme with accessibility compliance
- **JWT Authentication**: Secure authentication with automatic token refresh
- **Cross-Browser Compatibility**: Chrome, Firefox, Safari, Edge support

## 🛠 Technology Stack

### Frontend Framework
- **React 18**: Modern React with concurrent features and hooks
- **TypeScript**: Full type safety and enhanced developer experience
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first styling with custom design tokens

### State Management
- **Redux Toolkit**: Predictable state management with modern Redux patterns
- **React Query**: Server state management and caching
- **Context API**: Authentication and WebSocket state

### Real-Time & Networking
- **Socket.io Client**: Real-time bidirectional communication
- **Axios**: HTTP client with interceptors and automatic retries
- **WebSocket Fallback**: Automatic fallback to polling for compatibility

### UI Components & Visualization
- **Chart.js**: Interactive charts with customizable themes
- **React Grid Layout**: Drag-and-drop dashboard layout system
- **Lucide React**: Comprehensive icon library
- **Framer Motion**: Smooth animations and transitions

### Testing & Quality
- **Vitest**: Fast unit and integration testing
- **React Testing Library**: Component testing with accessibility focus
- **TypeScript ESLint**: Code quality and consistency
- **Coverage Reports**: 90%+ test coverage requirement

## 📁 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── dashboard/       # Dashboard-specific widgets
│   ├── layout/          # Layout components (Header, Sidebar)
│   └── ui/             # Generic UI components
├── contexts/            # React contexts for global state
│   ├── AuthContext.tsx  # Authentication state management
│   └── WebSocketContext.tsx # Real-time connection handling
├── hooks/               # Custom React hooks
├── pages/               # Route-based page components
│   ├── auth/           # Authentication pages
│   ├── dashboard/      # Main dashboard page
│   └── analytics/      # Deep analytics pages
├── services/            # API integration and external services
├── store/               # Redux store and slices
│   └── slices/         # Feature-specific state slices
├── types/               # TypeScript type definitions
├── utils/               # Utility functions and helpers
├── __tests__/           # Test files and test utilities
└── styles/              # Global styles and Tailwind config
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/FortiumPartners/claude-config.git
   cd claude-config/src/monitoring-web-service/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the frontend directory:
   ```bash
   VITE_API_URL=http://localhost:3001/api
   VITE_WS_URL=http://localhost:3001
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```
   Dashboard will be available at `http://localhost:3000`

### Development Commands

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check

# Clean build artifacts
npm run clean
```

## 🧪 Testing

### Test Strategy
- **Unit Tests**: Individual component and utility testing
- **Integration Tests**: Component interaction and Redux state testing  
- **E2E Tests**: Full user workflow testing with Playwright
- **Performance Tests**: Bundle size and runtime performance validation

### Running Tests
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm test -- --watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test ProductivityTrendsWidget.test.tsx
```

### Test Coverage Requirements
- **Components**: ≥90% coverage for all dashboard widgets
- **Store Logic**: ≥95% coverage for Redux slices
- **Utilities**: ≥90% coverage for helper functions
- **E2E**: Full user workflows covered

## 📊 Dashboard Widgets

### ProductivityTrendsWidget
Time-series visualization of team productivity over configurable periods.

**Features:**
- Line/area chart options
- Trend indicators (↗ up, ↘ down, → stable)
- Percentage change calculations
- Interactive tooltips with context

**Props:**
```typescript
interface ProductivityTrendsWidgetProps {
  config: {
    chartType?: 'line' | 'area'
    metricType?: string
    timeRange?: '7d' | '30d' | '90d'
  }
  isEditing?: boolean
  onRemove?: () => void
}
```

### TeamComparisonWidget
Cross-team performance comparison with rankings and detailed metrics.

**Features:**
- Bar chart visualization
- Team rankings with trophy icons
- Member count and trend indicators
- Drill-down capabilities

### RealTimeActivityWidget
Live feed of team development activities with real-time updates.

**Features:**
- Real-time activity streaming
- User avatars and timestamps
- Status indicators (success/error/in-progress)
- Configurable activity count
- WebSocket connection status

### AgentUsageWidget
AI agent utilization tracking with usage distribution and performance metrics.

**Features:**
- Doughnut chart visualization
- Usage percentage breakdown
- Performance indicators
- Most/least used agents

## 🔧 Configuration

### Dashboard Layout
Dashboard widgets support drag-and-drop positioning with persistent layouts:

```typescript
const defaultLayout = [
  {
    i: 'productivity-trends',
    x: 0, y: 0, w: 8, h: 3,
    minW: 2, minH: 2, maxW: 12, maxH: 12
  },
  {
    i: 'team-comparison', 
    x: 8, y: 0, w: 4, h: 3,
    minW: 2, minH: 2, maxW: 12, maxH: 12
  }
]
```

### Theme Configuration
Support for light, dark, and system themes:

```typescript
// Theme switching
dispatch(setTheme('dark'))

// CSS custom properties automatically updated
:root {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  // ... other theme variables
}
```

### Real-Time Connection
WebSocket configuration for live updates:

```typescript
const wsConfig = {
  transports: ['websocket', 'polling'],
  upgrade: true,
  timeout: 20000,
  autoConnect: true,
  auth: {
    token: accessToken,
    user_id: userId,
    organization_id: orgId
  }
}
```

## 🔐 Authentication & Security

### JWT Authentication
- Automatic token refresh before expiration
- Secure token storage with httpOnly cookies support
- Role-based route protection
- Session timeout handling

### API Security
- CSRF protection with custom headers
- Request/response interceptors
- Rate limiting compliance
- Input sanitization

### Data Protection
- Organization-scoped data isolation  
- Sensitive data masking in logs
- Secure WebSocket authentication
- Client-side data validation

## 📱 Responsive Design

### Breakpoints
- **Mobile**: 0-767px (stack layout, simplified widgets)
- **Tablet**: 768-1023px (condensed grid, touch-optimized)  
- **Desktop**: 1024px+ (full grid layout, detailed widgets)

### Accessibility
- **WCAG 2.1 AA** compliance
- Screen reader support with proper ARIA labels
- Keyboard navigation for all interactive elements
- High contrast mode support
- Reduced motion preferences respected

## ⚡ Performance

### Bundle Optimization
- **Bundle Size**: <500KB compressed JavaScript
- **Code Splitting**: Route-based and component-based lazy loading
- **Tree Shaking**: Unused code elimination
- **Image Optimization**: WebP format with fallbacks

### Runtime Performance
- **Initial Load**: <2 seconds for dashboard rendering
- **Widget Updates**: <100ms for real-time data refresh
- **Chart Interactions**: <50ms response to user actions
- **Memory Usage**: <100MB for typical dashboard session

### Optimization Techniques
- React.memo for expensive components
- useCallback/useMemo for heavy computations  
- Virtual scrolling for large data sets
- Debounced search and filters
- Efficient Redux selectors

## 🚀 Deployment

### Production Build
```bash
# Create optimized production build
npm run build

# Serve build locally for testing
npm run preview
```

### Environment Variables
```bash
# Production configuration
VITE_API_URL=https://api.metrics.fortium.com/api
VITE_WS_URL=https://api.metrics.fortium.com
NODE_ENV=production
```

### Docker Deployment
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 🐛 Troubleshooting

### Common Issues

**WebSocket Connection Fails**
```bash
# Check CORS configuration
VITE_WS_URL=http://localhost:3001  # Match backend URL exactly

# Verify backend WebSocket server is running
# Check browser network tab for connection errors
```

**Charts Not Rendering**
```bash
# Ensure Chart.js dependencies are installed
npm install chart.js react-chartjs-2

# Check for canvas support in test environment
# Verify mock Chart components in tests
```

**Drag & Drop Not Working**
```bash
# Check React Grid Layout CSS imports
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

# Verify edit mode is enabled
dispatch(setIsEditing(true))
```

**Performance Issues**
```bash
# Check bundle size
npm run build && npx bundlesize

# Profile React components
# Use React DevTools Profiler
# Check for unnecessary re-renders
```

## 🤝 Contributing

### Development Workflow
1. Create feature branch from main
2. Implement changes with tests
3. Run full test suite
4. Submit PR with detailed description

### Code Standards
- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Conventional commit messages
- 90%+ test coverage required

### PR Checklist
- [ ] All tests pass
- [ ] TypeScript compilation successful
- [ ] Accessibility requirements met
- [ ] Performance benchmarks maintained
- [ ] Documentation updated

## 📄 License

This project is part of the Fortium Partners Claude Configuration toolkit and is subject to the project's licensing terms.

---

**Built with ❤️ by the Fortium Partners Development Team**

For support or questions, please contact the development team or create an issue in the project repository.