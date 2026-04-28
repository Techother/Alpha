# Alert Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side alert engine that evaluates 5 heart failure rules after each check-in submission and writes matching rows to a new `alerts` Supabase table.

**Architecture:** Pure evaluator function (`evaluateAlerts`) returns alert rows from `ParsedAnswers` + recent weight observations; `runAlertEngine` in `alerts.ts` orchestrates the Supabase fetch/write and is called fire-and-forget from `PortalCheckin.tsx` after `submitCheckinSession` succeeds. Failures are always silent — the confirmation screen is never blocked.

**Tech Stack:** React 19, TypeScript 5.9 strict, @supabase/supabase-js v2. Path alias `@` → `src/`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-31-alert-engine-design.md`

---

## File Map

**Create:**
```
supabase/migrations/002_alerts_table.sql   — alerts table + RLS policies
src/lib/alertEngine.ts                     — pure evaluateAlerts() function
src/api/alerts.ts                          — getRecentWeightObservations, insertAlerts, runAlertEngine
```

**Modify:**
```
src/api/supabase.types.ts                  — add AlertInsert interface
src/api/checkin.ts                         — return { sessionId, checkinId } from submitCheckinSession
src/portal/pages/PortalCheckin.tsx         — destructure checkinId, call runAlertEngine after submit
```

---

## Task 1: Create alerts table migration

**Files:**
- Create: `supabase/migrations/002_alerts_table.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 002_alerts_table.sql
-- Run this in your Supabase project via the SQL editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_id uuid REFERENCES conditions(id),
  checkin_id   uuid REFERENCES checkins(id),
  alert_type   text NOT NULL,
  severity     text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Providers can read all alerts; patients have no direct alert view
CREATE POLICY "providers_read_alerts" ON alerts FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
);

-- Client inserts via anon key after check-in submission
CREATE POLICY "service_insert_alerts" ON alerts FOR INSERT WITH CHECK (true);
```

- [ ] **Step 2: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add supabase/migrations/002_alerts_table.sql
git commit -m "feat: add alerts table migration"
```

> Note: Apply this migration in your Supabase dashboard (SQL Editor) before testing the alert engine end-to-end. The TypeScript code will compile without it, but runtime inserts will fail until the table exists.

---

## Task 2: Add AlertInsert type to supabase.types.ts

**Files:**
- Modify: `src/api/supabase.types.ts`

The file currently ends with the `SubmitPayload` interface (added in Sub-project A). Append `AlertInsert` after it.

- [ ] **Step 1: Append AlertInsert to src/api/supabase.types.ts**

Open `src/api/supabase.types.ts` and append after the last line:

```typescript
export interface AlertInsert {
  patient_id: string
  condition_id: string
  checkin_id: string
  alert_type: string
  severity: 'high' | 'medium' | 'low'
}
```

Note: `AlertRow` (for reads, includes `id` and `created_at`) already exists in this file from Sub-project A. `AlertInsert` is a separate type for writes — Supabase generates `id` and `created_at` automatically on insert.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/api/supabase.types.ts
git commit -m "feat: add AlertInsert type for alert write operations"
```

---

## Task 3: Create src/lib/alertEngine.ts — pure evaluator

**Files:**
- Create: `src/lib/alertEngine.ts`

This is a pure function — no imports from Supabase, no side effects. Takes the parsed check-in answers and up to 3 recent weight observations, returns an array of alert rows to insert (may be empty).

- [ ] **Step 1: Create src/lib/alertEngine.ts**

```typescript
import type { ParsedAnswers, AlertInsert, Observation } from '@/api/supabase.types'

