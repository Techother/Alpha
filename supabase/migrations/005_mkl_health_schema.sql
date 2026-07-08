-- =============================================================
-- Alpha Health Track 005_mkl_health_schema.sql
-- Activates MKL Health's dormant v3.2 schema (SCHM2-01 through SCHM2-06)
-- Apply in: Supabase dashboard > SQL Editor
-- Run AFTER: 004_fix_rls.sql
-- Project: wtjotacchiurbjcizdws
-- =============================================================
--
-- The live v3 schema (migration 001) already contains conditions,
-- patient_conditions, observations, medication_regimens, and medication_events
-- tables that are structurally near-identical to what MKL Health's PRD asked
-- for as "new" tables. conditions' existing seed comment ('v3.2 stub' on the
-- diabetes/ckd rows) shows this exact expansion was anticipated when 001 was
-- written. This migration activates that dormant schema instead of building
-- parallel/duplicate tables:
--
-- Fixes:
--   SCHM2-01: conditions missing a catch-all 'other' primary-condition row
--   SCHM2-02: medication_regimens.frequency CHECK too narrow for MKL Health's
--             titration/injectable schedules
--   SCHM2-03: medication_events.event_type CHECK lacks prescription-change
--             values (start/stop/dose_change) needed by Medication Outcome
--             Tracking (Phase 14)
--   SCHM2-04: no schema change — observation_type is already free text;
--             documented as a convention in supabase/README.md Step 5
--   SCHM2-05: no `leads` table exists — genuinely new, for Phase 11 landing
--             page chat to write prospect data pre-auth
--   SCHM2-06: patient_conditions, observations, symptom_reports,
--             medication_regimens, and medication_events have only ever had
--             patient_own_* policies since 001 — no provider read policy.
--             Same bug class as CR-02 (fixed for patients in 004_fix_rls.sql),
--             discovered during Phase 9 planning.

-- ─── SCHM2-01: Seed 'other' catch-all condition ──────────────
-- conditions already has heart_failure/diabetes/ckd; primary condition
-- classification needs a catch-all for patients outside those three.
-- No patients.primary_condition or patients.conditions jsonb column is added —
-- primary condition stays derived from patient_conditions.primary_condition
-- joined to conditions.slug (09-CONTEXT.md decision).

INSERT INTO conditions (slug, name, description) VALUES
  ('other', 'Other', 'Catch-all primary condition outside diabetes/CKD/heart failure')
ON CONFLICT (slug) DO NOTHING;

-- ─── SCHM2-02: Widen medication_regimens.frequency CHECK ─────
-- Original CHECK (once_daily/twice_daily/as_needed) is too narrow for MKL
-- Health's broader titration/injectable schedules. Widen the value list
-- rather than removing the CHECK entirely, per 09-CONTEXT.md decision.
-- PostgreSQL auto-named the inline constraint medication_regimens_frequency_check
-- (same pattern 004 used for alerts_severity_check).

ALTER TABLE medication_regimens DROP CONSTRAINT IF EXISTS medication_regimens_frequency_check;
ALTER TABLE medication_regimens
  ADD CONSTRAINT medication_regimens_frequency_check
  CHECK (frequency IN ('once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'weekly', 'as_needed', 'other'));

-- ─── SCHM2-03: Widen medication_events.event_type CHECK ──────
-- Original CHECK (taken/missed/side_effect) tracks adherence. MKL Health's
-- Medication Outcome Tracking (Phase 14) needs prescription-change events
-- (start/stop/dose_change) — a related but distinct concern on the same
-- entity, not a parallel table.

ALTER TABLE medication_events DROP CONSTRAINT IF EXISTS medication_events_event_type_check;
ALTER TABLE medication_events
  ADD CONSTRAINT medication_events_event_type_check
  CHECK (event_type IN ('taken', 'missed', 'side_effect', 'start', 'stop', 'dose_change'));

-- ─── SCHM2-04: Outcome metrics — no schema change ────────────
-- observations.observation_type is already unconstrained text (no CHECK),
-- so a1c/egfr/creatinine/potassium/weight/glucose/etc. all fit without a
-- migration. The observation_type -> condition/unit convention table now
-- lives in supabase/README.md Step 5 (documentation only, not a DB constraint).

-- ─── SCHM2-05: Leads table (genuinely new) ───────────────────
-- No existing equivalent anywhere in the schema. Landing-page chat (Phase 11)
-- writes prospect data before any account exists, so INSERT must be public.
-- Only staff (profiles.role = 'provider') may SELECT.

CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text,
  practice_name   text,
  specialty       text,
  patient_volume  text,
  ehr             text,
  chat_transcript jsonb NOT NULL DEFAULT '[]',
  requested_slot  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_leads" ON leads;
CREATE POLICY "public_insert_leads" ON leads
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "providers_read_leads" ON leads;
CREATE POLICY "providers_read_leads" ON leads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  );

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

-- ─── SCHM2-06: Close provider-read RLS gap ────────────────────
-- patient_conditions, observations, symptom_reports, medication_regimens,
-- and medication_events have only had patient_own_* policies since 001.
-- This closes the same bug class as CR-02, discovered during Phase 9
-- planning — every downstream v2.0 phase (11-14) needs clinicians to read
-- this data. Predicate is character-for-character identical to
-- providers_read_patients in 004_fix_rls.sql; only the policy name and
-- table change.

DROP POLICY IF EXISTS "providers_read_patient_conditions" ON patient_conditions;
CREATE POLICY "providers_read_patient_conditions" ON patient_conditions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  );

DROP POLICY IF EXISTS "providers_read_observations" ON observations;
CREATE POLICY "providers_read_observations" ON observations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  );

DROP POLICY IF EXISTS "providers_read_symptom_reports" ON symptom_reports;
CREATE POLICY "providers_read_symptom_reports" ON symptom_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  );

DROP POLICY IF EXISTS "providers_read_medication_regimens" ON medication_regimens;
CREATE POLICY "providers_read_medication_regimens" ON medication_regimens
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  );

DROP POLICY IF EXISTS "providers_read_medication_events" ON medication_events;
CREATE POLICY "providers_read_medication_events" ON medication_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  );
