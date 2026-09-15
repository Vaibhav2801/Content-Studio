import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi, type AuthSession, type AuthUser, type AuthWorkspace, type AuthWorkspaceMembership } from '../../api/auth'
import { clearComposerRecovery, composerRecoveryKey } from './composer/composerRecovery'

interface AuthState {
  user: AuthUser | null
  workspace: AuthWorkspace | null
  workspaces: AuthWorkspaceMembership[]
  ready: boolean
  error: string
  reload: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string, workspaceName: string) => Promise<void>
  signOut: () => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  switchWorkspace: (workspaceId: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [ready, setReady] = useState(demoMode)
  const [error, setError] = useState('')

  const reload = async () => {
    if (demoMode) return
    try {
      const result = await authApi.session()
      setSession(result)
      setError('')
    } catch {
      setError('Could not connect to Content Studio. Check the server and try again.')
    } finally {
      setReady(true)
    }
  }

  useEffect(() => { void reload() }, [])

  const signIn = async (email: string, password: string) => {
    const result = await authApi.signin({ email, password })
    setSession(result)
    setError('')
  }
  const signUp = async (name: string, email: string, password: string, workspaceName: string) => {
    const result = await authApi.signup({ name, email, password, workspace_name: workspaceName })
    setSession(result)
    setError('')
  }
  const signOut = async () => {
    await authApi.signout()
    if (session?.user && session.workspace) clearComposerRecovery(composerRecoveryKey(session.user.id, session.workspace.id))
    setSession(null)
    setError('')
  }
  const createWorkspace = async (name: string) => {
    const result = await authApi.createWorkspace(name)
    setSession(result)
    setError('')
  }
  const switchWorkspace = async (workspaceId: string) => {
    if (workspaceId === session?.workspace?.id) return
    if (session?.user && session.workspace) clearComposerRecovery(composerRecoveryKey(session.user.id, session.workspace.id))
    const result = await authApi.switchWorkspace(workspaceId)
    setSession(result)
    setError('')
  }

  return <AuthContext.Provider value={{
    user: session?.user ?? null, workspace: session?.workspace ?? null, workspaces: session?.workspaces ?? [], ready, error,
    reload, signIn, signUp, signOut, createWorkspace, switchWorkspace,
  }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}

// Studio components are also mounted in focused tests without the app-level provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalAuth() {
  return useContext(AuthContext)
}
