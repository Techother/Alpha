// src/pages/CareProgramsPage.tsx
// Extracted from App.tsx lines 1099–1349

import { useState } from 'react'
import { T, F } from '@/lib/tokens'
import { Card, Btn, Tag, Spin, Empty, Field, SelectField } from '@/components/ui/primitives'
import { useAsync } from '@/lib/hooks'
import { ComingSoon } from '@/lib/utils'
import { FEATURES } from '@/config'
import { supabase } from '@/api/supabase'
import { getPatients } from '@/api/supabase'
import { getMonthlyBillingSummary } from '@/api/billing'
import { getActiveTcmEpisodes, getOverdueTcmEpisodes, createTcmEpisode, logTcmContact, completeTcmMilestone } from '@/api/tcm'

// ── CCM Tab ───────────────────────────────────────────────────

function CCMTab({ period }: { period: string }) {
  const { data: patients, loading } = useAsync(getPatients, [])
  const [logOpen, setLogOpen] = useState<string | null>(null)
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0, 10), duration: '', activityType: 'Chart Review', notes: '' })
  const [saving, setSaving] = useState(false)
  const [logError, setLogError] = useState('')
  const { data: billingData } = useAsync(() => getMonthlyBillingSummary(period), [period])

  const enrolled = (patients ?? []).filter((p: any) => p.ccm_enrolled)
  const billMap: Record<string, any> = {}
  for (const b of (billingData ?? [])) billMap[(b as any).patientId] = b

  function ccmStatus(mins: number) {
    if (mins >= 20) return { label: 'Active', type: 'green' as const }
    if (mins >= 10) return { label: 'In Progress', type: 'amber' as const }
    if (mins > 0)   return { label: 'At Risk', type: 'red' as const }
    return { label: 'Not Started', type: 'default' as const }
  }

  async function handleLogCcm(patientId: string) {
    setSaving(true)
    try {
      if (!supabase) throw new Error('Supabase not configured')
      await supabase.from('ccm_time_logs').insert({ patient_id: patientId, log_date: logForm.date, duration_minutes: Number(logForm.duration), activity_type: logForm.activityType, notes: logForm.notes || null, billing_period: period })
      setLogOpen(null); setLogError('')
    } catch (e: any) { setLogError(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>Chronic Care Management · {enrolled.length} enrolled</div>
      <Card>
        {loading ? <div style={{ padding: 20 }}><Spin /></div> : (patients ?? []).length === 0 ? <Empty msg="No patients" /> :
          (patients as any[]).map((p: any) => {
            const b = billMap[p.id]
            const rpmMins = b?.rpmMinutes ?? 0
            const st = ccmStatus(p.ccm_enrolled ? rpmMins : -1)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert }}>{p.conditions_count ?? 1} condition{(p.conditions_count ?? 1) !== 1 ? 's' : ''}</div>
                </div>
                {p.ccm_enrolled && <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>{rpmMins} min</span>}
                <Tag type={p.ccm_enrolled ? st.type : 'default'}>{p.ccm_enrolled ? st.label : 'Not Enrolled'}</Tag>
                {p.ccm_enrolled
                  ? <Btn variant="ghost" onClick={() => setLogOpen(p.id)} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>Log Time</Btn>
                  : <Btn variant="ghost" style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }} onClick={async () => {
                      if (supabase) await supabase.from('patients').update({ ccm_enrolled: true }).eq('id', p.id)
                    }}>Enroll</Btn>
                }
              </div>
            )
          })
        }
      </Card>
      {logOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: F.display, fontSize: 18, color: T.text }}>Log CCM Time</div>
            <Field label="Date" type="date" value={logForm.date} onChange={v => setLogForm(f => ({ ...f, date: v }))} />
            <Field label="Duration (min)" type="number" value={logForm.duration} onChange={v => setLogForm(f => ({ ...f, duration: v }))} />
            <SelectField label="Activity" value={logForm.activityType} onChange={v => setLogForm(f => ({ ...f, activityType: v }))} options={['Chart Review', 'Patient Communication', 'Care Plan Update', 'Specialist Coordination']} />
            <Field label="Notes" value={logForm.notes} onChange={v => setLogForm(f => ({ ...f, notes: v }))} />
            {logError && <div style={{ color: T.red, fontSize: 12, fontFamily: F.body }}>{logError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => handleLogCcm(logOpen)} disabled={saving} full>{saving ? <Spin /> : 'Save Time'}</Btn>
              <Btn variant="ghost" onClick={() => setLogOpen(null)} full>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
      <div className="grid-2">
        <ComingSoon title="Care Plan Templates" icon="📋" description="Standardized CCM care plan templates for common chronic conditions." />
        <ComingSoon title="CCM Billing Codes (99490/99491)" icon="💰" description="Automated CCM billing code generation and submission." />
      </div>
    </div>
  )
}

