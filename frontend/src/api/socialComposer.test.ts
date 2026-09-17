import { afterEach, describe, expect, it, vi } from 'vitest'
import { socialComposerApi, SocialComposerApiError } from './socialComposer'

describe('social composer API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the generic social endpoint and sends credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ connections: [], sources: [], drafts: [], generation_controls: { tones: [], goals: [], lengths: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await socialComposerApi.options()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v3\/social\/composer\/options\/$/), expect.objectContaining({ credentials: 'include' }))
  })

  it('uploads files as multipart without forcing a JSON content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'asset-1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await socialComposerApi.uploadMedia('variant-1', new File(['image'], 'photo.jpg', { type: 'image/jpeg' }))
    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.body).toBeInstanceOf(FormData)
    expect(new Headers(options.headers).has('Content-Type')).toBe(false)
  })

  it('preserves field validation details from failed requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ copy: ['Make this shorter.'] }), { status: 400, headers: { 'Content-Type': 'application/json' } })))
    await expect(socialComposerApi.submitForReview('post-1')).rejects.toMatchObject({ payload: { copy: ['Make this shorter.'] } } satisfies Partial<SocialComposerApiError>)
  })

  it('sends generated image alt text with the prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'asset-1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await socialComposerApi.regenerateImage('variant-1', 'Editorial portrait', undefined, 'A model in a red jacket')

    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(options.body as string)).toMatchObject({
      prompt: 'Editorial portrait',
      alt_text: 'A model in a red jacket',
    })
  })
})
