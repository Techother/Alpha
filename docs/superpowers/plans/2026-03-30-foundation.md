# CardioTrack Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the schema migration file, CSS design system, Supabase auth layer, and React Router routing with two protected zones (/admin for providers, /my-health for patients) from a blank Vite + React 19 + TypeScript scaffold.

**Architecture:** Single SPA with two URL zones sharing one Supabase client and AuthContext. Role field on `profiles` table drives post-login redirects and RequireRole route guards. No SSR — pure client-side React Router v6.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9 (strict), react-router-dom v7, @supabase/supabase-js, CSS custom properties (no UI framework)

**Spec:** `docs/superpowers/specs/2026-03-30-foundation-design.md`

---

## File Map

**New files to create:**

```
.env.example
supabase/migrations/001_v3_foundation.sql
src/styles/variables.css
src/styles/global.css
src/api/supabase.types.ts
src/api/supabase.ts
src/api/auth.ts
src/contexts/AuthContext.tsx
src/router/RequireRole.tsx
src/router/index.tsx
src/admin/Login.tsx
src/admin/layout/AdminLayout.tsx
src/admin/pages/Dashboard.tsx
src/admin/pages/Members.tsx
src/admin/pages/Alerts.tsx
src/admin/pages/Backlog.tsx
src/admin/pages/Calendar.tsx
src/admin/pages/SlackPanel.tsx
src/admin/pages/Setup.tsx
src/portal/Login.tsx
src/portal/layout/PortalLayout.tsx
src/portal/pages/PortalHome.tsx
src/portal/pages/PortalCheckin.tsx
src/portal/pages/PortalTrends.tsx
src/portal/pages/PortalAlerts.tsx
src/portal/pages/PortalMedications.tsx
src/portal/pages/PortalSettings.tsx
src/conditions/heart_failure/config.ts
src/conditions/diabetes/config.ts
src/conditions/ckd/config.ts
```

**Files to modify:**

```
vite.config.ts          — add @ path alias
src/main.tsx            — wrap app in AuthProvider + RouterProvider
src/App.tsx             — replace default template with router outlet
src/index.css           — import variables.css and global.css
index.html              — add Inter font link
```

**Files to delete:**

```
src/App.css             — replaced by global.css + variables.css
src/assets/react.svg    — unused default asset
public/vite.svg         — unused default asset
```

---

## Task 1: Install dependencies and configure path alias

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd /Users/larrygoode/cardiotrack
npm install @supabase/supabase-js react-router-dom
```

Expected output: `added N packages` with no errors.

- [ ] **Step 2: Update vite.config.ts to add @ alias**

Replace the entire file with:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Update tsconfig.app.json to recognise the alias**

Add `"baseUrl"` and `"paths"` inside `"compilerOptions"`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2023",
    "useDefineForClassFields": true,
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create .env.example**

```bash
cat > /Users/larrygoode/cardiotrack/.env.example << 'EOF'
VITE_SUPABASE_URL=https://wtjotacchiurbjcizdws.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_AIRTABLE_API_KEY=
VITE_SLACK_BOT_TOKEN=
VITE_SLACK_CHANNEL_ID=C04RP7X5493
VITE_GCAL_CLIENT_ID=
VITE_GCAL_API_KEY=
VITE_EPIC_BASE_URL=
VITE_TWILIO_ACCOUNT_SID=
EOF
```

- [ ] **Step 5: Ensure .env.local is gitignored**

```bash
grep -q ".env*.local" /Users/larrygoode/cardiotrack/.gitignore 2>/dev/null || echo ".env*.local" >> /Users/larrygoode/cardiotrack/.gitignore
```

- [ ] **Step 6: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add vite.config.ts tsconfig.app.json .env.example .gitignore package.json package-lock.json
git commit -m "chore: install supabase + react-router, add @ path alias"
```

---

## Task 2: Database migration file

**Files:**
- Create: `supabase/migrations/001_v3_foundation.sql`

- [ ] **Step 1: Create migrations directory and write the SQL file**

```bash
mkdir -p /Users/larrygoode/cardiotrack/supabase/migrations
```

Create `supabase/migrations/001_v3_foundation.sql` with the full contents below. This file is run manually in the Supabase dashboard SQL editor — it is self-contained and safe to re-run (`IF NOT EXISTS` guards throughout).

