import {
  Building2,
  Check,
  Download,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  Palette,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { contentKnowledgeApi } from '../../../api/contentKnowledge'
import { contentStudioApi } from '../../../api/contentStudio'
import type { BrandBrain } from '../../../types/contentKnowledge'
import { useContentStudio } from '../ContentStudioContext'
import { customerSafeMessage } from '../contentUtils'

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const splitList = (value: string) => value.split(/\n|,/).map((item) => item.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean)
const splitLines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean)

const tonePresets = [
  'Pragmatic, authoritative, efficiency-focused',
  'Friendly, approachable, educational',
  'Bold, provocative, thought-leading',
  'Clear, concise, professional',
  'Warm, conversational, story-driven',
]

const aiSampleTemplates: Record<string, {
  company_description: string
  audience: string
  brand_voice: string
  content_pillars: string[]
  image_style: string
  calls_to_action: string[]
  forbidden_topics: string[]
}> = {
  saas: {
    company_description: 'A cloud software platform that automates repetitive workflows, accelerates team collaboration, and delivers real-time analytics to help modern businesses operate with maximum speed and clarity.',
    audience: 'Operations leads, product managers, IT leaders, and founders at fast-growing companies looking to eliminate busywork.',
    brand_voice: 'Pragmatic, authoritative, efficiency-focused and encouraging',
    content_pillars: ['Workflow Optimization & Automation', 'Actionable Productivity Tips', 'Modern Operations Case Studies', 'Industry Trends & Future of Work'],
    image_style: 'Clean, high-contrast UI graphics, minimalist workspace photography, muted purple and indigo accents, ample whitespace',
    calls_to_action: ['Start your 14-day free trial', 'Book a 15-minute product tour', 'Share your thoughts in the comments below'],
    forbidden_topics: ['Disparaging named competitors', 'Unverified statistics or ROI promises', 'Gimmicky buzzwords'],
  },
  agency: {
    company_description: 'A full-service growth and creative consulting agency helping brands scale customer acquisition through organic content, high-converting design, and data-backed performance marketing.',
    audience: 'Founders, Chief Marketing Officers, e-commerce directors, and marketing managers wanting higher ROI.',
    brand_voice: 'Insightful, strategic, candid, and results-backed',
    content_pillars: ['Breakdowns of Winning Campaigns', 'Growth & Conversion Experiments', 'Creative Best Practices', 'Behind the Scenes of Client Wins'],
    image_style: 'Bold typographic carousels, authentic high-resolution studio photography, warm neutral tones with vivid accents',
    calls_to_action: ['Grab our free growth audit', 'Drop a comment with your biggest hurdle', 'Read the full teardown at our website'],
    forbidden_topics: ['Guaranteed 10x revenue claims', 'Speculative marketing gossip', 'Unvetted vendor tools'],
  },
  ecommerce: {
    company_description: 'An independent sustainable lifestyle brand delivering premium, responsibly sourced everyday goods designed for timeless durability and effortless comfort.',
    audience: 'Conscious consumers, design lovers, and everyday shoppers who value durability, eco-friendly materials, and mindful living.',
    brand_voice: 'Warm, authentic, inspiring, and transparent',
    content_pillars: ['Sustainable Living Practical Tips', 'Behind the Craft & Ethical Sourcing', 'Customer Stories & Community Highlights', 'Care Guides for Long-Lasting Goods'],
    image_style: 'Warm natural daylight photography, rich organic textures, earthy tones (terracotta, sage, warm beige), clean lifestyle compositions',
    calls_to_action: ['Explore the new collection', 'Join our community newsletter for 10% off', 'Tag a friend who loves sustainable design'],
    forbidden_topics: ['Aggressive discount countdowns', 'False scarcity hype', 'Greenwashing claims'],
  },
  services: {
    company_description: 'A trusted local service provider committed to prompt, honest, and high-quality solutions for residential and commercial property owners with guaranteed satisfaction.',
    audience: 'Homeowners, property managers, landlords, and local business owners who want reliable, high-grade service without hassles.',
    brand_voice: 'Helpful, dependable, straightforward, and friendly',
    content_pillars: ['Preventative Maintenance Tips', 'Common Mistakes to Avoid', 'Real Before & After Project Spotlights', 'Customer Questions Answered'],
    image_style: 'Sharp, authentic on-site photos, clean vehicle and team branding, bright natural lighting, no stock cliches',
    calls_to_action: ['Schedule your free inspection today', 'Call our team for emergency service', 'Save this checklist for your next checkup'],
    forbidden_topics: ['Fear-mongering tactics', 'Negative comments about other contractors', 'Uncertified DIY shortcuts'],
  },
}

