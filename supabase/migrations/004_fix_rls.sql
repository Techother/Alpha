-- =============================================================
-- MKL Health 004_fix_rls.sql
-- Fixes RLS gaps and constraint bug found in code review (01-REVIEW.md)
-- Run AFTER: 003_v3_extension.sql
-- Project: wtjotacchiurbjcizdws
-- =============================================================
--
-- Fixes:
--   CR-01: No UPDATE policy on alerts — acknowledgeAlert() silently failed
--   CR-02: No provider-read policy on patients — provider dashboard returned empty
--   CR-03: severity CHECK excluded 'critical' — createAlert('critical') raised constraint violation
--   CR-04: chatbot_messages INSERT was unconstrained — scoped to session owner

-- ─── CR-02: Provider read on patients ────────────────────────
-- 001 created patient_own_row (FOR ALL USING profile_id = auth.uid()), which means
-- only a patient can see their own row. Providers need to read all patients.
-- We add a separate FOR SELECT policy for providers.

DROP POLICY IF EXISTS "providers_read_patients" ON patients;
CREATE POLICY "providers_read_patients" ON patients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  );

-- ─── CR-01: Provider UPDATE on alerts ────────────────────────
-- 002 only created providers_read_alerts (SELECT) and service_insert_alerts (INSERT).
-- No UPDATE policy exists, so acknowledgeAlert() silently updated 0 rows.

DROP POLICY IF EXISTS "providers_update_alerts" ON alerts;
CREATE POLICY "providers_update_alerts" ON alerts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  );

-- ─── CR-03: Fix severity CHECK on alerts ─────────────────────
-- 002 defined CHECK (severity IN ('high', 'medium', 'low')).
-- src/api/supabase.ts createAlert() has TypeScript type 'critical' | 'high' | 'medium' | 'low'.
-- Add 'critical' to the constraint. PostgreSQL auto-names inline constraints as
-- {table}_{column}_check; drop and recreate with the correct value set.

ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;
ALTER TABLE alerts
  ADD CONSTRAINT alerts_severity_check
  CHECK (severity IN ('critical', 'high', 'medium', 'low'));

-- ─── CR-04: Scope chatbot_messages INSERT to session owner ────
-- 003 created service_insert_chatbot_messages WITH CHECK (true) — unconstrained.
-- In Phase 3, the AI proxy (api/chat.js) will use the Supabase service-role key,
-- which bypasses RLS entirely. Until then, scope client-side inserts to the
-- patient who owns the session.

DROP POLICY IF EXISTS "service_insert_chatbot_messages" ON chatbot_messages;
DROP POLICY IF EXISTS "session_owner_insert_chatbot_messages" ON chatbot_messages;
CREATE POLICY "session_owner_insert_chatbot_messages" ON chatbot_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbot_sessions cs
      JOIN patients p ON p.id = cs.patient_id
      WHERE cs.id = session_id AND p.profile_id = auth.uid()
    )
  );
