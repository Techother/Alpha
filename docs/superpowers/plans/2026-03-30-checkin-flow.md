# Chatbot Check-In Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the patient chatbot check-in flow — a 4-stage UI (idle → chatting → reviewing → confirmed) that collects wellness data through a conversational interface and writes it to Supabase.

**Architecture:** Client-side state machine in `PortalCheckin.tsx`. Template loaded once from Supabase on mount. Answers persisted to localStorage on each reply so sessions survive app close. On submission, one write burst hits `chatbot_sessions`, `checkins`, `observations`, and `symptom_reports`. No server round-trips between questions.

**Tech Stack:** React 19, TypeScript 5.9 strict, @supabase/supabase-js v2, CSS custom properties (no UI framework). Path alias `@` → `src/`.

**Spec:** `docs/superpowers/specs/2026-03-30-checkin-flow-design.md`

---

## File Map

**Create:**
```
src/lib/checkinStorage.ts       — localStorage read/write/clear for in-progress sessions
src/lib/checkinParser.ts        — parseAnswers(): answer strings → typed ParsedAnswers
src/api/checkin.ts              — getActiveTemplate, getPatientRecord, submitCheckinSession, getRecentAlerts
```

**Replace shell:**
```
src/portal/pages/PortalCheckin.tsx  — full 4-stage check-in component
```

**Modify:**
```
src/api/supabase.types.ts       — add AlertRow, CheckinState, ParsedAnswers, SubmitPayload
```

---

## Task 1: Add types to supabase.types.ts

**Files:**
- Modify: `src/api/supabase.types.ts`

- [ ] **Step 1: Append new types to the end of the file**

Open `src/api/supabase.types.ts` and append after the last line:

```typescript
export interface AlertRow {
  id: string
  patient_id: string
  alert_type: string
  severity: 'high' | 'medium' | 'low'
  created_at: string
}

export interface ParsedAnswers {
  weight_lbs: number | null
  heart_rate: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  fatigue_score: number | null
  breathlessness: number | null
  swelling: number | null
  medications: boolean | null
  free_text: string | null
}

export interface CheckinState {
  sessionId: string
  patientId: string
  conditionId: string
  templateSlug: string
  questions: Question[]
  answers: Record<string, string>
  currentIndex: number
  startedAt: string
}

export interface SubmitPayload {
  patientId: string
  conditionId: string
  templateSlug: string
  startedAt: string
  parsed: ParsedAnswers
  rawAnswers: Record<string, string>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/api/supabase.types.ts
git commit -m "feat: add AlertRow, ParsedAnswers, CheckinState, SubmitPayload types"
```

---

## Task 2: checkinStorage.ts — localStorage persistence

**Files:**
- Create: `src/lib/checkinStorage.ts`

- [ ] **Step 1: Create src/lib/checkinStorage.ts**

```typescript
import type { CheckinState } from '@/api/supabase.types'

function storageKey(patientId: string): string {
  return `ct_checkin_${patientId}`
}

export function saveCheckinState(state: CheckinState): void {
  try {
    localStorage.setItem(storageKey(state.patientId), JSON.stringify(state))
  } catch {
    // localStorage quota exceeded or unavailable — silent fail, session continues in memory
  }
}

export function loadCheckinState(patientId: string): CheckinState | null {
  try {
    const raw = localStorage.getItem(storageKey(patientId))
    if (!raw) return null
    return JSON.parse(raw) as CheckinState
  } catch {
    return null
  }
}

export function clearCheckinState(patientId: string): void {
  try {
    localStorage.removeItem(storageKey(patientId))
  } catch {
    // silent fail
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/lib/checkinStorage.ts
git commit -m "feat: add checkinStorage localStorage helpers"
```

---

## Task 3: checkinParser.ts — answer string → typed values

**Files:**
- Create: `src/lib/checkinParser.ts`

- [ ] **Step 1: Create src/lib/checkinParser.ts**

