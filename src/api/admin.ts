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
