// src/pages/PatientsPage.tsx
// Extracted from App.tsx lines 561–977 (PatientMonitor + sub-components)
//                          + 1554–1654 (MedicationsSection + PatientsList)
// OutletContextType exported for DashboardPage and RootLayout

import { useState, useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { T, F } from '@/lib/tokens'
import { Card, CardHeader, Btn, Tag, Spin, Empty, SeverityRow, Sparkline, Field, SelectField } from '@/components/ui/primitives'
import type { SeverityLevel } from '@/components/ui/primitives'
import { useAsync } from '@/lib/hooks'
import { timeAgo, riskOrder, riskTag } from '@/lib/utils'
import { supabase } from '@/api/supabase'
import {
  getPatient, getPatientCheckins, getPatientAlerts, acknowledgeAlert,
  createCheckin, createChatbotSession, saveChatbotMessage, completeSession, createAlert,
  getPatients,
} from '@/api/supabase'
import { postPatientAlert } from '@/api/slack'
import { sendTestSMS } from '@/api/twilio'
import { getPatientMedications, addMedication, deactivateMedication, getMedicationAdherence } from '@/api/medications'
import { getPatientTcmEpisodes } from '@/api/tcm'
import { getLatestScreening, createScreeningResult, scorePHQ9, scoreGAD7 } from '@/api/screening'
import { getBillingPeriodData } from '@/api/billing'
import { FEATURES } from '@/config'

// ── Outlet context type (exported for RootLayout + DashboardPage) ─

export type OutletContextType = {
  selectedPatientId: string | null
  selectPatient: (id: string | null) => void
}

// ── Screening helper (shared in this file) ────────────────────

function severityColor(s: string) {
  if (!s || s === 'none') return T.green
  if (s === 'mild') return T.green
  if (s === 'moderate') return T.amber
  return T.red
}

// ── Screening constants ───────────────────────────────────────

const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things?',
  'Feeling down, depressed, or hopeless?',
  'Trouble falling or staying asleep, or sleeping too much?',
  'Feeling tired or having little energy?',
  'Poor appetite or overeating?',
  'Feeling bad about yourself — or that you are a failure?',
  'Trouble concentrating on things?',
  'Moving or speaking slowly, or being restless?',
  'Thoughts of being better off dead or hurting yourself?',
]
const GAD7_QUESTIONS = [
  'Feeling nervous, anxious, or on edge?',
  'Not being able to stop or control worrying?',
  'Worrying too much about different things?',
  'Trouble relaxing?',
  "Being so restless that it's hard to sit still?",
  'Becoming easily annoyed or irritable?',
  'Feeling afraid as if something awful might happen?',
]
const SCORE_OPTIONS = [
  { val: 0, label: '0 — Not at all' },
  { val: 1, label: '1 — Several days' },
  { val: 2, label: '2 — More than half the days' },
  { val: 3, label: '3 — Nearly every day' },
]

// ── Chatbot types ─────────────────────────────────────────────

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const QS = [
  { key: 'weight',      prompt: 'What is your weight today in pounds?',                                             type: 'number' },
  { key: 'heart_rate',  prompt: 'What is your resting heart rate in bpm?',                                          type: 'number' },
  { key: 'breathless',  prompt: 'On a scale of 0–10, how breathless do you feel? (0 = none, 10 = very severe)',     type: 'scale'  },
  { key: 'swelling',    prompt: 'On a scale of 0–10, how much swelling in your legs or ankles?',                    type: 'scale'  },
  { key: 'medications', prompt: 'Did you take all your medications today?',                                          type: 'yesno'  },
  { key: 'notes',       prompt: 'Any notes for your care team? (Type something or press Skip)',                     type: 'text'   },
]

// ── ScreeningChatbot sub-component ────────────────────────────

