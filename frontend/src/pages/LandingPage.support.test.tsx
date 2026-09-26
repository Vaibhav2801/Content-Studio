import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { supportApi } from '../api/supportApi'
import { LandingPage } from './LandingPage'


vi.mock('../components/content/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('../hooks/usePricingCatalog', () => ({
  usePricingCatalog: () => ({ catalog: null, error: null }),
}))

describe('Landing page Direct Assistance form', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('sends through the backend without opening an untitled mail client tab', async () => {
    const submit = vi.spyOn(supportApi, 'submit').mockResolvedValue({
      detail: 'Your message was sent successfully.',
    })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Alex Morgan' } })
    fireEvent.change(screen.getByLabelText('Your Email'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Topic / Category'), { target: { value: 'Technical Support' } })
    fireEvent.change(screen.getByLabelText('Your Question or Message'), {
      target: { value: 'My connection page is not loading.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Send Message to visiofytech@gmail.com/i }))

    await waitFor(() => expect(submit).toHaveBeenCalledWith({
      name: 'Alex Morgan',
      email: 'alex@example.com',
      category: 'Technical Support',
      message: 'My connection page is not loading.',
    }))
    expect(await screen.findByRole('heading', { name: 'Message sent!' })).toBeInTheDocument()
    expect(open).not.toHaveBeenCalled()
  })

  it('keeps the form open and shows the server error when delivery fails', async () => {
    vi.spyOn(supportApi, 'submit').mockRejectedValue(
      new Error("We couldn't send your message right now. Please email visiofytech@gmail.com directly."),
    )

    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Alex Morgan' } })
    fireEvent.change(screen.getByLabelText('Your Email'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Your Question or Message'), {
      target: { value: 'Please help with my account.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Send Message to visiofytech@gmail.com/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please email visiofytech@gmail.com directly.')
    expect(screen.getByLabelText('Your Question or Message')).toHaveValue('Please help with my account.')
    expect(screen.getByRole('button', { name: /Send Message to visiofytech@gmail.com/i })).toBeEnabled()
  })
})
