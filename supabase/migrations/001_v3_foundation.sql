-- =============================================================
-- MKL Health v3.0 Foundation Migration
-- Apply in: Supabase dashboard > SQL Editor
-- Project: wtjotacchiurbjcizdws
-- =============================================================

-- ─── Profiles (extends auth.users with role) ─────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'patient' CHECK (role IN ('provider', 'patient')),
  full_name  text,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_profile" ON profiles;
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (id = auth.uid());

-- Auto-create profile row on new signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Patients ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  mrn        text,
  dob        date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_own_row" ON patients;
CREATE POLICY "patient_own_row" ON patients
  FOR ALL USING (profile_id = auth.uid());

-- ─── Conditions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conditions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO conditions (slug, name, description) VALUES
  ('heart_failure', 'Heart Failure',         'CHF and related cardiac conditions — v3.0'),
  ('diabetes',      'Diabetes',              'Type 1 and Type 2 diabetes — v3.2 stub'),
  ('ckd',           'Chronic Kidney Disease','CKD stages 1–5 — v3.2 stub')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conditions_read_all" ON conditions;
CREATE POLICY "conditions_read_all" ON conditions FOR SELECT USING (true);

-- ─── Patient conditions (many-to-many) ───────────────────────
CREATE TABLE IF NOT EXISTS patient_conditions (
  patient_id        uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_id      uuid NOT NULL REFERENCES conditions(id),
  diagnosed_at      date,
  severity          text CHECK (severity IN ('mild', 'moderate', 'severe')),
  primary_condition boolean NOT NULL DEFAULT false,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, condition_id)
);

ALTER TABLE patient_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_own_conditions" ON patient_conditions;
CREATE POLICY "patient_own_conditions" ON patient_conditions
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = auth.uid())
  );

-- ─── Questionnaire templates ──────────────────────────────────
CREATE TABLE IF NOT EXISTS questionnaire_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  questions   jsonb NOT NULL DEFAULT '[]',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Heart Failure template (active)
INSERT INTO questionnaire_templates (slug, name, description, questions, active)
VALUES (
  'daily_checkin_v1',
  'Heart Failure Daily Check-In',
  'Heart failure daily check-in — v3.0',
  '[
    {"id":"q_weight",   "text":"What is your weight today?",                         "type":"number",  "intent":"weight",           "unit":"lbs"},
    {"id":"q_hr",       "text":"What is your resting heart rate?",                   "type":"number",  "intent":"heart_rate",       "unit":"bpm"},
    {"id":"q_bp",       "text":"What is your blood pressure?",                       "type":"text",    "intent":"blood_pressure"},
    {"id":"q_breath",   "text":"How is your breathing today? (1=easy, 5=very hard)", "type":"scale",   "intent":"breathlessness",   "scale_min":1,"scale_max":5},
    {"id":"q_swelling", "text":"Any swelling in your legs or ankles?",               "type":"scale",   "intent":"swelling",         "scale_min":1,"scale_max":5},
    {"id":"q_fatigue",  "text":"How tired are you today? (1=not tired, 5=exhausted)","type":"scale",   "intent":"fatigue",          "scale_min":1,"scale_max":5},
    {"id":"q_meds",     "text":"Did you take all your medications today?",            "type":"boolean", "intent":"medications"},
    {"id":"q_notes",    "text":"Anything else to share with your care team?",        "type":"text",    "intent":"free_text_symptom","optional":true}
  ]'::jsonb,
  true
) ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description;

-- Diabetes template (stub — inactive until v3.2)
INSERT INTO questionnaire_templates (slug, name, description, questions, active)
VALUES (
  'diabetes_daily_v1',
  'Diabetes Daily Check-In',
  'Diabetes wellness check-in — stub, activates v3.2',
  '[
    {"id":"q_glucose",  "text":"What is your blood glucose reading?",            "type":"number",  "intent":"glucose",          "unit":"mg/dL"},
    {"id":"q_insulin",  "text":"Did you take your insulin today?",               "type":"boolean", "intent":"medications"},
    {"id":"q_hypo",     "text":"Did you have any low blood sugar symptoms?",     "type":"boolean", "intent":"free_text_symptom"},
    {"id":"q_notes",    "text":"Anything else to share with your care team?",    "type":"text",    "intent":"free_text_symptom","optional":true}
  ]'::jsonb,
  false
) ON CONFLICT (slug) DO NOTHING;

