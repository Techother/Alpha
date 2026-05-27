-- =============================================================
-- Alpha Health Track 003_v3_extension.sql
-- Extends 001+002 to match application column expectations
-- Run AFTER: 001_v3_foundation.sql, 002_alerts_table.sql
-- Project: wtjotacchiurbjcizdws
-- Dashboard: https://supabase.com/dashboard/project/wtjotacchiurbjcizdws
-- =============================================================

-- PREREQUISITE CHECK: Before running this migration, confirm 001 has been applied:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'profiles' AND table_schema = 'public';
-- If 'role' appears in the result, 001 is applied. If empty, run 001 first, then 002, then 003.

-- ─── Extend patients table ────────────────────────────────────
-- Adds columns queried by src/api/supabase.ts:
--   getPatients() uses: active, risk_level
--   getOpenAlerts() joins: patients(first_name, last_name, mrn)
--   getDashboardStats() uses: active, risk_level

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS first_name    text,
  ADD COLUMN IF NOT EXISTS last_name     text,
  ADD COLUMN IF NOT EXISTS condition     text,
  ADD COLUMN IF NOT EXISTS provider_name text,
  ADD COLUMN IF NOT EXISTS risk_level    text CHECK (risk_level IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS active        boolean NOT NULL DEFAULT true;

-- ─── Extend checkins table ────────────────────────────────────
-- Adds columns queried by src/api/supabase.ts:
--   getPatientCheckins() uses: checkin_date
--   getTodayCheckin() uses: checkin_date
--   createCheckin() inserts: checkin_date, breathlessness_score, swelling_score,
--                            medications_taken, patient_notes

ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS checkin_date         date,
  ADD COLUMN IF NOT EXISTS breathlessness_score int CHECK (breathlessness_score BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS swelling_score        int CHECK (swelling_score BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS medications_taken     boolean,
  ADD COLUMN IF NOT EXISTS patient_notes         text;

-- ─── Extend chatbot_sessions table ───────────────────────────
-- Adds columns queried by src/api/supabase.ts:
--   completeSession() updates: completed, completed_at, checkin_id

ALTER TABLE chatbot_sessions
  ADD COLUMN IF NOT EXISTS completed  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkin_id uuid REFERENCES checkins(id);

-- ─── Extend alerts table ──────────────────────────────────────
-- Adds columns queried by src/api/supabase.ts:
--   getOpenAlerts() uses: status
--   getPatientAlerts() uses: status
--   acknowledgeAlert() updates: status, acknowledged_at
--   createAlert() inserts: description, threshold_value
-- NOTE: status gets NOT NULL DEFAULT 'open' so existing rows receive the correct value

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'open'
                                           CHECK (status IN ('open', 'acknowledged')),
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS threshold_value text,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

-- ─── Create chatbot_messages ──────────────────────────────────
-- This table does NOT exist in 001, 002, or any migration. It IS in schema.sql (v1)
-- but schema.sql was never applied to the v3 database.
-- src/api/supabase.ts: saveChatbotMessage() inserts into this table.

CREATE TABLE IF NOT EXISTS chatbot_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  intent          text,
  extracted_value text,
  sequence_num    int NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS for chatbot_messages ─────────────────────────────────
-- Provider-only read (patients cannot read transcripts).
-- Service insert allows chatbot writes via anon key.
-- DROP POLICY IF EXISTS guards ensure idempotency on re-run.

ALTER TABLE chatbot_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "providers_read_chatbot_messages" ON chatbot_messages;
CREATE POLICY "providers_read_chatbot_messages" ON chatbot_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  );

DROP POLICY IF EXISTS "service_insert_chatbot_messages" ON chatbot_messages;
CREATE POLICY "service_insert_chatbot_messages" ON chatbot_messages
  FOR INSERT WITH CHECK (true);

-- ─── Performance indexes ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_checkins_date     ON checkins(patient_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status     ON alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_msg_sess  ON chatbot_messages(session_id, sequence_num);
