# CardioTrack Foundation Design
**Date:** 2026-03-30
**Scope:** Schema + Auth + Routing (Phase 1 of v3.0 build)
**PRD Reference:** CardioTrack PRD v3.0 — Parts 1, 2, 4 (auth), 10 (file structure)

---

## 1. Architecture

Single SPA (React 19 + Vite 8 + TypeScript) with two isolated URL zones sharing one Supabase client and one auth context. Greenfield build — no v1/v2 code to migrate.

```
src/
├── api/
│   ├── supabase.ts          # Supabase client singleton
│   ├── auth.ts              # signIn, signOut, getProfile helpers
│   └── supabase.types.ts    # manual DB type definitions
│
├── contexts/
│   └── AuthContext.tsx      # session, user, profile (with role), loading
│
├── router/
│   ├── index.tsx            # all route definitions
│   └── RequireRole.tsx      # role-based route guard
│
├── admin/                   # Provider zone — /admin/*
│   ├── Login.tsx
│   ├── layout/
│   │   └── AdminLayout.tsx  # left sidebar nav + top bar
│   └── pages/
│       ├── Dashboard.tsx    # shell
│       ├── Members.tsx      # shell
│       ├── Alerts.tsx       # shell
│       ├── Backlog.tsx      # shell
│       ├── Calendar.tsx     # shell
│       ├── SlackPanel.tsx   # shell
│       └── Setup.tsx        # shell
│
├── portal/                  # Patient zone — /my-health/*
│   ├── Login.tsx
│   ├── layout/
│   │   └── PortalLayout.tsx # mobile-first bottom tab nav
│   └── pages/
│       ├── PortalHome.tsx       # shell
│       ├── PortalCheckin.tsx    # shell
│       ├── PortalTrends.tsx     # shell
│       ├── PortalAlerts.tsx     # shell
│       ├── PortalMedications.tsx # shell
│       └── PortalSettings.tsx   # shell
│
├── conditions/              # Condition modules (PRD Part 7)
│   ├── heart_failure/
│   │   └── config.ts        # active — slugs, types, alert rules
│   ├── diabetes/
│   │   └── config.ts        # stub — isActive: false
│   └── ckd/
│       └── config.ts        # stub — isActive: false
│
└── styles/
    ├── variables.css        # design tokens
    └── global.css           # resets + base typography
```

---

## 2. Database Schema

Applied as a single migration file: `supabase/migrations/001_v3_foundation.sql`

### 2.1 Profiles table (new — required for role-based auth)

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'patient' CHECK (role IN ('provider', 'patient')),
  full_name  text,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_profile" ON profiles FOR ALL USING (id = auth.uid());

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**Role assignment:** Providers are created manually (Supabase dashboard or admin script) with `role = 'provider'`. New signups default to `'patient'`.

### 2.2 Patients table

```sql
CREATE TABLE IF NOT EXISTS patients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  mrn        text,
  dob        date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patient_own_row" ON patients FOR ALL USING (profile_id = auth.uid());
```

### 2.3 PRD Part 2 tables (verbatim from PRD v3.0)

In order: `conditions`, `patient_conditions`, `observations`, `symptom_reports`, `medication_regimens`, `medication_events` — including all indexes, RLS policies, and seed data from PRD Part 2.

### 2.4 PRD Part 2.2 — questionnaire_templates updates

Tag `daily_checkin_v1` for heart failure. Insert stub templates for diabetes and CKD (inactive).

### 2.5 PRD Part 2.3 — chatbot_sessions update

```sql
ALTER TABLE chatbot_sessions
  ADD COLUMN IF NOT EXISTS condition_id uuid REFERENCES conditions(id);
```

> **Note:** `chatbot_sessions`, `questionnaire_templates`, `checkins`, `audit_log`, and `provider_patient_roster` are assumed to exist from prior Supabase project state. Migration file will use `IF NOT EXISTS` and `IF EXISTS` guards throughout.

---

## 3. Auth

### 3.1 Supabase Auth setup

- Email + password authentication
- Google OAuth: wired in `supabase.ts` but not exposed in UI this phase
- Session persisted via Supabase's built-in `localStorage` strategy

### 3.2 AuthContext

```typescript
interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null   // { id, role, full_name, email }
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}
```

