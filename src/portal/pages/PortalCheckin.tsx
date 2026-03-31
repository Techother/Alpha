import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getActiveTemplate, getPatientRecord } from '@/api/checkin'
import { loadCheckinState, saveCheckinState, clearCheckinState } from '@/lib/checkinStorage'
import { parseAnswers } from '@/lib/checkinParser'
import { submitCheckinSession, getRecentAlerts } from '@/api/checkin'
import type { CheckinState, ParsedAnswers, AlertRow } from '@/api/supabase.types'

type Stage = 'loading' | 'error' | 'idle' | 'chatting' | 'reviewing' | 'confirmed'

interface Message {
  role: 'bot' | 'patient'
  text: string
}

interface ConfirmedData {
  parsed: ParsedAnswers
  alerts: AlertRow[]
  submittedAt: string
}

export function PortalCheckin() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [stage, setStage] = useState<Stage>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [checkinState, setCheckinState] = useState<CheckinState | null>(null)
  const [savedState, setSavedState] = useState<CheckinState | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, string>>({})
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState<ConfirmedData | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load patient record and template on mount
  useEffect(() => {
    if (!profile) return

    async function init() {
      const record = await getPatientRecord(profile!.id)
      if (!record) {
        setErrorMsg("Your account isn't fully set up yet. Contact your care team.")
        setStage('error')
        return
      }

      const template = await getActiveTemplate('daily_checkin_v1')
      if (!template) {
        setErrorMsg('Unable to load check-in. Please try again.')
        setStage('error')
        return
      }

      // Check for in-progress session in localStorage
      const saved = loadCheckinState(record.patientId)
      if (saved && saved.templateSlug === template.slug) {
        setSavedState(saved)
        setStage('idle')
        // Pre-build a new CheckinState for "start over"
        setCheckinState({
          sessionId: crypto.randomUUID(),
          patientId: record.patientId,
          conditionId: record.conditionId,
          templateSlug: template.slug,
          questions: template.questions,
          answers: {},
          currentIndex: 0,
          startedAt: new Date().toISOString(),
        })
      } else {
        // No saved session — start fresh immediately
        const fresh: CheckinState = {
          sessionId: crypto.randomUUID(),
          patientId: record.patientId,
          conditionId: record.conditionId,
          templateSlug: template.slug,
          questions: template.questions,
          answers: {},
          currentIndex: 0,
          startedAt: new Date().toISOString(),
        }
        setCheckinState(fresh)
        startChatting(fresh, [])
      }
    }

    init()
  }, [profile])

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function startChatting(state: CheckinState, existingMessages: Message[]) {
    const q = state.questions[state.currentIndex]
    const botMessages: Message[] = existingMessages.length > 0
      ? existingMessages
      : [{ role: 'bot', text: q.text }]
    setMessages(botMessages)
    setStage('chatting')
  }

  function handleResume() {
    if (!savedState) return
    // Rebuild message history from saved answers
    const msgs: Message[] = []
    for (let i = 0; i < savedState.currentIndex; i++) {
      const q = savedState.questions[i]
      msgs.push({ role: 'bot', text: q.text })
      const ans = savedState.answers[q.id]
      if (ans !== undefined) msgs.push({ role: 'patient', text: ans || '(skipped)' })
    }
    // Add current question bot message
    const currentQ = savedState.questions[savedState.currentIndex]
    msgs.push({ role: 'bot', text: currentQ.text })
    setCheckinState(savedState)
    startChatting(savedState, msgs)
  }

  function handleStartOver() {
    if (!checkinState) return
    clearCheckinState(checkinState.patientId)
    const fresh: CheckinState = {
      ...checkinState,
      sessionId: crypto.randomUUID(),
      answers: {},
      currentIndex: 0,
      startedAt: new Date().toISOString(),
    }
    setCheckinState(fresh)
    setSavedState(null)
    startChatting(fresh, [])
  }

  function submitAnswer(answer: string) {
    if (!checkinState) return
    const q = checkinState.questions[checkinState.currentIndex]
    const newAnswers = { ...checkinState.answers, [q.id]: answer }
    const newIndex = checkinState.currentIndex + 1

    // Add patient bubble + next bot bubble (or nothing if last question)
    const newMessages: Message[] = [
      ...messages,
      { role: 'patient', text: answer || '(skipped)' },
    ]

    if (newIndex < checkinState.questions.length) {
      newMessages.push({ role: 'bot', text: checkinState.questions[newIndex].text })
    }

    const newState: CheckinState = {
      ...checkinState,
      answers: newAnswers,
      currentIndex: newIndex,
    }

    setMessages(newMessages)
    setCheckinState(newState)
    saveCheckinState(newState)
    setInputValue('')
  }

  function handleTextSubmit(e: FormEvent) {
    e.preventDefault()
    if (!inputValue.trim() && !checkinState?.questions[checkinState.currentIndex].optional) return
    submitAnswer(inputValue.trim())
  }

  function handleBooleanAnswer(value: 'Yes' | 'No') {
    submitAnswer(value)
  }

  function handleScaleAnswer(value: number) {
    submitAnswer(String(value))
  }

  function handleSkip() {
    submitAnswer('')
  }

  function handleGoToReview() {
    if (!checkinState) return
    setReviewAnswers({ ...checkinState.answers })
    setReviewErrors({})
    setStage('reviewing')
  }

  function handleReviewChange(questionId: string, value: string) {
    setReviewAnswers(prev => ({ ...prev, [questionId]: value }))
    setReviewErrors(prev => ({ ...prev, [questionId]: '' }))
  }

  function handleGoBack() {
    if (!checkinState) return
    // Merge edited review answers back into state
    const merged: CheckinState = {
      ...checkinState,
      answers: reviewAnswers,
      currentIndex: checkinState.questions.length - 1,
    }
    setCheckinState(merged)
    saveCheckinState(merged)
    // Rebuild messages from merged answers
    const msgs: Message[] = []
    for (let i = 0; i < merged.questions.length; i++) {
      const q = merged.questions[i]
      msgs.push({ role: 'bot', text: q.text })
      const ans = merged.answers[q.id]
      if (ans !== undefined) msgs.push({ role: 'patient', text: ans || '(skipped)' })
    }
    setMessages(msgs)
    setStage('chatting')
  }

  async function handleSubmit() {
    if (!checkinState) return

    // Validate non-optional fields
    const errors: Record<string, string> = {}
    for (const q of checkinState.questions) {
      if (!q.optional && !reviewAnswers[q.id]) {
        errors[q.id] = 'This field is required.'
      }
    }
    if (Object.keys(errors).length > 0) {
      setReviewErrors(errors)
      return
    }

    setSubmitting(true)

    // Merge review edits into state before parsing
    const finalState: CheckinState = { ...checkinState, answers: reviewAnswers }
    const parsed = parseAnswers(finalState.questions, finalState.answers)
    const submittedAt = new Date().toISOString()

    try {
      await submitCheckinSession({
        patientId: finalState.patientId,
        conditionId: finalState.conditionId,
        templateSlug: finalState.templateSlug,
        startedAt: finalState.startedAt,
        parsed,
        rawAnswers: finalState.answers,
      })

      clearCheckinState(finalState.patientId)

      const alerts = await getRecentAlerts(finalState.patientId, submittedAt)
      setConfirmed({ parsed, alerts, submittedAt })
      setStage('confirmed')
    } catch (err) {
      setReviewErrors({ _submit: err instanceof Error ? err.message : 'Submission failed. Please try again.' })
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────

  if (stage === 'loading') {
    return (
      <div className="spinner-fullscreen">
        <div className="spinner" />
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>{errorMsg}</p>
        <button className="btn btn-ghost" onClick={() => navigate('/my-health')}>Back to Home</button>
      </div>
    )
  }

  if (stage === 'idle' && savedState) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Welcome back</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)', fontSize: 'var(--font-size-sm)' }}>
            You have an unfinished check-in from earlier.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button className="btn btn-primary" onClick={handleResume} style={{ padding: 'var(--space-3)' }}>
              Resume Check-In
            </button>
            <button className="btn btn-ghost" onClick={handleStartOver} style={{ padding: 'var(--space-3)' }}>
              Start Over
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'chatting' && checkinState) {
    const currentQ = checkinState.questions[checkinState.currentIndex]
    const isLastQuestion = checkinState.currentIndex >= checkinState.questions.length
    const progress = checkinState.questions.length > 0
      ? (checkinState.currentIndex / checkinState.questions.length) * 100
      : 0

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', marginBottom: 'var(--space-4)' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--color-primary)',
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Message thread */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-4)' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'bot' ? 'flex-start' : 'flex-end', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
              {msg.role === 'bot' && (
                <div style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-full)',
                  background: 'var(--color-hf-bg)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>&#9829;</div>
              )}
              <div style={{
                maxWidth: '75%',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: msg.role === 'bot'
                  ? '4px 12px 12px 12px'
                  : '12px 4px 12px 12px',
                background: msg.role === 'bot' ? 'var(--color-bg)' : 'var(--color-primary)',
                color: msg.role === 'bot' ? 'var(--color-text)' : '#fff',
                fontSize: 'var(--font-size-sm)',
                lineHeight: 'var(--line-height-relaxed)',
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {isLastQuestion ? (
          <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
            <button className="btn btn-primary" onClick={handleGoToReview} style={{ width: '100%', padding: 'var(--space-3)' }}>
              Review my answers &rarr;
            </button>
          </div>
        ) : currentQ && (
          <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
            {currentQ.type === 'boolean' && (
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="btn btn-ghost" onClick={() => handleBooleanAnswer('Yes')} style={{ flex: 1, padding: 'var(--space-3)' }}>Yes</button>
                <button className="btn btn-ghost" onClick={() => handleBooleanAnswer('No')} style={{ flex: 1, padding: 'var(--space-3)' }}>No</button>
              </div>
            )}

            {currentQ.type === 'scale' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} className="btn btn-ghost" onClick={() => handleScaleAnswer(n)} style={{ flex: 1, padding: 'var(--space-3)', fontWeight: 'var(--font-weight-semibold)' }}>{n}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)' }}>
                  <span>Not at all</span>
                  <span>Very severe</span>
                </div>
              </div>
            )}

            {(currentQ.type === 'number' || currentQ.type === 'text') && (
              <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    inputMode={currentQ.type === 'number' ? 'decimal' : 'text'}
                    className="form-input"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={currentQ.unit ? `e.g. 150 ${currentQ.unit}` : 'Type your answer\u2026'}
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: 'var(--space-2) var(--space-4)' }}>Send</button>
              </form>
            )}

            {currentQ.optional && (
              <button onClick={handleSkip} style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Skip this question
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (stage === 'reviewing' && checkinState) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)' }}>Review your answers</h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          Edit anything before submitting.
        </p>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {checkinState.questions.map(q => (
            <div key={q.id} className="form-field">
              <label className="form-label">{q.text}{q.optional ? ' (optional)' : ''}</label>
              {q.type === 'boolean' ? (
                <select
                  className="form-input"
                  value={reviewAnswers[q.id] ?? ''}
                  onChange={e => handleReviewChange(q.id, e.target.value)}
                >
                  <option value="">Select&hellip;</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : q.type === 'scale' ? (
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="form-input"
                  value={reviewAnswers[q.id] ?? ''}
                  onChange={e => handleReviewChange(q.id, e.target.value)}
                  placeholder={q.optional ? 'Nothing to add' : '1\u20135'}
                />
              ) : (
                <input
                  type="text"
                  inputMode={q.type === 'number' ? 'decimal' : 'text'}
                  className="form-input"
                  value={reviewAnswers[q.id] ?? ''}
                  onChange={e => handleReviewChange(q.id, e.target.value)}
                  placeholder={q.optional ? 'Nothing to add' : q.unit ? `e.g. 150 ${q.unit}` : ''}
                />
              )}
              {reviewErrors[q.id] && <p className="form-error">{reviewErrors[q.id]}</p>}
            </div>
          ))}
        </div>

        {reviewErrors['_submit'] && (
          <p className="form-error" style={{ textAlign: 'center' }}>{reviewErrors['_submit']}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: 'var(--space-3)' }}
          >
            {submitting ? 'Submitting\u2026' : 'Submit Check-In'}
          </button>
          <button className="btn btn-ghost" onClick={handleGoBack} style={{ padding: 'var(--space-3)' }}>
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'confirmed' && confirmed) {
    const p = confirmed.parsed
    const summaryItems: { label: string; value: string }[] = [
      p.weight_lbs !== null   ? { label: 'Weight',        value: `${p.weight_lbs} lbs` } : null,
      p.heart_rate !== null   ? { label: 'Heart rate',    value: `${p.heart_rate} bpm` } : null,
      (p.bp_systolic !== null || p.bp_diastolic !== null)
        ? { label: 'Blood pressure', value: `${p.bp_systolic ?? '?'}/${p.bp_diastolic ?? '?'}` } : null,
      p.breathlessness !== null ? { label: 'Breathing',   value: `${p.breathlessness} / 5` } : null,
      p.swelling !== null       ? { label: 'Swelling',    value: `${p.swelling} / 5` } : null,
      p.fatigue_score !== null  ? { label: 'Tiredness',   value: `${p.fatigue_score} / 5` } : null,
      p.medications !== null    ? { label: 'Medications', value: p.medications ? 'Yes' : 'No' } : null,
    ].filter((x): x is { label: string; value: string } => x !== null)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <div style={{ fontSize: 40, marginBottom: 'var(--space-2)' }}>&#10003;</div>
          <h2>Check-in complete</h2>
        </div>

        <div className="card">
          <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Today&apos;s summary
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {summaryItems.map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
                <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {confirmed.alerts.length > 0 && (
          <div style={{ padding: 'var(--space-4)', background: 'var(--color-alert-high-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-alert-high)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-alert-high)', fontWeight: 'var(--font-weight-medium)' }}>
              Your care team has been notified.
            </p>
          </div>
        )}

        <button className="btn btn-primary" onClick={() => navigate('/my-health')} style={{ padding: 'var(--space-3)' }}>
          Back to Home
        </button>
      </div>
    )
  }

  return null
}
