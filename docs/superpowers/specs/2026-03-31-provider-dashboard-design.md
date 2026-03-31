# Provider Dashboard — Design Spec
**Date:** 2026-03-31  
**Sub-project:** B — Provider Dashboard  
**Status:** Approved

---

## Overview

Build out the three provider-facing shell pages that currently render `<h1>` placeholders:
- **Dashboard** — summary stat tiles + recent alerts feed
- **Members** — patient roster with master-detail panel and search
- **Alerts** — full alert list with severity filter tabs

All pages are read-only. No alert dismissal, no note-taking, no mutations.

---

## Scope

**In scope:**
- 4 stat tiles on Dashboard (active patients, check-ins today, unreviewed alerts, alerts this week)
- Recent alerts feed on Dashboard (last 5, links to Alerts page)
- Patient list with name search on Members
- Master-detail panel on Members: latest vitals + recent alerts per patient
- Cross-page navigation: clicking a patient name in Alerts pre-selects them in Members
- Severity filter tabs on Alerts (All / High / Medium / Low)
- Chronological alerts table with patient name, alert type, severity, timestamp

**Out of scope:**
- Alert dismissal / acknowledgement (future sub-project)
- Trend sparklines / charts (future sub-project)
- Patient detail route (`/admin/members/:id`) — detail is inline panel only
- Pagination (last 30 days window is sufficient for MVP)

---

## Architecture

### New file: `src/api/admin.ts`

All provider-side Supabase queries. Four exported async functions. No business logic — pure data fetching, typed returns, silent-fail on individual query errors.

### Modified pages (shells → real components)

- `src/admin/pages/Dashboard.tsx`
- `src/admin/pages/Members.tsx`
- `src/admin/pages/Alerts.tsx`

### New types in `src/api/supabase.types.ts`

```typescript
export interface AdminStats {
  activePatients: number
  checkinsToday: number
  unreviewedAlerts: number
  alertsThisWeek: number
}

export interface PatientRosterRow {
  id: string            // patient.id
  name: string          // profiles.full_name
  conditionName: string // conditions.name
  conditionSlug: string // conditions.slug
  lastCheckinAt: string | null
  openAlertCount: number
}

export interface PatientDetail {
  latestCheckin: Checkin | null
  recentAlerts: AlertRow[]
}

export interface AlertWithPatient extends AlertRow {
  patientName: string
}
```

### No new routes

Members detail is inline state (`selectedPatientId`). No `/admin/members/:id` URL.

---

## Data Layer — `src/api/admin.ts`

### `getAdminStats()`

Returns `{ activePatients: number, checkinsToday: number, unreviewedAlerts: number, alertsThisWeek: number }`.

Four parallel Supabase queries:
1. `patients` — count all rows (all enrolled = active)
2. `checkins` — count where `checked_in_at >= today midnight UTC`
3. `alerts` — count where `created_at >= today midnight UTC` (proxy for unreviewed — read-only system has no reviewed/unreviewed state)
4. `alerts` — count where `created_at >= 7 days ago`

On any query error, the failed field returns `0` (never throws).

### `getPatientRoster()`

Returns `PatientRosterRow[]` ordered by `lastCheckinAt` descending (nulls last).

Single query joining: `patients` → `profiles` (full_name via `profile_id`) → `patient_conditions` (active, primary) → `conditions` (name, slug).

For each patient row, includes count of their `alerts` rows in the last 30 days as `openAlertCount`.

### `getPatientDetail(patientId: string)`

Returns `{ latestCheckin: Checkin | null, recentAlerts: AlertRow[] }`.

Two sequential queries:
1. Most recent `checkins` row for this patient — all vital fields (weight_lbs, heart_rate, bp_systolic, bp_diastolic, breathlessness, swelling, fatigue_score, medications)
2. Last 5 `alerts` for this patient ordered by `created_at` desc

Returns `{ latestCheckin: null, recentAlerts: [] }` on error (never throws).

### `getAlerts(severity?: 'high' | 'medium' | 'low')`

Returns `AlertWithPatient[]` — last 30 days, ordered newest first.

Queries `alerts` joined to `patients` → `profiles` for `full_name`. Optional `.eq('severity', severity)` when filter is provided.

Returns `[]` on error (never throws).

---

## Components

### Dashboard.tsx

```
State: stats: AdminStats | null, recentAlerts: AlertWithPatient[], loading, error
```

On mount: parallel `getAdminStats()` + `getAlerts()`. The full 30-day alerts array is fetched; the recent alerts feed displays only the first 5 rows (`.slice(0, 5)` client-side — no extra query needed).

**Layout:** Page title (time-of-day greeting + provider name + date) → 4-column stat tile grid → recent alerts card. Greeting: "Good morning" before 12pm, "Good afternoon" 12–5pm, "Good evening" after 5pm. Provider name from `profile.full_name` (fallback: "Doctor").