-- CKD template (stub — inactive until v3.2)
INSERT INTO questionnaire_templates (slug, name, description, questions, active)
VALUES (
  'ckd_daily_v1',
  'CKD Daily Check-In',
  'Chronic kidney disease check-in — stub, activates v3.2',
  '[
    {"id":"q_fluid",    "text":"How much fluid have you had today?",             "type":"number",  "intent":"fluid_intake",     "unit":"oz"},
    {"id":"q_nausea",   "text":"How is your nausea today?",                      "type":"scale",   "intent":"free_text_symptom","scale_min":1,"scale_max":5},
    {"id":"q_appetite", "text":"How is your appetite today?",                    "type":"scale",   "intent":"free_text_symptom","scale_min":1,"scale_max":5},
    {"id":"q_notes",    "text":"Anything else to share with your care team?",    "type":"text",    "intent":"free_text_symptom","optional":true}
  ]'::jsonb,
  false
) ON CONFLICT (slug) DO NOTHING;

-- ─── Chatbot sessions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_id uuid REFERENCES conditions(id),
  template_id  uuid REFERENCES questionnaire_templates(id),
  status       text NOT NULL DEFAULT 'in_progress'
               CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_own_sessions" ON chatbot_sessions;
CREATE POLICY "patient_own_sessions" ON chatbot_sessions
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = auth.uid())
  );

-- ─── Check-ins (legacy write-through target) ─────────────────
CREATE TABLE IF NOT EXISTS checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES chatbot_sessions(id),
  weight_lbs      numeric,
  heart_rate      integer,
  bp_systolic     integer,
  bp_diastolic    integer,
  fatigue_score   integer,
  breathlessness  integer,
  swelling        integer,
  medications     boolean,
  free_text       text,
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_own_checkins" ON checkins;
CREATE POLICY "patient_own_checkins" ON checkins
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = auth.uid())
  );

-- ─── Observations (v3 typed data model) ──────────────────────
CREATE TABLE IF NOT EXISTS observations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_id     uuid REFERENCES conditions(id),
  session_id       uuid REFERENCES chatbot_sessions(id),
  checkin_id       uuid REFERENCES checkins(id),
  observation_type text NOT NULL,
  value_numeric    numeric,
  value_text       text,
  unit             text,
  observed_at      timestamptz NOT NULL DEFAULT now(),
  source           text NOT NULL DEFAULT 'chatbot'
                   CHECK (source IN ('chatbot', 'manual', 'device', 'lab')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_own_observations" ON observations;
CREATE POLICY "patient_own_observations" ON observations
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = auth.uid())
  );

-- ─── Symptom reports ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS symptom_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_id   uuid REFERENCES conditions(id),
  session_id     uuid REFERENCES chatbot_sessions(id),
  checkin_id     uuid REFERENCES checkins(id),
  symptom_type   text NOT NULL,
  severity_score integer CHECK (severity_score BETWEEN 1 AND 5),
  free_text      text,
  reported_at    timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE symptom_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_own_symptoms" ON symptom_reports;
CREATE POLICY "patient_own_symptoms" ON symptom_reports
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = auth.uid())
  );

-- ─── Medication regimens ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS medication_regimens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_id    uuid REFERENCES conditions(id),
  medication_name text NOT NULL,
  dose            text,
  frequency       text CHECK (frequency IN ('once_daily', 'twice_daily', 'as_needed')),
  instructions    text,
  active          boolean NOT NULL DEFAULT true,
  started_at      date,
  ended_at        date,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE medication_regimens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_own_regimens" ON medication_regimens;
CREATE POLICY "patient_own_regimens" ON medication_regimens
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = auth.uid())
  );

-- ─── Medication events ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medication_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  regimen_id   uuid REFERENCES medication_regimens(id),
  session_id   uuid REFERENCES chatbot_sessions(id),
  event_type   text NOT NULL CHECK (event_type IN ('taken', 'missed', 'side_effect')),
  scheduled_at timestamptz,
  reported_at  timestamptz NOT NULL DEFAULT now(),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE medication_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_own_med_events" ON medication_events;
CREATE POLICY "patient_own_med_events" ON medication_events
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = auth.uid())
  );

-- ─── Audit log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id),
  action     text NOT NULL,
  table_name text,
  record_id  uuid,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_insert_own" ON audit_log;
CREATE POLICY "audit_log_insert_own" ON audit_log
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_observations_patient      ON observations(patient_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_type         ON observations(observation_type);
CREATE INDEX IF NOT EXISTS idx_symptom_reports_patient   ON symptom_reports(patient_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_medication_events_patient ON medication_events(patient_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_conditions        ON patient_conditions(patient_id);
CREATE INDEX IF NOT EXISTS idx_checkins_patient          ON checkins(patient_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_patient  ON chatbot_sessions(patient_id, started_at DESC);
