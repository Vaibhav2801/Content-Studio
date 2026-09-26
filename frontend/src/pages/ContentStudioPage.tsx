import { ContentStudioProvider } from '../components/content/ContentStudioContext'
import { ContentStudioShell } from '../components/content/ContentStudioShell'
import './ContentStudioPage.css'
import './StudioRedesign.css'
import './StudioSystem.css'
import './StudioSystem.css'

export function ContentStudioPage() {
  return <ContentStudioProvider><ContentStudioShell /></ContentStudioProvider>
}


