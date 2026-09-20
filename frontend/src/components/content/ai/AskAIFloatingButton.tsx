import { Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { AskAIChatDrawer } from './AskAIChatDrawer'
import './AskAI.css'

export function AskAIButton() {
  const [isOpen, setIsOpen] = useState(false)

  const toggleOpen = () => {
    setIsOpen((prev) => !prev)
  }

  return (
    <>
      <button
        type="button"
        className={`ask-ai-header-trigger ${isOpen ? 'is-active' : ''}`}
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={isOpen ? 'Close Ask AI Assistant' : 'Open Ask AI Assistant'}
      >
        <span className="ask-ai-trigger-sparkle">
          {isOpen ? <X size={15} /> : <Sparkles size={14} strokeWidth={2.4} />}
        </span>
        <span className="ask-ai-trigger-label">
          <span>{isOpen ? 'Close AI' : 'Ask AI'}</span>
        </span>
      </button>

      <AskAIChatDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}

export const AskAIFloatingButton = AskAIButton
