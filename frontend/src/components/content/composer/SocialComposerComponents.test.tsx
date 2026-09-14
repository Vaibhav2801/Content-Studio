import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeDemoPost, socialComposerMockOptions } from '../../../api/socialComposerMock'
import { MediaManager } from './MediaManager'
import { PlatformPreview } from './PlatformPreview'
import { PlatformSelector } from './PlatformSelector'
import { VariantEditor } from './VariantEditor'

describe('social composer components', () => {
  afterEach(cleanup)

  it('selects more than one connected network with accessible controls', () => {
    const change = vi.fn()
    render(<PlatformSelector connections={socialComposerMockOptions.connections} selected={['LINKEDIN']} onChange={change} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Instagram/i }))
    expect(change).toHaveBeenCalledWith(['LINKEDIN', 'INSTAGRAM'])
  })

  it('edits copy and exposes network-specific direct actions', () => {
    const variant = makeDemoPost('Idea', 'Body copy', ['X']).variants[0]
    const change = vi.fn()
    const rewrite = vi.fn()
    render(<VariantEditor variant={variant} busy={false} onChange={change} onRewrite={rewrite} />)
    fireEvent.change(screen.getByRole('textbox', { name: /Post text/i }), { target: { value: 'Changed X copy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create X thread' }))
    expect(change).toHaveBeenCalledWith({ copy: 'Changed X copy' })
    expect(rewrite).toHaveBeenCalledWith('CREATE_X_THREAD')
    expect(screen.queryByRole('button', { name: /Instagram carousel/i })).not.toBeInTheDocument()
  })

  it('shows platform validation beside the affected field', () => {
    const variant = makeDemoPost('Idea', 'Body copy', ['X']).variants[0]
    variant.validation = { valid: false, fields: { copy: ['X posts must be 280 characters or fewer.'] } }
    render(<VariantEditor variant={variant} busy={false} onChange={vi.fn()} onRewrite={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('280 characters or fewer')
    expect(screen.getByRole('textbox', { name: /Post text/i })).toHaveAttribute('aria-invalid', 'true')
  })

  it('supports alt text, image ordering, regeneration and removal', () => {
    const variant = makeDemoPost('Idea', 'Body copy', ['LINKEDIN']).variants[0]
    variant.media = [
      { id: 'one', asset_type: 'IMAGE', source: 'UPLOAD', original_filename: 'one.png', content_type: 'image/png', byte_size: 10, width: 100, height: 100, duration_ms: null, alt_text: 'First', sort_order: 0, publish_url: '/one.png' },
      { id: 'two', asset_type: 'IMAGE', source: 'UPLOAD', original_filename: 'two.png', content_type: 'image/png', byte_size: 10, width: 100, height: 100, duration_ms: null, alt_text: 'Second', sort_order: 1, publish_url: '/two.png' },
    ]
    const reorder = vi.fn(); const alt = vi.fn(); const regenerate = vi.fn(); const remove = vi.fn()
    render(<MediaManager variant={variant} busy={false} onUpload={vi.fn()} onRemove={remove} onReorder={reorder} onAltText={alt} onRegenerate={regenerate} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Move right' })[0])
    expect(reorder).toHaveBeenCalledWith(['two', 'one'])
    fireEvent.change(screen.getByDisplayValue('First'), { target: { value: 'Accessible first image' } })
    fireEvent.blur(screen.getByDisplayValue('Accessible first image'))
    expect(alt).toHaveBeenCalledWith('one', 'Accessible first image')
    fireEvent.click(screen.getAllByRole('button', { name: 'Create this image again' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove media' })[0])
    expect(regenerate).toHaveBeenCalledWith('one')
    expect(remove).toHaveBeenCalledWith('one')
  })

  it('renders X threads and Instagram carousel slides accurately', () => {
    const x = makeDemoPost('Idea', 'Body copy', ['X']).variants[0]
    x.metadata = { format: 'THREAD', thread: ['First post', 'Second post'] }
    const instagram = makeDemoPost('Idea', 'Body copy', ['INSTAGRAM']).variants[0]
    instagram.metadata = { format: 'CAROUSEL', carousel_slides: ['Hook', 'Useful detail'] }
    const { rerender } = render(<PlatformPreview variant={x} />)
    expect(screen.getByLabelText('X preview')).toHaveTextContent('1/2')
    expect(screen.getByText('Second post')).toBeInTheDocument()
    rerender(<PlatformPreview variant={instagram} />)
    expect(screen.getByLabelText('Instagram preview')).toHaveTextContent('Slide 2')
  })
})