```sql
-- =============================================================
-- CardioTrack v3.0 Foundation Migration
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
    {"id":"q_weight",   "text":"What is your weight today?",                      "type":"number",  "intent":"weight",        "unit":"lbs"},
    {"id":"q_hr",       "text":"What is your resting heart rate?",                "type":"number",  "intent":"heart_rate",    "unit":"bpm"},
    {"id":"q_bp",       "text":"What is your blood pressure?",                    "type":"text",    "intent":"blood_pressure"},
    {"id":"q_breath",   "text":"How is your breathing today? (1=easy, 5=very hard)","type":"scale", "intent":"breathlessness","scale_min":1,"scale_max":5},
    {"id":"q_swelling", "text":"Any swelling in your legs or ankles?",            "type":"scale",   "intent":"swelling",      "scale_min":1,"scale_max":5},
    {"id":"q_fatigue",  "text":"How tired are you today? (1=not tired, 5=exhausted)","type":"scale","intent":"fatigue",       "scale_min":1,"scale_max":5},
    {"id":"q_meds",     "text":"Did you take all your medications today?",        "type":"boolean", "intent":"medications"},
    {"id":"q_notes",    "text":"Anything else to share with your care team?",     "type":"text",    "intent":"free_text_symptom","optional":true}
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
    {"id":"q_glucose",  "text":"What is your blood glucose reading?",             "type":"number",  "intent":"glucose",       "unit":"mg/dL"},
    {"id":"q_insulin",  "text":"Did you take your insulin today?",                "type":"boolean", "intent":"medications"},
    {"id":"q_hypo",     "text":"Did you have any low blood sugar symptoms?",      "type":"boolean", "intent":"free_text_symptom"},
    {"id":"q_notes",    "text":"Anything else to share with your care team?",     "type":"text",    "intent":"free_text_symptom","optional":true}
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
    {"id":"q_fluid",    "text":"How much fluid have you had today?",              "type":"number",  "intent":"fluid_intake",  "unit":"oz"},
    {"id":"q_nausea",   "text":"How is your nausea today?",                       "type":"scale",   "intent":"free_text_symptom","scale_min":1,"scale_max":5},
    {"id":"q_appetite", "text":"How is your appetite today?",                     "type":"scale",   "intent":"free_text_symptom","scale_min":1,"scale_max":5},
    {"id":"q_notes",    "text":"Anything else to share with your care team?",     "type":"text",    "intent":"free_text_symptom","optional":true}
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
CREATE INDEX IF NOT EXISTS idx_observations_patient     ON observations(patient_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_type        ON observations(observation_type);
CREATE INDEX IF NOT EXISTS idx_symptom_reports_patient  ON symptom_reports(patient_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_medication_events_patient ON medication_events(patient_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_conditions       ON patient_conditions(patient_id);
CREATE INDEX IF NOT EXISTS idx_checkins_patient         ON checkins(patient_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_patient ON chatbot_sessions(patient_id, started_at DESC);
```

