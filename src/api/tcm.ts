import { supabase } from './supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

function addBusinessDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d.toISOString().slice(0, 10)
}

function addCalendarDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function getActiveTcmEpisodes() {
  const db = requireSupabase()
  const { data, error } = await db
    .from('tcm_episodes')
    .select('*, patients(first_name, last_name, mrn)')
    .eq('status', 'open')
    .order('discharge_date', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPatientTcmEpisodes(patientId: string) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('tcm_episodes')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createTcmEpisode(payload: {
  patientId: string
  dischargeDate: string
  dischargeFacility?: string
  diagnosis?: string
  complexity?: 'moderate' | 'high'
  notes?: string
}) {
  const db = requireSupabase()
  const day2Deadline = addBusinessDays(payload.dischargeDate, 2)
  const day7Deadline = addCalendarDays(payload.dischargeDate, 7)

  const { data, error } = await db
    .from('tcm_episodes')
    .insert({
      patient_id: payload.patientId,
      discharge_date: payload.dischargeDate,
      discharge_facility: payload.dischargeFacility ?? null,
      diagnosis: payload.diagnosis ?? null,
      complexity: payload.complexity ?? 'moderate',
      day2_deadline: day2Deadline,
      day7_deadline: day7Deadline,
      notes: payload.notes ?? null,
      status: 'open',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function logTcmContact(
  episodeId: string,
  payload: {
    contactDate: string
    contactType: 'phone' | 'video' | 'in-person'
    reached: boolean
    milestone: 'day2' | 'day7' | 'follow-up'
    notes?: string
  }
) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('tcm_contacts')
    .insert({
      episode_id: episodeId,
      contact_date: payload.contactDate,
      contact_type: payload.contactType,
      reached: payload.reached,
      milestone: payload.milestone,
      notes: payload.notes ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  if (payload.milestone === 'day2' && payload.reached) {
    await completeTcmMilestone(episodeId, 'day2')
  }
  return data
}

export async function completeTcmMilestone(episodeId: string, milestone: 'day2' | 'day7') {
  const db = requireSupabase()

  const update: Record<string, any> =
    milestone === 'day2'
      ? { day2_completed: true, day2_completed_at: new Date().toISOString() }
      : { day7_completed: true, day7_completed_at: new Date().toISOString() }

  const { data: updated, error } = await db
    .from('tcm_episodes')
    .update(update)
    .eq('id', episodeId)
    .select()
    .single()
  if (error) throw new Error(error.message)

  if (updated.day2_completed && updated.day7_completed) {
    await db.from('tcm_episodes').update({ status: 'complete' }).eq('id', episodeId)
  }
  return updated
}

export async function getOverdueTcmEpisodes() {
  const db = requireSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await db
    .from('tcm_episodes')
    .select('*, patients(first_name, last_name, mrn)')
    .eq('status', 'open')
    .or(
      `and(day2_completed.eq.false,day2_deadline.lt.${today}),and(day7_completed.eq.false,day7_deadline.lt.${today})`
    )
    .order('discharge_date', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}
