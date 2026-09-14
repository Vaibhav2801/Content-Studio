import { ContentStudioProvider } from '../components/content/ContentStudioContext'
import { ContentStudioShell } from '../components/content/ContentStudioShell'
import './ContentStudioPage.css'
import './StudioRedesign.css'

export function ContentStudioPage() {
  return <ContentStudioProvider><ContentStudioShell /></ContentStudioProvider>
}


