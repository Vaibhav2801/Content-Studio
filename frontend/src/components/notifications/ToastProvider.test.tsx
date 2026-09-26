import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from './ToastProvider'
import { useToast, type ToastTone } from './useToast'

function ToastHarness() {
  const { showToast } = useToast()
  const messages: Record<ToastTone, { title: string; message: string }> = {
    success: { title: 'Changes saved', message: 'Your settings are up to date.' },
    error: { title: 'Could not publish', message: 'Check the connection and try again.' },
    warning: { title: 'Limit reached', message: 'Upgrade your plan to continue.' },
    info: { title: 'Still working', message: 'This may take a moment.' },
  }

  return <div>{(Object.keys(messages) as ToastTone[]).map((tone) => (
    <button type="button" key={tone} onClick={() => showToast({ tone, ...messages[tone], duration: 1000 })}>
      Show {tone}
    </button>
  ))}</div>
}

describe('ToastProvider', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it.each([
    ['success', 'Success', 'status'],
    ['error', 'Error', 'alert'],
    ['warning', 'Warning', 'alert'],
    ['info', 'Information', 'status'],
  ] as const)('shows a distinct %s notification', (tone, iconLabel, role) => {
    render(<ToastProvider><ToastHarness /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: `Show ${tone}` }))

    const toast = screen.getByRole(role)
    expect(toast).toHaveAttribute('data-tone', tone)
    expect(screen.getByLabelText(iconLabel)).toBeInTheDocument()
    expect(toast).toHaveTextContent(tone === 'warning' ? 'Limit reached' : tone === 'error' ? 'Could not publish' : tone === 'success' ? 'Changes saved' : 'Still working')
  })

  it('can be dismissed immediately', () => {
    vi.useFakeTimers()
    render(<ToastProvider><ToastHarness /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Show error' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error notification' }))
    act(() => vi.advanceTimersByTime(180))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disappears automatically after its timeout', () => {
    vi.useFakeTimers()
    render(<ToastProvider><ToastHarness /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Show info' }))
    act(() => vi.advanceTimersByTime(1180))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
