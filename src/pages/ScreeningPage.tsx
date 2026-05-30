// src/pages/ScreeningPage.tsx
// Extracted from App.tsx lines 1351–1550

import { useState } from 'react'
import { T, F } from '@/lib/tokens'
import { Card, CardHeader, Btn, Tag, Spin, Empty } from '@/components/ui/primitives'
import { useAsync } from '@/lib/hooks'
import { ComingSoon } from '@/lib/utils'
import { FEATURES } from '@/config'
import { supabase } from '@/api/supabase'
import { getPatients, createAlert } from '@/api/supabase'
import { getPatientsNeedingScreening, createScreeningResult, scorePHQ9, scoreGAD7 } from '@/api/screening'

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

function severityColor(s: string) {
  if (!s || s === 'none') return T.green
  if (s === 'mild') return T.green
  if (s === 'moderate') return T.amber
  return T.red
}

// ── Screening Chatbot modal ───────────────────────────────────

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
        if (alertGenerated) {
          await createAlert({ patient_id: patient.id, alert_type: `${screenType}_threshold`, description: `${screenType.toUpperCase()} score ${scored.score} — ${scored.severity}`, severity: scored.score >= 15 ? 'critical' : 'high', threshold_value: '10' })
        }
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

// ── Screening Page ────────────────────────────────────────────

export default function ScreeningPage() {
  const { data: patients } = useAsync(getPatients, [])
  const { data: needsScreening, loading: nL } = useAsync(getPatientsNeedingScreening, [])
  const [screenTarget, setScreenTarget] = useState<{ patient: any; type: 'phq9' | 'gad7' } | null>(null)
  const { data: allScreenings, loading: sL } = useAsync(async () => {
    if (!patients?.length) return []
    const results = await Promise.all((patients as any[]).map(async (p: any) => {
      const { data } = await supabase!.from('screening_results').select('*').eq('patient_id', p.id).order('administered_at', { ascending: false }).limit(5)
      return (data ?? []).map((r: any) => ({ ...r, patientName: `${p.first_name} ${p.last_name}`, mrn: p.mrn }))
    }))
    return results.flat().sort((a: any, b: any) => new Date(b.administered_at).getTime() - new Date(a.administered_at).getTime())
  }, [patients])

  if (!FEATURES.BHI_SCREENING) return <ComingSoon title="Behavioral Health Screening" icon="🧠" description="PHQ-9 and GAD-7 screening tools for behavioral health integration." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {screenTarget && <ScreeningChatbot patient={screenTarget.patient} screenType={screenTarget.type} onClose={() => setScreenTarget(null)} />}

      <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>
        {(needsScreening ?? []).length} patients due for screening
      </div>

      {(needsScreening ?? []).length > 0 && (
        <Card>
          <CardHeader>Screening Queue</CardHeader>
          {nL ? <div style={{ padding: 20 }}><Spin /></div> :
            (needsScreening as any[]).map((p: any) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert }}>{p.mrn}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn variant="ghost" onClick={() => setScreenTarget({ patient: p, type: 'phq9' })} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>PHQ-9</Btn>
                  <Btn variant="ghost" onClick={() => setScreenTarget({ patient: p, type: 'gad7' })} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>GAD-7</Btn>
                </div>
              </div>
            ))
          }
        </Card>
      )}

      <Card>
        <CardHeader>Recent Screenings</CardHeader>
        {sL ? <div style={{ padding: 20 }}><Spin /></div> : (allScreenings ?? []).length === 0 ? <Empty icon="🧠" msg="No screenings recorded" /> :
          (allScreenings as any[]).slice(0, 20).map((s: any) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{s.patientName}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert }}>{s.mrn} · {new Date(s.administered_at).toLocaleDateString()}</div>
              </div>
              <Tag>{s.screen_type.toUpperCase()}</Tag>
              <span style={{ fontFamily: F.display, fontSize: 18, color: severityColor(s.severity) }}>{s.score}</span>
              <Tag type={s.severity === 'none' || s.severity === 'mild' ? 'green' : s.severity === 'moderate' ? 'amber' : 'red'}>{s.severity?.replace('_', ' ')}</Tag>
              {s.alert_generated && <span title="Alert generated" style={{ color: T.red }}>⚠</span>}
            </div>
          ))
        }
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        <ComingSoon title="BHI Care Plan Integration" icon="📋" description="Link screening results to behavioral health care plans." />
        <ComingSoon title="Crisis Protocol Workflow" icon="🚨" description="Automated crisis escalation and follow-up workflows." />
        <ComingSoon title="BHI Billing (CPT 99484)" icon="💰" description="Behavioral health integration billing code generation." />
      </div>
    </div>
  )
}
