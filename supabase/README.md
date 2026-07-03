# Supabase Schema Documentation

**Active Schema: v3.0 | Applied via: migrations 001 + 002 + 003 + 004**

This directory contains the authoritative Supabase schema for Alpha Health Track. The v3 schema uses Row Level Security (RLS) with a provider/patient role model, multi-condition patient structure, and a chatbot session architecture.

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