```typescript
import type { Question, ParsedAnswers } from '@/api/supabase.types'

export function parseAnswers(
  questions: Question[],
  answers: Record<string, string>
): ParsedAnswers {
  const result: ParsedAnswers = {
    weight_lbs: null,
    heart_rate: null,
    bp_systolic: null,
    bp_diastolic: null,
    fatigue_score: null,
    breathlessness: null,
    swelling: null,
    medications: null,
    free_text: null,
  }

  for (const q of questions) {
    const raw = answers[q.id] ?? ''
    if (raw === '') continue

    switch (q.intent) {
      case 'weight': {
        const v = parseFloat(raw)
        if (!isNaN(v)) result.weight_lbs = v
        break
      }
      case 'heart_rate': {
        const v = parseInt(raw, 10)
        if (!isNaN(v)) result.heart_rate = v
        break
      }
      case 'blood_pressure': {
        // Expects "120/80" — tolerates "120" (diastolic stays null)
        const parts = raw.split('/')
        const sys = parseInt(parts[0], 10)
        const dia = parseInt(parts[1] ?? '', 10)
        if (!isNaN(sys)) result.bp_systolic = sys
        if (!isNaN(dia)) result.bp_diastolic = dia
        break
      }
      case 'breathlessness': {
        const v = parseInt(raw, 10)
        if (!isNaN(v)) result.breathlessness = v
        break
      }
      case 'swelling': {
        const v = parseInt(raw, 10)
        if (!isNaN(v)) result.swelling = v
        break
      }
      case 'fatigue': {
        const v = parseInt(raw, 10)
        if (!isNaN(v)) result.fatigue_score = v
        break
      }
      case 'medications': {
        result.medications = raw === 'Yes'
        break
      }
      case 'free_text_symptom': {
        if (result.free_text === null) {
          result.free_text = raw
        } else {
          result.free_text += '\n' + raw
        }
        break
      }
    }
  }

  return result
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/lib/checkinParser.ts
git commit -m "feat: add checkinParser for answer string to typed value conversion"
```

---

## Task 4: checkin.ts — Supabase API layer

**Files:**
- Create: `src/api/checkin.ts`

- [ ] **Step 1: Create src/api/checkin.ts**