- Initializes from `supabase.auth.getSession()` on mount
- Subscribes to `supabase.auth.onAuthStateChange` for session updates
- Fetches `profiles` row after session established to get `role`

### 3.3 Login pages

**AdminLogin (`/admin/login`)**
- Email + password form
- On success: if `role === 'provider'` → redirect `/admin`; if `role === 'patient'` → redirect `/my-health`
- Error states: invalid credentials, user not found

**PortalLogin (`/my-health/login`)**
- Same logic, patient-appropriate visual skin
- On success: if `role === 'patient'` → redirect `/my-health`; if `role === 'provider'` → redirect `/admin`

### 3.4 RequireRole guard

```typescript
<RequireRole role="provider" loginPath="/admin/login">
  <AdminLayout />
</RequireRole>
```

Behavior:
- `loading === true` → render full-screen spinner
- Not authenticated → redirect to `loginPath`
- Authenticated but wrong role → redirect to correct zone
- Correct role → render children

---

## 4. Routing

```
/                             → redirect to /admin/login

/admin/login                  → AdminLogin (public)
/admin/*                      → RequireRole("provider")
  /admin                      → Dashboard
  /admin/members              → Members
  /admin/alerts               → Alerts
  /admin/backlog              → Backlog
  /admin/calendar             → Calendar
  /admin/slack                → SlackPanel
  /admin/setup                → Setup

/my-health/login              → PortalLogin (public)
/my-health/*                  → RequireRole("patient")
  /my-health                  → PortalHome
  /my-health/checkin          → PortalCheckin
  /my-health/trends           → PortalTrends
  /my-health/alerts           → PortalAlerts
  /my-health/medications      → PortalMedications
  /my-health/settings         → PortalSettings
```

**AdminLayout:** Left sidebar (200px) with nav links, top bar with user info + sign out. Responsive — collapses to hamburger below 768px.

**PortalLayout:** Mobile-first. Bottom tab bar with 5 tabs: Home, Check-In, Trends, Alerts, Settings. Max-width 480px centered on desktop.

---

## 5. CSS Design System

KP.org-inspired tokens. Blues as primary, grays for neutral surfaces, red for alerts.

```css
:root {
  /* Brand */
  --color-primary:       #003087;   /* KP deep blue */
  --color-primary-light: #0066CC;
  --color-primary-hover: #002266;

  /* Neutrals */
  --color-bg:            #F5F7FA;
  --color-surface:       #FFFFFF;
  --color-border:        #D9DEE5;
  --color-text:          #1A1F36;
  --color-text-muted:    #6B7280;

  /* Status */
  --color-alert-high:    #DC2626;
  --color-alert-medium:  #D97706;
  --color-alert-low:     #2563EB;
  --color-success:       #16A34A;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-size-sm:   13px;
  --font-size-base: 15px;
  --font-size-lg:   18px;
  --font-size-xl:   22px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

---

## 6. Environment Variables

```env
VITE_SUPABASE_URL=https://wtjotacchiurbjcizdws.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_AIRTABLE_API_KEY=
VITE_SLACK_BOT_TOKEN=
VITE_SLACK_CHANNEL_ID=C04RP7X5493
VITE_GCAL_CLIENT_ID=
VITE_GCAL_API_KEY=
VITE_EPIC_BASE_URL=
VITE_TWILIO_ACCOUNT_SID=
```

`.env.local` holds real values (gitignored). `.env.example` committed to repo.

---

## 7. Dependencies to Install

```
@supabase/supabase-js    # Supabase client
react-router-dom         # routing
```

No UI component library — custom CSS variables only per PRD.

---

## 8. Out of Scope (this phase)

- Chatbot, alert engine, API modules — subsequent phases
- Google OAuth button — deferred
- PWA manifest / service worker — deferred
- All page content beyond shell `<h1>` placeholders
- Supabase migration runner — migration applied manually via dashboard SQL editor

---

## Success Criteria

- [ ] `npm run dev` starts without errors
- [ ] `/admin/login` and `/my-health/login` both render and accept credentials
- [ ] Provider login redirects to `/admin`, patient login redirects to `/my-health`
- [ ] Wrong-role access redirects correctly
- [ ] Unauthenticated access to protected routes redirects to login
- [ ] All route shells render their page name
- [ ] Migration file is syntactically valid and includes all PRD Part 2 tables