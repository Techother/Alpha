# Provider Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three `<h1>` placeholder pages (Dashboard, Members, Alerts) with fully functional read-only provider views backed by live Supabase data.

**Architecture:** New `src/api/admin.ts` provides four typed query functions. The three page components consume those functions and own all local state. No new routes — Members detail is inline state. Cross-page navigation uses `?patient=<id>` URL search params.

**Tech Stack:** React 19, TypeScript 5.9 strict, Supabase JS v2, React Router v7, CSS custom properties (no UI framework). No test runner — TypeScript compilation (`tsc --noEmit`) is the verification step for data layer tasks; `npm run dev` browser checks for UI tasks.

---

### Task 1: Add provider-dashboard types to supabase.types.ts

**Files:**
- Modify: `src/api/supabase.types.ts`

- [ ] **Step 1: Append four new interfaces to the end of `src/api/supabase.types.ts`**

Open [src/api/supabase.types.ts](src/api/supabase.types.ts) and append after the last `export interface AlertInsert` block:

```typescript
export interface AdminStats {
  activePatients: number
  checkinsToday: number
  unreviewedAlerts: number
  alertsThisWeek: number
}

export interface PatientRosterRow {
  id: string            // patients.id
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/api/supabase.types.ts
git commit -m "feat: add provider dashboard types to supabase.types.ts"
```

---

### Task 2: Create src/api/admin.ts with four query functions

**Files:**
- Create: `src/api/admin.ts`

This file contains all provider-side Supabase queries. Each function silently fails (returns a safe default, never throws) so page errors are contained.

- [ ] **Step 1: Create `src/api/admin.ts`**

