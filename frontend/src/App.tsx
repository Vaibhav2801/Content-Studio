import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/content/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { LandingPage } from './pages/LandingPage'
import { ContentStudioPage } from './pages/ContentStudioPage'
import { ContentHomeView } from './components/content/views/ContentHomeView'
import { ContentCreateView } from './components/content/views/ContentCreateView'
import { ContentSeriesView } from './components/content/views/ContentSeriesView'
import { ContentApprovalsView } from './components/content/views/ContentApprovalsView'
import { ContentCalendarView } from './components/content/views/ContentCalendarView'
import { ContentLibraryView } from './components/content/views/ContentLibraryView'
import { ContentConnectionsView } from './components/content/views/ContentConnectionsView'
import { ContentSettingsView } from './components/content/views/ContentSettingsView'
import { ContentOnboardingView } from './components/content/views/ContentOnboardingView'
import { ContentAnalyticsView } from './components/content/views/ContentAnalyticsView'

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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<AuthPage mode="signin" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/content" element={<ProtectedStudio />}>
          <Route index element={<ContentHomeView />} />
          <Route path="create" element={<ContentCreateView />} />
          <Route path="series" element={<ContentSeriesView />} />
          <Route path="approvals" element={<ContentApprovalsView />} />
          <Route path="calendar" element={<ContentCalendarView />} />
          <Route path="library" element={<ContentLibraryView />} />
          <Route path="connections" element={<ContentConnectionsView />} />
          <Route path="analytics" element={<ContentAnalyticsView />} />
          <Route path="settings" element={<ContentSettingsView />} />
          <Route path="onboarding" element={<ContentOnboardingView />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
