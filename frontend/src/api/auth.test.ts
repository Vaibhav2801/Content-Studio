import { afterEach, describe, expect, it, vi } from 'vitest'
import { authApi } from './auth'
import { contentStudioApi } from './contentStudio'

const reply = (body: Record<string, unknown>) => ({ ok: true, status: 200, json: async () => body })

describe('authenticated API CSRF flow', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the session token for login and the rotated token for content writes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply({ authenticated: false, user: null, workspace: null, csrf_token: 'initial-masked-token' }))
      .mockResolvedValueOnce(reply({ authenticated: true, user: { id: '1', email: 'alex@example.com', name: 'Alex' }, workspace: { id: 'workspace-1', name: 'Alex Studio' }, csrf_token: 'rotated-masked-token' }))
      .mockResolvedValueOnce(reply({ id: 'connection-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await authApi.signin({ email: 'alex@example.com', password: 'strong-password' })
    await contentStudioApi.connectionAction('connection-1', 'DISCONNECT')

    expect((fetchMock.mock.calls[1][1].headers as Headers).get('X-CSRFToken')).toBe('initial-masked-token')
    expect((fetchMock.mock.calls[2][1].headers as Headers).get('X-CSRFToken')).toBe('rotated-masked-token')
    expect(fetchMock.mock.calls[2][1].credentials).toBe('include')
  })
})