```typescript
import { supabase } from './supabase'
import type {
  AdminStats,
  PatientRosterRow,
  PatientDetail,
  AlertWithPatient,
  AlertRow,
  Checkin,
} from './supabase.types'

// ── getAdminStats ──────────────────────────────────────────────────────────
// Four parallel count queries. Any failed query returns 0.

export async function getAdminStats(): Promise<AdminStats> {
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const todayISO = todayMidnight.toISOString()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  const [patientsRes, checkinsRes, unreviewedRes, weekAlertsRes] = await Promise.allSettled([
    supabase.from('patients').select('id', { count: 'exact', head: true }),
    supabase.from('checkins').select('id', { count: 'exact', head: true }).gte('checked_in_at', todayISO),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgoISO),
  ])

  return {
    activePatients:   patientsRes.status   === 'fulfilled' ? (patientsRes.value.count   ?? 0) : 0,
    checkinsToday:    checkinsRes.status    === 'fulfilled' ? (checkinsRes.value.count   ?? 0) : 0,
    unreviewedAlerts: unreviewedRes.status  === 'fulfilled' ? (unreviewedRes.value.count ?? 0) : 0,
    alertsThisWeek:   weekAlertsRes.status  === 'fulfilled' ? (weekAlertsRes.value.count ?? 0) : 0,
  }
}

// ── getPatientRoster ───────────────────────────────────────────────────────
// Patients with profile name, primary active condition, and 30-day alert count.
// Ordered by lastCheckinAt descending (nulls last — done client-side).

export async function getPatientRoster(): Promise<PatientRosterRow[]> {
  try {
    // Fetch patients + profiles + primary active condition
    const { data: patients, error: pErr } = await supabase
      .from('patients')
      .select(`
        id,
        profiles!inner(full_name),
        checkins(checked_in_at),
        patient_conditions!inner(
          active,
          primary_condition,
          conditions!inner(name, slug)
        )
      `)
      .eq('patient_conditions.active', true)
      .eq('patient_conditions.primary_condition', true)

    if (pErr || !patients) return []

    // Fetch alert counts for last 30 days, grouped by patient
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: alerts } = await supabase
      .from('alerts')
      .select('patient_id')
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Count alerts per patient client-side
    const alertCounts: Record<string, number> = {}
    for (const a of alerts ?? []) {
      alertCounts[a.patient_id] = (alertCounts[a.patient_id] ?? 0) + 1
    }

    // Shape rows
    const rows: PatientRosterRow[] = (patients as unknown as PatientRosterRaw[]).map(p => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
      const pc = Array.isArray(p.patient_conditions) ? p.patient_conditions[0] : p.patient_conditions
      const cond = pc ? (Array.isArray(pc.conditions) ? pc.conditions[0] : pc.conditions) : null
      const checkins: Array<{ checked_in_at: string }> = p.checkins ?? []
      const lastCheckinAt = checkins.length > 0
        ? checkins.reduce((latest, c) =>
            c.checked_in_at > latest.checked_in_at ? c : latest
          ).checked_in_at
        : null

      return {
        id: p.id,
        name: profile?.full_name ?? 'Unknown',
        conditionName: cond?.name ?? '',
        conditionSlug: cond?.slug ?? '',
        lastCheckinAt,
        openAlertCount: alertCounts[p.id] ?? 0,
      }
    })

    // Sort: most recent check-in first, nulls last
    rows.sort((a, b) => {
      if (!a.lastCheckinAt && !b.lastCheckinAt) return 0
      if (!a.lastCheckinAt) return 1
      if (!b.lastCheckinAt) return -1
      return b.lastCheckinAt.localeCompare(a.lastCheckinAt)
    })

    return rows
  } catch {
    return []
  }
}

// Internal raw shape returned by the Supabase join query
interface PatientRosterRaw {
  id: string
  profiles: { full_name: string | null } | Array<{ full_name: string | null }>
  checkins: Array<{ checked_in_at: string }>
  patient_conditions: Array<{
    active: boolean
    primary_condition: boolean
    conditions: { name: string; slug: string } | Array<{ name: string; slug: string }>
  }>
}

// ── getPatientDetail ───────────────────────────────────────────────────────
// Latest checkin + last 5 alerts for one patient.

export async function getPatientDetail(patientId: string): Promise<PatientDetail> {
  try {
    const [checkinRes, alertsRes] = await Promise.all([
      supabase
        .from('checkins')
        .select('*')
        .eq('patient_id', patientId)
        .order('checked_in_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('alerts')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    return {
      latestCheckin: (checkinRes.error || !checkinRes.data) ? null : checkinRes.data as Checkin,
      recentAlerts:  (alertsRes.error  || !alertsRes.data)  ? []   : alertsRes.data as AlertRow[],
    }
  } catch {
    return { latestCheckin: null, recentAlerts: [] }
  }
}

// ── getAlerts ──────────────────────────────────────────────────────────────
// Last 30 days of alerts joined with patient name, newest first.
// Optional severity filter. Returns [] on error.

export async function getAlerts(severity?: 'high' | 'medium' | 'low'): Promise<AlertWithPatient[]> {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let query = supabase
      .from('alerts')
      .select(`
        *,
        patients!inner(
          profile_id,
          profiles!inner(full_name)
        )
      `)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (severity) query = query.eq('severity', severity)

    const { data, error } = await query
    if (error || !data) return []

    return (data as unknown as AlertWithPatientRaw[]).map(row => {
      const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients
      const profile = patient
        ? (Array.isArray(patient.profiles) ? patient.profiles[0] : patient.profiles)
        : null
      return {
        id:           row.id,
        patient_id:   row.patient_id,
        condition_id: row.condition_id,
        checkin_id:   row.checkin_id,
        alert_type:   row.alert_type,
        severity:     row.severity,
        created_at:   row.created_at,
        patientName:  profile?.full_name ?? 'Unknown',
      }
    })
  } catch {
    return []
  }
}

interface AlertWithPatientRaw extends AlertRow {
  patients: {
    profile_id: string
    profiles: { full_name: string | null } | Array<{ full_name: string | null }>
  } | Array<{
    profile_id: string
    profiles: { full_name: string | null } | Array<{ full_name: string | null }>
  }>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors. If the Supabase join shapes cause inference issues, the `as unknown as` casts in the map functions will absorb them.

- [ ] **Step 3: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/api/admin.ts
git commit -m "feat: add admin.ts with getAdminStats, getPatientRoster, getPatientDetail, getAlerts"
```

---

### Task 3: Build Dashboard.tsx

**Files:**
- Modify: `src/admin/pages/Dashboard.tsx`

Replaces the `<h1>` placeholder. Fetches stats + alerts in parallel on mount. Shows a time-of-day greeting, 4 stat tiles, and a 5-row recent alerts feed.

