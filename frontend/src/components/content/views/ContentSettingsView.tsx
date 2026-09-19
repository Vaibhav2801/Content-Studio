import { Check, Download, Image as ImageIcon, LoaderCircle, Save, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { contentKnowledgeApi } from '../../../api/contentKnowledge'
import { contentStudioApi } from '../../../api/contentStudio'
import type { BrandBrain } from '../../../types/contentKnowledge'
import { useContentStudio } from '../ContentStudioContext'
import { customerSafeMessage } from '../contentUtils'

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const splitList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
const splitLines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean)
const demoBrand: BrandBrain = {
  id: 'demo', version: 1, version_id: 'demo-v1', business_description: '', audience: '', goals: [],
  voice: '', voice_rules: [], example_posts: [], content_pillars: [], calls_to_action: [], visual_direction: '',
  forbidden_topics: [], performance_rules: [], suggestions: [], updated_at: new Date().toISOString(),
}

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

  const changeBrand = <K extends keyof BrandBrain>(key: K, value: BrandBrain[K]) => setBrand((current) => current ? { ...current, [key]: value } : current)

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
  return <section className="li-settings-page" aria-label="Content Studio settings">
    <div className="li-settings-actions"><button className="button button-dark" onClick={() => void saveAll()} disabled={saving} aria-busy={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save changes</button></div>
    {brandMessage && <div className={`li-banner ${brandError ? 'error' : 'success'}`} role={brandError ? 'alert' : 'status'}>{brandMessage}</div>}

    <div className="li-settings-grid">
      <div className="card li-settings-card"><div className="li-card-title"><span>1</span><div><h3>Brand and business</h3><p>The single profile used for every generated post.</p></div></div><div className="li-form-grid"><label className="li-field"><span>Business name</span><input value={settingsDraft.page_name} onChange={(e) => setSettingsDraft({ ...settingsDraft, page_name: e.target.value })} placeholder="Your company" /></label><label className="li-field"><span>Language</span><select value={settingsDraft.language} onChange={(e) => setSettingsDraft({ ...settingsDraft, language: e.target.value })}><option>English</option><option>Hindi</option><option>Spanish</option><option>French</option></select></label><label className="li-field full"><span>What does the business do?</span><textarea value={settingsDraft.company_description} onChange={(e) => setSettingsDraft({ ...settingsDraft, company_description: e.target.value })} placeholder="Products, services, positioning, and anything the writer should know." /></label><label className="li-field full"><span>Target audience</span><textarea value={settingsDraft.audience} onChange={(e) => setSettingsDraft({ ...settingsDraft, audience: e.target.value })} placeholder="Who should find these posts useful?" /></label></div></div>

      <div className="card li-settings-card brand-settings-card"><div className="li-card-title"><span>2</span><div><h3>Content style</h3><p>Voice, topics, visuals, and guardrails in one place.</p></div>{brand && <small className="brand-version">Version {brand.version}</small>}</div><div className="li-form-grid"><label className="li-field"><span>Brand voice</span><input value={settingsDraft.brand_voice} onChange={(e) => setSettingsDraft({ ...settingsDraft, brand_voice: e.target.value })} /></label><label className="li-field"><span>Content pillars <small>comma separated</small></span><input value={settingsDraft.content_pillars.join(', ')} onChange={(e) => setSettingsDraft({ ...settingsDraft, content_pillars: splitList(e.target.value) })} /></label><label className="li-field full"><span>Visual direction</span><textarea value={settingsDraft.image_style} onChange={(e) => setSettingsDraft({ ...settingsDraft, image_style: e.target.value })} placeholder="Example: editorial photography, navy and orange palette, simple compositions" /></label><div className={`provider-state image-provider ${settingsDraft.image_provider_ready.ready ? 'ready' : ''}`}><span>{settingsDraft.image_provider_ready.ready ? <Check size={16} /> : <ImageIcon size={16} />}</span><div><strong>{settingsDraft.image_provider_ready.ready ? 'Image creation ready' : 'Image creation needs attention'}</strong><small>{settingsDraft.image_provider_ready.ready ? 'Images can be created for new posts.' : 'Ask a workspace administrator to finish image setup.'}</small></div></div><label className="li-field"><span>Calls to action</span><input value={settingsDraft.calls_to_action.join(', ')} onChange={(e) => setSettingsDraft({ ...settingsDraft, calls_to_action: splitList(e.target.value) })} /></label><label className="li-field"><span>Topics to avoid</span><input value={settingsDraft.forbidden_topics.join(', ')} onChange={(e) => setSettingsDraft({ ...settingsDraft, forbidden_topics: splitList(e.target.value) })} /></label></div>
        <details className="brand-guidance"><summary>More brand guidance <small>optional</small></summary><p>Add these only when you want tighter consistency. They are reused automatically and do not add another AI call.</p>{brand ? <div className="knowledge-form-grid"><label>Business goals <small>one per line</small><textarea value={brand.goals.join('\n')} onChange={(event) => changeBrand('goals', splitLines(event.target.value))} /></label><label>Voice rules <small>one per line</small><textarea value={brand.voice_rules.join('\n')} onChange={(event) => changeBrand('voice_rules', splitLines(event.target.value))} /></label><label className="full">Example posts you like <small>one per line</small><textarea value={brand.example_posts.join('\n')} onChange={(event) => changeBrand('example_posts', splitLines(event.target.value))} /></label></div> : <div className="li-loading" role="status">Loading brand guidance…</div>}
        {brand?.suggestions.map((suggestion) => <div className="voice-suggestion" key={suggestion.id}><Sparkles size={18} /><span><strong>Learned from your edits</strong><small>Not applied · noticed in {suggestion.evidence_count} draft edits</small><p>{suggestion.rule}</p></span><button className="li-quiet-button" disabled={Boolean(brandBusy)} aria-busy={brandBusy === `${suggestion.id}-CONFIRM`} onClick={() => void decideSuggestion(suggestion.id, 'CONFIRM')}>{brandBusy === `${suggestion.id}-CONFIRM` ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Add rule</button><button className="li-text-button" disabled={Boolean(brandBusy)} onClick={() => void decideSuggestion(suggestion.id, 'DISMISS')}><X size={15} /> Dismiss</button></div>)}
        {brand && brand.performance_rules.length > 0 && <div className="brand-performance-rules"><strong>Accepted analytics recommendations</strong><small>These influence future drafts after you approve them in Analytics.</small><ul>{brand.performance_rules.map((rule) => <li key={rule}>{rule}</li>)}</ul></div>}</details>
      </div>

      <div className="card li-settings-card"><div className="li-card-title"><span>3</span><div><h3>Schedule</h3><p>Choose when approved posts publish.</p></div></div><div className="li-days">{dayNames.map((day, index) => <button type="button" aria-pressed={settingsDraft.schedule_days.includes(index)} key={day} className={settingsDraft.schedule_days.includes(index) ? 'selected' : ''} onClick={() => setSettingsDraft({ ...settingsDraft, schedule_days: settingsDraft.schedule_days.includes(index) ? settingsDraft.schedule_days.filter((value) => value !== index) : [...settingsDraft.schedule_days, index].sort() })}><strong>{day.slice(0, 3)}</strong></button>)}</div><div className="li-form-grid compact"><label className="li-field"><span>Publishing time</span><input type="time" value={settingsDraft.post_time.slice(0, 5)} onChange={(e) => setSettingsDraft({ ...settingsDraft, post_time: e.target.value })} /></label><label className="li-field"><span>Timezone</span><select value={settingsDraft.timezone} onChange={(e) => setSettingsDraft({ ...settingsDraft, timezone: e.target.value })}><option>Asia/Kolkata</option><option>Europe/London</option><option>America/New_York</option><option>UTC</option></select></label></div></div>

      <div className="card li-settings-card"><div className="li-card-title"><span>4</span><div><h3>Approvals</h3><p>Choose how posts enter the calendar.</p></div></div><fieldset className="li-choice-group"><legend>Approval</legend><label><input type="radio" checked={settingsDraft.approval_mode === 'REQUIRE_APPROVAL'} onChange={() => setSettingsDraft({ ...settingsDraft, approval_mode: 'REQUIRE_APPROVAL' })} /><span><strong>Review every post</strong><small>Recommended while refining the content style.</small></span></label><label><input type="radio" checked={settingsDraft.approval_mode === 'AUTO_PUBLISH'} onChange={() => setSettingsDraft({ ...settingsDraft, approval_mode: 'AUTO_PUBLISH' })} /><span><strong>Approve automatically</strong><small>Created posts enter the schedule immediately.</small></span></label></fieldset></div>
    </div>

    <details className="card content-advanced"><summary>Advanced workspace settings</summary><div><p>Fine-tune how far ahead Content Studio prepares posts.</p><div className="li-form-grid compact"><label className="li-field"><span>Posts each week</span><input type="number" min="1" max="14" value={settingsDraft.posts_per_week} onChange={(e) => setSettingsDraft({ ...settingsDraft, posts_per_week: Number(e.target.value) })} /></label><label className="li-field"><span>Plan ahead <small>days</small></span><input type="number" min="1" max="90" value={settingsDraft.queue_horizon_days} onChange={(e) => setSettingsDraft({ ...settingsDraft, queue_horizon_days: Number(e.target.value) })} /></label></div>
      <section className="content-data-controls" aria-labelledby="content-data-title"><h3 id="content-data-title">Your Content Studio data</h3><p>Download a copy, or permanently remove posts, sources, connections, and settings from this workspace.</p><div className="content-data-actions"><button type="button" className="li-quiet-button" disabled={Boolean(dataBusy) || isDemo} aria-busy={dataBusy === 'export'} onClick={async () => { setDataBusy('export'); setDataMessage(''); setDataError(false); try { const payload = await contentStudioApi.exportData(); const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'content-studio-export.json'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setDataMessage('Your download is ready.') } catch (error) { setDataError(true); setDataMessage(error instanceof Error ? error.message : 'Could not export Content Studio data.') } finally { setDataBusy('') } }}>{dataBusy === 'export' ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />} Download data</button></div>
      <div className="content-delete-control"><label className="li-field"><span>To delete, type DELETE CONTENT STUDIO</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label><button type="button" className="content-danger-button" disabled={Boolean(dataBusy) || confirmation !== 'DELETE CONTENT STUDIO' || isDemo} aria-busy={dataBusy === 'delete'} onClick={async () => { setDataBusy('delete'); setDataMessage(''); setDataError(false); try { await contentStudioApi.deleteData(confirmation); setConfirmation(''); setDataMessage('Content Studio data was deleted from this workspace.'); await reload() } catch (error) { setDataError(true); setDataMessage(error instanceof Error ? error.message : 'Could not delete Content Studio data.') } finally { setDataBusy('') } }}>{dataBusy === 'delete' ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />} Delete Content Studio data</button></div>
      {isDemo && <p>Data actions are unavailable in demo mode.</p>}{dataMessage && <p className={dataError ? 'content-data-message error' : 'content-data-message'} role={dataError ? 'alert' : 'status'}>{dataMessage}</p>}</section>
    </div></details>
  </section>
}
