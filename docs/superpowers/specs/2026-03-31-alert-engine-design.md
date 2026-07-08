# MKL Health — Alert Engine Design
**Date:** 2026-03-31
**Scope:** Sub-project C — Client-side alert evaluation engine
**PRD Reference:** MKL Health PRD v3.0 — Heart failure alert rules

---

## Overview

The alert engine evaluates 6 heart failure alert rules against each completed check-in submission and writes matching rows to the `alerts` table. Evaluation runs client-side immediately after `submitCheckinSession` succeeds. Failures are always silent — the patient's confirmation screen is never blocked by alert engine errors.

The `missed_checkin` rule (requires a scheduled job) is deferred to a future sub-project.

---

## Architecture

**Approach:** Pure evaluator + write layer, called from `PortalCheckin.tsx` after submit.

```
PortalCheckin.tsx
  └── runAlertEngine(patientId, conditionId, checkinId, parsed)  ← silent fail
        ├── getRecentWeightObservations(patientId, 3)            ← Supabase read
        ├── evaluateAlerts(parsed, recentWeightObs)              ← pure function
        └── insertAlerts(alertRows)                              ← Supabase write
```

`evaluateAlerts` is a pure function with no Supabase dependencies — takes `ParsedAnswers` and an array of recent weight observations, returns an array of `AlertInsert` rows. `runAlertEngine` orchestrates the data fetch, evaluation, and write, and is the only function with side effects.

---

## Alert Rules

Six rules evaluated per check-in submission:

| `alert_type` | Source | Condition | Severity |
|---|---|---|---|
| `weight_gain` | `parsed.weight_lbs` + recent obs | Today's weight minus minimum weight in prior 3 days ≥ 2 lbs | `high` |
| `abnormal_hr` | `parsed.heart_rate` | heart_rate > 100 OR heart_rate < 50 | `high` |
| `high_breathlessness` | `parsed.breathlessness` | breathlessness ≥ 4 | `high` |
| `high_swelling` | `parsed.swelling` | swelling ≥ 4 | `medium` |
| `missed_medications` | `parsed.medications` | medications === false | `medium` |
| `missed_checkin` | — | **Deferred** — requires scheduled job | — |

**Multiple rules can fire in one session.** No deduplication across sessions — providers see all alert rows including repeated patterns.