export function evaluateAlerts(
  parsed: ParsedAnswers,
  recentWeightObs: Observation[],
  patientId: string,
  conditionId: string,
  checkinId: string
): AlertInsert[] {
  const results: AlertInsert[] = []

  function addAlert(alert_type: string, severity: AlertInsert['severity']) {
    results.push({
      patient_id: patientId,
      condition_id: conditionId,
      checkin_id: checkinId,
      alert_type,
      severity,
    })
  }

  // Rule: weight_gain — today's weight ≥ 2 lbs above minimum of prior 3 observations
  if (parsed.weight_lbs !== null && recentWeightObs.length > 0) {
    const priorMin = Math.min(...recentWeightObs.map(o => o.value_numeric!))
    if (parsed.weight_lbs - priorMin >= 2) {
      addAlert('weight_gain', 'high')
    }
  }

  // Rule: abnormal_hr — heart rate above 100 or below 50
  if (parsed.heart_rate !== null) {
    if (parsed.heart_rate > 100 || parsed.heart_rate < 50) {
      addAlert('abnormal_hr', 'high')
    }
  }

  // Rule: high_breathlessness — breathlessness score ≥ 4
  if (parsed.breathlessness !== null && parsed.breathlessness >= 4) {
    addAlert('high_breathlessness', 'high')
  }

  // Rule: high_swelling — swelling score ≥ 4
  if (parsed.swelling !== null && parsed.swelling >= 4) {
    addAlert('high_swelling', 'medium')
  }

  // Rule: missed_medications — patient reported not taking medications
  if (parsed.medications === false) {
    addAlert('missed_medications', 'medium')
  }

  // Rule: missed_checkin — deferred (requires scheduled job, not client-side)

  return results
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
git add src/lib/alertEngine.ts
git commit -m "feat: add evaluateAlerts pure function (5 heart failure rules)"
```

---

## Task 4: Create src/api/alerts.ts — Supabase layer + runAlertEngine

**Files:**
- Create: `src/api/alerts.ts`

This file owns all Supabase I/O for the alert engine. Three exports:
- `getRecentWeightObservations` — reads prior weight_lbs observations
- `insertAlerts` — writes alert rows (silent fail)
- `runAlertEngine` — orchestrates fetch + evaluate + write (never throws)

- [ ] **Step 1: Create src/api/alerts.ts**

```typescript
import { supabase } from './supabase'
import { evaluateAlerts } from '@/lib/alertEngine'
import type { AlertInsert, Observation, ParsedAnswers } from './supabase.types'

export async function getRecentWeightObservations(
  patientId: string,
  days: number
): Promise<Observation[]> {
  try {
    const { data, error } = await supabase
      .from('observations')
      .select('*')
      .eq('patient_id', patientId)
      .eq('observation_type', 'weight_lbs')
      .order('observed_at', { ascending: false })
      .limit(days)

    if (error) return []
    return (data ?? []) as Observation[]
  } catch {
    return []
  }
}

export async function insertAlerts(rows: AlertInsert[]): Promise<void> {
  if (rows.length === 0) return
  try {
    const { error } = await supabase.from('alerts').insert(rows)
    if (error) console.error('insertAlerts error:', error.message)
  } catch (err) {
    console.error('insertAlerts unexpected error:', err)
  }
}

export async function runAlertEngine(
  patientId: string,
  conditionId: string,
  checkinId: string,
  parsed: ParsedAnswers
): Promise<void> {
  try {
    const recentWeightObs = await getRecentWeightObservations(patientId, 3)
    const alertRows = evaluateAlerts(parsed, recentWeightObs, patientId, conditionId, checkinId)
    await insertAlerts(alertRows)
  } catch (err) {
    console.error('runAlertEngine unexpected error:', err)
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
git add src/api/alerts.ts
git commit -m "feat: add alerts API layer (getRecentWeightObservations, insertAlerts, runAlertEngine)"
```

---

## Task 5: Update submitCheckinSession to return checkinId

**Files:**
- Modify: `src/api/checkin.ts` (line 63 — return type, line 163 — return statement)

`submitCheckinSession` currently returns `{ sessionId }`. The alert engine needs `checkinId` to link alert rows to the check-in. Both IDs are already computed in the function — just add `checkinId` to the return.

- [ ] **Step 1: Update the return type signature**

Find this line in `src/api/checkin.ts`:
```typescript
): Promise<{ sessionId: string }> {
```

Change to:
```typescript
): Promise<{ sessionId: string; checkinId: string }> {
```

- [ ] **Step 2: Update the return statement**

Find this line near the end of `submitCheckinSession`:
```typescript
  return { sessionId }
```

Change to:
```typescript
  return { sessionId, checkinId }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors. TypeScript will flag any callers that don't handle the new return shape — fix them in Task 6.

- [ ] **Step 4: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/api/checkin.ts
git commit -m "feat: return checkinId from submitCheckinSession"
```

---

## Task 6: Wire runAlertEngine into PortalCheckin.tsx

**Files:**
- Modify: `src/portal/pages/PortalCheckin.tsx`

Two changes:
1. Add `runAlertEngine` import from `@/api/alerts`
2. In `handleSubmit`, destructure `checkinId` from `submitCheckinSession` and call `runAlertEngine` after the write succeeds

- [ ] **Step 1: Add the import**

Find the existing imports at the top of `src/portal/pages/PortalCheckin.tsx`. There is already a line:
```typescript
import { getActiveTemplate, getPatientRecord, submitCheckinSession, getRecentAlerts } from '@/api/checkin'
```

Add a new import line after it:
```typescript
import { runAlertEngine } from '@/api/alerts'
```

- [ ] **Step 2: Update handleSubmit to destructure checkinId and call runAlertEngine**

Find the `try` block inside `handleSubmit`. Currently it reads:

```typescript
    try {
      await submitCheckinSession({
        patientId: finalState.patientId,
        conditionId: finalState.conditionId,
        templateSlug: finalState.templateSlug,
        startedAt: finalState.startedAt,
        parsed,
        rawAnswers: finalState.answers,
      })

      const alerts = await getRecentAlerts(finalState.patientId, submittedAt)
      clearCheckinState(finalState.patientId)
      setConfirmed({ parsed, alerts, submittedAt })
      setStage('confirmed')
    }
```

Replace with:

```typescript
    try {
      const { checkinId } = await submitCheckinSession({
        patientId: finalState.patientId,
        conditionId: finalState.conditionId,
        templateSlug: finalState.templateSlug,
        startedAt: finalState.startedAt,
        parsed,
        rawAnswers: finalState.answers,
      })

      // Alert engine — fire and forget, never blocks confirmation
      try {
        await runAlertEngine(finalState.patientId, finalState.conditionId, checkinId, parsed)
      } catch {
        // silent — alert engine failure must never block the confirmation screen
      }

      const alerts = await getRecentAlerts(finalState.patientId, submittedAt)
      clearCheckinState(finalState.patientId)
      setConfirmed({ parsed, alerts, submittedAt })
      setStage('confirmed')
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Build check**

```bash
cd /Users/larrygoode/cardiotrack && npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs` with no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/portal/pages/PortalCheckin.tsx
git commit -m "feat: wire runAlertEngine into check-in submit flow"
```

---

## Self-Review

**Spec coverage:**
- [x] `alerts` table migration with RLS (Task 1)
- [x] `AlertInsert` type added (Task 2)
- [x] Pure `evaluateAlerts` with all 5 active rules: weight_gain, abnormal_hr, high_breathlessness, high_swelling, missed_medications (Task 3)
- [x] `missed_checkin` deferred — comment in alertEngine.ts explains why
- [x] `getRecentWeightObservations` fetches 3 prior weight_lbs obs, returns `[]` on error (Task 4)
- [x] `insertAlerts` short-circuits on empty array, silent fail (Task 4)
- [x] `runAlertEngine` wrapped in try/catch, never throws (Task 4)
- [x] `submitCheckinSession` returns `{ sessionId, checkinId }` (Task 5)
- [x] `PortalCheckin` calls `runAlertEngine` with inner try/catch — confirmation screen unaffected (Task 6)
- [x] Alert engine failure never blocks patient confirmation screen

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:**
- `AlertInsert` defined in Task 2, used in Task 3 (`evaluateAlerts` return type) and Task 4 (`insertAlerts` parameter) — consistent
- `evaluateAlerts(parsed, recentWeightObs, patientId, conditionId, checkinId)` defined in Task 3, called in Task 4 with same signature — consistent
- `runAlertEngine(patientId, conditionId, checkinId, parsed)` defined in Task 4, called in Task 6 with same argument order — consistent
- `submitCheckinSession` returns `{ sessionId, checkinId }` from Task 5; Task 6 destructures `{ checkinId }` — consistent
- `Observation` type used in Task 3 and Task 4 — already exists in `supabase.types.ts` from Sub-project A foundation
