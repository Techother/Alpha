import { supabase } from './supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

function billingPeriodFromDate(dateStr: string) {
  return dateStr.slice(0, 7) // 'YYYY-MM'
}

export interface BillingData {
  patientId: string
  firstName?: string
  lastName?: string
  mrn?: string
  checkinDays: number
  rpmMinutes: number
  cpt99454Met: boolean
  cpt99457Met: boolean
  cpt99458Count: number
  estimatedReimbursement: number
}

export async function getBillingPeriodData(
  patientId: string,
  billingPeriod: string
): Promise<BillingData> {
  const db = requireSupabase()

  const [checkinRes, rpmRes] = await Promise.all([
    db
      .from('checkins')
      .select('checkin_date')
      .eq('patient_id', patientId)
      .like('checkin_date', `${billingPeriod}%`),
    db
      .from('rpm_time_logs')
      .select('duration_minutes')
      .eq('patient_id', patientId)
      .eq('billing_period', billingPeriod),
  ])

  const checkinDays = (checkinRes.data ?? []).length
  const rpmMinutes = (rpmRes.data ?? []).reduce(
    (sum: number, r: any) => sum + (r.duration_minutes ?? 0),
    0
  )

  const cpt99454Met = checkinDays >= 16
  const cpt99457Met = rpmMinutes >= 20
  const cpt99458Count = cpt99457Met ? Math.floor((rpmMinutes - 20) / 20) : 0

  const estimatedReimbursement =
    (cpt99454Met ? 64 : 0) +
    (cpt99457Met ? 52 : 0) +
    cpt99458Count * 41

  return {
    patientId,
    checkinDays,
    rpmMinutes,
    cpt99454Met,
    cpt99457Met,
    cpt99458Count,
    estimatedReimbursement,
  }
}

export async function getMonthlyBillingSummary(billingPeriod: string): Promise<BillingData[]> {
  const db = requireSupabase()

  const { data: patients } = await db
    .from('patients')
    .select('id, first_name, last_name, mrn')
    .eq('active', true)

  if (!patients?.length) return []

  const results = await Promise.all(
    patients.map(async (p: any) => {
      const data = await getBillingPeriodData(p.id, billingPeriod)
      return {
        ...data,
        firstName: p.first_name,
        lastName: p.last_name,
        mrn: p.mrn,
      }
    })
  )

  return results
}

export async function logRpmTime(payload: {
  patientId: string
  logDate: string
  durationMinutes: number
  activityType: string
  notes?: string
}) {
  const db = requireSupabase()
  const billingPeriod = billingPeriodFromDate(payload.logDate)
  const { data, error } = await db.from('rpm_time_logs').insert({
    patient_id: payload.patientId,
    log_date: payload.logDate,
    duration_minutes: payload.durationMinutes,
    activity_type: payload.activityType,
    notes: payload.notes ?? null,
    billing_period: billingPeriod,
  }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function getRpmTimeLogs(patientId: string, billingPeriod: string) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('rpm_time_logs')
    .select('*')
    .eq('patient_id', patientId)
    .eq('billing_period', billingPeriod)
    .order('log_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function exportBillingCSV(billingPeriod: string): Promise<string> {
  const summary = await getMonthlyBillingSummary(billingPeriod)
  const header = 'Patient,MRN,Checkin Days,99454,RPM Mins,99457,99458 Count,Est Revenue'
  const rows = summary.map(s =>
    [
      `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
      s.mrn ?? '',
      s.checkinDays,
      s.cpt99454Met ? 'Yes' : 'No',
      s.rpmMinutes,
      s.cpt99457Met ? 'Yes' : 'No',
      s.cpt99458Count,
      `$${s.estimatedReimbursement}`,
    ].join(',')
  )
  return [header, ...rows].join('\n')
}