function ScreeningChatbot({ patient, screenType, onClose }: { patient: any; screenType: 'phq9' | 'gad7'; onClose: () => void }) {
  const questions = screenType === 'phq9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [crisis, setCrisis] = useState(false)
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<{ score: number; severity: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleAnswer(val: number) {
    const newAnswers = [...answers, val]
    if (screenType === 'phq9' && step === 8 && val >= 1) { setCrisis(true); return }
    if (step + 1 < questions.length) {
      setAnswers(newAnswers); setStep(step + 1)
    } else {
      const scored = screenType === 'phq9' ? scorePHQ9(newAnswers) : scoreGAD7(newAnswers)
      setResult(scored); setSaving(true)
      try {
        const alertGenerated = scored.score >= 10
        await createScreeningResult({ patientId: patient.id, screenType, score: scored.score, severity: scored.severity, answers: Object.fromEntries(newAnswers.map((v, i) => [String(i), v])), alertGenerated })
        if (alertGenerated) await createAlert({ patient_id: patient.id, alert_type: `${screenType}_threshold`, description: `${screenType.toUpperCase()} score ${scored.score} — ${scored.severity}`, severity: scored.score >= 15 ? 'critical' : 'high', threshold_value: '10' })
      } catch { /* silent */ } finally { setSaving(false) }
      setDone(true)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 17, color: T.text }}>{screenType.toUpperCase()} Screening</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>{patient.first_name} {patient.last_name}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {!done && !crisis && <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>{step + 1}/{questions.length}</span>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textTert, cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
        </div>
        {!done && !crisis && (
          <div style={{ height: 2, background: T.border }}>
            <div style={{ height: '100%', background: T.blue, width: `${(step / questions.length) * 100}%`, transition: 'width 0.3s' }} />
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {crisis ? (
            <div style={{ background: T.redSurface, border: `1px solid ${T.red}`, borderRadius: 10, padding: 20 }}>
              <div style={{ color: T.red, fontFamily: F.body, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>⚠ Important</div>
              <div style={{ color: T.text, fontFamily: F.body, fontSize: 14, lineHeight: 1.7 }}>
                Thank you for sharing that. Please talk to your care provider right away or call <strong>988</strong> (Suicide &amp; Crisis Lifeline). Help is available 24/7.
              </div>
              <div style={{ marginTop: 16 }}><Btn onClick={onClose} full>Close &amp; Notify Provider</Btn></div>
            </div>
          ) : done && result ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, marginBottom: 8, textTransform: 'uppercase' }}>{screenType.toUpperCase()} Complete</div>
              <div style={{ fontFamily: F.display, fontSize: 52, color: severityColor(result.severity), marginBottom: 8 }}>{result.score}</div>
              <Tag type={result.severity === 'none' || result.severity === 'mild' ? 'green' : result.severity === 'moderate' ? 'amber' : 'red'}>{result.severity.replace('_', ' ')}</Tag>
              {saving && <div style={{ marginTop: 12, color: T.textTert, fontSize: 13 }}><Spin /> Saving…</div>}
              {result.score >= 10 && <div style={{ marginTop: 16, background: T.amberSurface, border: `1px solid ${T.amber}`, borderRadius: 8, padding: 12, fontSize: 13, color: T.amber }}>Alert generated — care team notified</div>}
              <div style={{ marginTop: 20 }}><Btn onClick={onClose} full>Done</Btn></div>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: F.body, fontSize: 16, color: T.text, lineHeight: 1.6 }}>
                Over the <strong>last 2 weeks</strong>, how often have you been bothered by…<br />
                <span style={{ color: T.blue }}>{questions[step]}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SCORE_OPTIONS.map(opt => (
                  <button key={opt.val} onClick={() => handleAnswer(opt.val)}
                    style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 16px', color: T.text, fontFamily: F.body, fontSize: 14, cursor: 'pointer', textAlign: 'left', minHeight: 44, transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.subtle)}
                    onMouseLeave={e => (e.currentTarget.style.background = T.card)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PatientBillingStatus sub-component ────────────────────────

function PatientBillingStatus({ patientId }: { patientId: string }) {
  const period = new Date().toISOString().slice(0, 7)
  const { data: billing } = useAsync(() => getBillingPeriodData(patientId, period), [patientId, period])
  if (!billing) return null
  const needed = 16 - billing.checkinDays
  return (
    <Card style={{ marginBottom: 16 }}>
      <CardHeader>Billing Status · {period}</CardHeader>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontFamily: F.mono, fontSize: 12 }}>
          <span style={{ color: billing.cpt99454Met ? T.green : T.amber }}>{billing.checkinDays}</span>
          <span style={{ color: T.textTert }}>/16 check-in days {billing.cpt99454Met ? <Tag type="green">99454 ✓</Tag> : needed > 0 ? <Tag type="amber">{needed} more needed</Tag> : null}</span>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 12 }}>
          <span style={{ color: billing.cpt99457Met ? T.green : T.textTert }}>{billing.rpmMinutes} RPM min</span>
          {billing.cpt99457Met && <span style={{ marginLeft: 6 }}><Tag type="green">99457 ✓</Tag></span>}
          {billing.cpt99458Count > 0 && <span style={{ marginLeft: 6 }}><Tag type="teal">+{billing.cpt99458Count}×99458</Tag></span>}
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: F.mono, fontSize: 14, color: T.green }}>Est. ${billing.estimatedReimbursement}</div>
      </div>
    </Card>
  )
}

// ── PatientTcmStatus sub-component ───────────────────────────

function PatientTcmStatus({ patientId }: { patientId: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: episodes } = useAsync(() => getPatientTcmEpisodes(patientId), [patientId])
  const openEp = (episodes ?? []).find((e: any) => e.status === 'open')
  if (!openEp) return null
  function ms(ep: any, m: 'day2' | 'day7') {
    if (ep[`${m}_completed`]) return { label: 'Complete', color: T.green }
    if (ep[`${m}_deadline`] < today) return { label: 'Overdue', color: T.red }
    return { label: ep[`${m}_deadline`], color: T.amber }
  }
  const d2 = ms(openEp, 'day2'); const d7 = ms(openEp, 'day7')
  return (
    <Card style={{ marginBottom: 16 }}>
      <CardHeader>TCM Episode</CardHeader>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>D/C: <span style={{ color: T.text }}>{openEp.discharge_date}</span></span>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>Day-2: <span style={{ color: d2.color }}>{d2.label}</span></span>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>Day-7: <span style={{ color: d7.color }}>{d7.label}</span></span>
        <Tag type={openEp.complexity === 'high' ? 'red' : 'amber'}>{openEp.complexity}</Tag>
      </div>
    </Card>
  )
}

// ── PatientScreeningHistory sub-component ─────────────────────

function PatientScreeningHistory({ patient }: { patient: any }) {
  const [screenOpen, setScreenOpen] = useState<{ type: 'phq9' | 'gad7' } | null>(null)
  const { data: latestPhq9 } = useAsync(() => getLatestScreening(patient.id, 'phq9'), [patient.id])
  const { data: latestGad7 } = useAsync(() => getLatestScreening(patient.id, 'gad7'), [patient.id])
  if (!latestPhq9 && !latestGad7) return null
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>Screening History</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn variant="ghost" onClick={() => setScreenOpen({ type: 'phq9' })} style={{ fontSize: 11, padding: '4px 8px', minHeight: 30 }}>PHQ-9</Btn>
          <Btn variant="ghost" onClick={() => setScreenOpen({ type: 'gad7' })} style={{ fontSize: 11, padding: '4px 8px', minHeight: 30 }}>GAD-7</Btn>
        </div>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {latestPhq9 && (
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, marginBottom: 4 }}>PHQ-9</div>
            <span style={{ fontFamily: F.display, fontSize: 24, color: severityColor((latestPhq9 as any).severity) }}>{(latestPhq9 as any).score}</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, marginLeft: 6 }}>{(latestPhq9 as any).severity?.replace('_', ' ')}</span>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textSec }}>{new Date((latestPhq9 as any).administered_at).toLocaleDateString()}</div>
          </div>
        )}
        {latestGad7 && (
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, marginBottom: 4 }}>GAD-7</div>
            <span style={{ fontFamily: F.display, fontSize: 24, color: severityColor((latestGad7 as any).severity) }}>{(latestGad7 as any).score}</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, marginLeft: 6 }}>{(latestGad7 as any).severity?.replace('_', ' ')}</span>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textSec }}>{new Date((latestGad7 as any).administered_at).toLocaleDateString()}</div>
          </div>
        )}
      </div>
      {screenOpen && <ScreeningChatbot patient={patient} screenType={screenOpen.type} onClose={() => setScreenOpen(null)} />}
    </Card>
  )
}

