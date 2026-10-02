export type SupportedCurrency = 'USD' | 'EUR' | 'INR'

const localeByCurrency: Record<SupportedCurrency, string> = {
  USD: 'en-US',
  EUR: 'en-IE',
  INR: 'en-IN',
}

export function formatMoney(value: number | string | null | undefined, currency: SupportedCurrency): string {
  if (value === null || value === undefined || value === '') return '…'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '…'
  const hasFraction = Math.abs(amount - Math.trunc(amount)) > 0.0001
  return new Intl.NumberFormat(localeByCurrency[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function detectBrowserCountryCode(): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (timeZone === 'Asia/Kolkata' || timeZone === 'Asia/Calcutta') return 'IN'
  if (timeZone.startsWith('Europe/')) return 'DE'

  const locales = [navigator.language, ...(navigator.languages ?? [])]
  for (const locale of locales) {
    const match = locale.match(/[-_]([A-Za-z]{2})(?:$|[-_])/)
    if (match) return match[1].toUpperCase()
  }
  return 'US'
}