// ── TCM Tab ───────────────────────────────────────────────────

function TCMTab({ today }: { today: string }) {
  const { data: episodes, loading, refresh } = useAsync(getActiveTcmEpisodes, [])
  const { data: overdueEps } = useAsync(getOverdueTcmEpisodes, [])
  const { data: patients } = useAsync(getPatients, [])
  const [newOpen, setNewOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState<string | null>(null)
  const [newForm, setNewForm] = useState({ patientId: '', dischargeDate: today, dischargeFacility: '', diagnosis: '', complexity: 'moderate', notes: '' })
  const [contactForm, setContactForm] = useState({ contactDate: today, contactType: 'phone', reached: 'Yes', milestone: 'day2', notes: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  function milestoneStatus(ep: any, m: 'day2' | 'day7') {
    const completed = ep[`${m}_completed`]
    const deadline = ep[`${m}_deadline`]
    if (completed) return { icon: '✓', color: T.green, label: 'Complete' }
    if (deadline && deadline < today) return { icon: '✗', color: T.red, label: 'Overdue' }
    return { icon: '◷', color: T.amber, label: 'Pending' }
  }

  async function handleCreateEpisode(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await createTcmEpisode({ patientId: newForm.patientId, dischargeDate: newForm.dischargeDate, dischargeFacility: newForm.dischargeFacility, diagnosis: newForm.diagnosis, complexity: newForm.complexity as 'moderate' | 'high', notes: newForm.notes })
      setNewOpen(false); setFormError(''); refresh()
    } catch (e: any) { setFormError(e.message) } finally { setSaving(false) }
  }

  async function handleContact(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await logTcmContact(contactOpen!, { contactDate: contactForm.contactDate, contactType: contactForm.contactType as any, reached: contactForm.reached === 'Yes', milestone: contactForm.milestone as any, notes: contactForm.notes })
      setContactOpen(null); setFormError(''); refresh()
    } catch (e: any) { setFormError(e.message) } finally { setSaving(false) }
  }

  const overdueCount = (overdueEps ?? []).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>
          Transitional Care · {(episodes ?? []).length} open
        </span>
        {overdueCount > 0 && <Tag type="red">{overdueCount} overdue</Tag>}
        <div style={{ marginLeft: 'auto' }}>
          <Btn onClick={() => setNewOpen(true)} style={{ fontSize: 13 }}>+ New Episode</Btn>
        </div>
      </div>

      <Card>
        {loading ? <div style={{ padding: 20 }}><Spin /></div> : (episodes ?? []).length === 0 ? <Empty icon="♥" msg="No active TCM episodes" /> :
          (episodes as any[]).map((ep: any) => {
            const d2 = milestoneStatus(ep, 'day2')
            const d7 = milestoneStatus(ep, 'day7')
            return (
              <div key={ep.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{ep.patients?.first_name} {ep.patients?.last_name}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert }}>D/C: {ep.discharge_date} · {ep.discharge_facility ?? '—'}</div>
                  </div>
                  <Tag type={ep.complexity === 'high' ? 'red' : 'amber'}>{ep.complexity}</Tag>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11 }}>Day-2: <span style={{ color: d2.color }}>{d2.icon} {ep.day2_deadline}</span></span>
                  <span style={{ fontFamily: F.mono, fontSize: 11 }}>Day-7: <span style={{ color: d7.color }}>{d7.icon} {ep.day7_deadline}</span></span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" onClick={() => setContactOpen(ep.id)} style={{ fontSize: 12, padding: '5px 10px', minHeight: 34 }}>Log Contact</Btn>
                    {!ep.day2_completed && <Btn variant="ghost" onClick={() => completeTcmMilestone(ep.id, 'day2').then(refresh)} style={{ fontSize: 12, padding: '5px 10px', minHeight: 34 }}>✓ Day-2</Btn>}
                    {!ep.day7_completed && <Btn variant="ghost" onClick={() => completeTcmMilestone(ep.id, 'day7').then(refresh)} style={{ fontSize: 12, padding: '5px 10px', minHeight: 34 }}>✓ Day-7</Btn>}
                  </div>
                </div>
              </div>
            )
          })
        }
      </Card>

      {/* New episode modal */}
      {newOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: F.display, fontSize: 18, color: T.text }}>New TCM Episode</div>
            <form onSubmit={handleCreateEpisode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>Patient</span>
                <select value={newForm.patientId} onChange={e => setNewForm(f => ({ ...f, patientId: e.target.value }))} required
                  style={{ background: T.subtle, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 14, padding: '11px 14px', minHeight: 44, outline: 'none' }}>
                  <option value="">Select patient…</option>
                  {(patients ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              </label>
              <Field label="Discharge Date" type="date" value={newForm.dischargeDate} onChange={v => setNewForm(f => ({ ...f, dischargeDate: v }))} required />
              <Field label="Discharge Facility" value={newForm.dischargeFacility} onChange={v => setNewForm(f => ({ ...f, dischargeFacility: v }))} />
              <Field label="Diagnosis" value={newForm.diagnosis} onChange={v => setNewForm(f => ({ ...f, diagnosis: v }))} />
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Complexity</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ v: 'moderate', label: 'Moderate (99495)', desc: '≥8 days post-discharge visit' }, { v: 'high', label: 'High (99496)', desc: '≤7 days post-discharge visit' }].map(opt => (
                    <label key={opt.v} style={{ flex: 1, background: newForm.complexity === opt.v ? T.blueSurface : 'transparent', border: `1px solid ${newForm.complexity === opt.v ? T.blue : T.border}`, borderRadius: 8, padding: 12, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <input type="radio" name="complexity" value={opt.v} checked={newForm.complexity === opt.v} onChange={() => setNewForm(f => ({ ...f, complexity: opt.v }))} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{opt.label}</div>
                        <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <Field label="Notes" value={newForm.notes} onChange={v => setNewForm(f => ({ ...f, notes: v }))} />
              {formError && <div style={{ color: T.red, fontSize: 12, fontFamily: F.body }}>{formError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn type="submit" disabled={saving || !newForm.patientId} full>{saving ? <Spin /> : 'Create Episode'}</Btn>
                <Btn variant="ghost" onClick={() => setNewOpen(false)} full>Cancel</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact log modal */}
      {contactOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: F.display, fontSize: 18, color: T.text }}>Log TCM Contact</div>
            <form onSubmit={handleContact} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Date" type="date" value={contactForm.contactDate} onChange={v => setContactForm(f => ({ ...f, contactDate: v }))} />
              <SelectField label="Contact Type" value={contactForm.contactType} onChange={v => setContactForm(f => ({ ...f, contactType: v }))} options={['phone', 'video', 'in-person']} />
              <SelectField label="Patient Reached" value={contactForm.reached} onChange={v => setContactForm(f => ({ ...f, reached: v }))} options={['Yes', 'No']} />
              <SelectField label="Milestone" value={contactForm.milestone} onChange={v => setContactForm(f => ({ ...f, milestone: v }))} options={['day2', 'day7', 'follow-up']} />
              <Field label="Notes" value={contactForm.notes} onChange={v => setContactForm(f => ({ ...f, notes: v }))} />
              {formError && <div style={{ color: T.red, fontSize: 12, fontFamily: F.body }}>{formError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn type="submit" disabled={saving} full>{saving ? <Spin /> : 'Save Contact'}</Btn>
                <Btn variant="ghost" onClick={() => setContactOpen(null)} full>Cancel</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid-2">
        <ComingSoon title="TCM Billing Codes (99495/99496)" icon="💰" description="Automated TCM billing code generation and claim submission." />
        <ComingSoon title="Automated Discharge Notifications" icon="🏥" description="Receive automatic alerts when patients are discharged from connected facilities." />
      </div>
    </div>
  )
}

// ── Care Programs Page ────────────────────────────────────────

export default function CareProgramsPage() {
  const [tab, setTab] = useState<'ccm' | 'tcm'>('ccm')
  const today = new Date().toISOString().slice(0, 10)
  const period = today.slice(0, 7)

  if (!FEATURES.CARE_PROGRAMS) return <ComingSoon title="Care Programs" icon="♥" description="Manage CCM and TCM programs for your enrolled patients." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 2, background: T.card, borderRadius: 8, padding: 3, alignSelf: 'flex-start', border: `1px solid ${T.border}` }}>
        {(['ccm', 'tcm'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', fontFamily: F.body, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: tab === t ? T.blue : 'transparent', color: tab === t ? '#FFFFFF' : T.textSec, minHeight: 36 }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === 'ccm' ? <CCMTab period={period} /> : <TCMTab today={today} />}
    </div>
  )
}
