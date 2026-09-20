import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assistantApi } from '../../../api/assistantApi'
import { AskAIFloatingButton } from './AskAIFloatingButton'

const mockedNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  }
})

describe('Ask AI Floating Assistant', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
    mockedNavigate.mockReset()
  })

  afterEach(cleanup)

  it('renders the floating trigger button and toggles the chat drawer', async () => {
    render(
      <MemoryRouter initialEntries={['/content/create']}>
        <AskAIFloatingButton />
      </MemoryRouter>
    )

    // Trigger button is present
    const trigger = screen.getByRole('button', { name: /Open Ask AI Assistant/i })
    expect(trigger).toBeInTheDocument()

    // Drawer is closed initially
    expect(screen.queryByRole('dialog', { name: /Ask AI Assistant/i })).not.toBeInTheDocument()

    // Click to open drawer
    fireEvent.click(trigger)

    const drawer = screen.getByRole('dialog', { name: /Ask AI Assistant/i })
    expect(drawer).toBeInTheDocument()
    expect(screen.getByText(/Ask AI Assistant/i)).toBeInTheDocument()
    expect(screen.getByText(/Currently on:/i)).toBeInTheDocument()

    // Click to close
    fireEvent.click(screen.getByRole('button', { name: /Close Ask AI Assistant/i }))
    expect(screen.queryByRole('dialog', { name: /Ask AI Assistant/i })).not.toBeInTheDocument()
  })

  it('submits a query and displays the response with action links', async () => {
    vi.spyOn(assistantApi, 'chat').mockResolvedValue({
      reply: 'The **Post Composer** (`/content/create`) allows you to generate multi-channel content.',
      suggestions: ['How to generate AI images?'],
      actions: [{ label: 'Open Composer', route: '/content/create' }],
    })

    render(
      <MemoryRouter initialEntries={['/content/create']}>
        <AskAIFloatingButton />
      </MemoryRouter>
    )

    // Open drawer
    fireEvent.click(screen.getByRole('button', { name: /Open Ask AI Assistant/i }))

    // Type query
    const input = screen.getByLabelText(/Ask a question about Content Studio/i)
    fireEvent.change(input, { target: { value: 'How does the composer work?' } })

    const sendBtn = screen.getByRole('button', { name: /Send message/i })
    fireEvent.click(sendBtn)

    // Check assistant response and action button
    const composerHeading = await screen.findByText('Post Composer')
    expect(composerHeading).toBeInTheDocument()

    const openComposerBtn = await screen.findByRole('button', { name: /Open Composer/i })
    expect(openComposerBtn).toBeInTheDocument()

    // Click the action button
    fireEvent.click(openComposerBtn)
    expect(mockedNavigate).toHaveBeenCalledWith('/content/create')
  })

  it('triggers quick suggestion chips on click', async () => {
    vi.spyOn(assistantApi, 'chat').mockResolvedValue({
      reply: 'Approvals screen lets you review and batch approve variants.',
      suggestions: ['Can I batch approve?'],
      actions: [{ label: 'Open Approvals', route: '/content/approvals' }],
    })

    render(
      <MemoryRouter initialEntries={['/content']}>
        <AskAIFloatingButton />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Open Ask AI Assistant/i }))

    // Click quick suggestion chip
    const chip = screen.getByRole('button', { name: /How does the Approvals workflow work\?/i })
    fireEvent.click(chip)

    await waitFor(() => {
      expect(screen.getByText(/Approvals screen lets you review and batch approve variants./i)).toBeInTheDocument()
    })
  })

  it('clears conversation history on reset', async () => {
    render(
      <MemoryRouter initialEntries={['/content']}>
        <AskAIFloatingButton />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Open Ask AI Assistant/i }))

    const input = screen.getByLabelText(/Ask a question about Content Studio/i)
    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }))

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })

    // Click reset conversation
    const resetBtn = screen.getByRole('button', { name: /Reset conversation/i })
    fireEvent.click(resetBtn)

    expect(screen.queryByText('Test message')).not.toBeInTheDocument()
  })
})
