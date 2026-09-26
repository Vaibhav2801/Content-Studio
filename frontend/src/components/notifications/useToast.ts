import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export type ToastInput = {
  tone: ToastTone
  title: string
  message?: string
  duration?: number
  dedupeKey?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export type ToastContextValue = {
  showToast: (toast: ToastInput) => string
  dismissToast: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider.')
  return context
}
