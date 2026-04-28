import { supabase } from './supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

export async function getPatientMedications(patientId: string) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .eq('active', true)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAllMedications(patientId: string) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addMedication(payload: {
  patient_id: string
  name: string
  dosage?: string
  frequency?: string
  instructions?: string
}) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('medications')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateMedication(
  id: string,
  payload: Partial<{
    name: string
    dosage: string
    frequency: string
    instructions: string
    active: boolean
  }>
) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('medications')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deactivateMedication(id: string) {
  return updateMedication(id, { active: false })
}

export async function getMedicationLogs(patientId: string, days = 30) {
  const db = requireSupabase()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data, error } = await db
    .from('medication_logs')
    .select('*, medications(name, dosage, frequency)')
    .eq('patient_id', patientId)
    .gte('checkin_date', since.toISOString().slice(0, 10))
    .order('checkin_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function logMedications(
  patientId: string,
  checkinDate: string,
  medicationAnswers: Array<{ medicationId: string; taken: boolean }>
) {
  const db = requireSupabase()
  const records = medicationAnswers.map(a => ({
    patient_id: patientId,
    medication_id: a.medicationId,
    checkin_date: checkinDate,
    taken: a.taken,
  }))
  const { error } = await db
    .from('medication_logs')
    .upsert(records, { onConflict: 'patient_id,medication_id,checkin_date' })
  if (error) throw new Error(error.message)
}

export async function getMedicationAdherence(patientId: string, days = 30) {
  const db = requireSupabase()
  const since = new Date()
  since.setDate(since.getDate() - days)

  const [medsRes, logsRes] = await Promise.all([
    db.from('medications').select('id, name, dosage').eq('patient_id', patientId).eq('active', true),
    db.from('medication_logs').select('medication_id, taken, checkin_date')
      .eq('patient_id', patientId)
      .gte('checkin_date', since.toISOString().slice(0, 10)),
  ])

  const meds = medsRes.data ?? []
  const logs = logsRes.data ?? []

  return meds.map((med: any) => {
    const medLogs = logs.filter((l: any) => l.medication_id === med.id)
    const takenCount = medLogs.filter((l: any) => l.taken === true).length
    const totalDays = medLogs.length
    const adherencePct = totalDays > 0 ? Math.round((takenCount / totalDays) * 100) : null
    return { medicationId: med.id, name: med.name, dosage: med.dosage, takenCount, totalDays, adherencePct }
  })
}
