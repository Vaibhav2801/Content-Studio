import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/content/AuthContext'

const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })))
const PricingPage = lazy(() => import('./pages/PricingPage').then((module) => ({ default: module.PricingPage })))
const ContentStudioPage = lazy(() => import('./pages/ContentStudioPage').then((module) => ({ default: module.ContentStudioPage })))
const ContentHomeView = lazy(() => import('./components/content/views/ContentHomeView').then((module) => ({ default: module.ContentHomeView })))
const ContentCreateView = lazy(() => import('./components/content/views/ContentCreateView').then((module) => ({ default: module.ContentCreateView })))
const ContentSeriesView = lazy(() => import('./components/content/views/ContentSeriesView').then((module) => ({ default: module.ContentSeriesView })))
const ContentApprovalsView = lazy(() => import('./components/content/views/ContentApprovalsView').then((module) => ({ default: module.ContentApprovalsView })))
const ContentCalendarView = lazy(() => import('./components/content/views/ContentCalendarView').then((module) => ({ default: module.ContentCalendarView })))
const ContentLibraryView = lazy(() => import('./components/content/views/ContentLibraryView').then((module) => ({ default: module.ContentLibraryView })))
const ContentConnectionsView = lazy(() => import('./components/content/views/ContentConnectionsView').then((module) => ({ default: module.ContentConnectionsView })))
const ContentSettingsView = lazy(() => import('./components/content/views/ContentSettingsView').then((module) => ({ default: module.ContentSettingsView })))
const ContentOnboardingView = lazy(() => import('./components/content/views/ContentOnboardingView').then((module) => ({ default: module.ContentOnboardingView })))
const ContentAnalyticsView = lazy(() => import('./components/content/views/ContentAnalyticsView').then((module) => ({ default: module.ContentAnalyticsView })))
const EngagementHubView = lazy(() => import('./components/content/views/EngagementHubView').then((module) => ({ default: module.EngagementHubView })))

function ProtectedStudio() {
  const { user, ready, error, reload } = useAuth()
  const location = useLocation()
  if (import.meta.env.VITE_DEMO_MODE === 'true') return <ContentStudioPage />
  if (!ready) return <div className="auth-gate" role="status">Opening your workspace…</div>
  if (error) return <div className="auth-gate" role="alert">{error}<button type="button" onClick={() => void reload()}>Try again</button></div>
  return user ? <ContentStudioPage /> : <Navigate to="/signin" replace state={{ from: location.pathname }} />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Suspense fallback={<div className="auth-gate" role="status">Loading…</div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/signin" element={<AuthPage mode="signin" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/content" element={<ProtectedStudio />}>
          <Route index element={<ContentHomeView />} />
          <Route path="create" element={<ContentCreateView />} />
          <Route path="series" element={<ContentSeriesView />} />
          <Route path="approvals" element={<ContentApprovalsView />} />
          <Route path="calendar" element={<ContentCalendarView />} />
          <Route path="library" element={<ContentLibraryView />} />
          <Route path="engage" element={<EngagementHubView />} />
          <Route path="connections" element={<ContentConnectionsView />} />
          <Route path="analytics" element={<ContentAnalyticsView />} />
          <Route path="settings" element={<ContentSettingsView />} />
          <Route path="onboarding" element={<ContentOnboardingView />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
