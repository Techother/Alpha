import { supabase } from './supabase'
import type {
  QuestionnaireTemplate,
  AlertRow,
  SubmitPayload,
} from './supabase.types'

export async function getActiveTemplate(
  slug: string
): Promise<QuestionnaireTemplate | null> {
  const { data, error } = await supabase
    .from('questionnaire_templates')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (error) {
    console.error('getActiveTemplate error:', error.message)
    return null
  }

  return data as QuestionnaireTemplate
}

export async function getPatientRecord(
  profileId: string
): Promise<{ patientId: string; conditionId: string } | null> {
  // Get patient row
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', profileId)
    .single()

  if (patientError || !patient) {
    console.error('getPatientRecord: no patient row', patientError?.message)
    return null
  }

  // Get primary heart_failure condition for this patient
  const { data: conditionJoin, error: conditionError } = await supabase
    .from('patient_conditions')
    .select('condition_id, conditions(slug)')
    .eq('patient_id', patient.id)
    .eq('primary_condition', true)
    .eq('active', true)
    .single()

  if (conditionError || !conditionJoin) {
    console.error('getPatientRecord: no active primary condition', conditionError?.message)
    return null
  }

  return {
    patientId: patient.id as string,
    conditionId: conditionJoin.condition_id as string,
  }
}

export async function submitCheckinSession(
  payload: SubmitPayload
): Promise<{ sessionId: string; checkinId: string }> {
  const { patientId, conditionId, templateSlug, startedAt, parsed } = payload
  const completedAt = new Date().toISOString()

  // 1. Insert chatbot_session
  // TODO(Sub-project B): look up template UUID from templateSlug and write template_id here
  const { data: sessionData, error: sessionError } = await supabase
    .from('chatbot_sessions')
    .insert({
      patient_id: patientId,
      condition_id: conditionId,
      status: 'completed',
      started_at: startedAt,
      completed_at: completedAt,
    })
    .select('id')
    .single()

  if (sessionError || !sessionData) {
    throw new Error(`Failed to create session: ${sessionError?.message}`)
  }

  const sessionId = sessionData.id as string

  // 2. Insert legacy checkin row
  const { data: checkinData, error: checkinError } = await supabase
    .from('checkins')
    .insert({
      patient_id: patientId,
      session_id: sessionId,
      weight_lbs: parsed.weight_lbs,
      heart_rate: parsed.heart_rate,
      bp_systolic: parsed.bp_systolic,
      bp_diastolic: parsed.bp_diastolic,
      fatigue_score: parsed.fatigue_score,
      breathlessness: parsed.breathlessness,
      swelling: parsed.swelling,
      medications: parsed.medications,
      free_text: parsed.free_text,
      checked_in_at: completedAt,
    })
    .select('id')
    .single()

  if (checkinError || !checkinData) {
    throw new Error(`Failed to create checkin: ${checkinError?.message}`)
  }

  const checkinId = checkinData.id as string

  // 3. Insert typed observations (numeric values only)
  const observationRows = [
    { observation_type: 'weight_lbs',   value_numeric: parsed.weight_lbs,   unit: 'lbs' },
    { observation_type: 'heart_rate',   value_numeric: parsed.heart_rate,   unit: 'bpm' },
    { observation_type: 'bp_systolic',  value_numeric: parsed.bp_systolic,  unit: 'mmHg' },
    { observation_type: 'bp_diastolic', value_numeric: parsed.bp_diastolic, unit: 'mmHg' },
    { observation_type: 'fatigue_score',value_numeric: parsed.fatigue_score, unit: null },
  ]
    .filter(o => o.value_numeric !== null)
    .map(o => ({
      patient_id: patientId,
      condition_id: conditionId,
      session_id: sessionId,
      checkin_id: checkinId,
      observation_type: o.observation_type,
      value_numeric: o.value_numeric,
      unit: o.unit,
      source: 'chatbot' as const,
      observed_at: completedAt,
    }))

  if (observationRows.length > 0) {
    const { error: obsError } = await supabase.from('observations').insert(observationRows)
    if (obsError) throw new Error(`Failed to insert observations: ${obsError.message}`)
  }

  // 4. Insert symptom reports (severity scores only)
  const symptomRows = [
    { symptom_type: 'breathlessness', severity_score: parsed.breathlessness },
    { symptom_type: 'swelling',       severity_score: parsed.swelling },
  ]
    .filter(s => s.severity_score !== null)
    .map(s => ({
      patient_id: patientId,
      condition_id: conditionId,
      session_id: sessionId,
      checkin_id: checkinId,
      symptom_type: s.symptom_type,
      severity_score: s.severity_score,
      free_text: parsed.free_text,
      reported_at: completedAt,
    }))

  if (symptomRows.length > 0) {
    const { error: symError } = await supabase.from('symptom_reports').insert(symptomRows)
    if (symError) throw new Error(`Failed to insert symptom reports: ${symError.message}`)
  }

  void templateSlug // retained in payload interface for future transcript storage

  return { sessionId, checkinId }
}

export async function getRecentAlerts(
  patientId: string,
  since: string
): Promise<AlertRow[]> {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('patient_id', patientId)
      .gt('created_at', since)

    // alerts table may not exist yet (Sub-project C) — return empty gracefully
    if (error) return []
    return (data ?? []) as AlertRow[]
  } catch {
    return []
  }
}