- [ ] **Step 1: Replace `src/admin/pages/Dashboard.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getAdminStats, getAlerts } from '@/api/admin'
import type { AdminStats, AlertWithPatient } from '@/api/supabase.types'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatRelativeTime(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1)   return 'just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  return `${diffDays}d ago`
}

const ALERT_LABELS: Record<string, string> = {
  weight_gain:        'Weight gain above baseline',
  abnormal_hr:        'Abnormal heart rate',
  high_breathlessness:'High breathlessness score',
  high_swelling:      'High swelling score',
  missed_medications: 'Missed medications',
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const styles: Record<string, { color: string; bg: string; label: string }> = {
    high:   { color: 'var(--color-alert-high)',   bg: 'var(--color-alert-high-bg)',   label: 'HIGH' },
    medium: { color: 'var(--color-alert-medium)', bg: 'var(--color-alert-medium-bg)', label: 'MED' },
    low:    { color: 'var(--color-alert-low)',    bg: 'var(--color-alert-low-bg)',    label: 'LOW' },
  }
  const s = styles[severity]
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      fontSize: 'var(--font-size-xs)',
      fontWeight: 'var(--font-weight-bold)',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

export function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats]   = useState<AdminStats | null>(null)
  const [alerts, setAlerts] = useState<AlertWithPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [s, a] = await Promise.all([getAdminStats(), getAlerts()])
        if (cancelled) return
        setStats(s)
        setAlerts(a)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const providerName = profile?.full_name ?? 'Doctor'
  const recentAlerts = alerts.slice(0, 5)

  const tileData = [
    { label: 'Active Patients',   value: stats?.activePatients,   accent: false },
    { label: 'Check-ins Today',   value: stats?.checkinsToday,    accent: false },
    {
      label: 'Unreviewed Alerts',
      value: stats?.unreviewedAlerts,
      accent: (stats?.unreviewedAlerts ?? 0) > 0,
    },
    { label: 'Alerts This Week',  value: stats?.alertsThisWeek,   accent: false },
  ]

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', margin: 0 }}>
          {getGreeting()}, {providerName}
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {today}
        </p>
      </div>

      {error && (
        <p style={{ color: 'var(--color-alert-high)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
          Could not load data. Try refreshing.
        </p>
      )}

      {/* Stat tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {tileData.map(tile => (
          <div key={tile.label} style={{
            background: tile.accent ? 'var(--color-alert-high-bg)' : 'var(--color-surface)',
            border: `1px solid ${tile.accent ? 'var(--color-alert-high)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: tile.accent ? 'var(--color-alert-high)' : 'var(--color-text-muted)', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
              {tile.label.toUpperCase()}
            </div>
            {loading ? (
              <div style={{ height: 36, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', width: '60%' }} />
            ) : (
              <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: tile.accent ? 'var(--color-alert-high)' : 'var(--color-text)', lineHeight: 1 }}>
                {tile.value ?? '—'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent alerts card */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', margin: 0 }}>
            Recent Alerts
          </h2>
          <Link to="/admin/alerts" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-light)', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 40, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)' }} />
            ))}
          </div>
        ) : recentAlerts.length === 0 ? (
          <p style={{ padding: 'var(--space-5)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            No alerts today.
          </p>
        ) : (
          recentAlerts.map((alert, i) => (
            <div key={alert.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-5)',
              borderBottom: i < recentAlerts.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <SeverityBadge severity={alert.severity} />
              <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
              </span>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                {alert.patientName}
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)', whiteSpace: 'nowrap' }}>
                {formatRelativeTime(alert.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Start dev server and verify Dashboard renders**

```bash
cd /Users/larrygoode/cardiotrack && npm run dev
```

Navigate to `http://localhost:5173/admin`. Expected:
- Time-of-day greeting with provider name
- 4 stat tiles (loading skeletons → real numbers)
- Recent alerts card (empty state or alert rows)

- [ ] **Step 4: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/admin/pages/Dashboard.tsx
git commit -m "feat: implement Dashboard page with stat tiles and recent alerts feed"
```

---

### Task 4: Build Members.tsx

**Files:**
- Modify: `src/admin/pages/Members.tsx`

Master-detail layout. 240px left panel (search + patient list), flex-1 right panel (patient detail or empty state). Reads `?patient=<id>` search param on mount to support deep-linking from Alerts page.

- [ ] **Step 1: Replace `src/admin/pages/Members.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPatientRoster, getPatientDetail } from '@/api/admin'
import type { PatientRosterRow, PatientDetail } from '@/api/supabase.types'

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const now = new Date()
  const date = new Date(iso)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1)   return 'just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  return `${diffDays}d ago`
}

function formatAbsoluteTime(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const ALERT_LABELS: Record<string, string> = {
  weight_gain:        'Weight gain above baseline',
  abnormal_hr:        'Abnormal heart rate',
  high_breathlessness:'High breathlessness score',
  high_swelling:      'High swelling score',
  missed_medications: 'Missed medications',
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const styles: Record<string, { color: string; bg: string; label: string }> = {
    high:   { color: 'var(--color-alert-high)',   bg: 'var(--color-alert-high-bg)',   label: 'HIGH' },
    medium: { color: 'var(--color-alert-medium)', bg: 'var(--color-alert-medium-bg)', label: 'MED' },
    low:    { color: 'var(--color-alert-low)',    bg: 'var(--color-alert-low-bg)',    label: 'LOW' },
  }
  const s = styles[severity]
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      fontSize: 'var(--font-size-xs)',
      fontWeight: 'var(--font-weight-bold)',
      padding: '2px 7px',
      borderRadius: 'var(--radius-full)',
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function ConditionChip({ slug, name }: { slug: string; name: string }) {
  const colorMap: Record<string, { color: string; bg: string }> = {
    heart_failure: { color: 'var(--color-hf)',       bg: 'var(--color-hf-bg)' },
    diabetes:      { color: 'var(--color-diabetes)',  bg: 'var(--color-diabetes-bg)' },
    ckd:           { color: 'var(--color-ckd)',       bg: 'var(--color-ckd-bg)' },
  }
  const c = colorMap[slug] ?? { color: 'var(--color-text-muted)', bg: 'var(--color-bg)' }
  return (
    <span style={{
      background: c.bg,
      color: c.color,
      fontSize: 'var(--font-size-xs)',
      fontWeight: 'var(--font-weight-semibold)',
      padding: '1px 7px',
      borderRadius: 'var(--radius-full)',
    }}>
      {name}
    </span>
  )
}

function VitalTile({ label, value, unit }: { label: string; value: number | null | undefined; unit?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)', marginBottom: 4, letterSpacing: '0.05em' }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', lineHeight: 1 }}>
        {value != null ? value : '—'}
      </div>
      {unit && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
          {unit}
        </div>
      )}
    </div>
  )
}

function BPTile({ systolic, diastolic }: { systolic: number | null | undefined; diastolic: number | null | undefined }) {
  const hasValue = systolic != null && diastolic != null
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)', marginBottom: 4, letterSpacing: '0.05em' }}>
        BLOOD PRESSURE
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', lineHeight: 1 }}>
        {hasValue ? (
          <>
            {systolic}
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-normal)', color: 'var(--color-text-muted)' }}>
              /{diastolic}
            </span>
          </>
        ) : '—'}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>mmHg</div>
    </div>
  )
}