- [ ] **Step 2: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add supabase/migrations/001_v3_foundation.sql
git commit -m "feat: add v3.0 foundation database migration"
```

---

## Task 3: CSS design system

**Files:**
- Create: `src/styles/variables.css`
- Create: `src/styles/global.css`
- Modify: `src/index.css`
- Modify: `index.html`
- Delete: `src/App.css`

- [ ] **Step 1: Add Inter font to index.html**

Replace the `<head>` section's `<title>` line — add the font link just before `</head>`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>CardioTrack</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create src/styles/variables.css**

```css
/* CardioTrack Design Tokens — KP.org inspired */
:root {
  /* ── Brand blues ───────────────────────────── */
  --color-primary:        #003087;
  --color-primary-light:  #0066CC;
  --color-primary-hover:  #002266;
  --color-primary-subtle: #E8F0FB;

  /* ── Neutrals ──────────────────────────────── */
  --color-bg:             #F5F7FA;
  --color-surface:        #FFFFFF;
  --color-surface-raised: #FFFFFF;
  --color-border:         #D9DEE5;
  --color-border-subtle:  #EAECF0;
  --color-text:           #1A1F36;
  --color-text-muted:     #6B7280;
  --color-text-faint:     #9CA3AF;

  /* ── Status ────────────────────────────────── */
  --color-alert-high:     #DC2626;
  --color-alert-high-bg:  #FEF2F2;
  --color-alert-medium:   #D97706;
  --color-alert-medium-bg:#FFFBEB;
  --color-alert-low:      #2563EB;
  --color-alert-low-bg:   #EFF6FF;
  --color-success:        #16A34A;
  --color-success-bg:     #F0FDF4;

  /* ── Condition chips ───────────────────────── */
  --color-hf:             #1D4ED8;   /* Heart Failure — blue  */
  --color-hf-bg:          #DBEAFE;
  --color-diabetes:       #7C3AED;   /* Diabetes — purple     */
  --color-diabetes-bg:    #EDE9FE;
  --color-ckd:            #0F766E;   /* CKD — teal            */
  --color-ckd-bg:         #CCFBF1;

  /* ── Spacing scale ─────────────────────────── */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* ── Typography ────────────────────────────── */
  --font-sans:       'Inter', system-ui, -apple-system, sans-serif;
  --font-size-xs:    11px;
  --font-size-sm:    13px;
  --font-size-base:  15px;
  --font-size-md:    16px;
  --font-size-lg:    18px;
  --font-size-xl:    22px;
  --font-size-2xl:   28px;
  --font-size-3xl:   36px;
  --font-weight-normal:   400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;
  --font-weight-bold:     700;
  --line-height-tight:    1.25;
  --line-height-normal:   1.5;
  --line-height-relaxed:  1.65;

  /* ── Border radius ─────────────────────────── */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;

  /* ── Shadows ───────────────────────────────── */
  --shadow-sm:  0 1px 2px rgba(0,0,0,0.05);
  --shadow-md:  0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04);
  --shadow-lg:  0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04);

  /* ── Layout ────────────────────────────────── */
  --sidebar-width:     220px;
  --topbar-height:     56px;
  --portal-max-width:  480px;
  --portal-tab-height: 60px;

  /* ── Transitions ───────────────────────────── */
  --transition-fast:   150ms ease;
  --transition-normal: 250ms ease;
}
```

- [ ] **Step 3: Create src/styles/global.css**

```css
/* CardioTrack Global Styles */
@import './variables.css';

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
  color: var(--color-text);
  background-color: var(--color-bg);
}

h1, h2, h3, h4, h5, h6 {
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  color: var(--color-text);
}

h1 { font-size: var(--font-size-2xl); }
h2 { font-size: var(--font-size-xl); }
h3 { font-size: var(--font-size-lg); }
h4 { font-size: var(--font-size-md); }

p { line-height: var(--line-height-relaxed); }

a {
  color: var(--color-primary-light);
  text-decoration: none;
}

a:hover { text-decoration: underline; }

button {
  font-family: var(--font-sans);
  cursor: pointer;
  border: none;
  background: none;
}

input, textarea, select {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
}

/* ── Utility classes ──────────────────────────────────── */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
  cursor: pointer;
  border: none;
}

.btn-primary {
  background-color: var(--color-primary);
  color: #fff;
}

.btn-primary:hover { background-color: var(--color-primary-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-ghost {
  background-color: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.btn-ghost:hover { background-color: var(--color-border-subtle); }

.card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.form-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background-color: var(--color-surface);
  width: 100%;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-light);
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.15);
}

