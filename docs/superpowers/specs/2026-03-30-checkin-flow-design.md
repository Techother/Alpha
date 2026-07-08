# MKL Health — Chatbot Check-In Flow Design
**Date:** 2026-03-30
**Scope:** Sub-project A — Patient chatbot check-in (PortalCheckin)
**PRD Reference:** Parts 3, 6, 8 of MKL Health PRD v3.0

---

## Overview

The check-in flow lets patients report daily wellness data through a conversational chat interface. Questions are driven by a questionnaire template fetched from Supabase (`questionnaire_templates` table). On completion, answers are parsed and written to `chatbot_sessions`, `checkins`, `observations`, and `symptom_reports`. The flow is entirely client-side — no server round-trips between questions.

---

## Architecture

### Approach: Client-side state machine with localStorage resume

All conversation state lives in React + localStorage. The template is fetched once on session start. Each answer is persisted to localStorage immediately so the session survives app close/refresh. On final submission, one write burst hits Supabase and localStorage is cleared.

### Stage Machine

`PortalCheckin.tsx` controls a `stage` state variable:

```
'idle'       → on mount: check localStorage; if in-progress session exists for this patient,
               show resume/start-over prompt; otherwise start fresh
'chatting'   → one question at a time, chat bubble UI
'reviewing'  → all answers editable inline before submission
'confirmed'  → post-submission result screen with summary + alert status
```

### CheckinState (localStorage + React state)

```typescript
interface CheckinState {
  sessionId: string            // generated UUID on session start
  patientId: string            // from patient record
  conditionId: string          // heart_failure condition UUID
  templateSlug: string         // 'daily_checkin_v1'
  questions: Question[]        // from questionnaire_templates.questions
  answers: Record<string, string>  // keyed by question.id
  currentIndex: number         // which question is active in 'chatting' stage
  startedAt: string            // ISO timestamp
}
```

localStorage key: `ct_checkin_<patientId>` — namespaced per patient so shared-device scenarios don't cross sessions.

---

## UI Specification

### Stage: `idle`

On mount:
1. Fetch patient record (`getPatientRecord(profileId)`) to get `patientId` + `conditionId`
2. Fetch active template (`getActiveTemplate('daily_checkin_v1')`)
3. Check localStorage for `ct_checkin_<patientId>`
4. If found → show two-button prompt:
   - "Resume Check-In" (continue from saved `currentIndex`)
   - "Start Over" (clear localStorage, begin from question 0)
5. If not found → immediately transition to `'chatting'` with new session

If no patient record found: show error card — "Your account isn't fully set up yet. Contact your care team." No check-in UI rendered.

### Stage: `chatting`

**Layout:** Full-height scrollable message thread within PortalLayout's main area. Bottom-anchored scroll — new messages appear at the bottom and the view auto-scrolls.

**Message bubbles:**
- Bot messages: left-aligned, gray background, preceded by `♥` avatar icon
- Patient replies: right-aligned, `--color-primary` blue background, white text

**Progress bar:** Thin bar at the top of the chat area. Width = `(currentIndex / questions.length) * 100%`. Uses `--color-primary`.

**Input rendering by question type:**

| `question.type` | Input rendered |
|---|---|
| `number` | `<input type="number">` with unit label + "Send" button |
| `text` | `<input type="text">` + "Send" button |
| `boolean` | Two full-width tap buttons: "Yes" / "No" — no text input |
| `scale` | Row of 5 numbered tap buttons (1–5) with semantic labels: "1 = Not at all" / "5 = Very severe" |

**Optional questions:** A "Skip" link shown below the input when `question.optional === true`. Skipping records `answers[q.id] = ''` and advances.

**Scroll behavior:** After each patient reply renders + new bot question renders, auto-scroll to bottom.

**"Review my answers" button:** Shown floating above the input area after the last question is answered, alongside the normal input. Tapping transitions to `'reviewing'`.

### Stage: `reviewing`

A single scrollable card listing all questions and their current answers as editable fields:

**Input types on review screen:**
- `number` → `<input type="number">` pre-filled with answer
- `text` → `<input type="text">` pre-filled
- `boolean` → `<select>` with options "Yes" / "No"
- `scale` → `<input type="number" min="1" max="5">` pre-filled

**Optional with no answer:** Empty input, placeholder "Nothing to add"

**Validation:** On "Submit Check-In" press, all non-optional fields must have a value. Inline `<p className="form-error">` shown beneath any blank required field. Submission blocked until valid.

**"Go Back" button:** Returns to `'chatting'` stage at `currentIndex = questions.length - 1` (last question). Edited answers on review screen are merged back into `answers` state before transitioning.

**"Submit Check-In" button:** Triggers `submitCheckin()`. Shows spinner on button while in-flight.

### Stage: `confirmed`

Post-submission result screen:

```
✓  Check-in complete
────────────────────
Today's summary
  Weight:           183 lbs
  Heart rate:       72 bpm
  Blood pressure:   120/80
  Breathing:        2 / 5
  Swelling:         1 / 5
  Tiredness:        2 / 5
  Medications:      Yes

[Your care team has been notified.]   ← shown only if alert rows found

────────────────────────────────
[  Back to Home  ]
```

