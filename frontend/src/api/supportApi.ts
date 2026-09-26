export interface SupportRequest {
  name: string
  email: string
  category: string
  message: string
}

interface SupportResponse {
  detail: string
}

const baseUrl = (import.meta.env.VITE_SOCIAL_API_BASE_URL as string | undefined) ?? '/api/v3/social'

export const supportApi = {
  submit: async (request: SupportRequest): Promise<SupportResponse> => {
    const response = await fetch(`${baseUrl}/support/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    const data = await response.json().catch(() => ({})) as Partial<SupportResponse> & Record<string, unknown>
    if (!response.ok) {
      const fieldError = Object.values(data).flat().find((value) => typeof value === 'string')
      throw new Error(
        typeof data.detail === 'string'
          ? data.detail
          : typeof fieldError === 'string'
            ? fieldError
            : `Unable to send your message (${response.status}).`,
      )
    }
    return data as SupportResponse
  },
}