.form-error {
  font-size: var(--font-size-sm);
  color: var(--color-alert-high);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.badge-hf        { background: var(--color-hf-bg);       color: var(--color-hf); }
.badge-diabetes  { background: var(--color-diabetes-bg);  color: var(--color-diabetes); }
.badge-ckd       { background: var(--color-ckd-bg);       color: var(--color-ckd); }

/* ── Spinner ──────────────────────────────────────────── */
@keyframes spin { to { transform: rotate(360deg); } }

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-fullscreen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
```

- [ ] **Step 4: Replace src/index.css**

```css
@import './styles/global.css';
```

- [ ] **Step 5: Delete unused default files**

```bash
rm /Users/larrygoode/cardiotrack/src/App.css
rm /Users/larrygoode/cardiotrack/src/assets/react.svg
rm /Users/larrygoode/cardiotrack/public/vite.svg
```

- [ ] **Step 6: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add index.html src/index.css src/styles/variables.css src/styles/global.css
git rm src/App.css src/assets/react.svg public/vite.svg
git commit -m "feat: add KP-inspired CSS design token system"
```

---

## Task 4: Supabase types and client

**Files:**
- Create: `src/api/supabase.types.ts`
- Create: `src/api/supabase.ts`
- Create: `src/api/auth.ts`

- [ ] **Step 1: Create src/api/supabase.types.ts**

```typescript
// Manual type definitions for CardioTrack v3 database schema

export type Role = 'provider' | 'patient'

export interface Profile {
  id: string
  role: Role
  full_name: string | null
  email: string | null
  created_at: string
}

export interface Patient {
  id: string
  profile_id: string
  mrn: string | null
  dob: string | null
  created_at: string
}

export interface Condition {
  id: string
  slug: 'heart_failure' | 'diabetes' | 'ckd'
  name: string
  description: string | null
  active: boolean
  created_at: string
}

export interface PatientCondition {
  patient_id: string
  condition_id: string
  diagnosed_at: string | null
  severity: 'mild' | 'moderate' | 'severe' | null
  primary_condition: boolean
  active: boolean
  created_at: string
}

export interface Observation {
  id: string
  patient_id: string
  condition_id: string | null
  session_id: string | null
  checkin_id: string | null
  observation_type: string
  value_numeric: number | null
  value_text: string | null
  unit: string | null
  observed_at: string
  source: 'chatbot' | 'manual' | 'device' | 'lab'
  created_at: string
}

export interface SymptomReport {
  id: string
  patient_id: string
  condition_id: string | null
  session_id: string | null
  checkin_id: string | null
  symptom_type: string
  severity_score: number | null
  free_text: string | null
  reported_at: string
  created_at: string
}

export interface MedicationRegimen {
  id: string
  patient_id: string
  condition_id: string | null
  medication_name: string
  dose: string | null
  frequency: 'once_daily' | 'twice_daily' | 'as_needed' | null
  instructions: string | null
  active: boolean
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface MedicationEvent {
  id: string
  patient_id: string
  regimen_id: string | null
  session_id: string | null
  event_type: 'taken' | 'missed' | 'side_effect'
  scheduled_at: string | null
  reported_at: string
  notes: string | null
  created_at: string
}

export interface QuestionnaireTemplate {
  id: string
  slug: string
  name: string
  description: string | null
  questions: Question[]
  active: boolean
  created_at: string
}

export interface Question {
  id: string
  text: string
  type: 'number' | 'text' | 'boolean' | 'scale'
  intent: string
  unit?: string
  scale_min?: number
  scale_max?: number
  optional?: boolean
}

export interface ChatbotSession {
  id: string
  patient_id: string
  condition_id: string | null
  template_id: string | null
  status: 'in_progress' | 'completed' | 'abandoned'
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface Checkin {
  id: string
  patient_id: string
  session_id: string | null
  weight_lbs: number | null
  heart_rate: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  fatigue_score: number | null
  breathlessness: number | null
  swelling: number | null
  medications: boolean | null
  free_text: string | null
  checked_in_at: string
  created_at: string
}
```

- [ ] **Step 2: Create src/api/supabase.ts**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 3: Create src/api/auth.ts**

```typescript
import { supabase } from './supabase'
import type { Profile } from './supabase.types'

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('getProfile error:', error.message)
    return null
  }

  return data as Profile
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack
npx tsc --noEmit
```

Expected: no errors. If you see errors about missing env vars at runtime, that's fine — the throw only fires at runtime, not at compile time.

- [ ] **Step 5: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/api/supabase.types.ts src/api/supabase.ts src/api/auth.ts
git commit -m "feat: add Supabase client, types, and auth helpers"
```

---

## Task 5: AuthContext

**Files:**
- Create: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Create src/contexts/AuthContext.tsx**

```typescript
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/api/supabase'
import { signIn as apiSignIn, signOut as apiSignOut, getProfile } from '@/api/auth'
import type { Profile } from '@/api/supabase.types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const p = await getProfile(session.user.id)
        setProfile(p)
      }
      setLoading(false)
    })

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          const p = await getProfile(session.user.id)
          setProfile(p)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await apiSignIn(email, password)
    return { error }
  }

  async function signOut() {
    await apiSignOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/contexts/AuthContext.tsx
git commit -m "feat: add AuthContext with session, profile, and role"
```

---

## Task 6: Router and RequireRole guard

**Files:**
- Create: `src/router/RequireRole.tsx`
- Create: `src/router/index.tsx`

- [ ] **Step 1: Create src/router/RequireRole.tsx**

```typescript
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Role } from '@/api/supabase.types'

interface RequireRoleProps {
  role: Role
  loginPath: string
  children: ReactNode
}

