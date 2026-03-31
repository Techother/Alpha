import { supabase } from './supabase'
import { evaluateAlerts } from '@/lib/alertEngine'
import type { AlertInsert, Observation, ParsedAnswers } from './supabase.types'

export async function getRecentWeightObservations(
  patientId: string,
  days: number
): Promise<Observation[]> {
  try {
    const { data, error } = await supabase
      .from('observations')
      .select('*')
      .eq('patient_id', patientId)
      .eq('observation_type', 'weight_lbs')
      .order('observed_at', { ascending: false })
      .limit(days)

    if (error) return []
    return (data ?? []) as Observation[]
  } catch {
    return []
  }
}

export async function insertAlerts(rows: AlertInsert[]): Promise<void> {
  if (rows.length === 0) return
  try {
    const { error } = await supabase.from('alerts').insert(rows)
    if (error) console.error('insertAlerts error:', error.message)
  } catch (err) {
    console.error('insertAlerts unexpected error:', err)
  }
}

export async function runAlertEngine(
  patientId: string,
  conditionId: string,
  checkinId: string,
  parsed: ParsedAnswers
): Promise<void> {
  try {
    const recentWeightObs = await getRecentWeightObservations(patientId, 3)
    const alertRows = evaluateAlerts(parsed, recentWeightObs, patientId, conditionId, checkinId)
    await insertAlerts(alertRows)
  } catch (err) {
    console.error('runAlertEngine unexpected error:', err)
  }
}
