import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const shellMocks = vi.hoisted(() => ({
  signOut: vi.fn(async () => undefined),
}))

vi.mock('./ContentStudioContext', () => ({
  useContentStudio: () => ({
    dashboard: { posts: [] },
    onboarding: {
      business: { name: 'Acme' },
      connection: { health: 'HEALTHY', status: 'CONNECTED' },
    },
    notice: '',
    noticeError: false,
    dismissNotice: vi.fn(),
    isDemo: true,
    activeGenerations: {},
    generationNotice: null,
    dismissGenerationNotice: vi.fn(),
  }),
}))

vi.mock('./AuthContext', () => ({
  useOptionalAuth: () => ({
    user: { id: 'user-1', name: 'Vaibhav', email: 'va@gmail.com' },
    workspace: { id: 'workspace-1', name: 'Vaibhav workspace' },
    workspaces: [{ id: 'workspace-1', name: 'Vaibhav workspace', role: 'OWNER' }],
    switchWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
    signOut: shellMocks.signOut,
  }),
}))

import { ContentStudioShell } from './ContentStudioShell'

describe('Content Studio sidebar', () => {
  afterEach(() => {
    cleanup()
    shellMocks.signOut.mockClear()
  })

  it('uses one Create destination and puts account actions in the profile menu', async () => {
    render(
      <MemoryRouter initialEntries={['/content']}>
        <Routes>
          <Route path="content" element={<ContentStudioShell />}>
            <Route index element={<div>Workspace overview</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Content Studio sections' })
    for (const group of ['Workspace', 'Publishing', 'Engagement', 'Manage']) {
      expect(within(navigation).getByText(group)).toBeInTheDocument()
    }
    expect(within(navigation).getByRole('link', { name: 'Create' })).toHaveAttribute('href', '/content/create')
    expect(screen.queryByRole('link', { name: 'Create post' })).not.toBeInTheDocument()
    expect(screen.queryByText('Ready when you are')).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }))
    const menu = screen.getByRole('menu', { name: 'Profile and settings' })
    expect(within(menu).getByText('va@gmail.com')).toBeInTheDocument()
    expect(within(menu).getByText('Vaibhav workspace')).toBeInTheDocument()
    expect(within(menu).getByText('Owner')).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Settings/i })).toHaveAttribute('href', '/content/settings')
    expect(within(menu).getByRole('menuitem', { name: /Brand & publishing/i })).toHaveAttribute('href', '/content/library?panel=brand')

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    await waitFor(() => expect(shellMocks.signOut).toHaveBeenCalledOnce())
  })
})
