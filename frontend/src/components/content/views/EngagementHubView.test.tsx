import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EngagementHubView } from './EngagementHubView'

afterEach(cleanup)

describe('EngagementHubView', () => {
  it('keeps human approval visible and lets a reviewer approve an AI suggestion', () => {
    render(<EngagementHubView />)

    expect(screen.getByText('Human approval is always on')).toBeInTheDocument()
    expect(screen.getAllByText('AI suggestion')).not.toHaveLength(0)

    fireEvent.click(screen.getAllByRole('button', { name: /Approve & send/i })[0])

    expect(screen.getByRole('status')).toHaveTextContent(/added to the sending queue/i)
  })

  it('creates new automations in approval mode', () => {
    render(<EngagementHubView />)

    fireEvent.click(screen.getByRole('button', { name: 'Automations' }))
    fireEvent.click(screen.getByRole('button', { name: /New automation/i }))
    fireEvent.change(screen.getByPlaceholderText('Example: Send pricing guide'), { target: { value: 'Send launch guide' } })
    fireEvent.change(screen.getByPlaceholderText('Example: PRICE'), { target: { value: 'LAUNCH' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create for review' }))

    expect(screen.getByText('Send launch guide')).toBeInTheDocument()
    expect(screen.getAllByText('Needs approval')).not.toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent(/Nothing will run until it is approved/i)
  })

  it('makes LinkedIn personal outreach limits explicit', () => {
    render(<EngagementHubView />)

    fireEvent.click(screen.getByRole('button', { name: 'LinkedIn Copilot' }))

    expect(screen.getByText('What stays manual')).toBeInTheDocument()
    expect(screen.getByText(/Connection requests, personal DMs, and InMail are never automated/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open LinkedIn/i })).toHaveAttribute('href', 'https://www.linkedin.com')
  })
})
