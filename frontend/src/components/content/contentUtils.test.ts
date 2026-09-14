import { describe, expect, it } from 'vitest'
import { backendAssetUrl } from './contentUtils'

describe('backendAssetUrl', () => {
  it('resolves backend-relative media against the configured social API origin', () => {
    const backendOrigin = new URL(import.meta.env.VITE_SOCIAL_API_BASE_URL ?? '/api/v3/social', window.location.origin).origin
    expect(backendAssetUrl('/media/example.jpg')).toBe(`${backendOrigin}/media/example.jpg`)
  })

  it('keeps absolute and browser-owned URLs unchanged', () => {
    expect(backendAssetUrl('https://cdn.example.com/image.jpg')).toBe('https://cdn.example.com/image.jpg')
    expect(backendAssetUrl('blob:https://app.example.com/asset')).toBe('blob:https://app.example.com/asset')
  })
})
