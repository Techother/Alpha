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