export function RequireRole({ role, loginPath, children }: RequireRoleProps) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="spinner-fullscreen">
        <div className="spinner" />
      </div>
    )
  }

  if (!session || !profile) {
    return <Navigate to={loginPath} replace />
  }

  // Authenticated but wrong zone — redirect to correct zone
  if (profile.role !== role) {
    const redirect = profile.role === 'provider' ? '/admin' : '/my-health'
    return <Navigate to={redirect} replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Create src/router/index.tsx**

```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AdminLogin } from '@/admin/Login'
import { AdminLayout } from '@/admin/layout/AdminLayout'
import { Dashboard } from '@/admin/pages/Dashboard'
import { Members } from '@/admin/pages/Members'
import { Alerts } from '@/admin/pages/Alerts'
import { Backlog } from '@/admin/pages/Backlog'
import { Calendar } from '@/admin/pages/Calendar'
import { SlackPanel } from '@/admin/pages/SlackPanel'
import { Setup } from '@/admin/pages/Setup'

import { PortalLogin } from '@/portal/Login'
import { PortalLayout } from '@/portal/layout/PortalLayout'
import { PortalHome } from '@/portal/pages/PortalHome'
import { PortalCheckin } from '@/portal/pages/PortalCheckin'
import { PortalTrends } from '@/portal/pages/PortalTrends'
import { PortalAlerts } from '@/portal/pages/PortalAlerts'
import { PortalMedications } from '@/portal/pages/PortalMedications'
import { PortalSettings } from '@/portal/pages/PortalSettings'

import { RequireRole } from './RequireRole'

export const router = createBrowserRouter([
  // Root → admin login
  {
    path: '/',
    element: <Navigate to="/admin/login" replace />,
  },

  // ── Admin zone ─────────────────────────────
  {
    path: '/admin/login',
    element: <AdminLogin />,
  },
  {
    path: '/admin',
    element: (
      <RequireRole role="provider" loginPath="/admin/login">
        <AdminLayout />
      </RequireRole>
    ),
    children: [
      { index: true,          element: <Dashboard /> },
      { path: 'members',      element: <Members /> },
      { path: 'alerts',       element: <Alerts /> },
      { path: 'backlog',      element: <Backlog /> },
      { path: 'calendar',     element: <Calendar /> },
      { path: 'slack',        element: <SlackPanel /> },
      { path: 'setup',        element: <Setup /> },
    ],
  },

  // ── Portal zone ────────────────────────────
  {
    path: '/my-health/login',
    element: <PortalLogin />,
  },
  {
    path: '/my-health',
    element: (
      <RequireRole role="patient" loginPath="/my-health/login">
        <PortalLayout />
      </RequireRole>
    ),
    children: [
      { index: true,           element: <PortalHome /> },
      { path: 'checkin',       element: <PortalCheckin /> },
      { path: 'trends',        element: <PortalTrends /> },
      { path: 'alerts',        element: <PortalAlerts /> },
      { path: 'medications',   element: <PortalMedications /> },
      { path: 'settings',      element: <PortalSettings /> },
    ],
  },
])
```

- [ ] **Step 3: Verify TypeScript compiles (will fail until page shells exist — that's expected)**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors about missing module imports (pages not yet created). This is fine — compilation will pass after Task 7 and 8.

- [ ] **Step 4: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/router/RequireRole.tsx src/router/index.tsx
git commit -m "feat: add role-based router and RequireRole guard"
```

---

## Task 7: Admin login, layout, and page shells

**Files:**
- Create: `src/admin/Login.tsx`
- Create: `src/admin/layout/AdminLayout.tsx`
- Create: `src/admin/pages/Dashboard.tsx`
- Create: `src/admin/pages/Members.tsx`
- Create: `src/admin/pages/Alerts.tsx`
- Create: `src/admin/pages/Backlog.tsx`
- Create: `src/admin/pages/Calendar.tsx`
- Create: `src/admin/pages/SlackPanel.tsx`
- Create: `src/admin/pages/Setup.tsx`

- [ ] **Step 1: Create src/admin/Login.tsx**

```typescript
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function AdminLogin() {
  const { signIn, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // If already authenticated, redirect to correct zone
  if (!loading && profile) {
    const dest = profile.role === 'provider' ? '/admin' : '/my-health'
    navigate(dest, { replace: true })
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    // onAuthStateChange in AuthContext will update profile;
    // navigate after profile loads (handled by the guard above on re-render)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary)',
            marginBottom: 'var(--space-4)',
          }}>
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>C</span>
          </div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-1)' }}>
            CardioTrack
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Care Coordinator Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="coordinator@clinic.org"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)' }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{
          marginTop: 'var(--space-6)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-faint)',
          textAlign: 'center',
        }}>
          Patient? Go to{' '}
          <a href="/my-health/login">your health portal</a>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create src/admin/layout/AdminLayout.tsx**

