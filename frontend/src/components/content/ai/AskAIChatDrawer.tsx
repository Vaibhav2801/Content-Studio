import {
  ArrowRight,
  Minus,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  assistantApi,
  DEFAULT_QUICK_SUGGESTIONS,
  type ChatAction,
  type ChatMessage,
} from '../../../api/assistantApi'
import { CONTENT_STUDIO_NAV } from '../../../types/content'

interface AskAIChatDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const STORAGE_KEY = 'content_studio_ask_ai_history'

const INITIAL_GREETING: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  content:
    '👋 **Hello! I am your Visiofy Studio AI Assistant.**\n\nAsk me anything about creating posts, setting up social connections, using Brand Brain, managing approvals, reviewing analytics, or navigating the platform!',
  timestamp: Date.now(),
  suggestions: DEFAULT_QUICK_SUGGESTIONS,
  actions: [
    { label: 'Create Post', route: '/content/create' },
    { label: 'View Calendar', route: '/content/calendar' },
    { label: 'Manage Connections', route: '/content/connections' },
  ],
}

export function AskAIChatDrawer({ isOpen, onClose }: AskAIChatDrawerProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ChatMessage[]
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // Ignore parse failure
    }
    return [INITIAL_GREETING]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const feedEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Current page name for context
  const currentNav = CONTENT_STUDIO_NAV.find((item) => item.path === location.pathname)
  const currentPageName =
    location.pathname === '/content/onboarding'
      ? 'Setup & Onboarding'
      : currentNav?.label || 'Visiofy Studio'

  // Persist messages in session storage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // Ignore quota error
    }
  }, [messages])

  // Scroll to bottom when messages update or drawer opens
  useEffect(() => {
    if (isOpen) {
      feedEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [isOpen, messages, loading])

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim()
    if (!query || loading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    }

    const newHistory = [...messages, userMessage]
    setMessages(newHistory)
    setInput('')
    setLoading(true)

    try {
      const response = await assistantApi.chat(newHistory, location.pathname)
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
        suggestions: response.suggestions,
        actions: response.actions,
      }
      setMessages([...newHistory, assistantMessage])
    } catch {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          'Sorry, I encountered an issue retrieving that answer. Please try again or click one of the quick suggestions below.',
        timestamp: Date.now(),
        suggestions: DEFAULT_QUICK_SUGGESTIONS.slice(0, 3),
      }
      setMessages([...newHistory, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSend()
  }

  const handleClearHistory = () => {
    setMessages([INITIAL_GREETING])
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore
    }
  }

  const handleActionClick = (action: ChatAction) => {
    navigate(action.route)
  }

  const renderFormattedContent = (content: string): ReactNode => {
    const lines = content.split('\n')
    const elements: ReactNode[] = []

    let inList = false
    let listItems: ReactNode[] = []

    const flushList = () => {
      if (inList && listItems.length > 0) {
        elements.push(<ul key={`list-${elements.length}`}>{listItems}</ul>)
        listItems = []
        inList = false
      }
    }

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim()

      // Header 3
      if (trimmed.startsWith('### ')) {
        flushList()
        elements.push(
          <h3 key={`h3-${lineIdx}`}>
            {parseInline(trimmed.replace(/^###\s*/, ''))}
          </h3>
        )
        return
      }

      // Bullet item
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        inList = true
        listItems.push(
          <li key={`li-${lineIdx}`}>
            {parseInline(trimmed.replace(/^[-*]\s*/, ''))}
          </li>
        )
        return
      }

      // Numbered item
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
      if (numMatch) {
        inList = true
        listItems.push(
          <li key={`li-num-${lineIdx}`}>
            {parseInline(numMatch[2])}
          </li>
        )
        return
      }

      flushList()

      // Empty line
      if (!trimmed) {
        return
      }

      // Standard paragraph
      elements.push(
        <p key={`p-${lineIdx}`}>
          {parseInline(trimmed)}
        </p>
      )
    })

    flushList()
    return elements
  }

  const parseInline = (text: string): ReactNode => {
    // Matches markdown links [Label](url), bold **text**, code `code`
    const parts: ReactNode[] = []
    let cursor = 0

    const regex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > cursor) {
        parts.push(text.substring(cursor, match.index))
      }

      if (match[1]) {
        // Markdown Link [Label](url)
        const label = match[2]
        const url = match[3]
        if (url.startsWith('/content')) {
          parts.push(
            <button
              key={`link-${match.index}`}
              type="button"
              className="ask-ai-link"
              onClick={() => navigate(url)}
            >
              {label} ↗
            </button>
          )
        } else {
          parts.push(
            <a
              key={`link-${match.index}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="ask-ai-link"
            >
              {label}
            </a>
          )
        }
      } else if (match[4]) {
        // Bold **text**
        parts.push(<strong key={`bold-${match.index}`}>{match[5]}</strong>)
      } else if (match[6]) {
        // Code `code`
        parts.push(<code key={`code-${match.index}`}>{match[7]}</code>)
      }

      cursor = regex.lastIndex
    }

    if (cursor < text.length) {
      parts.push(text.substring(cursor))
    }

    return parts
  }

  if (!isOpen) return null

  // Active suggestions from the latest assistant message or defaults
  const latestAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const suggestions = latestAssistant?.suggestions || DEFAULT_QUICK_SUGGESTIONS

  return (
    <aside
      className="ask-ai-drawer"
      role="dialog"
      aria-label="Ask AI Assistant"
      aria-modal="false"
    >
      {/* Header */}
      <header className="ask-ai-header">
        <div className="ask-ai-header-brand">
          <span className="ask-ai-header-avatar">
            <Sparkles size={18} strokeWidth={2.2} />
          </span>
          <div className="ask-ai-header-titles">
            <strong>Ask AI Assistant</strong>
            <small>
              <span className="ask-ai-status-dot" />
              Project Feature & Workflow Guide
            </small>
          </div>
        </div>
        <div className="ask-ai-header-actions">
          <button
            type="button"
            className="ask-ai-tool-button"
            title="Reset conversation"
            aria-label="Reset conversation"
            onClick={handleClearHistory}
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            className="ask-ai-tool-button"
            title="Minimize"
            aria-label="Minimize"
            onClick={onClose}
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            className="ask-ai-tool-button"
            title="Close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Context banner showing user's current location */}
      <div className="ask-ai-context-banner">
        <span>Currently on: <strong>{currentPageName}</strong></span>
        <span>Route: <code>{location.pathname}</code></span>
      </div>

      {/* Quick suggestions chips */}
      {suggestions.length > 0 && (
        <div className="ask-ai-suggestions-bar" aria-label="Suggested questions">
          {suggestions.map((suggestion, idx) => (
            <button
              key={`${suggestion}-${idx}`}
              type="button"
              className="ask-ai-chip"
              disabled={loading}
              onClick={() => void handleSend(suggestion)}
            >
              <Sparkles size={11} />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {/* Message feed */}
      <div className="ask-ai-feed" role="log" aria-live="polite">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`ask-ai-message-row ${message.role}`}
          >
            <span className="ask-ai-msg-avatar">
              {message.role === 'assistant' ? <Sparkles size={14} /> : 'You'}
            </span>
            <div className="ask-ai-bubble">
              {renderFormattedContent(message.content)}

              {/* Action buttons embedded in message */}
              {message.actions && message.actions.length > 0 && (
                <div className="ask-ai-actions-wrap">
                  {message.actions.map((act) => (
                    <button
                      key={act.route + act.label}
                      type="button"
                      className="ask-ai-action-button"
                      onClick={() => handleActionClick(act)}
                    >
                      <span>{act.label}</span>
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="ask-ai-message-row assistant">
            <span className="ask-ai-msg-avatar">
              <Sparkles size={14} />
            </span>
            <div className="ask-ai-bubble ask-ai-typing">
              <span className="ask-ai-typing-dot" />
              <span className="ask-ai-typing-dot" />
              <span className="ask-ai-typing-dot" />
            </div>
          </div>
        )}
        <div ref={feedEndRef} />
      </div>

      {/* Input bar */}
      <form className="ask-ai-input-form" onSubmit={handleSubmit}>
        <div className="ask-ai-input-box">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${currentPageName} or any feature…`}
            className="ask-ai-textarea"
            aria-label="Ask a question about Visiofy Studio"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="ask-ai-send-button"
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </div>
        <small className="ask-ai-input-hint">Press Enter to send · Shift+Enter for new line</small>
      </form>
    </aside>
  )
}
