-- =============================================================
-- MKL Health 006_prelaunch_email_signups.sql
-- Captures pre-launch newsletter and launch-notification interest
-- Run AFTER: 005_mkl_health_schema.sql
-- =============================================================

CREATE TABLE IF NOT EXISTS prelaunch_email_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text NOT NULL DEFAULT 'landing_page',
  wants_newsletter boolean NOT NULL DEFAULT true,
  wants_launch_updates boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prelaunch_email_signups_email_unique UNIQUE (email),
  CONSTRAINT prelaunch_email_signups_email_format
    CHECK (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  CONSTRAINT prelaunch_email_signups_source_length
    CHECK (char_length(source) BETWEEN 1 AND 80)
);

ALTER TABLE prelaunch_email_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_prelaunch_email_signups" ON prelaunch_email_signups;
CREATE POLICY "public_insert_prelaunch_email_signups" ON prelaunch_email_signups
  FOR INSERT WITH CHECK (
    wants_newsletter = true OR wants_launch_updates = true
  );

DROP POLICY IF EXISTS "providers_read_prelaunch_email_signups" ON prelaunch_email_signups;
CREATE POLICY "providers_read_prelaunch_email_signups" ON prelaunch_email_signups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'provider')
  );

CREATE INDEX IF NOT EXISTS idx_prelaunch_email_signups_created
  ON prelaunch_email_signups(created_at DESC);