```typescript
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/admin',          label: 'Dashboard',  end: true },
  { to: '/admin/members',  label: 'Members',    end: false },
  { to: '/admin/alerts',   label: 'Alerts',     end: false },
  { to: '/admin/backlog',  label: 'Backlog',    end: false },
  { to: '/admin/calendar', label: 'Calendar',   end: false },
  { to: '/admin/slack',    label: 'Slack',      end: false },
  { to: '/admin/setup',    label: 'Setup',      end: false },
]

export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-width)',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: 'var(--space-6) var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0,
            }}>C</div>
            <span style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-md)' }}>
              CardioTrack
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: 'var(--space-4) var(--space-2)', overflow: 'auto' }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'block',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                background: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                textDecoration: 'none',
                marginBottom: 'var(--space-1)',
                transition: 'background var(--transition-fast), color var(--transition-fast)',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
            {profile?.email ?? ''}
          </p>
          <button className="btn btn-ghost" style={{ width: '100%', fontSize: 'var(--font-size-xs)' }} onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        marginLeft: 'var(--sidebar-width)',
        flex: 1,
        padding: 'var(--space-8)',
        minHeight: '100vh',
      }}>
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create all admin page shells**

Create each file with the exact content shown. All are identical in structure, differing only in the page name.

`src/admin/pages/Dashboard.tsx`:
```typescript
export function Dashboard() {
  return <h1>Dashboard</h1>
}
```

`src/admin/pages/Members.tsx`:
```typescript
export function Members() {
  return <h1>Members</h1>
}
```

`src/admin/pages/Alerts.tsx`:
```typescript
export function Alerts() {
  return <h1>Alerts</h1>
}
```

`src/admin/pages/Backlog.tsx`:
```typescript
export function Backlog() {
  return <h1>Backlog</h1>
}
```

`src/admin/pages/Calendar.tsx`:
```typescript
export function Calendar() {
  return <h1>Calendar</h1>
}
```

`src/admin/pages/SlackPanel.tsx`:
```typescript
export function SlackPanel() {
  return <h1>Slack</h1>
}
```

`src/admin/pages/Setup.tsx`:
```typescript
export function Setup() {
  return <h1>Setup</h1>
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: only errors about missing portal imports (portal not yet created). Admin zone should be clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/admin/
git commit -m "feat: add admin login, sidebar layout, and page shells"
```

---

## Task 8: Portal login, layout, and page shells

**Files:**
- Create: `src/portal/Login.tsx`
- Create: `src/portal/layout/PortalLayout.tsx`
- Create: `src/portal/pages/PortalHome.tsx`
- Create: `src/portal/pages/PortalCheckin.tsx`
- Create: `src/portal/pages/PortalTrends.tsx`
- Create: `src/portal/pages/PortalAlerts.tsx`
- Create: `src/portal/pages/PortalMedications.tsx`
- Create: `src/portal/pages/PortalSettings.tsx`

- [ ] **Step 1: Create src/portal/Login.tsx**

```typescript
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function PortalLogin() {
  const { signIn, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && profile) {
    const dest = profile.role === 'patient' ? '/my-health' : '/admin'
    navigate(dest, { replace: true })
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: 'var(--space-4)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 'var(--portal-max-width)' }}>
        <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-hf-bg)',
            marginBottom: 'var(--space-4)',
          }}>
            <span style={{ color: 'var(--color-hf)', fontSize: 22 }}>♥</span>
          </div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-1)' }}>
            My Health Portal
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Sign in to track your wellness
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@email.com"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)' }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{
          marginTop: 'var(--space-6)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-faint)',
          textAlign: 'center',
          lineHeight: 'var(--line-height-relaxed)',
        }}>
          CardioTrack is a wellness tracking tool. It is not a medical device and does not provide medical advice.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create src/portal/layout/PortalLayout.tsx**

```typescript
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const TAB_ITEMS = [
  { to: '/my-health',              label: 'Home',       icon: '🏠', end: true },
  { to: '/my-health/checkin',      label: 'Check-In',   icon: '✓',  end: false },
  { to: '/my-health/trends',       label: 'Trends',     icon: '📈', end: false },
  { to: '/my-health/alerts',       label: 'Alerts',     icon: '🔔', end: false },
  { to: '/my-health/settings',     label: 'Settings',   icon: '⚙',  end: false },
]

export function PortalLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/my-health/login', { replace: true })
  }

  return (
    <div style={{
      maxWidth: 'var(--portal-max-width)',
      margin: '0 auto',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      background: 'var(--color-bg)',
    }}>
      {/* Top bar */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ color: 'var(--color-hf)', fontSize: 18 }}>♥</span>
          <span style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-md)', color: 'var(--color-primary)' }}>
            My Health
          </span>
        </div>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-3)' }}
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </header>

      {/* Page content */}
      <main style={{
        flex: 1,
        padding: 'var(--space-4)',
        paddingBottom: 'calc(var(--portal-tab-height) + var(--space-4))',
        overflowY: 'auto',
      }}>
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 'var(--portal-max-width)',
        height: 'var(--portal-tab-height)',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        zIndex: 10,
      }}>
        {TAB_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              textDecoration: 'none',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-faint)',
              fontSize: 9,
              fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
              transition: 'color var(--transition-fast)',
            })}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
```