The "Your care team has been notified" line appears only if `getRecentAlerts(patientId)` returns ≥ 1 row created after `submittedAt`. No alert details, severity, or specifics are shown to the patient.

---

## Data Layer

### New file: `src/api/checkin.ts`

**`getActiveTemplate(slug: string): Promise<QuestionnaireTemplate | null>`**
- SELECT from `questionnaire_templates` WHERE `slug = slug AND active = true`
- Returns null if not found (triggers "not set up" error state)

**`getPatientRecord(profileId: string): Promise<{ patientId: string, conditionId: string } | null>`**
- SELECT from `patients` WHERE `profile_id = profileId`
- JOIN `patient_conditions` WHERE `primary_condition = true AND active = true`
- JOIN `conditions` WHERE `slug = 'heart_failure'`
- Returns null if no patient row or no active HF condition

**`submitCheckinSession(payload: SubmitPayload): Promise<{ sessionId: string }>`**

Sequential writes (stop on first error, surface error to UI):
1. INSERT `chatbot_sessions` → returns `session_id`
2. INSERT `checkins` (flat legacy row)
3. INSERT `observations[]` (filtered to non-null numeric values)
4. INSERT `symptom_reports[]` (filtered to non-null severity scores)

```typescript
interface SubmitPayload {
  patientId: string
  conditionId: string
  templateSlug: string
  startedAt: string
  parsed: ParsedAnswers
  rawAnswers: Record<string, string>
}
```

**`getRecentAlerts(patientId: string, since: string): Promise<AlertRow[]>`**
- SELECT from `alerts` WHERE `patient_id = patientId AND created_at > since`
- Returns array (may be empty — no alert rows means no notification shown)
- Note: `alerts` table is created by Sub-project C (alert engine). In the interim, this function returns `[]` gracefully if the table doesn't exist yet.

### New file: `src/lib/checkinStorage.ts`

```typescript
// Key namespaced per patient
function storageKey(patientId: string): string
function saveCheckinState(state: CheckinState): void
function loadCheckinState(patientId: string): CheckinState | null
function clearCheckinState(patientId: string): void
```

### New file: `src/lib/checkinParser.ts`

**`parseAnswers(questions: Question[], answers: Record<string, string>): ParsedAnswers`**

```typescript
interface ParsedAnswers {
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
```

Parsing rules:
- `weight` intent → `parseFloat(answer)` → `weight_lbs`
- `heart_rate` intent → `parseInt(answer)` → `heart_rate`
- `blood_pressure` intent → split on `/` → `bp_systolic` + `bp_diastolic`
- `breathlessness` intent → `parseInt` → `breathlessness`
- `swelling` intent → `parseInt` → `swelling`
- `fatigue` intent → `parseInt` → `fatigue_score`
- `medications` intent → `answer === 'Yes'` → `boolean`
- `free_text_symptom` intent → raw string → `free_text`
- Empty string or unparseable → `null` (field omitted from write)

### Modified: `src/api/supabase.types.ts`

Add:
```typescript
export interface AlertRow {
  id: string
  patient_id: string
  alert_type: string
  severity: 'high' | 'medium' | 'low'
  created_at: string
}
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Template fetch fails | Error card: "Unable to load check-in. Try again." with retry button |
| No patient record | Error card: "Your account isn't fully set up yet. Contact your care team." |
| Submission write fails | Error shown on review screen, "Submit" re-enabled, no localStorage clear |
| `getRecentAlerts` fails | Silently treat as no alerts — confirmation screen renders without notification line |
| BP field unparseable (e.g. "120") | `bp_systolic = 120`, `bp_diastolic = null` — both still NULL-safe in observations |

---

## File Summary

| File | Action | Responsibility |
|---|---|---|
| `src/portal/pages/PortalCheckin.tsx` | Replace shell | Stage machine, all 4 stages, UI rendering |
| `src/api/checkin.ts` | Create | Supabase reads/writes for check-in flow |
| `src/lib/checkinStorage.ts` | Create | localStorage persistence for in-progress sessions |
| `src/lib/checkinParser.ts` | Create | Answer string → typed observation values |
| `src/api/supabase.types.ts` | Modify | Add `AlertRow` type |

---

## Out of Scope

- Multi-condition merged templates (PRD Part 3.2 — v3.2)
- Medication events from check-in (PRD Part 3.3 — v3.1)
- Alert engine evaluation (Sub-project C — built separately)
- Provider can see transcripts — transcripts are in check-in history (Sub-project B)

---

## Success Criteria

- [ ] Patient can complete a full check-in from start to confirmed screen
- [ ] Closing and reopening the app mid-check-in offers resume/start-over
- [ ] Review screen shows all answers editable before submit
- [ ] Submission writes rows to all 4 tables: chatbot_sessions, checkins, observations, symptom_reports
- [ ] Confirmation screen shows parsed summary
- [ ] If no patient record exists, a clear error message is shown (not a crash)
- [ ] `npx tsc --noEmit` passes with zero errors after implementation
