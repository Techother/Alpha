# Supabase Schema Documentation

**Active Schema: v3.2 | Applied via: migrations 001 + 002 + 003 + 004 + 005**

This directory contains the authoritative Supabase schema for MKL Health. The v3 schema uses Row Level Security (RLS) with a provider/patient role model, multi-condition patient structure, and a chatbot session architecture.

---

## Supabase Project

| Field | Value |
|-------|-------|
| Project ID | `wtjotacchiurbjcizdws` |
| Dashboard | https://supabase.com/dashboard/project/wtjotacchiurbjcizdws |
| SQL Editor | https://supabase.com/dashboard/project/wtjotacchiurbjcizdws/sql/new |

---

## Bootstrap Sequence

To set up a fresh Supabase project, run the migrations **in this exact order** using the Supabase SQL Editor. Each migration depends on the previous one.

### Step 1 — `migrations/001_v3_foundation.sql`

Creates the core v3 schema with RLS:

- `profiles` — user accounts with `role` field (`provider` or `patient`)
- `patients` — patient records (minimal v3 base; extended by 003)
- `conditions` — per-patient condition tracking (e.g., hypertension, CHF)
- `chatbot_sessions` — chatbot interaction sessions (extended by 003)
- `checkins` — patient daily check-in records (extended by 003)
- `observations` — clinical observation records
- `medication_regimens` — structured medication schedules
- `audit_log` — immutable audit trail for sensitive operations

Also creates the `handle_new_user()` trigger that auto-creates a profile row on Supabase Auth signup.

### Step 2 — `migrations/002_alerts_table.sql`

Creates the alerts system:

- `alerts` — clinical alert records with foreign keys to `checkins(id)` and `conditions(id)`
- Includes RLS: provider-read, patient-own-read, service-insert

**Requires 001** — `alerts` references `checkins` and `conditions` defined in 001.

### Step 3 — `migrations/003_v3_extension.sql`

Closes the column gap between the v3 schema definition and the columns queried by application code (`src/api/supabase.ts`):

- **`patients`** — adds `first_name`, `last_name`, `condition`, `provider_name`, `risk_level`, `active`
- **`checkins`** — adds `checkin_date`, `breathlessness_score`, `swelling_score`, `medications_taken`, `patient_notes`
- **`chatbot_sessions`** — adds `completed`, `checkin_id`
- **`alerts`** — adds `status`, `description`, `threshold_value`, `acknowledged_by`, `acknowledged_at`
- **`chatbot_messages`** — creates this table (absent from 001/002): `id`, `session_id`, `role`, `content`, `intent`, `extracted_value`, `sequence_num`, `created_at`

All statements are idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) and safe to re-run.

**Requires 001 + 002** — extends tables defined in both prior migrations.

### Step 4 — `migrations/004_fix_rls.sql`

Fixes four RLS and constraint bugs found in code review:

- **CR-01:** Adds `providers_update_alerts` policy — allows providers to `UPDATE` alerts (acknowledge). Without this, `acknowledgeAlert()` silently updated 0 rows.
- **CR-02:** Adds `providers_read_patients` policy — allows providers to `SELECT` all patient rows. Without this, `getPatients()` and dashboard stats returned empty for providers.
- **CR-03:** Expands `alerts.severity` CHECK to include `'critical'` — the original CHECK in 002 only allowed `('high', 'medium', 'low')`, causing a constraint violation when creating critical alerts.
- **CR-04:** Replaces unconstrained `chatbot_messages` INSERT policy — scopes inserts to the session owner (the patient whose session it is). In Phase 3, the AI proxy will use the service-role key and bypass RLS entirely.

All statements are idempotent and safe to re-run.

**Requires 001 + 002 + 003** — modifies RLS policies and constraints on tables defined by prior migrations.

### Step 5 — `migrations/005_mkl_health_schema.sql`

Activates MKL Health's dormant v3.2 schema (SCHM2-01 through SCHM2-06) by widening existing tables and closing a pre-existing RLS gap, instead of creating parallel/duplicate tables:

- **`conditions`** — seeds a fourth row, `other` (catch-all primary condition outside diabetes/CKD/heart failure). No `patients.primary_condition` or `patients.conditions` column is added; primary condition stays derived from `patient_conditions.primary_condition` joined to `conditions.slug`.
- **`medication_regimens.frequency`** — widens the CHECK constraint from 3 values to 7: `once_daily`, `twice_daily`, `three_times_daily`, `four_times_daily`, `weekly`, `as_needed`, `other`.
- **`medication_events.event_type`** — widens the CHECK constraint from 3 values to 6: `taken`, `missed`, `side_effect`, `start`, `stop`, `dose_change`. The three new values are prescription-change events for Medication Outcome Tracking (Phase 14), distinct from the existing adherence values, on the same table.
- **`leads`** (new table) — `id`, `name`, `practice_name`, `specialty`, `patient_volume`, `ehr`, `chat_transcript` (jsonb), `requested_slot`, `created_at`. RLS: `public_insert_leads` allows unauthenticated INSERT (landing-page chat writes before a visitor has an account); `providers_read_leads` restricts SELECT to `profiles.role = 'provider'`.
- **`providers_read_*` policies** — adds a provider-read SELECT policy to five tables that have only had `patient_own_*` policies since migration 001: `providers_read_patient_conditions`, `providers_read_observations`, `providers_read_symptom_reports`, `providers_read_medication_regimens`, `providers_read_medication_events`. These mirror `providers_read_patients` from Step 4 (CR-02) — same predicate, same bug class, closed before Phase 11-14 code reads this data.