// ── SmsCheckinSettings sub-component ─────────────────────────

function SmsCheckinSettings({ patient }: { patient: any }) {
  const [form, setForm] = useState({ mobile_phone: patient.mobile_phone ?? '', checkin_sms_enabled: patient.checkin_sms_enabled ?? false, checkin_time: patient.checkin_time ?? '09:00' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const checkinUrl = `${window.location.origin}/checkin/${patient.checkin_token}`

  async function handleSave() {
    setSaving(true); setMsg('')
    try {
      if (supabase) await supabase.from('patients').update({ mobile_phone: form.mobile_phone, checkin_sms_enabled: form.checkin_sms_enabled, checkin_time: form.checkin_time }).eq('id', patient.id)
      setMsg('✓ Saved')
    } catch (e: any) { setMsg(e.message) } finally { setSaving(false) }
  }

  async function handleTestSms() {
    if (!form.mobile_phone) return
    setSaving(true); setMsg('')
    try { await sendTestSMS(form.mobile_phone); setMsg('✓ Test SMS sent') }
    catch (e: any) { setMsg(e.message) } finally { setSaving(false) }
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <CardHeader>Check-in Settings</CardHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={form.checkin_sms_enabled} onChange={e => setForm(f => ({ ...f, checkin_sms_enabled: e.target.checked }))} style={{ width: 18, height: 18 }} />
          <span style={{ fontFamily: F.body, fontSize: 14, color: T.text }}>SMS check-ins enabled</span>
        </label>
        <Field label="Mobile Phone" type="tel" value={form.mobile_phone} onChange={v => setForm(f => ({ ...f, mobile_phone: v }))} placeholder="+1 555 000 0000" />
        <Field label="Preferred Check-in Time" type="time" value={form.checkin_time} onChange={v => setForm(f => ({ ...f, checkin_time: v }))} />
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Check-in Link Preview</div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: T.blue, background: T.subtle, borderRadius: 6, padding: '8px 12px', wordBreak: 'break-all' }}>{checkinUrl}</div>
        </div>
        {msg && <div style={{ fontFamily: F.mono, fontSize: 12, color: msg.startsWith('✓') ? T.green : T.red }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn onClick={handleSave} disabled={saving} style={{ fontSize: 13 }}>{saving ? <Spin /> : 'Save Settings'}</Btn>
          <Btn variant="ghost" onClick={handleTestSms} disabled={saving || !form.mobile_phone} style={{ fontSize: 13 }}>Send Test SMS</Btn>
        </div>
      </div>
    </Card>
  )
}

// ── ChatbotModal sub-component ────────────────────────────────

function ChatbotModal({ patient, onClose }: { patient: any; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: 'assistant', content: QS[0].prompt }])
  const [step, setStep] = useState(0)
  const [input, setInput] = useState('')
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function parseNum(s: string) { const n = parseFloat(s.replace(/[^\d.]/g, '')); return isNaN(n) ? null : n }
  function parseBool(s: string) { return /yes|yeah|y|took|did/i.test(s) ? true : /no|nope|n|didn't|missed/i.test(s) ? false : null }

  async function handleSend(override?: string) {
    const text = (override ?? input).trim(); if (!text) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: text }])
    setBusy(true)
    const q = QS[step]; const ans = { ...answers }
    if (q.key === 'weight')      ans.weight_lbs = parseNum(text)
    if (q.key === 'heart_rate')  ans.heart_rate = parseNum(text)
    if (q.key === 'breathless')  ans.breathlessness = Math.min(10, Math.max(0, parseNum(text) ?? 0))
    if (q.key === 'swelling')    ans.swelling = Math.min(10, Math.max(0, parseNum(text) ?? 0))
    if (q.key === 'medications') ans.medications = parseBool(text)
    if (q.key === 'notes')       ans.free_text = text === 'skip' ? null : text
    setAnswers(ans)
    const next = step + 1
    if (next < QS.length) {
      let reply = QS[next].prompt
      try {
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase!.auth.getSession()).data.session?.access_token ?? ''}`,
          },
          body: JSON.stringify({
            userMessage: text,
            nextQuestion: QS[next].prompt,
          }),
        })
        if (chatRes.ok) { const d = await chatRes.json(); if (d.reply) reply = d.reply }
      } catch { /* use default */ }
      setMessages(m => [...m, { role: 'assistant', content: reply }])
      setStep(next); setBusy(false)
    } else {
      try {
        await submitCheckin(ans, [...messages, { role: 'user', content: text }])
        setMessages(m => [...m, { role: 'assistant', content: 'Thank you! Your check-in is recorded. Take care 💙' }])
        setDone(true)
      } catch (e: any) { setError(e.message) }
      setBusy(false)
    }
  }

  async function submitCheckin(ans: Record<string, any>, allMsgs: ChatMsg[]) {
    const session = await createChatbotSession(patient.id)
    for (const [i, msg] of allMsgs.entries()) await saveChatbotMessage({ session_id: session.id, role: msg.role, content: msg.content, sequence_num: i })
    const checkin = await createCheckin({ patient_id: patient.id, weight_lbs: ans.weight_lbs, heart_rate: ans.heart_rate, breathlessness: ans.breathlessness, swelling: ans.swelling, medications: ans.medications, free_text: ans.free_text })
    await completeSession(session.id, checkin.id)
    if ((ans.breathlessness ?? 0) >= 7) await createAlert({ patient_id: patient.id, alert_type: 'high_breathlessness', description: `Breathlessness ${ans.breathlessness}/10 ≥ threshold 7`, severity: ans.breathlessness >= 9 ? 'critical' : 'high', threshold_value: '7' })
    if ((ans.swelling ?? 0) >= 7) await createAlert({ patient_id: patient.id, alert_type: 'high_swelling', description: `Swelling ${ans.swelling}/10 ≥ threshold 7`, severity: ans.swelling >= 9 ? 'critical' : 'high', threshold_value: '7' })
    const recent = await getPatientCheckins(patient.id, 3)
    if (recent.length >= 2 && ans.weight_lbs) {
      const todayStr = new Date().toISOString().slice(0, 10)
      const prev = (recent as any[]).find((c: any) => c.checked_in_at?.slice(0, 10) !== todayStr)
      if (prev?.weight_lbs) { const g = ans.weight_lbs - Number(prev.weight_lbs); if (g >= 2) await createAlert({ patient_id: patient.id, alert_type: 'rapid_weight_gain', description: `Weight +${g.toFixed(1)} lbs since ${prev.checked_in_at?.slice(0, 10)}`, severity: g >= 5 ? 'critical' : 'high', threshold_value: '2' }) }
    }
  }

  const currentQ = QS[step]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 16px rgba(26,82,150,0.10)', animation: 'slideUp 0.3s ease' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 17, color: T.text }}>Daily Check-in</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>{patient.first_name} {patient.last_name}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>{step + 1}/{QS.length}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textTert, cursor: 'pointer', fontSize: 22, padding: 4, lineHeight: 1 }}>×</button>
          </div>
        </div>
        <div style={{ height: 2, background: T.border }}>
          <div style={{ height: '100%', background: T.blue, width: `${(step / QS.length) * 100}%`, transition: 'width 0.3s' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: 14, background: m.role === 'user' ? T.blue : T.subtle, color: m.role === 'user' ? '#FFFFFF' : T.text, fontFamily: F.body, fontSize: 15, lineHeight: 1.5, borderBottomRightRadius: m.role === 'user' ? 4 : 14, borderBottomLeftRadius: m.role === 'assistant' ? 4 : 14 }}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: T.textTert, fontFamily: F.body, fontSize: 13 }}><Spin /> Thinking…</div>}
          {error && <div style={{ color: T.red, fontSize: 13, fontFamily: F.body }}>{error}</div>}
          <div ref={bottomRef} />
        </div>
        {!done ? (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.border}`, paddingBottom: `calc(12px + env(safe-area-inset-bottom, 0px))` }}>
            {currentQ?.type === 'yesno' ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn onClick={() => handleSend('Yes')} full>Yes</Btn>
                <Btn variant="ghost" onClick={() => handleSend('No')} full>No</Btn>
              </div>
            ) : currentQ?.type === 'scale' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {Array.from({ length: 11 }, (_, i) => (
                  <Btn key={i} variant="ghost" onClick={() => handleSend(String(i))} style={{ padding: '10px 4px', minHeight: 44, fontSize: 15 }}>{i}</Btn>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder={currentQ?.key === 'notes' ? 'Notes or "skip"…' : 'Your answer…'}
                  style={{ flex: 1, background: T.subtle, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 15, padding: '10px 14px', outline: 'none', minHeight: 44 }} />
                <Btn onClick={() => handleSend()} disabled={busy || !input.trim()} style={{ minWidth: 70 }}>Send</Btn>
                {currentQ?.key === 'notes' && <Btn variant="ghost" onClick={() => handleSend('skip')}>Skip</Btn>}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '16px', borderTop: `1px solid ${T.border}`, paddingBottom: `calc(16px + env(safe-area-inset-bottom, 0px))` }}>
            <Btn onClick={onClose} full>Close</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MedicationsSection sub-component ─────────────────────────

function MedicationsSection({ patient }: { patient: any }) {
  const { data: meds, loading, refresh } = useAsync(() => getPatientMedications(patient.id), [patient.id])
  const { data: adherence } = useAsync(() => getMedicationAdherence(patient.id, 30), [patient.id])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', dosage: '', frequency: 'Once daily', instructions: '' })
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const adherenceMap: Record<string, any> = {}
  for (const a of (adherence ?? [])) adherenceMap[(a as any).medicationId] = a

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await addMedication({ patient_id: patient.id, name: form.name, dosage: form.dosage, frequency: form.frequency, instructions: form.instructions })
      setAddOpen(false); setAddError(''); setForm({ name: '', dosage: '', frequency: 'Once daily', instructions: '' }); refresh()
    } catch (e: any) { setAddError(e.message) } finally { setSaving(false) }
  }

  if (!FEATURES.MED_TRACKING) return null

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>Medications</span>
        <Btn variant="ghost" onClick={() => setAddOpen(true)} style={{ fontSize: 12, padding: '5px 10px', minHeight: 34 }}>+ Add</Btn>
      </div>
      {loading ? <div style={{ padding: 16 }}><Spin /></div> : (meds ?? []).length === 0 ? <Empty icon="💊" msg="No medications listed" /> :
        (meds as any[]).map((m: any) => {
          const adh = adherenceMap[m.id]
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{m.name}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert }}>{m.dosage} · {m.frequency}</div>
              </div>
              {adh?.adherencePct !== null && adh?.adherencePct !== undefined && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: adh.adherencePct >= 80 ? T.green : adh.adherencePct >= 60 ? T.amber : T.red }}>{adh.adherencePct}%</span>
                  <div style={{ width: 60, height: 4, background: T.border, borderRadius: 2 }}>
                    <div style={{ width: `${adh.adherencePct}%`, height: '100%', background: adh.adherencePct >= 80 ? T.green : adh.adherencePct >= 60 ? T.amber : T.red, borderRadius: 2 }} />
                  </div>
                </div>
              )}
              <Btn variant="ghost" onClick={() => deactivateMedication(m.id).then(refresh)} style={{ fontSize: 11, padding: '4px 8px', minHeight: 30, color: T.textTert }}>Remove</Btn>
            </div>
          )
        })
      }
      {addOpen && (
        <div style={{ padding: 16, background: T.subtle, borderTop: `1px solid ${T.border}` }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="grid-2" style={{ gap: 10 }}>
              <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
              <Field label="Dosage" value={form.dosage} onChange={v => setForm(f => ({ ...f, dosage: v }))} placeholder="e.g. 10mg" />
            </div>
            <SelectField label="Frequency" value={form.frequency} onChange={v => setForm(f => ({ ...f, frequency: v }))}
              options={['Once daily', 'Twice daily', 'Three times daily', 'As needed', 'Weekly']} />
            <Field label="Instructions" value={form.instructions} onChange={v => setForm(f => ({ ...f, instructions: v }))} />
            {addError && <div style={{ color: T.red, fontSize: 12, fontFamily: F.body }}>{addError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn type="submit" disabled={saving} full>{saving ? <Spin /> : 'Add Medication'}</Btn>
              <Btn variant="ghost" onClick={() => setAddOpen(false)} full>Cancel</Btn>
            </div>
          </form>
        </div>
      )}
    </Card>
  )
}

// ── PatientMonitor sub-component ──────────────────────────────

function PatientMonitor({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const { data: patient, loading: pL } = useAsync(() => getPatient(patientId), [patientId])
  const { data: checkins, loading: cL, refresh: rC } = useAsync(() => getPatientCheckins(patientId, 7), [patientId])
  const { data: alerts, loading: aL, refresh: rA } = useAsync(() => getPatientAlerts(patientId), [patientId])
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [slackMsg, setSlackMsg] = useState('')

  if (pL) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spin size={32} /></div>
  if (!patient) return <div style={{ padding: 20, color: T.red }}>Patient not found</div>

  const latest = checkins?.[0] as any; const prev = checkins?.[1] as any
  function trend(f: string) { if (!latest || !prev) return '→'; const a = Number(latest[f]), b = Number(prev[f]); return isNaN(a) || isNaN(b) ? '→' : a > b ? '↑' : a < b ? '↓' : '→' }
  function alarmColor(f: string, th: number) { return latest && Number(latest[f]) >= th ? T.red : T.text }

  async function handleAck(id: string) { await acknowledgeAlert(id); rA() }
  async function handleSlack() {
    try {
      setSlackMsg('')
      await postPatientAlert({ patientName: `${patient.first_name} ${patient.last_name}`, mrn: patient.mrn, alertType: 'manual_alert', value: 'Manual', threshold: 'N/A', provider: patient.provider_name })
      setSlackMsg('✓ Alert sent to Slack')
    } catch (e: any) { setSlackMsg(e.message) }
  }

  return (
    <div>
      {checkinOpen && <ChatbotModal patient={patient} onClose={() => { setCheckinOpen(false); rC(); rA() }} />}

      <div style={{ marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.textTert, cursor: 'pointer', fontFamily: F.body, fontSize: 14, padding: '4px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: F.display, fontSize: 'clamp(22px, 5vw, 30px)', color: T.text }}>{patient.first_name} {patient.last_name}</div>
              <Tag type={riskTag(patient.risk_level)}>{patient.risk_level} risk</Tag>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, marginTop: 4 }}>{patient.mrn} · {patient.condition}</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>{patient.provider_name}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={handleSlack} style={{ fontSize: 13 }}>📢 Alert</Btn>
            <Btn onClick={() => setCheckinOpen(true)} style={{ fontSize: 13 }}>+ Check-in</Btn>
          </div>
        </div>
        {slackMsg && <div style={{ marginTop: 8, fontSize: 12, color: slackMsg.startsWith('✓') ? T.green : T.red, fontFamily: F.mono }}>{slackMsg}</div>}
      </div>

      {!aL && (alerts ?? []).length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <CardHeader><span style={{ color: T.red }}>Open Alerts</span></CardHeader>
          {(alerts as any[]).map((a) => (
            <SeverityRow key={a.id} severity={a.severity as SeverityLevel} style={{ borderBottom: `1px solid ${T.border}`, borderRadius: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{a.alert_type.replace(/_/g, ' ')}</div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: T.textTert }}>{a.description}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textSec, marginTop: 2 }}>{timeAgo(a.created_at)}</div>
              </div>
              <Btn variant="ghost" onClick={() => handleAck(a.id)} title="Acknowledge alert" style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>Acknowledge</Btn>
            </SeverityRow>
          ))}
        </Card>
      )}

      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Weight', field: 'weight_lbs', unit: 'lbs', th: 999 },
          { label: 'Heart Rate', field: 'heart_rate', unit: 'bpm', th: 999 },
          { label: 'Breathlessness', field: 'breathlessness', unit: '/10', th: 7 },
          { label: 'Swelling', field: 'swelling', unit: '/10', th: 7 },
        ].map(v => (
          <Card key={v.field}>
            <div style={{ padding: 16 }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>{v.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                <span style={{ fontFamily: F.display, fontSize: 28, color: alarmColor(v.field, v.th) }}>{cL ? '…' : (latest?.[v.field] ?? '—')}</span>
                <span style={{ fontFamily: F.mono, fontSize: 12, color: T.textTert }}>{v.unit}</span>
                <span style={{ fontFamily: F.mono, fontSize: 16, color: T.textTert, marginLeft: 'auto' }}>{trend(v.field)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader>7-Day Weight Trend (lbs)</CardHeader>
        <div style={{ padding: 16 }}>{cL ? <Spin /> : <Sparkline checkins={checkins ?? []} color={patient.risk_level === 'high' ? T.red : T.blue} />}</div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader>Recent Check-ins</CardHeader>
        {cL ? <div style={{ padding: 20 }}><Spin /></div> : (checkins ?? []).length === 0 ? <Empty msg="No check-ins yet" /> :
          (checkins as any[]).slice(0, 5).map((c) => (
            <div key={c.id} style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, fontFamily: F.mono, fontSize: 11 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: T.textTert, minWidth: 80 }}>{c.checked_in_at?.slice(0, 10)}</span>
                <span style={{ color: T.text }}>⚖ {c.weight_lbs ?? '—'} lbs</span>
                <span style={{ color: T.text }}>♡ {c.heart_rate ?? '—'} bpm</span>
                <span style={{ color: c.breathlessness >= 7 ? T.red : T.text }}>Breath {c.breathlessness ?? '—'}/10</span>
                <span style={{ color: c.swelling >= 7 ? T.red : T.text }}>Swell {c.swelling ?? '—'}/10</span>
                {c.medications === false && <span style={{ color: T.amber, fontWeight: 700 }}>⚠ MEDS MISSED</span>}
              </div>
            </div>
          ))
        }
      </Card>

      <MedicationsSection patient={patient} />
      <PatientBillingStatus patientId={patientId} />
      <PatientTcmStatus patientId={patientId} />
      <PatientScreeningHistory patient={patient} />
      {FEATURES.SMS_CHECKINS && <SmsCheckinSettings patient={patient} />}
    </div>
  )
}

// ── PatientsList sub-component ────────────────────────────────

function PatientsList({ onSelectPatient }: { onSelectPatient: (id: string) => void }) {
  const { data: patients, loading } = useAsync(getPatients, [])
  const sorted = patients ? [...patients].sort((a, b) => riskOrder(a.risk_level) - riskOrder(b.risk_level)) : []
  return (
    <Card>
      <CardHeader>All Patients ({sorted.length})</CardHeader>
      {loading ? <div style={{ padding: 20 }}><Spin /></div> : sorted.length === 0 ? <Empty msg="No patients" /> :
        sorted.map((p: any) => (
          <div key={p.id} onClick={() => onSelectPatient(p.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', minHeight: 56 }}
            onMouseEnter={e => (e.currentTarget.style.background = T.subtle)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.body, color: T.text, fontSize: 14, fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.mrn} · {p.condition}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textSec }}>{p.provider_name}</div>
            </div>
            <Tag type={riskTag(p.risk_level)}>{p.risk_level}</Tag>
            <span style={{ color: T.textTert, fontSize: 20 }}>›</span>
          </div>
        ))
      }
    </Card>
  )
}

// ── PatientsPage (default export) ─────────────────────────────

export default function PatientsPage() {
  const { selectedPatientId, selectPatient } = useOutletContext<OutletContextType>()
  if (selectedPatientId) {
    return <PatientMonitor patientId={selectedPatientId} onBack={() => selectPatient(null)} />
  }
  return <PatientsList onSelectPatient={id => selectPatient(id)} />
}