**Weight delta rule detail:** `getRecentWeightObservations` fetches up to 3 prior weight_lbs observations (not including today's). If no prior observations exist, the delta cannot be computed and the rule does not fire. If the fetch fails, an empty array is passed and the rule silently skips.

---

## Database Schema

### New table: `alerts`

Migration file: `supabase/migrations/002_alerts_table.sql`

```sql
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

---

## New Type: `AlertInsert`

Add to `src/api/supabase.types.ts`:

```typescript
export interface AlertInsert {
  patient_id: string
  condition_id: string
  checkin_id: string
  alert_type: string
  severity: 'high' | 'medium' | 'low'
}
```

The existing `AlertRow` type (with `id` and `created_at`) is used for reads. `AlertInsert` is used for writes (Supabase generates `id` and `created_at`).

---

## New file: `src/lib/alertEngine.ts`

**`evaluateAlerts(parsed, recentWeightObs, patientId, conditionId, checkinId): AlertInsert[]`**

Pure function. Evaluates all 6 rules (5 active, 1 deferred) against the provided data. Returns an array of zero or more `AlertInsert` rows.

```typescript
import type { ParsedAnswers, AlertInsert, Observation } from '@/api/supabase.types'

export function evaluateAlerts(
  parsed: ParsedAnswers,
  recentWeightObs: Observation[],
  patientId: string,
  conditionId: string,
  checkinId: string
): AlertInsert[] {
  const alerts: AlertInsert[] = []

  function alert(alert_type: string, severity: AlertInsert['severity']) {
    alerts.push({ patient_id: patientId, condition_id: conditionId, checkin_id: checkinId, alert_type, severity })
  }

  // Rule: weight_gain — 2+ lbs gain over prior 3 days
  if (parsed.weight_lbs !== null && recentWeightObs.length > 0) {
    const priorMin = Math.min(...recentWeightObs.map(o => o.value_numeric!))
    if (parsed.weight_lbs - priorMin >= 2) alert('weight_gain', 'high')
  }

  // Rule: abnormal_hr
  if (parsed.heart_rate !== null) {
    if (parsed.heart_rate > 100 || parsed.heart_rate < 50) alert('abnormal_hr', 'high')
  }

  // Rule: high_breathlessness
  if (parsed.breathlessness !== null && parsed.breathlessness >= 4) {
    alert('high_breathlessness', 'high')
  }

  // Rule: high_swelling
  if (parsed.swelling !== null && parsed.swelling >= 4) {
    alert('high_swelling', 'medium')
  }

  // Rule: missed_medications
  if (parsed.medications === false) {
    alert('missed_medications', 'medium')
  }

  // Rule: missed_checkin — deferred (requires scheduled job)

  return alerts
}
```

---

## New file: `src/api/alerts.ts`

**`getRecentWeightObservations(patientId, days): Promise<Observation[]>`**
- SELECT from `observations` WHERE `patient_id = patientId AND observation_type = 'weight_lbs'`
- ORDER BY `observed_at DESC` LIMIT `days`
- Returns `[]` on error (never throws)

**`insertAlerts(rows: AlertInsert[]): Promise<void>`**
- INSERT into `alerts` (bulk)
- Returns silently on error (never throws)
- Short-circuits if `rows.length === 0`

**`runAlertEngine(patientId, conditionId, checkinId, parsed): Promise<void>`**
- Fetches recent weight observations (3 days)
- Calls `evaluateAlerts`
- Calls `insertAlerts` if any alerts returned
- Wrapped in try/catch — never throws

---

## Modified files

### `src/api/checkin.ts`

`submitCheckinSession` return type changes from `Promise<{ sessionId: string }>` to `Promise<{ sessionId: string; checkinId: string }>`. The `checkinId` is already computed internally — it just needs to be included in the return value.

### `src/portal/pages/PortalCheckin.tsx`

In `handleSubmit`, after `submitCheckinSession` succeeds:

```typescript
const { sessionId, checkinId } = await submitCheckinSession({ ... })
clearCheckinState(finalState.patientId)

// Alert engine — fire and forget, never blocks confirmation
try {
  await runAlertEngine(finalState.patientId, finalState.conditionId, checkinId, parsed)
} catch {
  // silent
}

const alerts = await getRecentAlerts(finalState.patientId, submittedAt)
setConfirmed({ parsed, alerts, submittedAt })
setStage('confirmed')
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `getRecentWeightObservations` fails | Empty array passed to evaluator — weight delta rule skips silently |
| `insertAlerts` fails | Logged to console, returns silently |
| `runAlertEngine` throws | Caught in `PortalCheckin` try/catch — confirmation screen unaffected |
| No rules fire | `insertAlerts` not called (empty array short-circuits) |
| `submitCheckinSession` fails | `runAlertEngine` never called — existing error path unchanged |

---

## File Summary

| File | Action |
|---|---|
| `supabase/migrations/002_alerts_table.sql` | Create — `alerts` table + RLS policies |
| `src/api/supabase.types.ts` | Modify — add `AlertInsert` interface |
| `src/lib/alertEngine.ts` | Create — pure `evaluateAlerts` function |
| `src/api/alerts.ts` | Create — `getRecentWeightObservations`, `insertAlerts`, `runAlertEngine` |
| `src/api/checkin.ts` | Modify — return `checkinId` from `submitCheckinSession` |
| `src/portal/pages/PortalCheckin.tsx` | Modify — call `runAlertEngine` after submit |

---

## Out of Scope

- `missed_checkin` rule — requires scheduled job (deferred)
- Alert deduplication across sessions
- Slack notifications — Sub-project B (provider dashboard) reads from `alerts` table
- Patient-facing alert details — `getRecentAlerts` in Sub-project A shows only "Your care team has been notified", no specifics

---

## Success Criteria

- [ ] `alerts` table created with RLS policies (providers read, anon insert)
- [ ] After check-in with HR > 100, an `abnormal_hr` alert row exists in `alerts`
- [ ] After check-in with weight 3+ lbs above prior 3-day minimum, a `weight_gain` alert row exists
- [ ] After check-in with breathlessness ≥ 4, a `high_breathlessness` row exists
- [ ] After check-in with swelling ≥ 4, a `high_swelling` row exists
- [ ] After check-in with medications = No, a `missed_medications` row exists
- [ ] Alert engine failure does not prevent the confirmation screen from rendering
- [ ] `npx tsc --noEmit` passes with zero errors after implementation