**Stat tiles:** 4-column CSS grid using design tokens. Unreviewed alerts tile uses `--color-alert-high` / `--color-alert-high-bg` when count > 0, neutral otherwise.

**Recent alerts card:** 5 rows max. Each row: severity badge + alert description + patient name + relative time. "View all →" link to `/admin/alerts`. If 0 alerts: "No alerts today."

### Members.tsx

```
State: roster: PatientRosterRow[], filtered: PatientRosterRow[], 
       selectedId: string | null, detail: PatientDetail | null,
       search: string, rosterLoading, detailLoading, error
```

On mount: `getPatientRoster()`. Also reads `?patient=<id>` search param — if present, sets `selectedId` and fetches detail immediately.

**Client-side search:** `filtered = roster.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))`. No Supabase calls on search.

**Layout:** Fixed 240px left column (search input + patient rows) + flex-1 detail panel.

**Patient row:** Name (bold if selected) + condition chip + last check-in relative time + alert count badge (red, hidden if 0). Selected row: `--color-primary-subtle` background + left border `--color-primary`.

**Detail panel — patient selected:** Avatar initials circle + name + condition chip + MRN + DOB + last check-in time → 2-row vitals grid (3 tiles each row) → recent alerts list.

**Vitals grid row 1:** Weight (lbs) / Blood Pressure (systolic/diastolic mmHg) / Heart Rate (bpm)  
**Vitals grid row 2:** Breathlessness (N/5) / Swelling (N/5) / Fatigue (N/5)  
Null vitals render as `—`.

**Detail panel — nothing selected:** Centered empty state: "Select a patient to view their details."

### Alerts.tsx

```
State: allAlerts: AlertWithPatient[], severityFilter: 'high'|'medium'|'low'|null, loading, error
```

On mount: `getAlerts()` (no filter — load all, derive counts client-side). Filtering is client-side: `severityFilter === null ? allAlerts : allAlerts.filter(a => a.severity === severityFilter)`.

**Filter tabs:** Static array `[null, 'high', 'medium', 'low']` rendered as pill tabs. Each shows label + count derived from `allAlerts`. Active tab: dark background + white text. Inactive: colored text matching severity token.

**Table:** 4 columns — Severity badge / Alert description / Patient name / Timestamp.
- Severity badge: colored pill using alert token variables
- Alert description: human-readable label derived from `alert_type` (e.g. `weight_gain` → "Weight gain above baseline")
- Patient name: `<button>` styled as link — navigates to `/admin/members?patient=<patientId>`
- Timestamp: absolute date if > 24h ago, relative ("Today 9:14am") if within today

**Alert type labels:**
| `alert_type` | Display label |
|---|---|
| `weight_gain` | Weight gain above baseline |
| `abnormal_hr` | Abnormal heart rate |
| `high_breathlessness` | High breathlessness score |
| `high_swelling` | High swelling score |
| `missed_medications` | Missed medications |

---

## Cross-Page Navigation

Alerts → Members: clicking a patient name calls `navigate('/admin/members?patient=<patientId>')`.

Members: on mount, reads `useSearchParams`. If `?patient=<id>` present, sets `selectedId` to that value and fires `getPatientDetail()`.

---

## Loading & Error States

**Loading:** Stat tiles show muted placeholder blocks. Patient list and alerts table show 3–5 skeleton rows (same height as real rows, `--color-border-subtle` background, no content). Detail panel shows skeleton blocks for vitals and alerts.

**Errors:** Inline message below page title — "Could not load data. Try refreshing." Stat tiles that fail show `—`.

**Empty states:**
- No patients: "No patients enrolled yet."
- No alerts for filter: "No [severity] alerts in the last 30 days."
- Patient with no check-ins: vitals show `—`, alerts section shows "No recent alerts."
- Search matches nothing: "No patients match your search."

---

## Design Tokens

All styling uses existing CSS variables from `src/styles/variables.css`. No new tokens needed. Relevant variables:

- Severity: `--color-alert-high`, `--color-alert-high-bg`, `--color-alert-medium`, `--color-alert-medium-bg`, `--color-alert-low`, `--color-alert-low-bg`
- Condition chips: `--color-hf`, `--color-hf-bg` (heart failure)
- Surface: `--color-surface`, `--color-bg`, `--color-border`, `--color-border-subtle`
- Text: `--color-text`, `--color-text-muted`, `--color-text-faint`

---

## What's Not Designed Here

- **Alert acknowledgement** — requires adding `reviewed_at` / `reviewed_by` to the alerts table. Separate sub-project.
- **Trend charts** — weight/vitals sparklines in patient detail. Requires charting library. Separate sub-project.
- **Pagination** — 30-day window assumed sufficient. Add if patient list exceeds ~100 rows.
- **Real-time updates** — Supabase Realtime subscriptions for live alert badge counts. Future enhancement.
