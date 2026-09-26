import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ToastContext, type ToastInput, type ToastTone } from './useToast'
import './ToastProvider.css'

type ToastItem = ToastInput & {
  id: string
  revision: number
}

const toneDetails: Record<ToastTone, { icon: LucideIcon; label: string; defaultDuration: number }> = {
  success: { icon: CircleCheck, label: 'Success', defaultDuration: 5000 },
  error: { icon: CircleAlert, label: 'Error', defaultDuration: 8000 },
  warning: { icon: TriangleAlert, label: 'Warning', defaultDuration: 7000 },
  info: { icon: Info, label: 'Information', defaultDuration: 5000 },
}

export function ToastProvider({ children, position = 'top-right' }: { children: ReactNode; position?: 'top-right' | 'bottom-right' }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const sequence = useRef(0)

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((input: ToastInput) => {
    sequence.current += 1
    const id = `studio-toast-${sequence.current}`
    const toast: ToastItem = { ...input, id, revision: sequence.current }

    setToasts((current) => {
      if (input.dedupeKey) {
        const existing = current.find((item) => item.dedupeKey === input.dedupeKey)
        if (existing) {
          return current.map((item) => item.id === existing.id ? { ...toast, id: existing.id } : item)
        }
      }
      return [...current, toast].slice(-4)
    })

    return id
  }, [])

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={`studio-toast-viewport ${position}`} aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastCard toast={toast} onDismiss={dismissToast} key={toast.id} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [closing, setClosing] = useState(false)
  const details = toneDetails[toast.tone]
  const Icon = details.icon
  const duration = toast.duration ?? details.defaultDuration

  const beginDismiss = useCallback(() => {
    setClosing(true)
    window.setTimeout(() => onDismiss(toast.id), 180)
  }, [onDismiss, toast.id])

  useEffect(() => {
    setClosing(false)
    if (duration <= 0) return
    const timer = window.setTimeout(beginDismiss, duration)
    return () => window.clearTimeout(timer)
  }, [beginDismiss, duration, toast.revision])

  return (
    <div
      className={`studio-toast ${toast.tone} ${closing ? 'is-closing' : ''}`}
      role={toast.tone === 'error' || toast.tone === 'warning' ? 'alert' : 'status'}
      data-tone={toast.tone}
    >
      <span className="studio-toast-icon" aria-label={details.label}>
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <div className="studio-toast-copy">
        <strong>{toast.title}</strong>
        {toast.message ? <p>{toast.message}</p> : null}
        {toast.action ? (
          <button
            className="studio-toast-action"
            type="button"
            onClick={() => {
              toast.action?.onClick()
              beginDismiss()
            }}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button className="studio-toast-dismiss" type="button" onClick={beginDismiss} aria-label={`Dismiss ${details.label.toLowerCase()} notification`}>
        <X size={17} />
      </button>
      {duration > 0 ? <span className="studio-toast-progress" style={{ animationDuration: `${duration}ms` }} aria-hidden="true" /> : null}
    </div>
  )
}
