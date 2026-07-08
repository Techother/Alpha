-- MKL Health MVP Schema
-- Run in: Supabase dashboard > SQL Editor

-- patients
CREATE TABLE IF NOT EXISTS patients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  mrn           text UNIQUE NOT NULL,
  condition     text NOT NULL,
  provider_name text NOT NULL,
  risk_level    text NOT NULL CHECK (risk_level IN ('high', 'medium', 'low')),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- checkins
CREATE TABLE IF NOT EXISTS checkins (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  checkin_date         date NOT NULL DEFAULT CURRENT_DATE,
  weight_lbs           numeric(5,1),
  heart_rate           int,
  breathlessness_score int CHECK (breathlessness_score BETWEEN 0 AND 10),
  swelling_score       int CHECK (swelling_score BETWEEN 0 AND 10),
  medications_taken    boolean,
  patient_notes        text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- alerts
CREATE TABLE IF NOT EXISTS alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  alert_type      text NOT NULL,
  description     text NOT NULL,
  severity        text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  threshold_value text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged')),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- chatbot_sessions
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  checkin_id   uuid REFERENCES checkins(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- chatbot_messages
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

-- Seed sample patients
INSERT INTO patients (first_name, last_name, mrn, condition, provider_name, risk_level) VALUES
  ('Robert', 'Chen',     'MRN-1001', 'Heart Failure (HFrEF)', 'Dr. Patricia Wells', 'high'),
  ('Maria',  'Santos',   'MRN-1002', 'Heart Failure (HFpEF)', 'Dr. James Okafor',   'high'),
  ('David',  'Thompson', 'MRN-1003', 'Dilated Cardiomyopathy','Dr. Patricia Wells', 'medium'),
  ('Sarah',  'Johnson',  'MRN-1004', 'Hypertensive Heart Disease','Dr. James Okafor','medium'),
  ('James',  'Williams', 'MRN-1005', 'Heart Failure (HFrEF)', 'Dr. Patricia Wells', 'low')
ON CONFLICT (mrn) DO NOTHING;