- [ ] **Step 3: Create all portal page shells**

`src/portal/pages/PortalHome.tsx`:
```typescript
export function PortalHome() {
  return <h1>My Health</h1>
}
```

`src/portal/pages/PortalCheckin.tsx`:
```typescript
export function PortalCheckin() {
  return <h1>Daily Check-In</h1>
}
```

`src/portal/pages/PortalTrends.tsx`:
```typescript
export function PortalTrends() {
  return <h1>My Trends</h1>
}
```

`src/portal/pages/PortalAlerts.tsx`:
```typescript
export function PortalAlerts() {
  return <h1>My Alerts</h1>
}
```

`src/portal/pages/PortalMedications.tsx`:
```typescript
export function PortalMedications() {
  return <h1>My Medications</h1>
}
```

`src/portal/pages/PortalSettings.tsx`:
```typescript
export function PortalSettings() {
  return <h1>Settings</h1>
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/portal/
git commit -m "feat: add portal login, tab layout, and page shells"
```

---

## Task 9: Condition module configs

**Files:**
- Create: `src/conditions/heart_failure/config.ts`
- Create: `src/conditions/diabetes/config.ts`
- Create: `src/conditions/ckd/config.ts`

- [ ] **Step 1: Create src/conditions/heart_failure/config.ts**

```typescript
export const CONDITION_SLUG = 'heart_failure' as const
export const CHATBOT_TEMPLATE = 'daily_checkin_v1'
export const STATUS_LABEL = 'Active — v3.0'
export const isActive = true

export const OBSERVATION_TYPES = [
  'weight_lbs',
  'heart_rate',
  'bp_systolic',
  'bp_diastolic',
  'fatigue_score',
] as const

export const SYMPTOM_TYPES = [
  'breathlessness',
  'swelling',
] as const

export const ALERT_RULES = [
  { observation_type: 'weight_lbs',   rule: 'delta_3day',  threshold: 2,   alert_type: 'weight_gain',          severity: 'high' },
  { observation_type: 'heart_rate',   rule: 'value_above', threshold: 100, alert_type: 'abnormal_hr',          severity: 'high' },
  { observation_type: 'heart_rate',   rule: 'value_below', threshold: 50,  alert_type: 'abnormal_hr',          severity: 'high' },
  { symptom_type: 'breathlessness',   rule: 'score_gte',   threshold: 4,   alert_type: 'high_breathlessness',  severity: 'high' },
  { symptom_type: 'swelling',         rule: 'score_gte',   threshold: 4,   alert_type: 'high_swelling',        severity: 'medium' },
  { event_type: 'missed_checkin',     rule: 'daily',       threshold: 1,   alert_type: 'missed_checkin',       severity: 'medium' },
  { event_type: 'medications_missed', rule: 'session',     threshold: 1,   alert_type: 'missed_medications',   severity: 'medium' },
] as const

export const PATIENT_COPY = {
  conditionLabel: 'Heart Failure',
  weightUnit: 'lbs',
  weightWarning: 'Contact your care team if your weight increases by 2 or more pounds in 3 days.',
  disclaimer: 'CardioTrack is a wellness tracking tool. It does not provide medical advice.',
} as const
```

- [ ] **Step 2: Create src/conditions/diabetes/config.ts**

```typescript
export const CONDITION_SLUG = 'diabetes' as const
export const CHATBOT_TEMPLATE = 'diabetes_daily_v1'
export const STATUS_LABEL = 'Roadmap — v3.2'
export const isActive = false

export const OBSERVATION_TYPES = [] as const
export const SYMPTOM_TYPES = [] as const
export const ALERT_RULES = [] as const
export const PATIENT_COPY = {} as const
```

- [ ] **Step 3: Create src/conditions/ckd/config.ts**

