import type { ParsedAnswers, AlertInsert, Observation } from '@/api/supabase.types'

export function evaluateAlerts(
  parsed: ParsedAnswers,
  recentWeightObs: Observation[],
  patientId: string,
  conditionId: string,
  checkinId: string
): AlertInsert[] {
  const results: AlertInsert[] = []

  function addAlert(alert_type: string, severity: AlertInsert['severity']) {
    results.push({
      patient_id: patientId,
      condition_id: conditionId,
      checkin_id: checkinId,
      alert_type,
      severity,
    })
  }

  // Rule: weight_gain — today's weight ≥ 2 lbs above minimum of prior 3 observations
  if (parsed.weight_lbs !== null && recentWeightObs.length > 0) {
    const priorMin = Math.min(...recentWeightObs.map(o => o.value_numeric!))
    if (parsed.weight_lbs - priorMin >= 2) {
      addAlert('weight_gain', 'high')
    }
  }

  // Rule: abnormal_hr — heart rate above 100 or below 50
  if (parsed.heart_rate !== null) {
    if (parsed.heart_rate > 100 || parsed.heart_rate < 50) {
      addAlert('abnormal_hr', 'high')
    }
  }

  // Rule: high_breathlessness — breathlessness score ≥ 4
  if (parsed.breathlessness !== null && parsed.breathlessness >= 4) {
    addAlert('high_breathlessness', 'high')
  }

  // Rule: high_swelling — swelling score ≥ 4
  if (parsed.swelling !== null && parsed.swelling >= 4) {
    addAlert('high_swelling', 'medium')
  }

  // Rule: missed_medications — patient reported not taking medications
  if (parsed.medications === false) {
    addAlert('missed_medications', 'medium')
  }

  // Rule: missed_checkin — deferred (requires scheduled job, not client-side)

  return results
}