All statements are idempotent (`ON CONFLICT ... DO NOTHING`, `DROP CONSTRAINT IF EXISTS` / `ADD CONSTRAINT`, `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`) and safe to re-run.

**Requires 001 + 002 + 003 + 004**

#### Step 5 Verification Query

Run these in the Supabase SQL Editor after applying `005_mkl_health_schema.sql`:

```sql
-- (a) confirm the leads table has all 9 columns
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
ORDER BY column_name;

-- (b) confirm both widened CHECK constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname IN ('medication_regimens_frequency_check', 'medication_events_event_type_check');

-- (c) confirm all provider-read policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE 'providers_read_%'
ORDER BY tablename;
```

Expected results: query (a) returns all 9 `leads` columns (`chat_transcript`, `created_at`, `ehr`, `id`, `name`, `patient_volume`, `practice_name`, `requested_slot`, `specialty`); query (b) returns both constraint definitions containing the widened value lists; query (c) returns exactly 7 rows — `patients` (from Step 4), plus `patient_conditions`, `observations`, `symptom_reports`, `medication_regimens`, `medication_events`, and `leads`.

#### Observation Type Conventions

`observations.observation_type` is free text by design (no DB CHECK constraint) — SCHM2-04 needs no migration. The following convention is a code-level/documentation standard for Phase 12/13/14 to follow consistently, not a database-enforced rule:

| Condition | `observation_type` | Unit |
|-----------|---------------------|------|
| diabetes | `glucose` | mg/dL |
| diabetes | `a1c` | % |
| ckd | `egfr` | mL/min/1.73m² |
| ckd | `creatinine` | mg/dL |
| ckd | `potassium` | mEq/L |
| heart_failure | `weight` | lbs |
| heart_failure | `heart_rate` | bpm |
| heart_failure | `blood_pressure` | mmHg |

---

## Verification Query

Run this in the Supabase SQL Editor to confirm v3 schema is active:

```sql
-- Run in Supabase SQL Editor to confirm v3 schema is active:
SELECT table_name, COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles','patients','checkins','alerts','chatbot_sessions','chatbot_messages')
GROUP BY table_name
ORDER BY table_name;
```

If `profiles`, `patients`, `checkins` (with `checked_in_at`), `alerts` (with `status`), `chatbot_sessions` (with `completed`), and `chatbot_messages` all appear in the result, migrations 001 + 002 + 003 have been applied successfully.

---

## Column Duality Gap — RESOLVED

**Resolved in Phase 7 (Component Decomposition) — 2026-05-29.**

The v3 schema (migration 001) defined `checkins` with v3-style column names:

```
breathlessness, swelling, medications, free_text, checked_in_at
```

Migration 003 had added v1-style aliases (`breathlessness_score`, `swelling_score`, `medications_taken`, `patient_notes`, `checkin_date`) to bridge the gap while application code was migrated. All application query sites have now been updated to use v3-style column names exclusively:

- `src/api/supabase.ts` — `createCheckin`, `getPatientCheckins`, `getTodayCheckin`, `getDashboardStats`
- `src/App.tsx` — vitals display, check-in log, chatbot answer mapping, alert triggers, weight-delta comparison

The `checkin_date` → `checked_in_at` migration required changing date equality queries (`.eq('checkin_date', dateStr)`) to timestamp range queries (`.gte('checked_in_at', dayStart).lt('checked_in_at', dayEnd)`) because `checked_in_at` is `timestamptz NOT NULL DEFAULT now()`, not a `date` column.

**The v1-style columns added by migration 003 are now dead weight.** They can be dropped in a future migration once confirmed unused:

```sql
ALTER TABLE checkins
  DROP COLUMN IF EXISTS checkin_date,
  DROP COLUMN IF EXISTS breathlessness_score,
  DROP COLUMN IF EXISTS swelling_score,
  DROP COLUMN IF EXISTS medications_taken,
  DROP COLUMN IF EXISTS patient_notes;
```

Do not run this drop until after confirming no external integrations (Airtable sync scripts, reporting queries) still reference the old column names.

---

## Archived Files

The following files in `supabase/archive/` are kept for reference only. **Do not apply them to any database.**

| File | Version | Status |
|------|---------|--------|
| `archive/schema.sql` | v1 — flat schema, no RLS | Superseded by 001+002+003. Preserved for column name reference. |
| `archive/schema_v2.sql` | v2 — adds medications, time logs | Superseded by 001+002+003. v2 tables (`medications`, `medication_logs`, `rpm_time_logs`) are not queried by current application code and are out of scope for this milestone. |

The v2 tables are not recreated in v3 and are not queried by `src/api/supabase.ts`. They are documented in the archive for reference if future phases require them.

> **Note:** The originals (`supabase/schema.sql` and `supabase/schema_v2.sql`) remain at the repository root as per project decision D-07 (do not delete schema files). The `archive/` copies have explanatory headers prepended.
