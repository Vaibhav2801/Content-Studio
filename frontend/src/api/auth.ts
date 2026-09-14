export interface AuthUser { id: string; email: string; name: string }
export interface AuthWorkspace { id: string; name: string }
export interface AuthSession {
  authenticated: boolean
  user: AuthUser | null
  workspace: AuthWorkspace | null
  csrf_token?: string
}

const socialBase = (import.meta.env.VITE_SOCIAL_API_BASE_URL as string | undefined) ?? '/api/v3/social'
const baseUrl = socialBase.replace(/\/social\/?$/, '/auth')

let sessionCsrfToken = ''

export function csrfToken(): string | undefined {
  const value = document.cookie.split('; ').find((item) => item.startsWith('csrftoken='))?.split('=')[1]
  return sessionCsrfToken || (value ? decodeURIComponent(value) : undefined)
}

async function request(path: string, options: RequestInit = {}): Promise<AuthSession> {
  const method = options.method?.toUpperCase() ?? 'GET'
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (method !== 'GET') {
    headers.set('Content-Type', 'application/json')
    const token = csrfToken()
    if (token) headers.set('X-CSRFToken', token)
  }
  const response = await fetch(`${baseUrl}${path}`, { ...options, credentials: 'include', headers })
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  if (response.ok && typeof data.csrf_token === 'string') sessionCsrfToken = data.csrf_token
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : Object.values(data).flat().find((value) => typeof value === 'string')
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${response.status}).`)
  }
  return data as unknown as AuthSession
}

export const authApi = {
  session: () => request('/session/'),
  signup: async (data: { name: string; email: string; password: string; workspace_name: string }) => {
    await authApi.session() // Django sets the CSRF cookie before any unsafe request.
    return request('/signup/', { method: 'POST', body: JSON.stringify(data) })
  },
  signin: async (data: { email: string; password: string }) => {
    await authApi.session()
    return request('/signin/', { method: 'POST', body: JSON.stringify(data) })
  },
  signout: async () => {
    await authApi.session()
    return request('/signout/', { method: 'POST', body: '{}' })
  },
}