```typescript
import { supabase } from './supabase'
import type {
  QuestionnaireTemplate,
  AlertRow,
  SubmitPayload,
} from './supabase.types'

export async function getActiveTemplate(
  slug: string
): Promise<QuestionnaireTemplate | null> {
  const { data, error } = await supabase
    .from('questionnaire_templates')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (error) {
    console.error('getActiveTemplate error:', error.message)
    return null
  }

  return data as QuestionnaireTemplate
}

export async function getPatientRecord(
  profileId: string
): Promise<{ patientId: string; conditionId: string } | null> {
  // Get patient row
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', profileId)
    .single()

  if (patientError || !patient) {
    console.error('getPatientRecord: no patient row', patientError?.message)
    return null
  }

  // Get primary heart_failure condition for this patient
  const { data: conditionJoin, error: conditionError } = await supabase
    .from('patient_conditions')
    .select('condition_id, conditions(slug)')
    .eq('patient_id', patient.id)
    .eq('primary_condition', true)
    .eq('active', true)
    .single()

  if (conditionError || !conditionJoin) {
    console.error('getPatientRecord: no active primary condition', conditionError?.message)
    return null
  }

  return {
    patientId: patient.id as string,
    conditionId: conditionJoin.condition_id as string,
  }
}

export async function submitCheckinSession(
  payload: SubmitPayload
): Promise<{ sessionId: string }> {
  const { patientId, conditionId, templateSlug, startedAt, parsed, rawAnswers } = payload
  const completedAt = new Date().toISOString()

  // 1. Insert chatbot_session
  const { data: sessionData, error: sessionError } = await supabase
    .from('chatbot_sessions')
    .insert({
      patient_id: patientId,
      condition_id: conditionId,
      status: 'completed',
      started_at: startedAt,
      completed_at: completedAt,
    })
    .select('id')
    .single()

  if (sessionError || !sessionData) {
    throw new Error(`Failed to create session: ${sessionError?.message}`)
  }

  const sessionId = sessionData.id as string

  // 2. Insert legacy checkin row
  const { data: checkinData, error: checkinError } = await supabase
    .from('checkins')
    .insert({
      patient_id: patientId,
      session_id: sessionId,
      weight_lbs: parsed.weight_lbs,
      heart_rate: parsed.heart_rate,
      bp_systolic: parsed.bp_systolic,
      bp_diastolic: parsed.bp_diastolic,
      fatigue_score: parsed.fatigue_score,
      breathlessness: parsed.breathlessness,
      swelling: parsed.swelling,
      medications: parsed.medications,
      free_text: parsed.free_text,
      checked_in_at: completedAt,
    })
    .select('id')
    .single()

  if (checkinError || !checkinData) {
    throw new Error(`Failed to create checkin: ${checkinError?.message}`)
  }

  const checkinId = checkinData.id as string

  // 3. Insert typed observations (numeric values only)
  const observationRows = [
    { observation_type: 'weight_lbs',   value_numeric: parsed.weight_lbs,   unit: 'lbs' },
    { observation_type: 'heart_rate',   value_numeric: parsed.heart_rate,   unit: 'bpm' },
    { observation_type: 'bp_systolic',  value_numeric: parsed.bp_systolic,  unit: 'mmHg' },
    { observation_type: 'bp_diastolic', value_numeric: parsed.bp_diastolic, unit: 'mmHg' },
    { observation_type: 'fatigue_score',value_numeric: parsed.fatigue_score, unit: null },
  ]
    .filter(o => o.value_numeric !== null)
    .map(o => ({
      patient_id: patientId,
      condition_id: conditionId,
      session_id: sessionId,
      checkin_id: checkinId,
      observation_type: o.observation_type,
      value_numeric: o.value_numeric,
      unit: o.unit,
      source: 'chatbot' as const,
      observed_at: completedAt,
    }))

  if (observationRows.length > 0) {
    const { error: obsError } = await supabase.from('observations').insert(observationRows)
    if (obsError) throw new Error(`Failed to insert observations: ${obsError.message}`)
  }

  // 4. Insert symptom reports (severity scores only)
  const symptomRows = [
    { symptom_type: 'breathlessness', severity_score: parsed.breathlessness },
    { symptom_type: 'swelling',       severity_score: parsed.swelling },
  ]
    .filter(s => s.severity_score !== null)
    .map(s => ({
      patient_id: patientId,
      condition_id: conditionId,
      session_id: sessionId,
      checkin_id: checkinId,
      symptom_type: s.symptom_type,
      severity_score: s.severity_score,
      free_text: parsed.free_text,
      reported_at: completedAt,
    }))

  if (symptomRows.length > 0) {
    const { error: symError } = await supabase.from('symptom_reports').insert(symptomRows)
    if (symError) throw new Error(`Failed to insert symptom reports: ${symError.message}`)
  }

  return { sessionId }
}

export async function getRecentAlerts(
  patientId: string,
  since: string
): Promise<AlertRow[]> {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('patient_id', patientId)
      .gt('created_at', since)

    // alerts table may not exist yet (Sub-project C) — return empty gracefully
    if (error) return []
    return (data ?? []) as AlertRow[]
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/api/checkin.ts
git commit -m "feat: add checkin API layer (getActiveTemplate, getPatientRecord, submitCheckinSession, getRecentAlerts)"
```

---

## Task 5: PortalCheckin.tsx — idle and chatting stages

**Files:**
- Replace: `src/portal/pages/PortalCheckin.tsx`

This task builds the component skeleton, idle stage, and chatting stage. Task 6 adds reviewing and confirmed stages.

- [ ] **Step 1: Replace src/portal/pages/PortalCheckin.tsx with full component**

