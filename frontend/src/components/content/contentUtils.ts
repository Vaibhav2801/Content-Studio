import type { ContentPostStatus } from '../../types/content'

const socialApiBaseUrl = (import.meta.env.VITE_SOCIAL_API_BASE_URL as string | undefined)
  ?? '/api/v3/social'

export const CONTENT_STATUS_LABELS: Record<ContentPostStatus, string> = {
  DRAFT: 'Needs approval',
  SCHEDULED: 'Scheduled',
  READY: 'Ready to post',
  PUBLISHING: 'Publishing',
  SUBMITTED: 'Publishing',
  PUBLISHED: 'Published',
  FAILED: 'Needs attention',
  CANCELLED: 'Cancelled',
}

const CUSTOMER_HIDDEN_TERMS = /upload\s*post|zernio|buffer|n8n|webhooks?|api\s*keys?|idempotenc\w*|providers?/gi

export function customerSafeMessage(message: string | undefined, fallback: string) {
  if (!message) return fallback
  const cleaned = message.replace(CUSTOMER_HIDDEN_TERMS, 'publishing service')
  return cleaned.trim() || fallback
}

export function formatSchedule(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(value))
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CO'
}

export function backendAssetUrl(value: string | undefined | null) {
  if (!value) return ''
  if (/^(?:data|blob):/i.test(value)) return value

  try {
    const backendOrigin = new URL(socialApiBaseUrl, window.location.origin).origin
    return new URL(value, `${backendOrigin}/`).toString()
  } catch {
    return value
  }
}
