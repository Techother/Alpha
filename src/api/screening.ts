import { supabase } from './supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

export async function getPatientScreenings(patientId: string) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('screening_results')
    .select('*')
    .eq('patient_id', patientId)
    .order('administered_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getLatestScreening(patientId: string, screenType: 'phq9' | 'gad7') {
  const db = requireSupabase()
  const { data, error } = await db
    .from('screening_results')
    .select('*')
    .eq('patient_id', patientId)
    .eq('screen_type', screenType)
    .order('administered_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function createScreeningResult(payload: {
  patientId: string
  screenType: 'phq9' | 'gad7'
  score: number
  severity: string
  answers: Record<string, number>
  alertGenerated?: boolean
}) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('screening_results')
    .insert({
      patient_id: payload.patientId,
      screen_type: payload.screenType,
      score: payload.score,
      severity: payload.severity,
      answers: payload.answers,
      alert_generated: payload.alertGenerated ?? false,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function getPatientsNeedingScreening() {
  const db = requireSupabase()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString()

  const { data: patients } = await db
    .from('patients')
    .select('id, first_name, last_name, mrn, condition')
    .eq('active', true)

  if (!patients?.length) return []

  const { data: recentScreenings } = await db
    .from('screening_results')
    .select('patient_id')
    .gte('administered_at', cutoffStr)

  const recentIds = new Set((recentScreenings ?? []).map((s: any) => s.patient_id))
  return patients.filter((p: any) => !recentIds.has(p.id))
}

export function scorePHQ9(answers: number[]): { score: number; severity: string } {
  const score = answers.reduce((sum, a) => sum + (a ?? 0), 0)
  let severity: string
  if (score <= 4) severity = 'none'
  else if (score <= 9) severity = 'mild'
  else if (score <= 14) severity = 'moderate'
  else if (score <= 19) severity = 'moderately_severe'
  else severity = 'severe'
  return { score, severity }
}

export function scoreGAD7(answers: number[]): { score: number; severity: string } {
  const score = answers.reduce((sum, a) => sum + (a ?? 0), 0)
  let severity: string
  if (score <= 4) severity = 'none'
  else if (score <= 9) severity = 'mild'
  else if (score <= 14) severity = 'moderate'
  else severity = 'severe'
  return { score, severity }
}
