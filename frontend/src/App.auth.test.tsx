import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi, type AuthSession } from './api/auth'
import { billingApi } from './api/billingApi'
import type { PricingCatalog } from './types/billing'
import App from './App'

vi.mock('./pages/ContentStudioPage', () => ({ ContentStudioPage: () => <div>Private Visiofy Studio</div> }))

const anonymous: AuthSession = { authenticated: false, user: null, workspace: null }
const signedIn: AuthSession = {
  authenticated: true,
  user: { id: 'user-1', email: 'alex@example.com', name: 'Alex Morgan' },
  workspace: { id: 'workspace-1', name: 'Alex Studio' },
}
const catalog: PricingCatalog = {
  currency: 'USD',
  credit_costs: { draft: 2, image: 1, image_regeneration: 1 },
  simulated_checkout_enabled: false,
  plans: [
    { id: 'free', name: 'Free', product_id: null, price: 0, credits: 15, connections: 0, engage: false },
    { id: 'starter', name: 'Starter', product_id: 'plan_starter_monthly', price: 20, credits: 50, connections: 1, engage: false },
    { id: 'advance', name: 'Advance', product_id: 'plan_advance_monthly', price: 39, credits: 150, connections: 1, engage: true },
  ],
  addons: [],
}

describe('Visiofy Studio authentication routes', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })
  beforeEach(() => {
    window.history.replaceState({}, '', '/content')
    vi.spyOn(authApi, 'session').mockResolvedValue(anonymous)
    vi.spyOn(billingApi, 'getCatalog').mockResolvedValue(catalog)
  })

  it('shows the public homepage and pricing before sign in', async () => {
    window.history.replaceState({}, '', '/')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Great content needs room to think/i }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Pay for the creative work you use/i })).toBeInTheDocument()
    expect(await screen.findByText('50 AI credits each month', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('renders the dedicated pricing plans and dynamic cost builder page', async () => {
    window.history.replaceState({}, '', '/pricing')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Simple plans/i }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Dynamic Cost Manager/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Everything you get with Visiofy Studio/i })).toBeInTheDocument()
    expect(screen.getByText(/Unlimited Post Scheduling is always included/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/pricing')
  })

  it.each(['/signin', '/signup'])('returns from %s to the public homepage', async (path) => {
    window.history.replaceState({}, '', path)
    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'Back to home' }))
    expect(await screen.findByRole('heading', { name: /Great content needs room to think/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('redirects an anonymous visitor to sign in and opens the studio after login', async () => {
    const signin = vi.spyOn(authApi, 'signin').mockResolvedValue(signedIn)
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Sign in to Visiofy Studio' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'AnEvenStrongerPassword42!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Private Visiofy Studio')).toBeInTheDocument()
    expect(signin).toHaveBeenCalledWith({ email: 'alex@example.com', password: 'AnEvenStrongerPassword42!' })
    expect(window.location.pathname).toBe('/content')
  })

  it('creates an account and opens its new workspace', async () => {
    const signup = vi.spyOn(authApi, 'signup').mockResolvedValue(signedIn)
    window.history.replaceState({}, '', '/signup')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alex Morgan' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'AnEvenStrongerPassword42!' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'AnEvenStrongerPassword42!' } })
    fireEvent.change(screen.getByLabelText(/Workspace name/), { target: { value: 'Alex Studio' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Private Visiofy Studio')).toBeInTheDocument()
    expect(signup).toHaveBeenCalledWith({
      name: 'Alex Morgan', email: 'alex@example.com', password: 'AnEvenStrongerPassword42!', workspace_name: 'Alex Studio',
    })
  })


  it('returns to the originally requested page after login', async () => {
    vi.spyOn(authApi, 'signin').mockResolvedValue(signedIn)
    window.history.replaceState({}, '', '/content/calendar')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Sign in to Visiofy Studio' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'AnEvenStrongerPassword42!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Private Visiofy Studio')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/content/calendar')
  })

  it('restores a signed-in session on refresh', async () => {
    vi.spyOn(authApi, 'session').mockResolvedValue(signedIn)
    render(<App />)
    expect(await screen.findByText('Private Visiofy Studio')).toBeInTheDocument()
  })
})
