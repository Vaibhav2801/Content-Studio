import { LoaderCircle } from 'lucide-react'
import { useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'> & {
  children: ReactNode
  onClick: (event: MouseEvent<HTMLButtonElement>) => Promise<unknown> | void
  loadingLabel?: string
}

export function TaskButton({ children, onClick, loadingLabel, disabled, ...props }: Props) {
  const [working, setWorking] = useState(false)
  const pending = useRef(false)

  const run = async (event: MouseEvent<HTMLButtonElement>) => {
    if (pending.current) return
    pending.current = true
    setWorking(true)
    try { await onClick(event) }
    finally { pending.current = false; setWorking(false) }
  }

  return <button {...props} type={props.type ?? 'button'} disabled={disabled || working} aria-busy={working} onClick={(event) => { void run(event) }}>
    {working ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : null}
    {working && loadingLabel ? loadingLabel : children}
  </button>
}
