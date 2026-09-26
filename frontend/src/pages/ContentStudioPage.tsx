import { ContentStudioProvider } from '../components/content/ContentStudioContext'
import { ContentStudioShell } from '../components/content/ContentStudioShell'
import { ToastProvider } from '../components/notifications/ToastProvider'
import './ContentStudioPage.css'
import './StudioRedesign.css'
import './StudioSystem.css'
import './StudioSystem.css'

export function ContentStudioPage() {
  return <ToastProvider><ContentStudioProvider><ContentStudioShell /></ContentStudioProvider></ToastProvider>
}


