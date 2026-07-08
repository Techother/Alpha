-- MKL Health v2 Schema additions
-- Run after schema.sql

CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage text,
  frequency text,
  instructions text,
  active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES medications(id),
  checkin_date date NOT NULL,
  taken bool,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rpm_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  clinician_id uuid REFERENCES auth.users(id),
  log_date date NOT NULL,
  duration_minutes int NOT NULL,
  activity_type text,
  notes text,
  billing_period text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ccm_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  clinician_id uuid REFERENCES auth.users(id),
  log_date date NOT NULL,
  duration_minutes int NOT NULL,
  activity_type text,
  notes text,
  billing_period text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tcm_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  discharge_date date NOT NULL,
  discharge_facility text,
  diagnosis text,
  complexity text DEFAULT 'moderate',
  day2_deadline date,
  day7_deadline date,
  day2_completed bool DEFAULT false,
  day2_completed_at timestamptz,
  day7_completed bool DEFAULT false,
  day7_completed_at timestamptz,
  status text DEFAULT 'open',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tcm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid REFERENCES tcm_episodes(id) ON DELETE CASCADE,
  contact_date date NOT NULL,
  contact_type text,
  reached bool,
  milestone text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS screening_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  screen_type text NOT NULL,
  score int NOT NULL,
  severity text,
  answers jsonb,
  administered_at timestamptz DEFAULT now(),
  administered_by uuid REFERENCES auth.users(id),
  alert_generated bool DEFAULT false
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  rule_name text,
  metric text NOT NULL,
  operator text NOT NULL,
  threshold numeric NOT NULL,
  severity text NOT NULL,
  active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS mobile_phone text,
  ADD COLUMN IF NOT EXISTS checkin_sms_enabled bool DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkin_time text DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS checkin_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS ccm_enrolled bool DEFAULT false,
  ADD COLUMN IF NOT EXISTS conditions_count int DEFAULT 1;

ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS medications_summary jsonb,
  ADD COLUMN IF NOT EXISTS submitted_channel text DEFAULT 'web';