export function Members() {
  const [searchParams] = useSearchParams()
  const [roster, setRoster]               = useState<PatientRosterRow[]>([])
  const [filtered, setFiltered]           = useState<PatientRosterRow[]>([])
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [detail, setDetail]               = useState<PatientDetail | null>(null)
  const [search, setSearch]               = useState('')
  const [rosterLoading, setRosterLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rosterError, setRosterError]     = useState(false)

  // Load roster on mount, then handle ?patient= param
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const rows = await getPatientRoster()
        if (cancelled) return
        setRoster(rows)
        setFiltered(rows)

        const paramId = searchParams.get('patient')
        if (paramId && rows.some(r => r.id === paramId)) {
          setSelectedId(paramId)
        }
      } catch {
        if (!cancelled) setRosterError(true)
      } finally {
        if (!cancelled) setRosterLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch detail when selectedId changes
  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    let cancelled = false
    async function load() {
      setDetailLoading(true)
      const d = await getPatientDetail(selectedId)
      if (cancelled) return
      setDetail(d)
      setDetailLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [selectedId])

  // Client-side search filter
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q ? roster.filter(p => p.name.toLowerCase().includes(q)) : roster)
  }, [search, roster])

  const selected = roster.find(r => r.id === selectedId) ?? null

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--space-8) * 2)', margin: 'calc(-1 * var(--space-8))', overflow: 'hidden' }}>

      {/* Patient list column */}
      <div style={{
        width: 240,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Header + search */}
        <div style={{ padding: 'var(--space-5) var(--space-4) var(--space-3)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', margin: '0 0 var(--space-3)' }}>
            Members
          </h1>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 14 }}>⌕</span>
            <input
              type="search"
              placeholder="Search patients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 8px 6px 26px',
                fontSize: 'var(--font-size-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                outline: 'none',
                color: 'var(--color-text)',
                background: 'var(--color-bg)',
              }}
            />
          </div>
        </div>

        {/* Patient rows */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2)' }}>
          {rosterError && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-alert-high)', padding: 'var(--space-2)' }}>
              Could not load data. Try refreshing.
            </p>
          )}

          {rosterLoading && (
            [1,2,3,4].map(i => (
              <div key={i} style={{ height: 52, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-1)' }} />
            ))
          )}

          {!rosterLoading && filtered.length === 0 && !rosterError && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-2)' }}>
              {search ? 'No patients match your search.' : 'No patients enrolled yet.'}
            </p>
          )}

          {!rosterLoading && filtered.map(patient => {
            const isSelected = patient.id === selectedId
            return (
              <button
                key={patient.id}
                onClick={() => setSelectedId(patient.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--color-primary-subtle)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: 'var(--space-1)',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: isSelected ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                      color: 'var(--color-text)',
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {patient.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {patient.conditionName} · {formatRelativeTime(patient.lastCheckinAt)}
                    </div>
                  </div>
                  {patient.openAlertCount > 0 && (
                    <span style={{
                      background: 'var(--color-alert-high-bg)',
                      color: 'var(--color-alert-high)',
                      fontSize: 9,
                      fontWeight: 'var(--font-weight-bold)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-full)',
                      flexShrink: 0,
                    }}>
                      {patient.openAlertCount}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, background: 'var(--color-bg)', overflowY: 'auto', padding: 'var(--space-6)' }}>

        {!selected && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Select a patient to view their details.
            </p>
          </div>
        )}

        {selected && detailLoading && (
          <div>
            <div style={{ height: 40, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', width: '50%' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 70, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }} />)}
            </div>
            <div style={{ height: 120, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }} />
          </div>
        )}

        {selected && !detailLoading && detail && (
          <div>
            {/* Patient header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--color-primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-md)',
                flexShrink: 0,
              }}>
                {getInitials(selected.name)}
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
                  {selected.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 2 }}>
                  <ConditionChip slug={selected.conditionSlug} name={selected.conditionName} />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Last check-in: {formatAbsoluteTime(selected.lastCheckinAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Latest vitals */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                LATEST VITALS
              </div>
              {!detail.latestCheckin ? (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>No check-in data.</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <VitalTile label="Weight" value={detail.latestCheckin.weight_lbs} unit="lbs" />
                    <BPTile systolic={detail.latestCheckin.bp_systolic} diastolic={detail.latestCheckin.bp_diastolic} />
                    <VitalTile label="Heart Rate" value={detail.latestCheckin.heart_rate} unit="bpm" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-2)' }}>
                    <VitalTile label="Breathlessness" value={detail.latestCheckin.breathlessness} unit="/5" />
                    <VitalTile label="Swelling"       value={detail.latestCheckin.swelling}       unit="/5" />
                    <VitalTile label="Fatigue"        value={detail.latestCheckin.fatigue_score}  unit="/5" />
                  </div>
                </>
              )}
            </div>

            {/* Recent alerts */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
            }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
                Recent Alerts
              </div>
              {detail.recentAlerts.length === 0 ? (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>No recent alerts.</p>
              ) : (
                detail.recentAlerts.map((alert, i) => (
                  <div key={alert.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) 0',
                    borderBottom: i < detail.recentAlerts.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  }}>
                    <SeverityBadge severity={alert.severity} />
                    <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                      {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)', whiteSpace: 'nowrap' }}>
                      {formatRelativeTime(alert.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Verify Members page in browser**

Navigate to `http://localhost:5173/admin/members`. Expected:
- 240px left panel with search input and patient rows (or loading skeletons)
- Clicking a patient shows detail panel with vitals grid and recent alerts
- Searching filters the patient list client-side (no page refresh)
- Empty search matches: "No patients match your search."

- [ ] **Step 4: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/admin/pages/Members.tsx
git commit -m "feat: implement Members page with master-detail layout and patient search"
```

---

### Task 5: Build Alerts.tsx

**Files:**
- Modify: `src/admin/pages/Alerts.tsx`

Loads all alerts on mount. Severity filter tabs filter client-side. Patient name navigates to Members with `?patient=<id>`.

- [ ] **Step 1: Replace `src/admin/pages/Alerts.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlerts } from '@/api/admin'
import type { AlertWithPatient } from '@/api/supabase.types'

type SeverityFilter = 'high' | 'medium' | 'low' | null

const ALERT_LABELS: Record<string, string> = {
  weight_gain:        'Weight gain above baseline',
  abnormal_hr:        'Abnormal heart rate',
  high_breathlessness:'High breathlessness score',
  high_swelling:      'High swelling score',
  missed_medications: 'Missed medications',
}

const SEVERITY_TABS: Array<{ value: SeverityFilter; label: string }> = [
  { value: null,     label: 'All' },
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

const SEVERITY_COLORS: Record<string, { color: string; bg: string }> = {
  high:   { color: 'var(--color-alert-high)',   bg: 'var(--color-alert-high-bg)' },
  medium: { color: 'var(--color-alert-medium)', bg: 'var(--color-alert-medium-bg)' },
  low:    { color: 'var(--color-alert-low)',    bg: 'var(--color-alert-low-bg)' },
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const isToday =
    date.getDate()     === now.getDate()     &&
    date.getMonth()    === now.getMonth()    &&
    date.getFullYear() === now.getFullYear()

  if (isToday) {
    return 'Today ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate()     === yesterday.getDate()     &&
    date.getMonth()    === yesterday.getMonth()    &&
    date.getFullYear() === yesterday.getFullYear()

  if (isYesterday) {
    return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
         ', ' +
         date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const s = SEVERITY_COLORS[severity]
  const labels = { high: 'HIGH', medium: 'MED', low: 'LOW' }
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      fontSize: 'var(--font-size-xs)',
      fontWeight: 'var(--font-weight-bold)',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      whiteSpace: 'nowrap',
    }}>
      {labels[severity]}
    </span>
  )
}

export function Alerts() {
  const navigate = useNavigate()
  const [allAlerts, setAllAlerts]             = useState<AlertWithPatient[]>([])
  const [severityFilter, setSeverityFilter]   = useState<SeverityFilter>(null)
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getAlerts()
        if (!cancelled) setAllAlerts(data)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const displayed = severityFilter === null
    ? allAlerts
    : allAlerts.filter(a => a.severity === severityFilter)

  const countFor = (s: SeverityFilter) =>
    s === null ? allAlerts.length : allAlerts.filter(a => a.severity === s).length

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', margin: 0 }}>
          Alerts
        </h1>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          Showing last 30 days
        </span>
      </div>

      {error && (
        <p style={{ color: 'var(--color-alert-high)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
          Could not load data. Try refreshing.
        </p>
      )}

      {/* Severity filter tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 'var(--space-4)',
        background: 'var(--color-surface)',
        padding: 4,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        width: 'fit-content',
      }}>
        {SEVERITY_TABS.map(tab => {
          const isActive = severityFilter === tab.value
          const severityColor = tab.value ? SEVERITY_COLORS[tab.value].color : undefined
          return (
            <button
              key={String(tab.value)}
              onClick={() => setSeverityFilter(tab.value)}
              style={{
                padding: '5px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                background: isActive ? 'var(--color-text)' : 'transparent',
                color: isActive ? '#fff' : (severityColor ?? 'var(--color-text-muted)'),
                transition: 'background var(--transition-fast), color var(--transition-fast)',
              }}
            >
              {tab.label}{' '}
              <span style={{ opacity: 0.6, fontWeight: 'var(--font-weight-normal)' }}>
                {countFor(tab.value)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Alerts table */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr 180px 160px',
          gap: 'var(--space-3)',
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-muted)',
          letterSpacing: '0.04em',
        }}>
          <span>SEVERITY</span>
          <span>ALERT</span>
          <span>PATIENT</span>
          <span>TIME</span>
        </div>

        {/* Loading skeletons */}
        {loading && (
          [1,2,3,4,5].map(i => (
            <div key={i} style={{
              height: 44,
              background: 'var(--color-border-subtle)',
              margin: 'var(--space-1) var(--space-4)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: i < 5 ? 'var(--space-1)' : 'var(--space-2)',
            }} />
          ))
        )}

        {/* Empty state */}
        {!loading && displayed.length === 0 && (
          <p style={{ padding: 'var(--space-5) var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            {severityFilter
              ? `No ${severityFilter} alerts in the last 30 days.`
              : 'No alerts in the last 30 days.'
            }
          </p>
        )}

        {/* Alert rows */}
        {!loading && displayed.map((alert, i) => (
          <div key={alert.id} style={{
            display: 'grid',
            gridTemplateColumns: '90px 1fr 180px 160px',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: i < displayed.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            alignItems: 'center',
          }}>
            <div>
              <SeverityBadge severity={alert.severity} />
            </div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
              {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
            </span>
            <button
              onClick={() => navigate(`/admin/members?patient=${alert.patient_id}`)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-primary-light)',
                textAlign: 'left',
              }}
            >
              {alert.patientName}
            </button>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {formatTimestamp(alert.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/larrygoode/cardiotrack && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Verify Alerts page in browser**

Navigate to `http://localhost:5173/admin/alerts`. Expected:
- "Alerts" heading + "Showing last 30 days" label
- Filter tabs (All / High / Medium / Low) with live counts
- Table with severity badge, description, patient name (clickable), timestamp
- Clicking a patient name navigates to `/admin/members?patient=<id>` and pre-selects that patient

- [ ] **Step 4: Verify cross-page navigation**

In the Alerts table, click any patient name. Expected: lands on `/admin/members`, the clicked patient is pre-selected in the left panel, and their detail loads in the right panel.

- [ ] **Step 5: Commit**

```bash
cd /Users/larrygoode/cardiotrack
git add src/admin/pages/Alerts.tsx
git commit -m "feat: implement Alerts page with severity filter tabs and cross-page navigation"
```

---

## Self-Review

**Spec coverage check:**
- [x] 4 stat tiles on Dashboard — Task 3
- [x] Recent alerts feed (last 5, "View all →" link) — Task 3
- [x] Patient list with name search — Task 4
- [x] Master-detail panel: latest vitals + recent alerts — Task 4
- [x] Cross-page navigation: Alerts → Members via `?patient=` — Task 5
- [x] Severity filter tabs (All / High / Medium / Low) — Task 5
- [x] Alert type labels map — Tasks 3, 4, 5 all include the same `ALERT_LABELS` map
- [x] Loading states (skeleton blocks) — all three pages
- [x] Error states inline — all three pages
- [x] Empty states (no patients, no alerts, no search match) — all three pages
- [x] Time-of-day greeting — Task 3
- [x] Unreviewed alerts tile accent color when > 0 — Task 3
- [x] BP as combined systolic/diastolic tile — Task 4 (`BPTile` component)
- [x] Null vitals render as `—` — Task 4 (`VitalTile`)
- [x] `AdminStats`, `PatientRosterRow`, `PatientDetail`, `AlertWithPatient` types — Task 1
- [x] `getAdminStats`, `getPatientRoster`, `getPatientDetail`, `getAlerts` — Task 2
- [x] All functions silent-fail (never throw) — Task 2

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references found.

**Type consistency:**
- `SeverityBadge` used in Tasks 3, 4, 5 — same props interface `{ severity: 'high' | 'medium' | 'low' }`
- `ALERT_LABELS` copied verbatim across all three page files (consistent keys match spec table)
- `getAlerts()` in Task 2 returns `AlertWithPatient[]` — consumed as `AlertWithPatient[]` in Tasks 3 and 5
- `getPatientRoster()` returns `PatientRosterRow[]` — consumed as `PatientRosterRow[]` in Task 4
- `getPatientDetail()` returns `PatientDetail` — consumed as `PatientDetail | null` in Task 4