```typescript
export const CONDITION_SLUG = 'ckd' as const
export const CHATBOT_TEMPLATE = 'ckd_daily_v1'
export const STATUS_LABEL = 'Roadmap — v3.2'
export const isActive = false

export const OBSERVATION_TYPES = [] as const
export const SYMPTOM_TYPES = [] as const
export const ALERT_RULES = [] as const
export const PATIENT_COPY = {} as const
```

- [ ] **Step 4: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/conditions/
git commit -m "feat: add condition module configs (HF active, diabetes/CKD stub)"
```

---

## Task 10: Wire up App.tsx and main.tsx, smoke test

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Replace src/App.tsx**

```typescript
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'

export default function App() {
  return <RouterProvider router={router} />
}
```

- [ ] **Step 2: Replace src/main.tsx**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/contexts/AuthContext'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
```

- [ ] **Step 3: Full TypeScript compile check**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: **zero errors**. Fix any type errors before proceeding.

- [ ] **Step 4: Build check**

```bash
cd /Users/larrygoode/cardiotrack && npm run build 2>&1 | tail -20
```

Expected: `✓ built in Xs` with no errors. If you see `VITE_SUPABASE_ANON_KEY` missing at runtime, that's a runtime concern — the build itself should succeed.

> **Note:** To run locally you need a `.env.local` file. Copy `.env.example` to `.env.local` and fill in at minimum `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase dashboard. The `supabase.ts` guard will throw at runtime if these are missing.

- [ ] **Step 5: Start dev server and verify**

```bash
cd /Users/larrygoode/cardiotrack && npm run dev
```

Manual verification checklist:
- [ ] `http://localhost:5173/` → redirects to `/admin/login`
- [ ] `/admin/login` → renders login form with CardioTrack branding
- [ ] `/my-health/login` → renders login form with "My Health Portal" heading
- [ ] `/admin` (unauthenticated) → redirects to `/admin/login`
- [ ] `/my-health` (unauthenticated) → redirects to `/my-health/login`
- [ ] Sign in as a provider user → redirects to `/admin`, sidebar renders
- [ ] Sidebar nav links work: Dashboard, Members, Alerts, etc. all render their `<h1>`
- [ ] Sign in as a patient user → redirects to `/my-health`, bottom tabs render
- [ ] Bottom tab links work: Home, Check-In, Trends, Alerts, Settings all render
- [ ] Sign out from admin → redirects to `/admin/login`
- [ ] Sign out from portal → redirects to `/my-health/login`
- [ ] Provider trying `/my-health` → redirected to `/admin`
- [ ] Patient trying `/admin` → redirected to `/my-health`

- [ ] **Step 6: Final commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/App.tsx src/main.tsx
git commit -m "feat: wire up RouterProvider and AuthProvider — foundation complete"
```

---

## Self-Review

**Spec coverage:**
- [x] Section 1 (Architecture) — Task 1 sets up project structure and aliases
- [x] Section 2 (Database schema) — Task 2 covers all tables: profiles, patients, conditions, patient_conditions, questionnaire_templates, chatbot_sessions, checkins, observations, symptom_reports, medication_regimens, medication_events, audit_log
- [x] Section 3 (Auth flow) — Tasks 4+5 cover Supabase client, auth helpers, AuthContext with session/profile/role/loading
- [x] Section 3.3+3.4 (Login pages) — Task 7 (AdminLogin) and Task 8 (PortalLogin) with role-based redirect on success and wrong-zone redirect
- [x] Section 3.4 (RequireRole) — Task 6: loading spinner, unauthenticated redirect, wrong-role redirect
- [x] Section 4 (Routing) — Task 6 router covers all routes from the design
- [x] Section 5 (CSS) — Task 3 covers all design tokens and global utilities
- [x] Section 6 (Environment variables) — Task 1 creates .env.example with all vars from PRD Part 9
- [x] Section 7 (Condition modules) — Task 9 creates all three configs

**Placeholder scan:** No TBDs or TODOs. Every step has concrete code. Page shells are intentionally minimal (one `<h1>`) — that's the spec.

**Type consistency:**
- `Profile` type defined in `supabase.types.ts`, used in `AuthContext.tsx` and `auth.ts` — consistent
- `Role` type (`'provider' | 'patient'`) defined in `supabase.types.ts`, used in `RequireRole.tsx` — consistent
- `useAuth()` returns `profile: Profile | null` — `RequireRole` checks `profile.role` — consistent
- `signIn` returns `{ error: AuthError | null }` in both `auth.ts` and `AuthContext` — consistent
- Router imports match exported names: `AdminLogin`, `PortalLogin`, `AdminLayout`, `PortalLayout`, all page shells — verified