```typescript
import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getActiveTemplate, getPatientRecord } from '@/api/checkin'
import { loadCheckinState, saveCheckinState, clearCheckinState } from '@/lib/checkinStorage'
import { parseAnswers } from '@/lib/checkinParser'
import { submitCheckinSession, getRecentAlerts } from '@/api/checkin'
import type { CheckinState, Question, ParsedAnswers, AlertRow } from '@/api/supabase.types'

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
                }}>♥</div>
              )}
              <div style={{
                maxWidth: '75%',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: msg.role === 'bot'
                  ? '4px 12px 12px 12px'
                  : '12px 4px 12px 12px',
                background: msg.role === 'bot' ? 'var(--color-border-subtle)' : 'var(--color-primary)',
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
              Review my answers →
            </button>
          </div>
        ) : currentQ && (
          <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
            {currentQ.type === 'boolean' && (
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="btn btn-ghost" onClick={() => handleBooleanAnswer('Yes')} style={{ flex: 1, padding: 'var(--space-3)', fontSize: 'var(--font-size-md)' }}>Yes</button>
                <button className="btn btn-ghost" onClick={() => handleBooleanAnswer('No')} style={{ flex: 1, padding: 'var(--space-3)', fontSize: 'var(--font-size-md)' }}>No</button>
              </div>
            )}

            {currentQ.type === 'scale' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} className="btn btn-ghost" onClick={() => handleScaleAnswer(n)} style={{ flex: 1, padding: 'var(--space-3)', fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>{n}</button>
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
                    type={currentQ.type === 'number' ? 'text' : 'text'}
                    inputMode={currentQ.type === 'number' ? 'decimal' : 'text'}
                    className="form-input"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={currentQ.unit ? `e.g. 150 ${currentQ.unit}` : 'Type your answer…'}
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
                  <option value="">Select…</option>
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
                  placeholder={q.optional ? 'Nothing to add' : '1–5'}
                />
              ) : (
                <input
                  type={q.type === 'number' ? 'text' : 'text'}
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
            {submitting ? 'Submitting…' : 'Submit Check-In'}
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
    ].filter(Boolean) as { label: string; value: string }[]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <div style={{ fontSize: 40, marginBottom: 'var(--space-2)' }}>✓</div>
          <h2>Check-in complete</h2>
        </div>

        <div className="card">
          <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Today's summary
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors. Fix any type errors before proceeding.

- [ ] **Step 3: Build check**

```bash
cd /Users/larrygoode/cardiotrack && npm run build 2>&1 | tail -10
```

Expected: `✓ built in Xs` with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/portal/pages/PortalCheckin.tsx
git commit -m "feat: implement 4-stage chatbot check-in flow (idle/chatting/reviewing/confirmed)"
```

---

## Self-Review

**Spec coverage:**
- [x] 4 stages: idle (resume/start-over prompt), chatting (chat UI), reviewing (editable fields), confirmed (summary + alert notification)
- [x] localStorage persistence on every answer via `saveCheckinState`
- [x] Resume/start-over prompt when saved session exists
- [x] Input types: number/text → form input, boolean → Yes/No buttons, scale → 1–5 buttons
- [x] Optional questions → Skip link
- [x] Progress bar in chatting stage
- [x] Bot ♥ avatar on bot messages
- [x] Review screen: all questions editable inline, Go Back merges edits
- [x] Validation: non-optional fields required before submit, inline errors
- [x] Submit writes to 4 tables: chatbot_sessions, checkins, observations, symptom_reports
- [x] `getRecentAlerts` returns `[]` gracefully if alerts table doesn't exist
- [x] No patient record → error card shown, no crash
- [x] Confirmed screen: summary of parsed values + conditional "care team notified" line
- [x] `AlertRow` type added to supabase.types.ts
- [x] All 4 new files: checkinStorage.ts, checkinParser.ts, checkin.ts, PortalCheckin.tsx

**Placeholder scan:** No TBDs or TODOs. All code blocks are complete.

**Type consistency:**
- `CheckinState` defined in Task 1, used in Tasks 2, 3, 4, 5 — consistent
- `ParsedAnswers` defined in Task 1, returned by `parseAnswers()` in Task 3, used in Task 4 `submitCheckinSession` and Task 5 — consistent
- `SubmitPayload` defined in Task 1, used in Task 4 `submitCheckinSession` — consistent
- `AlertRow` defined in Task 1, returned by `getRecentAlerts` in Task 4, used in Task 5 `ConfirmedData` — consistent
- `getPatientRecord` returns `{ patientId, conditionId }` in Task 4, destructured as such in Task 5 — consistent