const demoBrand: BrandBrain = {
  id: 'demo', version: 1, version_id: 'demo-v1', business_description: '', audience: '', goals: [],
  voice: '', voice_rules: [], example_posts: [], content_pillars: [], calls_to_action: [], visual_direction: '',
  forbidden_topics: [], performance_rules: [], suggestions: [], updated_at: new Date().toISOString(),
}

const LOGO_STORAGE_KEY = 'content_studio_brand_logo'
const LOGO_INCLUDE_KEY = 'content_studio_include_logo'

export function ContentSettingsView() {
  const { settingsDraft, setSettingsDraft, saveSettings, busy, isDemo, reload } = useContentStudio()
  const [brand, setBrand] = useState<BrandBrain | null>(null)
  const [brandBusy, setBrandBusy] = useState('')
  const [brandMessage, setBrandMessage] = useState('')
  const [brandError, setBrandError] = useState(false)
  const [dataBusy, setDataBusy] = useState<'export' | 'delete' | ''>('')
  const [confirmation, setConfirmation] = useState('')
  const [dataMessage, setDataMessage] = useState('')
  const [dataError, setDataError] = useState(false)

  // Brand Logo state
  const [logoUrl, setLogoUrl] = useState<string>(() => localStorage.getItem(LOGO_STORAGE_KEY) || '')
  const [includeLogo, setIncludeLogo] = useState<boolean>(() => {
    const saved = localStorage.getItem(LOGO_INCLUDE_KEY)
    return saved !== null ? saved === 'true' : true
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI Suggestions modal state
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiIndustry, setAiIndustry] = useState<string>('saas')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [generatedSuggestions, setGeneratedSuggestions] = useState<typeof aiSampleTemplates['saas'] | null>(null)

  useEffect(() => {
    let active = true
    ;(isDemo ? Promise.resolve(structuredClone(demoBrand)) : contentKnowledgeApi.brand())
      .then((value) => { if (active) setBrand(value) })
      .catch((error) => {
        if (!active) return
        setBrandError(true)
        setBrandMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not load the complete Brand profile. Basic settings are still available.'))
      })
    return () => { active = false }
  }, [isDemo])

  const changeBrand = <K extends keyof BrandBrain>(key: K, value: BrandBrain[K]) =>
    setBrand((current) => current ? { ...current, [key]: value } : current)

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result) {
        setLogoUrl(result)
        try { localStorage.setItem(LOGO_STORAGE_KEY, result) } catch { /* quota guard */ }
        setBrandMessage('Logo uploaded and saved for your brand.')
        setBrandError(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoUrl('')
    localStorage.removeItem(LOGO_STORAGE_KEY)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setBrandMessage('Logo removed.')
  }

  const handleToggleIncludeLogo = (checked: boolean) => {
    setIncludeLogo(checked)
    localStorage.setItem(LOGO_INCLUDE_KEY, String(checked))
  }

  const handleGenerateAiSuggestions = () => {
    setAiGenerating(true)
    setTimeout(() => {
      const template = aiSampleTemplates[aiIndustry] || aiSampleTemplates.saas
      const businessName = settingsDraft.page_name.trim() || 'Your business'
      const tailored = {
        ...template,
        company_description: template.company_description.replace(/A cloud software platform|A full-service growth and creative consulting agency|An independent sustainable lifestyle brand|A trusted local service provider/, businessName),
      }
      setGeneratedSuggestions(tailored)
      setAiGenerating(false)
    }, 450)
  }

  const applyAllAiSuggestions = () => {
    if (!generatedSuggestions) return
    setSettingsDraft({
      ...settingsDraft,
      company_description: generatedSuggestions.company_description,
      audience: generatedSuggestions.audience,
      brand_voice: generatedSuggestions.brand_voice,
      content_pillars: generatedSuggestions.content_pillars,
      image_style: generatedSuggestions.image_style,
      calls_to_action: generatedSuggestions.calls_to_action,
      forbidden_topics: generatedSuggestions.forbidden_topics,
    })
    setShowAiModal(false)
    setBrandMessage('✨ AI suggestions applied! Review and save your settings.')
    setBrandError(false)
  }

  const saveAll = async () => {
    setBrandBusy('save'); setBrandMessage(''); setBrandError(false)
    try {
      const settingsSaved = await saveSettings()
      if (!settingsSaved) throw new Error('Publishing settings were not saved, so the Brand profile was left unchanged.')
      if (brand) {
        const payload: Partial<BrandBrain> = {
          business_description: settingsDraft.company_description,
          audience: settingsDraft.audience,
          goals: brand.goals,
          voice: settingsDraft.brand_voice,
          voice_rules: brand.voice_rules,
          example_posts: brand.example_posts,
          content_pillars: settingsDraft.content_pillars,
          calls_to_action: settingsDraft.calls_to_action,
          visual_direction: settingsDraft.image_style,
          forbidden_topics: settingsDraft.forbidden_topics,
        }
        const saved = isDemo ? { ...brand, ...payload, version: brand.version + 1 } : await contentKnowledgeApi.saveBrand(payload)
        setBrand(saved)
      }
      setBrandMessage('Brand and publishing settings saved.')
    } catch (error) {
      setBrandError(true)
      setBrandMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not save all settings.'))
    } finally { setBrandBusy('') }
  }

  const decideSuggestion = async (id: string, action: 'CONFIRM' | 'DISMISS') => {
    if (!brand) return
    setBrandBusy(`${id}-${action}`); setBrandMessage(''); setBrandError(false)
    try {
      setBrand(isDemo ? { ...brand, suggestions: brand.suggestions.filter((item) => item.id !== id) } : await contentKnowledgeApi.decideSuggestion(id, action))
      setBrandMessage(action === 'CONFIRM' ? 'The learned preference was added to your Brand.' : 'Suggestion dismissed.')
    } catch (error) {
      setBrandError(true)
      setBrandMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not update that suggestion.'))
    } finally { setBrandBusy('') }
  }

  const saving = busy === 'settings' || brandBusy === 'save'

  return (
    <section className="li-settings-page" aria-label="Content Studio settings">
      <div className="li-settings-actions">
        <button
          type="button"
          className="li-quiet-button ai-suggest-open-btn"
          onClick={() => {
            setShowAiModal(true)
            if (!generatedSuggestions) handleGenerateAiSuggestions()
          }}
        >
          <Sparkles size={16} className="ai-sparkle-icon" />
          <span>Suggest with AI</span>
        </button>
        <button
          className="button button-dark"
          onClick={() => void saveAll()}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save changes
        </button>
      </div>

      {brandMessage && (
        <div className={`li-banner ${brandError ? 'error' : 'success'}`} role={brandError ? 'alert' : 'status'}>
          {brandMessage}
        </div>
      )}

      <div className="li-settings-grid">
        {/* Card 1: Brand and business */}
        <div className="card li-settings-card">
          <div className="li-card-title">
            <span>1</span>
            <div>
              <h3>Brand and business</h3>
              <p>Basic information about your business used to make every post accurate and relevant.</p>
            </div>
          </div>

          <div className="li-form-grid">
            <label className="li-field">
              <span className="field-label-group">
                <strong>Business name</strong>
                <small className="field-hint">What is your company or brand called?</small>
              </span>
              <input
                value={settingsDraft.page_name}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, page_name: e.target.value })}
                placeholder="e.g. Routefloww"
              />
            </label>

            <label className="li-field">
              <span className="field-label-group">
                <strong>Language</strong>
                <small className="field-hint">Language for all generated posts</small>
              </span>
              <select
                value={settingsDraft.language}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, language: e.target.value })}
              >
                <option>English</option>
                <option>Hindi</option>
                <option>Spanish</option>
                <option>French</option>
              </select>
            </label>

            <label className="li-field full">
              <span className="field-label-group">
                <strong>What does the business do?</strong>
                <small className="field-hint">In simple terms: what products or services do you provide, and what problem do you solve?</small>
              </span>
              <textarea
                rows={4}
                value={settingsDraft.company_description}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, company_description: e.target.value })}
                placeholder="e.g. Routefloww is a smart route optimization app for delivery businesses that cuts fuel costs by up to 30% and automates driver dispatching."
              />
            </label>

            <label className="li-field full">
              <span className="field-label-group">
                <strong>Target audience</strong>
                <small className="field-hint">Who are your ideal customers and readers? Who should find your posts valuable?</small>
              </span>
              <textarea
                rows={3}
                value={settingsDraft.audience}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, audience: e.target.value })}
                placeholder="e.g. Small delivery business owners, fleet managers, logistics coordinators, and local courier teams."
              />
            </label>
          </div>

          {/* Dedicated Logo Upload Section */}
          <div className="brand-logo-section">
            <div className="brand-logo-header">
              <div>
                <strong>Brand Logo & Watermark</strong>
                <p>Upload your logo to keep your visual identity consistent across generated graphics.</p>
              </div>
            </div>

            <div className="brand-logo-card">
              {logoUrl ? (
                <div className="logo-preview-box">
                  <div className="logo-image-container">
                    <img src={logoUrl} alt="Brand Logo" className="logo-preview-img" />
                  </div>
                  <div className="logo-details">
                    <span className="logo-active-tag">Logo Active</span>
                    <p>This logo can be automatically placed on new social media images.</p>
                    <div className="logo-btn-row">
                      <button
                        type="button"
                        className="li-quiet-button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={14} /> Change logo
                      </button>
                      <button
                        type="button"
                        className="li-text-button danger"
                        onClick={handleRemoveLogo}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="logo-upload-horizontal"
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                >
                  <div className="logo-upload-tile">
                    <Upload size={18} />
                  </div>
                  <div className="logo-upload-text">
                    <strong>Upload company logo</strong>
                    <span>PNG, SVG, or JPG (transparent background recommended)</span>
                  </div>
                  <button
                    type="button"
                    className="button button-dark logo-select-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    Choose logo file
                  </button>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
              />

              {/* Checkbox: Include logo in post or not */}
              <label className="logo-include-toggle">
                <input
                  type="checkbox"
                  checked={includeLogo}
                  onChange={(e) => handleToggleIncludeLogo(e.target.checked)}
                />
                <div>
                  <strong>Include brand logo on post images</strong>
                  <small>When enabled, generated artwork reserves clean space and attaches your brand logo to post visuals.</small>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Card 2: Content style */}
        <div className="card li-settings-card brand-settings-card">
          <div className="li-card-title">
            <span>2</span>
            <div>
              <h3>Content style</h3>
              <p>Voice, topics, visuals, and guardrails in one place.</p>
            </div>
            {brand && <small className="brand-version">Version {brand.version}</small>}
          </div>

          <div className="li-form-grid">
            <label className="li-field full">
              <span className="field-label-group">
                <strong>Brand voice</strong>
                <small className="field-hint">How should your posts sound? Pick a tone preset or describe your style:</small>
              </span>
              <input
                value={settingsDraft.brand_voice}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, brand_voice: e.target.value })}
                placeholder="e.g. Pragmatic, authoritative, efficiency-focused"
              />
              <div className="tone-pill-list">
                {tonePresets.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    className={`tone-pill ${settingsDraft.brand_voice === tone ? 'active' : ''}`}
                    onClick={() => setSettingsDraft({ ...settingsDraft, brand_voice: tone })}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </label>

            <label className="li-field full">
              <span className="field-label-group">
                <strong>Content pillars <small>comma separated</small></strong>
                <small className="field-hint">The 2 to 4 core themes your business posts about most often:</small>
              </span>
              <input
                value={settingsDraft.content_pillars.join(', ')}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, content_pillars: splitList(e.target.value) })}
                placeholder="e.g. Route Optimization, Dispatch Automation, Driver Safety Tips"
              />
            </label>

            <label className="li-field full">
              <span className="field-label-group">
                <strong>Visual direction</strong>
                <small className="field-hint">How should post images look? (Colors, photography style, graphic design elements)</small>
              </span>
              <textarea
                rows={3}
                value={settingsDraft.image_style}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, image_style: e.target.value })}
                placeholder="e.g. Clean high-contrast UI graphics, minimalist dispatch dashboard visuals, delivery van logistics, and clean vector route graphics with ample negative space."
              />
            </label>

            <div className={`provider-state image-provider ${settingsDraft.image_provider_ready.ready ? 'ready' : ''}`}>
              <span>{settingsDraft.image_provider_ready.ready ? <Check size={16} /> : <ImageIcon size={16} />}</span>
              <div>
                <strong>{settingsDraft.image_provider_ready.ready ? 'Image creation ready' : 'Image creation needs attention'}</strong>
                <small>{settingsDraft.image_provider_ready.ready ? 'Images can be created for new posts.' : 'Ask a workspace administrator to finish image setup.'}</small>
              </div>
            </div>

            <label className="li-field">
              <span className="field-label-group">
                <strong>Calls to action</strong>
                <small className="field-hint">What do you want readers to do at the end of posts?</small>
              </span>
              <input
                value={settingsDraft.calls_to_action.join(', ')}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, calls_to_action: splitList(e.target.value) })}
                placeholder="e.g. Start your 14-day free trial, Book a demo"
              />
            </label>

            <label className="li-field">
              <span className="field-label-group">
                <strong>Topics to avoid</strong>
                <small className="field-hint">Any subjects, competitors, or claims you never want mentioned</small>
              </span>
              <input
                value={settingsDraft.forbidden_topics.join(', ')}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, forbidden_topics: splitList(e.target.value) })}
                placeholder="e.g. Disparaging named competitors, Unverified pricing"
              />
            </label>
          </div>

          <details className="brand-guidance">
            <summary>More brand guidance <small>optional</small></summary>
            <p>Add these only when you want tighter consistency. They are reused automatically and do not add another AI call.</p>
            {brand ? (
              <div className="knowledge-form-grid">
                <label>
                  Business goals <small>one per line</small>
                  <textarea value={brand.goals.join('\n')} onChange={(event) => changeBrand('goals', splitLines(event.target.value))} />
                </label>
                <label>
                  Voice rules <small>one per line</small>
                  <textarea value={brand.voice_rules.join('\n')} onChange={(event) => changeBrand('voice_rules', splitLines(event.target.value))} />
                </label>
                <label className="full">
                  Example posts you like <small>one per line</small>
                  <textarea value={brand.example_posts.join('\n')} onChange={(event) => changeBrand('example_posts', splitLines(event.target.value))} />
                </label>
              </div>
            ) : (
              <div className="li-loading" role="status">Loading brand guidance…</div>
            )}

            {brand?.suggestions.map((suggestion) => (
              <div className="voice-suggestion" key={suggestion.id}>
                <Sparkles size={18} />
                <span>
                  <strong>Learned from your edits</strong>
                  <small>Not applied · noticed in {suggestion.evidence_count} draft edits</small>
                  <p>{suggestion.rule}</p>
                </span>
                <button
                  className="li-quiet-button"
                  disabled={Boolean(brandBusy)}
                  aria-busy={brandBusy === `${suggestion.id}-CONFIRM`}
                  onClick={() => void decideSuggestion(suggestion.id, 'CONFIRM')}
                >
                  {brandBusy === `${suggestion.id}-CONFIRM` ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Add rule
                </button>
                <button
                  className="li-text-button"
                  disabled={Boolean(brandBusy)}
                  onClick={() => void decideSuggestion(suggestion.id, 'DISMISS')}
                >
                  <X size={15} /> Dismiss
                </button>
              </div>
            ))}

            {brand && brand.performance_rules.length > 0 && (
              <div className="brand-performance-rules">
                <strong>Accepted analytics recommendations</strong>
                <small>These influence future drafts after you approve them in Analytics.</small>
                <ul>
                  {brand.performance_rules.map((rule) => <li key={rule}>{rule}</li>)}
                </ul>
              </div>
            )}
          </details>
        </div>

        {/* Card 3: Schedule */}
        <div className="card li-settings-card">
          <div className="li-card-title">
            <span>3</span>
            <div>
              <h3>Schedule</h3>
              <p>Choose when approved posts publish.</p>
            </div>
          </div>
          <div className="li-days">
            {dayNames.map((day, index) => (
              <button
                type="button"
                aria-pressed={settingsDraft.schedule_days.includes(index)}
                key={day}
                className={settingsDraft.schedule_days.includes(index) ? 'selected' : ''}
                onClick={() =>
                  setSettingsDraft({
                    ...settingsDraft,
                    schedule_days: settingsDraft.schedule_days.includes(index)
                      ? settingsDraft.schedule_days.filter((value) => value !== index)
                      : [...settingsDraft.schedule_days, index].sort(),
                  })
                }
              >
                <strong>{day.slice(0, 3)}</strong>
              </button>
            ))}
          </div>
          <div className="li-form-grid compact">
            <label className="li-field">
              <span>Publishing time</span>
              <input
                type="time"
                value={settingsDraft.post_time.slice(0, 5)}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, post_time: e.target.value })}
              />
            </label>
            <label className="li-field">
              <span>Timezone</span>
              <select
                value={settingsDraft.timezone}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, timezone: e.target.value })}
              >
                <option>Asia/Kolkata</option>
                <option>Europe/London</option>
                <option>America/New_York</option>
                <option>UTC</option>
              </select>
            </label>
          </div>
        </div>

        {/* Card 4: Approvals */}
        <div className="card li-settings-card">
          <div className="li-card-title">
            <span>4</span>
            <div>
              <h3>Approvals</h3>
              <p>Choose how posts enter the calendar.</p>
            </div>
          </div>
          <fieldset className="li-choice-group">
            <legend>Approval</legend>
            <label>
              <input
                type="radio"
                checked={settingsDraft.approval_mode === 'REQUIRE_APPROVAL'}
                onChange={() => setSettingsDraft({ ...settingsDraft, approval_mode: 'REQUIRE_APPROVAL' })}
              />
              <span>
                <strong>Review every post</strong>
                <small>Recommended: each generated post goes to Approvals so you can review and polish before publishing.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                checked={settingsDraft.approval_mode === 'AUTO_PUBLISH'}
                onChange={() => setSettingsDraft({ ...settingsDraft, approval_mode: 'AUTO_PUBLISH' })}
              />
              <span>
                <strong>Approve automatically</strong>
                <small>Created posts enter the calendar and schedule immediately without manual review.</small>
              </span>
            </label>
          </fieldset>
        </div>
      </div>

      {/* Advanced Workspace Settings */}
      <details className="card content-advanced">
        <summary>Advanced workspace settings</summary>
        <div>
          <p>Fine-tune how far ahead Content Studio prepares posts.</p>
          <div className="li-form-grid compact">
            <label className="li-field">
              <span>Posts each week</span>
              <input
                type="number"
                min="1"
                max="14"
                value={settingsDraft.posts_per_week}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, posts_per_week: Number(e.target.value) })}
              />
            </label>
            <label className="li-field">
              <span>Plan ahead <small>days</small></span>
              <input
                type="number"
                min="1"
                max="90"
                value={settingsDraft.queue_horizon_days}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, queue_horizon_days: Number(e.target.value) })}
              />
            </label>
          </div>

          <section className="content-data-controls" aria-labelledby="content-data-title">
            <h3 id="content-data-title">Your Content Studio data</h3>
            <p>Download a copy, or permanently remove posts, sources, connections, and settings from this workspace.</p>
            <div className="content-data-actions">
              <button
                type="button"
                className="li-quiet-button"
                disabled={Boolean(dataBusy) || isDemo}
                aria-busy={dataBusy === 'export'}
                onClick={async () => {
                  setDataBusy('export'); setDataMessage(''); setDataError(false)
                  try {
                    const payload = await contentStudioApi.exportData()
                    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
                    const link = document.createElement('a')
                    link.href = url
                    link.download = 'content-studio-export.json'
                    document.body.appendChild(link)
                    link.click()
                    link.remove()
                    URL.revokeObjectURL(url)
                    setDataMessage('Your download is ready.')
                  } catch (error) {
                    setDataError(true)
                    setDataMessage(error instanceof Error ? error.message : 'Could not export Content Studio data.')
                  } finally { setDataBusy('') }
                }}
              >
                {dataBusy === 'export' ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />} Download data
              </button>
            </div>

            <div className="content-delete-control">
              <label className="li-field">
                <span>To delete, type DELETE CONTENT STUDIO</span>
                <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              </label>
              <button
                type="button"
                className="content-danger-button"
                disabled={Boolean(dataBusy) || confirmation !== 'DELETE CONTENT STUDIO' || isDemo}
                aria-busy={dataBusy === 'delete'}
                onClick={async () => {
                  setDataBusy('delete'); setDataMessage(''); setDataError(false)
                  try {
                    await contentStudioApi.deleteData(confirmation)
                    setConfirmation('')
                    setDataMessage('Content Studio data was deleted from this workspace.')
                    await reload()
                  } catch (error) {
                    setDataError(true)
                    setDataMessage(error instanceof Error ? error.message : 'Could not delete Content Studio data.')
                  } finally { setDataBusy('') }
                }}
              >
                {dataBusy === 'delete' ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />} Delete Content Studio data
              </button>
            </div>
            {isDemo && <p>Data actions are unavailable in demo mode.</p>}
            {dataMessage && (
              <p className={dataError ? 'content-data-message error' : 'content-data-message'} role={dataError ? 'alert' : 'status'}>
                {dataMessage}
              </p>
            )}
          </section>
        </div>
      </details>

      {/* AI Suggestion Modal */}
      {showAiModal && (
        <div className="studio-modal-backdrop" onClick={() => setShowAiModal(false)}>
          <div className="studio-modal-card ai-suggest-modal" onClick={(e) => e.stopPropagation()}>
            <header className="studio-modal-header">
              <div className="ai-modal-title">
                <span className="ai-badge-icon"><Wand2 size={20} /></span>
                <div>
                  <h3>AI Brand Suggestion</h3>
                  <p>Let AI suggest optimal brand voice, pillars, audience, and visual direction for your business.</p>
                </div>
              </div>
              <button
                type="button"
                className="studio-modal-close"
                onClick={() => setShowAiModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </header>

            <div className="ai-modal-body">
              <div className="ai-industry-selector">
                <label>Select your industry / archetype:</label>
                <div className="ai-industry-buttons">
                  <button
                    type="button"
                    className={aiIndustry === 'saas' ? 'active' : ''}
                    onClick={() => { setAiIndustry('saas'); setGeneratedSuggestions(aiSampleTemplates.saas) }}
                  >
                    <Building2 size={15} /> SaaS & Software
                  </button>
                  <button
                    type="button"
                    className={aiIndustry === 'agency' ? 'active' : ''}
                    onClick={() => { setAiIndustry('agency'); setGeneratedSuggestions(aiSampleTemplates.agency) }}
                  >
                    <Users size={15} /> Agency & Consulting
                  </button>
                  <button
                    type="button"
                    className={aiIndustry === 'ecommerce' ? 'active' : ''}
                    onClick={() => { setAiIndustry('ecommerce'); setGeneratedSuggestions(aiSampleTemplates.ecommerce) }}
                  >
                    <Palette size={15} /> E-Commerce & Retail
                  </button>
                  <button
                    type="button"
                    className={aiIndustry === 'services' ? 'active' : ''}
                    onClick={() => { setAiIndustry('services'); setGeneratedSuggestions(aiSampleTemplates.services) }}
                  >
                    <MessageSquare size={15} /> Local & Home Services
                  </button>
                </div>
              </div>

              {aiGenerating ? (
                <div className="ai-generating-state">
                  <LoaderCircle className="spin" size={26} />
                  <strong>Generating smart brand suggestions…</strong>
                </div>
              ) : generatedSuggestions ? (
                <div className="ai-preview-grid">
                  <div className="ai-suggestion-box">
                    <span className="suggestion-label">What does the business do?</span>
                    <p>{generatedSuggestions.company_description}</p>
                  </div>
                  <div className="ai-suggestion-box">
                    <span className="suggestion-label">Target Audience</span>
                    <p>{generatedSuggestions.audience}</p>
                  </div>
                  <div className="ai-suggestion-box">
                    <span className="suggestion-label">Brand Voice</span>
                    <p>{generatedSuggestions.brand_voice}</p>
                  </div>
                  <div className="ai-suggestion-box">
                    <span className="suggestion-label">Content Pillars</span>
                    <p>{generatedSuggestions.content_pillars.join(' · ')}</p>
                  </div>
                  <div className="ai-suggestion-box">
                    <span className="suggestion-label">Visual Direction</span>
                    <p>{generatedSuggestions.image_style}</p>
                  </div>
                  <div className="ai-suggestion-box">
                    <span className="suggestion-label">Calls to Action</span>
                    <p>{generatedSuggestions.calls_to_action.join(' · ')}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <footer className="studio-modal-footer">
              <button
                type="button"
                className="li-quiet-button"
                onClick={() => setShowAiModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-dark"
                onClick={applyAllAiSuggestions}
              >
                <Sparkles size={15} /> Apply All Suggestions
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}
